import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PublishRuntime} from '../src/runtime.ts'
import {Ledger} from '../src/ledger.ts'
import {XhsAdapter} from '../src/adapters/xhs.ts'
function config(){return {accounts:[{platform:'xiaohongshu',name:'default'}],xhsBaseUrl:'http://offline.invalid',sauBin:'never-run',requireApproval:true,approvalTimeoutSec:300,dailyLimit:0,dailyTimeZone:'Asia/Shanghai',allowedPlatforms:[],allowedAccounts:[],headed:false,httpTimeoutMs:1000,publishTimeoutMs:1000,showSidebar:true,publishingEnabled:true,maxMediaBytes:1024}}
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'publish-behavior-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const media=join(dir,'image.png');await writeFile(media,'original')
 const ledger=new Ledger(join(dir,'ledger.json'));await ledger.reconcileOnStart()
 const done=[];let starts=0
 const ctx={jobs:{start(spec){starts++;const hooks=spec.run({});done.push(hooks.done);return 'publish-'+starts}}}
 const runtime=new PublishRuntime(ctx,ledger,config);t.after(()=>runtime.dispose())
 const plan=await runtime.prepare({platform:'xiaohongshu',account:'default',kind:'note',title:'测试',body:'正文',media:[media]})
 return {runtime,ledger,plan,media,done,starts:()=>starts}
}
test('logged-out response never becomes a valid account because success is true',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({success:true,data:{is_logged_in:false},message:'获取登录状态成功'}))
 assert.equal((await new XhsAdapter({baseUrl:'http://offline.invalid',timeoutMs:1000}).loginStatus()).loggedIn,false)
})
test('two concurrent submissions create only one upload',async t=>{
 let posted=0;t.mock.method(globalThis,'fetch',async()=>{posted++;return Response.json({success:true,message:'发布完成'})})
 const f=await fixture(t);let allow
 const first=f.runtime.submit(f.plan.prepareId,{signal:new AbortController().signal,source:'page',approve:()=>new Promise(resolve=>{allow=resolve})})
 while(!allow)await new Promise(resolve=>setImmediate(resolve))
 const second=await f.runtime.submit(f.plan.prepareId,{signal:new AbortController().signal,source:'page',approve:async()=>true})
 assert.equal(second.accepted,false)
 allow(true);assert.equal((await first).accepted,true);await Promise.all(f.done)
 assert.equal(f.starts(),1);assert.equal(posted,1);assert.equal((await f.ledger.byPrepare(f.plan.prepareId)).status,'submitted')
})
test('media changed during confirmation prevents the upload',async t=>{
 const f=await fixture(t);let allow
 const result=f.runtime.submit(f.plan.prepareId,{signal:new AbortController().signal,source:'page',approve:()=>new Promise(resolve=>{allow=resolve})})
 while(!allow)await new Promise(resolve=>setImmediate(resolve))
 await writeFile(f.media,'changed');allow(true)
 await assert.rejects(result,/发生变化/);assert.equal(f.starts(),0)
})
test('cancellation while awaiting approval cannot launch a job later',async t=>{
 const f=await fixture(t),abort=new AbortController();let allow
 const result=f.runtime.submit(f.plan.prepareId,{signal:abort.signal,source:'tool',approve:()=>new Promise(resolve=>{allow=resolve})})
 while(!allow)await new Promise(resolve=>setImmediate(resolve))
 abort.abort();allow(true)
 await assert.rejects(result);assert.equal(f.starts(),0)
})
test('lost response records unknown and never claims that publication failed',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('lost response')})
 const f=await fixture(t)
 await f.runtime.submit(f.plan.prepareId,{signal:new AbortController().signal,source:'page',approve:async()=>true})
 await Promise.all(f.done)
 assert.equal((await f.ledger.byPrepare(f.plan.prepareId)).status,'unknown')
})
test('pausing publishing rejects new plans',async t=>{
 const f=await fixture(t),paused=new PublishRuntime({jobs:{}},f.ledger,()=>({...config(),publishingEnabled:false}))
 await assert.rejects(paused.prepare({platform:'xiaohongshu',account:'default',kind:'note',title:'暂停',media:[f.media]}),/停用/)
})
async function quotaFixture(t,cfgPatch={}){
 const dir=await mkdtemp(join(tmpdir(),'publish-quota-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const media=join(dir,'image.png');await writeFile(media,'original')
 const ledger=new Ledger(join(dir,'ledger.json'));await ledger.reconcileOnStart()
 const done=[];let starts=0
 const ctx={jobs:{start(spec){starts++;const hooks=spec.run({});done.push(hooks.done);return 'publish-'+starts}}}
 const runtime=new PublishRuntime(ctx,ledger,()=>({...config(),...cfgPatch}));t.after(()=>runtime.dispose())
 const prepare=title=>runtime.prepare({platform:'xiaohongshu',account:'default',kind:'note',title,body:'正文',media:[media]})
 return {runtime,ledger,prepare,media,done}
}
test('daily quota rejects the second concurrent submission while the first is admitted',async t=>{
 let posted=0;t.mock.method(globalThis,'fetch',async()=>{posted++;return Response.json({success:true,message:'发布完成'})})
 const f=await quotaFixture(t,{dailyLimit:1})
 const first=await f.prepare('第一条'),second=await f.prepare('第二条')
 let allowFirst,allowSecond
 const submitFirst=f.runtime.submit(first.prepareId,{signal:new AbortController().signal,source:'page',approve:()=>new Promise(resolve=>{allowFirst=resolve})})
 const submitSecond=f.runtime.submit(second.prepareId,{signal:new AbortController().signal,source:'page',approve:()=>new Promise(resolve=>{allowSecond=resolve})})
 while(!allowFirst||!allowSecond)await new Promise(resolve=>setImmediate(resolve))
 // 先挂上拒绝处理器再放行审批门，避免提交在等待期间拒绝成为 unhandled rejection。
 const secondRejected=assert.rejects(submitSecond,/已达当日发布上限/)
 allowFirst(true);allowSecond(true)
 assert.equal((await submitFirst).accepted,true)
 await secondRejected
 await Promise.all(f.done)
 assert.equal(posted,1)
 assert.equal(['submitted','published'].includes((await f.ledger.byPrepare(first.prepareId)).status),true)
 assert.equal((await f.ledger.byPrepare(second.prepareId)).status,'prepared')
})
test('submitted and unknown results still count toward the daily limit',async t=>{
 let posted=0;t.mock.method(globalThis,'fetch',async()=>{posted++;if(posted===1)return Response.json({success:true,message:'发布完成'});throw new Error('lost response')})
 const f=await quotaFixture(t,{dailyLimit:1})
 const first=await f.prepare('已核实'),second=await f.prepare('待核实'),third=await f.prepare('再一条')
 await f.runtime.submit(first.prepareId,{signal:new AbortController().signal,source:'page',approve:async()=>true})
 await Promise.all(f.done)
 await assert.rejects(f.runtime.submit(third.prepareId,{signal:new AbortController().signal,source:'page',approve:async()=>true}),/已达当日发布上限/)
 // 已提交待核实的结果占用配额；unknown 同样占用，不得因为结果未知就放开重发。
 await f.ledger.update((await f.ledger.byPrepare(first.prepareId)).key,{status:'unknown'})
 await assert.rejects(f.runtime.submit(second.prepareId,{signal:new AbortController().signal,source:'page',approve:async()=>true}),/已达当日发布上限/)
 assert.equal(posted,1)
})
test('prepared records from a previous day do not count toward today',async t=>{
 let posted=0;t.mock.method(globalThis,'fetch',async()=>{posted++;return Response.json({success:true,message:'发布完成'})})
 const f=await quotaFixture(t,{dailyLimit:1})
 await f.ledger.insert({key:'xiaohongshu|default|old',prepareId:'prep_old',digest:'old',request:{platform:'xiaohongshu',account:'default',kind:'note',title:'旧记录',media:[f.media]},status:'prepared',createdAt:'2020-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z',deviations:[]})
 const plan=await f.prepare('今天第一条')
 await f.runtime.submit(plan.prepareId,{signal:new AbortController().signal,source:'page',approve:async()=>true})
 await Promise.all(f.done)
 assert.equal(posted,1)
})
test('v0.1 ledger rows are adopted once and the legacy file is kept untouched',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'publish-migrate-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const legacy=join(dir,'legacy.json'),current=join(dir,'current.json')
 const row={key:'xiaohongshu|default|migrated',prepareId:'prep_old',digest:'migrated',request:{platform:'xiaohongshu',account:'default',kind:'note',title:'旧台账',media:['C:/x.png']},status:'unknown',createdAt:'2020-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z'}
 await writeFile(legacy,JSON.stringify({version:1,entries:[row]}))
 const ledger=new Ledger(current)
 assert.equal(await ledger.adoptLegacy(legacy),1)
 assert.equal((await ledger.byPrepare('prep_old')).key,row.key)
 assert.equal(await ledger.adoptLegacy(legacy),0)
 const again=new Ledger(current)
 assert.equal(await again.adoptLegacy(legacy),0)
 assert.equal((await again.list(10)).length,1)
 assert.equal(await readFile(legacy,'utf8'),JSON.stringify({version:1,entries:[row]}))
})
