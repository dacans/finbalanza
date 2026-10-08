// ─── Persistencia local — expo-sqlite (API async, SDK 51+) ─────────────────
import * as SQLite from 'expo-sqlite';
import { evaluateHealth } from './theme';

let _db = null;
// undefined = sin cargar aún | null = sin país elegido | string = código guardado
let _countryCache = undefined;

// Tipos de recordatorio que cuentan como DEUDA (alimentan DTI e Índice de Salud)
export const DEBT_TYPES = ['tarjeta', 'prestamo_familiar', 'prestamo', 'otro_deuda'];

// Multiplicador mensual según frecuencia del gasto hormiga
const FREQ_MULT = { diario: 30, semanal: 4, unico: 1 };

// Comprueba si una columna existe en una tabla (para migraciones idempotentes)
async function columnExists(db, table, column) {
  const cols = await db.getAllAsync(`PRAGMA table_info(${table});`);
  return cols.some((c) => c.name === column);
}

// Abre (o reutiliza) la conexión y garantiza que todas las tablas existan
async function getDb() {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync('finbalanza.db');

  // WAL mejora rendimiento de escrituras concurrentes
  await _db.execAsync('PRAGMA journal_mode = WAL;');

  // ── Tabla perfil único (id siempre = 1) ─────────────────────────────────
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS profile (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      country    TEXT    NOT NULL DEFAULT '',
      income     REAL    NOT NULL DEFAULT 0,
      debt       REAL    NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Gastos hormiga: un registro por gasto registrado ────────────────────
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT    NOT NULL DEFAULT '',
      amount     REAL    NOT NULL DEFAULT 0,
      category   TEXT    NOT NULL DEFAULT 'otro',
      created_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Recordatorios de pago con notificación local vinculada ──────────────
  // amount = pago MENSUAL. Los de tipo DEBT_TYPES alimentan Balance e Índice.
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS reminders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT    NOT NULL DEFAULT '',
      amount     REAL    NOT NULL DEFAULT 0,
      day        INTEGER NOT NULL DEFAULT 1,
      type       TEXT    NOT NULL DEFAULT 'otro',
      notif_id   TEXT    NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Registro de pagos: una fila por "marcar pagado" ─────────────────────
  // on_time = 1 si se pagó a tiempo, 0 si tarde. Alimenta getOnTimeRate().
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS payments_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      reminder_id INTEGER NOT NULL,
      paid_on     INTEGER NOT NULL DEFAULT 0,
      on_time     INTEGER NOT NULL DEFAULT 1
    );
  `);

  // ── Migración idempotente: expenses.frequency ───────────────────────────
  // ALTER TABLE solo si la columna aún no existe (no rompe DBs ya creadas)
  if (!(await columnExists(_db, 'expenses', 'frequency'))) {
    await _db.execAsync(
      "ALTER TABLE expenses ADD COLUMN frequency TEXT NOT NULL DEFAULT 'unico';",
    );
  }

  return _db;
}

// Rango [inicio, fin) en ms del mes calendario actual
function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return [start, end];
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════════════════════════════════════════

// Devuelve la fila única del perfil, o null si aún no existe
export async function getProfile() {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM profile WHERE id = 1;');
  return row ?? null;
}

// Upsert sobre id=1 — crea o actualiza el perfil del usuario
export async function saveProfile({ country, income, debt }) {
  const db = await getDb();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO profile (id, country, income, debt, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       country    = excluded.country,
       income     = excluded.income,
       debt       = excluded.debt,
       updated_at = excluded.updated_at;`,
    [country, income, debt, now],
  );
}

// Guarda solo el ingreso mensual manual (no toca country ni debt legacy)
export async function saveIncome(income) {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO profile (id, country, income, debt, updated_at)
     VALUES (1, '', ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       income     = excluded.income,
       updated_at = excluded.updated_at;`,
    [income, now],
  );
}

// Borra TODOS los datos del usuario (las 4 tablas) y resetea el cache de país.
// Tras esto, getCachedCountryCode() devuelve null → el gate manda a onboarding.
export async function clearAllData() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM profile;
    DELETE FROM expenses;
    DELETE FROM reminders;
    DELETE FROM payments_log;
  `);
  _countryCache = null;
}

