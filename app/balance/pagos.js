// ─── Recordatorios de pago con notificaciones locales ───────────────────────
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCountryConfig } from '../../src/health/country';
import {
  addReminder,
  deleteReminder,
  DEBT_TYPES,
  getCountryCode,
  getPaidReminderIdsThisMonth,
  getReminders,
  logPayment,
} from '../../src/health/db';
import { colors, font, radius, spacing } from '../../src/health/theme';
import BottomNav from './_components/BottomNav';

// 'tarjeta' y 'prestamo_familiar' son DEUDA → alimentan Balance e Índice
const TIPOS = [
  { key: 'luz',               label: 'Luz',               icon: 'flash' },
  { key: 'agua',              label: 'Agua',              icon: 'water' },
  { key: 'tarjeta',           label: 'Tarjeta',           icon: 'card' },
  { key: 'prestamo_familiar', label: 'Préstamo familiar', icon: 'people' },
  { key: 'otro',              label: 'Otro',              icon: 'ellipsis-horizontal' },
];

// ¿Este recordatorio cuenta como deuda?
function esDeuda(tipo) {
  return DEBT_TYPES.includes(tipo);
}

function iconForTipo(tipo) {
  return TIPOS.find((t) => t.key === tipo)?.icon ?? 'ellipsis-horizontal';
}

// Solicita permisos de notificación si aún no están concedidos
async function pedirPermisos() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: nuevo } = await Notifications.requestPermissionsAsync();
  return nuevo === 'granted';
}

