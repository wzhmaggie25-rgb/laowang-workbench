/** Feature components receive data and actions from their registered seats. */
import { Button, Input, Switch, SettingsForm, SettingsValueField, IconSendOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { PublishController } from './model.ts'
import { textFields, numberFields, boolFields, listFields } from './model.ts'
import type { Key, Translate } from './locales.ts'
import { platformLabel } from './locales.ts'
type Face=ReturnType<PublishController['face']>&{openCenter:()=>void}
type Bindings=InjectFace<Face>&PropsLocale<'publish.center'>
type SettingsState=ReturnType<PublishController['settings']['getSnapshot']>
/** Existing send glyph; the sidebar owns its accessible label. */
export function PublishIcon({size}:PropsRuntime<'sidebar.panellist'>){return <IconSendOutlineRegular size={size}/>}
function statusLabel(status:string,t:Translate):string { const keys:Key[]=['prepared','approved','submitting','submitted','published','scheduled','processing','unknown','failed','valid','invalid']; return keys.includes(status as Key)?t(status as Key):t('untested') }
/** The main publishing surface. */
export function PublishPage(props:PropsRuntime<'main'>&Bindings){
 const {t}=props
 const state=props.usePublishState(s=>s), settings=props.usePublishSettings(s=>s)
 const draft=state.draft, review=state.review
 const configured=state.data?.configuredAccounts??[]
 const spec=state.data?.platforms.find(p=>p.id===draft.platform)
 const accounts=configured.filter(a=>a.platform===draft.platform)
 const disabled=state.busy||!state.data?.publishingEnabled
 return <div className="publish-center">
  <header className="publish-header"><div><h1>{t('title')}</h1><p>{t('description')}</p></div><Button variant="outline" onClick={props.refresh} disabled={state.busy}>{t('refresh')}</Button></header>
  <nav className="publish-tabs" role="tablist" aria-label={t('title')}>{(['compose','tasks','accounts','settings'] as const).map(tab=><button type="button" role="tab" id={'publish-tab-'+tab} aria-controls={'publish-panel-'+tab} aria-selected={state.tab===tab} key={tab} onClick={()=>props.setTab(tab)}>{t(tab)}</button>)}</nav>
  <div className="publish-content" role="tabpanel" id={'publish-panel-'+state.tab} aria-labelledby={'publish-tab-'+state.tab}>
   {state.error&&<div className="publish-notice" role="alert">{state.error}<Button onClick={props.refresh}>{t('retry')}</Button></div>}
   {state.data&&!state.data.publishingEnabled&&<p className="publish-notice">{t('paused')}</p>}
   {state.tab==='compose'&&<div className="publish-editor">
    <section className="publish-section">
     {review?<><h2>{t('confirm')}</h2><p>{t('confirmHint')}</p><dl className="publish-review">
      <dt>{t('platform')}</dt><dd>{platformLabel(review.request.platform,t)}</dd><dt>{t('account')}</dt><dd>{review.request.account}</dd>
      <dt>{t('titleField')}</dt><dd>{review.request.title}</dd><dt>{t('body')}</dt><dd className="publish-body">{review.request.body}</dd>
      <dt>{t('media')}</dt><dd>{review.request.media.map(path=><div key={path}>{path.split(/[\\/]/).pop()}</div>)}</dd>
      <dt>{t('schedule')}</dt><dd>{review.request.scheduleAt??t('immediate')}</dd>
      {review.request.visibility&&<><dt>{t('visibility')}</dt><dd>{review.request.visibility}</dd></>}
      {review.request.isOriginal!==undefined&&<><dt>{t('original')}</dt><dd>{review.request.isOriginal?t('original'):'—'}</dd></>}
     </dl>{review.plan.warnings.map(w=><p className="publish-notice" key={w}>{w}</p>)}
     <div className="publish-actions"><Button onClick={()=>props.edit({})} disabled={state.busy}>{t('back')}</Button><Button variant="primary" disabled={disabled} onClick={props.submit}>{state.busy?t('confirming'):t('confirm')}</Button></div></>:
     <><div className="publish-row">
      <label>{t('platform')}<select value={draft.platform} onChange={e=>{const platform=e.target.value;const p=state.data?.platforms.find(x=>x.id===platform);props.edit({platform,account:configured.find(a=>a.platform===platform)?.name??'',kind:p?.kinds[0]??'video',scheduleAt:undefined})}}>
       {(state.data?.platforms??[]).map(p=><option key={p.id} value={p.id} disabled={!!p.blocked}>{platformLabel(p.id,t)}{p.blocked?' · '+t('blocked'):''}</option>)}
      </select></label>
      <label>{t('account')}<select value={draft.account} onChange={e=>props.edit({account:e.target.value})}>{accounts.length?accounts.map(a=><option key={a.name}>{a.name}</option>):<option value="">{t('noAccounts')}</option>}</select></label>
      <label>{t('kind')}<select value={draft.kind} onChange={e=>props.edit({kind:e.target.value as typeof draft.kind,media:[]})}>{(spec?.kinds??['note']).map(kind=><option key={kind} value={kind}>{t(kind)}</option>)}</select></label>
     </div>
     {!accounts.length&&<p className="publish-notice">{t('noAccounts')}</p>}
     <label>{t('titleField')}<Input value={draft.title} onChange={e=>props.edit({title:e.target.value})} maxLength={spec?.titleMaxChars}/></label>
     <label>{t('body')}<textarea value={draft.body??''} rows={9} onChange={e=>props.edit({body:e.target.value})}/></label>
     <label>{t('tags')}<Input value={(draft.tags??[]).join(', ')} placeholder={t('tagsHint')} onChange={e=>props.edit({tags:e.target.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean)})}/></label>
     <div><label className="publish-upload">{t('chooseFiles')}<input type="file" multiple={draft.kind==='note'} disabled={state.busy} accept={draft.kind==='note'?'image/*':draft.kind==='video'?'video/*':'.md,.txt,.html'} onChange={e=>{props.upload(e.target.files);e.target.value=''}}/></label><p>{t('uploadHint')}</p></div>
     <ul className="publish-files">{draft.media.map(path=><li key={path}><span>{state.attachments.find(x=>x.path===path)?.name??path}</span><Button size="sm" onClick={()=>props.remove(path)} aria-label={t('remove')+' '+path.split(/[\\/]/).pop()}>{t('remove')}</Button></li>)}</ul>
     <details><summary>{t('paths')}</summary><label>{t('pathsHint')}<textarea rows={3} value={draft.media.join('\n')} onChange={e=>props.edit({media:e.target.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)})}/></label></details>
     {spec?.scheduling!=='none'&&<label>{t('schedule')}<input type="datetime-local" value={scheduleInput(draft.scheduleAt)} onChange={e=>props.edit({scheduleAt:!e.target.value?undefined:draft.platform==='xiaohongshu'?new Date(e.target.value).toISOString():e.target.value.replace('T',' ')})}/><small>{t('scheduleHint')}</small></label>}
     {draft.platform==='xiaohongshu'&&<div className="publish-row"><label>{t('visibility')}<select value={draft.visibility??''} onChange={e=>props.edit({visibility:e.target.value||undefined})}><option value="">{t('public')}</option><option value="仅自己可见">{t('private')}</option><option value="仅互关好友可见">{t('mutual')}</option></select></label>{draft.kind==='note'&&<label className="publish-switch">{t('original')}<Switch checked={draft.isOriginal===true} label={t('original')} onChange={value=>props.edit({isOriginal:value})}/></label>}</div>}
     <Button variant="primary" onClick={props.prepare} disabled={disabled||!draft.title||!draft.media.length||!accounts.length}>{state.busy?t('preflighting'):t('preflight')}</Button></>}
    </section>
    <aside className="publish-section publish-preview"><h2>{t('preview')}</h2><div className="publish-preview-meta">{platformLabel(draft.platform,t)} · {draft.account}</div>
     {draft.media.length?<div className="publish-thumbnails">{draft.media.map(path=>{const item=state.attachments.find(x=>x.path===path);return item?.url?<div key={path}>{item.type.startsWith('video/')?<video src={item.url} controls/>:<img src={item.url} alt={item.name}/>}</div>:<div className="publish-media-label" key={path}>{path.split(/[\\/]/).pop()}</div>})}</div>:<div className="publish-empty-media">{t('noMedia')}</div>}
     <h3>{draft.title||t('titleField')}</h3><p className="publish-body">{draft.body||t('noBody')}</p><p>{draft.tags?.map(x=>'#'+x).join(' ')}</p><small>{draft.scheduleAt??t('immediate')}</small>
    </aside>
   </div>}
   {state.tab==='tasks'&&<section className="publish-section">
    <p>{t('submittedHint')}</p>{state.data?.entries.some(x=>x.status==='unknown')&&<p className="publish-notice">{t('unknownHint')}</p>}
    {state.loading?<p role="status">{t('loading')}</p>:!state.data?.entries.length?<div className="publish-empty">{t('empty')}</div>:<div className="publish-table-scroll"><table><thead><tr><th>{t('taskTitle')}</th><th>{t('account')}</th><th>{t('time')}</th><th>{t('details')}</th></tr></thead><tbody>{state.data.entries.map(entry=><tr key={entry.prepareId}><td><strong>{entry.request.title}</strong><small>{platformLabel(entry.request.platform,t)} · {t(entry.request.kind)}</small></td><td>{entry.request.account}</td><td><span className={'publish-status publish-status-'+entry.status}>{statusLabel(entry.status,t)}</span><small>{new Date(entry.updatedAt).toLocaleString()}</small></td><td><details><summary>{t('details')}</summary><p>{entry.detail??entry.note??t('prepared')}</p><p>{entry.note}</p><code>{entry.prepareId}</code></details></td></tr>)}</tbody></table></div>}
   </section>}
   {state.tab==='accounts'&&<section className="publish-section"><div className="publish-section-heading"><h2>{t('accounts')}</h2><Button variant="outline" onClick={props.check} disabled={state.busy}>{state.busy?t('checking'):t('checkAccounts')}</Button></div>
    <p>{t('accountHelp')}</p><div className="publish-account-status">{configured.map(a=>{const status=state.accounts?.find(s=>s.platform===a.platform&&s.account===a.name);return <div key={a.platform+'/'+a.name}><strong>{platformLabel(a.platform,t)} · {a.name}</strong><span>{statusLabel(status?.status??'',t)}</span>{status?.detail&&<small>{status.detail}</small>}</div>})}</div>
    <SettingsContent state={settings} t={t} edit={props.editSettings} resetField={props.resetField} save={props.save} discard={props.discard} onlyAccounts/>
   </section>}
   {state.tab==='settings'&&<section className="publish-section"><SettingsContent state={settings} t={t} edit={props.editSettings} resetField={props.resetField} save={props.save} discard={props.discard}/><small>{t('ledger')}</small><code className="publish-ledger">{state.data?.ledgerPath}</code></section>}
  </div>
 </div>
}
function scheduleInput(value?:string):string { if(!value)return '';if(!value.includes('T'))return value.replace(' ','T');const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16) }
type SettingsProps={state:SettingsState;t:Translate;edit:(key:string,value:string)=>void;resetField:(key:string)=>void;save:()=>void;discard:()=>void;onlyAccounts?:boolean}
function SettingsContent({state,t,edit,resetField,save,discard,onlyAccounts}:SettingsProps){
 const disabled=!state.writable||state.saving
 const hints:Partial<Record<Key,Key>>={xhsBaseUrl:'xhsBaseUrlHint',sauBin:'sauBinHint',sauCwd:'sauCwdHint',xhsToken:'secretHint',requireApproval:'approvalHint',dailyLimit:'dailyHint',showSidebar:'sidebarHelp',httpTimeoutMs:'timeoutHint',publishTimeoutMs:'timeoutHint',allowedAccounts:'listHint',allowedPlatforms:'listHint'}
 const field=(key:typeof textFields[number]|typeof numberFields[number]|typeof listFields[number])=><SettingsValueField key={key} id={'publish-config-'+key} label={t(key)} hint={hints[key]?t(hints[key]!):undefined} overriddenLabel={t('overridden')} resetLabel={t('reset')} invalidLabel={t('invalidNumber')} numeric={(numberFields as readonly string[]).includes(key)} disabled={disabled} {...state.fields[key]!} onEdit={value=>edit(key,value)} onReset={()=>resetField(key)}/>
 let accounts:{platform:string;name:string;id?:string}[]=[];try{accounts=JSON.parse(state.fields.accounts?.text??'[]')}catch(error){/* The field's invalid state keeps Save disabled. */}
 const update=(rows:typeof accounts)=>edit('accounts',JSON.stringify(rows))
 return <SettingsForm state={state} labels={{unavailable:t('unavailable'),readOnly:t('readOnly'),saveFailed:t('saveFailed'),save:t('save'),saving:t('saving')}} onSave={save} onDiscard={discard}>
  {onlyAccounts?<div><p>{t('accountHint')}</p>{accounts.map((a,index)=><div className="publish-account-edit" key={a.id??a.platform+'/'+a.name}>
   <label>{t('platform')}<select value={a.platform} disabled={disabled} onChange={e=>update(accounts.map((x,i)=>i===index?{...x,id:x.id??x.platform+'/'+x.name,platform:e.target.value}:x))}>{['xiaohongshu','douyin','kuaishou','tencent','dayu','baijiahao','alipay','weibo','hupu','zhihu','xueqiu','youtube'].map(id=><option key={id} value={id}>{platformLabel(id,t)}</option>)}</select></label>
   <label>{t('account')}<Input value={a.name} disabled={disabled} onChange={e=>update(accounts.map((x,i)=>i===index?{...x,id:x.id??x.platform+'/'+x.name,name:e.target.value}:x))}/></label><Button disabled={disabled} onClick={()=>update(accounts.filter((_,i)=>i!==index))}>{t('remove')}</Button>
  </div>)}<Button onClick={()=>update([...accounts,{id:crypto.randomUUID(),platform:'douyin',name:''}])} disabled={disabled}>{t('addAccount')}</Button></div>:<>
   <h2>{t('appearance')}</h2><p>{t('sidebarHelp')}</p>{boolFields.slice(0,2).map(key=><label className="publish-switch" key={key}><span>{t(key)}</span><Switch checked={state.fields[key]?.text==='true'} label={t(key)} disabled={disabled} onChange={value=>edit(key,String(value))}/></label>)}
   <h2>{t('runtime')}</h2>{textFields.filter(key=>key!=='xhsToken').map(field)}<label>{t('xhsToken')}<Input type="password" autoComplete="new-password" value={state.fields.xhsToken?.text??''} disabled={disabled} onChange={e=>edit('xhsToken',e.target.value)}/><small>{t('secretHint')}</small></label><label className="publish-switch"><span>{t('headed')}</span><Switch checked={state.fields.headed?.text==='true'} label={t('headed')} disabled={disabled} onChange={value=>edit('headed',String(value))}/></label>
   <h2>{t('behavior')}</h2><label className="publish-switch"><span>{t('requireApproval')}<small>{t('approvalHint')}</small></span><Switch checked={state.fields.requireApproval?.text==='true'} label={t('requireApproval')} disabled={disabled} onChange={value=>edit('requireApproval',String(value))}/></label>{field('dailyLimit')}{listFields.map(field)}
   <h2>{t('limits')}</h2>{numberFields.filter(key=>key!=='dailyLimit').map(field)}
  </>}
 </SettingsForm>
}
/** Settings remain reachable when the sidebar entry is hidden. */
export function PublishSettings(props:PropsRuntime<'plugins.item'>&Bindings){
 const state=props.usePublishSettings(s=>s)
 if(props.view==='summary')return props.t('summary')
 return <div className="publish-center publish-settings-card"><Button variant="outline" onClick={props.openCenter}>{props.t('title')}</Button><SettingsContent state={state} t={props.t} edit={props.editSettings} resetField={props.resetField} save={props.save} discard={props.discard}/></div>
}
