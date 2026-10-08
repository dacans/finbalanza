import { doc, getDoc } from "firebase/firestore";
import { getCountry } from "./countryConfig";

let _offers = [];
let _loadedForCountry = null;

export async function loadOffers(db) {
  try {
    const snap = await getDoc(doc(db, "offers", "all"));
    if (!snap.exists()) return;
    const country = getCountry();
    _offers = (snap.data().offers ?? [])
      .filter((o) => o.activa === true && o.country === country)
      .sort((a, b) => a.orden - b.orden);
    _loadedForCountry = country;
  } catch {
    _offers = [];
    _loadedForCountry = null;
  }
}

export function getOffers() {
  return _offers;
}

export function offersStale() {
  return _offers.length === 0 || _loadedForCountry !== getCountry();
}