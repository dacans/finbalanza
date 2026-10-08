// ─── Tablero DTI — dashboard (la deuda viene de Pagos, no se teclea aquí) ────
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMoney, getCountryConfig } from '../../src/health/country';
import {
  getCountryCode,
  getDTI,
  getMonthlyHormigaTotal,
  saveIncome,
} from '../../src/health/db';
import { LEGAL_URLS } from '../../src/health/legal';
import { colors, evaluateDTI, font, radius, spacing } from '../../src/health/theme';
import BottomNav from './_components/BottomNav';

// Abre una URL legal pública en el navegador (sin navegación interna)
const openLink = async (url) => { try { await Linking.openURL(url); } catch (e) {} };

// ─── Constantes del anillo ──────────────────────────────────────────────────
const RING_SIZE = 200;
const STROKE = 12;
const R = (RING_SIZE - STROKE) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * R;

// ─── Sub-componentes ────────────────────────────────────────────────────────

function DTIRing({ pct, estado }) {
  const arco = CIRCUNFERENCIA * (1 - pct / 100);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  return (
    <View style={styles.ringWrapper}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
        {/* Pista de fondo */}
        <Circle
          cx={cx} cy={cy} r={R}
          stroke={colors.border} strokeWidth={STROKE}
          fill="none" strokeLinecap="round"
        />
        {/* Arco de progreso */}
        <Circle
          cx={cx} cy={cy} r={R}
          stroke={estado.color} strokeWidth={STROKE}
          fill="none" strokeLinecap="round"
          strokeDasharray={`${CIRCUNFERENCIA}`}
          strokeDashoffset={arco}
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringPct, { color: estado.color }]}>{pct}%</Text>
        <Text style={styles.ringLabel}>de tu ingreso</Text>
      </View>
    </View>
  );
}

function EstadoBadge({ estado }) {
  return (
    <View style={styles.badgeBlock}>
      <View style={[styles.badge, { backgroundColor: estado.soft }]}>
        <Ionicons name={estado.icon} size={18} color={estado.ink} />
        <Text style={[styles.badgeText, { color: estado.ink }]}>{estado.label}</Text>
      </View>
      <Text style={styles.tip}>{estado.tip}</Text>
    </View>
  );
}

