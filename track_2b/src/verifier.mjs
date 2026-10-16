/** Verification is executed only inside the offline worker container. */
import { mkdir, mkdtemp, readFile, writeFile, readdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { loadCases } from './core.mjs';

const MAX_BYTES=24_000;

export async function verifySource(code,hiddenTests,{timeoutMs=12_000}={}) {
  if(typeof code!=='string'||Buffer.byteLength(code)>MAX_BYTES) throw new Error('Too much source text');
  const folder=await mkdtemp(join(tmpdir(),'scythe-test-'));
  try {
    await writeFile(join(folder,'bug.cjs'),code,{mode:0o600});
    await writeFile(join(folder,'verify.test.cjs'),hiddenTests,{mode:0o600});
    const result=await new Promise(resolveResult=>{
      // Model-generated JS cannot read outside its fixture, write files, or spawn subprocesses.
      // Node permission model adds defense in depth inside the offline container.
      const child=spawn(process.execPath,['--experimental-permission',`--allow-fs-read=${folder}`,'verify.test.cjs'],{
        cwd:folder,shell:false,env:{PATH:process.env.PATH||'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',NODE_ENV:'test'},
        stdio:['ignore','pipe','pipe'],
      });
      let output='';let expired=false;let done=false;
      const timer=setTimeout(()=>{expired=true;child.kill('SIGKILL');},timeoutMs);
      const push=d=>{output=(output+d.toString()).slice(-5000);};
      child.stdout.on('data',push);child.stderr.on('data',push);
      child.on('error',err=>finish(127,err.message));
      child.on('close',code=>finish(code??124));
      function finish(code,extra='') {if(done)return;done=true;clearTimeout(timer);
        resolveResult({ok:code===0&&!expired,exitCode:code,timeout:expired,output:(output+extra).slice(-3500)});}
    });
    return result;
  } finally {await rm(folder,{recursive:true,force:true});}
}

export async function runWorker({requestDir=process.env.REQUEST_DIR||'/queue/requests',
 resultDir=process.env.RESULT_DIR||'/queue/results',signal}={}){
  const cases=await loadCases();const byId=new Map(cases.map(e=>[e.id,e]));
  await mkdir(resultDir,{recursive:true});
  const completed=new Set();
  while(!signal?.aborted){
    let files=[];
    try{files=(await readdir(requestDir)).filter(x=>/^[0-9a-f-]{36}\.json$/.test(x));}
    catch(e){if(e.code!=='ENOENT')throw e;}
    for(const file of files){
      if(completed.has(file))continue;
      completed.add(file);
      try {
        const request=JSON.parse(await readFile(join(requestDir,file),'utf8'));
        if(!request||request.id+'.json'!==file)throw new Error('Invalid verifier task ID');
        const entry=byId.get(request.caseId);
        if(!entry)throw new Error('Unknown test case');
        const result=await verifySource(request.code,entry.hiddenTests);
        const output=join(resultDir,file); const tmp=output+'.tmp';
        await writeFile(tmp,JSON.stringify(result));await rename(tmp,output);
      }catch(error){
        const output=join(resultDir,file);const tmp=output+'.tmp';
        await writeFile(tmp,JSON.stringify({ok:false,exitCode:127,output:String(error).slice(0,350)}));
        await rename(tmp,output);
      }
    }
    await sleep(120);
  }
}

if(process.argv[1] && resolve(process.argv[1])===new URL(import.meta.url).pathname){
  const controller=new AbortController();
  process.on('SIGTERM',()=>controller.abort());
  process.on('SIGINT',()=>controller.abort());
  runWorker({signal:controller.signal}).catch(e=>{console.error(e);process.exitCode=1;});
}
