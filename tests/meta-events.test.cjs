const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));

// Ejecuta el módulo real con puentes nativos simulados. No envía datos a Meta.
function load(file, mocks) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const { code } = babel.transformSync(source, {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, __DEV__: false, console,
    require(name) { if (!(name in mocks)) throw Error(name); return mocks[name]; },
  });
  return exports;
}

function harness({ store = new Map(), failRead = false, failWrite = false, failMeta = false } = {}) {
  const events = [], settings = [];
  const storage = {
    async getItem(key) { if (failRead) throw Error('read'); return store.get(key) ?? null; },
    async setItem(key, value) { if (failWrite) throw Error('write'); store.set(key, value); },
  };
  const logger = {
    AppEvents: { CompletedRegistration: 'fb_mobile_complete_registration', SubmitApplication: 'fb_mobile_submit_application', AdImpression: 'AdImpression' },
    AppEventParams: { Currency: 'fb_currency', AddType: 'fb_ad_type' },
    logEvent(...args) { if (failMeta) throw Error('SDK'); events.push(args); },
  };
  const api = load('src/metaEvents.js', {
    '@react-native-async-storage/async-storage': storage,
    'react-native-fbsdk-next': { AppEventsLogger: logger, Settings: {
      initializeSDK() { settings.push(['init']); },
      setAdvertiserIDCollectionEnabled(v) { settings.push(['id', v]); },
      async setAdvertiserTrackingEnabled(v) { settings.push(['att', v]); },
    } },
  });
  return { api, events, settings, store };
}
const paid = { value: 0.001234, currency: 'USD', precision: 1 };
const ads = h => h.events.filter(e => e[0] === 'AdImpression');
const firsts = h => h.events.filter(e => e[0] === 'FirstAdImpression');

test('importe decimal exacto y parámetros; no divide por un millón ni suma revenue al evento único', async () => {
  const h = harness();
  h.api.createPaidImpressionTracker('banner', 'home').onPaid(paid);
  await tick();
  assert.equal(ads(h)[0][1], 0.001234);
  assert.equal(ads(h)[0][2].fb_currency, 'USD');
  assert.equal(ads(h)[0][2].fb_ad_type, 'banner');
  assert.equal(ads(h)[0][2].ad_placement, 'home');
  assert.equal(firsts(h).length, 1);
  assert.equal(typeof firsts(h)[0][1], 'object');
});

test('duplica callback pero no impresión; refresh legítimo con igual importe sí se registra', async () => {
  const h = harness();
  const t = h.api.createPaidImpressionTracker('banner', 'offers');
  t.onAdLoaded(); t.onPaid(paid); t.onPaid({ ...paid });
  t.onAdLoaded(); t.onPaid({ ...paid });
  await tick();
  assert.equal(ads(h).length, 2);
  assert.equal(firsts(h).length, 1);
});

test('cero válido se conserva; NaN, negativos, strings y monedas no USD no inventan ingresos', () => {
  const h = harness();
  for (const value of [NaN, Infinity, -1, '1', undefined]) {
    h.api.createPaidImpressionTracker('banner', 'home').onPaid({ ...paid, value });
  }
  h.api.createPaidImpressionTracker('banner', 'home').onPaid({ ...paid, currency: 'EUR' });
  assert.equal(ads(h).length, 0);
  h.api.createPaidImpressionTracker('banner', 'home').onPaid({ ...paid, value: 0 });
  assert.equal(ads(h)[0][1], 0);
});

test('20 callbacks concurrentes conservan 20 impresiones y una sola primera impresión', async () => {
  const h = harness();
  for (let i = 0; i < 20; i++) h.api.createPaidImpressionTracker('banner', 'home').onPaid(paid);
  await tick();
  assert.equal(ads(h).length, 20);
  assert.equal(firsts(h).length, 1);
  const restarted = harness({ store: h.store });
  restarted.api.createPaidImpressionTracker('interstitial', 'analyzing').onPaid(paid);
  await tick();
  assert.equal(ads(restarted).length, 1);
  assert.equal(firsts(restarted).length, 0);
});

for (const fault of ['failRead', 'failWrite']) test(`${fault}: almacenamiento fallido no bloquea AdImpression`, async () => {
  const h = harness({ [fault]: true });
  h.api.createPaidImpressionTracker('banner', 'waiting').onPaid(paid);
  await tick();
  assert.equal(ads(h).length, 1);
  assert.equal(firsts(h).length, 0);
});

test('fallos del SDK quedan aislados; registro repetido por ID no duplica ni envía ID', async () => {
  const h = harness();
  h.api.logCompleteRegistration('private-document-id');
  h.api.logCompleteRegistration('private-document-id');
  h.api.logCompleteRegistration('another-document');
  assert.equal(h.events.length, 2);
  assert.equal(h.events[0].length, 1);
  assert.ok(!JSON.stringify(h.events).includes('private-document'));
  const broken = harness({ failMeta: true });
  assert.doesNotThrow(() => broken.api.logCompleteRegistration('id'));
  assert.doesNotThrow(() => broken.api.createPaidImpressionTracker('banner', 'home').onPaid(paid));
  await tick();
});

test('ATT denegado/indeterminado restringe IDs y granted los habilita; init idempotente', async () => {
  const h = harness();
  h.api.initializeMeta(); h.api.initializeMeta();
  for (const status of ['denied', 'undetermined', 'granted', 'denied']) {
    await h.api.syncMetaTrackingPermission(status);
  }
  assert.deepEqual(h.settings, [['init'], ['id', false], ['att', false],
    ['id', false], ['att', false], ['id', true], ['att', true], ['id', false], ['att', false]]);
});

