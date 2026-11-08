/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const Module=require('node:module')
const path=require('node:path')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let f
const clone=value=>structuredClone(value)
class Query {
 constructor(table){this.table=table;this.filters=[];this.mode='select'}
 select(){return this} eq(k,v){this.filters.push(r=>r[k]===v);return this} order(){return this} limit(){return this} or(){return this}
 update(value){this.mode='update';this.value=value;return this} delete(){this.mode='delete';return this}
 async run(single=false){
  const rows=f.tables[this.table]??=[];const selected=rows.filter(r=>this.filters.every(fn=>fn(r)))
  if(this.mode==='update') {
   if(f.failProgress && this.value.stage==='cleanup'){f.failProgress=false;return {data:null,error:{message:'offline'}}}
   selected.forEach(r=>Object.assign(r,clone(this.value)))
  }
  if(this.mode==='delete') f.tables[this.table]=rows.filter(r=>!selected.includes(r))
  return {data:clone(single?selected[0]??null:selected),error:null}
 }
 maybeSingle(){return this.run(true)} then(y,n){return this.run().then(y,n)}
}
function setup(){
 f={user:{id:id(1)},exists:true,activeJobs:[],tables:{account_deletion_requests:[],user_integrations:[{user_id:id(1),google_refresh_token_enc:'private-refresh'}]},files:[`uploads/${id(1)}/a.pdf`,`uploads/${id(2)}/b.pdf`],calls:[],after:[]}
 f.db={from:t=>new Query(t),auth:{getUser:async()=>({data:{user:f.exists?f.user:null}}),admin:{getUserById:async()=>f.exists?{data:{user:{id:id(1)}},error:null}:{data:{user:null},error:{status:404}},deleteUser:async userId=>{
  f.calls.push(['auth',userId]);if(f.authFailure)return {error:{status:500}}
  const existed=f.exists;f.exists=false;return {error:existed?null:{status:404}}
 }}},rpc:async(name,args)=>{
  if(name==='account_is_active')return {data:f.exists&&!f.tables.account_deletion_requests.length,error:null}
  if(name==='account_deletion_blockers')return {data:f.activeJobs,error:null}
  if(name==='cleanup_deleted_account_cache'){f.calls.push(['cache',args.p_user_id]);return {data:true,error:null}}
  if(name==='begin_account_deletion'){
   let row=f.tables.account_deletion_requests.find(r=>r.user_id===args.p_user_id)
   if(!row){
    if(f.activeJobs.length)return {error:{message:'ACTIVE_JOBS'}}
    row={user_id:args.p_user_id,operation_id:id(99),stage:'files',pdf_hashes:[],cleanup_after:new Date(Date.now()+86400000).toISOString(),created_at:new Date().toISOString()};f.tables.account_deletion_requests.push(row)
   }
   if(row.lease_until&&Date.parse(row.lease_until)>Date.now())return {data:[],error:null}
   Object.assign(row,{lease_token:args.p_token,lease_until:new Date(Date.now()+120000).toISOString(),last_error_code:null})
   return {data:[clone(row)],error:null}
  }
  throw new Error(name)
 }}
}
const load=Module._load
Module._load=function(request,parent,...args){
 if(request==='server-only')return {}
 if(request==='next/server'){const actual=load.call(this,request,parent,...args);return {...actual,after:fn=>f.after.push(fn)}}
 if(request==='@/lib/supabase/server')return {getSupabaseServerClient:async()=>f.db,getSupabaseServiceClient:()=>f.db}
 if(request==='@/lib/account-deletion-server')return load.call(this,path.resolve(__dirname,'../src/lib/account-deletion-server.ts'),parent,...args)
 if(request==='@/lib/r2')return load.call(this,path.resolve(__dirname,'../src/lib/r2.ts'),parent,...args)
 if(request==='@aws-sdk/client-s3')return {S3Client:class{async send(command){
  const {Bucket,Prefix,Delete}=command.input;assert.ok(Bucket)
  if(command.kind==='list'){f.calls.push(['list',Prefix]);if(f.fileFailure)throw new Error('provider credential must not leak');return {Contents:f.files.filter(k=>k.startsWith(Prefix)).slice(0,1000).map(Key=>({Key}))}}
  f.calls.push(['deleteFiles',Delete.Objects.map(o=>o.Key)]);if(f.partialFailure)return {Errors:[{Code:'Denied'}]}
  f.files=f.files.filter(k=>!Delete.Objects.some(o=>o.Key===k));return {}
 }},PutObjectCommand:class{},ListObjectsV2Command:class{constructor(input){this.input=input;this.kind='list'}},DeleteObjectsCommand:class{constructor(input){this.input=input;this.kind='delete'}}}
 return load.call(this,request,parent,...args)
}
process.env.SUPABASE_SERVICE_ROLE_KEY='test-signature-secret';process.env.R2_BUCKET_NAME='test-only'
const originalFetch=global.fetch
global.fetch=async(url,options)=>{
 assert.equal(String(url),'https://oauth2.googleapis.com/revoke') // no Calendar events or mail calls
 assert.equal(options.method,'POST');f.calls.push(['google'])
 return f.googleFailure?Response.json({error:'unavailable'},{status:503}):f.invalidToken?Response.json({error:'invalid_token'},{status:400}):new Response('')
}
const service=require('../src/lib/account-deletion-server.ts')
const api=require('../src/app/api/account/route.ts')
const statusApi=require('../src/app/api/account/deletion/route.ts')
const r2=require('../src/lib/r2.ts')
const request=(body={confirm:true,expectedAccountId:id(1)},headers={})=>new Request('https://gomicale.jp/api/account',{method:'DELETE',headers:{origin:'https://gomicale.jp','content-type':'application/json',...headers},body:JSON.stringify(body)})
const cookie=response=>response.headers.get('set-cookie')?.split(';')[0]
const status=c=>statusApi.GET(new Request('https://gomicale.jp/api/account/deletion',{headers:c?{cookie:c}:{}}))
const finish=async()=>{for(const callback of f.after.splice(0))await callback()}

