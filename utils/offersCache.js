// Ofertas desde Firestore (offers/all, campo "offers"), las mismas que se editan en el panel iOS.
// Solo México. Cada oferta trae los campos del router (lmOfferId, tipo CPS/CPL, requiereClabe,
// prioridadA..D); ver src/router/router.js.
import { doc, getDoc } from "firebase/firestore";
import { ofertasActivas } from "../src/router/router";

let _offers = [];
let _loaded = false;

export async function loadOffers(db) {
  try {
    const snap = await getDoc(doc(db, "offers", "all"));
    _offers = snap.exists() ? ofertasActivas(snap.data().offers) : [];
    _loaded = true;
  } catch {
    // Sin red: se queda con lo último que tenía
  }
  return _offers;
}

export function getOffers() {
  return _offers;
}

export function offersStale() {
  return !_loaded || _offers.length === 0;
}
