import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { ApertusClient, VerifierQueue, loadCases, publicCase, repairCase, saveEvidence, createFailureEvidence } from './core.mjs';

const dir=dirname(fileURLToPath(import.meta.url));
const root=join(dir,'..');
const port=Number(process.env.PORT)||8787;
const host=process.env.HOST||'0.0.0.0';
const cases=await loadCases();
const byId=new Map(cases.map(c=>[c.id,c]));
const runs=new Map();
const queue=new VerifierQueue();
const evidenceDir=process.env.EVIDENCE_DIR||'/artifacts';
const configured=!!process.env.LLM_BASE_URL;

function send(res,status,obj){
  const text=JSON.stringify(obj);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(text);
}
function fail(res,status,reason){send(res,status,{error:reason});}
async function body(req){
  let data='';for await(const piece of req){data+=piece;if(data.length>3500)throw Error('Body exceeds 3500 characters');}
  const value=JSON.parse(data||'{}');if(!value||typeof value!=='object')throw Error('Invalid request body');
  return value;
}
function findCase(id){return typeof id==='string'?byId.get(id):undefined;}
function stateFor(id){return runs.get(id)||null;}
function jobStep(id,step){const r=runs.get(id);if(r){r.step=step;r.updatedAt=new Date().toISOString();}}
async function doRepair(id,entry){
  const r=runs.get(id);
  let model;
  try{
    model=new ApertusClient();
    const evidence=await repairCase(entry,{client:model,verifier:queue,onStep:step=>jobStep(id,step)});
    const artifact=await saveEvidence(evidenceDir,evidence);
    Object.assign(r,{status:evidence.success?'verified':'unresolved',step:'finished',evidence,artifact,
      updatedAt:new Date().toISOString()});
  }catch(e){
    const evidence=createFailureEvidence(entry,model,e,r.createdAt);
    let artifact=null;
    try { artifact=await saveEvidence(evidenceDir,evidence); }
    catch (artifactError) { evidence.artifactError=String(artifactError?.message||artifactError).slice(0,250); }
    Object.assign(r,{status:'failed',step:'error',error:evidence.error.message,evidence,artifact,
      updatedAt:new Date().toISOString()});
  }
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff');
  res.setHeader('referrer-policy','no-referrer');
  res.setHeader('x-frame-options','DENY');
  res.setHeader('content-security-policy',"default-src 'none'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  const pathname=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`).pathname;
  try{
    if(req.method==='GET' && ['/', '/index.html','/dashboard.css','/dashboard.js'].includes(pathname)){
      const file=pathname==='/'||pathname==='/index.html'?'dashboard.html':pathname.slice(1);
      const mime=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';
      res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});
      res.end(await readFile(join(dir,file)));return;
    }
    if(req.method==='GET' && pathname==='/api/health'){
      send(res,200,{name:'Scythe Apertus',version:'1.0.0',track:'2B - Own Project',
        modelConfigured:configured, model:process.env.LLM_NAME||'swiss-ai/Apertus-v1.5-8B',
        deployment:'Docker on-premise capable',cases:cases.length,mode:configured?'apertus-inference':'fixture-only',
        runCount:runs.size,now:new Date().toISOString()});return;
    }
    if(req.method==='GET' && pathname==='/api/cases'){
      send(res,200,cases.map(publicCase));return;
    }
    if(req.method==='GET' && pathname==='/api/runs'){
      send(res,200,[...runs.values()].reverse().map(({evidence,...rest})=>rest));return;
    }
    if(req.method==='GET' && pathname.startsWith('/api/runs/')){
      const id=pathname.slice('/api/runs/'.length);
      return stateFor(id)?send(res,200,stateFor(id)):fail(res,404,'No matching run');
    }
    if(req.method==='POST' && pathname==='/api/validate-fixture'){
      const input=await body(req);const entry=findCase(input.caseId);
      if(!entry)return fail(res,404,'Unknown fixture');
      const broken=await queue.send(entry.id,entry.broken);
      const reference=await queue.send(entry.id,entry.reference);
      send(res,200,{caseId:entry.id,kind:'fixture-validation-only',
        brokenFailed:!broken.ok,referencePassed:reference.ok,
        valid:!broken.ok&&reference.ok,modelWasCalled:false,
        brokenOutput:broken.output.slice(-700),referenceOutput:reference.output.slice(-700)});return;
    }
    if(req.method==='POST' && pathname==='/api/repair'){
      if(!configured)return fail(res,503,'Set LLM_BASE_URL to an Apertus v1.5 endpoint to enable real repair');
      const input=await body(req);const entry=findCase(input.caseId);
      if(!entry)return fail(res,404,'Unknown fixture');
      const id=randomUUID();
      if(runs.size>=100)runs.delete(runs.keys().next().value);
      runs.set(id,{id,caseId:entry.id,status:'running',step:'starting',createdAt:new Date().toISOString()});
      void doRepair(id,entry);
      send(res,202,{id,caseId:entry.id,status:'running'});return;
    }
    fail(res,404,'Not found');
  }catch(e){fail(res,500,String(e?.message||e).slice(0,300));}
});
server.listen(port,host,()=>console.log(`Scythe Apertus listening on http://${host}:${port} (${configured?'Apertus inference configured':'fixture-only mode'})`));