test('requires verified identity, exact origin, explicit confirmation and matching account',async()=>{
 setup();f.user=null;assert.equal((await api.DELETE(request())).status,401)
 setup();assert.equal((await api.DELETE(request(undefined,{origin:'https://attacker.test'}))).status,403)
 assert.equal((await api.DELETE(request(undefined,{'sec-fetch-site':'cross-site'}))).status,403)
 assert.equal((await api.DELETE(request(undefined,{'content-type':'application/jsonp'}))).status,400)
 for(const body of [null,{confirm:false},{confirm:true,expectedAccountId:id(1),userId:id(2)}])assert.equal((await api.DELETE(request(body))).status,400)
 assert.equal((await api.DELETE(request({confirm:true,expectedAccountId:id(2)}))).status,409)
 assert.equal(f.after.length,0);assert.equal(f.calls.length,0)
})
test('active jobs block both status and deletion without partial changes',async()=>{
 setup();f.activeJobs=[{id:id(10),title:'test.pdf',status:'processing'}]
 assert.equal((await(await status()).json()).canDelete,false)
 assert.equal((await api.DELETE(request())).status,409)
 assert.equal(f.tables.account_deletion_requests.length,0);assert.equal(f.calls.length,0)
})
test('accepts once, deletes only owner files, disconnects Google then deletes Auth; signed receipt survives logout',async()=>{
 setup();const result=await api.DELETE(request());assert.equal(result.status,202)
 const receipt=cookie(result);assert.match(receipt,/gomicale-account-deletion=/)
 assert.match(result.headers.get('set-cookie'),/HttpOnly/);assert.equal(f.calls.length,0)
 await api.DELETE(request());assert.equal(f.after.length,1)
 await finish()
 assert.deepEqual(f.files,[`uploads/${id(2)}/b.pdf`]);assert.equal(f.exists,false)
 assert.ok(f.calls.findIndex(c=>c[0]==='deleteFiles')<f.calls.findIndex(c=>c[0]==='google'))
 assert.ok(f.calls.findIndex(c=>c[0]==='google')<f.calls.findIndex(c=>c[0]==='auth'))
 assert.equal((await(await status(receipt)).json()).state,'completed')
 assert.equal((await status()).status,401)
 assert.equal((await status(receipt+'tamper')).status,401)
})
test('storage and partial delete failures keep Auth and are retried from the failed stage',async()=>{
 for(const partial of [false,true]){
  setup();f.fileFailure=!partial;f.partialFailure=partial
  const result=await api.DELETE(request());await finish()
  assert.equal(f.exists,true);assert.ok(!f.calls.some(c=>c[0]==='google'))
  const read=await(await status(cookie(result))).json();assert.equal(read.state,'retry');assert.equal(JSON.stringify(read).includes('credential'),false)
  f.fileFailure=false;f.partialFailure=false
  await api.DELETE(request());await finish();assert.equal(f.exists,false)
 }
})
test('Google failure retries without repeating file deletion; revoked tokens count as disconnected',async()=>{
 setup();f.googleFailure=true;await api.DELETE(request());await finish()
 assert.equal(f.tables.account_deletion_requests[0].stage,'google');assert.equal(f.exists,true)
 const fileCalls=f.calls.filter(c=>c[0]==='list').length
 f.googleFailure=false;f.invalidToken=true;await api.DELETE(request());await finish()
 assert.equal(f.calls.filter(c=>c[0]==='list').length,fileCalls);assert.equal(f.exists,false)
})
test('Auth and progress-save failures resume with the receipt and do not call Google twice',async()=>{
 setup();f.authFailure=true
 const result=await api.DELETE(request());const receipt=cookie(result);await finish()
 assert.equal(f.tables.account_deletion_requests[0].stage,'auth');assert.equal(f.exists,true)
 f.authFailure=false;f.failProgress=true
 await api.DELETE(request());await finish();assert.equal(f.exists,false)
 assert.equal((await(await status(receipt)).json()).state,'retry')
 const again=await api.DELETE(request(undefined,{cookie:receipt}));assert.equal(again.status,202);await finish()
 assert.equal((await(await status(receipt)).json()).state,'completed')
 assert.equal(f.calls.filter(c=>c[0]==='google').length,1)
})
test('late-upload cleanup retains its recovery record until old URLs have expired, then forgets it',async()=>{
 setup();const result=await api.DELETE(request());const receipt=cookie(result);await finish()
 f.files.push(`uploads/${id(1)}/late.png`)
 const row=f.tables.account_deletion_requests[0];row.cleanup_after=new Date(Date.now()-1).toISOString()
 await service.retryAccountDeletions()
 assert.deepEqual(f.files,[`uploads/${id(2)}/b.pdf`]);assert.equal(f.tables.account_deletion_requests.length,0)
 assert.equal((await(await status(receipt)).json()).state,'completed')
})
test('R2 cleanup paginates beyond 1000 objects and rejects unsafe owner prefixes',async()=>{
 setup();f.files=Array.from({length:1001},(_,n)=>`uploads/${id(1)}/${n}.pdf`).concat([`uploads/${id(2)}/keep.pdf`])
 assert.equal(await r2.deleteAccountFiles(id(1),Date.now()+40000),true)
 assert.equal(f.calls.filter(c=>c[0]==='deleteFiles').length,2)
 assert.deepEqual(f.files,[`uploads/${id(2)}/keep.pdf`])
 await assert.rejects(()=>r2.deleteAccountFiles('../',Date.now()+40000),/INVALID_USER/)
})
test('Japanese and English cover the same account-deletion messages',()=>{
 const ja=require('../messages/ja.json').accountDeletion,en=require('../messages/en.json').accountDeletion
 assert.deepEqual(Object.keys(ja).sort(),Object.keys(en).sort())
 for(const text of Object.values(ja))assert.ok(text.length)
 global.fetch=originalFetch
})
