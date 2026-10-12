// Pruebas del router (mismo comportamiento que Android MX 1.4). Correr: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { CUENTA, INE, MONTOS, PRESTAMOS_ACTIVOS } from "../src/router/config.js";
import { normalizarOferta, ofertasActivas, ordenar, perfil, recomendada, urlConSubs } from "../src/router/router.js";

const base = {
  ine: INE[0],
  cuenta: CUENTA[0],
  prestamosActivos: PRESTAMOS_ACTIVOS[0],
  situacionLaboral: "Contrato Indefinido",
  montoDeseado: MONTOS[1],
};

test("tier A: documentos OK + ingreso regular + 0-1 préstamos", () => {
  assert.equal(perfil(base).tier, "A");
  assert.equal(perfil({ ...base, prestamosActivos: "1" }).tier, "A");
  assert.equal(perfil({ ...base, situacionLaboral: "Jubilado/Pensionista" }).tier, "A");
});

test("tier B: ingreso irregular o 2 préstamos", () => {
  assert.equal(perfil({ ...base, situacionLaboral: "Trabajador independiente" }).tier, "B");
  assert.equal(perfil({ ...base, situacionLaboral: "Otro" }).tier, "B");
  assert.equal(perfil({ ...base, prestamosActivos: "2" }).tier, "B");
});

test("tier C: desempleado, 3+ préstamos o monto alto", () => {
  assert.equal(perfil({ ...base, situacionLaboral: "Desempleado" }).tier, "C");
  assert.equal(perfil({ ...base, prestamosActivos: "3 o más" }).tier, "C");
  assert.equal(perfil({ ...base, montoDeseado: "Más de $30,000" }).tier, "C");
});

test("tier D: sin INE vigente o sin cuenta (gana sobre todo lo demás)", () => {
  assert.equal(perfil({ ...base, ine: INE[1] }).tier, "D");
  assert.equal(perfil({ ...base, ine: INE[2] }).tier, "D");
  assert.equal(perfil({ ...base, cuenta: CUENTA[2], situacionLaboral: "Desempleado" }).tier, "D");
});

test("perfil: banderas y formulario viejo", () => {
  const p = perfil({ ...base, cuenta: CUENTA[1], prestamosActivos: "2", situacionLaboral: "Desempleado" });
  assert.deepEqual(p, { tier: "C", soloTarjeta: true, ineVigente: true, cuenta: "tarjeta", activos: 2, ingreso: "sin" });
  assert.equal(perfil({ montoDeseado: 5000 }), null); // usuario de la 1.6 → sin router
  assert.equal(perfil(null), null);
});

const of = (clave, extra = {}) => ({ clave, titulo: clave, tipo: "CPL", prioridadA: 0, prioridadB: 0, prioridadC: 0, prioridadD: 0, ...extra });
const lista = [
  of("crezu", { prioridadA: 9, prioridadB: 9, prioridadC: 1, prioridadD: 1 }),
  of("cozmo", { tipo: "CPS", requiereClabe: true, prioridadA: 2, prioridadB: 3 }),
  of("c365", { tipo: "CPS", prioridadA: 1, prioridadB: 2 }),
  of("finmart", { prioridadA: 3, prioridadB: 1, prioridadC: 2 }),
];
const claves = (l) => l.map((o) => o.clave);

test("ordena por la prioridad del tier y oculta las de prioridad 0", () => {
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: perfil(base) })), ["c365", "cozmo", "finmart", "crezu"]);
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: perfil({ ...base, situacionLaboral: "Desempleado" }) })), ["crezu", "finmart"]);
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: perfil({ ...base, ine: INE[2] }) })), ["crezu"]);
});

test("solo tarjeta oculta las que exigen CLABE", () => {
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: perfil({ ...base, cuenta: CUENTA[1] }) })), ["c365", "finmart", "crezu"]);
});

