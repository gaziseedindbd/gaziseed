'use client';
import {useState} from 'react'; import {addToCart} from '@/lib/cart';
export default function AddToCart({productId,variantId=null}:{productId:string;variantId?:string|null}){const [busy,setBusy]=useState(false);const [ok,setOk]=useState(false);return <button disabled={busy} onClick={async()=>{setBusy(true);await addToCart({product_id:productId,variant_id:variantId,quantity:1});setOk(true);setBusy(false);setTimeout(()=>setOk(false),1800)}} className="rounded-xl bg-[#1f6b3b] px-6 py-3 font-bold text-white disabled:opacity-50">{busy?'Adding…':ok?'✓ Added':'Add to Cart'}</button>}
