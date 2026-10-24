/** Call ai.status on the verify host; prints the raw JSON envelope. */
import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const require2=createRequire(resolve(process.env.DSH_SOURCE,'package.json'))
const {chromium}=require2('playwright')
const log=await readFile(process.env.PUBLISH_TEST_LOG,'utf8')
const url=log.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/)?.[0]
if(!url)throw new Error('verify host not ready')
const browser=await chromium.launch({headless:true,channel:'chrome'})
try{
 const page=await (await browser.newContext({locale:'zh-CN'})).newPage()
 await page.goto(url).catch(()=>{})
 await page.waitForTimeout(4500)
 const result=await page.evaluate(async()=>{
  const r=await fetch('api/publish/ai.status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({}),credentials:'same-origin'})
  return await r.text()
 })
 console.log('AI-STATUS:',result)
}finally{await browser.close()}
