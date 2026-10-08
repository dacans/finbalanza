// ─── Diario de gastos hormiga — proyección mensual real ─────────────────────
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCountryConfig } from '../../src/health/country';
import {
  addExpense,
  deleteExpense,
  getCountryCode,
  getExpensesThisMonth,
  getMonthlyDebtTotal,
  getMonthlyHormigaTotal,
} from '../../src/health/db';
import { colors, font, radius, spacing } from '../../src/health/theme';
import BottomNav from './_components/BottomNav';

// Categorías disponibles con ícono Ionicons
const CATEGORIAS = [
  { key: 'cafe',          label: 'Café',          icon: 'cafe' },
  { key: 'comida',        label: 'Comida calle',  icon: 'fast-food' },
  { key: 'suscripcion',   label: 'Suscripción',   icon: 'tv' },
  { key: 'transporte',    label: 'Transporte',    icon: 'bus' },
  { key: 'otro',          label: 'Otro',          icon: 'ellipsis-horizontal' },
];

// Frecuencias con su multiplicador mensual (espejo de FREQ_MULT en db.js)
const FRECUENCIAS = [
  { key: 'diario',  label: 'Diario',  mult: 30 },
  { key: 'semanal', label: 'Semanal', mult: 4 },
  { key: 'unico',   label: 'Único',   mult: 1 },
];

function iconForCat(cat) {
  return CATEGORIAS.find((c) => c.key === cat)?.icon ?? 'ellipsis-horizontal';
}

// Costo mensual proyectado de un gasto según su frecuencia
function proyectarMensual(item) {
  const mult = FRECUENCIAS.find((f) => f.key === item.frequency)?.mult ?? 1;
  return item.amount * mult;
}

function labelFrecuencia(key) {
  return FRECUENCIAS.find((f) => f.key === key)?.label ?? 'Único';
}

