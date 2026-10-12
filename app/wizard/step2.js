import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { logEvent } from "../../src/analytics";
import { MONTOS } from "../../src/router/config";
import { GrupoOpciones, PasoLayout } from "../../src/wizard/ui";
import { useWizard } from "../../src/wizard/WizardProvider";

// Paso 2 — Monto deseado (mismos rangos que Android).
export default function Step2() {
  const router = useRouter();
  const { data, update } = useWizard();
  const [monto, setMonto] = useState(data.montoDeseado || "");
  const [error, setError] = useState(null);

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_step2"); } catch {} }, []);

  const onContinuar = () => {
    if (!monto) {
      setError("Selecciona un monto");
      return;
    }
    update({ montoDeseado: monto });
    logEvent("form_step", { paso: 3 });
    router.push("/wizard/step3");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PasoLayout
        paso={2}
        titulo="¿Cuánto dinero necesitas?"
        subtitulo="Selecciona el monto que deseas solicitar"
        onBack={() => router.back()}
        onContinuar={onContinuar}
        nota="Sin costo. Sin compromiso. Resultado en minutos."
      >
        <GrupoOpciones
          opciones={MONTOS}
          seleccion={monto}
          onSelect={(v) => { setMonto(v); setError(null); }}
          error={error}
        />
      </PasoLayout>
    </>
  );
}
