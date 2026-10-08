const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

// Extrae y ejecuta la función real de la pantalla sin abrir URLs ni Firestore.
const ast = parser.parse(fs.readFileSync(path.join(__dirname, '../app/offers.js'), 'utf8'), {
  sourceType: 'module', plugins: ['jsx'],
});
let buildOfferUrl;
traverse(ast, { VariableDeclarator(p) {
  if (p.node.id.name === 'buildOfferUrl') {
    buildOfferUrl = vm.runInNewContext(`(${generate(p.node.init).code})`);
  }
} });

const fixtures = [
  ['agrega sub1 sin query', 'https://cpa.example/offer', 'lead/123',
    'https://cpa.example/offer?sub1=FinBalanza&sub2=lead%2F123'],
  ['conserva sub3, identificadores, escapes y fragmento',
    'https://cpa.example/path?l=77&sub1=iosnew&sub2=old&sub3=a%2Fb&click_id=xyz#section', 'lead/123',
    'https://cpa.example/path?l=77&sub1=FinBalanza&sub2=lead%2F123&sub3=a%2Fb&click_id=xyz#section'],
  ['iosnew en otros parámetros, dominio, ruta y fragmento permanece intacto',
    'https://iosnew.example/iosnew?sub3=iosnew&tracking=iosnew#iosnew', 'abc',
    'https://iosnew.example/iosnew?sub3=iosnew&tracking=iosnew&sub1=FinBalanza&sub2=abc#iosnew'],
  ['sin lead conserva la regla existente que omite sub2',
    'https://cpa.example/?sub1=iosnew&sub2=old&sub3=keep&campaign=9', null,
    'https://cpa.example/?sub1=FinBalanza&sub3=keep&campaign=9'],
  ['reemplaza sub1 existente con otro valor sin tocar parámetros repetidos',
    'https://cpa.example/?sub1=legacy&tag=a&tag=b&sub3=z', 'lead1',
    'https://cpa.example/?sub1=FinBalanza&tag=a&tag=b&sub3=z&sub2=lead1'],
];

for (const [name, input, leadId, expected] of fixtures) test(name, () => {
  const actual = buildOfferUrl(input, leadId);
  assert.equal(actual, expected);
  assert.equal(new URL(actual).searchParams.get('sub1'), 'FinBalanza');
});
