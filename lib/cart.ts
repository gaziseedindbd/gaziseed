'use client';
import { createClient } from '@/lib/supabase/client';
export type CartItem={id:string;product_id:string;variant_id:string|null;quantity:number;product?:any;variant?:any};
const KEY='gazi-seed-guest-cart';
export function getGuestCart():CartItem[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
export function saveGuestCart(items:CartItem[]){localStorage.setItem(KEY,JSON.stringify(items));window.dispatchEvent(new Event('gazi-cart'))}
export async function addToCart(item:{product_id:string;variant_id?:string|null;quantity?:number}){const s=createClient();const {data:{user}}=await s.auth.getUser();if(user){const {data:old}=await s.from('cart_items').select('id,quantity').eq('user_id',user.id).eq('product_id',item.product_id).is('variant_id',item.variant_id??null).maybeSingle();if(old) await s.from('cart_items').update({quantity:old.quantity+(item.quantity??1)}).eq('id',old.id);else await s.from('cart_items').insert({user_id:user.id,product_id:item.product_id,variant_id:item.variant_id??null,quantity:item.quantity??1});return}const c=getGuestCart();const i=c.find(x=>x.product_id===item.product_id&&x.variant_id===(item.variant_id??null));if(i)i.quantity+=item.quantity??1;else c.push({id:crypto.randomUUID(),product_id:item.product_id,variant_id:item.variant_id??null,quantity:item.quantity??1});saveGuestCart(c)}
export async function loadCart(){const s=createClient();const {data:{user}}=await s.auth.getUser();if(user){const {data}=await s.from('cart_items').select('id,product_id,variant_id,quantity,products(id,name_en,name_bn,regular_price,sale_price,stock,sku),product_variants(id,name,price,sale_price,stock,sku)').eq('user_id',user.id).order('created_at');return (data??[]).map((x:any)=>({...x,product:x.products,variant:x.product_variants}))}
const guest=getGuestCart();
if(!guest.length)return [];
const productIds=[...new Set(guest.map(x=>x.product_id))];
const variantIds=[...new Set(guest.map(x=>x.variant_id).filter(Boolean))] as string[];
const [{data:products},{data:variants}]=await Promise.all([
  s.from('products').select('id,name_en,name_bn,regular_price,sale_price,stock,sku,active').in('id',productIds).eq('active',true),
  variantIds.length?s.from('product_variants').select('id,product_id,name,price,sale_price,stock,sku,active').in('id',variantIds).eq('active',true):Promise.resolve({data:[] as any[]})
]);
const productMap=new Map((products??[]).map((p:any)=>[p.id,p]));
const variantMap=new Map((variants??[]).map((v:any)=>[v.id,v]));
return guest.filter(i=>productMap.has(i.product_id)&&(!i.variant_id||variantMap.has(i.variant_id))).map(i=>({...i,product:productMap.get(i.product_id),variant:i.variant_id?variantMap.get(i.variant_id):undefined}));}
export async function updateCart(id:string,quantity:number){const s=createClient();const {data:{user}}=await s.auth.getUser();if(user){if(quantity<=0) await s.from('cart_items').delete().eq('id',id).eq('user_id',user.id);else await s.from('cart_items').update({quantity}).eq('id',id).eq('user_id',user.id)}else saveGuestCart(getGuestCart().filter(x=>x.id!==id||quantity>0).map(x=>x.id===id?{...x,quantity}:x))}
export async function clearCart(){const s=createClient();const {data:{user}}=await s.auth.getUser();if(user) await s.from('cart_items').delete().eq('user_id',user.id);saveGuestCart([])}
