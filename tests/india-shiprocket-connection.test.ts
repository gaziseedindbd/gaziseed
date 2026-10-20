import test from 'node:test';
import assert from 'node:assert/strict';
import {createIndiaConnectionCheck} from '../lib/shiprocket/india-connection';
const env={SUPABASE_URL:'https://qqehtphbpypcmxliaiqd.supabase.co',SHIPROCKET_SANDBOX_API_EMAIL:'sandbox@example.invalid',SHIPROCKET_SANDBOX_API_PASSWORD:'synthetic-password',SHIPROCKET_API_EMAIL:'live@example.invalid',SHIPROCKET_API_PASSWORD:'live-password'};
const request=()=>new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic-admin'}});
test('connection check uses Sandbox credentials and HTTPS host; never returns secrets',async()=>{
 let calls=0;
 const handler=createIndiaConnectionCheck({env,authenticate:async()=>true,fetcher:async(url,init)=>{
  calls++;assert.equal(url,'https://api-sandbox.shiprocket.in/v1/external/auth/login');
  assert.deepEqual(JSON.parse(String(init?.body)),{email:env.SHIPROCKET_SANDBOX_API_EMAIL,password:env.SHIPROCKET_SANDBOX_API_PASSWORD});
  assert.equal(init?.redirect,'error');return Response.json({token:'synthetic-provider-secret-token'});
 }});
 const response=await handler(request()),text=await response.text(),result=JSON.parse(text);
 assert.equal(calls,1);assert.equal(result.authenticated,true);assert.equal(result.test_only,true);
 for(const secret of [env.SHIPROCKET_SANDBOX_API_PASSWORD,env.SHIPROCKET_API_PASSWORD,env.SHIPROCKET_SANDBOX_API_EMAIL,'synthetic-provider-secret-token'])assert.ok(!text.includes(secret));
});
test('unauthorized, unknown project and missing Sandbox secrets cannot reach provider',async()=>{
 const fetcher:typeof fetch=async()=>{throw Error('must not fetch')};
 for(const [settings,authorized,expected] of [[env,false,'india_admin_required'],[{...env,SUPABASE_URL:'https://unknown.invalid'},true,'untrusted_project'],[{...env,SHIPROCKET_SANDBOX_API_PASSWORD:''},true,'credentials_unavailable']] as const){
  const response=await createIndiaConnectionCheck({env:settings,authenticate:async()=>authorized,fetcher})(request());
  assert.equal((await response.json()).code,expected);
 }
});
test('diagnostics distinguish access denial and bad credentials without returning raw errors',async()=>{
 for(const [status,code] of [[498,'provider_access_denied'],[401,'provider_auth_rejected'],[503,'provider_unavailable']] as const){
  const response=await createIndiaConnectionCheck({env,authenticate:async()=>true,fetcher:async()=>new Response('private provider error',{status,headers:{'Content-Type':'text/plain'}})})(request());
  const text=await response.text(),result=JSON.parse(text);assert.equal(result.code,code);assert.equal(result.provider_http_status,status);assert.ok(!text.includes('private provider error'));
 }
});
test('CORS works without authentication; GET and missing bearer cannot run checks',async()=>{
 let authCalls=0;
 const handler=createIndiaConnectionCheck({env,authenticate:async()=>{authCalls++;return true}});
 const preflight=await handler(new Request('https://test.invalid',{method:'OPTIONS'}));
 assert.equal(preflight.status,204);assert.ok(preflight.headers.get('Access-Control-Allow-Headers')?.includes('x-supabase-client-platform'));
 assert.equal((await handler(new Request('https://test.invalid'))).status,405);
 assert.equal((await handler(new Request('https://test.invalid',{method:'POST'}))).status,401);assert.equal(authCalls,0);
});
