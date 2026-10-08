// ─── Módulo de país — fuente de verdad: profile.country en SQLite ──────────
// Independiente de utils/countryConfig.js (que usa producción). No importar desde allá.

export const COUNTRIES = {
  MX: {
    code: 'MX',
    name: 'México',
    flag: '🇲🇽',
    currency: '$',
    currencyCode: 'MXN',
    locale: 'es-MX',
    bureau: 'Buró de Crédito / Círculo de Crédito',
    taxNote: 'Los intereses de crédito pueden incluir IVA (16 %).',
    terms: {
      ingreso: 'Ingreso mensual neto',
      deuda: 'Pagos de deuda',
      prestamo: 'Préstamo personal',
    },
  },
  CL: {
    code: 'CL',
    name: 'Chile',
    flag: '🇨🇱',
    currency: '$',
    currencyCode: 'CLP',
    locale: 'es-CL',
    bureau: 'Dicom',
    taxNote: '',
    terms: {
      ingreso: 'Renta mensual líquida',
      deuda: 'Cuotas de deuda',
      prestamo: 'Crédito de consumo',
    },
  },
  PE: {
    code: 'PE',
    name: 'Perú',
    flag: '🇵🇪',
    currency: 'S/',
    currencyCode: 'PEN',
    locale: 'es-PE',
    bureau: 'Infocorp',
    taxNote: '',
    terms: {
      ingreso: 'Ingreso mensual neto',
      deuda: 'Cuotas de deuda',
      prestamo: 'Préstamo personal',
    },
  },
};

// Devuelve la config del país o MX como fallback
export function getCountryConfig(code) {
  return COUNTRIES[code] ?? COUNTRIES.MX;
}

// Formatea un número como moneda local usando Intl
export function formatMoney(amount, code) {
  const { locale, currencyCode } = getCountryConfig(code);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  } catch {
    // Fallback por si el locale no está disponible en el dispositivo
    const { currency } = getCountryConfig(code);
    return `${currency}${Math.round(amount ?? 0).toLocaleString()}`;
  }
}
