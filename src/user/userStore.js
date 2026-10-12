// ─── Usuario: estado local + lo mínimo en Firestore (igual que Android MX 1.4) ──────
//
// PRIVACIDAD: las respuestas crudas del formulario (nombre, apellidos, monto, ingresos, situación
// laboral…) NUNCA se suben: quedan solo en el teléfono (AsyncStorage). A Firestore solo va:
//   leads/{id}  (1 documento por instalación; id = device_id, o el lead_id de la versión vieja)
//     installedAt, platform, app, appVersion, pushToken
//     createdAt (= envió el formulario), wizardCompleted, formVersion, country
//     tier (A–D, X = formulario viejo) + perfil { ineVigente, cuenta, activos, ingreso }
//     ofertas.{offer_id} { titulo, clics, primerClicAt, ultimoClicAt, resultado, requisito, resultadoAt }
//     ultimaOferta, ultimoClicAt, ultimoPrimerClicAt, ultimoResultado, yaCliente, vioOfertasAt
//     clicked_offer / offer_clicks (los sigue usando el panel para los usuarios viejos)
//
// sub1..sub4 del link de la oferta = FinBalanza · id del documento · tier · paso de la cascada.
// El postback de Leadsmatcher regresa esos 4 valores y el panel cruza clics y conversiones.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { logEvent } from "../analytics";
import { getRemoteConfig } from "../config/remoteConfig";
import { firestore } from "../firebase";
import { logCompleteRegistration, logSubmitApplication } from "../metaEvents";
import { cancelarRecordatorio, programarDesbloqueo, programarRecordatorio } from "../notifications/local";
import {
  APP_ID,
  CUENTA,
  FUENTE,
  RECORDATORIO_DESPUES_MS,
  RECORDATORIO_OTRA_OPCION_MS,
  RECORDATORIO_TRAS_CLIC_MS,
  RESULTADO,
} from "../router/config";
import { perfil as calcularPerfil, primerNombre, urlConSubs } from "../router/router";

const K = {
  DEVICE: "device_id",
  LEAD_VIEJO: "lead_id", // versiones ≤ 1.6: id automático del lead
  SOLICITUD: "solicitud_v2",
  COMPLETADO: "wizard_completed",
  COMPLETADO_AT: "wizard_completed_at",
  HORAS: "unlock_hours",
  ESTADO: "ofertas_estado_v1",
  TOKEN: "push_token",
  TOKEN_SUBIDO: "push_token_subido",
  INSTALACION: "install_doc_v1",
  VIO_OFERTAS: "vio_ofertas_v1",
  VERSION_SUBIDA: "app_version_subida",
  SOLICITUD_SUBIDA: "solicitud_subida_v2",
};

const APP_VERSION = Constants?.expoConfig?.version || "";
let produccion = false;

function makeId(len = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(K.DEVICE);
  if (existing) return existing;
  const id = makeId();
  await AsyncStorage.setItem(K.DEVICE, id);
  return id;
}

/** ID del documento del usuario en Firestore (= sub2). */
export async function docId() {
  return (await AsyncStorage.getItem(K.LEAD_VIEJO)) || (await getOrCreateDeviceId());
}