test("ya cliente fuera; si todo queda fuera, nunca pantalla vacía", () => {
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: perfil(base), yaCliente: ["c365"] })), ["cozmo", "finmart", "crezu"]);
  const dos = [of("a", { prioridadA: 1 }), of("b", { prioridadA: 2 })];
  assert.deepEqual(claves(ordenar({ activas: dos, perfil: perfil(base), yaCliente: ["a", "b"] })), ["a", "b"]);
});

test("sin prioridades en el panel (config vieja) o sin perfil → orden del panel", () => {
  const sinPrio = [of("x"), of("y"), of("z")];
  assert.deepEqual(claves(ordenar({ activas: sinPrio, perfil: perfil(base) })), ["x", "y", "z"]);
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: null, yaCliente: ["crezu"] })), ["cozmo", "c365", "finmart"]);
});

test("cascada: lo ya intentado baja al final y la recomendada es la 1ª abierta", () => {
  const r = { c365: "rechazado", cozmo: "despues" };
  const l = ordenar({ activas: lista, perfil: perfil(base), resultados: r });
  assert.deepEqual(claves(l), ["cozmo", "finmart", "crezu", "c365"]);
  assert.equal(recomendada(l, r).clave, "cozmo");
  assert.equal(recomendada(l, { finmart: "aprobado" }), null);
});

test("exploración: un CPS fijo por usuario pasa al frente", () => {
  const p = perfil(base);
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: p, explorar: true, semilla: 1 })), ["cozmo", "c365", "finmart", "crezu"]);
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: p, explorar: true, semilla: 2 })), ["c365", "cozmo", "finmart", "crezu"]);
  assert.deepEqual(claves(ordenar({ activas: lista, perfil: p, explorar: true, semilla: -3 })), ["cozmo", "c365", "finmart", "crezu"]);
});

test("ofertas de Firestore: solo activas de MX, orden del panel, clave = offer_id", () => {
  const fs = [
    { title: "Crezu", url: "https://track.leadsmatcher.com/click?pid=3072&offer_id=49&sub1=a", activa: true, country: "MX", orden: 3 },
    { title: "Finmart", url: "https://x.com/?offer_id=1275", lmOfferId: "1275", activa: true, orden: 1, tipo: "cpl", prioridadA: "2" },
    { title: "Perú", url: "https://x.com/?offer_id=9", activa: true, country: "PE", orden: 0 },
    { title: "Pausada", url: "https://x.com/?offer_id=8", activa: false, country: "MX", orden: 0 },
    { title: "Sin Id Ñandú", url: "https://x.com/", activa: true, orden: 2 },
  ];
  const l = ofertasActivas(fs);
  assert.deepEqual(claves(l), ["1275", "sin_id_nandu", "49"]);
  assert.equal(l[0].tipo, "CPL");
  assert.equal(l[0].prioridadA, 2);
  assert.equal(normalizarOferta({ title: "", url: "" }, 4).clave, "oferta_4");
});

test("urlConSubs: reemplaza sub1..sub4, conserva el resto y el fragmento", () => {
  const subs = { sub1: "FinBalanza", sub2: "abc123", sub3: "A", sub4: "2" };
  assert.equal(
    urlConSubs("https://track.leadsmatcher.com/click?pid=3072&offer_id=642&sub1=a&sub2=a&sub3=a&l=1710944910", subs),
    "https://track.leadsmatcher.com/click?pid=3072&offer_id=642&l=1710944910&sub1=FinBalanza&sub2=abc123&sub3=A&sub4=2",
  );
  assert.equal(urlConSubs("https://cpa.example/offer", subs), "https://cpa.example/offer?sub1=FinBalanza&sub2=abc123&sub3=A&sub4=2");
  assert.equal(urlConSubs("https://cpa.example/p?x=a%2Fb&sub4=old#frag", { sub1: "F", sub4: "1" }), "https://cpa.example/p?x=a%2Fb&sub1=F&sub4=1#frag");
  assert.equal(urlConSubs("https://cpa.example/p?a=1", { sub1: "F", sub2: "" }), "https://cpa.example/p?a=1&sub1=F");
  assert.equal(urlConSubs("", subs), "");
});
