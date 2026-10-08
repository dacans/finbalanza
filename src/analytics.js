import analytics from "@react-native-firebase/analytics";

export function logEvent(name, params = {}) {
  return analytics().logEvent(name, params);
}