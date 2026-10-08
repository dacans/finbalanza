import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { COLORS } from "../../constants/theme";
import { useWizard } from "../../src/wizard/WizardProvider";
import { getConfig } from "../../utils/countryConfig";

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function Step2() {
  const router = useRouter();
  const { data, update } = useWizard();
  const cfg = getConfig();

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_step2"); } catch {} }, []);

  const [firstName, setFirstName] = useState(data.first_name || "");
  const [lastName, setLastName] = useState(data.last_name || "");
  const [email, setEmail] = useState(data.email || "");
  const [phone, setPhone] = useState(data.phone || "");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (firstName.trim().length < 2) e.firstName = "Ingresa tu nombre";
    if (lastName.trim().length < 2) e.lastName = "Ingresa tu apellido";
    if (!validateEmail(email)) e.email = "Correo electrónico inválido";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < cfg.phoneLength) {
      e.phone = `Ingresa ${cfg.phoneLength} dígitos`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onContinue = () => {
    if (!validate()) return;
    update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: `${cfg.phonePrefix}${phone.trim()}`,
    });
    router.push("/wizard/step3");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* BACK */}
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>← Atrás</Text>
            </Pressable>

            <Text style={styles.stepLabel}>Paso 2 de 3</Text>
            <View style={styles.progressWrap}>
              <View style={[styles.progressBar, { width: "66%" }]} />
            </View>
            <Text style={styles.title}>Tus datos de contacto</Text>
            <Text style={styles.subtitle}>
              Necesitamos estos datos para procesar tu solicitud
            </Text>

            <View style={styles.form}>
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  placeholder="Tu nombre"
                  placeholderTextColor={COLORS.textLight}
                  value={firstName}
                  onChangeText={(v) => { setFirstName(v); setErrors((p) => ({ ...p, firstName: null })); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Apellido</Text>
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  placeholder="Tu apellido"
                  placeholderTextColor={COLORS.textLight}
                  value={lastName}
                  onChangeText={(v) => { setLastName(v); setErrors((p) => ({ ...p, lastName: null })); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={COLORS.textLight}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: null })); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Teléfono</Text>
                <View style={[styles.phoneRow, errors.phone && styles.inputError]}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.prefixText}>{cfg.phonePrefix}</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder={cfg.phonePlaceholder}
                    placeholderTextColor={COLORS.textLight}
                    value={phone}
                    onChangeText={(v) => {
                      // Solo dígitos
                      setPhone(v.replace(/\D/g, ""));
                      setErrors((p) => ({ ...p, phone: null }));
                    }}
                    keyboardType="phone-pad"
                    maxLength={cfg.phoneLength}
                    returnKeyType="done"
                  />
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>
            </View>

            <Pressable style={styles.button} onPress={onContinue}>
              <Text style={styles.buttonText}>Continuar →</Text>
            </Pressable>

            <Text style={styles.disclaimer}>
              Tus datos están protegidos y no serán compartidos sin tu consentimiento.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: 24, paddingBottom: 48 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 15, color: COLORS.accent, fontWeight: "700" },
  stepLabel: { fontSize: 13, color: COLORS.accent, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  progressWrap: { height: 4, backgroundColor: COLORS.accentSoft, borderRadius: 4, overflow: "hidden", marginBottom: 24 },
  progressBar: { height: 4, backgroundColor: COLORS.accent, borderRadius: 4 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 24 },
  form: { gap: 16, marginBottom: 28 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: COLORS.text, letterSpacing: 0.3 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: { borderColor: COLORS.error },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  prefixBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.accentSoft,
    borderRightWidth: 1.5,
    borderRightColor: "#E2E8F0",
  },
  prefixText: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: "600" },
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