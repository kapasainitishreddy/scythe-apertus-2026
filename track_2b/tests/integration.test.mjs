import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {loadCases} from '../src/core.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const entries=await loadCases();
const entry=entries[0];
async function listen(server){await new Promise(ok=>server.listen(0,'127.0.0.1',ok));return server.address().port;}
async function awaitPort(base,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch{}await delay(90);}throw Error('server not ready');}

test('full HTTP → mocked LLM → queue → independent worker → evidence pipeline',async()=>{
  const tmp=await mkdtemp(join(tmpdir(),'apertus-integrated-'));
  const requests=join(tmp,'requests');const results=join(tmp,'results');const artifacts=join(tmp,'artifacts');
  await Promise.all([mkdir(requests),mkdir(results),mkdir(artifacts)]);
  let count=0;
  const modelServer=http.createServer(async(req,res)=>{
    if(req.url!=='/v1/chat/completions'){res.writeHead(404);return res.end();}
    let input='';for await(const part of req)input+=part;
    const message=JSON.parse(input);
    assert.ok(message.model.includes('Apertus'));
    const payload=[
      JSON.stringify({rootCause:'Pagination slice stops at wrong index',confidence:0.85}),
      JSON.stringify({path:'bug.cjs',summary:'Use offset plus size',content:entry.reference}),
      JSON.stringify({verdict:'pass',summary:'Independent tests confirm the change'}),
    ][count++] ?? '{"verdict":"uncertain","summary":"No more responses"}';
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:payload}}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}}));
  });
  const modelPort=await listen(modelServer);
  const env={...process.env,REQUEST_DIR:requests,RESULT_DIR:results,EVIDENCE_DIR:artifacts,
    LLM_NAME:'swiss-ai/Apertus-v1.5-8B',LLM_BASE_URL:`http://127.0.0.1:${modelPort}/v1`,HOST:'127.0.0.1',PORT:'0'};
  const worker=spawn(process.execPath,['src/verifier.mjs'],{cwd:root,env,stdio:'pipe'});
  const app=spawn(process.execPath,['src/server.mjs'],{cwd:root,env:{...env,PORT:'8971'},stdio:'pipe'});
  try{
    const base='http://127.0.0.1:8971';await awaitPort(base);
    const health=await (await fetch(base+'/api/health')).json();assert.equal(health.modelConfigured,true);
    const listed=await (await fetch(base+'/api/cases')).json();assert.equal(listed.length,12);
    assert.equal(listed[0].reference,undefined);
    assert.equal(listed[0].hiddenTests,undefined);
    const validation=await (await fetch(base+'/api/validate-fixture',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({caseId:entry.id})})).json();
    assert.equal(validation.valid,true);
    assert.equal(validation.modelWasCalled,false);
    const started=await (await fetch(base+'/api/repair',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({caseId:entry.id})})).json();
    assert.equal(started.status,'running');
    let job;
    for(let i=0;i<100;i++){await delay(100);job=await (await fetch(base+'/api/runs/'+started.id)).json();if(job.status!=='running')break;}
    assert.equal(job.status,'verified',JSON.stringify(job));
    assert.equal(job.evidence.modelEndpointQueried,true);
    assert.equal(job.evidence.modelIdentityVerified,false);
    assert.equal(job.evidence.success,true);
    assert.equal(job.evidence.attempts[0].verifierPass,true);
    assert.equal(count,3);
  } finally {
    worker.kill('SIGTERM');app.kill('SIGTERM');modelServer.close();await delay(100);
    await rm(tmp,{recursive:true,force:true});
  }
},{timeout:22000});
