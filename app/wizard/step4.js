import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { logEvent } from "../../src/analytics";
import { SITUACIONES_LABORALES } from "../../src/router/config";
import { GrupoOpciones, PasoLayout } from "../../src/wizard/ui";
import { useWizard } from "../../src/wizard/WizardProvider";

// Paso 4 — Situación laboral (mismas 7 opciones que Android).
export default function Step4() {
  const router = useRouter();
  const { data, update } = useWizard();
  const [situacion, setSituacion] = useState(data.situacionLaboral || "");
  const [error, setError] = useState(null);

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_step4"); } catch {} }, []);

  const onContinuar = () => {
    if (!situacion) {
      setError("Selecciona tu situación laboral");
      return;
    }
    update({ situacionLaboral: situacion });
    logEvent("form_step", { paso: 5 });
    router.push("/wizard/step5");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PasoLayout
        paso={4}
        titulo="Situación laboral"
        subtitulo="Esta información nos ayuda a encontrar las mejores opciones para ti"
        onBack={() => router.back()}
        onContinuar={onContinuar}
      >
        <GrupoOpciones
          titulo="¿Cuál es tu situación laboral?"
          opciones={SITUACIONES_LABORALES}
          seleccion={situacion}
          onSelect={(v) => { setSituacion(v); setError(null); }}
          error={error}
        />
      </PasoLayout>
    </>
  );
}
