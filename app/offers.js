import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { COLORS } from "../constants/theme";
import { useBannerRevenue } from "../src/adRevenue";
import { AD_UNITS } from "../src/admob";
import { firestore } from "../src/firebase";
import { getOffers } from "../utils/offersCache";

export default function Offers() {
  const router = useRouter();
  const bannerRevenue = useBannerRevenue("offers");
  const [offers, setOffers] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { Clarity.setCustomTag("screen", "offers"); } catch {}
    const loaded = getOffers();
    setOffers(loaded);
    setReady(true);
  }, []);

  // Construye la URL final: fuerza sub1=FinBalanza y sub2=<leadId>, conservando
  // el resto de parámetros de offer.url. Maneja "?" vs "&" y el fragmento (#...).
  const buildOfferUrl = (rawUrl, leadId) => {
    let base = rawUrl || "";

    // Separa el fragmento (#...) para no alterarlo
    const hashIdx = base.indexOf("#");
    const hash = hashIdx >= 0 ? base.slice(hashIdx) : "";
    if (hashIdx >= 0) base = base.slice(0, hashIdx);

    // Separa path y query
    const qIdx = base.indexOf("?");
    const path = qIdx >= 0 ? base.slice(0, qIdx) : base;
    const query = qIdx >= 0 ? base.slice(qIdx + 1) : "";

    // Recorre params existentes; reemplaza sub1/sub2 y conserva los demás (ej. l=...)
    const params = query ? query.split("&").filter(Boolean) : [];
    const out = [];
    let hasSub1 = false;
    let hasSub2 = false;
    for (const p of params) {
      const key = p.split("=")[0];
      if (key === "sub1") {
        out.push("sub1=FinBalanza");          // fuerza sub1 fijo
        hasSub1 = true;
      } else if (key === "sub2") {
        if (leadId) out.push("sub2=" + encodeURIComponent(leadId));
        hasSub2 = true;                   // si no hay leadId, se omite (no rompe)
      } else {
        out.push(p);                      // conserva el resto tal cual
      }
    }
    if (!hasSub1) out.push("sub1=FinBalanza");
    if (!hasSub2 && leadId) out.push("sub2=" + encodeURIComponent(leadId));

    const qs = out.join("&");
    return path + (qs ? "?" + qs : "") + hash;
  };

  const openOffer = async (offer) => {
    // Lee el lead_id primero (lo necesitamos para el tracking y para sub2)
    let leadId = null;
    try {
      leadId = await AsyncStorage.getItem("lead_id");
      if (leadId) {
        // Mantiene el tracking de clic en Firestore (sin await: fire-and-forget)
        updateDoc(doc(firestore, "leads", leadId), {
          clicked_offer: true,
          clicked_at: serverTimestamp(),
          offer_clicks: increment(1),
          last_offer_clicked: offer.title,
        });
      }
    } catch {}

    // Abre la oferta en Safari con sub1=FinBalanza y sub2=<leadId>
    try {
      const urlFinal = buildOfferUrl(offer.url, leadId);
      await Linking.openURL(urlFinal);
    } catch {}
  };

  if (!ready) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>

      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Mis opciones</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerWrap}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>OFERTAS DISPONIBLES</Text>
          </View>
          <Text style={styles.title}>Opciones para tu perfil</Text>
          <Text style={styles.subtitle}>
            Basado en tu solicitud encontramos estas opciones.
            Selecciona la que mejor se adapte a ti.
          </Text>
        </View>

        {offers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              No hay opciones disponibles en tu zona aún
            </Text>
            <Text style={styles.emptySubtitle}>
              Te notificaremos cuando tengamos opciones para ti.
            </Text>
            <Pressable style={styles.button} onPress={() => router.replace("/home")}>
              <Text style={styles.buttonText}>Volver al inicio</Text>
            </Pressable>
          </View>
        ) : (
          offers.map((offer, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{offer.title}</Text>
                  <Text style={styles.cardSubtitle}>{offer.subtitle}</Text>
                </View>
                <View style={styles.approvedDot} />
              </View>
              <View style={styles.cardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Monto</Text>
                  <Text style={styles.statValue}>{offer.amount}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Tiempo</Text>
                  <Text style={styles.statValue}>{offer.time}</Text>
                </View>
              </View>
              <Pressable style={styles.offerBtn} onPress={() => openOffer(offer)}>
                <Text style={styles.offerBtnText}>Solicitar ahora →</Text>
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.bannerWrap}>
          <BannerAd
            onAdLoaded={bannerRevenue.onAdLoaded}
            onPaid={bannerRevenue.onPaid}
            unitId={AD_UNITS.banner}
            size={BannerAdSize.ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Los resultados son orientativos. No garantizamos aprobación.
            Calcu Créditos no otorga préstamos directamente.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backText: { fontSize: 15, color: COLORS.accent, fontWeight: "700", width: 60 },
  headerTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary, flex: 1, textAlign: "center" },
  content: { padding: 24, paddingBottom: 48 },
  headerWrap: { marginBottom: 24 },
  badge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: COLORS.accent, letterSpacing: 1.5 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22 },
  emptyWrap: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.primary, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: "900", color: COLORS.primary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: COLORS.textMuted },
  approvedDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success, marginTop: 4 },
  cardStats: { flexDirection: "row", backgroundColor: COLORS.background, borderRadius: 12, padding: 14, marginBottom: 16 },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "#E2E8F0" },
  statLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600", marginBottom: 4 },
  statValue: { fontSize: 14, color: COLORS.primary, fontWeight: "800" },
  offerBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  offerBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  bannerWrap: { alignItems: "center", marginVertical: 20 },
  button: { backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: 14, alignItems: "center", width: "100%" },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: "900" },
  disclaimer: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  disclaimerText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, textAlign: "center" },
});