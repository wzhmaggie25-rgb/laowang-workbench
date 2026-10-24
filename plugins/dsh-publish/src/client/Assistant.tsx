/** 智能发布助手：素材进入 → 理解推荐 → 平台版本 → 检查缺项 → 人工发布留痕。 */
import { useEffect, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FaceProps } from './common.tsx'
import { PlatformIcon } from './common.tsx'
import type { PlatformFormRule } from '../rules.ts'
import type { PlatformDraft, ManualRecord } from '../assistant-types.ts'
import type { AdaptResult } from './model.ts'
import type { Translate } from './locales.ts'
import { platformLabel } from './locales.ts'

const FORM_LABEL: Record<string, string> = { note: '图文', article: '文章', video: '视频', shortpost: '短帖' }

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true }
  catch { return false }
}

export function Assistant({state,face,t}:FaceProps){
 const assist=state.assist
 const material=assist?.material
 const [paste,setPaste]=useState('')
 const [pasteOrigin,setPasteOrigin]=useState('粘贴')
 const [marking,setMarking]=useState<string|null>(null)
 const [markLink,setMarkLink]=useState('')
 const [copied,setCopied]=useState('')
 const doCopy=async(field:string,text:string)=>{
  if(await copy(text))setCopied(field+'-ok')
 }
 if(!material){
  return <section className="publish-section publish-assist-entry">
   <h2>{t('assistTitle')}</h2>
   <p>{t('assistHint')}</p>
   <textarea className="publish-assist-paste" rows={10} placeholder={t('assistPlaceholder')} value={paste} onChange={e=>setPaste(e.target.value)}/>
   <div className="publish-assist-entryrow">
    <Input value={pasteOrigin} aria-label={t('assistOrigin')} onChange={e=>setPasteOrigin(e.target.value)} placeholder={t('assistOrigin')}/>
    <label className="publish-upload">{t('assistPickSrt')}
     <input type="file" accept=".srt,.md,.txt" onChange={e=>{
      const file=e.target.files?.[0]
      if(file){void file.text().then(text=>{
       const kind=file.name.endsWith('.srt')?'srt':file.name.endsWith('.md')?'markdown':'paste'
       face.createMaterial(kind,text,file.name)
      })}
      e.target.value=''
     }}/>
    </label>
    <Button variant="primary" disabled={state.busy||paste.trim().length===0} onClick={()=>face.createMaterial('paste',paste,pasteOrigin||'粘贴')}>{t('assistStart')}</Button>
   </div>
  </section>
 }
 return <div className="publish-assist">
  <section className="publish-section">
   <div className="publish-section-heading">
    <h2>{t('assistMaterial')}</h2>
    <span className="chip c-muted">{material.origin} · {material.kind.toUpperCase()} · {material.contentHash.slice(0,8)}</span>
   </div>
   <details><summary>{t('assistViewMaterial')}</summary><pre className="publish-material-pre">{material.text}</pre></details>
   {material.attachments.length>0&&<p className="publish-na">{t('assistAttachmentsNotRead')}{material.attachments.map(a=>a.path.split(/[\\/]/).pop()).join('、')}</p>}
   <div className="publish-actions">
    <Button variant="primary" onClick={face.understand} disabled={state.busy}>{state.busy?t('assistThinking'):t('assistUnderstand')}</Button>
   </div>
  </section>
  {assist?.understanding&&<section className="publish-section">
   <h2>{t('assistUnderstanding')}</h2>
   <p><strong>{assist.understanding.summary}</strong></p>
   <p className="publish-assist-audience">{t('assistAudience')}：{assist.understanding.audience}</p>
   {assist.understanding.facts.length>0&&<ul className="publish-facts">
    {assist.understanding.facts.map((fact,index)=><li key={index}>{fact.claim}<blockquote>{fact.quote}</blockquote></li>)}
   </ul>}
   {assist.understanding.question&&<div className="publish-notice">{t('assistQuestion')}{assist.understanding.question.question}
    <small>{assist.understanding.question.why}</small>
    <Button variant="outline" onClick={face.understand} disabled={state.busy}>{t('assistRetryUnderstand')}</Button>
   </div>}
   <h3>{t('assistSuggestions')}</h3>
   <div className="publish-suggest-row">
    {assist.understanding.suggestions.map(s=><button type="button" key={s.platform+s.form} className="publish-suggest" onClick={()=>face.adapt(s.platform,s.form)} disabled={state.busy}>
     <PlatformIcon id={s.platform==='gongzhonghao'?'weixin':s.platform} size={24}/>
     <span>{platformLabel(s.platform,t)} · {FORM_LABEL[s.form]??s.form}</span>
     <small>{s.reason}</small>
    </button>)}
   </div>
  </section>}
  {assist&&Object.keys(assist.platformDrafts).length>0&&<>
   <section className="publish-section publish-instruction">
    <h2>{t('assistTargeted')}</h2>
    <Input value={assist.instruction} placeholder={t('assistInstructionHint')} onChange={e=>face.setInstruction(e.target.value)}/>
    <small>{t('assistInstructionNote')}</small>
   </section>
   {Object.entries(assist.platformDrafts).map(([platform,draft])=>
    <PlatformCard key={platform} platform={platform} draft={draft} rule={assist.rules.find(r=>r.platform===platform&&r.form===draft.form)} result={assist.adaptResults[platform]} state={state} face={face} t={t}
     marked={assist.manualRecords.find(row=>row.platform===platform&&!row.unmarkedAt)}
     marking={marking===platform} markLink={markLink} setMarkLink={setMarkLink}
     onMarkRequest={()=>{setMarking(platform);setMarkLink('')}}
     onMarkConfirm={()=>{face.markPublished(platform,markLink.trim()||undefined);setMarking(null)}}
     onMarkCancel={()=>setMarking(null)}
     copied={copied} doCopy={doCopy}/>)}
  </>}
 </div>
}

