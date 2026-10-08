// Ad unit IDs para iOS — FinBalanza
// El App ID va en app.json (plugin react-native-google-mobile-ads → iosAppId),
// compilado en Info.plist; NO se selecciona por __DEV__.

// IDs de TEST oficiales de Google (usados en desarrollo / simulador)
const TEST_IDS = {
  banner:       "ca-app-pub-3940256099942544/2934735716",
  interstitial: "ca-app-pub-3940256099942544/4411468910",
  native:       "ca-app-pub-3940256099942544/3986624511",
};

// IDs REALES de producción (FinBalanza iOS)
const PROD_IDS = {
  banner:       "ca-app-pub-3363125992029927/7446531741",
  interstitial: "ca-app-pub-3363125992029927/8224957021",
  native:       "ca-app-pub-3363125992029927/6911875351",
};

// En __DEV__ usa test IDs; en producción usa los reales
const adIDs = __DEV__ ? TEST_IDS : PROD_IDS;

export const AD_UNITS = {
  banner:       adIDs.banner,
  interstitial: adIDs.interstitial,
  native:       adIDs.native,
};
