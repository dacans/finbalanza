import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdEventType, InterstitialAd } from "react-native-google-mobile-ads";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { COLORS } from "../constants/theme";
import { trackInterstitialRevenue } from "../src/adRevenue";
import { AD_UNITS } from "../src/admob";
import { firestore } from "../src/firebase";
import { getCountry } from "../utils/countryConfig";

const interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
  requestNonPersonalizedAdsOnly: true,
});
trackInterstitialRevenue(interstitial, "verification");

const BANKS = {
  MX: ["BBVA", "Banamex", "Santander", "Banorte", "HSBC", "Otro"],
  CL: ["BancoEstado", "Santander", "BCI", "Falabella", "Scotiabank", "Otro"],
  PE: ["BCP", "Interbank", "BBVA", "Scotiabank", "BanBif", "Otro"],
};

function getSteps(country) {
  const steps = {
    MX: [
      {
        key: "id",
        title: "Verificación de identidad",
        label: "CURP",
        placeholder: "18 caracteres",
        hint: "Tu CURP tiene exactamente 18 caracteres",
        length: 18,
        keyboard: "default",
        autoCapitalize: "characters",
      },
      {
        key: "city",
        title: "Confirma tu ubicación",
        label: "Ciudad / Municipio",
        placeholder: "Ej: Ciudad de México",
        hint: "Ciudad o municipio donde resides",
        length: null,
        keyboard: "default",
        autoCapitalize: "words",
      },
    ],
    CL: [
      {
        key: "id",
        title: "Verificación de identidad",
        label: "RUT",
        placeholder: "9 caracteres",
        hint: "Tu RUT tiene exactamente 9 caracteres",
        length: 9,
        keyboard: "default",
        autoCapitalize: "none",
      },
      {
        key: "city",
        title: "Confirma tu ubicación",
        label: "Ciudad / Comuna",
        placeholder: "Ej: Santiago",
        hint: "Ciudad o comuna donde resides",
        length: null,
        keyboard: "default",
        autoCapitalize: "words",
      },
    ],
    PE: [
      {
        key: "id",
        title: "Verificación de identidad",
        label: "DNI",
        placeholder: "8 dígitos",
        hint: "Tu DNI tiene exactamente 8 dígitos",
        length: 8,
        keyboard: "number-pad",
        autoCapitalize: "none",
      },
      {
        key: "city",
        title: "Confirma tu ubicación",
        label: "Ciudad / Distrito",
        placeholder: "Ej: Lima",
        hint: "Ciudad o distrito donde resides",
        length: null,
        keyboard: "default",
        autoCapitalize: "words",
      },
    ],
  };
  return steps[country] ?? steps["MX"];
}

