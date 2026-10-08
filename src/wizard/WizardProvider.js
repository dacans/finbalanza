import { createContext, useContext, useState } from "react";

const WizardContext = createContext(null);

export function WizardProvider({ children }) {
  const [data, setData] = useState({
    // Step 1
    loan_amount: 5000,
    // Step 2
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    // Step 3
    employment_status: "",
    monthly_income: "",
  });

  const update = (patch) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const reset = () => {
    setData({
      loan_amount: 5000,
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      employment_status: "",
      monthly_income: "",
    });
  };

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