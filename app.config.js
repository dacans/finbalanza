// ─── Config dinámica de Expo ───────────────────────────────────────────────
// Convertido desde app.json para poder leer variables de entorno (.env).
// Expo carga automáticamente los archivos .env y los expone en process.env.
// Mensaje de permiso ATT (App Tracking Transparency) en español, reutilizado
// tanto en el infoPlist como en el plugin de expo-tracking-transparency.
const ATT_MESSAGE =
  'Usamos tu identificador para medir la efectividad de nuestras campañas y mejorar tu experiencia. No vendemos tus datos.';

export default {
  expo: {
    name: 'FinBalanza',
    slug: 'finbalanza',
    version: '1.6.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'finbalanza',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.dacan.finbalanza',
      buildNumber: '8',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Permiso de seguimiento (ATT) requerido por AppsFlyer en iOS
        NSUserTrackingUsageDescription: ATT_MESSAGE,
        SKAdNetworkItems: [
          { SKAdNetworkIdentifier: 'v9wttpbfk9.skadnetwork' },
          { SKAdNetworkIdentifier: 'n38lu8286q.skadnetwork' },
        ],
      },
    },
    android: {
      package: 'com.dacan.finbalanza',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['android.permission.INTERNET'],
    },
    web: {
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#4A43D7',
          dark: {
            backgroundColor: '#4A43D7',
          },
        },
      ],
      [
        'react-native-google-mobile-ads/app.plugin',
        {
          iosAppId: 'ca-app-pub-3363125992029927~5790365376',
        },
      ],
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            buildReactNativeFromSource: true,
            extraBuildProperties: {
              CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES: 'YES',
            },
          },
        },
      ],
      [
        'react-native-fbsdk-next',
        {
          appID: '1392210272341084',
          clientToken: 'e9c736c8579aaa325577a4b5367eb869',
          displayName: 'finbalanza',
          isAutoInitEnabled: false,
          autoLogAppEventsEnabled: false,
          advertiserIDCollectionEnabled: false,
        },
      ],
      '@react-native-firebase/app',
      'expo-sqlite',
      // ── AppsFlyer ──
      [
        'react-native-appsflyer',
        {
          shouldUseStrictMode: false,
        },
      ],
      // ── App Tracking Transparency (mismo mensaje que infoPlist) ──
      [
        'expo-tracking-transparency',
        {
          userTrackingPermission: ATT_MESSAGE,
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: '3ed6bd34-cb8b-414f-a415-ee8afb0abf8e',
      },
      // Credenciales AppsFlyer leídas de variables de entorno (.env)
      afDevKey: process.env.AF_DEV_KEY,
      iosAppId: process.env.IOS_APP_ID,
    },
    owner: 'dacan',
  },
};
