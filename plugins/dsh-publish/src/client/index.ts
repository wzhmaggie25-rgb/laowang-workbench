/** Client half: main page, settings page and independently toggled sidebar entry. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { Config } from '../config.ts'
import { PublishController } from './model.ts'
import { PublishPage, PublishSettings, PublishIcon } from './Page.tsx'
import { en, zh, type Key } from './locales.ts'
import styles from './client.css'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'publish.center':Key } }
const panel='publish-center' as MainPanelId
export const inject=['slots','locale','layout','configForms']
/** Register the page through DSH slots; hidden navigation never removes settings. */
export function apply(ctx:Context):void{
 ctx.effect(()=>ctx.locale.register('publish.center',{zh,en}),'publish: locale')
 ctx.effect(()=>{const style=document.createElement('style');style.dataset.plugin='dsh-plugin-publish';style.textContent=styles;document.head.appendChild(style);return()=>style.remove()},'publish: styles')
 const model=new PublishController(ctx.configForms.get<Config>('publish'))
 const t=ctx.locale.bind('publish.center')
 const face=()=>({...model.face(),openCenter:()=>ctx.layout.selectPanel(panel)})
 ctx.effect(()=>()=>model.dispose(),'publish: page model')
 ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:panel,locale:'publish.center',inject:face},PublishPage))
 ctx.effect(()=>ctx.configForms.whileServed(['publish'],()=>ctx.slots.inject('plugins.item',()=>ctx.slots.register({name:'plugins.item',id:'publish',order:65,locale:'publish.center',label:()=>t('title'),inject:face},PublishSettings))),'publish: settings')
 ctx.effect(()=>{
  const form=ctx.configForms.get<Config>('publish')
  let release:(()=>void)|undefined, shown:boolean|undefined
  const sync=()=>{
   const next=form.getSnapshot().value?.showSidebar??true
   if(next===shown)return
   shown=next;release?.();release=undefined
   if(next)release=ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:panel,order:15,locale:'publish.center',label:()=>t('title')},PublishIcon))
  }
  sync();const unsubscribe=form.subscribe(sync)
  return()=>{unsubscribe();release?.()}
 },'publish: sidebar preference')
 ctx.on('connection/reset',()=>{void model.refresh()})
 ctx.effect(()=>ctx.configForms.get<Config>('publish').subscribe(()=>{void model.refresh()}),'publish: accepted settings')
 void model.refresh()
}
