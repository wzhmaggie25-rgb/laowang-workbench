/** 壳层：总览 / 账号 / 设置三个常驻标签，平台详情推入总览区；设置卡片独立注册。 */
import { useRef } from 'react'
import { Button, IconSendOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { Calendar, PlatformIcon, RecordRow, SettingsContent, recordDay, statusLabel } from './common.tsx'
import type { ShellActions } from './common.tsx'
import { PlatformDetail } from './PlatformDetail.tsx'
import type { PublishController } from './model.ts'
import type { PageState } from './model.ts'
import type { TabKey } from './model.ts'
import { ATTEMPTED, dayKey, platformMeta, platformSummary } from './order.ts'
import type { Key, Translate } from './locales.ts'
import { platformLabel } from './locales.ts'
type Face=ReturnType<PublishController['face']>&{openCenter:()=>void}
type Bindings=InjectFace<Face>&PropsLocale<'publish.center'>
type SettingsState=ReturnType<PublishController['settings']['getSnapshot']>
/** Existing send glyph; the sidebar owns its accessible label. */
export function PublishIcon({size}:PropsRuntime<'sidebar.panellist'>){return <IconSendOutlineRegular size={size}/>}
const TAB_KEYS:{key:TabKey;label:Key}[]=[{key:'overview',label:'overview'},{key:'accounts',label:'accounts'},{key:'settings',label:'settings'}]
/** The main publishing surface. */
export function PublishPage(props:PropsRuntime<'main'>&Bindings){
 const {t}=props
 const state=props.usePublishState(s=>s)
 const settingsState=props.usePublishSettings(s=>s)
 const month=new Date()
 const inDetail=state.view.view==='platform'
 const activeTab:TabKey=inDetail?'overview':state.tab
 return <div className="publish-center">
  <header className="publish-header"><div><h1>{t('title')}</h1><p>{t('description')}</p></div><Button variant="outline" onClick={props.refresh} disabled={state.busy}>{t('refresh')}</Button></header>
  <nav className="publish-tabs" role="tablist" aria-label={t('title')}>{TAB_KEYS.map(({key,label})=>
   <button type="button" role="tab" id={'publish-tab-'+key} aria-controls={'publish-panel-'+key} aria-selected={activeTab===key} key={key}
    onClick={()=>{if(key==='overview'&&inDetail)props.backHome();props.setTab(key)}}>{t(label)}</button>)}</nav>
  <div className="publish-content" role="tabpanel" id={'publish-panel-'+activeTab} aria-labelledby={'publish-tab-'+activeTab}>
   {state.error&&<div className="publish-notice" role="alert">{state.error}<Button onClick={props.refresh}>{t('retry')}</Button></div>}
   {state.data&&!state.data.publishingEnabled&&<p className="publish-notice">{t('paused')}</p>}
   {inDetail
    ?state.data&&<PlatformDetail state={state} face={props} t={t} month={month} data={state.data}/>
    :activeTab==='overview'
     ?state.data&&<Overview state={state} face={props} t={t} month={month} data={state.data}/>
     :activeTab==='accounts'
      ?<AccountsSection state={state} settingsState={settingsState} t={t} face={props}/>
      :<SettingsSection settingsState={settingsState} t={t} face={props} ledgerPath={state.data?.ledgerPath}/>}
  </div>
 </div>
}
/** 总览：心跳条 + 可拖拽平台卡片 + 更多平台 + 全局日历。 */
function Overview({state,face,t,month,data}:{state:PageState;face:ShellActions;t:Translate;month:Date;data:NonNullable<PageState['data']>}){
 const order=(state.dragOrder??data.homeCards).filter(id=>data.platforms.some(p=>p.id===id))
 const seen=new Set<string>();const orderIds=order.filter(id=>seen.has(id)?false:seen.add(id))
 const todayKey=dayKey(month)
 const monthPrefix=todayKey.slice(0,7)
 const attempted=(status:string)=>ATTEMPTED.includes(status)
 const todayCount=data.entries.filter(e=>recordDay(e)===todayKey&&attempted(e.status)).length
 const monthCount=data.entries.filter(e=>recordDay(e).startsWith(monthPrefix)&&attempted(e.status)).length
 const unknownCount=data.entries.filter(e=>e.status==='unknown').length
 const scheduledCount=data.entries.filter(e=>e.status==='scheduled').length
 const monthEntries=data.entries.filter(e=>recordDay(e).startsWith(monthPrefix))
 const legend=[...new Set(monthEntries.map(e=>e.request.platform))].map(id=>({color:platformMeta(id).bg,label:platformLabel(id,t)}))
 const dayEntries=state.selectedDate?data.entries.filter(e=>recordDay(e)===state.selectedDate):[]
 const drag=useRef<string|null>(null)
 // 重排会移动卡片 DOM 节点，Chrome 会随节点移动释放指针捕获；
 // 因此拖拽监听挂 window，而不是拖拽手柄元素。
 const onDown=(id:string)=>(event:React.PointerEvent<HTMLSpanElement>)=>{
  drag.current=id
  event.preventDefault()
  const onMove=(ev:PointerEvent)=>{
   const current=drag.current;if(!current)return
   const target=(document.elementFromPoint(ev.clientX,ev.clientY) as HTMLElement|null)?.closest('.publish-pcard[data-platform]')
   const targetId=target?.getAttribute('data-platform')
   if(targetId&&targetId!==current)face.reorder(current,targetId)
  }
  const finish=(commit:boolean)=>{
   window.removeEventListener('pointermove',onMove)
   window.removeEventListener('pointerup',onUp)
   window.removeEventListener('pointercancel',onCancel)
   const current=drag.current
   drag.current=null
   if(commit&&current)face.commitOrder()
   if(!commit&&current)face.cancelDrag()
  }
  const onUp=()=>finish(true)
  const onCancel=()=>finish(false)
  window.addEventListener('pointermove',onMove)
  window.addEventListener('pointerup',onUp)
  window.addEventListener('pointercancel',onCancel)
 }
 return <>
  <div className="publish-statstrip">
   <div className="publish-stat"><b>{todayCount}</b><span>{t('todayPublished')}</span></div>
   <div className="publish-stat"><b>{monthCount}</b><span>{t('monthPublished')}</span></div>
   <div className="publish-stat"><b>{unknownCount}</b><span>{t('pendingCount')}</span></div>
   <div className="publish-stat"><b>{scheduledCount}</b><span>{t('scheduledCount')}</span></div>
  </div>
  <div className="publish-cards">
   {orderIds.map(id=>{
    const spec=data.platforms.find(p=>p.id===id)!
    const accounts=data.configuredAccounts.filter(a=>a.platform===id)
    const checks=state.accounts?.filter(s=>s.platform===id)??[]
    const invalid=checks.some(s=>s.status==='invalid')
    const platformEntries=data.entries.filter(e=>e.request.platform===id)
    const platformMonth=platformEntries.filter(e=>recordDay(e).startsWith(monthPrefix)&&attempted(e.status))
    const platformUnknown=platformEntries.filter(e=>e.status==='unknown').length
    const platformScheduled=platformEntries.filter(e=>e.status==='scheduled').length
    const badge=spec.blocked?<span className="chip c-muted">{t('blocked')}</span>
     :spec.acceptance==='pending'?<span className="chip c-warn">{t('pendingAcceptance')}</span>
     :!accounts.length?<span className="chip c-muted">{t('notConfigured')}</span>
     :invalid?<span className="chip c-unknown">{t('invalid')}</span>
     :checks.length?<span className="chip c-ok">{t('valid')}</span>:<span className="chip c-muted">{t('notChecked')}</span>
    return <div className="publish-pcard" key={id} data-platform={id}>
     {!spec.blocked&&<span className="publish-drag" aria-hidden onPointerDown={onDown(id)}>⠿</span>}
     <div className="publish-pcard-head">
      <PlatformIcon id={id} size={34}/>
      <div><div className="publish-pname">{platformLabel(id,t)}</div><div className="publish-pmeta">{platformSummary(spec)}</div></div>
      {badge}
     </div>
     <div className="publish-accs">{accounts.map(a=>{
      const st=checks.find(s=>s.account===a.name)
      return <span className="publish-acc" key={a.name}><i className="dot" style={{background:st?.status==='invalid'?'#d97917':'#0d8a55'}}/>{a.name}</span>})}</div>
     <div className="publish-nums">
      <div><b>{platformMonth.length}</b><span>{t('monthPublished')}</span></div>
      <div><b>{platformUnknown}</b><span>{t('pendingCount')}</span></div>
      <div><b>{platformScheduled}</b><span>{t('scheduledCount')}</span></div>
     </div>
     <div className="publish-minilist">{platformEntries.slice(0,3).map(entry=>
      <div className="publish-minilist-row" key={entry.prepareId}><span className="t">{entry.request.title}</span><span className={'chip publish-status publish-status-'+entry.status}>{statusLabel(entry.status,t)}</span><span className="d">{recordDay(entry).slice(5)}</span></div>)}
     </div>
     {spec.blocked&&<div className="publish-na">{spec.blocked}</div>}
     <div className="publish-actions">
      {!spec.blocked&&<Button variant="primary" onClick={()=>face.openPlatform(id)}>{t('newPost')}</Button>}
      <Button variant="outline" onClick={()=>face.openPlatform(id)}>{t('viewPlatform')}</Button>
      {invalid&&<Button variant="outline" onClick={face.check} disabled={state.busy}>{t('checkAccounts')}</Button>}
      {!accounts.length&&<Button variant="outline" onClick={()=>face.setTab('accounts')}>{t('addAccount')}</Button>}
     </div>
    </div>})}
   <div className="publish-pcard publish-more-card">
    <div className="publish-pcard-head">
     <span className="publish-pico" style={{background:'#e3e5e8',color:'#646a73',fontSize:16}}>＋</span>
     <div><div className="publish-pname">{t('morePlatforms')}</div><div className="publish-pmeta">{t('morePlatformsHint')}</div></div>
    </div>
    <div className="publish-actions"><Button variant="outline" onClick={face.toggleMore}>{t('openMorePanel')}</Button></div>
   </div>
  </div>
  {state.moreOpen&&<div className="publish-morepanel">
   <h3>{t('morePlatforms')}</h3>
   {data.platforms.map(spec=>{
    const inHome=data.homeCards.includes(spec.id)
    return <div className="publish-more-row" key={spec.id}>
     <PlatformIcon id={spec.id} size={24}/>
     <span className="nm">{platformLabel(spec.id,t)}</span>
     <span className="st">{platformSummary(spec)}{spec.acceptance==='pending'?' · '+t('pendingAcceptance'):''}</span>
     <Button size="sm" variant="outline" onClick={()=>inHome?face.removeMore(spec.id):face.addMore(spec.id)}>{inHome?t('removeFromHome'):t('addToHome')}</Button>
    </div>})}
  </div>}
  <Calendar entries={monthEntries} colorFor={e=>platformMeta(e.request.platform).bg} selected={state.selectedDate} onSelect={face.selectDate} month={month} title={t('globalCalendar')} legend={legend} t={t}/>
  {state.selectedDate&&<section className="publish-section">
   <h2>{t('dayRecords')} · {state.selectedDate}</h2>
   {dayEntries.length===0?<div className="publish-empty">{t('empty')}</div>:dayEntries.map(entry=><RecordRow key={entry.prepareId} entry={entry} t={t}/>)}
  </section>}
 </>
}
function AccountsSection({state,settingsState,t,face}:{state:PageState;settingsState:SettingsState;t:Translate;face:ShellActions}){
 const data=state.data
 const configured=data?.configuredAccounts??[]
 return <section className="publish-section">
  <div className="publish-section-heading"><h2>{t('accounts')}</h2><Button variant="outline" onClick={face.check} disabled={state.busy}>{state.busy?t('checking'):t('checkAccounts')}</Button></div>
  <p>{t('accountHelp')}</p>
  <div className="publish-account-status">{configured.map(a=>{
   const status=state.accounts?.find(s=>s.platform===a.platform&&s.account===a.name)
   return <div key={a.platform+'/'+a.name}><strong>{platformLabel(a.platform,t)} · {a.name}</strong><span>{statusLabel(status?.status??'',t)}</span>{status?.detail&&<small>{status.detail}</small>}</div>})}
  </div>
  <SettingsContent state={settingsState} t={t} edit={face.editSettings} resetField={face.resetField} save={face.save} discard={face.discard} onlyAccounts/>
 </section>
}
function SettingsSection({settingsState,t,face,ledgerPath}:{settingsState:SettingsState;t:Translate;face:ShellActions;ledgerPath?:string}){
 return <section className="publish-section">
  <SettingsContent state={settingsState} t={t} edit={face.editSettings} resetField={face.resetField} save={face.save} discard={face.discard}/>
  <small>{t('ledger')}</small><code className="publish-ledger">{ledgerPath}</code>
 </section>
}
/** Settings remain reachable when the sidebar entry is hidden. */
export function PublishSettings(props:PropsRuntime<'plugins.item'>&Bindings){
 const state=props.usePublishSettings(s=>s)
 if(props.view==='summary')return props.t('summary')
 return <div className="publish-center publish-settings-card"><Button variant="outline" onClick={props.openCenter}>{props.t('title')}</Button><SettingsContent state={state} t={props.t} edit={props.editSettings} resetField={props.resetField} save={props.save} discard={props.discard}/></div>
}
