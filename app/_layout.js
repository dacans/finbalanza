import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { Stack, router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppEventsLogger } from "react-native-fbsdk-next";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "../src/firebase";
import { registerForPushTokenAsync } from "../notifications/push";
import { WizardProvider } from "../src/wizard/WizardProvider";
import { getCountry, loadCountry } from "../utils/countryConfig";
import { loadOffers } from "../utils/offersCache";
import { getCountryCode, getCachedCountryCode } from "../src/health/db";
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { initializeMeta, syncMetaTrackingPermission } from "../src/metaEvents";
import { initAppsFlyer } from "../services/appsflyer";

const GREEN = "#2E86DE";

// Clarity Project ID — FinBalanza
const CLARITY_ID = "x08oj2w7fs";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function makeId(len = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function getOrCreateDeviceId() {
  const key = "device_id";
  const existing = await AsyncStorage.getItem(key);
  if (existing) return existing;
  const id = makeId();
  await AsyncStorage.setItem(key, id);
  return id;
}

export default function RootLayout() {
  Clarity.initialize(CLARITY_ID, { logLevel: Clarity.LogLevel.None });

  const pathname = usePathname();
  const fbSentRef = useRef(false);

  const [bootstrapped, setBootstrapped] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const [isConnected, setIsConnected] = useState(null);
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [showWizard, setShowWizard] = useState(null);
  // Código de país elegido por el usuario en /balance/onboarding (null = no elegido aún)
  const [countryCode, setCountryCode] = useState(null);

  // NETWORK
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });
    return unsub;
  }, []);

  // ANALYTICS FB
  useEffect(() => {
    if (fbSentRef.current) return;
    fbSentRef.current = true;
    initializeMeta();
    try { AppEventsLogger.logEvent("app_open"); } catch {}
  }, []);

  // ATT + APPSFLYER — independiente del init de Firebase/AdMob (no altera su orden)
  useEffect(() => {
    (async () => {
      try {
        // En iOS pide permiso de seguimiento ANTES de inicializar AppsFlyer
        if (Platform.OS === "ios") {
          const { status } = await requestTrackingPermissionsAsync();
          void syncMetaTrackingPermission(status);
        }
      } catch {}
      // Inicializa AppsFlyer tras resolver el ATT
      try { initAppsFlyer(); } catch {}
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || Platform.OS !== "ios") return;
      getTrackingPermissionsAsync()
        .then(({ status }) => syncMetaTrackingPermission(status))
        .catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  // PUSH TOKEN
  useEffect(() => {
    (async () => {
      try {
        const token = await registerForPushTokenAsync();
        if (!token) return;
        const storedToken = await AsyncStorage.getItem("push_token");
        if (token === storedToken) return;
        await AsyncStorage.setItem("push_token", token);
        const deviceId = await getOrCreateDeviceId();
        await setDoc(
          doc(firestore, "devices", deviceId),
          {
            expo_push_token: token,
            platform: Platform.OS,
            updated_at: serverTimestamp(),
            country: getCountry(),
          },
          { merge: true }
        );
      } catch {}
    })();
  }, []);

  // BOOTSTRAP
  useEffect(() => {
    (async () => {
      let sw = false;
      let wc = false;
      let is = false;
      let cc = null;
      try {
        await loadCountry();
        await loadOffers(firestore);
        wc = (await AsyncStorage.getItem("wizard_completed")) === "true";
        if (wc) {
          const hasStep = await AsyncStorage.getItem("current_step");
          if (!hasStep) await AsyncStorage.setItem("current_step", "1");
        }
        is = (await AsyncStorage.getItem("intro_seen")) === "true";
        try {
          const snap = await getDoc(doc(firestore, "config", "app"));
          sw = snap.exists() ? Boolean(snap.data()?.showWizard) : false;
        } catch {
          sw = false;
        }
        // Lee el país guardado en SQLite (solo para la rama /balance)
        try { cc = await getCountryCode(); } catch {}
      } catch {
        // fail abierto
      } finally {
        setWizardCompleted(wc);
        setIntroSeen(is);
        setShowWizard(sw);
        setCountryCode(cc);
        setBootstrapped(true);
      }
    })();
  }, []);

  // SYNC EN CADA NAVEGACION
  useEffect(() => {
    if (!bootstrapped) return;
    (async () => {
      try {
        const is = (await AsyncStorage.getItem("intro_seen")) === "true";
        if (is !== introSeen) setIntroSeen(is);
        const wc = (await AsyncStorage.getItem("wizard_completed")) === "true";
        if (wc !== wizardCompleted) setWizardCompleted(wc);
        // Refresca el país después de que el usuario lo elija en /balance/onboarding
        const cc = await getCountryCode();
        if (cc !== countryCode) setCountryCode(cc);
      } catch {}
    })();
  }, [pathname, bootstrapped]);

  // PUSH LISTENER — si la notificación trae data.url, la abre externamente
  useEffect(() => {
    // Procesa la respuesta a una notificación tocada
    const handleResponse = (response) => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (data?.url) {
          // https:// → Safari ; https://wa.me/... → WhatsApp
          Linking.openURL(data.url);
        }
        // Si no hay data.url, se respeta el flujo actual (no se navega aquí)
      } catch {}
    };

    // Caso en frío: la app se abrió al tocar una notificación
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    // Caso en caliente: notificación tocada con la app ya abierta
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, []);

  // GATE
  useEffect(() => {
    if (!bootstrapped) return;
    if (showWizard === null) return;

    if (showWizard) {
      if (!wizardCompleted) {
        const allowedPaths = [
          "/wizard/intro",
          "/wizard/country",
          "/wizard/step1",
          "/wizard/step2",
          "/wizard/step3",
          "/analyzing",
          "/verification",
          "/waiting",
        ];
        if (!allowedPaths.includes(pathname)) {
          router.replace("/wizard/intro");
          return;
        }
        setGateReady(true);
        return;
      }
      if (pathname.startsWith("/wizard") || pathname === "/") {
        router.replace("/home");
        return;
      }
      if (pathname === "/verification") {
        setGateReady(true);
        return;
      }
      setGateReady(true);
      return;
    }

    // Rama /balance — funciona offline (on-device)
    const balancePaths = [
      "/balance",
      "/balance/onboarding",
      "/balance/gastos",
      "/balance/pagos",
      "/balance/historial",
      "/balance/ajustes",
      "/legal",
    ];
    // Lee el cache síncrono: ya fue poblado por getCountryCode() en el bootstrap
    // Evita la race condition de leer el estado de React (se actualiza un render tarde)
    const cc = getCachedCountryCode();
    if (!cc && pathname !== "/balance/onboarding") {
      router.replace("/balance/onboarding");
      return;
    }
    // Si la ruta no pertenece a la rama /balance → tablero principal
    if (!balancePaths.includes(pathname)) {
      router.replace("/balance");
      return;
    }
    setGateReady(true);
  }, [bootstrapped, pathname, showWizard, wizardCompleted, introSeen, countryCode]);

  // NO INTERNET — solo bloquea la rama de producción (showWizard:true)
  // La rama /balance funciona completamente offline (on-device)
  if (isConnected === false && showWizard === true) {
    return (
      <View style={styles.screen}>
        <Text style={styles.emoji}>🌐</Text>
        <Text style={styles.title}>Sin conexión</Text>
        <Text style={styles.subtitle}>Necesitas internet para usar esta app</Text>
        <Pressable
          style={styles.button}
          onPress={async () => {
            const s = await NetInfo.fetch();
            setIsConnected(s.isConnected);
          }}
        >
          <Text style={styles.buttonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  // LOADER
  if (!gateReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <WizardProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="offers" options={{ headerShown: false }} />
        <Stack.Screen name="analyzing" options={{ headerShown: false }} />
        <Stack.Screen name="verification" options={{ headerShown: false }} />
        <Stack.Screen name="daily-verify" options={{ headerShown: false }} />
        <Stack.Screen name="legal" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/country" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/intro" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step1" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step2" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step3" options={{ headerShown: false }} />
        <Stack.Screen name="waiting" options={{ headerShown: false }} />
        <Stack.Screen name="balance/index" options={{ headerShown: false }} />
        <Stack.Screen name="balance/onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="balance/gastos" options={{ headerShown: false }} />
        <Stack.Screen name="balance/pagos" options={{ headerShown: false }} />
        <Stack.Screen name="balance/historial" options={{ headerShown: false }} />
        <Stack.Screen name="balance/ajustes" options={{ headerShown: false }} />
      </Stack>
    </WizardProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1A1A1A", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#888", textAlign: "center", marginBottom: 28 },
  button: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});