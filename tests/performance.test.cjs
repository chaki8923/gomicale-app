/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const Module=require('node:module')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const {NextRequest,NextResponse}=require('next/server')
let fixture
const load=Module._load
Module._load=function(name,parent,...args){
 if(name==='server-only')return {}
 if(name==='next-intl/routing')return {defineRouting:value=>value}
 if(name==='next-intl/middleware')return ()=>request=>{
  const headers=new Headers(request.headers);headers.set('x-next-intl-locale','ja')
  const response=NextResponse.rewrite(new URL('/ja',request.url),{request:{headers}})
  response.cookies.set('NEXT_LOCALE','ja');return response
 }
 if(name==='@supabase/ssr')return {createServerClient:(_url,_key,options)=>({auth:{getUser:async()=>{
  fixture.calls++
  if(fixture.refresh)options.cookies.setAll([{name:'sb-project-auth-token',value:'refreshed',options:{path:'/'}}])
  return {data:{user:fixture.user},error:fixture.error}
 }}})}
 return load.call(this,name,parent,...args)
}
const {middleware}=require('../src/middleware.ts')
const {getDashboardData}=require('../src/lib/dashboard-data.ts')
const req=(path,cookie)=>new NextRequest('https://gomicale.jp'+path,{headers:cookie?{cookie}:{}})
const setup=()=>fixture={calls:0,user:null,error:null,refresh:false}

test('anonymous landing and public navigation bypass Auth without exposing private routes',async()=>{
 setup()
 assert.equal((await middleware(req('/ja'))).status,200)
 assert.equal((await middleware(req('/en/blog','NEXT_LOCALE=en'))).status,200)
 assert.equal((await middleware(req('/ja','sb-project-auth-token-code-verifier=pkce'))).status,200)
 assert.equal(fixture.calls,0)
 const protectedResponse=await middleware(req('/en/dashboard'))
 assert.equal(protectedResponse.status,307);assert.equal(protectedResponse.headers.get('location'),'https://gomicale.jp/en')
 assert.equal(fixture.calls,1)
})
test('API authentication is left to Route Handlers; OAuth callbacks are untouched',async()=>{
 setup()
 assert.equal((await middleware(req('/api/account/deletion','sb-project-auth-token=session'))).status,200)
 assert.equal((await middleware(req('/auth/callback?code=test'))).status,200)
 assert.equal(fixture.calls,0)
 assert.match((await middleware(req('/ja?code=test'))).headers.get('location'),/\/auth\/callback\?code=test$/)
})
test('cached public landing still redirects only server-verified logged-in users',async()=>{
 setup();fixture.user={id:'alice'}
 const response=await middleware(req('/en','sb-project-auth-token.0=chunk'))
 assert.equal(response.headers.get('location'),'https://gomicale.jp/en/dashboard')
 assert.equal(response.headers.get('cache-control'),'private, no-store')
 setup();fixture.error={message:'Invalid token'};fixture.user={id:'untrusted'}
 assert.equal((await middleware(req('/ja','sb-project-auth-token=invalid'))).headers.get('location'),null)
})
test('locale composition preserves refreshed Auth cookies and forwarded request cookies',async()=>{
 setup();fixture.user={id:'alice'};fixture.refresh=true
 const response=await middleware(req('/ja/dashboard','sb-project-auth-token=old'))
 assert.equal(response.cookies.get('sb-project-auth-token').value,'refreshed')
 assert.equal(response.cookies.get('NEXT_LOCALE').value,'ja')
 assert.match(response.headers.get('x-middleware-request-cookie'),/sb-project-auth-token=refreshed/)
 assert.equal(response.headers.get('x-middleware-request-x-next-intl-locale'),'ja')
 assert.match(response.headers.get('x-middleware-override-headers'),/x-next-intl-locale/)
 assert.equal(response.headers.get('cache-control'),'private, no-store')
})
test('dashboard reads run concurrently and all queries retain the verified user restriction',async()=>{
 const started=[],pending=[]
 class Query{
  constructor(table){this.table=table;this.filters=[]}
  select(){return this} eq(k,v){this.filters.push([k,v]);return this} gt(){return this} gte(){return this} order(){return this} limit(){return this} maybeSingle(){return this}
  then(yes,no){
   started.push(this)
   return new Promise(resolve=>pending.push(()=>resolve({data:this.table==='jobs'?[]:null,error:null,count:0}))).then(yes,no)
  }
 }
 const db={from:table=>new Query(table)},dataPromise=getDashboardData(db,db,'alice')
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(started.length,6) // every independent read is already in flight
 for(const query of started)assert.ok(query.filters.some(([k,v])=>k==='user_id'&&v==='alice'))
 pending.splice(0).forEach(resolve=>resolve())
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(started.length,7) // only the unread-replies timestamp is dependent
 assert.ok(started[6].filters.some(([k,v])=>k==='inquiry_posts.user_id'&&v==='alice'))
 pending.splice(0).forEach(resolve=>resolve())
 assert.equal((await dataPromise).successfulJobCount,0)
})
test('account status failures stay closed despite parallel loading',async()=>{
 const db={from:table=>({select(){return this},eq(){return this},gt(){return this},gte(){return this},order(){return this},limit(){return this},maybeSingle(){return this},then(yes,no){return Promise.resolve({data:null,error:table==='account_deletion_requests'?{message:'Unavailable'}:null}).then(yes,no)}})}
 await assert.rejects(()=>getDashboardData(db,db,'alice'),/Account status unavailable/)
})
