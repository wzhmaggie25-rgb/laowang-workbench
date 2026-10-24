/** React-free page state and staged settings for the publishing feature. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { SettingsFormModel, settingsTextField, settingsNumberField, type SettingsFieldSpec, type SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Config } from '../config.ts'
import type { PublishRequest, LedgerEntry, PrepareResult } from '../types.ts'
import type { PlatformSpec } from '../platforms.ts'
import { moveCard } from './order.ts'
export const textFields = ['xhsBaseUrl','xhsToken','sauBin','sauCwd','dailyTimeZone'] as const
export const numberFields = ['approvalTimeoutSec','dailyLimit','httpTimeoutMs','publishTimeoutMs','maxMediaBytes'] as const
export const boolFields = ['showSidebar','publishingEnabled','requireApproval','headed'] as const
export const listFields = ['allowedPlatforms','allowedAccounts'] as const
const booleanSpec = (field:string):SettingsFieldSpec => ({ field, format:value=>String(value ?? false), parse:text=>text==='true'||text==='false'?{kind:'set',value:text==='true'}:undefined })
const listSpec = (field:string):SettingsFieldSpec => ({ field, format:value=>Array.isArray(value)?value.join(', '):'', parse:text=>({kind:'set',value:text.split(/[,，]/).map(x=>x.trim()).filter(Boolean)}) })
const accountsSpec:SettingsFieldSpec = {field:'accounts',format:value=>JSON.stringify(value??[]),parse:text=>{
 try { const value:unknown=JSON.parse(text); if(!Array.isArray(value)||!value.every(row=>typeof row==='object'&&row!==null&&typeof row.platform==='string'&&typeof row.name==='string'&&row.name.trim()))return; return {kind:'set',value} } catch(error) { return undefined }
}}
export interface PageData { entries:LedgerEntry[]; platforms:PlatformSpec[]; configuredAccounts:{platform:string;name:string}[]; publishingEnabled:boolean; homeCards:string[]; ledgerPath:string }
export interface Review { plan:PrepareResult;request:PublishRequest;token:string;expiresAt:number }
export interface AccountState {platform:string;account:string;status:string;detail?:string}
export type PlatformView = { view:'home' } | { view:'platform'; platform:string }
export type TabKey = 'overview' | 'accounts' | 'settings'
export interface PageState {
 data?:PageData; loading:boolean; busy:boolean; error?:string; draft:PublishRequest; review?:Review
 attachments:{path:string;name:string;url?:string;type:string}[]; accounts?:AccountState[]
 view:PlatformView; tab:TabKey; detailAccount?:string; moreOpen:boolean; selectedDate?:string
 /** 拖拽中的预览顺序；undefined 表示跟随 data.homeCards。 */
 dragOrder?:string[]
}
 /** One instance feeds the main panel and the plugin settings page. */
