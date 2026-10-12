import * as Clarity from '@microsoft/react-native-clarity';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { logEvent } from "../../src/analytics";
import { INGRESOS, PRESTAMOS_ACTIVOS } from "../../src/router/config";
import { GrupoOpciones, PasoLayout } from "../../src/wizard/ui";
import { useWizard } from "../../src/wizard/WizardProvider";

// Paso 5 — Ingresos + préstamos activos (router). Al continuar se envía la solicitud.
export default function Step5() {
  const router = useRouter();
  const { data, update } = useWizard();
  const [ingreso, setIngreso] = useState(data.ingresosMensuales || "");
  const [prestamos, setPrestamos] = useState(data.prestamosActivos || "");
  const [errores, setErrores] = useState({});

  useEffect(() => { try { Clarity.setCustomTag("screen", "wizard_step5"); } catch {} }, []);

  const onContinuar = () => {
    const e = {};
    if (!ingreso) e.ingreso = "Selecciona tu rango de ingresos";
    if (!prestamos) e.prestamos = "Selecciona una opción";
    setErrores(e);
    if (Object.keys(e).length) return;
    update({ ingresosMensuales: ingreso, prestamosActivos: prestamos });
    logEvent("form_step", { paso: 6 });
    router.push("/analyzing");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PasoLayout
        paso={5}
        titulo="Ingresos y préstamos"
        subtitulo="Último paso"
        onBack={() => router.back()}
        onContinuar={onContinuar}
        boton="Analizar mi perfil →"
        nota="Nadie queda excluido. Tenemos opciones para todos los perfiles."
      >
        <GrupoOpciones
          titulo="¿Cuánto ganas al mes?"
          opciones={INGRESOS}
          seleccion={ingreso}
          onSelect={(v) => { setIngreso(v); setErrores((p) => ({ ...p, ingreso: null })); }}
          error={errores.ingreso}
        />
        <GrupoOpciones
          titulo="¿Cuántos préstamos de apps tienes activos?"
          opciones={PRESTAMOS_ACTIVOS}
          seleccion={prestamos}
          onSelect={(v) => { setPrestamos(v); setErrores((p) => ({ ...p, prestamos: null })); }}
          error={errores.prestamos}
          columnas={2}
        />
      </PasoLayout>
    </>
  );
}
