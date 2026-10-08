import { useRef } from "react";
import { AdEventType } from "react-native-google-mobile-ads";
import { createPaidImpressionTracker } from "./metaEvents";

const trackedInterstitials = new WeakSet();

// Los interstitials existentes son singletons de módulo. Estos dos listeners
// tienen la misma vida que el anuncio, incluso si PAID llega al cambiar de ruta.
// No se registran por render/montaje y nunca cargan ni muestran anuncios.
export function trackInterstitialRevenue(ad, placement) {
  if (trackedInterstitials.has(ad)) return;
  trackedInterstitials.add(ad);
  const tracker = createPaidImpressionTracker("interstitial", placement);
  ad.addAdEventListener(AdEventType.LOADED, tracker.onAdLoaded);
  ad.addAdEventListener(AdEventType.PAID, tracker.onPaid);
}

export function useBannerRevenue(placement) {
  const tracker = useRef(null);
  if (!tracker.current) {
    tracker.current = createPaidImpressionTracker("banner", placement);
  }
  // onAdLoaded abre un nuevo ciclo también en cada auto-refresh del banner.
  return tracker.current;
}
