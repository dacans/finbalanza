// ─── Router de ofertas (igual que Android MX 1.4) ───────────────────────────
// Con las respuestas del formulario decide qué ofertas ve cada usuario y en qué orden.
//
//  Tier D → INE vencida / sin INE, o sin cuenta: un CPS lo rechaza seguro → solo CPL
//  Tier C → 3+ préstamos activos, desempleado, o pide más de lo que da un CPS → CPL
//  Tier B → documentos OK pero ingreso irregular o 2 préstamos activos
//  Tier A → documentos OK + ingreso regular + 0–1 préstamos activos → el mejor CPS primero
//
// El ORDEN de cada tier no vive aquí: cada oferta trae prioridadA..prioridadD en Firestore
// (offers/all, 0 = no se muestra en ese tier). Se cambia desde el panel sin subir versión.
//
// Este archivo es JS puro (sin React Native) para poder probarlo con node (tests/router.test.mjs).
import {
  CERRADOS,
  CUENTA,
  INE,
  MONTOS_ALTOS,
  PRESTAMOS_ACTIVOS,
  SITUACIONES_INGRESO_REGULAR,
  SITUACIONES_SIN_INGRESO,
} from "./config.js";

/**
 * Perfil del router a partir de las respuestas del formulario.
 * @param req { ine, cuenta, prestamosActivos, situacionLaboral, montoDeseado }
 * @returns null si es un usuario del formulario viejo (→ ofertas en el orden de siempre)
 */
export function perfil(req) {
  if (!req) return null;
  const ineIdx = INE.indexOf(req.ine);
  const cuentaIdx = CUENTA.indexOf(req.cuenta);
  const activos = PRESTAMOS_ACTIVOS.indexOf(req.prestamosActivos);
  if (ineIdx < 0 || cuentaIdx < 0 || activos < 0) return null;

  const ingreso = SITUACIONES_INGRESO_REGULAR.includes(req.situacionLaboral)
    ? "regular"
    : SITUACIONES_SIN_INGRESO.includes(req.situacionLaboral)
      ? "sin"
      : "irregular";
  const ineVigente = ineIdx === 0;

  let tier;
  if (!ineVigente || cuentaIdx === 2) tier = "D";
  else if (activos >= 3 || ingreso === "sin" || MONTOS_ALTOS.includes(req.montoDeseado)) tier = "C";
  else if (activos === 2 || ingreso === "irregular") tier = "B";
  else tier = "A";

  return {
    tier,
    /** Solo tarjeta de débito (sin CLABE) → se ocultan las ofertas que exigen CLABE. */
    soloTarjeta: cuentaIdx === 1,
    ineVigente,
    cuenta: ["clabe", "tarjeta", "nada"][cuentaIdx],
    activos,
    ingreso,
  };
}

/** Prioridad de la oferta en ese tier (0 = no se muestra en ese tier). */
export function prioridadPara(oferta, tier) {
  return Number(oferta?.[`prioridad${tier}`]) || 0;
}

export function esCps(oferta) {
  return String(oferta?.tipo || "").toUpperCase() === "CPS";
}

const floorMod = (a, n) => ((a % n) + n) % n;

function elegibles(activas, p, yaCliente, explorar, semilla) {
  // Donde ya es cliente el CPS/CPQL paga 0 → fuera
  const sinYaCliente = activas.filter((o) => !yaCliente.has(o.clave));
  const oTodas = (l) => (l.length ? l : activas);
  if (!p) return oTodas(sinYaCliente);

  const delTier = sinYaCliente
    .filter((o) => prioridadPara(o, p.tier) > 0)
    .filter((o) => !(p.soloTarjeta && o.requiereClabe))
    .map((o, i) => ({ o, i }))
    .sort((a, b) => prioridadPara(a.o, p.tier) - prioridadPara(b.o, p.tier) || a.i - b.i)
    .map((x) => x.o);
  // Config vieja (sin prioridades) o todo filtrado → como antes; nunca pantalla vacía
  if (!delTier.length) return oTodas(sinYaCliente);
  if (!explorar) return delTier;

  // Exploración: un CPS al azar (fijo por usuario) pasa al frente → así se aprende si otro
  // CPS convierte mejor en ese tier. Solo entre CPS: los CPL se quedan atrás.
  const cps = delTier.filter(esCps);
  if (cps.length < 2) return delTier;
  const elegida = cps[floorMod(Number(semilla) || 0, cps.length)];
  return [elegida, ...delTier.filter((o) => o.clave !== elegida.clave)];
}

