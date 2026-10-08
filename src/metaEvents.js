import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppEventsLogger, Settings } from "react-native-fbsdk-next";

const FIRST_AD_KEY = "@finbalanza/meta/first-paid-impression/v1";
let initialized = false;
let firstAdClaimed = false;
const registeredLeads = new Set();

function warn(message) {
  if (__DEV__) console.warn(`[Meta] ${message}`);
}

export function initializeMeta() {
  if (initialized) return;
  try {
    Settings.initializeSDK();
    initialized = true;
  } catch {
    warn("No se pudo inicializar el SDK.");
  }
}

export async function syncMetaTrackingPermission(status) {
  const granted = status === "granted";
  try {
    Settings.setAdvertiserIDCollectionEnabled(granted);
    // FBSDK 18 usa ATT directamente en iOS 17+; conserva compatibilidad anterior.
    await Settings.setAdvertiserTrackingEnabled(granted);
  } catch {
    warn("No se pudo sincronizar ATT.");
  }
}

function send(name, ...args) {
  try {
    initializeMeta();
    AppEventsLogger.logEvent(name, ...args);
  } catch {
    // La analítica nunca interrumpe formularios, anuncios o navegación.
    warn("No se pudo registrar el evento.");
  }
}

// Llamar exclusivamente después de que addDoc confirme el guardado.
// El ID se usa solo para deduplicar en memoria; no se envía a Meta.
export function logCompleteRegistration(leadId) {
  if (!leadId || registeredLeads.has(leadId)) return;
  registeredLeads.add(leadId);
  send(AppEventsLogger.AppEvents.CompletedRegistration);
}

async function logFirstAdImpression(params) {
  // Reserva síncrona: dos placements concurrentes no pueden ganar a la vez.
  if (firstAdClaimed) return;
  firstAdClaimed = true;
  try {
    if (await AsyncStorage.getItem(FIRST_AD_KEY)) return;
    // Persistir ANTES del envío evita repetirlo al reiniciar. Si se cierra la
    // app entre ambos pasos puede perderse este evento; no se reenvía a ciegas.
    await AsyncStorage.setItem(FIRST_AD_KEY, "1");
    // Sin valueToSum: no sumar dos veces el ingreso de la primera impresión.
    send("FirstAdImpression", params);
  } catch {
    // Si no podemos verificar/persistir la marca, omitir solo el evento único.
    warn("FirstAdImpression omitido: almacenamiento local no disponible.");
  }
}

export function normalizePaidEvent(event) {
  // RN Google Mobile Ads 16.0.1 YA entrega unidades monetarias, tanto en iOS
  // (GADAdValue.value) como Android (el puente convierte valueMicros * 1e-6).
  if (!event || typeof event.value !== "number" ||
      !Number.isFinite(event.value) || event.value < 0) return null;
  // No inventar tipos de cambio ni etiquetar otras monedas como dólares.
  if (event.currency !== "USD") {
    warn("Ingreso omitido: AdMob no devolvió USD.");
    return null;
  }
  return { value: event.value, currency: event.currency, precision: event.precision };
}

export function createPaidImpressionTracker(format, placement) {
  let sentForLoad = false;
  return {
    onAdLoaded() { sentForLoad = false; },
    onPaid(event) {
      if (sentForLoad) return;
      const revenue = normalizePaidEvent(event);
      if (!revenue) return;
      sentForLoad = true;
      const params = {
        [AppEventsLogger.AppEventParams.Currency]: revenue.currency,
        [AppEventsLogger.AppEventParams.AddType]: format,
        ad_placement: placement,
        ad_platform: "AdMob",
      };
      if (Number.isFinite(revenue.precision)) params.revenue_precision = revenue.precision;
      // Única fuente: PAID/onPaid. Nunca LOADED, OPENED ni cálculos por eCPM.
      send(AppEventsLogger.AppEvents.AdImpression, revenue.value, params);
      void logFirstAdImpression(params);
    },
  };
}
