// ─── Tokens de diseño FinBalanza: Diario de Salud Financiera ───────────────
// Paleta completamente nueva — no reutiliza nada de la app anterior

export const colors = {
  // Fondos y superficies
  bg: '#F4F2FB',
  surface: '#FFFFFF',
  border: '#ECE9F5',

  // Tipografía
  ink: '#1C1A2E',
  muted: '#6E6A85',
  faint: '#9C99AD',

  // Marca principal
  brand: '#574AE2',
  brandSoft: '#EEEBFB',
  brandInk: '#3C3489',

  // Semáforo — verde
  green: '#16B981',
  greenSoft: '#E6F7F0',
  greenInk: '#0F6E56',

  // Semáforo — ámbar
  amber: '#F5A524',
  amberSoft: '#FEF4E1',
  amberInk: '#854F0B',

  // Semáforo — rojo
  red: '#EF4444',
  redSoft: '#FDECEC',
  redInk: '#991B1B',
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 24,
  ring: 32,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const font = {
  normal: '400',
  medium: '500',
};

// ─── Evaluador DTI (Debt-to-Income ratio) ─────────────────────────────────
// ratioPct = (deuda / ingreso) * 100
export function evaluateDTI(ratioPct) {
  if (ratioPct <= 30) {
    return {
      level: 'green',
      label: 'Capacidad saludable',
      tip: 'Tu carga de deuda es manejable. Buen momento para ahorrar o invertir.',
      color: colors.green,
      soft: colors.greenSoft,
      ink: colors.greenInk,
      icon: 'checkmark-circle',
    };
  }
  if (ratioPct <= 40) {
    return {
      level: 'amber',
      label: 'Zona de alerta',
      tip: 'Estás cerca del límite recomendado. Evita adquirir nuevas deudas.',
      color: colors.amber,
      soft: colors.amberSoft,
      ink: colors.amberInk,
      icon: 'warning',
    };
  }
  return {
    level: 'red',
    label: 'Riesgo alto',
    tip: 'Tus pagos superan el 40 % de tu ingreso. Considera renegociar tus deudas.',
    color: colors.red,
    soft: colors.redSoft,
    ink: colors.redInk,
    icon: 'close-circle',
  };
}

// ─── Evaluador del Índice de Salud (score 0-100) ──────────────────────────
// Mismo semáforo: verde >=70, ámbar 40-69, rojo <40
export function evaluateHealth(score) {
  if (score >= 70) {
    return { level: 'green', label: 'Saludable', color: colors.green, soft: colors.greenSoft, ink: colors.greenInk };
  }
  if (score >= 40) {
    return { level: 'amber', label: 'Mejorable', color: colors.amber, soft: colors.amberSoft, ink: colors.amberInk };
  }
  return { level: 'red', label: 'En riesgo', color: colors.red, soft: colors.redSoft, ink: colors.redInk };
}
