// Piezas comunes de los 5 pasos del formulario (mismo estilo que la versión anterior).
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";

export const TOTAL_PASOS = 5;

export function PasoLayout({ paso, titulo, subtitulo, onBack, children, boton = "Continuar →", onContinuar, nota }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {onBack ? (
            <Pressable style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backText}>← Atrás</Text>
            </Pressable>
          ) : null}

          <Text style={styles.stepLabel}>Paso {paso} de {TOTAL_PASOS}</Text>
          <View style={styles.progressWrap}>
            <View style={[styles.progressBar, { width: `${Math.round((paso / TOTAL_PASOS) * 100)}%` }]} />
          </View>
          <Text style={styles.title}>{titulo}</Text>
          {subtitulo ? <Text style={styles.subtitle}>{subtitulo}</Text> : null}

          {children}

          <Pressable style={styles.button} onPress={onContinuar}>
            <Text style={styles.buttonText}>{boton}</Text>
          </Pressable>
          {nota ? <Text style={styles.disclaimer}>{nota}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Una pregunta con opciones. columnas = 1 (textos largos) o 2 (textos cortos). */
export function GrupoOpciones({ titulo, opciones, seleccion, onSelect, error, columnas = 1 }) {
  return (
    <View style={styles.section}>
      {titulo ? <Text style={styles.sectionLabel}>{titulo}</Text> : null}
      <View style={styles.optionsGrid}>
        {opciones.map((opt) => {
          const sel = seleccion === opt;
          return (
            <Pressable
              key={opt}
              style={[styles.optionCard, columnas === 2 ? styles.optionHalf : styles.optionFull, sel && styles.optionCardSelected]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.optionText, columnas === 1 && styles.optionTextLeft, sel && styles.optionTextSelected]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export const wizardStyles = StyleSheet.create({
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: COLORS.text, letterSpacing: 0.3, marginBottom: 8 },
  input: {
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: "600", marginTop: 6 },
  helper: { fontSize: 12, color: COLORS.textLight, marginTop: 6 },
  secureBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  secureText: { fontSize: 13, color: "#1A5E36", fontWeight: "600", marginLeft: 8, flex: 1 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: 24, paddingBottom: 48 },
  backBtn: { paddingBottom: 16 },
  backText: { fontSize: 15, color: COLORS.accent, fontWeight: "700" },
  stepLabel: { fontSize: 13, color: COLORS.accent, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  progressWrap: { height: 4, backgroundColor: COLORS.accentSoft, borderRadius: 4, overflow: "hidden", marginBottom: 24 },
  progressBar: { height: 4, backgroundColor: COLORS.accent, borderRadius: 4 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 24, lineHeight: 22 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 14 },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  optionCard: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: COLORS.background,
    justifyContent: "center",
    marginBottom: 10,
  },
  optionFull: { width: "100%" },
  optionHalf: { width: "48.5%", alignItems: "center" },
  optionCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  optionText: { fontSize: 15, fontWeight: "700", color: COLORS.textMuted, textAlign: "center" },
  optionTextLeft: { textAlign: "left" },
  optionTextSelected: { color: COLORS.primary },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: "600", marginTop: 2 },
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
    marginTop: 8,
    marginBottom: 14,
  },
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: "900" },
  disclaimer: { fontSize: 12, color: COLORS.textLight, textAlign: "center", lineHeight: 18 },
});
