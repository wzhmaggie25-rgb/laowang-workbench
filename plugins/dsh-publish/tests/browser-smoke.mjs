/** Isolated real-host page acceptance for the platform-first IA; mock engine only, never real. */
import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {startMockXhs} from './mock-xhs.mjs'
const source=process.env.DSH_SOURCE
const require=createRequire(resolve(source,'package.json'))
const {chromium}=require('playwright')
const log=await readFile(process.env.PUBLISH_TEST_LOG,'utf8')
const url=log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/)?.[0]
if(!url)throw new Error('Test Host is not ready')
const mock=await startMockXhs(18106)
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
 const pollFile=async(path,test,timeoutMs=15000,label='文件状态')=>{
  const deadline=Date.now()+timeoutMs
  for(;;){
   try{if(test(await readFile(path,'utf8')))return}catch{/* 文件可能尚未产生 */}
   if(Date.now()>deadline)throw new Error('等待超时：'+label)
   await page.waitForTimeout(300)
  }
 }
 await page.goto(url)
 await dismissWelcome()
 await openCenter()
 // ===== 智能助手闭环（批次 1 验收路径，mock provider）=====
 await page.getByRole('tab',{name:/^智能发布$|^Smart publish$/}).click()
 await page.locator('.publish-assist-paste').fill('这是一份测试素材：讲我们发布插件的智能助手升级。发布时每个平台要填的字段太多，标题、正文、标签规则都不一样；助手先理解素材，再按平台生成版本，人完成最终发布。')
 await page.getByRole('button',{name:/^开始$|^Start$/}).click()
 await poll(async()=>(await page.locator('.publish-section-heading h2').allInnerTexts()).includes('素材'),15000,'素材入库')
 await page.getByRole('button',{name:/AI 理解与推荐|Understand & recommend/}).click()
 await poll(async()=>(await page.locator('.publish-suggest').count())>=2,20000,'AI 理解返回两个平台建议')
 // 生成两个平台的版本（结构不同：小红书 title/body/tags；公众号 title/digest/body）
 await page.locator('.publish-suggest',{hasText:/小红书|Xiaohongshu/}).first().click()
 await poll(async()=>(await page.locator('.publish-platform-version').count())===1,20000,'小红书版本生成')
 await page.locator('.publish-suggest',{hasText:/公众号|Official Account/}).first().click()
 await poll(async()=>(await page.locator('.publish-platform-version').count())===2,20000,'公众号版本生成')
 const gzh=page.locator('.publish-platform-version',{hasText:/公众号|Official Account/})
 const xhs=page.locator('.publish-platform-version',{hasText:/小红书|Xiaohongshu/})
 await poll(async()=>(await gzh.locator('.publish-field').count())===3,10000,'公众号三字段（title/digest/body）')
 await poll(async()=>(await xhs.locator('.publish-field').count())===3,10000,'小红书三字段（title/body/tags）')
 // 用户改小红书标题 → edited 保护
 await xhs.locator('.publish-field',{hasText:'title'}).locator('.publish-field-text').click()
 await xhs.locator('.publish-field',{hasText:'title'}).locator('textarea').fill('我的人工标题')
 await page.keyboard.press('Tab')
 await poll(async()=>(await xhs.locator('.publish-field',{hasText:'title'}).locator('.chip.c-warn').count())===1,15000,'标题标记为人工修改')
 // 定向修改 + 重新生成：title 被保护，body 更新
 await page.locator('.publish-instruction input').fill('只改小红书开头')
 await xhs.getByRole('button',{name:/重新生成|Regenerate/}).click()
 await poll(async()=>(await xhs.locator('.publish-notice',{hasText:/不会被覆盖|are kept/}).count())===1,20000,'重新生成后保护已编辑字段')
 await poll(async()=>(await xhs.locator('.publish-field').first().locator('.publish-field-text').innerText()).includes('我的人工标题'),10000,'人工标题未被覆盖')
 // 标记已发（链接选填）→ 撤销
 await xhs.getByRole('button',{name:/标记已发|Mark published/}).click()
 await xhs.locator('.publish-markrow input').fill('https://example.com/xhs/1')
 await xhs.getByRole('button',{name:/确认已发|Confirm/}).click()
 await poll(async()=>(await xhs.locator('.chip.c-ok',{hasText:/已标记发布|Marked/}).count())===1,10000,'已标记发布')
 await xhs.getByRole('button',{name:/撤销标记|Undo mark/}).click()
 await poll(async()=>(await xhs.getByRole('button',{name:/标记已发|Mark published/}).count())===1,10000,'撤销后恢复标记入口')
 // 刷新：草稿与人工标题恢复
 await page.reload()
 await dismissWelcome()
 await openCenter()
 await page.getByRole('tab',{name:/^草稿$|^Drafts$/}).click()
 await poll(async()=>(await page.locator('.publish-draft-row').count())>=1,20000,'草稿列表出现')
 await page.locator('.publish-draft-row').first().click()
 await poll(async()=>(await page.locator('.publish-platform-version').count())===2,15000,'刷新后两个平台版本恢复')
 await poll(async()=>(await xhs.locator('.publish-field').first().locator('.publish-field-text').innerText()).includes('我的人工标题'),10000,'刷新后人工标题保留')
 // 生成依据落盘
 await poll(async()=>{const fs=await import('node:fs/promises');const text=await fs.readFile(process.env.PUBLISH_TEST_DIR+'/publish/assistant/generations.jsonl','utf8').catch(()=>'');return text.includes('"task":"understand"')&&text.includes('"task":"adapt"')},15000,'generations.jsonl 记录 understand 与 adapt')
 // ===== 总览（原 v0.3 矩阵回归）=====
 await page.getByRole('tab',{name:/^总览$|^Overview$/}).click()
 // 总览：三张默认平台卡按序出现。
 await poll(async()=>{
  const names=await page.locator('.publish-pcard[data-platform] .publish-pname').allInnerTexts()
  return JSON.stringify(names)===JSON.stringify(['抖音','小红书','视频号'])
 },15000,'默认平台卡片 抖音/小红书/视频号')
 // 小红书详情：账号数据来自页面通道。
 await page.locator('.publish-pcard[data-platform="xiaohongshu"]').getByRole('button',{name:/^(查看该平台|Open platform)$/}).click()
 await page.locator('.publish-detail').waitFor()
 await poll(async()=>await page.locator('.publish-detail select').nth(1).inputValue()==='page-test',15000,'小红书详情表单账号 page-test')
 await page.screenshot({path:process.env.PUBLISH_TEST_DIR+'/publish-center.png',fullPage:true})
 // 返回总览，侧栏开关隐藏/恢复。
 await page.getByRole('button',{name:/^(返回总览|Back to overview)$/}).click()
 await page.getByRole('tab',{name:/^设置$|^Settings$/}).click()
 await page.getByRole('switch',{name:/在侧栏显示发布中心|Show Publish Center in sidebar/}).click()
 await page.getByRole('button',{name:/^保存设置$|^Save settings$/}).click()
 await poll(async()=>(await page.getByRole('button',{name:/^(发布中心|Publish Center)$/}).count())===0,15000,'侧栏入口隐藏')
 await page.getByRole('switch',{name:/在侧栏显示发布中心|Show Publish Center in sidebar/}).click()
 await page.getByRole('button',{name:/^保存设置$|^Save settings$/}).click()
 await poll(async()=>(await page.getByRole('button',{name:/^(发布中心|Publish Center)$/}).count())===1,15000,'侧栏入口恢复')
 // 账号：新增抖音账号，主页卡片与抖音详情表单同步。
 await page.getByRole('tab',{name:/^账号$|^Accounts$/}).click()
 await page.getByRole('button',{name:/添加账号|Add account/}).click()
 const input=page.locator('.publish-account-edit input').last()
 await input.fill('second-test')
 await page.getByRole('button',{name:/^保存设置$|^Save settings$/}).click()
 await page.getByRole('tab',{name:/^总览$|^Overview$/}).click()
 await poll(async()=>{
  const badge=await page.locator('.publish-pcard[data-platform="douyin"] .publish-accs').innerText()
  return badge.includes('second-test')
 },15000,'新账号出现在抖音卡片')
 await page.locator('.publish-pcard[data-platform="douyin"]').getByRole('button',{name:/^(查看该平台|Open platform)$/}).click()
 await poll(async()=>await page.locator('.publish-detail select').nth(1).inputValue()==='second-test',15000,'抖音详情表单账号 second-test')
 // 拖拽排序：抖音卡拖到小红书位置，刷新后顺序保留。
 await page.getByRole('button',{name:/^(返回总览|Back to overview)$/}).click()
 const source=page.locator('.publish-pcard[data-platform="douyin"] .publish-drag')
 const target=page.locator('.publish-pcard[data-platform="xiaohongshu"]')
 const from=await source.boundingBox(),to=await target.boundingBox()
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2)
 await page.mouse.down()
 await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12})
 await page.mouse.up()
 await poll(async()=>{
  const names=await page.locator('.publish-pcard[data-platform] .publish-pname').allInnerTexts()
  return JSON.stringify(names)===JSON.stringify(['小红书','抖音','视频号'])
 },15000,'拖拽后顺序变为 小红书/抖音/视频号')
 // 等写入真正落盘（profile patch 出现 homeCards）再刷新，避免竞态。
 await pollFile(process.env.PUBLISH_TEST_DIR+'/profiles/web/cordis.patch.yml',text=>text.includes('homeCards'),15000,'卡片顺序写入 profile patch')
 await page.reload()
 await dismissWelcome()
 await openCenter()
 // v0.4 起默认页是智能发布；总览卡片断言前先切回总览。
 await page.getByRole('tab',{name:/^总览$|^Overview$/}).click()
 await poll(async()=>{
  const names=await page.locator('.publish-pcard[data-platform] .publish-pname').allInnerTexts()
  return JSON.stringify(names)===JSON.stringify(['小红书','抖音','视频号'])
 },15000,'刷新后拖拽顺序保留')
 // 全局日历：点今天 → 当日记录区出现（空台账显示空态）。
 await page.locator('.publish-cell.today').click()
 await page.locator('.publish-section', {hasText: '当日记录'}).waitFor()
 // ===== 批次 2 闭环（mock 引擎）：页面发布 → 自动匹配 → 数据回采 =====
 await page.locator('.publish-pcard[data-platform="xiaohongshu"]').getByRole('button',{name:/^(查看该平台|Open platform)$/}).click()
 await page.locator('.publish-detail').waitFor()
 await page.getByLabel('标题').fill('自动回采测试笔记')
 const mediaPath=process.env.PUBLISH_TEST_DIR+'/e2e-image.png'
 await writeFile(mediaPath,Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082','hex'))
 await page.locator('.publish-upload input[type=file]').setInputFiles(mediaPath)
 await poll(async()=>await page.locator('.publish-files li').count()===1,15000,'媒体上传完成')
 await page.getByRole('button',{name:/^(预检并查看最终内容|Validate and review)$/}).click()
 await page.getByRole('button',{name:/^(确认发布|Confirm publication)$/}).waitFor()
 await page.getByRole('button',{name:/^(确认发布|Confirm publication)$/}).click()
 // 提交成功 → 台账 submitted → 自动匹配按标题关联 mock 笔记（轮询期间反复刷新数据）。
 await poll(async()=>{
  await page.getByRole('button',{name:/^刷新数据$/}).first().click().catch(()=>{})
  const rows=await page.locator('.publish-metric-row').allInnerTexts()
  return rows.some(text=>text.includes('自动匹配'))
 },25000,'发布后自动匹配笔记')
 await poll(async()=>{
  const tiles=await page.locator('.publish-tiles').innerText().catch(()=>'')
  return ['12','3','5','1'].every(number=>tiles.includes(number))
 },15000,'数据回采出互动数据 12/3/5/1')
 // 420px 窄窗不溢出。
 await page.setViewportSize({width:420,height:900})
 await page.getByRole('tab',{name:/^总览$|^Overview$/}).click()
 assert.ok(await page.locator('.publish-center').evaluate(el=>el.scrollWidth<=el.clientWidth+1))
 await page.screenshot({path:process.env.PUBLISH_TEST_DIR+'/publish-mobile.png',fullPage:true})
 if(errors.length)throw new Error('页面或接口错误：'+errors.join('\n'))
 console.log('PASS: assistant closed loop (understand→2 platforms→edit protection→targeted regen→mark/unmark→reload recovery→generation log), overview matrix, platform detail, sidebar toggle, drag reorder persistence, calendar filter, mock publish loop, 420px overflow')
 await writeFile(result,JSON.stringify({passed:true,checks:['assistant material + understand','two-platform distinct versions','user edit protection on regenerate','targeted revision instruction','mark published + undo','reload recovery of drafts and edits','generation log persisted','overview matrix order','platform detail via card','sidebar visibility persistence','drag reorder + reload persistence','calendar day filter','mock publish closed loop','420px overflow'],pageErrors:errors},null,2)+'\n')
}catch(error){
 await page?.screenshot({path:process.env.PUBLISH_TEST_DIR+'/publish-failure.png',fullPage:true}).catch(()=>{})
 await writeFile(result,JSON.stringify({passed:false,failure:String(error&&error.stack||error)},null,2)+'\n').catch(()=>{})
 throw error
}finally{await browser.close();await mock.close()}
