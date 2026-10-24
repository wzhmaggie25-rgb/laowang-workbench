/** 平台详情：单平台的发布表单（按内容形态自适应）、记录、日历与数据回采。 */
import { useEffect } from 'react'
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LedgerEntry } from '../types.ts'
import type { FaceProps } from './common.tsx'
import { Calendar, PlatformIcon, RecordRow, statusLabel } from './common.tsx'
import { platformLabel } from './locales.ts'
import { statusColor } from './order.ts'
import type { PlatformSpec } from '../platforms.ts'
import type { PageData } from './model.ts'

/** 可以关联笔记做数据回采的状态：还没排期/没提交成功的不算。 */
const BINDABLE:readonly string[]=['submitted','published','unknown']

export function PlatformDetail({state,face,t,month,data}:FaceProps&{month:Date;data:PageData}){
 const platform=state.view.view==='platform'?state.view.platform:undefined
 if(!platform)return null
 const spec=data.platforms.find(p=>p.id===platform)
 if(!spec)return null
 const accounts=data.configuredAccounts.filter(a=>a.platform===platform)
 const records=data.entries.filter(e=>e.request.platform===platform&&(!state.detailAccount||e.request.account===state.detailAccount))
 const accountStates=state.accounts?.filter(s=>s.platform===platform)??[]
 const loginChip=accounts.length===0?null
  :accountStates.length===0?<span className="chip c-muted">{t('notChecked')}</span>
  :accountStates.some(s=>s.status==='invalid')?<span className="chip c-unknown">{t('invalid')}</span>
  :<span className="chip c-ok">{t('valid')}</span>
 const platformEntries=data.entries.filter(e=>e.request.platform===platform)
 const legend=[...new Set(platformEntries.map(e=>e.status))].map(status=>({color:statusColor(status),label:statusLabel(status,t)}))
 useEffect(()=>{
  if(platform==='xiaohongshu'&&!spec.blocked)face.loadMetrics()
 },[platform,spec.blocked,face])
 return <div className="publish-detail">
  <div className="publish-detail-head">
   <Button variant="outline" onClick={face.backHome}>{t('backToOverview')}</Button>
   <PlatformIcon id={platform} size={34}/>
   <div className="publish-who">
    <strong>{platformLabel(platform,t)}</strong>
    <select value={state.detailAccount??''} onChange={e=>face.setDetailAccount(e.target.value)} aria-label={t('account')}>
     <option value="">{t('allAccounts')}</option>
     {accounts.map(a=><option key={a.name} value={a.name}>{a.name}</option>)}
    </select>
    {loginChip}
    {spec.acceptance==='pending'&&<span className="chip c-warn">{t('pendingAcceptance')}</span>}
   </div>
   <div className="publish-detail-acts">
    <Button variant="outline" onClick={face.check} disabled={state.busy}>{state.busy?t('checking'):t('checkAccounts')}</Button>
   </div>
  </div>
  {spec.blocked
   ?<section className="publish-section"><p className="publish-na">{spec.blocked}</p></section>
   :accounts.length===0
   ?<section className="publish-section"><p className="publish-na">{t('noAccounts')}</p><Button onClick={()=>face.setTab('accounts')}>{t('addAccount')}</Button></section>
   :<ComposeSection state={state} face={face} t={t} spec={spec} data={data}/>}
  <div className="publish-detail-cols">
   <section className="publish-section publish-records">
    <h2>{t('tasks')}<span className="chip c-muted">{t('platformOnly')}</span></h2>
    {records.length===0?<div className="publish-empty">{t('empty')}</div>:records.map(entry=><RecordRow key={entry.prepareId} entry={entry} t={t}/>)}
   </section>
   <div className="publish-side">
    {platform==='xiaohongshu'&&!spec.blocked&&<DataCenter state={state} face={face} t={t} data={data}/>}
    <div className="publish-sidebox">
     <Calendar entries={platformEntries} colorFor={e=>statusColor(e.status)} onSelect={()=>{}} interactive={false} month={month} title={t('monthRhythm')} legend={legend} t={t}/>
    </div>
   </div>
  </div>
 </div>
}

