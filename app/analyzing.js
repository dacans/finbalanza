import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { COLORS } from "../constants/theme";
import { trackInterstitialRevenue } from "../src/adRevenue";
import { AD_UNITS } from "../src/admob";
import { logCompleteRegistration } from "../src/metaEvents";
import { logEvent } from "../src/analytics";
import { firestore } from "../src/firebase";
import { useWizard } from "../src/wizard/WizardProvider";
import { getCountry } from "../utils/countryConfig";

const STEPS = [
  { label: "Verificando identidad...", duration: 1800 },
  { label: "Confirmando zona de cobertura...", duration: 1800 },
  { label: "Consultando prestamistas disponibles...", duration: 2000 },
  { label: "Calculando tu oferta personalizada...", duration: 2400 },
];

// Interstitial
const interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
  requestNonPersonalizedAdsOnly: true,
});
trackInterstitialRevenue(interstitial, "analyzing");

export default function Analyzing() {
  const router = useRouter();
  const { data } = useWizard();

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const adLoadedRef = useRef(false);
  const savedRef = useRef(false);

  // Pre-cargar interstitial
  useEffect(() => { try { Clarity.setCustomTag("screen", "analyzing"); } catch {} }, []);

  useEffect(() => {
    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      adLoadedRef.current = true;
    });
    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      adLoadedRef.current = false;
    });
    interstitial.load();
    return () => { unsubLoaded(); unsubError(); };
  }, []);

  // Progress bar animada — 8 segundos total
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 8000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, []);

  // Cycling de steps
  useEffect(() => {
    let idx = 0;
    const total = STEPS.reduce((acc, s) => acc + s.duration, 0);
    let elapsed = 0;

    const timers = STEPS.map((step, i) => {
      const t = setTimeout(() => {
        setCurrentStepIdx(i);
        elapsed += step.duration;
      }, elapsed);
      elapsed += step.duration;
      return t;
    });

    // Al terminar — guardar lead + navegar
    const doneTimer = setTimeout(async () => {
      setDone(true);
      await saveLead();
      showAdAndNavigate();
    }, 8000);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(doneTimer);
    };
  }, []);

  const saveLead = async () => {
    if (savedRef.current) return;
    savedRef.current = true;

    try {
      const deviceId = await AsyncStorage.getItem("device_id");
      const pushToken = await AsyncStorage.getItem("push_token");
      const now = new Date();
      const contactTo = new Date(now.getTime() + 1 * 86400000); // D+1

      const leadRef = await addDoc(collection(firestore, "leads"), {
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        phone: data.phone,
        loanAmount: data.loan_amount,
        employmentStatus: data.employment_status,
        monthlyIncome: data.monthly_income,
        country: getCountry(),
        pushToken: pushToken ?? null,
        createdAt: serverTimestamp(),
        contactTo,
        wizardCompleted: true,
      });

      logCompleteRegistration(leadRef.id);

      await AsyncStorage.setItem("lead_id", leadRef.id);
      await AsyncStorage.setItem("lead_first_name", data.first_name);
      await AsyncStorage.setItem("lead_amount", String(data.loan_amount));

      await logEvent("loan_application_completed", {
        country: getCountry(),
        amount: data.loan_amount,
        has_push: Boolean(pushToken),
      });

      if (deviceId) {
        await setDoc(
          doc(firestore, "devices", deviceId),
          { hasLead: true },
          { merge: true }
        );
      }

      await AsyncStorage.multiSet([
        ["wizard_completed", "true"],
        ["wizard_completed_at", String(Date.now())],
        ["current_step", "1"],
      ]);
    } catch {}
  };

  const showAdAndNavigate = () => {
    if (adLoadedRef.current) {
      const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubClosed();
        unsubError();
        router.replace("/home");
      });
      const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        unsubClosed();
        unsubError();
        router.replace("/home");
      });
      try {
        interstitial.show();
      } catch {
        router.replace("/home");
      }
    } else {
      router.replace("/home");
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>

        {/* LOGO / TITLE */}
        <View style={styles.topWrap}>
          <Text style={styles.title}>Analizando tu perfil</Text>
          <Text style={styles.subtitle}>
            Por favor espera, esto solo toma unos segundos
          </Text>
        </View>

        {/* PROGRESS */}
        <View style={styles.progressWrap}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>

        {/* STEPS */}
        <View style={styles.stepsWrap}>
          {STEPS.map((step, i) => {
            const isActive = i === currentStepIdx;
            const isDone = i < currentStepIdx || done;
            return (
              <View key={i} style={styles.stepRow}>
                <View style={[
                  styles.stepDot,
                  isDone && styles.stepDotDone,
                  isActive && styles.stepDotActive,
                ]}>
                  {isDone && <Text style={styles.stepDotCheck}>✓</Text>}
                </View>
                <Text style={[
                  styles.stepText,
                  isDone && styles.stepTextDone,
                  isActive && styles.stepTextActive,
                ]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* DISCLAIMER */}
        <Text style={styles.disclaimer}>
          Revisando más de 20 prestamistas en tiempo real
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  container: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
  },
  topWrap: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.white,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 22,
  },
  progressWrap: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 40,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  stepsWrap: {
    gap: 20,
    marginBottom: 40,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: COLORS.accent,
  },
  stepDotDone: {
    backgroundColor: COLORS.success,
  },
  stepDotCheck: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  stepText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
    flex: 1,
  },
  stepTextActive: {
    color: COLORS.white,
    fontWeight: "800",
  },
  stepTextDone: {
    color: "rgba(255,255,255,0.65)",
  },
  disclaimer: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
});