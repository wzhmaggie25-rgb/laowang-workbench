import test from 'node:test'
import assert from 'node:assert/strict'
import {moveCard, buildMonth, entryDayKey, dayKey, platformSummary} from '../src/client/order.ts'

test('moveCard inserts the dragged card at the target position and keeps others stable',()=>{
 assert.deepEqual(moveCard(['douyin','xiaohongshu','tencent'],'douyin','tencent'),['xiaohongshu','tencent','douyin'])
 assert.deepEqual(moveCard(['douyin','xiaohongshu','tencent'],'tencent','douyin'),['tencent','douyin','xiaohongshu'])
 assert.deepEqual(moveCard(['douyin','xiaohongshu','tencent'],'douyin','douyin'),['douyin','xiaohongshu','tencent'])
 // 目标不在顺序表（未登记平台）时原样返回，不悄悄重排。
 assert.deepEqual(moveCard(['douyin','xiaohongshu'],'douyin','kuaishou'),['douyin','xiaohongshu'])
 // 顺序表里的未知 id（历史残留）保留在末尾。
 assert.deepEqual(moveCard(['douyin','legacy','tencent'],'tencent','douyin'),['tencent','douyin','legacy'])
})

test('buildMonth produces a Monday-first grid with leading blanks and no trailing month days',()=>{
 const cells=buildMonth(new Date(2026,9,24)) // 2026-10，10-1 是周四
 assert.equal(cells.filter(c=>c.day===null).length,4) // 前导 3 个 + 收尾补 1 个
 assert.equal(cells[3].day,1)
 assert.equal(cells[3].key,'2026-10-01')
 assert.equal(cells.find(c=>c.day===24).key,'2026-10-24')
 assert.equal(cells[33].day,31)
 assert.ok(cells.slice(34).every(c=>c.day===null))
})

test('entryDayKey prefers the schedule date, then submission, then update time',()=>{
 const base={request:{platform:'xiaohongshu',account:'default',kind:'note',title:'t',media:['C:/x.png']},key:'k',prepareId:'p',digest:'d',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-02T00:00:00Z',deviations:[]}
 assert.equal(entryDayKey({...base,status:'scheduled',request:{...base.request,scheduleAt:'2026-10-26 09:00'}}),'2026-10-26')
 assert.equal(entryDayKey({...base,status:'submitted',submittedAt:'2026-10-24T01:12:00Z'}),'2026-10-24')
 assert.equal(entryDayKey({...base,status:'unknown'}),'2026-10-02')
 assert.equal(dayKey(new Date(2026,0,5)),'2026-01-05')
})

test('platformSummary states kinds, scheduling and the upstream limitation verbatim',()=>{
 assert.equal(platformSummary({id:'tencent',adapter:'sau',sauName:'tencent',kinds:['video'],scheduling:'sau',acceptance:'pending'}),'video · 支持定时')
 assert.equal(platformSummary({id:'bilibili',adapter:'sau',sauName:'bilibili',kinds:['video'],scheduling:'sau',blocked:'需要 --tid 分区参数，未接'}),'video · 需要 --tid 分区参数，未接')
})
