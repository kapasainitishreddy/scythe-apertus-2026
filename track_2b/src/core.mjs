/**
 * Scythe Apertus - inspectable open-weight software repair prototype.
 * Copyright 2026 Syrava. Apache-2.0.
 *
 * The controller never executes model-generated code. Verification crosses
 * a file queue into a separate offline, unprivileged worker container.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const MAX_PATCH_BYTES = 24_000;
const MAX_OUTPUT_CHARS = 3_500;
const MAX_VERIFY_WAIT_MS = 25_000;
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
export const casesFile = join(root, 'data', 'cases.json');

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function loadCases() {
  const raw = JSON.parse(await readFile(casesFile, 'utf8'));
  if (!Array.isArray(raw) || !raw.every(x => x?.id && x?.issue && x?.broken && x?.hiddenTests)) {
    throw new Error('Invalid RepairBench dataset');
  }
  return raw;
}

export function publicCase(entry) {
  return { id: entry.id, category: entry.category, issue: entry.issue,
    broken: entry.broken, license: entry.license };
}

export function parseObject(text) {
  if (typeof text !== 'string') throw new Error('Model output was not text');
  let trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('Model did not return JSON');
  trimmed = trimmed.slice(first, last + 1);
  const parsed = JSON.parse(trimmed);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Expected JSON object from Apertus');
  }
  return parsed;
}

export function validatePatch(payload) {
  const path = payload?.path;
  const content = payload?.content;
  const summary = payload?.summary;
  if (path !== 'bug.cjs') throw new Error('Apertus attempted to modify a non-allowlisted file');
  if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content) > MAX_PATCH_BYTES) {
    throw new Error('Apertus returned empty or oversized patch');
  }
  if (typeof summary !== 'string' || summary.trim().length === 0 || summary.length > 800) {
    throw new Error('Apertus did not give a concise patch summary');
  }
  return { path, content, summary: summary.trim() };
}

function normalizeEndpoint(raw) {
  if (!raw || !/^https?:\/\//i.test(raw)) throw new Error('LLM_BASE_URL must be an http(s) endpoint');
  const base = raw.replace(/\/+$/, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

export class ApertusClient {
  constructor({baseUrl = process.env.LLM_BASE_URL,
               model = process.env.LLM_NAME || 'swiss-ai/Apertus-v1.5-8B',
               key = process.env.LLM_API_KEY || '',
               fetchImpl = fetch, timeoutMs = 95_000} = {}) {
    this.endpoint = normalizeEndpoint(baseUrl);
    this.model = model;
    this.key = key;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.requestCount = 0;
    this.tokenTotals = {prompt: 0, completion: 0, total: 0};
  }
  async complete(messages, maxTokens = 1200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method:'POST',
        headers: {
          'content-type':'application/json',
          ...(this.key ? {authorization:`Bearer ${this.key}`} : {}),
        },
        body: JSON.stringify({model:this.model,messages,temperature:0.05,
          max_tokens:maxTokens,stream:false}),
        signal:controller.signal,
      });
      if (!res.ok) throw new Error(`Apertus endpoint HTTP ${res.status}: ${(await res.text()).slice(0,250)}`);
      const json = await res.json();
      const value = json?.choices?.[0]?.message?.content;
      const text = typeof value === 'string' ? value :
        (Array.isArray(value) ? value.map(x=>x.text ?? '').join('') : '');
      if (!text.trim()) throw new Error('Apertus endpoint returned empty response');
      this.requestCount += 1;
      this.tokenTotals.prompt += json?.usage?.prompt_tokens ?? 0;
      this.tokenTotals.completion += json?.usage?.completion_tokens ?? 0;
      this.tokenTotals.total += json?.usage?.total_tokens ?? 0;
      return text;
    } finally { clearTimeout(timer); }
  }
}

export class VerifierQueue {
  constructor({requestDir = process.env.REQUEST_DIR || '/queue/requests',
    resultDir = process.env.RESULT_DIR || '/queue/results', timeoutMs=MAX_VERIFY_WAIT_MS} = {}) {
    this.requestDir = requestDir;
    this.resultDir = resultDir;
    this.timeoutMs = timeoutMs;
  }
  async send(caseId, code) {
    if (typeof caseId !== 'string' || !/^[a-z0-9-]+$/.test(caseId)) throw new Error('Unsafe case ID');
    if (typeof code !== 'string' || Buffer.byteLength(code) > MAX_PATCH_BYTES) throw new Error('Unsafe source size');
    await mkdir(this.requestDir, {recursive:true});
    const id = randomUUID();
    const target = join(this.requestDir, `${id}.json`);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify({id,caseId,code}));
    await rename(temporary,target);
    const resultPath = join(this.resultDir, `${id}.json`);
    const end = Date.now() + this.timeoutMs;
    while (Date.now() < end) {
      try {
        const obj = JSON.parse(await readFile(resultPath,'utf8'));
        return { ok: !!obj.ok, output: String(obj.output ?? '').slice(-MAX_OUTPUT_CHARS),
          exitCode: Number(obj.exitCode ?? 1), timeout: !!obj.timeout };
      } catch(e) { if (e?.code !== 'ENOENT') throw e; }
      await sleep(120);
    }
    throw new Error('Offline verifier timed out or failed to start');
  }
}

function message(role, content) {return {role,content};}

/** Genuine inference only; never emit a model-success result for a mock or baseline. */
export async function repairCase(entry, {client, verifier, onStep=()=>{}, maxAttempts=2} = {}) {
  if (!(client && verifier)) throw new Error('Apertus client and offline verifier are required');
  const startedAt = new Date().toISOString();
  const before = sha256(entry.broken);
  onStep('baseline');
  const baseline = await verifier.send(entry.id,entry.broken);
  if (baseline.ok) throw new Error('Invalid task: broken fixture unexpectedly passed');

  const diagnosisMessages = [
    message('system','You are Apertus v1.5 acting as a software failure diagnostician. Return only JSON: {"rootCause":"short reason","confidence":0.0}. Do not claim tests were executed by you.'),
    message('user',`Issue: ${entry.issue}\n\nSource file bug.cjs:\n${entry.broken}\n\nObserved failing test output:\n${baseline.output.slice(-1200)}`),
  ];
  onStep('diagnosis');
  const diagnosisObj = parseObject(await client.complete(diagnosisMessages,500));
  const diagnosis = {
    rootCause: String(diagnosisObj.rootCause ?? '').slice(0,600),
    confidence: Math.max(0,Math.min(1,Number(diagnosisObj.confidence) || 0)),
  };
  if (!diagnosis.rootCause) throw new Error('Apertus did not produce a diagnosis');

  let lastOutput = baseline.output;
  let lastPatch = null;
  const attempts = [];
  for (let i=1;i<=maxAttempts;i++) {
    onStep(`patch ${i}`);
    const response = await client.complete([
      message('system','You are Apertus v1.5 acting as a constrained code-repair agent. Return JSON only: {"path":"bug.cjs","summary":"what changed","content":"COMPLETE JavaScript CommonJS source"}. Only modify bug.cjs. Preserve exports and unrelated behavior. No shell calls or markdown.'),
      message('user',`Issue: ${entry.issue}\nDiagnosis: ${diagnosis.rootCause}\nOriginal source:\n${entry.broken}\n${i>1 ? `Previous patch failed. Verifier output:\n${lastOutput.slice(-1800)}\nPrevious patch:\n${lastPatch?.content}` : `Baseline failed with:\n${baseline.output.slice(-1200)}`}`),
    ],2500);
    const patch = validatePatch(parseObject(response));
    lastPatch = patch;
    onStep(`verification ${i}`);
    const verification = await verifier.send(entry.id,patch.content);
    attempts.push({ iteration:i,summary:patch.summary,sourceSha256:sha256(patch.content),
      verifierPass:verification.ok,verifierOutputSha256:sha256(verification.output),
      verifierExcerpt:verification.output.slice(-1100),verificationExitCode:verification.exitCode });
    lastOutput = verification.output;
    if (verification.ok) break;
  }
  if (!lastPatch) throw new Error('No patch generated');
  onStep('critique');
  const critiqueValue = parseObject(await client.complete([
    message('system','You are an independent Apertus patch reviewer. Return only JSON: {"verdict":"pass|fail|uncertain","summary":"evidence based assessment"}. If tests fail, you must not pass.'),
    message('user',`Issue: ${entry.issue}\nDiagnosis: ${diagnosis.rootCause}\nPatch summary: ${lastPatch.summary}\nVerifier outcomes: ${JSON.stringify(attempts.map(a=>({pass:a.verifierPass,excerpt:a.verifierExcerpt.slice(-400)})))}`),
  ],500));
  const critique = {verdict:['pass','fail','uncertain'].includes(critiqueValue.verdict)?critiqueValue.verdict:'uncertain',
    summary:String(critiqueValue.summary??'').slice(0,750)};
  const finalVerified = attempts.at(-1)?.verifierPass === true;
  const success = finalVerified && critique.verdict === 'pass';
  const evidence = {
    schemaVersion:1,runId:randomUUID(),startedAt,completedAt:new Date().toISOString(),
    caseId:entry.id,model:client.model,providerEndpoint:client.endpoint.replace(/\/chat\/completions$/,''),
    genuineModelRun:true,baselineFailed:!baseline.ok,diagnosis,
    attempts,finalPatch:{path:'bug.cjs',summary:lastPatch.summary,content:lastPatch.content,
      beforeSha256:before,afterSha256:sha256(lastPatch.content)},
    critique,independentlyVerified:finalVerified,success,
    inferenceCalls:client.requestCount,usage:client.tokenTotals,
    evaluationLimitations:['Small synthetic fixture','No proof of general software-repair correctness','Public hidden tests kept out of prompt but included in dataset for reproducibility'],
  };
  evidence.evidenceSha256 = sha256(JSON.stringify(evidence));
  onStep(success?'completed':'unresolved');
  return evidence;
}

export async function saveEvidence(dir,evidence) {
  await mkdir(dir,{recursive:true});
  const target=join(dir,`repair-${evidence.caseId}-${evidence.runId}.json`);
  await writeFile(target,JSON.stringify(evidence,null,2)+'\n');
  return target;
}
