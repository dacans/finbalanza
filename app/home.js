import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdEventType, BannerAd, BannerAdSize, InterstitialAd } from "react-native-google-mobile-ads";
import { COLORS } from "../constants/theme";
import { trackInterstitialRevenue, useBannerRevenue } from "../src/adRevenue";
import { AD_UNITS } from "../src/admob";
import { getConfig, loadCountry } from "../utils/countryConfig";

const interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
  requestNonPersonalizedAdsOnly: true,
});
trackInterstitialRevenue(interstitial, "home");

export default function Home() {
  const router = useRouter();
  const bannerRevenue = useBannerRevenue("home");
  const [firstName, setFirstName] = useState("");
  const [amount, setAmount] = useState(0);
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [hoursLeft, setHoursLeft] = useState(null);
  const [verificationCompleted, setVerificationCompleted] = useState(false);
  const [ready, setReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const navigatingRef = useRef(false);
  const [cfg, setCfg] = useState(null);

  const loadState = async () => {
    await loadCountry();
    const name = await AsyncStorage.getItem("lead_first_name") || "";
    const amt = parseInt(await AsyncStorage.getItem("lead_amount") || "0", 10);
    const verified = await AsyncStorage.getItem("verification_completed") === "true";
    const approved = Math.round(amt * 0.83);

    setFirstName(name);
    setAmount(amt);
    setApprovedAmount(approved);
    setVerificationCompleted(verified);
    setCfg(getConfig());

    const completedAt = await AsyncStorage.getItem("wizard_completed_at");
    if (completedAt) {
      const hoursSince = completedAt ? (Date.now() - parseInt(completedAt, 10)) / 3600000 : 0;
      setHoursLeft(Math.max(0, 24 - hoursSince));
    } else {
      setHoursLeft(0);
    }
  };

  useEffect(() => {
    (async () => {
      try { Clarity.setCustomTag("screen", "home"); } catch {}
      await loadState();
      setReady(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
      interstitial.load();
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadState();
    }, [])
  );

  const goWithAd = (destination) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    const afterAd = () => {
      unsubClosed();
      unsubError();
      navigatingRef.current = false;
      router.push(destination);
    };

    const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, afterAd);
    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      unsubClosed();
      unsubError();
      navigatingRef.current = false;
      router.push(destination);
    });

    try {
      interstitial.show();
    } catch {
      navigatingRef.current = false;
      router.push(destination);
    }
  };

  if (!ready) return null;

  const passed24h = hoursLeft !== null && hoursLeft <= 0;

  // ESTADOS
  // 1 — en revisión (< 24h)
  // 2 — listo para verificar (>= 24h, no verificado)
  // 3 — verificación completada, no ha visto offers

  const badge = verificationCompleted
    ? { bg: COLORS.successSoft, border: "#A8E6C3", text: COLORS.success, label: "COMPLETADO" }
    : passed24h
    ? { bg: COLORS.successSoft, border: "#A8E6C3", text: COLORS.success, label: "LISTO PARA VERIFICAR" }
    : { bg: COLORS.accentSoft, border: COLORS.accentBorder, text: COLORS.accent, label: "EN REVISIÓN" };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* HERO */}
        <Animated.View style={[styles.heroWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.preApprovedLabel}>PRE-APROBADO</Text>
          <Text style={styles.greeting}>
            {firstName ? `¡Felicidades, ${firstName}!` : "¡Felicidades!"}
          </Text>
          <Text style={styles.approvedAmount}>{cfg.format(approvedAmount)}</Text>
          <Text style={styles.amountNote}>(83% de tu solicitud de {cfg.format(amount)})</Text>
        </Animated.View>

        {/* BADGE */}
        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>

        {/* STATUS CARD */}
        <Animated.View style={[styles.statusCard, { opacity: fadeAnim }]}>
          {verificationCompleted ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado</Text>
                <Text style={styles.infoValueGreen}>Verificación completada</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Siguiente paso</Text>
                <Text style={styles.infoValue}>Ver tus ofertas</Text>
              </View>
            </>
          ) : passed24h ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado</Text>
                <Text style={styles.infoValueGreen}>Aprobado</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Asesor</Text>
                <Text style={styles.infoValue}>Verificación pendiente</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Acción requerida</Text>
                <Text style={styles.infoValueAccent}>Completa ahora</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado</Text>
                <Text style={styles.infoValue}>Expediente en revisión</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Asesor asignado</Text>
                <Text style={styles.infoValue}>Revisando tu perfil</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tiempo estimado</Text>
                <Text style={styles.infoValueAccent}>18 - 24 horas</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* BANNER */}
        <View style={styles.bannerWrap}>
          <BannerAd
            onAdLoaded={bannerRevenue.onAdLoaded}
            onPaid={bannerRevenue.onPaid}
            unitId={AD_UNITS.banner}
            size={BannerAdSize.ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>

        {/* CTA */}
        {verificationCompleted ? (
          <Pressable style={styles.button} onPress={() => router.push("/offers")}>
            <Text style={styles.buttonText}>Ver mis ofertas →</Text>
          </Pressable>
        ) : passed24h ? (
          <Pressable style={styles.buttonGreen} onPress={() => goWithAd("/verification")}>
            <Text style={styles.buttonText}>Completar verificación →</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => goWithAd("/waiting")}>
            <Text style={styles.buttonText}>Ver mi solicitud →</Text>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48 },
  heroWrap: { alignItems: "center", marginBottom: 20 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  checkIcon: { fontSize: 40, color: COLORS.white, fontWeight: "900" },
  preApprovedLabel: { fontSize: 12, fontWeight: "800", color: COLORS.accent, letterSpacing: 2, marginBottom: 8 },
  greeting: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginBottom: 8, textAlign: "center" },
  approvedAmount: { fontSize: 40, fontWeight: "900", color: COLORS.primary, marginBottom: 4 },
  amountNote: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
  badge: {
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
    alignSelf: "flex-start", marginBottom: 16, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  statusCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  infoDivider: { height: 1, backgroundColor: "#F0F4F8", marginVertical: 10 },
  infoLabel: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: "700" },
  infoValueAccent: { fontSize: 14, color: COLORS.accent, fontWeight: "800" },
  infoValueGreen: { fontSize: 14, color: COLORS.success, fontWeight: "800" },
  bannerWrap: { alignItems: "center", marginBottom: 20 },
  button: {
    backgroundColor: COLORS.accent, paddingVertical: 18, borderRadius: 16,
    alignItems: "center",
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 14,
  },
  buttonGreen: {
    backgroundColor: COLORS.success, paddingVertical: 18, borderRadius: 16,
    alignItems: "center",
    shadowColor: COLORS.success, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 14,
  },
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: "900" },
  waitingBox: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: COLORS.accentBorder,
    marginBottom: 14,
  },
  waitingTitle: { fontSize: 15, fontWeight: "800", color: COLORS.primary, marginBottom: 8 },
  waitingText: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22 },
});