/** Merge en leads/{id}. Nunca rompe el flujo si falla la red. Devuelve true si se guardó. */
async function guardar(data) {
  try {
    const id = await docId();
    await setDoc(doc(firestore, "leads", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    return true;
  } catch {
    return false;
  }
}

// ── Instalación y push token ───────────────────────────────────────────────────

/** Solo en el flujo de préstamos (showWizard = true). La versión educativa no escribe nada. */
export async function iniciarProduccion() {
  produccion = true;
  try {
    const viejo = await AsyncStorage.getItem(K.LEAD_VIEJO);
    if (!viejo && !(await AsyncStorage.getItem(K.INSTALACION))) {
      await guardar({ installedAt: serverTimestamp(), platform: "ios", app: APP_ID, appVersion: APP_VERSION });
      await AsyncStorage.multiSet([[K.INSTALACION, "1"], [K.VERSION_SUBIDA, APP_VERSION]]);
    } else if ((await AsyncStorage.getItem(K.VERSION_SUBIDA)) !== APP_VERSION) {
      // Usuario de una versión anterior que actualizó: solo se anota la versión (1 vez por versión)
      await guardar({ appVersion: APP_VERSION });
      await AsyncStorage.setItem(K.VERSION_SUBIDA, APP_VERSION);
    }
    // Envió el formulario pero no había red: se reintenta la subida al volver a abrir
    if ((await AsyncStorage.getItem(K.SOLICITUD)) && !(await AsyncStorage.getItem(K.SOLICITUD_SUBIDA))) {
      await subirSolicitud(true);
    }
    await subirToken();
  } catch {}
}

async function subirToken() {
  if (!produccion) return;
  const token = await AsyncStorage.getItem(K.TOKEN);
  if (!token || token === (await AsyncStorage.getItem(K.TOKEN_SUBIDO))) return;
  await guardar({ pushToken: token });
  await AsyncStorage.setItem(K.TOKEN_SUBIDO, token);
}

export async function guardarPushToken(token) {
  if (!token) return;
  await AsyncStorage.setItem(K.TOKEN, token);
  await subirToken();
}

// ── Solicitud (formulario) ─────────────────────────────────────────────────────

export async function getSolicitud() {
  try {
    return JSON.parse((await AsyncStorage.getItem(K.SOLICITUD)) || "null");
  } catch {
    return null;
  }
}

/** Nombre y monto para mostrar (formulario nuevo, o los de la versión vieja). */
export async function getDatosVisibles() {
  const req = await getSolicitud();
  if (req) return { nombre: primerNombre(req.nombre), monto: req.montoDeseado || "" };
  const nombre = (await AsyncStorage.getItem("lead_first_name")) || "";
  const amt = parseInt((await AsyncStorage.getItem("lead_amount")) || "0", 10);
  return { nombre: primerNombre(nombre), monto: amt > 0 ? `$${amt.toLocaleString("es-MX")}` : "" };
}

export async function getPerfil() {
  return calcularPerfil(await getSolicitud());
}

/** Horas de espera de ESTA solicitud (se congelan al enviarla; las viejas usan la config actual). */
export async function getVentana() {
  const enviadoAt = parseInt((await AsyncStorage.getItem(K.COMPLETADO_AT)) || "0", 10);
  const horasGuardadas = parseFloat((await AsyncStorage.getItem(K.HORAS)) || "");
  const horas = Number.isFinite(horasGuardadas) ? horasGuardadas : getRemoteConfig().unlockIntervalHours;
  const restantesH = enviadoAt ? Math.max(0, horas - (Date.now() - enviadoAt) / 3600000) : 0;
  return { horas, restantesH, desbloqueada: restantesH <= 0 };
}

/** Envió el formulario (pantalla "Analizando"). */
export async function enviarSolicitud(req) {
  const p = calcularPerfil(req);
  const horas = getRemoteConfig().unlockIntervalHours;
  await AsyncStorage.multiSet([
    [K.SOLICITUD, JSON.stringify(req)],
    [K.COMPLETADO, "true"],
    [K.COMPLETADO_AT, String(Date.now())],
    [K.HORAS, String(horas)],
  ]);
  programarDesbloqueo(horas, primerNombre(req.nombre), req.montoDeseado);
  try {
    logEvent("form_complete");
    if (p) logEvent("form_tier", { tier: p.tier });
  } catch {}
  await subirSolicitud(false);
}

/** Sube tier + perfil a leads/{id} (1 sola vez) y luego manda los eventos de Meta. */
async function subirSolicitud(reintento) {
  if (await AsyncStorage.getItem(K.SOLICITUD_SUBIDA)) return;
  const p = calcularPerfil(await getSolicitud());
  const id = await docId();
  const enviadoAt = parseInt((await AsyncStorage.getItem(K.COMPLETADO_AT)) || "0", 10);
  const token = await AsyncStorage.getItem(K.TOKEN);
  const guardado = await guardar({
    // En el reintento se usa la hora real en que lo envió (no la de hoy)
    createdAt: reintento && enviadoAt ? new Date(enviadoAt) : serverTimestamp(),
    wizardCompleted: true,
    formVersion: 2,
    country: "MX",
    platform: "ios",
    app: APP_ID,
    appVersion: APP_VERSION,
    tier: p ? p.tier : "X",
    ...(p ? { perfil: { ineVigente: p.ineVigente, cuenta: p.cuenta, activos: p.activos, ingreso: p.ingreso } } : {}),
    ...(token ? { pushToken: token } : {}),
  });
  if (!guardado) return;
  await AsyncStorage.setItem(K.SOLICITUD_SUBIDA, "1");
  if (token) await AsyncStorage.setItem(K.TOKEN_SUBIDO, token);

  // Meta: solo después de que el lead quedó en Firestore (si falla la red no se reporta un lead que no existe)
  try {
    logCompleteRegistration(id);
    // "Enviar solicitud" solo para los perfiles que un CPS puede aprobar (A/B), igual que Android
    if (p && (p.tier === "A" || p.tier === "B")) logSubmitApplication(p.tier);
  } catch {}
}

// ── Estado de ofertas (local, como el DataStore de Android) ───────────────────

const ESTADO_INICIAL = {
  yaCliente: [],
  yaClienteRespondido: false,
  resultados: {},
  clicadas: [],
  pendiente: "",
  explorar: null,
  semilla: 0,
  ultimoResultado: "",
};

export async function getEstado() {
  try {
    return { ...ESTADO_INICIAL, ...JSON.parse((await AsyncStorage.getItem(K.ESTADO)) || "{}") };
  } catch {
    return { ...ESTADO_INICIAL };
  }
}

async function cambiarEstado(fn) {
  const nuevo = fn(await getEstado());
  await AsyncStorage.setItem(K.ESTADO, JSON.stringify(nuevo));
  return nuevo;
}

/** Decide UNA vez si este usuario entra a la exploración (pct %). */
export function decidirExploracion(pct) {
  return cambiarEstado((e) =>
    e.explorar === null || e.explorar === undefined
      ? { ...e, explorar: Math.random() * 100 < pct, semilla: Math.floor(Math.random() * 2147483647) }
      : e,
  );
}

/** Primera vez que llega a la pantalla de ofertas (mide quién vuelve después del desbloqueo). */
export async function marcarVistaOfertas() {
  if (await AsyncStorage.getItem(K.VIO_OFERTAS)) return;
  await AsyncStorage.setItem(K.VIO_OFERTAS, "1");
  try { logEvent("offers_first_view"); } catch {}
  guardar({ vioOfertasAt: serverTimestamp() });
}

/** "¿Ya pediste en…?" → esas ofertas ya no se le muestran. */
export async function guardarYaCliente(claves) {
  await cambiarEstado((e) => ({ ...e, yaCliente: claves, yaClienteRespondido: true }));
  try { logEvent("ya_cliente", { cantidad: claves.length }); } catch {}
  guardar({ yaCliente: claves });
}

/**
 * Abrió una oferta: queda pendiente de "¿Cómo te fue?", se programa el recordatorio de 2 h,
 * se sube el clic y regresa el link con sub1..sub4.
 */
export async function prepararClic(oferta, p, posicion, esRecomendada) {
  const tier = p ? p.tier : "X";
  const antes = await getEstado();
  const paso = antes.clicadas.filter((c) => c !== oferta.clave).length + 1;
  const primera = !antes.clicadas.includes(oferta.clave);
  await cambiarEstado((e) => ({ ...e, clicadas: [...new Set([...e.clicadas, oferta.clave])], pendiente: oferta.clave }));

  try {
    logEvent("offer_click", {
      oferta_id: oferta.clave,
      oferta: oferta.titulo,
      posicion,
      tier,
      paso,
      recomendada: esRecomendada ? 1 : 0,
    });
  } catch {}

  programarRecordatorio(
    RECORDATORIO_TRAS_CLIC_MS,
    `¿Cómo te fue con ${oferta.titulo}?`,
    "Cuéntanos y te mostramos la mejor siguiente opción para tu perfil.",
  );

  const datosOferta = { titulo: oferta.titulo, clics: increment(1), ultimoClicAt: serverTimestamp() };
  if (primera) datosOferta.primerClicAt = serverTimestamp();
  guardar({
    ofertas: { [oferta.clave]: datosOferta },
    ultimaOferta: oferta.clave,
    ultimoClicAt: serverTimestamp(),
    ...(primera ? { ultimoPrimerClicAt: serverTimestamp() } : {}),
    tier,
    clicked_offer: true,
    offer_clicks: increment(1),
  });

  const id = await docId();
  return urlConSubs(oferta.url, { sub1: FUENTE, sub2: id, sub3: tier, sub4: String(paso) });
}

/** Contestó "¿Cómo te fue?". Rechazado / le faltó algo → la cascada pasa a la siguiente. */
export async function registrarResultado(oferta, resultado, requisito, p) {
  await cambiarEstado((e) => ({
    ...e,
    resultados: { ...e.resultados, [oferta.clave]: resultado },
    ultimoResultado: resultado,
    pendiente: e.pendiente === oferta.clave ? "" : e.pendiente,
  }));

  // No tiene CLABE → perfil "solo tarjeta": se esconden las ofertas que la exigen
  const req = await getSolicitud();
  if (resultado === RESULTADO.FALTA_REQUISITO && requisito === "clabe" && req) {
    await AsyncStorage.setItem(K.SOLICITUD, JSON.stringify({ ...req, cuenta: CUENTA[1] }));
  }

  try {
    logEvent("offer_result", { oferta_id: oferta.clave, resultado, requisito: requisito || "", tier: p ? p.tier : "X" });
  } catch {}

  const nombre = (await getDatosVisibles()).nombre;
  if (resultado === RESULTADO.APROBADO) {
    cancelarRecordatorio();
  } else if (resultado === RESULTADO.DESPUES) {
    programarRecordatorio(
      RECORDATORIO_DESPUES_MS,
      `Termina tu solicitud con ${oferta.titulo}`,
      "Tu solicitud te está esperando. ¡Solo te faltan unos minutos!",
    );
  } else {
    programarRecordatorio(
      RECORDATORIO_OTRA_OPCION_MS,
      nombre ? `${nombre}, encontramos otra opción para ti` : "Encontramos otra opción para ti",
      "Hay otra opción compatible con tu perfil. Entra a verla.",
    );
  }

  guardar({
    ofertas: { [oferta.clave]: { resultado, requisito: requisito || "", resultadoAt: serverTimestamp() } },
    ultimoResultado: resultado,
  });
}

/** "No la abrí" → ya no se pregunta "¿Cómo te fue?" ni se manda el recordatorio de 2 h. */
export async function limpiarPendiente() {
  await cambiarEstado((e) => ({ ...e, pendiente: "" }));
  cancelarRecordatorio();
}