/** 数据中心：已发布记录 ↔ 平台笔记的关联与互动数据回采（上游无播放量，只有赞/藏/评/享）。 */
function DataCenter({state,face,t,data}:{state:FaceProps['state'];face:FaceProps['face'];t:FaceProps['t'];data:PageData}){
 const eligible=data.entries.filter(entry=>entry.request.platform==='xiaohongshu'&&BINDABLE.includes(entry.status))
 const metricsOf=(entry:LedgerEntry)=>state.metrics?.[entry.key]
 const bound=eligible.filter(entry=>metricsOf(entry)?.noteRef)
 const unbound=eligible.filter(entry=>!metricsOf(entry)?.noteRef)
 const totals={likes:0,collects:0,comments:0,shares:0}
 for(const entry of bound){
  const latest=metricsOf(entry)?.snapshots.at(-1)
  totals.likes+=latest?.likes??0;totals.collects+=latest?.collects??0
  totals.comments+=latest?.comments??0;totals.shares+=latest?.shares??0
 }
 return <div className="publish-sidebox">
  <h3>{t('dataCenter')}<span className="chip c-muted">{t('xhsDataOnly')}</span></h3>
  {eligible.length===0&&<p className="publish-na">{t('noData')}</p>}
  {bound.length>0&&<div className="publish-tiles">
   <div className="tile"><b>{totals.likes}</b><span>{t('likes')}</span></div>
   <div className="tile"><b>{totals.collects}</b><span>{t('collects')}</span></div>
   <div className="tile"><b>{totals.comments}</b><span>{t('comments')}</span></div>
   <div className="tile"><b>{totals.shares}</b><span>{t('shares')}</span></div>
  </div>}
  {bound.map(entry=>{
   const metrics=metricsOf(entry)!
   const latest=metrics.snapshots.at(-1)
   return <div className="publish-metric-row" key={entry.prepareId}>
    <div className="publish-metric-main">
     <strong>{metrics.noteRef.title}</strong>
     <small>{metrics.noteRef.method==='auto'?t('autoMatched'):t('manualMatched')} · {latest?`${latest.likes??'—'} / ${latest.collects??'—'} / ${latest.comments??'—'} / ${latest.shares??'—'}`:t('noData')}</small>
    </div>
    <div className="publish-metric-acts">
     <Button size="sm" variant="outline" onClick={face.refreshMetrics} disabled={state.busy}>{t('refreshData')}</Button>
     <Button size="sm" variant="outline" onClick={()=>face.unbindNote(entry.prepareId)} disabled={state.busy}>{t('unbindNote')}</Button>
    </div>
   </div>})}
  {unbound.map(entry=><div className="publish-metric-row" key={entry.prepareId}>
   <div className="publish-metric-main">
    <strong>{entry.request.title}</strong>
    <small>{statusLabel(entry.status,t)}</small>
   </div>
   {state.bindTarget===entry.prepareId
    ?<div className="publish-notes-picker">
     {(state.notes??[]).map(note=><div className="publish-notes-row" key={note.noteId}>
      <span className="t">{note.title}</span>
      <Button size="sm" variant="outline" onClick={()=>face.bindNote(note.noteId)} disabled={state.busy}>{t('bindNote')}</Button>
     </div>)}
     {(state.notes?.length??0)===0&&<p className="publish-na">{t('noData')}</p>}
     <Button size="sm" variant="outline" onClick={face.cancelBind} disabled={state.busy}>{t('back')}</Button>
    </div>
    :<div className="publish-metric-acts"><Button size="sm" variant="outline" onClick={()=>face.startBind(entry.prepareId)} disabled={state.busy}>{t('bindNote')}</Button></div>}
  </div>)}
  {eligible.length>0&&<div className="publish-refreshrow">
   <Button variant="outline" onClick={face.refreshMetrics} disabled={state.busy}>{state.busy?t('checking'):t('refreshData')}</Button>
  </div>}
 </div>
}

