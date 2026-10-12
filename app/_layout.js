import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { Stack, router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppEventsLogger } from "react-native-fbsdk-next";
import { firestore } from "../src/firebase";
import { registerForPushTokenAsync } from "../notifications/push";
import { WizardProvider } from "../src/wizard/WizardProvider";
import { loadOffers } from "../utils/offersCache";
import { loadRemoteConfig } from "../src/config/remoteConfig";
import { guardarPushToken, iniciarProduccion } from "../src/user/userStore";
import { getCountryCode, getCachedCountryCode } from "../src/health/db";
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { initializeMeta, syncMetaTrackingPermission } from "../src/metaEvents";

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

// Rutas del flujo de préstamos (showWizard: true)
const RUTAS_FORMULARIO = [
  "/wizard/intro",
  "/wizard/step1",
  "/wizard/step2",
  "/wizard/step3",
  "/wizard/step4",
  "/wizard/step5",
  "/analyzing",
];
// A dónde pueden mandar las notificaciones (data.screen)
const PANTALLAS_PUSH = { home: "/home", offers: "/offers" };

export default function RootLayout() {
  Clarity.initialize(CLARITY_ID, { logLevel: Clarity.LogLevel.None });

  const pathname = usePathname();
  const fbSentRef = useRef(false);

  const [bootstrapped, setBootstrapped] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const [isConnected, setIsConnected] = useState(null);
  const [wizardCompleted, setWizardCompleted] = useState(false);
  const [showWizard, setShowWizard] = useState(null);
  // Pantalla pedida por una notificación tocada (se abre cuando la app ya está lista)
  const [pantallaPush, setPantallaPush] = useState(null);
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

  // ATT (Meta / AdMob) — independiente del init de Firebase/AdMob (no altera su orden)
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "ios") {
          const { status } = await requestTrackingPermissionsAsync();
          void syncMetaTrackingPermission(status);
        }
      } catch {}
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || Platform.OS !== "ios") return;
      getTrackingPermissionsAsync()
        .then(({ status }) => syncMetaTrackingPermission(status))
        .catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  // PUSH TOKEN — se guarda en el teléfono; se sube a Firestore solo en el flujo de préstamos
  useEffect(() => {
    (async () => {
      try {
        const token = await registerForPushTokenAsync();
        if (token) await guardarPushToken(token);
      } catch {}
    })();
  }, []);

  // BOOTSTRAP
  useEffect(() => {
    (async () => {
      let sw = false;
      let wc = false;
      let cc = null;
      try {
        const cfg = await loadRemoteConfig(firestore);
        sw = cfg.showWizard;
        if (sw) {
          await loadOffers(firestore);
          // Documento de la instalación (para el push por estado) + push token
          iniciarProduccion();
        }
        wc = (await AsyncStorage.getItem("wizard_completed")) === "true";
        // Lee el país guardado en SQLite (solo para la rama /balance)
        try { cc = await getCountryCode(); } catch {}
      } catch {
        // fail abierto
      } finally {
        setWizardCompleted(wc);
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
        const wc = (await AsyncStorage.getItem("wizard_completed")) === "true";
        if (wc !== wizardCompleted) setWizardCompleted(wc);
        // Refresca el país después de que el usuario lo elija en /balance/onboarding
        const cc = await getCountryCode();
        if (cc !== countryCode) setCountryCode(cc);
      } catch {}
    })();
  }, [pathname, bootstrapped]);

  // PUSH LISTENER — data.url la abre externamente; data.screen (home/offers) navega dentro de la app
  useEffect(() => {
    const handleResponse = (response) => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (data?.url) {
          // https:// → Safari ; https://wa.me/... → WhatsApp
          Linking.openURL(data.url);
          return;
        }
        if (data?.screen && PANTALLAS_PUSH[data.screen]) setPantallaPush(data.screen);
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

  // Abre la pantalla de la notificación cuando ya pasó el gate (solo flujo de préstamos con solicitud enviada)
  useEffect(() => {
    if (!gateReady || !pantallaPush) return;
    const destino = PANTALLAS_PUSH[pantallaPush];
    setPantallaPush(null);
    if (showWizard && wizardCompleted && destino && pathname !== destino) router.push(destino);
  }, [gateReady, pantallaPush, showWizard, wizardCompleted]);

  // GATE
  useEffect(() => {
    if (!bootstrapped) return;
    if (showWizard === null) return;

    if (showWizard) {
      if (!wizardCompleted) {
        if (!RUTAS_FORMULARIO.includes(pathname)) {
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
      setGateReady(true);
      return;
    }

    // Rama /balance (versión educativa) — funciona offline (on-device). No se toca.
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
  }, [bootstrapped, pathname, showWizard, wizardCompleted, countryCode]);

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
        <Stack.Screen name="legal" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/intro" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step1" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step2" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step3" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step4" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/step5" options={{ headerShown: false }} />
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
