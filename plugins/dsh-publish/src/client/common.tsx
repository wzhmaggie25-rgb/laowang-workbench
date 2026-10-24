/** 页面各视图共享的类型、状态文案、日历与记录行。 */
import { Button, Input, Switch, SettingsForm, SettingsValueField } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LedgerEntry } from '../types.ts'
import type { PublishController } from './model.ts'
import type { PageState } from './model.ts'
import { buildMonth, entryDayKey, platformMeta } from './order.ts'
import { textFields, numberFields, boolFields, listFields } from './model.ts'
import type { Key, Translate } from './locales.ts'
import { platformLabel } from './locales.ts'

/** 主面板槽位的注入面：hooks 由壳层消费，动作与文案下发给子视图。 */
export type ShellActions = Omit<ReturnType<PublishController['face']>, 'hooks'>
export interface FaceProps {
  state: PageState
  face: ShellActions
  t: Translate
}
type SettingsState = ReturnType<PublishController['settings']['getSnapshot']>

const STATUS_KEYS: Key[] = ['prepared','approved','submitting','submitted','published','scheduled','processing','unknown','failed','valid','invalid']
export function statusLabel(status:string,t:Translate):string { return STATUS_KEYS.includes(status as Key)?t(status as Key):t('untested') }

export function PlatformIcon({id,size}:{id:string;size:number}){
 const meta=platformMeta(id)
 return <span className="publish-pico" style={{background:meta.bg,fontSize:Math.round(size*0.45)}} aria-hidden>{meta.letter}</span>
}

/** 记录归属日：排期日优先，其次提交日、更新日。 */
export const recordDay = (entry:LedgerEntry):string => entryDayKey(entry)

export function Calendar({entries,colorFor,selected,onSelect,month,title,legend,t,interactive=true}:{entries:LedgerEntry[];colorFor:(entry:LedgerEntry)=>string;selected?:string;onSelect:(key:string)=>void;month:Date;title:string;legend:{color:string;label:string}[];t:Translate;interactive?:boolean}){
 const cells=buildMonth(month)
 const byDay=new Map<string,LedgerEntry[]>()
 for(const entry of entries){
  const key=recordDay(entry)
  byDay.set(key,[...(byDay.get(key)??[]),entry])
 }
 const monthValue=String(month.getMonth()+1).padStart(2,'0')
 const today=month.getFullYear()+'-'+monthValue+'-'+String(new Date().getDate()).padStart(2,'0')
 return <div className="publish-cal">
  <div className="publish-cal-head"><strong>{title}</strong>
   <span className="publish-cal-legend">{legend.map(item=><span key={item.label}><i className="dot" style={{background:item.color}}/>{item.label}</span>)}</span>
  </div>
  <div className="publish-calgrid">
   {[1,2,3,4,5,6,7].map(number=><span className="publish-wd" key={number}>{t(('wd'+number) as Key)}</span>)}
   {cells.map((cell,index)=>{
    if(cell.day===null)return <span className="publish-cell off" key={'off'+index}/>
    const count=byDay.get(cell.key)?.length??0
    const className='publish-cell'+(cell.key===today?' today':'')+(cell.key===selected?' picked':'')+(interactive?'':' static')
    return interactive
     ?<button type="button" key={cell.key} className={className} aria-pressed={cell.key===selected} onClick={()=>onSelect(cell.key)}><CellBody day={cell.day} items={byDay.get(cell.key)} colorFor={colorFor}/></button>
     :<span key={cell.key} className={className}><CellBody day={cell.day} items={byDay.get(cell.key)} colorFor={colorFor}/>{count>0&&<span className="publish-cnt">{count}</span>}</span>
   })}
  </div>
 </div>
}
function CellBody({day,items,colorFor}:{day:number;items?:LedgerEntry[];colorFor:(entry:LedgerEntry)=>string}){
 return <>
  <span className="publish-cell-day">{day}</span>
  <span className="publish-ev">{(items??[]).slice(0,4).map(entry=><i key={entry.prepareId} style={{background:colorFor(entry)}}/>)}</span>
 </>
}

export function RecordRow({entry,t}:{entry:LedgerEntry;t:Translate}){
 return <div className="publish-rec">
  <div className="publish-rec-l1"><span className="publish-rec-t">{entry.request.title}</span><span className={'chip publish-status publish-status-'+entry.status}>{statusLabel(entry.status,t)}</span></div>
  <div className="publish-rec-l2">
   <span>{platformLabel(entry.request.platform,t)} · {entry.request.account} · {t(entry.request.kind)}</span>
   <span>{new Date(recordDay(entry)).toLocaleDateString()} {new Date(entry.updatedAt).toLocaleTimeString()}</span>
  </div>
  {(entry.detail!==undefined||entry.note!==undefined)&&<details><summary>{t('details')}</summary><p>{entry.detail}</p>{entry.note&&<p className="publish-note-flag">{entry.note}</p>}<code>{entry.prepareId}</code></details>}
 </div>
}

