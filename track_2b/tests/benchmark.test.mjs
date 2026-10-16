import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCases } from '../src/core.mjs';
import { evaluateBatch, saveBatch } from '../src/benchmark.mjs';

const [first, second] = await loadCases();

test('benchmark records real verifier results and honest errors without reference leakage', async () => {
  const root=await mkdtemp(join(tmpdir(),'scythe-bench-test-'));
  try {
    let created=0; const prompts=[];
    const report=await evaluateBatch([first,second],{
      createClient:()=>{
        created++;
        const answers=created===1?[
          JSON.stringify({rootCause:'slice end index is not relative to offset',confidence:.9}),
          JSON.stringify({path:'bug.cjs',summary:'adjust slice end',content:first.reference}),
          JSON.stringify({verdict:'pass',summary:'correct tests pass'}),
        ]:['not valid JSON'];
        return {model:'mock',endpoint:'http://mock/v1/chat/completions',requestCount:0,
          tokenTotals:{prompt:0,completion:0,total:0},
          async complete(messages){this.requestCount++;prompts.push(messages);return answers.shift();}};
      },
      verifier:{async send(caseId,source){const e=caseId===first.id?first:second;
        return {ok:source===e.reference,exitCode:source===e.reference?0:1,
          output:source===e.reference?'test pass':'test failed'};}},
      evidenceDir:root,
    });
    assert.equal(report.total,2);
    assert.equal(report.resolved,1);
    assert.equal(report.errors,1);
    assert.equal(report.rows[0].firstPass,true);
    assert.equal(report.rows[1].status,'error');
    assert.ok(!JSON.stringify(prompts).includes(first.reference),'reference code must never be in model prompts');
    const saved=await saveBatch(root,'sample',report);
    assert.match(await readFile(saved.tsvFile,'utf8'),/caseId\tstatus/);
    assert.equal(JSON.parse(await readFile(saved.jsonFile,'utf8')).rate,0.5);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('benchmark refuses unverified model-less execution', async()=>{
  await assert.rejects(evaluateBatch([first],{verifier:{},evidenceDir:'/tmp'}),/model client factory/);
});
