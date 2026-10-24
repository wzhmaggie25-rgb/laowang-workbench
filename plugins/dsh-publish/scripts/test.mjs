/** Bundle test imports with the same toolchain as the deliverable. All providers are faked. */
import {createRequire} from 'node:module'
import {mkdtemp,rm} from 'node:fs/promises'
import {join,resolve,dirname,sep} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(resolve(process.env.DSH_SOURCE??root,'package.json'))
const {build}=require('esbuild')
const dir=await mkdtemp(join(tmpdir(),'publish-tests-'))
try{
 const entries=['tests/runtime.test.mjs','tests/order.test.mjs','tests/metrics.test.mjs','tests/assistant.test.mjs']
 for(const entry of entries){
  const output=join(dir,entry.replace(/\//g,'-'))
  await build({entryPoints:[join(root,entry)],outfile:output,bundle:true,platform:'node',format:'esm',nodePaths:process.env.DSH_SOURCE?[join(process.env.DSH_SOURCE,'node_modules')]:[]})
  execFileSync(process.execPath,['--test',output],{stdio:'inherit'})
 }
}finally{if(!dir.startsWith(resolve(tmpdir())+sep))throw new Error('Unexpected test directory');await rm(dir,{recursive:true,force:true})}
