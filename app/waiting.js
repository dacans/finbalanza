import * as Clarity from '@microsoft/react-native-clarity';
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { COLORS } from "../constants/theme";
import { useBannerRevenue } from "../src/adRevenue";
import { AD_UNITS } from "../src/admob";

export default function Waiting() {
  const router = useRouter();
  const bannerRevenue = useBannerRevenue("waiting");

  useEffect(() => { try { Clarity.setCustomTag("screen", "waiting"); } catch {} }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container}>

        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>

        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>EN REVISIÓN</Text>
        </View>

        <Text style={styles.title}>Tu asesor está trabajando en tu caso</Text>
        <Text style={styles.subtitle}>
          Estamos revisando tu expediente y verificando las mejores opciones
          disponibles para ti. Este proceso toma entre 18 y 24 horas.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado</Text>
            <Text style={styles.infoValue}>En revisión</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Próximo paso</Text>
            <Text style={styles.infoValue}>Verificación final</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Notificación</Text>
            <Text style={styles.infoValueAccent}>En 18 - 24 horas</Text>
          </View>
        </View>

        <View style={styles.bannerWrap}>
          <BannerAd
            onAdLoaded={bannerRevenue.onAdLoaded}
            onPaid={bannerRevenue.onPaid}
            unitId={AD_UNITS.banner}
            size={BannerAdSize.ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>

        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Entendido</Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 24 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: COLORS.accent, fontWeight: "700" },
  statusBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.accent,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.primary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 23,
    marginBottom: 28,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoDivider: { height: 1, backgroundColor: "#F0F4F8", marginVertical: 10 },
  infoLabel: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: "700" },
  infoValueAccent: { fontSize: 14, color: COLORS.accent, fontWeight: "800" },
  bannerWrap: { alignItems: "center", marginBottom: 24 },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: "900" },
});