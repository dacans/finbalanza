import AsyncStorage from "@react-native-async-storage/async-storage";

export const COUNTRY_CONFIG = {
  MX: {
    symbol: "$",
    code: "MXN",
    locale: "es-MX",
    phonePrefix: "+52",
    phoneLength: 10,
    phonePlaceholder: "10 dígitos",
    amounts: [1000, 2000, 5000, 8000, 10000, 15000, 20000],
    placeholder: "Ej: 5,000",
    format: (n) => `$${n.toLocaleString("es-MX")} MXN`,
    rent: "renta",
    car: "coche",
    bureau: "buró de crédito",
    incomeOptions: ["Menos de $5,000", "$5k–$15k", "$15k–$30k", "Más de $30,000 MXN"],
  },
  CL: {
    symbol: "$",
    code: "CLP",
    locale: "es-CL",
    phonePrefix: "+56",
    phoneLength: 9,
    phonePlaceholder: "9 dígitos",
    amounts: [100000, 200000, 500000, 1000000, 2000000, 3000000],
    placeholder: "Ej: 500.000",
    format: (n) => `$${n.toLocaleString("es-CL")} CLP`,
    rent: "arriendo",
    car: "auto",
    bureau: "DICOM",
    incomeOptions: ["Menos de $300.000", "$300k–$800k", "$800k–$1.5M", "Más de $1.500.000 CLP"],
  },
  PE: {
    symbol: "S/",
    code: "PEN",
    locale: "es-PE",
    phonePrefix: "+51",
    phoneLength: 9,
    phonePlaceholder: "9 dígitos",
    amounts: [500, 1000, 2000, 5000, 8000, 10000],
    placeholder: "Ej: 2,000",
    format: (n) => `S/ ${n.toLocaleString("es-PE")} PEN`,
    rent: "alquiler",
    car: "auto",
    bureau: "Infocorp",
    incomeOptions: ["Menos de S/1,000", "S/1k–S/3k", "S/3k–S/6k", "Más de S/6,000 PEN"],
  },
};

let _country = "MX";

export async function loadCountry() {
  const stored = await AsyncStorage.getItem("user_country");
  if (stored) _country = stored;
}

export function getCountry() {
  return _country;
}

export function setCountry(code) {
  if (COUNTRY_CONFIG[code]) _country = code;
}

export function getConfig() {
  return COUNTRY_CONFIG[_country] ?? COUNTRY_CONFIG["MX"];
}