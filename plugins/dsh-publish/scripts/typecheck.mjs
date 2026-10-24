/** Check the published plugin against a prepared DSH checkout's artifact declarations. */
import {createRequire} from 'node:module'
import {readdir,readFile,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const source=process.env.DSH_SOURCE
if(!source)throw new Error('Set DSH_SOURCE to the prepared DSH checkout for host/client compatibility checks')
const require=createRequire(resolve(source,'package.json')), paths={}
for(const parent of ['packages','vendor']){
 for(const group of await readdir(join(source,parent),{withFileTypes:true})){
  if(!group.isDirectory())continue
  const groupPath=join(source,parent,group.name)
  const dirs=existsSync(join(groupPath,'package.json'))?[groupPath]:(await readdir(groupPath,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>join(groupPath,x.name))
  for(const dir of dirs){
   if(!existsSync(join(dir,'package.json')))continue
   const pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8'))
   for(const [key,value]of Object.entries(pkg.exports??{'.':{types:pkg.types}})){
    const target=typeof value==='object'&&value?value.types:undefined
    if(typeof target==='string')paths[pkg.name+(key==='.'?'':key.slice(1))]=[resolve(dir,target)]
   }
   if(!paths[pkg.name]&&pkg.types)paths[pkg.name]=[resolve(dir,pkg.types)]
  }
 }
}
paths.react=[join(source,'node_modules/@types/react/index.d.ts')];paths['react/*']=[join(source,'node_modules/@types/react/*')]
paths.zod=[join(source,'node_modules/zod')]
const temporary=await mkdtemp(join(tmpdir(),'publish-types-'))
try{
 for(const face of ['host','client']){
  const config=join(temporary,face+'.json')
  await writeFile(config,JSON.stringify({compilerOptions:{target:'ES2024',lib:['ES2024','DOM','DOM.Iterable'],module:'ESNext',moduleResolution:'Bundler',strict:true,noUncheckedIndexedAccess:true,noUnusedLocals:true,noUnusedParameters:true,skipLibCheck:true,esModuleInterop:true,noEmit:true,jsx:'react-jsx',allowImportingTsExtensions:true,typeRoots:[join(source,'node_modules/@types')],types:face==='host'?['node']:['react'],paths},files:face==='host'?[join(root,'src/index.ts'),join(root,'src/api.ts'),join(root,'src/runtime.ts')]:[join(root,'src/client/index.ts'),join(root,'src/client/css.d.ts')]}))
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'-p',config],{stdio:'inherit'})
 }
}finally{await rm(temporary,{recursive:true,force:true})}
