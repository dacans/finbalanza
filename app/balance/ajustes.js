// ─── Ajustes: país, legales, borrar datos, acerca de ───────────────────────
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COUNTRIES } from '../../src/health/country';
import { clearAllData, getCountryCode, setCountryCode } from '../../src/health/db';
import { DISCLAIMER, LEGAL_URLS } from '../../src/health/legal';
import { colors, font, radius, spacing } from '../../src/health/theme';

const PAISES = Object.values(COUNTRIES);

// Abre una URL pública en el navegador
const openLink = async (url) => { try { await Linking.openURL(url); } catch (e) {} };

export default function AjustesScreen() {
  const insets = useSafeAreaInsets();
  const [countryCode, setCC] = useState(null);

  // Carga el país actual al entrar
  useFocusEffect(
    useCallback(() => {
      getCountryCode().then((c) => setCC(c)).catch(() => {});
    }, []),
  );

  // Cambia de país (reusa setCountryCode → sincroniza cache)
  async function handleCambiarPais(code) {
    await setCountryCode(code);
    setCC(code);
  }

  // Confirma y borra todos los datos locales
  function handleBorrar() {
    Alert.alert(
      'Borrar mis datos',
      'Se eliminarán tu perfil, gastos, recordatorios y pagos de este dispositivo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              // Cancela todas las notificaciones locales programadas
              await Notifications.cancelAllScheduledNotificationsAsync();
            } catch (e) {}
            // Vuelve al onboarding limpio (cache de país ya es null)
            router.replace('/balance/onboarding');
          },
        },
      ],
    );
  }

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header con volver ─────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.titulo}>Ajustes</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── País ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.secLabel}>País</Text>
          {PAISES.map((pais) => {
            const isActive = countryCode === pais.code;
            return (
              <Pressable
                key={pais.code}
                style={[styles.paisBtn, isActive && styles.paisBtnActive]}
                onPress={() => handleCambiarPais(pais.code)}
              >
                <Text style={styles.flag}>{pais.flag}</Text>
                <View style={styles.paisInfo}>
                  <Text style={[styles.paisName, isActive && styles.paisNameActive]}>
                    {pais.name}
                  </Text>
                  <Text style={styles.paisSub}>{pais.currencyCode} · {pais.bureau}</Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Legales ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.secLabel}>Legal</Text>
          <Pressable style={styles.linkRow} onPress={() => openLink(LEGAL_URLS.privacy)}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.muted} />
            <Text style={styles.linkText}>Aviso de privacidad</Text>
            <Ionicons name="open-outline" size={16} color={colors.faint} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.linkRow} onPress={() => openLink(LEGAL_URLS.terms)}>
            <Ionicons name="document-text-outline" size={18} color={colors.muted} />
            <Text style={styles.linkText}>Términos de uso</Text>
            <Ionicons name="open-outline" size={16} color={colors.faint} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.linkRow} onPress={() => openLink(LEGAL_URLS.support)}>
            <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
            <Text style={styles.linkText}>Soporte</Text>
            <Ionicons name="open-outline" size={16} color={colors.faint} />
          </Pressable>
        </View>

        {/* ── Acerca de FinBalanza ──────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.secLabel}>Acerca de FinBalanza</Text>
          <Text style={styles.aboutText}>
            FinBalanza es un diario de salud financiera para organizar tus deudas,
            gastos y pagos. Pensado para usuarios de México, Chile y Perú, con moneda,
            terminología y buró de crédito local.
          </Text>
          <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
        </View>

        {/* ── Borrar datos ──────────────────────────────────────── */}
        <Pressable style={styles.dangerBtn} onPress={handleBorrar}>
          <Ionicons name="trash-outline" size={18} color={colors.redInk} />
          <Text style={styles.dangerText}>Borrar mis datos</Text>
        </Pressable>

        {/* ── Versión ───────────────────────────────────────────── */}
        <Text style={styles.version}>FinBalanza v{version}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 18, fontWeight: font.medium, color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  secLabel: {
    fontSize: 12,
    fontWeight: font.medium,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // País
  paisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  paisBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  flag: { fontSize: 26 },
  paisInfo: { flex: 1 },
  paisName: { fontSize: 15, fontWeight: font.medium, color: colors.ink },
  paisNameActive: { color: colors.brandInk },
  paisSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  // Legal
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  linkText: { flex: 1, fontSize: 14, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border },

  // Acerca de
  aboutText: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  disclaimer: { fontSize: 11, color: colors.muted, lineHeight: 16, marginTop: spacing.xs },

  // Borrar
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  dangerText: { fontSize: 15, fontWeight: font.medium, color: colors.redInk },

  version: { fontSize: 12, color: colors.faint, textAlign: 'center' },
});
