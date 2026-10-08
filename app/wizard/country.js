import * as Clarity from '@microsoft/react-native-clarity';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { setCountry } from "../../utils/countryConfig";
import { loadOffers } from "../../utils/offersCache";
import { firestore } from "../../src/firebase";

const COUNTRIES = [
  { code: "MX", flag: "🇲🇽", name: "México", desc: "Préstamos hasta $20,000 MXN" },
  { code: "CL", flag: "🇨🇱", name: "Chile", desc: "Créditos hasta $3.000.000 CLP" },
  { code: "PE", flag: "🇵🇪", name: "Perú", desc: "Préstamos hasta S/ 10,000 PEN" },
];

export default function CountryScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_country"); } catch {} }, []);

  const handleContinue = async () => {
    if (!selected || loading) return;
    setLoading(true);
    await AsyncStorage.setItem("user_country", selected);
    setCountry(selected);
    // Recargar offers para el país seleccionado
    await loadOffers(firestore);
    setLoading(false);
    router.push("/wizard/step1");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>¿Desde qué país nos visitas?</Text>
          <Text style={styles.subtitle}>
            Selecciona tu país para mostrarte las mejores opciones disponibles
          </Text>

          <View style={styles.cards}>
            {COUNTRIES.map((c) => {
              const isSelected = selected === c.code;
              return (
                <Pressable
                  key={c.code}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => setSelected(c.code)}
                >
                  <Text style={styles.flag}>{c.flag}</Text>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardName, isSelected && styles.cardNameSelected]}>
                      {c.name}
                    </Text>
                    <Text style={styles.cardDesc}>{c.desc}</Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.button, (!selected || loading) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!selected || loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Cargando..." : "Continuar"}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, padding: 24, paddingBottom: 40, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "900", color: COLORS.primary, marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 32, lineHeight: 22 },
  cards: { gap: 14, marginBottom: 32 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  flag: { fontSize: 40, marginRight: 16 },
  cardText: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  cardNameSelected: { color: COLORS.primary },
  cardDesc: { fontSize: 13, color: COLORS.textMuted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E0",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioSelected: { borderColor: COLORS.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.accent },
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
  buttonDisabled: { backgroundColor: "#A0BDD8", shadowOpacity: 0, elevation: 0 },
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: "900" },
});