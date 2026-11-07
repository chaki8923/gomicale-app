/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const model = require('../shared/calendar-import.ts')
const google = require('../shared/google-calendars.ts')
const calendar = require('../lambda/src/calendar/client.ts')
const clone = value => structuredClone(value)
const source = () => model.createSourceEvents([{ date:'2026-11-09',title:'Paper' },{ date:'2026-11-10',title:'Plastic' }], {Paper:'#46d6db'})
const draft = () => ({events:source(),calendarId:'owned',eventTime:null,timezone:'Asia/Tokyo'})
let fixture, visionResponse, visionPrompt
class Query {
  constructor(table) { this.table=table; this.filters=[]; this.mode='select' }
  select() { return this } eq(k,v) { this.filters.push(r=>r[k]===v); return this } is(k,v) { return this.eq(k,v) } neq(k,v) { this.filters.push(r=>r[k]!==v);return this }
  update(value) { this.mode='update'; this.value=value; return this }
  insert(value) { this.mode='insert'; this.value=value; return this }
  upsert(value,options) { this.mode='upsert'; this.value=value; this.ignoreDuplicates=options?.ignoreDuplicates; return this }
  async run(single=false) {
    const rows = fixture.tables[this.table] ??= []
    let found=rows.filter(r=>this.filters.every(f=>f(r)))
    if (this.mode==='update') found.forEach(r=>Object.assign(r,clone(this.value),{updated_at:new Date(++fixture.tick).toISOString()}))
    if (this.mode==='insert' || this.mode==='upsert') {
      let value=clone(this.value)
      if (this.table==='calendar_imports' && rows.some(r=>r.job_id===value.job_id)) return {data:null,error:{code:'23505'}}
      if(this.table==='calendar_import_tasks') {
        const existing=rows.find(r=>r.job_id===value.job_id)
        if(existing && this.ignoreDuplicates)return {data:clone(single?existing:[existing]),error:null}
        value={dispatch_attempts:0,dispatch_token:'00000000-0000-4000-8000-000000000077',email_payload:null,email_status:'pending',email_first_attempt_at:null,email_sent_at:null,email_provider_id:null,email_error_code:null,...value}
      }
      if(this.table==='calendar_imports')value={state:'analyzing',confirmed:null,registered_count:0,revision:0,registration_mode:'review',...value}
      rows.push(value);found=[value]
    }
    return {data:clone(single ? found[0]??null : found),error:null}
  }
  single() { return this.run(true) } maybeSingle() { return this.run(true) }
  then(yes,no) { return this.run().then(yes,no) }
}
function setup() {
  const review={registration_mode:'review',job_id:'00000000-0000-4000-8000-000000000001',user_id:'alice',state:'ready',revision:0,source_events:source(),draft:draft(),confirmed:null,language:'ja',lease_token:null,lease_until:null,error:null,registered_count:0,updated_at:new Date().toISOString()}
  fixture={tick:Date.now(),tables:{calendar_imports:[review],jobs:[{id:review.job_id,user_id:'alice',status:'awaiting_confirmation',r2_object_key:'sample.png',pdf_hash:'hash',parser_mode:'garbage'}],user_integrations:[{user_id:'alice',google_refresh_token_enc:'refresh',selected_calendar_id:null,line_user_id:'linked'}],parsed_pdfs:[]},user:{id:'alice'},invocations:[],writes:[],emails:[],emailRequests:[],emailKeys:new Map(),dispatches:[],parseCalls:0,tokenCalls:0,owner:true,fail:false}
  fixture.db={from:table=>new Query(table),auth:{getUser:async()=>({data:{user:fixture.user}}),admin:{getUserById:async()=>({data:{user:{email:'test@example.test'}}})}}, rpc:async(name,args)=>{
    const r=fixture.tables.calendar_imports.find(r=>r.job_id===args.p_job_id)
    if(name==='prepare_calendar_review') {
      if(r?.state!=='analyzing')return {data:false,error:null}
      const d={...r.draft,events:args.p_events};if(r.registration_mode==='auto')d.calendarId='primary'
      Object.assign(r,{state:r.registration_mode==='auto'?'registering':'ready',source_events:args.p_events,draft:d,confirmed:r.registration_mode==='auto'?clone(d):null})
      Object.assign(fixture.tables.jobs[0],{status:r.state==='ready'?'awaiting_confirmation':'processing'})
      return {data:true,error:null}
    }
    if(name==='claim_calendar_import') { if(!r||r.user_id!==args.p_user_id||r.state!=='registering'||r.lease_until&&Date.parse(r.lease_until)>Date.now())return {data:[],error:null};r.lease_token=args.p_token;r.lease_until=new Date(Date.now()+960000).toISOString();return {data:[clone(r)],error:null} }
    if(name==='finish_calendar_import') { if(r?.lease_token!==args.p_token)return {data:false,error:null};r.state='completed';r.registered_count=args.p_count;r.lease_token=null;fixture.tables.jobs[0].status='completed';return {data:true,error:null} }
    throw new Error(name)
  }}
  return review
}
const load=Module._load
Module._load=function(request,parent,...args) {
  if(request==='@google/generative-ai' && parent?.filename.endsWith('/parsers/gemini.ts'))return {GoogleGenerativeAI:class{getGenerativeModel(){return {generateContent:async input=>{visionPrompt=input;return {response:{text:()=>JSON.stringify(visionResponse)}}}}}},HarmCategory:{HARM_CATEGORY_DANGEROUS_CONTENT:'dangerous'},HarmBlockThreshold:{BLOCK_NONE:'none'}}
  if(request==='resend' && parent?.filename.includes('/lambda/src/'))return {Resend:class{emails={send:async(data,options)=>{
    fixture.emailRequests.push({data:clone(data),options})
    if(fixture.mailFail)return {error:{message:'mock provider failure'}}
    const key=options?.idempotencyKey
    if(!key || !fixture.emailKeys.has(key)) {fixture.emails.push(clone(data));if(key)fixture.emailKeys.set(key,'mock-id')}
    return {data:{id:'mock-id'}}
  }}}}
  if(request==='server-only')return {}
  if(request==='@/lib/google-calendar-access')return {accessTokenHasCalendarScope:async()=>true}
  if(request==='@/lib/supabase/server')return {getSupabaseServerClient:async()=>fixture.db,getSupabaseServiceClient:()=>fixture.db}
  if(request==='@/lib/calendar-import-server')return load.call(this,require('node:path').resolve(__dirname,'../src/lib/calendar-import-server.ts'),parent,...args)
  if(request==='@aws-sdk/client-lambda')return {LambdaClient:class {async send(command){fixture.invocations.push(command.input);return {StatusCode:202}}},InvokeCommand:class {constructor(input){this.input=input}}}
  if(parent?.filename.endsWith('/lambda/src/index.ts')) {
    if(request==='@supabase/supabase-js')return {createClient:()=>fixture.db}
    if(request==='@aws-sdk/client-s3')return {S3Client:class{async send(){return {Body:{transformToByteArray:async()=>new Uint8Array([1,2])},ContentType:'image/png'}}},GetObjectCommand:class{}}
    if(request==='./parsers/factory')return {createPdfParser:()=>({parse:async()=>{fixture.parseCalls++;return {events:source().map(({date,title})=>({date,title})),typeColors:{Paper:'#46d6db'},parserMode:'garbage'}}})}
    if(request==='./parsers/gemini')return {parseManualGarbageInstruction:async()=>({events:source()})}
    if(request==='./calendar/client')return {...calendar,refreshAccessToken:async()=>{fixture.tokenCalls++;return 'access'},batchInsertGarbageEvents:async(...args)=>{fixture.writes.push(args);if(fixture.pause){fixture.pause=false;await args[7].checkpoint(1);throw new calendar.ImportTimeBudgetError()}if(fixture.fail)throw new Error('Temporary failure');return {inserted:args[1].length,skipped:0}}}
    if(request==='resend')return {Resend:class{emails={send:async data=>{fixture.emails.push(data);return {data:{id:'mock'}}}}}}
  }
  return load.call(this,request,parent,...args)
}
const originalFetch=global.fetch
function mockGoogle() {
  global.fetch=async (url,options)=> {
    if(String(url).includes('/api/internal/calendar-imports/dispatch')){fixture.dispatches.push({url,options});const failed=fixture.dispatchFail||fixture.dispatchFailOnce;fixture.dispatchFailOnce=false;return Response.json({accepted:!failed},{status:failed?503:202})}
    if(String(url).includes('/token'))return Response.json({access_token:'access'})
    if(String(url).includes('/calendarList'))return Response.json({items:fixture.owner?[{id:'owned',summary:'Own',accessRole:'owner',primary:true}]:[]})
    if(String(url).endsWith('/colors'))return Response.json({event:model.STANDARD_EVENT_COLORS})
    throw new Error('Unexpected external request '+url)
  }
}
process.env.RESEND_API_KEY='mock-only';setup();mockGoogle()
const reviewRoute=require('../src/app/api/jobs/[jobId]/review/route.ts')
const importRoute=require('../src/app/api/jobs/[jobId]/import/route.ts')
const worker=require('../lambda/src/index.ts')
const internalRoute=require('../src/app/api/internal/calendar-imports/dispatch/route.ts')
const startRoute=require('../src/app/api/jobs/start/route.ts')
const followup=require('../lambda/src/import-followup.ts')
const sourceHelper=require('../src/lib/user-calendar-events.ts')
const context=()=>({params:Promise.resolve({jobId:fixture.tables.calendar_imports[0].job_id})})
const request=(body,method='POST')=>new Request('http://localhost/api/test',{method,body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})

