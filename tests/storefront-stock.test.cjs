const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise inventory boundaries without creating orders or touching live data.
let products = [{ id: 'p', stock: 5, min_order_qty: 1, max_order_qty: 4 }];
let variants = [{ id: 'v', product_id: 'p', stock: 2 }];
let failed = false;
const filters = [];
const supabase = { from(table) {
  const query = {
    select() { return query; },
    eq(key, value) { filters.push([table, key, value]); return query; },
    in() { return Promise.resolve({ data: table === 'products' ? products : variants, error: failed ? new Error('Offline') : null }); },
  };
  return query;
} };
const moduleExports = {};
const compiled = ts.transpileModule(fs.readFileSync('lib/cart.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
vm.runInNewContext(compiled, { exports: moduleExports, require: (name) => name === './supabase/client' ? { supabase } : { trackMarketingEvent() {} }, Map, Set, Promise, Number, Error });
const check = moduleExports.isCartAvailable;
const item = (quantity, extra = {}) => ({ product_id: 'p', quantity, ...extra });

(async () => {
  assert.equal(await check([item(4)], 'IN'), true);
  assert.equal(await check([item(5)], 'IN'), false, 'Maximum order quantity');
  assert.equal(await check([item(3), item(2, { bundle_id: 'b' })], 'IN'), false, 'Aggregate quantities across cart rows');
  assert.equal(await check([item(2, { variant_id: 'v' })], 'IN'), true);
  assert.equal(await check([item(3, { variant_id: 'v' })], 'IN'), false, 'Variant inventory');
  assert.equal(await check([item(1, { variant_id: 'missing' })], 'IN'), false, 'Removed variant');
  assert.equal(await check([item(1.5)], 'IN'), false, 'Fractional quantity');
  assert.equal(await check([item(-1)], 'IN'), false, 'Negative quantity');
  assert.equal(await check([], 'IN'), false, 'Empty cart');
  products = [];
  assert.equal(await check([item(1)], 'IN'), false, 'Inactive or wrong-country product');
  products = [{ id: 'p', stock: 0 }];
  assert.equal(await check([item(1)], 'IN'), false, 'Sold out');
  failed = true;
  await assert.rejects(check([item(1)], 'IN'), /Inventory check failed/);
  assert(filters.some(([table, key, value]) => table === 'products' && key === 'country_code' && value === 'IN'));
  console.log('Storefront inventory boundaries passed (12 cases).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