export class PublishController {
 readonly form:SettingsFormModel<Config>
 readonly settings
 readonly state=createSnapshotStore<PageState>({loading:true,busy:false,draft:{platform:'douyin',account:'',kind:'note',title:'',body:'',media:[]},attachments:[],view:{view:'home'},tab:'overview',moreOpen:false})
 private readonly abort=new AbortController()
 private timer:ReturnType<typeof setTimeout>|undefined
 private generation=0
 constructor(private readonly scope:SettingsFormScope<Config>){
  this.form=new SettingsFormModel(scope,[...textFields.map(x=>settingsTextField(x)),...numberFields.map(x=>settingsNumberField(x)),...boolFields.map(booleanSpec),...listFields.map(listSpec),accountsSpec])
  this.settings=this.form.bind(()=>({...this.form.shell(), fields:Object.fromEntries([...textFields,...numberFields,...boolFields,...listFields,'accounts'].map(key=>[key,this.form.field(key)]))}))
 }
 async call<T>(endpoint:string,payload:unknown={}):Promise<T>{
  const response=await fetch('api/publish/'+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:this.abort.signal,credentials:'same-origin'})
  const result=await response.json() as {ok:boolean;value?:T;error?:{message:string}}
  if(!response.ok||!result.ok)throw new Error(result.error?.message??'发布接口请求失败')
  return result.value as T
 }
 async refresh():Promise<void>{
  const generation=++this.generation
  try {
   const data=await this.call<PageData>('state')
   if(generation!==this.generation||this.abort.signal.aborted)return
   this.state.update(s=>{
    if(s.view.view==='platform'){
     const platform=s.view.platform
     if(!data.configuredAccounts.some(a=>a.platform===platform)){s.view={view:'home'};s.review=undefined}
    }
    if(!s.data&&!s.dragOrder){
     // 首次读到数据时，把草稿对齐到主页第一张可发布平台的形态。
     const first=[...data.homeCards].find(id=>data.platforms.some(p=>p.id===id&&!p.blocked&&data.configuredAccounts.some(a=>a.platform===id)))
     const spec=data.platforms.find(p=>p.id===first)
     if(spec){s.draft.platform=spec.id;s.draft.kind=spec.kinds[0]!;s.draft.account=data.configuredAccounts.find(a=>a.platform===spec.id)?.name??''}
    }
    s.data=data;s.loading=false;s.error=undefined
   })
   if(this.timer)clearTimeout(this.timer)
   if(data.entries.some(x=>x.status==='submitting'))this.timer=setTimeout(()=>{void this.refresh()},2500)
  }catch(error){if(!this.abort.signal.aborted)this.state.update(s=>{s.loading=false;s.error=message(error)})}
 }
 edit(patch:Partial<PublishRequest>):void{this.state.update(s=>{Object.assign(s.draft,patch);s.review=undefined;s.error=undefined})}
 openPlatform(platform:string):void{this.state.update(s=>{
  const spec=s.data?.platforms.find(p=>p.id===platform)
  if(!spec)return
  s.view={view:'platform',platform};s.tab='overview';s.detailAccount=undefined;s.review=undefined;s.error=undefined
  s.draft={platform,account:s.data?.configuredAccounts.find(a=>a.platform===platform)?.name??'',kind:spec.kinds[0]!,title:'',media:[],body:'',tags:[]}
 })}
 backHome():void{this.state.update(s=>{s.view={view:'home'};s.review=undefined})}
 setTab(tab:TabKey):void{this.state.update(s=>{s.tab=tab})}
 setDetailAccount(account:string):void{this.state.update(s=>{s.detailAccount=account||undefined})}
 toggleMore():void{this.state.update(s=>{s.moreOpen=!s.moreOpen})}
 selectDate(key:string):void{this.state.update(s=>{s.selectedDate=s.selectedDate===key?undefined:key})}
 /** 拖拽预览：只改本地顺序，放置时 commitOrder 才落库。 */
 reorder(dragId:string,targetId:string):void{this.state.update(s=>{
  const base=s.dragOrder??s.data?.homeCards
  if(!base)return
  s.dragOrder=moveCard(base,dragId,targetId)
 })}
 cancelDrag():void{this.state.update(s=>{s.dragOrder=undefined})}
 /** 一次修订围栏写入；成功后本地 data 即刻对齐，失败返回 false 交给调用方报错。 */
 private async writeHomeCards(order:string[]):Promise<boolean>{
  const accepted=await this.scope.mutate([{op:'set',path:['homeCards'],value:order}])
  if(this.abort.signal.aborted)return false
  if(accepted)this.state.update(s=>{if(s.data)s.data.homeCards=order;s.dragOrder=undefined;s.error=undefined})
  return accepted
 }
 /** 放置即保存；失败保留本地预览顺序并报错，刷新后以服务端为准。 */
 async commitOrder():Promise<void>{
  const snapshot=this.state.getSnapshot()
  const order=snapshot.dragOrder
  if(!order||!snapshot.data)return
  if(JSON.stringify(order)===JSON.stringify(snapshot.data.homeCards)){this.state.update(s=>{s.dragOrder=undefined});return}
  const accepted=await this.writeHomeCards(order)
  if(!accepted&&!this.abort.signal.aborted)this.state.update(s=>{s.error='卡片顺序保存未成功，已保留本次排列；请重试'})
 }
 /** 「更多平台」面板：把平台加入主页末尾。 */
 async addMore(id:string):Promise<void>{
  const snapshot=this.state.getSnapshot()
  if(!snapshot.data||snapshot.data.homeCards.includes(id))return
  const accepted=await this.writeHomeCards([...snapshot.data.homeCards,id])
  if(!accepted&&!this.abort.signal.aborted)this.state.update(s=>{s.error='卡片顺序保存未成功，请重试'})
 }
 /** 「更多平台」面板：把平台从主页挪回面板，不动账号与台账。 */
 async removeMore(id:string):Promise<void>{
  const snapshot=this.state.getSnapshot()
  if(!snapshot.data)return
  const accepted=await this.writeHomeCards(snapshot.data.homeCards.filter(card=>card!==id))
  if(!accepted&&!this.abort.signal.aborted)this.state.update(s=>{s.error='卡片顺序保存未成功，请重试'})
 }
 async action(work:()=>Promise<void>):Promise<void>{
  if(this.state.getSnapshot().busy)return
  this.state.update(s=>{s.busy=true;s.error=undefined})
  try{await work()}catch(error){if(!this.abort.signal.aborted)this.state.update(s=>{s.error=message(error)})}
  finally{if(!this.abort.signal.aborted)this.state.update(s=>{s.busy=false})}
 }
 async prepare():Promise<void>{await this.action(async()=>{const review=await this.call<Review>('prepare',this.state.getSnapshot().draft);this.state.update(s=>{s.review=review})})}
 async submit():Promise<void>{await this.action(async()=>{
  const review=this.state.getSnapshot().review
  if(!review)throw new Error('请先预检')
  const result=await this.call<{accepted:boolean;detail?:string}>('submit',{prepareId:review.plan.prepareId,token:review.token,confirmed:true})
  if(!result.accepted)throw new Error(result.detail)
  this.state.update(s=>{s.review=undefined});await this.refresh()
 })}
 async check():Promise<void>{await this.action(async()=>{const result=await this.call<{accounts:AccountState[]}>('accounts');this.state.update(s=>{s.accounts=result.accounts})})}
 async upload(files:FileList|null):Promise<void>{if(!files)return;await this.action(async()=>{
  for(const file of Array.from(files)){
   const response=await fetch('api/publish.media',{method:'POST',headers:{'x-publish-name':encodeURIComponent(file.name)},body:file,signal:this.abort.signal,credentials:'same-origin'})
   const value: {path?:string;name?:string;error?:string}=await response.json()
   if(!response.ok||!value.path)throw new Error(value.error)
   const attachment={path:value.path,name:file.name,type:file.type,url:file.type.startsWith('image/')||file.type.startsWith('video/')?URL.createObjectURL(file):undefined}
   this.state.update(s=>{s.attachments.push(attachment);s.draft.media.push(attachment.path);s.review=undefined})
  }
 })}
 remove(path:string):void{const item=this.state.getSnapshot().attachments.find(x=>x.path===path);if(item?.url)URL.revokeObjectURL(item.url);this.state.update(s=>{s.attachments=s.attachments.filter(x=>x.path!==path);s.draft.media=s.draft.media.filter(x=>x!==path);s.review=undefined})}
 face(){const {edit:editSettings,...actions}=this.form.actions();return {hooks:{publishState:this.state,publishSettings:this.settings},edit:(patch:Partial<PublishRequest>)=>this.edit(patch),openPlatform:(platform:string)=>this.openPlatform(platform),backHome:()=>this.backHome(),setTab:(tab:TabKey)=>this.setTab(tab),setDetailAccount:(account:string)=>this.setDetailAccount(account),toggleMore:()=>this.toggleMore(),selectDate:(key:string)=>this.selectDate(key),reorder:(dragId:string,targetId:string)=>this.reorder(dragId,targetId),commitOrder:()=>{void this.commitOrder()},cancelDrag:()=>this.cancelDrag(),addMore:(id:string)=>{void this.addMore(id)},removeMore:(id:string)=>{void this.removeMore(id)},refresh:()=>{void this.refresh()},check:()=>{void this.check()},prepare:()=>{void this.prepare()},submit:()=>{void this.submit()},upload:(files:FileList|null)=>{void this.upload(files)},remove:(path:string)=>this.remove(path),...actions,editSettings}}
 dispose():void{this.abort.abort();if(this.timer)clearTimeout(this.timer);this.form.dispose();for(const item of this.state.getSnapshot().attachments)if(item.url)URL.revokeObjectURL(item.url)}
}
function message(error:unknown):string{return error instanceof Error?error.message:String(error)}
