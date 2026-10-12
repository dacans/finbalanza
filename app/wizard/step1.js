import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { COLORS } from "../../constants/theme";
import { logEvent } from "../../src/analytics";
import { PasoLayout, wizardStyles as w } from "../../src/wizard/ui";
import { useWizard } from "../../src/wizard/WizardProvider";

// Paso 1 — Datos personales (igual que Android). Se quedan solo en el teléfono: el nombre se usa
// para personalizar las notificaciones locales; nunca se sube a Firestore.
const MAX_NOMBRE = 40;
const MAX_APELLIDOS = 60;

export default function Step1() {
  const router = useRouter();
  const { data, update } = useWizard();
  const [nombre, setNombre] = useState(data.nombre || "");
  const [apellidos, setApellidos] = useState(data.apellidos || "");
  const [error, setError] = useState(null);

  useEffect(() => {
    try { Clarity.setCustomTag("screen", "wizard_step1"); } catch {}
    logEvent("form_start");
  }, []);

  const onContinuar = () => {
    if (nombre.trim().length < 2) {
      setError("Ingresa tu nombre");
      return;
    }
    update({ nombre: nombre.trim(), apellidos: apellidos.trim() });
    logEvent("form_step", { paso: 2 });
    router.push("/wizard/step2");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PasoLayout
        paso={1}
        titulo="¿Cómo te llamas?"
        subtitulo="Así personalizamos tu solicitud."
        onBack={() => router.replace("/wizard/intro")}
        onContinuar={onContinuar}
        nota="Sin costo. Sin compromiso. Resultado en minutos."
      >
        <View style={w.secureBox}>
          <Text>🔒</Text>
          <Text style={w.secureText}>Tus datos están protegidos</Text>
        </View>

        <View style={w.fieldWrap}>
          <Text style={w.label}>Nombre</Text>
          <TextInput
            style={[w.input, error && w.inputError]}
            placeholder="Tu nombre"
            placeholderTextColor={COLORS.textLight}
            value={nombre}
            maxLength={MAX_NOMBRE}
            onChangeText={(v) => { setNombre(v); setError(null); }}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
          />
          {error ? <Text style={w.errorText}>{error}</Text> : null}
        </View>

        <View style={w.fieldWrap}>
          <Text style={w.label}>Apellidos (opcional)</Text>
          <TextInput
            style={w.input}
            placeholder="Tus apellidos"
            placeholderTextColor={COLORS.textLight}
            value={apellidos}
            maxLength={MAX_APELLIDOS}
            onChangeText={setApellidos}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="done"
            onSubmitEditing={onContinuar}
          />
        </View>
      </PasoLayout>
    </>
  );
}
