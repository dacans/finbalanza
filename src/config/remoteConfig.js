// ─── Config remota (Firestore config/app) ───────────────────────────────────
// Se cambia desde el panel iOS sin subir versión:
//   showWizard          → true = flujo de préstamos · false = versión educativa (/balance)
//   unlockIntervalHours → horas que la solicitud queda "en análisis" antes de mostrar ofertas
//   exploracionPct      → % de usuarios a los que un CPS al azar se les muestra primero
import { doc, getDoc } from "firebase/firestore";
import { EXPLORACION_DEFAULT, UNLOCK_HOURS_DEFAULT } from "../router/config";

let cache = {
  showWizard: false,
  unlockIntervalHours: UNLOCK_HOURS_DEFAULT,
  exploracionPct: EXPLORACION_DEFAULT,
};

function numero(v, def, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

/** Lee config/app. Si falla, queda la versión educativa (fail cerrado, igual que antes). */
export async function loadRemoteConfig(db) {
  try {
    const snap = await getDoc(doc(db, "config", "app"));
    const d = snap.exists() ? snap.data() || {} : {};
    cache = {
      showWizard: Boolean(d.showWizard),
      unlockIntervalHours: numero(d.unlockIntervalHours, UNLOCK_HOURS_DEFAULT, 0, 720),
      exploracionPct: numero(d.exploracionPct, EXPLORACION_DEFAULT, 0, 100),
    };
  } catch {
    cache = { ...cache, showWizard: false };
  }
  return cache;
}

export function getRemoteConfig() {
  return cache;
}