// Programa una notificación mensual repetible el día y hora indicados
async function programarNotif({ label, amount, day, currency }) {
  const ok = await pedirPermisos();
  if (!ok) return '';

  // iOS: trigger tipo calendar con day/hour/repeats
  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Pago: ${label}`,
      body: `Vence hoy — ${currency}${Math.round(amount).toLocaleString()}`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });

  return notifId;
}

export default function PagosScreen() {
  const insets = useSafeAreaInsets();

  const [countryCode, setCC] = useState('MX');
  const [recordatorios, setRecordatorios] = useState([]);
  const [paidIds, setPaidIds] = useState([]); // ids de deuda pagados este mes

  // Formulario
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [dia, setDia] = useState('1');
  const [tipo, setTipo] = useState('tarjeta');

  const cfg = getCountryConfig(countryCode);
  const fmt = (n) => cfg.currency + Math.round(n).toLocaleString();

  async function cargar() {
    const code = await getCountryCode();
    if (code) setCC(code);
    const [lista, pagados] = await Promise.all([
      getReminders(),
      getPaidReminderIdsThisMonth(),
    ]);
    setRecordatorios(lista);
    setPaidIds(pagados);
  }

  useEffect(() => { cargar().catch(() => {}); }, []);

  // Marca un pago: on_time si hoy aún no pasa el día programado (regla simple)
  async function handleMarcarPagado(r) {
    const hoy = new Date().getDate();
    const onTime = hoy <= r.day;
    await logPayment(r.id, onTime);
    await cargar();
  }

  async function handleGuardar() {
    if (!nombre.trim()) return;
    const n = parseFloat(monto) || 0;
    const d = Math.min(28, Math.max(1, parseInt(dia, 10) || 1));

    const notifId = await programarNotif({
      label: nombre.trim(),
      amount: n,
      day: d,
      currency: cfg.currency,
    });

    await addReminder({
      label: nombre.trim(),
      amount: n,
      day: d,
      type: tipo,
      notif_id: notifId,
    });

    setNombre('');
    setMonto('');
    setDia('1');
    await cargar();
  }

  async function handleBorrar(id) {
    const notifId = await deleteReminder(id);
    // Cancela la notificación vinculada si existe
    if (notifId) {
      try { await Notifications.cancelScheduledNotificationAsync(notifId); } catch {}
    }
    await cargar();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.titulo}>Recordatorios</Text>
          <Text style={styles.subtitulo}>Nunca olvides un pago</Text>
        </View>

        {/* ── Formulario ───────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.secLabel}>Nuevo recordatorio</Text>

          {/* Nombre del pago */}
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del pago"
            placeholderTextColor={colors.faint}
          />

          {/* Monto + día */}
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={monto}
              onChangeText={(v) => setMonto(v.replace(/[^0-9.]/g, ''))}
              placeholder="Monto"
              placeholderTextColor={colors.faint}
              keyboardType="numeric"
            />
            <View style={styles.diaWrapper}>
              <Text style={styles.diaLabel}>Día</Text>
              <TextInput
                style={[styles.input, styles.diaInput]}
                value={dia}
                onChangeText={(v) => setDia(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1"
                placeholderTextColor={colors.faint}
              />
            </View>
          </View>

          {/* Selector de tipo */}
          <View style={styles.tipoRow}>
            {TIPOS.map((t) => (
              <Pressable
                key={t.key}
                style={[styles.tipoBtn, tipo === t.key && styles.tipoBtnActive]}
                onPress={() => setTipo(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={tipo === t.key ? colors.brandInk : colors.muted}
                />
                <Text style={[styles.tipoLabel, tipo === t.key && styles.tipoLabelActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.addBtn} onPress={handleGuardar}>
            <Ionicons name="notifications" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Guardar y programar</Text>
          </Pressable>

          <Text style={styles.hint}>
            Recibirás un aviso cada mes el día {dia} a las 9:00 am.
          </Text>
        </View>

        {/* ── Lista de recordatorios ────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {recordatorios.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-outline" size={40} color={colors.brand} />
              <Text style={styles.emptyTitle}>Sin recordatorios</Text>
              <Text style={styles.emptyBody}>
                Agrega tu tarjeta o préstamo arriba. Los pagos de deuda alimentan tu DTI e índice.
              </Text>
            </View>
          )}
          {recordatorios.map((r) => {
            const pagado = paidIds.includes(r.id);
            return (
              <View key={r.id} style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <View style={styles.itemIcon}>
                    <Ionicons name={iconForTipo(r.type)} size={18} color={colors.brand} />
                  </View>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemLabelRow}>
                      <Text style={styles.itemLabel}>{r.label}</Text>
                      {/* Distintivo si el recordatorio es deuda */}
                      {esDeuda(r.type) && (
                        <View style={styles.deudaTag}>
                          <Text style={styles.deudaTagText}>Deuda</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemSub}>
                      Día {r.day} · {fmt(r.amount)}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleBorrar(r.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.faint} />
                  </Pressable>
                </View>

                {/* Botón "Marcar pagado" / feedback de pagado este mes */}
                {pagado ? (
                  <View style={[styles.pagoBtn, styles.pagoBtnDone]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.greenInk} />
                    <Text style={styles.pagoDoneText}>Pagado este mes</Text>
                  </View>
                ) : (
                  <Pressable style={styles.pagoBtn} onPress={() => handleMarcarPagado(r)}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.brand} />
                    <Text style={styles.pagoText}>Marcar pagado</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <BottomNav active="pagos" />
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
    gap: spacing.sm,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  secLabel: { fontSize: 13, fontWeight: font.medium, color: colors.muted },

  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  diaWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diaLabel: { fontSize: 13, color: colors.muted },
  diaInput: { width: 56, textAlign: 'center' },

  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tipoBtn: {
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
  tipoBtnActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  tipoLabel: { fontSize: 12, color: colors.muted },
  tipoLabelActive: { color: colors.brandInk, fontWeight: font.medium },

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
  hint: { fontSize: 12, color: colors.faint, textAlign: 'center' },

  // Lista
  emptyState: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: font.medium, color: colors.ink, marginTop: spacing.xs },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },

  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemLabel: { fontSize: 14, fontWeight: font.normal, color: colors.ink },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 2 },

  // Distintivo de deuda
  deudaTag: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  deudaTagText: { fontSize: 10, color: colors.brandInk, fontWeight: font.medium },

  // Botón marcar pagado
  pagoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.brandSoft,
  },
  pagoText: { fontSize: 13, color: colors.brand, fontWeight: font.medium },
  pagoBtnDone: { backgroundColor: colors.greenSoft },
  pagoDoneText: { fontSize: 13, color: colors.greenInk, fontWeight: font.medium },
});
