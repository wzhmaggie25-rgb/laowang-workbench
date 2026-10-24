import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MetricsStore,matchByTitle,latestSnapshot,SNAPSHOT_LIMIT} from '../src/metrics.ts'

test('matchByTitle only accepts an unambiguous exact title',()=>{
 const ambiguous=[{noteId:'a',xsecToken:'ta',title:' 秋日咖啡 '},{noteId:'b',xsecToken:'tb',title:'秋日咖啡'}]
 assert.equal(matchByTitle(ambiguous,'秋日咖啡'),undefined)
 const unique=[{noteId:'a',xsecToken:'ta',title:'秋日咖啡'},{noteId:'c',xsecToken:'tc',title:'别的'}]
 assert.equal(matchByTitle(unique,'秋日咖啡')?.noteId,'a')
 assert.equal(matchByTitle(unique,'不存在的标题'),undefined)
})

test('metrics store binds, snapshots with a cap, and unbinds',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'publish-metrics-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const store=new MetricsStore(join(dir,'metrics.json'))
 await store.bind('k1',{noteId:'n1',xsecToken:'t',title:'标题',boundAt:'2026-10-24T00:00:00Z',method:'auto'})
 assert.equal((await store.get('k1'))?.noteRef.method,'auto')
 for(let i=0;i<SNAPSHOT_LIMIT+5;i++)await store.pushSnapshot('k1',{likes:i})
 const metrics=await store.get('k1')
 assert.equal(metrics.snapshots.length,SNAPSHOT_LIMIT)
 assert.equal(metrics.snapshots.at(-1).likes,SNAPSHOT_LIMIT+4)
 assert.equal(latestSnapshot(metrics)?.likes,SNAPSHOT_LIMIT+4)
 await store.unbind('k1')
 assert.equal(await store.get('k1'),undefined)
 // 未绑定 key 的快照写入被忽略；落盘文件保持 version 1。
 await store.pushSnapshot('k1',{likes:1})
 const raw=JSON.parse(await readFile(join(dir,'metrics.json'),'utf8'))
 assert.equal(raw.version,1)
 assert.equal(Object.keys(raw.notes).length,0)
})
