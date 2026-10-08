// ─── Barra de navegación inferior compartida entre pantallas /balance ────────
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '../../../src/health/theme';

const TABS = [
  { key: 'balance',   label: 'Balance',    icon: 'analytics',       route: '/balance' },
  { key: 'gastos',    label: 'Gastos',     icon: 'receipt',         route: '/balance/gastos' },
  { key: 'pagos',     label: 'Pagos',      icon: 'notifications',   route: '/balance/pagos' },
  { key: 'historial', label: 'Historial',  icon: 'bar-chart',       route: '/balance/historial' },
];

// active: string que coincide con el key del tab actual
export default function BottomNav({ active }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || spacing.md }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => router.push(tab.route)}
          >
            <Ionicons
              name={isActive ? tab.icon : `${tab.icon}-outline`}
              size={22}
              color={isActive ? colors.brand : colors.faint}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    color: colors.faint,
    fontWeight: font.normal,
  },
  labelActive: {
    color: colors.brand,
    fontWeight: font.medium,
  },
});
