// ─── Integración AppsFlyer (solo lógica de atribución, sin tocar negocio) ────
import appsFlyer from 'react-native-appsflyer';
import Constants from 'expo-constants';

// Lee credenciales desde extra (definidas en app.config.js vía .env)
const { afDevKey, iosAppId } = Constants.expoConfig?.extra ?? {};

let _initialized = false;

// Inicializa el SDK. Debe llamarse DESPUÉS de resolver el permiso ATT en iOS.
export function initAppsFlyer() {
  // Evita doble init y aborta si faltan credenciales
  if (_initialized) return;
  if (!afDevKey || !iosAppId) {
    if (__DEV__) console.warn('[AppsFlyer] Falta afDevKey o iosAppId en .env — init omitido');
    return;
  }

  // Listener de datos de conversión de instalación (orgánico vs campaña)
  appsFlyer.onInstallConversionData((res) => {
    if (__DEV__) console.log('[AppsFlyer] conversion data:', res);
  });

  appsFlyer.initSdk(
    {
      devKey: afDevKey,
      appId: iosAppId,                          // App ID de iOS (sin el prefijo "id")
      isDebug: __DEV__,                         // logs solo en desarrollo
      onInstallConversionDataListener: true,    // activa el listener de arriba
      timeToWaitForATTUserAuthorization: 10,    // espera al diálogo ATT (segundos)
    },
    (result) => {
      _initialized = true;
      if (__DEV__) console.log('[AppsFlyer] initSdk OK:', result);
    },
    (error) => {
      if (__DEV__) console.error('[AppsFlyer] initSdk error:', error);
    },
  );
}

// Dispara el evento de lead (registro completado) con el nombre de la oferta
// y el payout estimado en USD. Se usa al concretar un lead/registro.
export function logLead(offerName, payoutUsd) {
  appsFlyer.logEvent(
    'af_complete_registration',
    {
      af_registration_method: offerName,        // identifica la oferta/origen
      af_revenue: payoutUsd,                     // payout estimado
      af_currency: 'USD',
    },
    () => {},
    () => {},
  );
}
