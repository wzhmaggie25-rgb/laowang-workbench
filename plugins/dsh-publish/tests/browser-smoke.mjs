/** Isolated real-host page acceptance; never logs in or publishes. */
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
const source=process.env.DSH_SOURCE
const require=createRequire(resolve(source,'package.json'))
const {chromium}=require('playwright')
const log=await readFile(process.env.PUBLISH_TEST_LOG,'utf8')
const url=log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/)?.[0]
if(!url)throw new Error('Test Host is not ready')
const browser=await chromium.launch({headless:true,channel:'chrome'})
const result=process.env.PUBLISH_TEST_DIR+'/browser-result.json'
let page
try{
 const context=await browser.newContext({viewport:{width:1320,height:960},locale:'zh-CN'})
 page=await context.newPage()
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('response',response=>{
  if(response.status()>=400&&/\/publish|\/api\/publish/.test(response.url()))errors.push('HTTP '+response.status()+' '+response.url())
 })
 // 首启弹层（预览版说明/开始使用）可能盖住侧栏；关闭按钮依构建而定，逐个尝试。
 const dismissWelcome=async()=>{
  for(const name of [/^(关闭|Close)$/,/^(继续|Continue)$/]){
   const button=page.getByRole('button',{name})
   try{await button.waitFor({state:'visible',timeout:1500});await button.click();await button.waitFor({state:'hidden',timeout:3000});return}catch{/* 下一个候选 */}
  }
  await page.keyboard.press('Escape').catch(()=>{})
 }
 const openCenter=async()=>{
  for(let attempt=0;attempt<3;attempt++){
   try{await page.getByRole('button',{name:/^(发布中心|Publish Center)$/}).first().click({timeout:3000});return}
   catch(error){await dismissWelcome()}
  }
  throw new Error('无法打开发布中心入口；页面错误：'+errors.join('; '))
 }
 const poll=async(check,timeoutMs=15000,label='状态')=>{
  const deadline=Date.now()+timeoutMs
  for(;;){
   if(await check())return
   if(Date.now()>deadline)throw new Error('等待超时：'+label+'；页面错误：'+errors.join('; '))
   await page.waitForTimeout(250)
  }
 }
 await page.goto(url)
 await dismissWelcome()
 await openCenter()
 await page.getByRole('tab',{name:/新建发布|New post/}).waitFor()
 // 账号数据来自 /publish 通道；等待真实就绪状态而不是固定延时。
 await poll(async()=>await page.locator('select').nth(1).inputValue()==='page-test',15000,'账号选择框显示 page-test')
 await page.screenshot({path:process.env.PUBLISH_TEST_DIR+'/publish-center.png',fullPage:true})
 await page.getByRole('tab',{name:/^设置$|^Settings$/}).click()
 await page.getByRole('switch',{name:/在侧栏显示发布中心|Show Publish Center in sidebar/}).click()
 await page.getByRole('button',{name:/^保存设置$|^Save settings$/}).click()
 const sidebarButton=page.getByRole('button',{name:/^(发布中心|Publish Center)$/}).first()
 await poll(async()=>(await page.getByRole('button',{name:/^(发布中心|Publish Center)$/}).count())===0,15000,'侧栏入口隐藏')
 await page.getByRole('switch',{name:/在侧栏显示发布中心|Show Publish Center in sidebar/}).click()
 await page.getByRole('button',{name:/^保存设置$|^Save settings$/}).click()
 await poll(async()=>(await page.getByRole('button',{name:/^(发布中心|Publish Center)$/}).count())===1,15000,'侧栏入口恢复')
 await page.getByRole('tab',{name:/^账号$|^Accounts$/}).click()
 await page.getByRole('button',{name:/添加账号|Add account/}).click()
 const input=page.locator('.publish-account-edit input').last()
 await input.fill('second-test')
 await page.getByRole('button',{name:/^保存设置$|^Save settings$/}).click()
 await page.getByRole('tab',{name:/新建发布|New post/}).click()
 await page.locator('select').nth(0).selectOption('douyin')
 await poll(async()=>await page.locator('select').nth(1).inputValue()==='second-test',15000,'新账号出现在抖音账号列表')
 await page.reload()
 await dismissWelcome()
 await openCenter()
 await page.getByRole('tab',{name:/^设置$|^Settings$/}).click()
 assert.equal(await page.getByRole('switch',{name:/在侧栏显示发布中心|Show Publish Center in sidebar/}).getAttribute('aria-checked'),'true')
 await page.screenshot({path:process.env.PUBLISH_TEST_DIR+'/publish-settings.png',fullPage:true})
 await page.setViewportSize({width:420,height:900})
 await page.getByRole('tab',{name:/新建发布|New post/}).click()
 assert.ok(await page.locator('.publish-center').evaluate(el=>el.scrollWidth<=el.clientWidth+1))
 await page.screenshot({path:process.env.PUBLISH_TEST_DIR+'/publish-mobile.png',fullPage:true})
 if(errors.length)throw new Error('页面或接口错误：'+errors.join('\n'))
 console.log('PASS: real Host client activation, custom account, sidebar hide/restore, settings persistence, account editing, 420px overflow')
 await writeFile(result,JSON.stringify({passed:true,checks:['client activation','account data via /publish channel','sidebar visibility persistence','account changes','reload persistence','420px overflow'],pageErrors:errors},null,2)+'\n')
}catch(error){
 await page?.screenshot({path:process.env.PUBLISH_TEST_DIR+'/publish-failure.png',fullPage:true}).catch(()=>{})
 await writeFile(result,JSON.stringify({passed:false,failure:String(error&&error.stack||error)},null,2)+'\n').catch(()=>{})
 throw error
}finally{await browser.close()}
