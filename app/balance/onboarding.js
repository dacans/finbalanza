// ─── Onboarding: slides educativos + selección de país ──────────────────────
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COUNTRIES } from '../../src/health/country';
import { setCountryCode } from '../../src/health/db';
import { DISCLAIMER } from '../../src/health/legal';
import { colors, font, radius, spacing } from '../../src/health/theme';

const PAISES = Object.values(COUNTRIES);

// Slides educativos previos a elegir país
const SLIDES = [
  {
    icon: 'speedometer-outline',
    title: 'Conoce tu capacidad de endeudamiento',
    body: 'Calcula qué parte de tu ingreso se va en deudas y entiende tu margen real.',
  },
  {
    icon: 'receipt-outline',
    title: 'Registra gastos y pagos',
    body: 'Lleva tus gastos hormiga y programa recordatorios de pago, todo en tu dispositivo.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Mejora tu índice de salud financiera',
    body: 'Un puntaje educativo que sube cuando ordenas tus deudas, gastos y pagos a tiempo.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);        // 0..N-1 = slides, N = país
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const enSlides = step < SLIDES.length;

  async function handleSelect(code) {
    setSelected(code);
    setLoading(true);
    // Persiste en SQLite Y llena _countryCache de forma síncrona antes de navegar
    await setCountryCode(code);
    router.replace('/balance');
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      {enSlides ? (
        // ── Slide educativo ──────────────────────────────────────────
        <View style={styles.slideWrap}>
          <View style={styles.slideIconWrap}>
            <Ionicons name={SLIDES[step].icon} size={48} color={colors.brand} />
          </View>
          <Text style={styles.slideTitle}>{SLIDES[step].title}</Text>
          <Text style={styles.slideBody}>{SLIDES[step].body}</Text>

          {/* Puntos de progreso */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          <Pressable style={styles.nextBtn} onPress={() => setStep(step + 1)}>
            <Text style={styles.nextBtnText}>
              {step === SLIDES.length - 1 ? 'Comenzar' : 'Siguiente'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>

          {step < SLIDES.length - 1 && (
            <Pressable onPress={() => setStep(SLIDES.length)} hitSlop={8}>
              <Text style={styles.skip}>Saltar</Text>
            </Pressable>
          )}
        </View>
      ) : (
        // ── Selección de país ────────────────────────────────────────
        <View style={styles.countryWrap}>
          <View style={styles.hero}>
            <Text style={styles.logo}>FinBalanza</Text>
            <Text style={styles.headline}>¿En qué país vives?</Text>
            <Text style={styles.body}>
              Adaptamos moneda, terminología y el buró local a tu país.
            </Text>
          </View>

          <View style={styles.section}>
            {PAISES.map((pais) => {
              const isActive = selected === pais.code;
              return (
                <Pressable
                  key={pais.code}
                  style={[styles.paisBtn, isActive && styles.paisBtnActive]}
                  onPress={() => handleSelect(pais.code)}
                  disabled={loading}
                >
                  <Text style={styles.flag}>{pais.flag}</Text>
                  <View style={styles.paisInfo}>
                    <Text style={[styles.paisName, isActive && styles.paisNameActive]}>
                      {pais.name}
                    </Text>
                    <Text style={styles.paisCurrency}>
                      {pais.currencyCode} · {pais.bureau}
                    </Text>
                  </View>
                  {isActive && loading && (
                    <ActivityIndicator size="small" color={colors.brand} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.privacyNote}>
            Tus datos se guardan solo en este dispositivo.
          </Text>
        </View>
      )}

      {/* ── Disclaimer al pie (siempre visible) ───────────────────────── */}
      <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },

  // ── Slides ──
  slideWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  slideIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: font.medium,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  slideBody: {
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.brand,
    width: 20,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    minWidth: 200,
  },
  nextBtnText: { color: '#fff', fontWeight: font.medium, fontSize: 16 },
  skip: { fontSize: 14, color: colors.faint, marginTop: spacing.sm },

  // ── País ──
  countryWrap: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    fontSize: 15,
    fontWeight: font.medium,
    color: colors.brand,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: 28,
    fontWeight: font.medium,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  section: { gap: spacing.sm, marginBottom: spacing.lg },
  paisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  paisBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  flag: { fontSize: 32 },
  paisInfo: { flex: 1 },
  paisName: { fontSize: 16, fontWeight: font.medium, color: colors.ink },
  paisNameActive: { color: colors.brandInk },
  paisCurrency: { fontSize: 12, color: colors.muted, marginTop: 2 },
  privacyNote: { fontSize: 12, color: colors.faint, textAlign: 'center' },

  // ── Disclaimer ──
  disclaimer: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