export default function GastosScreen() {
  const insets = useSafeAreaInsets();

  const [countryCode, setCC] = useState('MX');
  const [monto, setMonto] = useState('');
  const [label, setLabel] = useState('');
  const [categoria, setCategoria] = useState('cafe');
  const [frecuencia, setFrecuencia] = useState('diario');
  const [gastos, setGastos] = useState([]);
  const [total, setTotal] = useState(0);     // total mensual proyectado
  const [deuda, setDeuda] = useState(0);     // pago de deuda mensual (desde Pagos)

  // Formateador de moneda dependiente del país
  const fmt = (n) => getCountryConfig(countryCode).currency + Math.round(n).toLocaleString();

  const recargar = useCallback(async () => {
    const code = await getCountryCode();
    if (code) setCC(code);
    const [lista, tot, deudaMensual] = await Promise.all([
      getExpensesThisMonth(),
      getMonthlyHormigaTotal(),
      getMonthlyDebtTotal(),
    ]);
    setGastos(lista);
    setTotal(tot);
    setDeuda(deudaMensual);
  }, []);

  // Recalcula al entrar (y al volver de otras pestañas)
  useFocusEffect(
    useCallback(() => {
      recargar().catch(() => {});
    }, [recargar]),
  );

  async function handleAgregar() {
    const n = parseFloat(monto);
    if (!n || n <= 0) return;
    await addExpense({
      label: label || CATEGORIAS.find((c) => c.key === categoria)?.label,
      amount: n,
      category: categoria,
      frequency: frecuencia,
    });
    setMonto('');
    setLabel('');
    await recargar();
  }

  async function handleBorrar(id) {
    await deleteExpense(id);
    await recargar();
  }

  // Mensaje motivador conectado a deuda real
  const pctDeuda = deuda > 0 ? Math.round((total / deuda) * 100) : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Gastos hormiga</Text>
        <Text style={styles.subtitulo}>Proyección mensual</Text>
      </View>

      {/* ── Tarjeta total proyectado ──────────────────────────── */}
      <View style={[styles.card, styles.brandCard]}>
        <View>
          <Text style={styles.brandLabel}>Total proyectado/mes</Text>
          <Text style={styles.brandAmount}>{fmt(total)}</Text>
        </View>
      </View>

      {/* ── Mensaje motivador conectado a deuda ───────────────── */}
      {total > 0 && (
        <View style={[styles.card, styles.tipCard]}>
          <Ionicons name="bulb" size={16} color={colors.amberInk} />
          <Text style={styles.tipText}>
            {deuda > 0
              ? `Tus gastos hormiga (${fmt(total)}/mes) equivalen al ${pctDeuda}% de tu pago de deuda. Recortándolos podrías abonar más y salir antes.`
              : `Tus gastos hormiga suman ${fmt(total)}/mes. Recortarlos es ahorro directo a tu bolsillo.`}
          </Text>
        </View>
      )}

      {/* ── Formulario de captura ─────────────────────────────── */}
      <View style={styles.card}>
        {/* Selector de categoría */}
        <View style={styles.catRow}>
          {CATEGORIAS.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.catBtn, categoria === c.key && styles.catBtnActive]}
              onPress={() => setCategoria(c.key)}
            >
              <Ionicons
                name={c.icon}
                size={16}
                color={categoria === c.key ? colors.brandInk : colors.muted}
              />
              <Text style={[styles.catLabel, categoria === c.key && styles.catLabelActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Selector de frecuencia */}
        <View style={styles.catRow}>
          {FRECUENCIAS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.freqBtn, frecuencia === f.key && styles.catBtnActive]}
              onPress={() => setFrecuencia(f.key)}
            >
              <Text style={[styles.catLabel, frecuencia === f.key && styles.catLabelActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Descripción opcional + monto */}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={label}
            onChangeText={setLabel}
            placeholder="Descripción (opcional)"
            placeholderTextColor={colors.faint}
          />
          <TextInput
            style={[styles.input, styles.inputMonto]}
            value={monto}
            onChangeText={(v) => setMonto(v.replace(/[^0-9.]/g, ''))}
            placeholder="Monto"
            placeholderTextColor={colors.faint}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>

        <Pressable style={styles.addBtn} onPress={handleAgregar}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Agregar gasto</Text>
        </Pressable>
      </View>

      {/* ── Lista de gastos ───────────────────────────────────── */}
      <FlatList
        data={gastos}
        keyExtractor={(item) => String(item.id)}
        style={styles.lista}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 80 + insets.bottom }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cafe-outline" size={40} color={colors.brand} />
            <Text style={styles.emptyTitle}>Sin gastos este mes</Text>
            <Text style={styles.emptyBody}>
              Registra ese café o suscripción arriba para ver cuánto suman al mes.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gastoItem}>
            <View style={styles.gastoIcon}>
              <Ionicons name={iconForCat(item.category)} size={18} color={colors.brand} />
            </View>
            <View style={styles.gastoInfo}>
              <Text style={styles.gastoLabel}>{item.label}</Text>
              {/* Monto base + frecuencia */}
              <Text style={styles.gastoFecha}>
                {fmt(item.amount)} · {labelFrecuencia(item.frequency)}
              </Text>
            </View>
            {/* Costo mensual proyectado */}
            <View style={styles.gastoMontoWrap}>
              <Text style={styles.gastoMonto}>{fmt(proyectarMensual(item))}</Text>
              <Text style={styles.gastoMensual}>/mes</Text>
            </View>
            <Pressable onPress={() => handleBorrar(item.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.faint} />
            </Pressable>
          </View>
        )}
      />

      <BottomNav active="gastos" />
    </KeyboardAvoidingView>
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
  brandCard: {
    backgroundColor: colors.brand,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandLabel: { fontSize: 13, color: '#fff', opacity: 0.8 },
  brandAmount: { fontSize: 26, fontWeight: font.medium, color: '#fff', marginTop: 2 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.md,
  },
  tipText: { fontSize: 13, color: colors.amberInk, flex: 1, lineHeight: 18 },

  // Categorías / frecuencia
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freqBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catBtnActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  catLabel: { fontSize: 12, color: colors.muted, fontWeight: font.normal },
  catLabelActive: { color: colors.brandInk, fontWeight: font.medium },

  // Inputs
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  inputMonto: { width: 100, textAlign: 'right' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  addBtnText: { color: '#fff', fontWeight: font.medium, fontSize: 15 },

  // Lista
  lista: { flex: 1, paddingHorizontal: spacing.md },
  emptyState: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: font.medium, color: colors.ink, marginTop: spacing.xs },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },

  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  gastoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gastoInfo: { flex: 1 },
  gastoLabel: { fontSize: 14, color: colors.ink, fontWeight: font.normal },
  gastoFecha: { fontSize: 11, color: colors.faint, marginTop: 2 },
  gastoMontoWrap: { alignItems: 'flex-end' },
  gastoMonto: { fontSize: 15, fontWeight: font.medium, color: colors.ink },
  gastoMensual: { fontSize: 10, color: colors.faint },
});
