import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {weightedLength,checkDraft,rulesFor} from '../src/rules.ts'
import {AssistantStore,parseSrt} from '../src/assistant.ts'

test('weightedLength follows X rules: CJK=2, URL=23, plain ASCII=1',()=>{
 assert.equal(weightedLength('ok'),2)
 assert.equal(weightedLength('中文'),4)
 // 「看这个 」「  很好用」= 6 个汉字(12) + 2 空格(2)，URL 折算 23。
 assert.equal(weightedLength('看这个 https://example.com/abc 很好用'),12+2+23)
 assert.equal(weightedLength('👍👍'),2)
})

test('checkDraft flags hard and advise limits separately',()=>{
 const hard=checkDraft('xiaohongshu','note',{title:'一'.repeat(21),body:''})
 assert.equal(hard.find(check=>check.field==='title')?.exceeded,true)
 assert.equal(hard.find(check=>check.field==='title')?.level,'hard')
 const body=checkDraft('xiaohongshu','note',{title:'短',body:'x'.repeat(1001)})
 assert.equal(body.find(check=>check.field==='body')?.exceeded,true)
 assert.equal(body.find(check=>check.field==='body')?.level,'advise')
 const digest=checkDraft('gongzhonghao','article',{title:'t',digest:'摘'.repeat(121),body:''})
 assert.equal(digest.find(check=>check.field==='digest')?.exceeded,true)
})

test('parseSrt strips indices, timestamps and merges lines',()=>{
 const srt='1\n00:00:01,000 --> 00:00:02,000\n大家好\n今天讲发布\n\n2\n00:00:02,500 --> 00:00:04,000\n第二段\n'
 assert.equal(parseSrt(srt),'大家好今天讲发布\n第二段')
})

test('draft store: revision fence rejects stale save; edited fields survive generation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'publish-assist-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const store=new AssistantStore(dir)
 const material=await store.createDraft({kind:'paste',text:'素材正文',origin:'粘贴'})
 assert.equal((await store.getMaterial(material.draftId))?.contentHash,material.contentHash)
 // 生成落字段
 const first=await store.applyGeneration(material.draftId,'xiaohongshu','note',{title:'AI 标题',body:'AI 正文'},'g1')
 assert.equal(first.draft.fields.title.text,'AI 标题')
 // 用户改 title（edited）
 const saved=await store.savePlatformDraft(material.draftId,'xiaohongshu','note',{title:{text:'我的标题',edited:true}},first.draft.revision)
 assert.notEqual(saved,false)
 // 陈旧 revision 拒绝
 const stale=await store.savePlatformDraft(material.draftId,'xiaohongshu','note',{body:{text:'迟到保存',edited:true}},first.draft.revision)
 assert.equal(stale,false)
 // 再生成：edited 的 title 被保护
 const second=await store.applyGeneration(material.draftId,'xiaohongshu','note',{title:'新 AI 标题',body:'新正文'},'g2')
 assert.equal(second.draft.fields.title.text,'我的标题')
 assert.deepEqual(second.protectedFields,['title'])
 assert.equal(second.draft.fields.body.text,'新正文')
})

test('manual record binds snapshot; unmark keeps history',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'publish-assist-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const store=new AssistantStore(dir)
 const material=await store.createDraft({kind:'paste',text:'素材',origin:'粘贴'})
 await store.applyGeneration(material.draftId,'gongzhonghao','article',{title:'标题',digest:'摘要',body:'正文'},'g1')
 const marked=await store.markPublished({draftId:material.draftId,platform:'gongzhonghao',snapshot:{title:'标题',digest:'摘要',body:'正文'},materialHash:material.contentHash,link:'https://example.com/p/1'})
 assert.equal(marked.link,'https://example.com/p/1')
 // 标记后改稿：快照不跟变
 await store.applyGeneration(material.draftId,'gongzhonghao','article',{title:'改后标题'},'g2')
 const records=await store.manualRecords(material.draftId)
 assert.equal(records[0].snapshot.title,'标题')
 const unmarked=await store.unmarkPublished(material.draftId,'gongzhonghao')
 assert.ok(unmarked?.unmarkedAt)
 assert.equal((await store.listManual()).length,1)
})

test('rules table records source and level for auditability',()=>{
 for(const rule of ['xiaohongshu','gongzhonghao']){
  const spec=rulesFor(rule,rule==='xiaohongshu'?'note':'article')
  assert.ok(spec)
  for(const length of spec.lengths){
   assert.ok(length.source.length>0)
   assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(length.verifiedAt))
   assert.ok(length.level==='hard'||length.level==='advise')
  }
 }
})
