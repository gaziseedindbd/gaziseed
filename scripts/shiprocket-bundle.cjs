// Build the Deno bundle from the tested server sources; --check rejects drift.
const fs=require('node:fs'),path=require('node:path');
const source=path.join(__dirname,'../lib/shiprocket');
const target=path.join(__dirname,'../supabase/functions/india-shipping-booking/core');
fs.mkdirSync(target,{recursive:true});let failed=false;
for(const name of fs.readdirSync(source).filter(n=>n.endsWith('.ts'))){
 const text=fs.readFileSync(path.join(source,name),'utf8').replace(/(from\s+["']\.\/[^"']+)(["'])/g,'$1.ts$2');
 const file=path.join(target,name);
 if(process.argv.includes('--check')){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==text){console.error('Shipping bundle drift: '+name);failed=true}}
 else fs.writeFileSync(file,text);
}
if(failed)process.exit(1);
