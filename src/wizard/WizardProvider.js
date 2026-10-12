import { createContext, useContext, useState } from "react";

// Respuestas del formulario (igual que Android MX 1.4). Se quedan en el teléfono:
// a Firestore solo sube el tier y el perfil (ver src/user/userStore.js).
const VACIO = {
  // Paso 1
  nombre: "",
  apellidos: "",
  // Paso 2
  montoDeseado: "",
  // Paso 3
  ine: "",
  cuenta: "",
  // Paso 4
  situacionLaboral: "",
  // Paso 5
  ingresosMensuales: "",
  prestamosActivos: "",
};

const WizardContext = createContext(null);

export function WizardProvider({ children }) {
  const [data, setData] = useState(VACIO);

  const update = (patch) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const reset = () => setData(VACIO);

  return (
    <WizardContext.Provider value={{ data, update, reset }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard debe usarse dentro de WizardProvider");
  return ctx;
}