/** 发布表单：只渲染 spec 允许的形态与字段；预检 → 冻结确认 → 提交（v0.2 同一流程）。 */
function ComposeSection({state,face,t,spec,data}:{state:FaceProps['state'];face:FaceProps['face'];t:FaceProps['t'];spec:PlatformSpec;data:PageData}){
 const draft=state.draft, review=state.review
 const accounts=data.configuredAccounts.filter(a=>a.platform===draft.platform)
 const disabled=state.busy||!data.publishingEnabled
 if(review)return <section className="publish-section">
  <h2>{t('confirm')}</h2><p>{t('confirmHint')}</p><dl className="publish-review">
   <dt>{t('platform')}</dt><dd>{platformLabel(review.request.platform,t)}</dd><dt>{t('account')}</dt><dd>{review.request.account}</dd>
   <dt>{t('titleField')}</dt><dd>{review.request.title}</dd><dt>{t('body')}</dt><dd className="publish-body">{review.request.body}</dd>
   <dt>{t('media')}</dt><dd>{review.request.media.map(path=><div key={path}>{path.split(/[\\/]/).pop()}</div>)}</dd>
   <dt>{t('schedule')}</dt><dd>{review.request.scheduleAt??t('immediate')}</dd>
   {review.request.visibility&&<><dt>{t('visibility')}</dt><dd>{review.request.visibility}</dd></>}
   {review.request.isOriginal!==undefined&&<><dt>{t('original')}</dt><dd>{review.request.isOriginal?t('original'):'—'}</dd></>}
  </dl>{review.plan.warnings.map(w=><p className="publish-notice" key={w}>{w}</p>)}
  <div className="publish-actions"><Button onClick={()=>face.edit({})} disabled={state.busy}>{t('back')}</Button><Button variant="primary" disabled={disabled} onClick={face.submit}>{state.busy?t('confirming'):t('confirm')}</Button></div>
 </section>
 return <section className="publish-section">
  <h2>{t('newPost')}</h2>
  <div className="publish-kindtabs" role="tablist" aria-label={t('kind')}>
   {spec.kinds.map(kind=><button type="button" key={kind} role="tab" aria-selected={draft.kind===kind} onClick={()=>face.edit({kind:kind as typeof draft.kind,media:[],scheduleAt:undefined})}>{t(kind)}</button>)}
  </div>
  <div className="publish-row">
   <label>{t('account')}<select value={draft.account} onChange={e=>face.edit({account:e.target.value})}>{accounts.length?accounts.map(a=><option key={a.name}>{a.name}</option>):<option value="">{t('noAccounts')}</option>}</select></label>
   <label>{t('titleField')}<Input value={draft.title} onChange={e=>face.edit({title:e.target.value})} maxLength={spec.titleMaxChars}/></label>
  </div>
  <label>{t('body')}<textarea value={draft.body??''} rows={9} onChange={e=>face.edit({body:e.target.value})}/></label>
  <label>{t('tags')}<Input value={(draft.tags??[]).join(', ')} placeholder={t('tagsHint')} onChange={e=>face.edit({tags:e.target.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean)})}/></label>
  <div><label className="publish-upload">{t('chooseFiles')}<input type="file" multiple={draft.kind==='note'} disabled={state.busy} accept={draft.kind==='note'?'image/*':draft.kind==='video'?'video/*':'.md,.txt,.html'} onChange={e=>{face.upload(e.target.files);e.target.value=''}}/></label><p>{t('uploadHint')}</p></div>
  <ul className="publish-files">{draft.media.map(path=><li key={path}><span>{state.attachments.find(x=>x.path===path)?.name??path}</span><Button size="sm" onClick={()=>face.remove(path)} aria-label={t('remove')+' '+path.split(/[\\/]/).pop()}>{t('remove')}</Button></li>)}</ul>
  <details><summary>{t('paths')}</summary><label>{t('pathsHint')}<textarea rows={3} value={draft.media.join('\n')} onChange={e=>face.edit({media:e.target.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)})}/></label></details>
  {spec.scheduling!=='none'&&<label>{t('schedule')}<input type="datetime-local" value={scheduleInput(draft.scheduleAt)} onChange={e=>face.edit({scheduleAt:!e.target.value?undefined:draft.platform==='xiaohongshu'?new Date(e.target.value).toISOString():e.target.value.replace('T',' ')})}/><small>{t('scheduleHint')}</small></label>}
  {draft.platform==='xiaohongshu'&&draft.kind==='note'&&<div className="publish-row"><label>{t('visibility')}<select value={draft.visibility??''} onChange={e=>face.edit({visibility:e.target.value||undefined})}><option value="">{t('public')}</option><option value="仅自己可见">{t('private')}</option><option value="仅互关好友可见">{t('mutual')}</option></select></label><label className="publish-switch">{t('original')}<Switch checked={draft.isOriginal===true} label={t('original')} onChange={value=>face.edit({isOriginal:value})}/></label></div>}
  <Button variant="primary" onClick={face.prepare} disabled={disabled||!draft.title||!draft.media.length||!draft.account}>{state.busy?t('preflighting'):t('preflight')}</Button>
 </section>
}

function scheduleInput(value?:string):string { if(!value)return '';if(!value.includes('T'))return value.replace(' ','T');const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16) }