export default function Verification() {
  const router = useRouter();
  const country = getCountry();
  const steps = getSteps(country);
  const banks = BANKS[country] ?? BANKS["MX"];

  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const stepIdxRef = useRef(0);
  const [value, setValue] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const navigatingRef = useRef(false);
  const adLoadedRef = useRef(false);

  const isIdOrCityStep = stepIdxRef.current < steps.length;
  const isBankStep = stepIdxRef.current === steps.length;
  const currentStep = isIdOrCityStep ? steps[stepIdxRef.current] : null;
  const totalSteps = steps.length + 1;

  useEffect(() => {
    try { Clarity.setCustomTag("screen", "verification"); } catch {}
    ;(async () => {
      const name = await AsyncStorage.getItem("lead_first_name") || "";
      setFirstName(name);
    })();

    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      adLoadedRef.current = true;
    });
    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      adLoadedRef.current = false;
    });
    interstitial.load();
    return () => { unsubLoaded(); unsubError(); };
  }, []);

  const showAdThen = (callback) => {
    if (adLoadedRef.current) {
      const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubClosed();
        unsubErr();
        adLoadedRef.current = false;
        interstitial.load();
        callback();
      });
      const unsubErr = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        unsubClosed();
        unsubErr();
        callback();
      });
      try { interstitial.show(); } catch { callback(); }
    } else {
      callback();
    }
  };

  const onContinue = async () => {
    if (isBankStep) {
      if (!selectedBank) { setError("Selecciona tu banco"); return; }
    } else {
      if (!value.trim()) { setError("Este campo es requerido"); return; }
      if (currentStep.length && value.trim().length !== currentStep.length) {
        setError(`Debe tener exactamente ${currentStep.length} caracteres`);
        return;
      }
    }
    setError("");

    if (!isBankStep) {
      setValue("");
      stepIdxRef.current = stepIdxRef.current + 1;
      forceUpdate();
    } else {
      if (navigatingRef.current) return;
      navigatingRef.current = true;

      // Guardar TODO antes del ad
      try {
        const leadId = await AsyncStorage.getItem("lead_id");
        if (leadId) {
          await updateDoc(doc(firestore, "leads", leadId), {
            bank: selectedBank,
            verification_completed: true,
            verified_at: serverTimestamp(),
          });
        }
      } catch {}

      await AsyncStorage.setItem("verification_completed", "true");

      // Ahora sí mostrar ad y navegar
      showAdThen(() => {
        navigatingRef.current = false;
        router.replace("/offers");
      });
    }
  };

  const progressPct = ((stepIdxRef.current + 1) / totalSteps) * 100;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Verificación final</Text>
        <View style={{ width: 60 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.approvedBadge}>
            <Text style={styles.approvedBadgeText}>
              ✓ Préstamo aprobado — Verificación final
            </Text>
          </View>

          <Text style={styles.title}>
            {firstName ? `${firstName}, casi listo` : "Casi listo"}
          </Text>
          <Text style={styles.subtitle}>
            Para liberar tu dinero necesitamos verificar unos datos finales
          </Text>

          <View style={styles.progressWrap}>
            <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.stepLabel}>
            Paso {stepIdxRef.current + 1} de {totalSteps} —{" "}
            {isBankStep ? "Cuenta de depósito" : currentStep.title}
          </Text>

          {!isBankStep ? (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>{currentStep.label}</Text>
              <TextInput
                style={[styles.input, error && styles.inputError]}
                placeholder={currentStep.placeholder}
                placeholderTextColor={COLORS.textLight}
                value={value}
                onChangeText={(v) => { setValue(v); setError(""); }}
                keyboardType={currentStep.keyboard}
                autoCapitalize={currentStep.autoCapitalize}
                maxLength={currentStep.length ?? 100}
                returnKeyType="done"
              />
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : (
                <Text style={styles.hintText}>{currentStep.hint}</Text>
              )}
            </View>
          ) : (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>¿A qué banco deseas recibir tu préstamo?</Text>
              <View style={styles.banksGrid}>
                {banks.map((bank) => {
                  const isSelected = selectedBank === bank;
                  return (
                    <Pressable
                      key={bank}
                      style={[styles.bankCard, isSelected && styles.bankCardSelected]}
                      onPress={() => { setSelectedBank(bank); setError(""); }}
                    >
                      <Text style={[styles.bankText, isSelected && styles.bankTextSelected]}>
                        {bank}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          )}

          <Pressable style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>
              {isBankStep ? "Liberar mi dinero →" : "Continuar →"}
            </Text>
          </Pressable>

          <Text style={styles.disclaimer}>
            Tus datos están cifrados y protegidos con seguridad bancaria
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: 24, paddingBottom: 48 },
  approvedBadge: {
    backgroundColor: COLORS.successSoft,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#A8E6C3",
    alignSelf: "flex-start",
  },
  approvedBadgeText: { fontSize: 13, color: "#1A5E36", fontWeight: "700" },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 24, lineHeight: 22 },
  progressWrap: {
    height: 4,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: { height: 4, backgroundColor: COLORS.accent, borderRadius: 4 },
  stepLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600", marginBottom: 24 },
  fieldWrap: { marginBottom: 28, gap: 10 },
  label: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: "600" },
  hintText: { fontSize: 12, color: COLORS.textLight },
  banksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bankCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: COLORS.background,
  },
  bankCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  bankText: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted },
  bankTextSelected: { color: COLORS.primary },
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
});