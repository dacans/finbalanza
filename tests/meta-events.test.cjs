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
    AppEvents: { CompletedRegistration: 'fb_mobile_complete_registration', AdImpression: 'AdImpression' },
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

test('saveLead real: solo después de Firestore; no falla por Meta; no depende del siguiente guardado local', async () => {
  const source = fs.readFileSync(path.join(root, 'app/analyzing.js'), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let saveCode;
  traverse(ast, { VariableDeclarator(p) { if (p.node.id.name === 'saveLead') saveCode = generate(p.node.init).code; } });
  for (const mode of ['ok', 'firestoreFails', 'laterStorageFails', 'metaFails']) {
    const order = [];
    const h = harness({ failMeta: mode === 'metaFails' });
    const save = vm.runInNewContext(`(${saveCode})`, {
      savedRef: { current: false }, data: {}, firestore: {},
      collection: () => ({}), doc: () => ({}), serverTimestamp: () => 1,
      getCountry: () => 'MX', logEvent: async () => {}, setDoc: async () => {},
      AsyncStorage: {
        getItem: async () => null,
        setItem: async () => { if (mode === 'laterStorageFails') throw Error('disk'); },
        multiSet: async () => {},
      },
      addDoc: async () => { if (mode === 'firestoreFails') throw Error('network'); order.push('saved'); return { id: 'lead-1' }; },
      logCompleteRegistration(id) { order.push('meta'); h.api.logCompleteRegistration(id); },
    });
    await save(); await save();
    assert.deepEqual(order, mode === 'firestoreFails' ? [] : ['saved', 'meta']);
    assert.equal(h.events.length, ['firestoreFails', 'metaFails'].includes(mode) ? 0 : 1);
  }
});
