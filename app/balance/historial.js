// ─── Índice de Salud Financiera — calculado con datos reales ─────────────────
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCountryConfig } from '../../src/health/country';
import {
  getCountryCode,
  getDTI,
  getHealthIndex,
  getMonthlyHormigaTotal,
} from '../../src/health/db';
import { DISCLAIMER } from '../../src/health/legal';
import { colors, evaluateHealth, font, radius, spacing } from '../../src/health/theme';
import BottomNav from './_components/BottomNav';

export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState(0);
  const [factors, setFactors] = useState([]);
  const [countryCode, setCC] = useState('MX');
  const [hasData, setHasData] = useState(true); // ¿hay algo registrado?

  // Animación de la barra
  const barraAnim = useRef(new Animated.Value(0)).current;

  const recargar = useCallback(async () => {
    const code = await getCountryCode();
    if (code) setCC(code);
    // Detecta si el usuario aún no ha registrado nada (ingreso/deuda/gastos)
    const dti = await getDTI();
    const hormiga = await getMonthlyHormigaTotal();
    const vacio = dti.income <= 0 && dti.debt <= 0 && hormiga <= 0;
    setHasData(!vacio);

    const { score: s, factors: f } = await getHealthIndex();
    setScore(s);
    setFactors(f);
    Animated.spring(barraAnim, { toValue: vacio ? 0 : s, useNativeDriver: false }).start();
  }, [barraAnim]);

  // Recalcula el índice cada vez que se entra a la pestaña
  useFocusEffect(
    useCallback(() => {
      recargar().catch(() => {});
    }, [recargar]),
  );

  const estado = evaluateHealth(score);
  const bureau = getCountryConfig(countryCode).bureau;

  // Ancho de la barra como porcentaje animado
  const barraWidth = barraAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.titulo}>Índice de salud</Text>
          <Text style={styles.subtitulo}>Tu progreso financiero</Text>
        </View>

        {/* ── Estado vacío: aún no hay datos ────────────────────── */}
        {!hasData && (
          <View style={[styles.card, styles.emptyState]}>
            <Ionicons name="pulse-outline" size={40} color={colors.brand} />
            <Text style={styles.emptyTitle}>Aún no hay datos</Text>
            <Text style={styles.emptyBody}>
              Registra tu ingreso, deudas y gastos para calcular tu índice de salud real.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/balance/pagos')}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Empezar en Pagos</Text>
            </Pressable>
          </View>
        )}

        {/* ── Índice visual ────────────────────────────────────── */}
        {hasData && (
        <>
        <View style={styles.card}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: estado.color }]}>{score}</Text>
            <View style={[styles.scoreBadge, { backgroundColor: estado.soft }]}>
              <Text style={[styles.scoreBadgeText, { color: estado.ink }]}>{estado.label}</Text>
            </View>
          </View>
          <Text style={styles.scoreSubtitulo}>Índice de salud / 100</Text>

          {/* Barra animada */}
          <View style={styles.barraTrack}>
            <Animated.View
              style={[styles.barraFill, { width: barraWidth, backgroundColor: estado.color }]}
            />
          </View>

          <View style={styles.barraLeyenda}>
            <Text style={[styles.barraTag, { color: colors.red }]}>En riesgo</Text>
            <Text style={[styles.barraTag, { color: colors.amber }]}>Mejorable</Text>
            <Text style={[styles.barraTag, { color: colors.green }]}>Saludable</Text>
          </View>
        </View>

        {/* ── Factores que explican el puntaje ──────────────────── */}
        <Text style={styles.secLabel}>Qué afecta tu índice</Text>
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {factors.map((f, i) => {
            // Color según el impacto: 0 = neutro, negativo = rojo/ámbar
            const neg = f.impact < 0;
            return (
              <View key={i} style={styles.factorRow}>
                <Ionicons
                  name={neg ? 'remove-circle' : 'checkmark-circle'}
                  size={18}
                  color={neg ? colors.red : colors.green}
                />
                <Text style={styles.factorLabel}>{f.label}</Text>
                <Text style={[styles.factorImpact, { color: neg ? colors.red : colors.green }]}>
                  {f.impact > 0 ? '+' : ''}{f.impact}
                </Text>
              </View>
            );
          })}
        </View>
        </>
        )}

        {/* ── Explicación educativa (siempre visible) ───────────── */}
        <View style={[styles.card, styles.avisoCard]}>
          <Ionicons name="information-circle" size={18} color={colors.brandInk} />
          <Text style={styles.avisoText}>
            Tu índice se calcula con tus datos reales: deudas, ingreso, pagos a tiempo y gastos.
            Mejóralos y sube. No es tu score de buró; en {bureau} influyen factores similares
            (puntualidad, uso del crédito y antigüedad).
          </Text>
        </View>

        {/* ── Disclaimer legal al pie ───────────────────────────── */}
        <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
      </ScrollView>

      <BottomNav active="historial" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm },
  titulo: { fontSize: 22, fontWeight: font.medium, color: colors.ink, letterSpacing: -0.3 },
  subtitulo: { fontSize: 13, color: colors.muted, marginTop: 2 },

  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  avisoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.brandSoft,
    marginTop: spacing.sm,
  },
  avisoText: { flex: 1, fontSize: 13, color: colors.brandInk, lineHeight: 18 },

  // Score
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  scoreNum: { fontSize: 52, fontWeight: font.medium, letterSpacing: -1 },
  scoreBadge: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  scoreBadgeText: { fontSize: 13, fontWeight: font.medium },
  scoreSubtitulo: { fontSize: 12, color: colors.faint, marginBottom: spacing.sm },

  barraTrack: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  barraFill: { height: '100%', borderRadius: 5 },
  barraLeyenda: { flexDirection: 'row', justifyContent: 'space-between' },
  barraTag: { fontSize: 11 },

  // Factores
  secLabel: {
    fontSize: 13,
    fontWeight: font.medium,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  factorLabel: { flex: 1, fontSize: 14, color: colors.ink },
  factorImpact: { fontSize: 14, fontWeight: font.medium },

  // Estado vacío
  emptyState: { alignItems: 'center', gap: spacing.xs },
  emptyTitle: { fontSize: 17, fontWeight: font.medium, color: colors.ink, marginTop: spacing.xs },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing.sm },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  emptyBtnText: { color: '#fff', fontWeight: font.medium, fontSize: 14 },

  // Disclaimer
  disclaimer: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
