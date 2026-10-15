import test from 'node:test';
import assert from 'node:assert/strict';
import {ApertusClient, loadCases, parseObject, validatePatch, sha256, repairCase} from '../src/core.mjs';

const cases=await loadCases();
test('parse fenced JSON payload',()=>{
  assert.deepEqual(parseObject('```json\n{"rootCause":"bad off-by-one","confidence":0.8}\n```'),{rootCause:'bad off-by-one',confidence:.8});
});
test('blocks path escapes and non-allowlisted names',()=>{
  assert.throws(()=>validatePatch({path:'../data/cases.json',content:'evil',summary:'fix'}),/non-allowlisted/);
  assert.throws(()=>validatePatch({path:'bug.cjs',content:'',summary:'empty'}),/empty/);
  assert.throws(()=>validatePatch({path:'bug.cjs',content:'x'.repeat(24001),summary:'huge'}),/oversized/);
});
test('the model client posts the official completion format and accounts tokens',async()=>{
  let auth,model;
  const fake=async(url,init)=>{
    auth=new Headers(init.headers).get('authorization');
    model=JSON.parse(init.body).model;
    assert.equal(url,'http://localhost:8899/v1/chat/completions');
    return new Response(JSON.stringify({choices:[{message:{content:'{"rootCause":"bad","confidence":0.5}'}}],usage:{prompt_tokens:8,completion_tokens:9,total_tokens:17}}),{status:200});
  };
  const client=new ApertusClient({baseUrl:'http://localhost:8899/v1/',model:'swiss-ai/Apertus-v1.5-8B',key:'test_only',fetchImpl:fake});
  const r=await client.complete([{role:'user',content:'test'}]);
  assert.ok(r.includes('bad'));
  assert.equal(auth,'Bearer test_only');
  assert.equal(model,'swiss-ai/Apertus-v1.5-8B');
  assert.equal(client.tokenTotals.total,17);
});
test('repair loop produces evidence when independently verified by injected worker',async()=>{
  const entry=cases[0];
  const outputs=[
    JSON.stringify({rootCause:'slice end excludes requested offset',confidence:0.9}),
    JSON.stringify({path:'bug.cjs',summary:'Correct slice end',content:entry.reference}),
    JSON.stringify({verdict:'pass',summary:'Independent test passes'}),
  ];
  const calls=[];
  const client={model:'swiss-ai/Apertus-v1.5-8B',endpoint:'http://localhost:8000/v1/chat/completions',
    requestCount:0,tokenTotals:{prompt:0,completion:0,total:0},
    async complete(messages){calls.push(messages);this.requestCount++;return outputs.shift();}};
  const verifier={async send(id,code){assert.equal(id,entry.id);return {ok:code===entry.reference,output:code===entry.reference?'passed':'failed',exitCode:code===entry.reference?0:1};}};
  const result=await repairCase(entry,{client,verifier});
  assert.equal(result.success,true);
  assert.equal(result.attempts.length,1);
  assert.equal(result.finalPatch.beforeSha256,sha256(entry.broken));
  assert.notEqual(result.finalPatch.afterSha256,result.finalPatch.beforeSha256);
  assert.match(result.evidenceSha256,/^[0-9a-f]{64}$/);
  assert.equal(result.inferenceCalls,3);
  assert.equal(calls.length,3);
  const completePrompt=JSON.stringify(calls);
  assert.ok(!completePrompt.includes(entry.reference),'reference solution must never enter prompts');
  assert.ok(!completePrompt.includes(entry.hiddenTests),'hidden tests must never enter prompts');
});
test('failed verification is never reported as a successful repair',async()=>{
  const entry=cases[1];const outputs=[
    '{"rootCause":"host suffix bug","confidence":0.8}',
    JSON.stringify({path:'bug.cjs',summary:'wrong patch',content:entry.broken}),
    JSON.stringify({path:'bug.cjs',summary:'still wrong',content:entry.broken}),
    '{"verdict":"pass","summary":"Model claims it passed"}',
  ];
  const client={model:'Apertus mock',endpoint:'http://127.0.0.1:8000/v1/chat/completions',requestCount:0,tokenTotals:{prompt:0,completion:0,total:0},async complete(){this.requestCount++;return outputs.shift();}};
  const verifier={async send(){return {ok:false,output:'expected false, received true',exitCode:1};}};
  const result=await repairCase(entry,{client,verifier});
  assert.equal(result.success,false);
  assert.equal(result.independentlyVerified,false);
  assert.equal(result.attempts.length,2);
});