/**
 * Lista final que ve el usuario. Lo que ya intentó (aprobado / rechazado / le faltó algo)
 * baja al final → la cascada.
 */
export function ordenar({ activas, perfil: p, yaCliente = [], explorar = false, semilla = 0, resultados = {} }) {
  const base = elegibles(activas || [], p, new Set(yaCliente), explorar, semilla);
  const cerrada = (o) => CERRADOS.includes(resultados[o.clave]);
  return [...base.filter((o) => !cerrada(o)), ...base.filter(cerrada)];
}

/** La que va arriba como "Compatible con tu perfil" (1ª no intentada). null si ya le aprobaron. */
export function recomendada(ordenadas, resultados = {}) {
  if (Object.values(resultados).includes("aprobado")) return null;
  return ordenadas.find((o) => !CERRADOS.includes(resultados[o.clave])) || null;
}

function slug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Oferta tal cual viene de Firestore (offers/all) → la forma que usa el router.
 * clave = offer_id de Leadsmatcher (campo lmOfferId, o el offer_id del link): es la misma clave con
 * la que llega el postback, así el panel cruza clics y conversiones por oferta.
 */
export function normalizarOferta(o, idx = 0) {
  const delLink = (String(o?.url || "").match(/[?&]offer_id=(\d+)/) || [])[1] || "";
  const clave = String(o?.lmOfferId ?? "").trim() || delLink || slug(o?.title) || `oferta_${idx}`;
  return {
    ...o,
    clave,
    titulo: o?.title || "",
    descripcion: o?.subtitle || "",
    tipo: String(o?.tipo || "").toUpperCase(),
    requiereClabe: o?.requiereClabe === true,
    prioridadA: Number(o?.prioridadA) || 0,
    prioridadB: Number(o?.prioridadB) || 0,
    prioridadC: Number(o?.prioridadC) || 0,
    prioridadD: Number(o?.prioridadD) || 0,
  };
}

/** Solo activas y de México (las viejas de CL/PE se ignoran), en el orden del panel. */
export function ofertasActivas(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((o) => o && o.activa === true && (!o.country || o.country === "MX"))
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (Number(a.o.orden) || 0) - (Number(b.o.orden) || 0) || a.i - b.i)
    .map(({ o, i }) => normalizarOferta(o, i));
}

/**
 * Link de la oferta con sub1..sub4: reemplaza los que ya traiga (ej. sub1=a) y conserva tal cual
 * el resto de parámetros y el fragmento (#...).
 */
export function urlConSubs(url, subs) {
  const raw = String(url || "");
  if (!raw) return raw;
  const hashIdx = raw.indexOf("#");
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
  const base = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const qIdx = base.indexOf("?");
  const path = qIdx >= 0 ? base.slice(0, qIdx) : base;
  const query = qIdx >= 0 ? base.slice(qIdx + 1) : "";
  const keys = Object.keys(subs);
  const conservar = query
    .split("&")
    .filter(Boolean)
    .filter((p) => !keys.includes(decodeURIComponent(p.split("=")[0])));
  const nuevos = keys
    .filter((k) => subs[k] !== undefined && subs[k] !== null && String(subs[k]) !== "")
    .map((k) => `${k}=${encodeURIComponent(String(subs[k]))}`);
  const qs = [...conservar, ...nuevos].join("&");
  return path + (qs ? "?" + qs : "") + hash;
}

/** "Juan Carlos" → "Juan" */
export function primerNombre(nombre) {
  return String(nombre || "").trim().split(/\s+/)[0] || "";
}
