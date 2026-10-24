/** Reproduce the DSH lazy-CJS client format without importing its private build preset. */
import { createRequire } from 'node:module'
import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { resolve,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(process.env.DSH_SOURCE?resolve(process.env.DSH_SOURCE,'package.json'):resolve(root,'package.json'))
const {build}=require('esbuild')
await mkdir(resolve(root,'dist'),{recursive:true})
await build({entryPoints:[resolve(root,'src/index.ts')],bundle:true,platform:'node',format:'esm',external:['@deepseek-ai/*'],nodePaths:process.env.DSH_SOURCE?[resolve(process.env.DSH_SOURCE,'node_modules')]:[],outfile:resolve(root,'dist/index.js'),packages:'bundle'})
const result=await build({entryPoints:[resolve(root,'src/client/index.ts')],bundle:true,platform:'browser',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime','@deepseek-ai/*'],loader:{'.css':'text'},write:false})
await writeFile(resolve(root,'dist/client.js'),'window.__ModuleLoader__.load({id:"dsh-plugin-publish",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n'+result.outputFiles[0].text+'\nreturn module.exports;}});\n')
console.log('Host and client bundles built')
