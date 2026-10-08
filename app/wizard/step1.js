import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { useWizard } from "../../src/wizard/WizardProvider";
import { getConfig } from "../../utils/countryConfig";

function getApprovalPct(amount) {
  return Math.max(75, Math.round(99 - amount / 2000));
}

function getWeeklyPayment(amount) {
  return Math.round((amount * 1.15) / 24);
}

export default function Step1() {
  const router = useRouter();
  const { update } = useWizard();
  const cfg = getConfig();
  const AMOUNTS = cfg.amounts;
  const [selected, setSelected] = useState(AMOUNTS[2]);

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_step1"); } catch {} }, []);

  const approvalPct = getApprovalPct(selected);
  const weeklyPayment = getWeeklyPayment(selected);

  const onContinue = () => {
    update({ loan_amount: selected });
    router.push("/wizard/step2");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
           <Pressable style={{ padding: 24, paddingBottom: 0 }} onPress={() => router.back()}>
            <Text style={{ fontSize: 15, color: COLORS.accent, fontWeight: "700" }}>← Atrás</Text>
          </Pressable>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER */}
          <Text style={styles.stepLabel}>Paso 1 de 3</Text>
          <View style={styles.progressWrap}>
            <View style={[styles.progressBar, { width: "33%" }]} />
          </View>
          <Text style={styles.title}>¿Cuánto dinero necesitas?</Text>
          <Text style={styles.subtitle}>
            Selecciona el monto que deseas solicitar
          </Text>

          {/* GRID DE MONTOS */}
          <View style={styles.grid}>
            {AMOUNTS.map((amount) => {
              const isSelected = selected === amount;
              return (
                <Pressable
                  key={amount}
                  style={[styles.amountCard, isSelected && styles.amountCardSelected]}
                  onPress={() => setSelected(amount)}
                >
                  <Text style={[styles.amountText, isSelected && styles.amountTextSelected]}>
                    {cfg.format(amount)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* HOOK PSICOLÓGICO */}
          <View style={styles.approvalBox}>
            <View style={styles.approvalRow}>
              <Text style={styles.approvalCheck}>✓</Text>
              <Text style={styles.approvalCheckText}>Monto disponible en tu zona</Text>
            </View>
            <View style={styles.approvalRow}>
              <Text style={styles.approvalCheck}>✓</Text>
              <Text style={styles.approvalCheckText}>
                Cuota estimada: {cfg.symbol}{weeklyPayment.toLocaleString(cfg.locale)}/semana
              </Text>
            </View>
            <View style={styles.approvalDivider} />
            <View style={styles.approvalPctRow}>
              <Text style={styles.approvalPctLabel}>Aprobación preliminar</Text>
              <Text style={styles.approvalPctValue}>{approvalPct}%</Text>
            </View>
          </View>

          <Pressable style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>Continuar →</Text>
          </Pressable>

          <Text style={styles.disclaimer}>
            Sin costo. Sin compromiso. Resultado en minutos.
          </Text>
       
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  stepLabel: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  progressWrap: {
    height: 4,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  amountCard: {
    width: "48%",
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: COLORS.background,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  amountCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  amountTextSelected: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "900",
  },
  approvalBox: {
    backgroundColor: COLORS.successSoft,
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#A8E6C3",
  },
  approvalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  approvalCheck: {
    fontSize: 16,
    color: COLORS.success,
    fontWeight: "900",
    marginRight: 8,
  },
  approvalCheckText: {
    fontSize: 14,
    color: "#1A5E36",
    fontWeight: "600",
    flex: 1,
  },
  approvalDivider: {
    height: 1,
    backgroundColor: "#A8E6C3",
    marginVertical: 10,
  },
  approvalPctRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  approvalPctLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
  },
  approvalPctValue: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.success,
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
    color: COLORS.textLight,
    textAlign: "center",
  },
});