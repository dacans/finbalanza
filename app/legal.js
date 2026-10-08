import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { COLORS } from "../constants/theme";

export default function Legal() {
  const { url, title } = useLocalSearchParams();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 60 }} />
      </View>
      <WebView source={{ uri: url }} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  backText: { fontSize: 15, color: COLORS.accent, fontWeight: "700", width: 60 },
  headerTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary, flex: 1, textAlign: "center" },
});