// Lee el código de país desde SQLite y llena el cache síncrono
export async function getCountryCode() {
  const row = await getProfile();
  _countryCache = row?.country || null;
  return _countryCache;
}

// Lectura síncrona del cache — no hace I/O, seguro para usar en el gate de React
export function getCachedCountryCode() {
  return _countryCache;
}

// Escribe el código de país sin tocar income/debt y sincroniza el cache al instante
export async function setCountryCode(code) {
  const db = await getDb();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO profile (id, country, income, debt, updated_at)
     VALUES (1, ?, 0, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       country    = excluded.country,
       updated_at = excluded.updated_at;`,
    [code, now],
  );
  // Cache inmediato: el gate lo leerá de forma síncrona en el próximo render
  _countryCache = code;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPENSES (gastos hormiga)
// ══════════════════════════════════════════════════════════════════════════════

// Inserta un nuevo gasto con su frecuencia ('diario','semanal','unico')
export async function addExpense({ label, amount, category, frequency = 'unico' }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO expenses (label, amount, category, frequency, created_at) VALUES (?, ?, ?, ?, ?);',
    [label, amount, category, frequency, Date.now()],
  );
}

// Gastos cuyo created_at cae en el mes/año actuales
export async function getExpensesThisMonth() {
  const db = await getDb();
  const now = new Date();
  // Primer ms del mes en curso
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  // Primer ms del mes siguiente
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  return db.getAllAsync(
    'SELECT * FROM expenses WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC;',
    [start, end],
  );
}

// Suma total de gastos del mes actual
export async function getMonthlyExpenseTotal() {
  const db = await getDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  const row = await db.getFirstAsync(
    'SELECT SUM(amount) AS total FROM expenses WHERE created_at >= ? AND created_at < ?;',
    [start, end],
  );
  return row?.total ?? 0;
}

// Elimina un gasto por id
export async function deleteExpense(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDERS (recordatorios de pago)
// ══════════════════════════════════════════════════════════════════════════════

// Inserta un recordatorio con el id de la notificación programada
export async function addReminder({ label, amount, day, type, notif_id }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO reminders (label, amount, day, type, notif_id, created_at) VALUES (?, ?, ?, ?, ?, ?);',
    [label, amount, day, type, notif_id, Date.now()],
  );
}

// Devuelve todos los recordatorios ordenados por día del mes
export async function getReminders() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM reminders ORDER BY day ASC;');
}

// Elimina un recordatorio y devuelve su notif_id para cancelar la notificación
export async function deleteReminder(id) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT notif_id FROM reminders WHERE id = ?;', [id]);
  await db.runAsync('DELETE FROM reminders WHERE id = ?;', [id]);
  // Limpia el registro de pagos asociado para no dejar huérfanos
  await db.runAsync('DELETE FROM payments_log WHERE reminder_id = ?;', [id]);
  return row?.notif_id ?? null;
}

// ══════════════════════════════════════════════════════════════════════════════
// INTELIGENCIA — el dato fluye: Pagos → Balance/Índice ; Gastos → Disponible/Índice
// ══════════════════════════════════════════════════════════════════════════════

// Suma del pago mensual de TODAS las deudas (reminders cuyo type ∈ DEBT_TYPES)
export async function getMonthlyDebtTotal() {
  const db = await getDb();
  // Placeholders dinámicos para el IN (...)
  const marks = DEBT_TYPES.map(() => '?').join(',');
  const row = await db.getFirstAsync(
    `SELECT SUM(amount) AS total FROM reminders WHERE type IN (${marks});`,
    DEBT_TYPES,
  );
  return row?.total ?? 0;
}

// Total mensual proyectado de gastos hormiga del mes:
// diario×30, semanal×4, único×1 (sobre los gastos creados en el mes actual)
export async function getMonthlyHormigaTotal() {
  const db = await getDb();
  const [start, end] = monthRange();
  const row = await db.getFirstAsync(
    `SELECT SUM(
       CASE frequency
         WHEN 'diario'  THEN amount * 30
         WHEN 'semanal' THEN amount * 4
         ELSE amount
       END
     ) AS total
     FROM expenses
     WHERE created_at >= ? AND created_at < ?;`,
    [start, end],
  );
  return row?.total ?? 0;
}

// DTI = deuda mensual / ingreso × 100. Si income<=0 → ratioPct = 0
export async function getDTI() {
  const profile = await getProfile();
  const income = profile?.income ?? 0;
  const debt = await getMonthlyDebtTotal();
  const ratioPct = income > 0 ? Math.round((debt / income) * 100) : 0;
  return { ratioPct, income, debt };
}

// Registra un pago marcado por el usuario (on_time 1/0)
export async function logPayment(reminder_id, onTime) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO payments_log (reminder_id, paid_on, on_time) VALUES (?, ?, ?);',
    [reminder_id, Date.now(), onTime ? 1 : 0],
  );
}

// IDs de recordatorios de deuda ya marcados como pagados ESTE mes (feedback UI)
export async function getPaidReminderIdsThisMonth() {
  const db = await getDb();
  const [start, end] = monthRange();
  const rows = await db.getAllAsync(
    'SELECT DISTINCT reminder_id FROM payments_log WHERE paid_on >= ? AND paid_on < ?;',
    [start, end],
  );
  return rows.map((r) => r.reminder_id);
}

// % de pagos de deuda marcados a tiempo este mes. Sin datos aún → null
export async function getOnTimeRate() {
  const db = await getDb();
  const [start, end] = monthRange();
  const marks = DEBT_TYPES.map(() => '?').join(',');
  // Solo pagos de este mes ligados a recordatorios de DEUDA
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS total, SUM(p.on_time) AS aTiempo
     FROM payments_log p
     JOIN reminders r ON r.id = p.reminder_id
     WHERE p.paid_on >= ? AND p.paid_on < ? AND r.type IN (${marks});`,
    [start, end, ...DEBT_TYPES],
  );
  const total = row?.total ?? 0;
  if (total === 0) return null;
  return Math.round(((row.aTiempo ?? 0) / total) * 100);
}

