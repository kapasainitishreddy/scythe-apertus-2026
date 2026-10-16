/** Fixed-evaluation, budgeted Apertus experiments inspired by autoresearch.
 * The verifier is never modified or trained against during a run.
 */
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { ApertusClient, VerifierQueue, loadCases, repairCase, saveEvidence, createFailureEvidence } from './core.mjs';

function clean(value) { return String(value ?? '').replace(/[\t\n\r]+/g, ' ').slice(0, 240); }
function tsvCell(value) {
  return `"${String(value ?? '').replace(/\r?\n/g,'\\n').replace(/\t/g,'\\t').replace(/"/g,'""')}"`;
}

export async function evaluateBatch(entries, {
  createClient, verifier, evidenceDir, onResult = () => {}, maxAttempts = 2,
} = {}) {
  if (typeof createClient !== 'function' || !verifier || !evidenceDir) {
    throw new Error('A model client factory, independent verifier and evidence directory are required');
  }
  const rows = [];
  for (const entry of entries) {
    const started = performance.now();
    const startedAt = new Date().toISOString();
    const client = createClient();
    let row;
    try {
      const evidence = await repairCase(entry, { client, verifier, maxAttempts });
      const path = await saveEvidence(evidenceDir, evidence);
      row = {
        caseId: entry.id,
        model:evidence.model,
        endpoint:evidence.providerEndpoint,
        status: evidence.success ? 'resolved' : 'unresolved',
        verifierPassed: evidence.independentlyVerified,
        firstPass: evidence.attempts[0]?.verifierPass === true,
        attempts: evidence.attempts.length,
        modelCalls: evidence.inferenceCalls,
        reportedTokens: evidence.usage.total || null,
        diagnosis:evidence.diagnosis.rootCause,
        proposedPatches:JSON.stringify(evidence.attempts.map(({iteration,summary,proposedPatch,verifierPass})=>
          ({iteration,summary,content:proposedPatch,verifierPass}))),
        evidenceSha256: evidence.evidenceSha256,
        evidenceFile: path,
      };
    } catch (error) {
      const evidence=createFailureEvidence(entry,client,error,startedAt);
      const path=await saveEvidence(evidenceDir,evidence);
      row = { caseId: entry.id, status: 'error', error: clean(evidence.error.message),
        model:evidence.model,endpoint:evidence.providerEndpoint,
        errorCategory:evidence.error.category,
        modelCalls: evidence.inferenceCalls, reportedTokens: client.tokenTotals?.total || null,
        diagnosis:evidence.diagnosis?.rootCause??null,
        proposedPatches:JSON.stringify(evidence.attempts.map(({iteration,proposedPatch,verifierPass})=>
          ({iteration,content:proposedPatch,verifierPass}))),
        attempts:evidence.attempts.length,evidenceSha256:evidence.evidenceSha256,evidenceFile:path };
    }
    row.elapsedMs = Math.round(performance.now() - started);
    rows.push(row);
    onResult(row);
  }
  const resolved = rows.filter(r => r.status === 'resolved').length;
  return {
    title: 'Scythe Apertus RepairBench, original single-file fixtures',
    evaluation: 'fixed hidden Node assertions; reference fixes never sent to model',
    modelIdentityIndependentlyAttested: false,
    total: rows.length,
    resolved,
    unresolved: rows.filter(r => r.status === 'unresolved').length,
    errors: rows.filter(r => r.status === 'error').length,
    rate: rows.length ? resolved / rows.length : null,
    rows,
  };
}

export async function saveBatch(dir, runId, report) {
  await mkdir(dir, {recursive:true});
  const base = join(dir, `repairbench-${runId}`);
  const fields = ['caseId','model','endpoint','status','diagnosis','proposedPatches','verifierPassed',
    'firstPass','attempts','modelCalls','reportedTokens','elapsedMs','errorCategory','error','evidenceSha256','evidenceFile'];
  const tsv = [fields.join('\t'), ...report.rows.map(row => fields.map(f => tsvCell(row[f])).join('\t'))].join('\n')+'\n';
  const jsonFile = base+'.json';
  await writeFile(jsonFile, JSON.stringify(report,null,2)+'\n');
  await writeFile(base+'.tsv',tsv);
  return {jsonFile,tsvFile:base+'.tsv'};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({options:{
    limit:{type:'string',default:'2'},
    case:{type:'string'},
    attempts:{type:'string',default:'2'},
    help:{type:'boolean',default:false},
  }});
  if(values.help){
    console.log('Usage: node src/benchmark.mjs [--limit 1..12] [--case CASE_ID] [--attempts 1|2]');
    console.log('Requires a genuine Apertus-compatible LLM_BASE_URL; mock output is not model performance.');
    process.exit(0);
  }
  if (!process.env.LLM_BASE_URL) throw Error('LLM_BASE_URL is required for genuine Apertus inference');
  const all = await loadCases();
  const limit = Number(values.limit), maxAttempts = Number(values.attempts);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > all.length) throw Error(`--limit must be 1–${all.length}`);
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) throw Error('--attempts must be 1 or 2');
  const selected = values.case ? all.filter(e=>e.id===values.case) : all.slice(0,limit);
  if (selected.length === 0) throw Error('Unknown --case fixture ID');
  const artifactDir = process.env.EVIDENCE_DIR || '/artifacts';
  const start = new Date().toISOString();
  const report = await evaluateBatch(selected, {
    createClient:()=>new ApertusClient(), verifier:new VerifierQueue(),
    evidenceDir:artifactDir, maxAttempts,
    onResult:r=>console.log(`${r.caseId}: ${r.status}, calls=${r.modelCalls}, elapsed=${r.elapsedMs}ms`),
  });
  Object.assign(report,{startedAt:start,completedAt:new Date().toISOString(),
    configuredModel:process.env.LLM_NAME||'swiss-ai/Apertus-v1.5-8B',
    sourceRevision:process.env.SOURCE_REVISION||'unrecorded',
    scope:selected.length===all.length?'complete 12-case suite':'partial run',
    runtime:'Apertus-compatible endpoint, offline verifier queue; not independently model-attested'});
  const files = await saveBatch(artifactDir,randomUUID().slice(0,8),report);
  console.log(JSON.stringify({report:files.jsonFile,tsv:files.tsvFile,resolved:report.resolved,total:report.total}));
  if(report.errors) process.exitCode=1;
}