/** 设置表单内容：完整设置与账号子集共用（v0.2 行为不变）。 */
export function SettingsContent({state,t,edit,resetField,save,discard,onlyAccounts}:{state:SettingsState;t:Translate;edit:(key:string,value:string)=>void;resetField:(key:string)=>void;save:()=>void;discard:()=>void;onlyAccounts?:boolean}){
 const disabled=!state.writable||state.saving
 const hints:Partial<Record<Key,Key>>={xhsBaseUrl:'xhsBaseUrlHint',sauBin:'sauBinHint',sauCwd:'sauCwdHint',xhsToken:'secretHint',requireApproval:'approvalHint',dailyLimit:'dailyHint',showSidebar:'sidebarHelp',httpTimeoutMs:'timeoutHint',publishTimeoutMs:'timeoutHint',allowedAccounts:'listHint',allowedPlatforms:'listHint'}
 const field=(key:typeof textFields[number]|typeof numberFields[number]|typeof listFields[number])=><SettingsValueField key={key} id={'publish-config-'+key} label={t(key)} hint={hints[key]?t(hints[key]!):undefined} overriddenLabel={t('overridden')} resetLabel={t('reset')} invalidLabel={t('invalidNumber')} numeric={(numberFields as readonly string[]).includes(key)} disabled={disabled} {...state.fields[key]!} onEdit={value=>edit(key,value)} onReset={()=>resetField(key)}/>
 let accounts:{platform:string;name:string;id?:string}[]=[];try{accounts=JSON.parse(state.fields.accounts?.text??'[]')}catch(error){/* 字段的无效态会禁用保存。 */}
 const update=(rows:typeof accounts)=>edit('accounts',JSON.stringify(rows))
 return <SettingsForm state={state} labels={{unavailable:t('unavailable'),readOnly:t('readOnly'),saveFailed:t('saveFailed'),save:t('save'),saving:t('saving')}} onSave={save} onDiscard={discard}>
  {onlyAccounts?<div><p>{t('accountHint')}</p>{accounts.map((a,index)=><div className="publish-account-edit" key={a.id??a.platform+'/'+a.name}>
   <label>{t('platform')}<select value={a.platform} disabled={disabled} onChange={e=>update(accounts.map((x,i)=>i===index?{...x,id:x.id??x.platform+'/'+x.name,platform:e.target.value}:x))}>{['xiaohongshu','douyin','kuaishou','tencent','dayu','baijiahao','weibo','zhihu','xueqiu'].map(id=><option key={id} value={id}>{platformLabel(id,t)}</option>)}</select></label>
   <label>{t('account')}<Input value={a.name} disabled={disabled} onChange={e=>update(accounts.map((x,i)=>i===index?{...x,id:x.id??x.platform+'/'+x.name,name:e.target.value}:x))}/></label><Button disabled={disabled} onClick={()=>update(accounts.filter((_,i)=>i!==index))}>{t('remove')}</Button>
  </div>)}<Button onClick={()=>update([...accounts,{id:crypto.randomUUID(),platform:'douyin',name:''}])} disabled={disabled}>{t('addAccount')}</Button></div>:<>
   <h2>{t('appearance')}</h2><p>{t('sidebarHelp')}</p>{boolFields.slice(0,2).map(key=><label className="publish-switch" key={key}><span>{t(key)}</span><Switch checked={state.fields[key]?.text==='true'} label={t(key)} disabled={disabled} onChange={value=>edit(key,String(value))}/></label>)}
   <h2>{t('runtime')}</h2>{textFields.filter(key=>key!=='xhsToken').map(field)}<label>{t('xhsToken')}<Input type="password" autoComplete="new-password" value={state.fields.xhsToken?.text??''} disabled={disabled} onChange={e=>edit('xhsToken',e.target.value)}/><small>{t('secretHint')}</small></label><label className="publish-switch"><span>{t('headed')}</span><Switch checked={state.fields.headed?.text==='true'} label={t('headed')} disabled={disabled} onChange={value=>edit('headed',String(value))}/></label>
   <h2>{t('behavior')}</h2><label className="publish-switch"><span>{t('requireApproval')}<small>{t('approvalHint')}</small></span><Switch checked={state.fields.requireApproval?.text==='true'} label={t('requireApproval')} disabled={disabled} onChange={value=>edit('requireApproval',String(value))}/></label>{field('dailyLimit')}{listFields.map(field)}
   <h2>{t('limits')}</h2>{numberFields.filter(key=>key!=='dailyLimit').map(field)}
  </>}
 </SettingsForm>
}