// ─── Índice de Salud Financiera (0-100) ───────────────────────────────────
// Fórmula documentada:
//   base 100
//   − DTI:    ratio>40 → −40 | 30–40 → −20 | ≤30 → −0
//   − hormiga: gasto>15% ingreso → −15 | 8–15% → −8 | <8% → −0
//   ± pagos:  onTime≥90% → −0 | 70–90% → −10 | <70% → −20 | sin datos → −0
//   clamp 0-100
export async function getHealthIndex() {
  const { ratioPct, income } = await getDTI();
  const hormiga = await getMonthlyHormigaTotal();
  const onTimeRate = await getOnTimeRate();

  let score = 100;
  const factors = [];

  // Factor 1 — DTI
  if (ratioPct > 40) {
    score -= 40;
    factors.push({ label: 'Endeudamiento (DTI) alto', impact: -40 });
  } else if (ratioPct > 30) {
    score -= 20;
    factors.push({ label: 'Endeudamiento (DTI) en alerta', impact: -20 });
  } else {
    factors.push({ label: 'Endeudamiento (DTI) saludable', impact: 0 });
  }

  // Factor 2 — gastos hormiga como % del ingreso
  const hormigaPct = income > 0 ? (hormiga / income) * 100 : 0;
  if (hormigaPct > 15) {
    score -= 15;
    factors.push({ label: 'Gastos hormiga elevados', impact: -15 });
  } else if (hormigaPct >= 8) {
    score -= 8;
    factors.push({ label: 'Gastos hormiga moderados', impact: -8 });
  } else {
    factors.push({ label: 'Gastos hormiga bajo control', impact: 0 });
  }

  // Factor 3 — pagos a tiempo
  if (onTimeRate === null) {
    factors.push({ label: 'Pagos a tiempo (sin datos aún)', impact: 0 });
  } else if (onTimeRate >= 90) {
    factors.push({ label: 'Pagos a tiempo', impact: 0 });
  } else if (onTimeRate >= 70) {
    score -= 10;
    factors.push({ label: 'Algunos pagos tarde', impact: -10 });
  } else {
    score -= 20;
    factors.push({ label: 'Pagos tarde frecuentes', impact: -20 });
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  const { level } = evaluateHealth(score);
  return { score, level, factors };
}
