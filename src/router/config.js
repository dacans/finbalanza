// ─── Formulario + router de ofertas ─────────────────────────────────────────
// Copia EXACTA de Préstamos Express Android MX 1.4 (PaisConfig.kt + OfertasRouter.kt),
// para que el algoritmo y las métricas sean iguales en las dos plataformas.
// El ORDEN de cada lista importa: el router usa la posición.

/** sub1 de este tráfico en Leadsmatcher (el panel iOS lo usa para saber de qué app es). */
export const FUENTE = "FinBalanza";
export const APP_ID = "finbalanza";

export const MONTOS = [
  "$1,000 – $5,000",
  "$5,000 – $15,000",
  "$15,000 – $30,000",
  "Más de $30,000",
];

export const INGRESOS = [
  "Menor a $5,000",
  "$5,000 – $10,000",
  "$10,000 – $15,000",
  "$15,000 – $25,000",
  "$25,000 o más",
];

export const SITUACIONES_LABORALES = [
  "Contrato Indefinido",
  "Trabajador independiente",
  "Jubilado/Pensionista",
  "Empleado de sector público",
  "Recibiendo ayuda social",
  "Desempleado",
  "Otro",
];

/** 0 = vigente (la única que sirve para un CPS). */
export const INE = ["Sí, vigente", "Está vencida", "No tengo INE"];

/** 0 = CLABE (todos los CPS) · 1 = solo tarjeta · 2 = nada (solo comparadores). */
export const CUENTA = ["Cuenta bancaria con CLABE", "Solo tarjeta de débito", "No tengo cuenta"];

/** La posición es la cantidad (3 = 3 o más). */
export const PRESTAMOS_ACTIVOS = ["Ninguno", "1", "2", "3 o más"];

/** Ingreso fijo → puede ser tier A. Lo que no esté aquí ni en SIN_INGRESO = irregular (tier B). */
export const SITUACIONES_INGRESO_REGULAR = ["Contrato Indefinido", "Jubilado/Pensionista", "Empleado de sector público"];

/** Sin ingreso → solo comparadores (tier C). */
export const SITUACIONES_SIN_INGRESO = ["Desempleado"];

/** Más de lo que da cualquier CPS → comparadores (tier C). */
export const MONTOS_ALTOS = ["Más de $30,000"];

/** Defaults si config/app no trae valor (se cambian desde el panel). */
export const UNLOCK_HOURS_DEFAULT = 24;
export const EXPLORACION_DEFAULT = 20;

/** Respuestas de "¿Cómo te fue?" (se guardan tal cual en el teléfono y en Firestore). */
export const RESULTADO = {
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  FALTA_REQUISITO: "falta_requisito",
  DESPUES: "despues",
};

/** Resultados que "cierran" una oferta: la cascada pasa a la siguiente. */
export const CERRADOS = [RESULTADO.APROBADO, RESULTADO.RECHAZADO, RESULTADO.FALTA_REQUISITO];

/** Opciones de "Me pidió algo que no tengo" (la 1ª actualiza el perfil: sin CLABE → solo tarjeta). */
export const REQUISITOS = [
  ["clabe", "Cuenta con CLABE"],
  ["identidad", "Selfie o validación de identidad"],
  ["comprobante", "Comprobante de ingresos"],
  ["otro", "Otra cosa"],
];

/** Recordatorios locales (igual que Android). */
export const HORA_MS = 3600 * 1000;
export const RECORDATORIO_TRAS_CLIC_MS = 2 * HORA_MS;
export const RECORDATORIO_DESPUES_MS = 3 * HORA_MS;
export const RECORDATORIO_OTRA_OPCION_MS = 20 * HORA_MS;
