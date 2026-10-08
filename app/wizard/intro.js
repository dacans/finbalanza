import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";

export default function WizardIntro() {
  const router = useRouter();

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_intro"); } catch {} }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* HERO */}
          <View style={styles.heroWrap}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PRÉSTAMOS PERSONALES</Text>
            </View>
            <Text style={styles.heroTitle}>
              Obtén el dinero que necesitas hoy
            </Text>
            <Text style={styles.heroSub}>
              Proceso 100% digital. Sin trámites presenciales.
              Respuesta inmediata.
            </Text>
          </View>

          {/* FEATURES */}
          <View style={styles.featuresWrap}>
            {[
              { label: "Tiempo de respuesta", value: "2 minutos" },
              { label: "Costo del proceso", value: "Gratis" },
              { label: "Tasa de interés", value: "Tasa variable" },,
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureValue}>{f.value}</Text>
              </View>
            ))}
          </View>

          {/* SOCIAL PROOF */}
          <View style={styles.proofBox}>
            <Text style={styles.proofText}>
              Más de <Text style={styles.proofBold}>3,200 personas</Text> revisaron
              sus opciones esta semana
            </Text>
          </View>

          <Pressable
            style={styles.button}
            onPress={() => router.replace("/wizard/country")}
          >
            <Text style={styles.buttonText}>Solicitar préstamo</Text>
          </Pressable>

          <Text style={styles.disclaimer}>
            Sin compromiso. Gratis. Solo toma 2 minutos.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },
  heroWrap: {
    marginBottom: 32,
  },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.white,
    marginBottom: 12,
    lineHeight: 40,
  },
  heroSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 24,
  },
  featuresWrap: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  featureLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
  },
  featureValue: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: "800",
  },
  proofBox: {
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  proofText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
  },
  proofBold: {
    color: COLORS.white,
    fontWeight: "800",
  },
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
    marginBottom: 14,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "900",
  },
  disclaimer: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
});