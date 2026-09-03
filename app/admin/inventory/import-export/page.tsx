'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const HEADERS = ['type','sku','stock','reason','reference_id'];
function csvEscape(v:any){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function parseCsv(text:string){
 const rows:string[][]=[]; let row:string[]=[], cur='', q=false;
 for(let i=0;i<text.length;i++){const c=text[i], n=text[i+1]; if(c==='"'&&q&&n==='"'){cur+='"';i++;continue} if(c==='"'){q=!q;continue} if(c===','&&!q){row.push(cur);cur='';continue} if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cur);cur='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[];continue} cur+=c}
 if(cur!==''||row.length){row.push(cur);if(row.some(x=>x.trim()!==''))rows.push(row)} return rows;
}

export default function InventoryImportExport(){
 const [country,setCountry]=useState('BD'); const [rows,setRows]=useState<any[]>([]); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false); const [errors,setErrors]=useState<string[]>([]);
 async function exportCsv(){
  setMsg('');setErrors([]); const s=createClient();
  const {data,error}=await s.from('products').select('sku,country,stock,low_stock_threshold,active').eq('country',country).order('sku').limit(5000);
  if(error){setMsg(error.message);return}
  const header=HEADERS; const csv=[header.join(','),...(data||[]).map(r=>header.map(k=>csvEscape(k==='type'?'product':k==='reason'?'export':k==='reference_id'?'':r[k])).join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`gaziseed-inventory-${country}.csv`;a.click();URL.revokeObjectURL(url);setMsg(`Exported ${(data||[]).length} product rows for ${country}.`)
 }
 function parseFile(file:File){
  setMsg('');setErrors([]);const reader=new FileReader();reader.onload=()=>{try{const matrix=parseCsv(String(reader.result||''));if(matrix.length<2){setMsg('CSV must contain a header and at least one data row.');return}const h=matrix[0].map(x=>x.trim().toLowerCase());if(!HEADERS.every(k=>h.includes(k))){setMsg(`Required columns: ${HEADERS.join(', ')}`);return}const data=matrix.slice(1).map(v=>Object.fromEntries(h.map((k,i)=>[k,v[i]??''])));const errs:string[]=[];const seen=new Set<string>();data.forEach((r,i)=>{const key=`${String(r.type||'product').trim().toLowerCase()}:${String(r.sku||'').trim()}`;const stock=Number(r.stock);if(seen.has(key))errs.push(`Row ${i+2}: duplicate ${key}`);seen.add(key);if(!['product','variant'].includes(String(r.type||'product').trim().toLowerCase()))errs.push(`Row ${i+2}: type must be product or variant`);if(!String(r.sku||'').trim())errs.push(`Row ${i+2}: SKU required`);if(!Number.isFinite(stock)||stock<0)errs.push(`Row ${i+2}: stock must be a non-negative number`);if(r.reference_id&& !/^[0-9a-f-]{36}$/i.test(String(r.reference_id).trim()))errs.push(`Row ${i+2}: invalid reference_id`)});setRows(data);setErrors(errs);setMsg(`Preview loaded: ${data.length} rows.${errs.length?' Fix validation errors before applying.':''}`)}catch(e:any){setMsg(e.message||'Invalid CSV')}};reader.readAsText(file)
 }
 async function apply(){
  if(!rows.length||errors.length){setMsg('Fix all CSV validation errors before applying.');return} setBusy(true);setMsg('');const s=createClient();
  const payload=rows.map(r=>({type:String(r.type||'product').trim().toLowerCase(),sku:String(r.sku||'').trim(),stock:Number(r.stock),reason:String(r.reason||'bulk_import').trim()||'bulk_import',reference_id:String(r.reference_id||'').trim()||null}));
  const {data,error}=await s.rpc('admin_bulk_import_inventory',{p_country:country,p_rows:payload});
  setBusy(false);if(error){setMsg(`Import failed: ${error.message}`);return}setMsg(`Import successful: ${data?.updated??rows.length} rows updated transactionally.`);setRows([]);setErrors([])
 }
 function downloadTemplate(){const csv=[HEADERS.join(','),'product,SKU-001,100,bulk_import,'].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='gaziseed-inventory-template.csv';a.click();URL.revokeObjectURL(url)}
 return <main className="p-5 md:p-8"><h1 className="text-3xl font-black">Inventory Import / Export</h1><p className="mt-1 text-gray-500">Transactional bulk stock replacement by product or variant SKU. Negative stock and duplicate rows are rejected.</p><div className="mt-6 flex flex-wrap gap-3"><select value={country} onChange={e=>{setCountry(e.target.value);setRows([]);setErrors([])}} className="rounded-xl border bg-white px-4 py-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select><button onClick={downloadTemplate} className="rounded-xl border bg-white px-5 py-3">CSV Template</button><button onClick={exportCsv} className="rounded-xl bg-black px-5 py-3 text-white">Export CSV</button><label className="cursor-pointer rounded-xl border bg-white px-5 py-3">Upload CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={e=>e.target.files?.[0]&&parseFile(e.target.files[0])}/></label>{rows.length>0&&<button disabled={busy||errors.length>0} onClick={apply} className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?'Importing…':`Apply ${rows.length} rows`}</button>}</div>{msg&&<p className="mt-4 rounded-xl border bg-white p-4">{msg}</p>}{errors.length>0&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><b>Validation errors</b><ul className="mt-2 list-disc pl-5 text-sm">{errors.slice(0,20).map((e,i)=><li key={i}>{e}</li>)}</ul></div>}{rows.length>0&&<div className="mt-6 overflow-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead><tr className="border-b">{Object.keys(rows[0]).map(k=><th key={k} className="px-4 py-3 text-left">{k}</th>)}</tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i} className="border-b">{Object.values(r).map((v:any,j)=><td key={j} className="px-4 py-3">{String(v)}</td>)}</tr>)}</tbody></table></div>}</main>
}