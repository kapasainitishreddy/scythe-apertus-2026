import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySource } from '../src/verifier.mjs';

const verifierTest=`const test=require('node:test');const assert=require('node:assert/strict');
const {add}=require('./bug.cjs');test('addition',()=>assert.equal(add(2,3),5));`;

test('source can execute a passing test without host permission',async()=>{
  const out=await verifySource('exports.add=(a,b)=>a+b;',verifierTest);
  assert.equal(out.ok,true,out.output);
});

test('model code cannot read verifier queue or dataset from outside its fixture',async()=>{
  const candidate=`require('node:fs').readFileSync('/queue/results/should-not-be-readable');exports.add=(a,b)=>a+b;`;
  const out=await verifySource(candidate,verifierTest);
  assert.equal(out.ok,false);
  assert.match(out.output,/access to this API has been restricted|ERR_ACCESS_DENIED/i);
});

test('model code cannot write to verifier results volume',async()=>{
  const candidate=`require('node:fs').writeFileSync('/queue/results/fake.json','{"ok":true}');exports.add=(a,b)=>a+b;`;
  const out=await verifySource(candidate,verifierTest);
  assert.equal(out.ok,false);
  assert.match(out.output,/ERR_ACCESS_DENIED|restricted/i);
});

test('model code cannot spawn child processes',async()=>{
  const candidate=`require('node:child_process').spawnSync(process.execPath,['-v']);exports.add=(a,b)=>a+b;`;
  const out=await verifySource(candidate,verifierTest);
  assert.equal(out.ok,false);
  assert.match(out.output,/ERR_ACCESS_DENIED|restricted/i);
});
