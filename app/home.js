import * as Clarity from '@microsoft/react-native-clarity';
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdEventType, BannerAd, BannerAdSize, InterstitialAd } from "react-native-google-mobile-ads";
import { COLORS } from "../constants/theme";
import { trackInterstitialRevenue, useBannerRevenue } from "../src/adRevenue";
import { AD_UNITS } from "../src/admob";
import { getDatosVisibles, getVentana } from "../src/user/userStore";

const interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
  requestNonPersonalizedAdsOnly: true,
});
trackInterstitialRevenue(interstitial, "home");

// ESTADOS (igual que Android):
//   1 — en análisis (todavía no pasan las horas de desbloqueo que se configuran en el panel)
//   2 — desbloqueada → "Ver mis ofertas" (con intersticial, como el botón principal de Android)
export default function Home() {
  const router = useRouter();
  const bannerRevenue = useBannerRevenue("home");
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [ventana, setVentana] = useState(null);
  const [ready, setReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const navigatingRef = useRef(false);

  const loadState = async () => {
    const d = await getDatosVisibles();
    setNombre(d.nombre);
    setMonto(d.monto);
    setVentana(await getVentana());
  };

  useEffect(() => {
    (async () => {
      try { Clarity.setCustomTag("screen", "home"); } catch {}
      await loadState();
      setReady(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
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
    // Sin anuncio cargado → directo (nunca dejar al usuario atorado)
    if (!interstitial.loaded) {
      router.push(destination);
      interstitial.load();
      return;
    }
    navigatingRef.current = true;

    const afterAd = () => {
      unsubClosed();
      unsubError();
      navigatingRef.current = false;
      router.push(destination);
      interstitial.load();
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
      unsubClosed();
      unsubError();
      navigatingRef.current = false;
      router.push(destination);
    }
  };

  if (!ready || !ventana) return null;

  const listo = ventana.desbloqueada;
  const horasTxt = Math.max(1, Math.ceil(ventana.restantesH));

  const badge = listo
    ? { bg: COLORS.successSoft, border: "#A8E6C3", text: COLORS.success, label: "OPCIONES LISTAS" }
    : { bg: COLORS.accentSoft, border: COLORS.accentBorder, text: COLORS.accent, label: "EN ANÁLISIS" };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* HERO */}
        <Animated.View style={[styles.heroWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.preApprovedLabel}>{listo ? "SOLICITUD PROCESADA" : "SOLICITUD RECIBIDA"}</Text>
          <Text style={styles.greeting}>
            {listo
              ? (nombre ? `¡${nombre}, tus opciones están listas!` : "¡Tus opciones están listas!")
              : (nombre ? `¡Gracias, ${nombre}!` : "¡Gracias!")}
          </Text>
          {monto ? <Text style={styles.approvedAmount}>{monto}</Text> : null}
          {monto ? <Text style={styles.amountNote}>Monto solicitado</Text> : null}
        </Animated.View>

        {/* BADGE */}
        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>

        {/* STATUS CARD */}
        <Animated.View style={[styles.statusCard, { opacity: fadeAnim }]}>
          {listo ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado</Text>
                <Text style={styles.infoValueGreen}>Solicitud procesada</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Siguiente paso</Text>
                <Text style={styles.infoValueAccent}>Ver tus ofertas</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado</Text>
                <Text style={styles.infoValue}>Analizando tu solicitud</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Asesor asignado</Text>
                <Text style={styles.infoValue}>Revisando tu perfil</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tiempo estimado</Text>
                <Text style={styles.infoValueAccent}>~{horasTxt} h</Text>
              </View>
            </>
          )}
        </Animated.View>

        {!listo ? (
          <View style={styles.waitingBox}>
            <Text style={styles.waitingTitle}>Te avisamos por notificación</Text>
            <Text style={styles.waitingText}>
              En cuanto tus opciones estén listas te llegará una notificación. Abre la app todos los días para no perderte tu resultado.
            </Text>
          </View>
        ) : null}

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
        {listo ? (
          <Pressable style={styles.buttonGreen} onPress={() => goWithAd("/offers")}>
            <Text style={styles.buttonText}>Ver mis ofertas →</Text>
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
  approvedAmount: { fontSize: 30, fontWeight: "900", color: COLORS.primary, marginBottom: 4, textAlign: "center" },
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