function PlatformCard(props:{platform:string;draft:PlatformDraft;rule?:PlatformFormRule;result?:AdaptResult;state:FaceProps['state'];face:FaceProps['face'];t:Translate;marked?:ManualRecord;marking:boolean;markLink:string;setMarkLink:(value:string)=>void;onMarkRequest:()=>void;onMarkConfirm:()=>void;onMarkCancel:()=>void;copied:string;doCopy:(field:string,text:string)=>Promise<void>}){
 const {platform,draft,rule,result,state,face,t,marked,marking,markLink,setMarkLink,onMarkRequest,onMarkConfirm,onMarkCancel,copied,doCopy}=props
 const [open,setOpen]=useState<string|null>(null)
 const [editText,setEditText]=useState('')
 const iconId=platform==='gongzhonghao'?'weixin':platform
 const copyAll=()=>{void doCopy('all',Object.values(draft.fields).map(value=>value.text).filter(text=>text.length>0).join('\n\n'))}
 return <section className="publish-section publish-platform-version">
  <div className="publish-section-heading">
   <PlatformIcon id={iconId} size={30}/>
   <h2>{platformLabel(platform,t)} · {FORM_LABEL[draft.form]??draft.form}</h2>
   {marked?<span className="chip c-ok">{t('assistMarked')}</span>
    :result&&result.checks.some(check=>check.exceeded&&check.level==='hard')?<span className="chip c-fail">{t('assistHardExceeded')}</span>
    :result?<span className="chip c-ok">{t('assistReady')}</span>
    :<span className="chip c-muted">{t('assistDraft')}</span>}
   <Button variant="outline" onClick={()=>face.adapt(platform,draft.form)} disabled={state.busy}>{state.busy?t('assistThinking'):t('assistRegenerate')}</Button>
  </div>
  {result&&result.protectedFields.length>0&&<div className="publish-notice">{t('assistProtected')}{result.protectedFields.join('、')}</div>}
  {result&&result.changes.length>0&&<details className="publish-changes"><summary>{t('assistChanges')}</summary>
   <ul>{result.changes.map((change,index)=><li key={index}><strong>{change.field}</strong>：{change.what}<small>{change.why}</small></li>)}</ul>
  </details>}
  {result&&result.warnings.length>0&&<div className="publish-notice">{t('assistWarnings')}
   <ul>{result.warnings.map((warning,index)=><li key={index}>{warning.field}：{warning.issue}{warning.quote?`「${warning.quote}」`:''}</li>)}</ul>
  </div>}
  <div className="publish-fields">
   {Object.entries(draft.fields).map(([field,value])=>{
    const length=rule?.lengths.find(item=>item.field===field)
    const check=result?.checks.find(item=>item.field===field)
    return <div className="publish-field" key={field}>
     <div className="publish-field-head">
      <label>{field}{value.edited&&<span className="chip c-warn">{t('assistEdited')}</span>}</label>
      {length&&<span className={'publish-count'+(check?.exceeded?(check.level==='hard'?' hard':' warn'):'')}>{check?.count ?? '—'}/{length.max}{length.unit==='weighted'?t('assistWeighted'):t('assistChars')}</span>}
      <Button size="sm" variant="outline" onClick={()=>{void doCopy(field,value.text)}}>{copied===field+'-ok'?t('assistCopied'):t('assistCopy')}</Button>
     </div>
     {open===field
      ?<textarea value={editText} rows={field==='body'||field==='digest'?10:3} autoFocus
        onChange={e=>setEditText(e.target.value)}
        onBlur={e=>{face.saveField(platform,draft.form,field,e.target.value);setOpen(null)}}/>
      :<div className="publish-field-text" role="button" tabIndex={0} onClick={()=>{setEditText(value.text);setOpen(field)}} onKeyDown={e=>{if(e.key==='Enter'){setEditText(value.text);setOpen(field)}}}>{value.text||t('assistEmptyField')}</div>}
    </div>
   })}
  </div>
  {rule&&<div className="publish-platform-actions">
   <a className="btn outline" href={rule.studioUrl} target="_blank" rel="noreferrer">{t('assistOpenStudio')} ↗</a>
   <Button variant="outline" onClick={copyAll}>{copied==='all-ok'?t('assistCopied'):t('assistCopyAll')}</Button>
   {marked
    ?<Button variant="outline" onClick={()=>face.unmarkPublished(platform)} disabled={state.busy}>{t('assistUnmark')}</Button>
    :marking
     ?<span className="publish-markrow">
      <Input value={markLink} placeholder={t('assistLinkOptional')} onChange={e=>setMarkLink(e.target.value)}/>
      <Button variant="primary" onClick={onMarkConfirm} disabled={state.busy}>{t('assistMarkConfirm')}</Button>
      <Button variant="outline" onClick={onMarkCancel}>{t('back')}</Button>
     </span>
     :<Button variant="primary" onClick={onMarkRequest} disabled={state.busy}>{t('assistMark')}</Button>}
   {marked&&!marking&&<small className="publish-marked-note">{t('assistMarkedNote')}{marked.markedAt.slice(0,16).replace('T',' ')}{marked.link?` · ${marked.link}`:''}</small>}
  </div>}
  {rule?.notes&&<small className="publish-rule-note">{rule.notes}</small>}
 </section>
}

export function DraftsList({state,face,t}:FaceProps){
 const drafts=state.assist?.drafts??[]
 const active=state.activeDraftId
 useEffect(()=>{face.loadDrafts()},[])
 return <section className="publish-section">
  <div className="publish-section-heading"><h2>{t('draftsTitle')}</h2><Button variant="outline" onClick={face.loadDrafts} disabled={state.busy}>{t('refresh')}</Button></div>
  {drafts.length===0?<div className="publish-empty">{t('draftsEmpty')}</div>
  :drafts.map(material=><div className={'publish-draft-row'+(material.draftId===active?' picked':'')} key={material.draftId} role="button" tabIndex={0}
   onClick={()=>face.loadDraft(material.draftId)} onKeyDown={e=>{if(e.key==='Enter')face.loadDraft(material.draftId)}}>
   <strong>{material.text.slice(0,60).replace(/\n/g,' ')}</strong>
   <small>{material.origin} · {material.kind.toUpperCase()} · {material.updatedAt.slice(0,16).replace('T',' ')}</small>
  </div>)}
 </section>
}
