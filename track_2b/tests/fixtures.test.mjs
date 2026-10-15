import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCases} from '../src/core.mjs';
import {verifySource} from '../src/verifier.mjs';
const cases=await loadCases();

test('dataset has exactly twelve independently evaluable original cases',()=>{
  assert.equal(cases.length,12);
  assert.equal(new Set(cases.map(x=>x.id)).size,12);
  for(const c of cases){
    assert.match(c.id,/^[a-z0-9-]+$/);
    assert.equal(c.containsPersonalData,false);
    assert.equal(c.license,'CDLA-Permissive-2.0');
  }
});
for(const c of cases){
  test(`${c.id}: bug fails and reference repair passes`,async()=>{
    const broken=await verifySource(c.broken,c.hiddenTests);
    const reference=await verifySource(c.reference,c.hiddenTests);
    assert.equal(broken.ok,false,'broken case must fail independent checks');
    assert.equal(reference.ok,true,`reference patch failed: ${reference.output}`);
  });
}
