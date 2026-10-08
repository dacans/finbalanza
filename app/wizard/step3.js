import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { useWizard } from "../../src/wizard/WizardProvider";
import { getConfig } from "../../utils/countryConfig";

const EMPLOYMENT_OPTIONS = [
  { key: "empleado", label: "Empleado" },
  { key: "independiente", label: "Independiente" },
  { key: "sin_empleo", label: "Sin empleo" },
  { key: "pensionado", label: "Pensionado / Jubilado" },
];

export default function Step3() {
  const router = useRouter();
  const { update } = useWizard();
  const cfg = getConfig();

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_step3"); } catch {} }, []);

  const [employment, setEmployment] = useState("");
  const [income, setIncome] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!employment) e.employment = "Selecciona tu situación laboral";
    if (!income) e.income = "Selecciona tu rango de ingresos";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onContinue = () => {
    if (!validate()) return;
    update({ employment_status: employment, monthly_income: income });
    router.push("/analyzing");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={{ padding: 24, paddingBottom: 0 }} onPress={() => router.back()}>
            <Text style={{ fontSize: 15, color: COLORS.accent, fontWeight: "700" }}>← Atrás</Text>
          </Pressable>
          <Text style={styles.stepLabel}>Paso 3 de 3</Text>
          <View style={styles.progressWrap}>
            <View style={[styles.progressBar, { width: "100%" }]} />
          </View>
          <Text style={styles.title}>Situación laboral</Text>
          <Text style={styles.subtitle}>
            Esta información nos ayuda a encontrar las mejores opciones para ti
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>¿Cuál es tu situación laboral?</Text>
            <View style={styles.optionsGrid}>
              {EMPLOYMENT_OPTIONS.map((opt) => {
                const isSelected = employment === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => {
                      setEmployment(opt.key);
                      setErrors((p) => ({ ...p, employment: null }));
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.employment && <Text style={styles.errorText}>{errors.employment}</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>¿Cuáles son tus ingresos mensuales?</Text>
            <View style={styles.optionsGrid}>
              {cfg.incomeOptions.map((opt) => {
                const isSelected = income === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => {
                      setIncome(opt);
                      setErrors((p) => ({ ...p, income: null }));
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.income && <Text style={styles.errorText}>{errors.income}</Text>}
          </View>

          <Pressable style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>Analizar mi perfil →</Text>
          </Pressable>

          <Text style={styles.disclaimer}>
            Nadie queda excluido. Tenemos opciones para todos los perfiles.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: 24, paddingBottom: 48 },
  stepLabel: { fontSize: 13, color: COLORS.accent, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  progressWrap: { height: 4, backgroundColor: COLORS.accentSoft, borderRadius: 4, overflow: "hidden", marginBottom: 24 },
  progressBar: { height: 4, backgroundColor: COLORS.accent, borderRadius: 4 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 28 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 14 },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionCard: {
    width: "48%",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  optionText: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted, textAlign: "center" },
  optionTextSelected: { color: COLORS.primary },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: "600", marginTop: 6 },
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
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: "900" },
  disclaimer: { fontSize: 12, color: COLORS.textLight, textAlign: "center", lineHeight: 18 },
});