function Leyenda() {
  const items = [
    { color: colors.green, label: 'Sano ≤ 30 %' },
    { color: colors.amber, label: 'Alerta 30–40 %' },
    { color: colors.red,   label: 'Riesgo > 40 %' },
  ];
  return (
    <View style={styles.leyenda}>
      {items.map((item) => (
        <View key={item.label} style={styles.leyendaItem}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.leyendaText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Pantalla principal ─────────────────────────────────────────────────────
export default function BalanceScreen() {
  const insets = useSafeAreaInsets();

  const [income, setIncomeRaw] = useState('');
  const [countryCode, setCC] = useState('MX');
  const [debt, setDebt] = useState(0);       // deuda mensual (auto desde Pagos)
  const [ratioPct, setRatioPct] = useState(0);
  const [hormiga, setHormiga] = useState(0); // gastos hormiga proyectados

  const cfg = getCountryConfig(countryCode);

  // Debounce de 800 ms para persistir el ingreso
  const saveTimer = useRef(null);

  // Recarga todos los datos derivados (DTI + hormiga) desde SQLite
  const recargar = useCallback(async () => {
    const code = await getCountryCode();
    if (code) setCC(code);
    const dti = await getDTI();
    setDebt(dti.debt);
    setRatioPct(dti.ratioPct);
    // Solo precarga el campo si el usuario no está editando (vacío)
    setIncomeRaw((prev) => (prev === '' && dti.income ? String(dti.income) : prev));
    setHormiga(await getMonthlyHormigaTotal());
  }, []);

  // useFocusEffect: al volver de Pagos/Gastos el dashboard se actualiza
  useFocusEffect(
    useCallback(() => {
      recargar().catch(() => {});
    }, [recargar]),
  );

  // Persiste el ingreso y recalcula el DTI en vivo
  const onIncomeChange = (v) => {
    const clean = v.replace(/[^0-9.]/g, '');
    setIncomeRaw(clean);
    const inc = parseFloat(clean) || 0;
    // Recalcula el ratio localmente para feedback inmediato
    setRatioPct(inc > 0 ? Math.round((debt / inc) * 100) : 0);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveIncome(inc).catch(() => {});
    }, 800);
  };

  // Valores derivados
  const incomeNum  = parseFloat(income) || 0;
  const estado     = evaluateDTI(ratioPct);
  const disponible = incomeNum - debt - hormiga;
  const fmtM = (n) => formatMoney(Math.abs(n), countryCode);
  const sinDeudas = debt <= 0;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 80 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>FinBalanza</Text>
            <Text style={styles.appSub}>Diario de salud financiera</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.countryPill}
              onPress={() => router.push('/balance/onboarding')}
            >
              <Ionicons name="map" size={13} color={colors.brandInk} />
              <Text style={styles.countryText}>{cfg.flag} {countryCode}</Text>
            </Pressable>
            {/* Acceso a Ajustes */}
            <Pressable
              style={styles.gearBtn}
              onPress={() => router.push('/balance/ajustes')}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* ── Tarjeta central — anillo DTI o estado vacío ────────── */}
        {sinDeudas ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="documents-outline" size={40} color={colors.brand} />
            <Text style={styles.emptyTitle}>Aún no registras deudas</Text>
            <Text style={styles.emptyBody}>
              Tu DTI se calcula con tus pagos mensuales. Regístralos para ver tu capacidad real.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/balance/pagos')}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Registra tus deudas en Pagos</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <DTIRing pct={ratioPct} estado={estado} />
            <EstadoBadge estado={estado} />
            <Text style={styles.debtNote}>
              Deuda mensual: {fmtM(debt)} (desde Pagos)
            </Text>
          </View>
        )}

        {/* ── Input de ingreso (único) ───────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>{cfg.terms.ingreso}</Text>
            <TextInput
              style={styles.input}
              value={income}
              onChangeText={onIncomeChange}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.faint}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* ── Tarjeta disponible (ingreso − deuda − hormiga) ─────── */}
        <View style={[styles.card, styles.brandCard]}>
          <View>
            <Text style={styles.brandCardLabel}>Disponible este mes</Text>
            <Text style={styles.brandCardSub}>tras deuda y gastos hormiga</Text>
          </View>
          <Text style={styles.brandCardAmount}>
            {disponible < 0 ? '-' : ''}{fmtM(disponible)}
          </Text>
        </View>

        {/* ── Leyenda semáforo ───────────────────────────────────── */}
        <Leyenda />

        {/* ── Enlaces legales externos (navegador, sin pantalla interna) ── */}
        <View style={styles.legalRow}>
          <Pressable onPress={() => openLink(LEGAL_URLS.privacy)} hitSlop={8}>
            <Text style={styles.legalText}>Privacidad</Text>
          </Pressable>
          <Text style={styles.legalSep}>·</Text>
          <Pressable onPress={() => openLink(LEGAL_URLS.terms)} hitSlop={8}>
            <Text style={styles.legalText}>Términos</Text>
          </Pressable>
          <Text style={styles.legalSep}>·</Text>
          <Pressable onPress={() => openLink(LEGAL_URLS.support)} hitSlop={8}>
            <Text style={styles.legalText}>Soporte</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav active="balance" />
    </KeyboardAvoidingView>
  );
}

// ─── Estilos ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  appName: { fontSize: 22, fontWeight: font.medium, color: colors.ink, letterSpacing: -0.3 },
  appSub:  { fontSize: 13, fontWeight: font.normal, color: colors.muted, marginTop: 2 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countryText: { fontSize: 13, fontWeight: font.medium, color: colors.brandInk },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#1C1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  // Estado vacío
  emptyCard: { gap: spacing.sm },
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

  // Anillo
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  ringCenter:  { alignItems: 'center' },
  ringPct:     { fontSize: 48, fontWeight: font.medium, letterSpacing: -1 },
  ringLabel:   { fontSize: 13, color: colors.muted, fontWeight: font.normal, marginTop: 2 },
  debtNote:    { fontSize: 12, color: colors.faint, marginTop: spacing.sm },

  // Badge
  badgeBlock: { alignItems: 'center', gap: spacing.sm, width: '100%' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeText: { fontSize: 14, fontWeight: font.medium },
  tip: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing.sm },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.xs,
  },
  inputLabel: { fontSize: 14, fontWeight: font.normal, color: colors.ink, flex: 1 },
  input: {
    fontSize: 16,
    fontWeight: font.medium,
    color: colors.ink,
    textAlign: 'right',
    minWidth: 110,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
  },

  // Tarjeta brand
  brandCard: {
    backgroundColor: colors.brand,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandCardLabel:  { fontSize: 14, fontWeight: font.normal,  color: '#FFFFFF', opacity: 0.9 },
  brandCardSub:    { fontSize: 11, color: '#FFFFFF', opacity: 0.7, marginTop: 2 },
  brandCardAmount: { fontSize: 20, fontWeight: font.medium, color: '#FFFFFF' },

  // Leyenda
  leyenda:     { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  leyendaText: { fontSize: 12, color: colors.muted, fontWeight: font.normal },

  // Legal — fila centrada de enlaces externos
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  legalText: { fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
  legalSep: { fontSize: 12, color: colors.faint },
});
