import analytics from "@react-native-firebase/analytics";

// La analítica nunca interrumpe el flujo: si falla, se ignora.
export function logEvent(name, params = {}) {
  try {
    return analytics().logEvent(name, params).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}
