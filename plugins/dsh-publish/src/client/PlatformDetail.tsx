/** 平台详情：单平台的发布表单（按内容形态自适应）、记录与日历。 */
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FaceProps } from './common.tsx'
import { Calendar, PlatformIcon, RecordRow, statusLabel } from './common.tsx'
import { platformLabel } from './locales.ts'
import { statusColor } from './order.ts'
import type { PlatformSpec } from '../platforms.ts'
import type { PageData } from './model.ts'

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
    <div className="publish-sidebox">
     <Calendar entries={platformEntries} colorFor={e=>statusColor(e.status)} onSelect={()=>{}} interactive={false} month={month} title={t('monthRhythm')} legend={legend} t={t}/>
    </div>
   </div>
  </div>
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
