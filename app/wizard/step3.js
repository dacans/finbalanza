import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { logEvent } from "../../src/analytics";
import { CUENTA, INE } from "../../src/router/config";
import { GrupoOpciones, PasoLayout } from "../../src/wizard/ui";
import { useWizard } from "../../src/wizard/WizardProvider";

// Paso 3 — Documentos (router): sin INE vigente o sin cuenta un CPS rechaza seguro.
export default function Step3() {
  const router = useRouter();
  const { data, update } = useWizard();
  const [ine, setIne] = useState(data.ine || "");
  const [cuenta, setCuenta] = useState(data.cuenta || "");
  const [errores, setErrores] = useState({});

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_step3"); } catch {} }, []);

  const onContinuar = () => {
    const e = {};
    if (!ine) e.ine = "Selecciona una opción";
    if (!cuenta) e.cuenta = "Selecciona una opción";
    setErrores(e);
    if (Object.keys(e).length) return;
    update({ ine, cuenta });
    logEvent("form_step", { paso: 4 });
    router.push("/wizard/step4");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PasoLayout
        paso={3}
        titulo="Tus documentos"
        subtitulo="Con esto te mostramos solo las opciones que sí pueden aprobarte"
        onBack={() => router.back()}
        onContinuar={onContinuar}
      >
        <GrupoOpciones
          titulo="¿Tienes INE vigente?"
          opciones={INE}
          seleccion={ine}
          onSelect={(v) => { setIne(v); setErrores((p) => ({ ...p, ine: null })); }}
          error={errores.ine}
        />
        <GrupoOpciones
          titulo="¿Dónde quieres recibir el dinero?"
          opciones={CUENTA}
          seleccion={cuenta}
          onSelect={(v) => { setCuenta(v); setErrores((p) => ({ ...p, cuenta: null })); }}
          error={errores.cuenta}
        />
      </PasoLayout>
    </>
  );
}
