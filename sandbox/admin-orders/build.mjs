import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(here, 'dist');
await mkdir(out, { recursive: true });
const result = await build({
  absWorkingDir: root, entryPoints: [path.join(here, 'entry.tsx')], outfile: path.join(out, 'app.js'),
  bundle: true, minify: true, sourcemap: false, target: ['es2022'], jsx: 'automatic', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'sandbox-data-only', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: path.join(here, 'client.ts') }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(here, 'navigation.ts') }));
  } }],
});
const inputs = Object.keys(result.metafile.inputs);
if (!inputs.includes('app/admin/orders/page.tsx') || inputs.includes('lib/supabase/client.ts'))
  throw Error('Expected original AdminOrdersPage with Sandbox data replacement');
execFileSync(path.join(root, 'node_modules/.bin/tailwindcss'), ['-c', 'tailwind.config.ts', '-i', 'app/globals.css', '-o', path.join(out, 'style.css'), '--minify', '--content', './app/admin/orders/page.tsx,./components/admin/**/*.tsx,./components/site/toast-provider.tsx,./sandbox/admin-orders/entry.tsx'], { cwd: root, stdio: 'inherit' });
await writeFile(path.join(out, 'sandbox.css'), 'body{padding-top:0!important}');
const js = await readFile(path.join(out, 'app.js'), 'utf8');
if (/ufxsthshyebahkwbmioe|api\.cashfree\.com|service_role|STEP22_WRITER_DATABASE_URL/.test(js))
  throw Error('Forbidden Production or server-credential reference in browser bundle');
const sourceHash = createHash('sha256').update(await readFile(path.join(root, 'app/admin/orders/page.tsx'))).digest('hex');
await writeFile(path.join(out, 'index.html'), '<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>GAZI SEED · Real Admin Orders Sandbox</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/sandbox.css"><script defer src="https://sdk.cashfree.com/js/v3/cashfree.js"></script><script defer src="/app.js"></script></head><body><div id="root"></div></body></html>');
const csp = "default-src 'none'; script-src 'self' https://sdk.cashfree.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src https://qqehtphbpypcmxliaiqd.supabase.co https://*.cashfree.com; frame-src 'self' https://*.cashfree.com; form-action 'self' https://sandbox.cashfree.com https://payments-test.cashfree.com https://sdk.cashfree.com; base-uri 'none'; frame-ancestors 'none'";
await writeFile(path.join(out, 'vercel.json'), JSON.stringify({version:2,builds:[{src:'index.html',use:'@vercel/static'},{src:'app.js',use:'@vercel/static'},{src:'style.css',use:'@vercel/static'},{src:'sandbox.css',use:'@vercel/static'}],headers:[{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:csp},{key:'Cache-Control',value:'no-store'},{key:'X-Robots-Tag',value:'noindex,nofollow'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'}]}]}, null, 2));
await writeFile(path.join(out, 'build-proof.json'), JSON.stringify({originalComponent:'app/admin/orders/page.tsx',sha256:sourceHash,productionClientIncluded:false,inputs},null,2));
console.log('Built original AdminOrdersPage with Sandbox-only data adapter. Source SHA256:',sourceHash);