test('un único listener PAID por interstitial, incluso al registrar dos veces; recarga independiente', async () => {
  const h = harness();
  const adapter = load('src/adRevenue.js', {
    react: { useRef: () => ({ current: null }) },
    'react-native-google-mobile-ads': { AdEventType: { LOADED: 'loaded', PAID: 'paid' } },
    './metaEvents': h.api,
  });
  const listeners = new Map();
  const ad = { addAdEventListener(type, fn) {
    assert.ok(!listeners.has(type)); listeners.set(type, fn);
  } };
  adapter.trackInterstitialRevenue(ad, 'verification');
  adapter.trackInterstitialRevenue(ad, 'verification');
  assert.equal(listeners.size, 2);
  listeners.get('loaded')(); listeners.get('paid')(paid); listeners.get('paid')(paid);
  listeners.get('loaded')(); listeners.get('paid')(paid);
  await tick();
  assert.equal(ads(h).length, 2);
});

// Solicitud 1.7 (src/user/userStore.js): Meta solo después de que el lead quedó en Firestore,
// nunca rompe por Meta, y si no había red se reintenta al volver a abrir la app (sin duplicar).
function userStore({ firestoreFails = () => false, failMeta = false } = {}) {
  const store = new Map(), writes = [], order = [];
  const h = harness({ failMeta });
  const config = load('src/router/config.js', {});
  const routerMod = load('src/router/router.js', { './config.js': config });
  const storage = {
    async getItem(k) { return store.get(k) ?? null; },
    async setItem(k, v) { store.set(k, v); },
    async multiSet(pairs) { pairs.forEach(([k, v]) => store.set(k, v)); },
  };
  const api = load('src/user/userStore.js', {
    '@react-native-async-storage/async-storage': storage,
    'expo-constants': { expoConfig: { version: '1.7.0' } },
    'firebase/firestore': {
      doc: (_db, col, id) => ({ col, id }), increment: n => n, serverTimestamp: () => 'SERVER_TS',
      async setDoc(ref, data) { if (firestoreFails()) throw Error('network'); writes.push({ ref, data }); order.push('saved'); },
    },
    '../analytics': { logEvent() {} },
    '../config/remoteConfig': { getRemoteConfig: () => ({ unlockIntervalHours: 24, exploracionPct: 20 }) },
    '../firebase': { firestore: {} },
    '../metaEvents': {
      logCompleteRegistration(id) { order.push('meta'); h.api.logCompleteRegistration(id); },
      logSubmitApplication(t) { order.push('submit:' + t); h.api.logSubmitApplication(t); },
    },
    '../notifications/local': { programarDesbloqueo() { order.push('desbloqueo'); }, programarRecordatorio() {}, cancelarRecordatorio() {} },
    '../router/config': config,
    '../router/router': routerMod,
  });
  return { api, store, writes, order, h, config };
}
const solicitud = (c, extra = {}) => ({
  nombre: 'Ana', apellidos: '', montoDeseado: c.MONTOS[1], ine: c.INE[0], cuenta: c.CUENTA[0],
  situacionLaboral: 'Contrato Indefinido', ingresosMensuales: c.INGRESOS[1], prestamosActivos: c.PRESTAMOS_ACTIVOS[0], ...extra,
});

test('enviarSolicitud: Firestore primero, luego Meta (A/B manda SubmitApplication); sin respuestas crudas', async () => {
  const u = userStore();
  await u.api.enviarSolicitud(solicitud(u.config));
  assert.deepEqual(u.order, ['desbloqueo', 'saved', 'meta', 'submit:A']);
  assert.equal(u.h.events.length, 2);
  const d = u.writes[0].data;
  assert.equal(d.tier, 'A'); assert.equal(d.createdAt, 'SERVER_TS'); assert.equal(d.country, 'MX');
  for (const k of ['nombre', 'apellidos', 'montoDeseado', 'ingresosMensuales', 'situacionLaboral']) assert.ok(!(k in d), k);
  assert.equal(u.store.get('wizard_completed'), 'true');

  const c = userStore();
  await c.api.enviarSolicitud(solicitud(c.config, { situacionLaboral: 'Desempleado' }));
  assert.deepEqual(c.order, ['desbloqueo', 'saved', 'meta']); // tier C: sin SubmitApplication
});

test('enviarSolicitud: sin red no manda Meta; al reabrir reintenta 1 vez con la hora real', async () => {
  let offline = true;
  const u = userStore({ firestoreFails: () => offline });
  await u.api.enviarSolicitud(solicitud(u.config));
  assert.deepEqual(u.order, ['desbloqueo']);
  assert.equal(u.h.events.length, 0);
  assert.equal(u.store.get('wizard_completed'), 'true'); // el usuario sigue su flujo
  offline = false;
  await u.api.iniciarProduccion();
  const sol = u.writes.find(w => w.data.formVersion === 2);
  assert.ok(sol && typeof sol.data.createdAt.getTime === 'function');
  assert.equal(sol.data.createdAt.getTime(), Number(u.store.get('wizard_completed_at')));
  assert.equal(u.h.events.length, 2);
  await u.api.iniciarProduccion();
  assert.equal(u.writes.filter(w => w.data.formVersion === 2).length, 1);
  assert.equal(u.h.events.length, 2);
});

test('enviarSolicitud: si Meta falla no rompe y el lead queda guardado', async () => {
  const u = userStore({ failMeta: true });
  await u.api.enviarSolicitud(solicitud(u.config));
  assert.equal(u.writes.length, 1);
  assert.equal(u.store.get('solicitud_subida_v2'), '1');
  assert.equal(u.h.events.length, 0);
});