test('CIELAB matches standard colors; unknown colors are never inferred',()=>{
  for(const [id,c] of Object.entries(model.STANDARD_EVENT_COLORS))assert.equal(model.nearestColor(c.background),id)
  assert.equal(model.nearestColor('#47d5dc'),'7');assert.equal(model.nearestColor(null),null)
  assert.equal(source()[1].sourceColor,null);assert.equal(source()[1].colorId,null)
})
test('real dates, names, duplicate selections, colors and settings are validated',()=>{
  for(const date of ['2026-02-30','2026-13-01','2026-00-10','not a date'])assert.equal(model.validDate(date),false)
  assert.equal(model.validDate('2028-02-29'),true)
  for(const change of [d=>d.events[0].title='',d=>d.events[0].date='2026-02-30',d=>d.events[0].colorId='99',d=>d.eventTime='24:00',d=>d.timezone='Mars/Test']){const d=draft();change(d);assert.throws(()=>model.validateDraft(d,source(),undefined,true))}
  const d=draft();d.events.forEach(e=>e.included=false);assert.throws(()=>model.validateDraft(d,source(),undefined,true),/EMPTY_SELECTION/)
  d.events[0].included=true;d.events[1]={...d.events[1],date:d.events[0].date,title:d.events[0].title,included:true};assert.throws(()=>model.validateDraft(d,source()),/DUPLICATE_EVENTS/)
})
test('all-day end is exclusive and timed events cross midnight correctly',()=>{
  assert.equal(calendar.buildEventDateTime('2026-12-31').end.date,'2027-01-01')
  assert.equal(calendar.buildEventDateTime('2026-12-31','23:30','Asia/Tokyo').end.dateTime,'2027-01-01T00:30:00')
})
test('owned calendar pagination excludes writers and deleted calendars',async()=>{
  let calls=0
  global.fetch=async()=>Response.json(++calls===1?{items:[{id:'writer',accessRole:'writer'},{id:'gone',accessRole:'owner',deleted:true}],nextPageToken:'next'}:{items:[{id:'mine',accessRole:'owner'}]})
  assert.deepEqual((await google.getOwnedCalendars('mock')).map(c=>c.id),['mine']);assert.equal(calls,2);mockGoogle()
})
test('Google permission failures require re-consent',async()=>{
  global.fetch=async()=>new Response('',{status:403})
  await assert.rejects(()=>google.getOwnedCalendars('mock'),e=>e.code==='GOOGLE_CALENDAR_SCOPE_MISSING');mockGoogle()
})
test('review endpoints reject unauthenticated users and other users',async()=>{
  setup();fixture.user=null;assert.equal((await reviewRoute.GET(request({}),context())).status,401)
  fixture.user={id:'bob'};assert.equal((await reviewRoute.GET(request({}),context())).status,404)
  assert.equal((await reviewRoute.PATCH(request({revision:0,draft:draft()},'PATCH'),context())).status,404)
  assert.equal((await importRoute.POST(request({revision:0}),context())).status,404)
})
test('save restores edits, preserves source metadata, and rejects stale tabs',async()=>{
  setup();const d=draft();d.events[0].title='Edited';d.events[0].sourceColor='#ffffff';d.events[1].included=false
  assert.equal((await reviewRoute.PATCH(request({revision:0,draft:d},'PATCH'),context())).status,200)
  const restored=await(await reviewRoute.GET(request({}),context())).json()
  assert.equal(restored.draft.events[0].title,'Edited');assert.equal(restored.draft.events[0].sourceColor,'#46d6db');assert.equal(restored.draft.events[1].included,false)
  assert.equal((await reviewRoute.PATCH(request({revision:0,draft:d},'PATCH'),context())).status,409)
  assert.equal(fixture.writes.length,0)
})
test('deleted destination is rejected without enqueue or freeze',async()=>{
  const r=setup();fixture.owner=false
  assert.equal((await importRoute.POST(request({revision:0}),context())).status,409)
  assert.equal(r.confirmed,null);assert.equal(fixture.invocations.length,0)
})
test('double confirmation freezes one snapshot and enqueues once',async()=>{
  const r=setup();r.draft.events[1].included=false
  const replies=await Promise.all([importRoute.POST(request({revision:0}),context()),importRoute.POST(request({revision:0}),context())])
  assert.ok(replies.some(r=>r.status===202));assert.equal(fixture.invocations.length,1)
  assert.equal(r.confirmed.events.filter(e=>e.included).length,1)
  assert.equal((await reviewRoute.PATCH(request({revision:0,draft:draft()},'PATCH'),context())).status,409)
})
test('review analysis stores an isolated draft, emails the review link, and makes zero Google writes or completion mails',async()=>{
  const r=setup();r.state='analyzing';fixture.tables.jobs[0].status='processing';fixture.tables.calendar_imports[0].draft.events=[]
  await worker.handler({action:'analyze',jobId:r.job_id,userId:'alice',r2ObjectKey:'sample.png'})
  assert.equal(r.state,'ready');assert.equal(fixture.tables.jobs[0].status,'awaiting_confirmation');assert.equal(r.source_events[0].sourceColor,'#46d6db')
  assert.equal(fixture.writes.length,0);assert.equal(fixture.tokenCalls,0);assert.equal(fixture.emails.length,1);assert.match(fixture.emails[0].subject,/解析が完了/);assert.match(fixture.emails[0].text,new RegExp('/ja/jobs/'+r.job_id+'/review'))
  assert.equal(fixture.tables.parsed_pdfs[0].extracted_json.events[0].included,undefined) // parser output is source data; no user edits are added
  assert.ok(fixture.tables.parsed_pdfs[0].pdf_hash.endsWith('_colors_v1'))
})
test('registration failure stays failed; retry uses the frozen content and only success notifies',async()=>{
  const r=setup();r.state='registering';r.confirmed=draft();r.confirmed.events[1].included=false;fixture.fail=true
  await worker.handler({action:'register',jobId:r.job_id,userId:'alice'})
  assert.equal(r.state,'error');assert.equal(fixture.tables.jobs[0].status,'error');assert.equal(fixture.emails.length,1);assert.match(fixture.emails[0].subject,/失敗/)
  r.state='registering';fixture.fail=false
  await worker.handler({action:'register',jobId:r.job_id,userId:'alice'})
  assert.equal(r.state,'completed');assert.equal(fixture.emails.length,2);assert.equal(fixture.writes[1][1].length,1);assert.equal(fixture.writes[1][5],'owned')
  await worker.handler({action:'register',jobId:r.job_id,userId:'alice'});assert.equal(fixture.writes.length,2)
})
test('batch retries partial writes with stable IDs, destination and colors on insert/update',async()=>{
  setup();const events=source().map(e=>({...e,colorId:'7'}));const stored=new Map();let fail=true;const writes=[]
  const fake={events:{insert:async p=>{writes.push(p);if(stored.has(p.requestBody.id))throw {code:409};if(stored.size===1&&fail)throw {code:503};stored.set(p.requestBody.id,p.requestBody)},update:async p=>{writes.push(p);stored.set(p.eventId,p.requestBody)}}}
  await assert.rejects(()=>calendar.batchInsertGarbageEvents('token',events,'hash',undefined,undefined,'owned',fake))
  assert.equal(stored.size,1);fail=false
  await calendar.batchInsertGarbageEvents('token',events,'hash',undefined,undefined,'owned',fake)
  assert.equal(stored.size,2);assert.ok(writes.every(p=>p.calendarId==='owned'&&p.requestBody.colorId==='7'))
})
test('parser preserves detected category colors and leaves monochrome/manual colors absent',async()=>{
  const {GeminiAutoParser,parseManualGarbageInstruction}=require('../lambda/src/parsers/gemini.ts')
  const sample=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/garbage_calendar.png'))
  visionResponse={isCalendar:true,isGarbageCalendar:true,events:[{date:'2026-11-09',title:'Paper'}],typeColors:{Paper:'#46D6DB',Invalid:'pink'}}
  const color=await new GeminiAutoParser('ja').parse(sample,'image/png')
  assert.deepEqual(color.typeColors,{Paper:'#46d6db'});assert.match(visionPrompt[0],/Do not infer colors/)
  visionResponse={...visionResponse,typeColors:{}}
  const mono=await new GeminiAutoParser('en').parse(Buffer.from('monochrome fixture'),'image/png')
  assert.deepEqual(mono.typeColors,{});assert.equal(model.createSourceEvents(mono.events,mono.typeColors)[0].sourceColor,null)
  const manual=await parseManualGarbageInstruction('Every Monday paper','2026-04-01','2027-03-31','en')
  assert.equal(model.createSourceEvents(manual.events,manual.typeColors)[0].colorId,null)
})
test('worker revalidates ownership after confirmation before any writes',async()=>{
  const r=setup();r.state='registering';r.confirmed=draft();fixture.owner=false
  await worker.handler({action:'register',jobId:r.job_id,userId:'alice'})
  assert.equal(r.state,'error');assert.equal(r.error,'CALENDAR_NOT_FOUND');assert.equal(fixture.writes.length,0)
})
test('worker resumes after durable checkpoints and does not resend completed rows',async()=>{
  const r=setup();r.state='registering';r.confirmed=draft();r.registered_count=1
  await worker.handler({action:'register',jobId:r.job_id,userId:'alice'})
  assert.equal(fixture.writes[0][1].length,1);assert.equal(fixture.writes[0][1][0].id,'1');assert.equal(r.state,'completed')
})
test('mutating endpoints reject cross-origin and malformed input',async()=>{
 setup();const r=request({revision:0,draft:draft()},'PATCH');r.headers.set('origin','https://other.example');assert.equal((await reviewRoute.PATCH(r,context())).status,403)
 assert.equal((await importRoute.POST(request(null),context())).status,400)
 const malformed=new Request('http://localhost/api/test',{method:'POST',body:'{',headers:{'Content-Type':'application/json'}})
 assert.equal((await importRoute.POST(malformed,context())).status,400)
})
test('LINE and collection searches use edited confirmed events, excluding unchecked rows',async()=>{
  const r=setup();r.state='completed';r.confirmed=draft();r.confirmed.events[0].title='Changed';r.confirmed.events[1].included=false
  const result=await sourceHelper.loadUserCalendarEvents(fixture.db,'alice',fixture.tables.jobs[0])
  assert.deepEqual(result.events.map(e=>e.title),['Changed']);assert.equal(result.lang,'ja')
  r.state='registering';assert.equal(await sourceHelper.loadUserCalendarEvents(fixture.db,'alice',fixture.tables.jobs[0]),null)
})
test('auto mode freezes primary-calendar contents and dispatches registration without review mail',async()=>{
 const r=setup();r.state='analyzing';r.registration_mode='auto'
 await worker.handler({action:'analyze',jobId:r.job_id,userId:'alice',r2ObjectKey:'sample.png'})
 assert.equal(r.state,'registering');assert.equal(r.confirmed.calendarId,'primary');assert.equal(fixture.dispatches.length,1)
 assert.equal(fixture.emails.length,0);assert.equal(fixture.writes.length,0)
 fixture.owner=false // Calendar-list scope is intentionally unnecessary for own primary calendar.
 await worker.handler({action:'register',jobId:r.job_id,userId:'alice'})
 assert.equal(r.state,'completed');assert.equal(fixture.writes[0][5],'primary');assert.equal(fixture.emails.length,1)
})
test('ready-email retries preserve the saved payload/key and do not repeat analysis or duplicate successful email',async()=>{
 const r=setup();r.state='analyzing';fixture.mailFail=true
 const event={action:'analyze',jobId:r.job_id,userId:'alice',r2ObjectKey:'sample.png'}
 await assert.rejects(()=>worker.handler(event),/EMAIL_PROVIDER_REJECTED/)
 assert.equal(r.state,'ready');assert.equal(fixture.tables.jobs[0].status,'awaiting_confirmation');assert.equal(fixture.parseCalls,1)
 const first=clone(fixture.emailRequests[0]);fixture.mailFail=false
 await worker.handler(event);await worker.handler(event)
 assert.equal(fixture.parseCalls,1);assert.equal(fixture.emails.length,1)
 assert.deepEqual(fixture.emailRequests[1],first)
 assert.equal(fixture.tables.calendar_import_tasks[0].email_status,'sent')
})
test('notification text is localized and document titles are safely escaped',()=>{
 const email=followup.buildReadyEmail('test@example.test','job','en','<script>example</script>','https://gomicale.jp')
 assert.match(email.subject,/ready to review/);assert.ok(!email.html.includes('<script>'));assert.match(email.html,/&lt;script&gt;/)
 assert.match(email.text,/not been added/);assert.match(email.text,/\/en\/jobs\/job\/review/)
})
test('internal dispatch rejects missing, wrong and cross-job credentials; requires an already-confirmed import',async()=>{
 const r=setup();const task={job_id:r.job_id,dispatch_token:'00000000-0000-4000-8000-000000000077'};fixture.tables.calendar_import_tasks=[task]
 assert.equal((await internalRoute.POST(request({jobId:r.job_id}))).status,401)
 const authorized=()=>{const req=request({jobId:r.job_id});req.headers.set('authorization','Bearer '+task.dispatch_token);return req}
 assert.equal((await internalRoute.POST(authorized())).status,403)
 r.registration_mode='auto';r.state='registering';r.confirmed={...draft(),calendarId:'primary'}
 const bad=authorized();bad.headers.set('authorization','Bearer 00000000-0000-4000-8000-000000000099');assert.equal((await internalRoute.POST(bad)).status,401)
 assert.equal((await internalRoute.POST(authorized())).status,202);assert.equal(fixture.invocations.length,1)
 const payload=JSON.parse(fixture.invocations[0].Payload.toString());assert.equal(payload.userId,'alice');assert.equal(payload.action,'register')
})
test('a transient automatic dispatch failure retries without reparsing or changing frozen contents',async()=>{
 const r=setup();r.registration_mode='auto';r.state='analyzing';fixture.dispatchFailOnce=true
 const event={action:'analyze',jobId:r.job_id,userId:'alice',r2ObjectKey:'sample.png'}
 await worker.handler(event)
 assert.equal(r.state,'registering');assert.equal(r.confirmed.calendarId,'primary');assert.equal(fixture.parseCalls,1);assert.equal(fixture.dispatches.length,2)
})
test('server defaults old callers to review and validates explicit registration mode',async()=>{
 const r=setup();fixture.tables.calendar_imports=[];fixture.tables.jobs[0].status='pending'
 assert.equal((await startRoute.POST(request({jobId:r.job_id,registrationMode:'invalid'}))).status,400)
 assert.equal((await startRoute.POST(request({jobId:r.job_id,registrationMode:'auto'}))).status,200)
 assert.equal(fixture.tables.calendar_imports[0].registration_mode,'auto')
 setup();fixture.tables.calendar_imports=[];fixture.tables.jobs[0].status='pending'
 assert.equal((await startRoute.POST(request({jobId:r.job_id}))).status,200)
 assert.equal(fixture.tables.calendar_imports[0].registration_mode,'review')
})
test('exhausted dispatch retries become an actionable error and preserve the frozen selection',async()=>{
 const r=setup();r.state='analyzing';r.registration_mode='auto';fixture.dispatchFail=true
 const event={action:'analyze',jobId:r.job_id,userId:'alice',r2ObjectKey:'sample.png'}
 await assert.rejects(()=>worker.handler(event),/AUTO_DISPATCH_FAILED/);assert.equal(fixture.dispatches.length,3)
 assert.equal(r.state,'error');assert.equal(r.error,'AUTO_DISPATCH_FAILED');assert.equal(r.confirmed.calendarId,'primary')
 assert.equal(fixture.tables.jobs[0].status,'error');assert.equal(fixture.parseCalls,1);assert.equal(fixture.emails.length,1)
})
test('time-budget exhaustion continues from a checkpoint without a failure or completion email',async()=>{
 const r=setup();r.state='registering';r.registration_mode='auto';r.confirmed={...draft(),calendarId:'primary'};fixture.pause=true
 await worker.handler({action:'register',jobId:r.job_id,userId:'alice'})
 assert.equal(r.state,'registering');assert.equal(r.lease_token,null);assert.equal(r.registered_count,1);assert.equal(fixture.dispatches.length,1);assert.equal(fixture.emails.length,0)
 await worker.handler({action:'register',jobId:r.job_id,userId:'alice'})
 assert.equal(r.state,'completed');assert.equal(fixture.writes[1][1].length,1);assert.equal(fixture.emails.length,1)
})
test('private dispatch also resumes a user-confirmed review import, without bypassing confirmation',async()=>{
 const r=setup();r.state='registering';r.confirmed=draft();const secret='00000000-0000-4000-8000-000000000077'
 fixture.tables.calendar_import_tasks=[{job_id:r.job_id,dispatch_token:secret}]
 const req=request({jobId:r.job_id});req.headers.set('authorization','Bearer '+secret)
 assert.equal((await internalRoute.POST(req)).status,202);assert.equal(fixture.invocations.length,1)
})
test('review API exposes mail status without exposing delivery payloads or dispatch credentials',async()=>{
 const r=setup();fixture.tables.calendar_import_tasks=[{job_id:r.job_id,dispatch_token:'secret',email_payload:{to:'private@example.test'},email_status:'pending',email_first_attempt_at:null}]
 let data=await(await reviewRoute.GET(request({}),context())).json()
 assert.equal(data.ready_email_status,null);assert.ok(!('dispatch_token' in data));assert.ok(!('email_payload' in data))
 fixture.tables.calendar_import_tasks[0].email_first_attempt_at=new Date().toISOString();fixture.tables.calendar_import_tasks[0].email_status='sent'
 data=await(await reviewRoute.GET(request({}),context())).json();assert.equal(data.ready_email_status,'sent')
})
test('expired unconfirmed email requests are never resent',async()=>{
 const r=setup();const task={job_id:r.job_id,dispatch_token:'token',email_status:'failed',email_payload:{from:'test',to:'test',subject:'Ready',text:'Ready',html:'Ready'},email_first_attempt_at:new Date(Date.now()-25*3600000).toISOString()};fixture.tables.calendar_import_tasks=[task]
 await followup.sendReadyEmail(fixture.db,r,'Title','https://gomicale.jp')
 assert.equal(fixture.emailRequests.length,0);assert.equal(task.email_error_code,'IDEMPOTENCY_EXPIRED')
})
test.after(()=>{global.fetch=originalFetch;Module._load=load})
