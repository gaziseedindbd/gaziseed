import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Public, read-only India PIN coverage preview. Never quotes delivery fees or creates shipments.
const allowedOrigins=new Set(["https://www.gaziseed.com","https://gaziseed.com"]);
const isOriginAllowed=(o:string)=>allowedOrigins.has(o)||/^https:\/\/gaziseed-[a-z0-9-]+-gazi-seed\.vercel\.app$/.test(o);
const windows=new Map<string,{count:number,until:number}>();
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 const cors={"Access-Control-Allow-Origin":isOriginAllowed(origin)?origin:"https://www.gaziseed.com",
  "Vary":"Origin","Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
  "Cache-Control":"no-store"};
 const reply=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply(405,{ok:false});
 if(!isOriginAllowed(origin))return reply(403,{ok:false,code:"origin_not_allowed"});
 const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 const now=Date.now(),previous=windows.get(ip);
 const bucket=previous&&previous.until>now?previous:{count:0,until:now+60000};
 bucket.count+=1;windows.set(ip,bucket);
 if(windows.size>5000)windows.clear();
 if(bucket.count>12)return reply(429,{ok:false,code:"rate_limited"});
 let data:unknown;
 try{data=await req.json()}catch{return reply(400,{ok:false,code:"invalid_request"})}
 if(!data||typeof data!=="object"||Array.isArray(data))return reply(400,{ok:false,code:"invalid_request"});
 const {pin,country} = data as Record<string,unknown>;
 if(country!=="IN"||typeof pin!=="string"||!/^[1-9][0-9]{5}$/.test(pin))return reply(400,{ok:false,code:"invalid_pin"});
 const email=Deno.env.get("SHIPROCKET_API_EMAIL"),password=Deno.env.get("SHIPROCKET_API_PASSWORD");
 const pickup=Deno.env.get("SHIPROCKET_PICKUP_POSTCODE")||"783124";
 if(!email||!password||!/^[1-9][0-9]{5}$/.test(pickup))return reply(503,{ok:false,code:"check_unavailable"});
 try{
 const login=await fetch("https://apiv2.shiprocket.in/v1/external/auth/login",{method:"POST",
  headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(9000)});
 if(!login.ok)return reply(503,{ok:false,code:"check_unavailable"});
 const body:unknown=await login.json();
 const token=body&&typeof body==="object"&&"token" in body?body.token:null;
 if(typeof token!=="string"||!token)return reply(503,{ok:false,code:"check_unavailable"});
 // Quote is only an indicative PIN preview with a standard small parcel.
 // Actual booking requires accurate packed dimensions and later admin checks.
 const params=new URLSearchParams({pickup_postcode:pickup,delivery_postcode:pin,cod:"0",
  weight:"0.5",length:"15",breadth:"10",height:"5",is_return:"0"});
 const response=await fetch("https://apiv2.shiprocket.in/v1/external/courier/serviceability/?"+params.toString(),
  {headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000)});
 if(!response.ok)return reply(503,{ok:false,code:"check_unavailable"});
 const json:unknown=await response.json();
 const source=json&&typeof json==="object"&&"data" in json?json.data:null;
 const list=source&&typeof source==="object"&&"available_courier_companies" in source?source.available_courier_companies:null;
 if(!Array.isArray(list))return reply(200,{ok:true,status:"unconfirmed"});
 // Never interpret empty data as definite unserviceability (e.g. pending KYC).
 return reply(200,{ok:true,status:list.length>0?"likely_available":"unconfirmed"});
 }catch{return reply(503,{ok:false,code:"check_unavailable"})}
});