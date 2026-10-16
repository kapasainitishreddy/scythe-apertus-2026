# What the Hack Apertus judges actually expect

**Hack Apertus's online October 2026 event is its first series stage. There are no earlier Hack Apertus winners to copy.** We instead studied other agent-hackathon winners and took design lessons, not code.

## Explain Scythe Apertus in 20 seconds

Sometimes an AI writes a patch that looks convincing but does not fix a bug. Scythe Apertus asks an open model, Apertus, to propose a repair. A separate offline container tests the code, and Scythe records what changed and what passed or failed. The model can propose changes, but it cannot award itself a passing test.

## Judges' rubric, in plain English

| Criterion | Question judges will ask | Where to inspect | Status |
|---|---|---|---|
| Purposeful AI use | Did Apertus actually diagnose, repair and critique a failure? | src/core.mjs; a genuine run | Workflow built; live Apertus run not yet recorded |
| Technical rigor | Can we reproduce failures, and are tests independent? | src/verifier.mjs, src/benchmark.mjs, tests/ | 25 independent Node tests pass |
| Value, cost and scalability | Why does anyone need this, how expensive is it, and what are its limits? | Dashboard, benchmark JSON/TSV, technical report | Single-file demonstration, not enterprise-grade |
| Sovereign deployability | Can source code and models stay on a controlled machine? | compose.yaml, compose.onprem.yaml, Makefile | On-prem configuration prepared, GPU startup unverified |
| Feasibility | Does make run launch something useful from a clean checkout? | README, Docker Compose, data/ | Node package checks pass; Docker runtime test pending |

The official Track 2B template requires a **public repository preserving track_2b/**, Docker **make run**, a sovereign deployment option (on-premises, air-gapped or Swiss cloud), data below 100 MB, a technical-report PDF under six pages excluding references, and a two-minute-or-shorter demo video. Submit through the official Hack Apertus portal, not Devpost. Official template: https://github.com/HackApertus/project-template/tree/main/track_2b

## Comparable winners, what they actually did

- **RiskWise**, Microsoft AI Agents Hackathon 2025 Best Overall: a complete, practical supply-chain risk system. Lesson: show a full working journey, not a feature list. https://microsoft.github.io/AI_Agents_Hackathon/winners/
- **ModelProof**, Best JavaScript/TypeScript Agent in the same event: focused on supervising AI outputs. Lesson: independent verification is a useful product feature. https://techcommunity.microsoft.com/blog/azuredevcommunityblog/ai-agents-hackathon-2025-%E2%80%93-category-winners-showcase/4415088
- **VendorGuard**, 2026 Microsoft Agent Academy Operative Track winner and highest-scoring entry in the event: solved a specific contract-compliance task. Lesson: a focused application beats a generic collection of agents. https://microsoft.github.io/agent-academy/events/hackathon/

These are analogies, not predictions of Hack Apertus winners.

## The three source repositories you asked us to study

1. **Ponytail**, DietrichGebert/ponytail. Reuse what's in the project, prefer standard library, never skip risk checks, and add a test for nontrivial logic. We apply these practices in AGENTS.md and the minimal dependency footprint. https://github.com/DietrichGebert/ponytail
2. **Karpathy autoresearch**, karpathy/autoresearch. Keep a fixed evaluation, run bounded experiments, and log each result including failures. We apply it in src/benchmark.mjs and its JSON/TSV output. https://github.com/karpathy/autoresearch
3. **Cloudflare workerd / workers-sdk**. Their local-first, production-like testing philosophy is useful. We did *not* add an unnecessary Cloudflare-hosted runtime: it would weaken the clear on-premises sovereignty story without improving the repair demonstration. https://github.com/cloudflare/workerd

## Judge-friendly two-minute demo order

1. Show one broken line and the failing-test result, in human language.
2. Explain that the original reference fix passing validates the **fixture**, not the AI model.
3. If a genuine Apertus server is connected, show its diagnosis and patch, then the independent verifier's result. If not, clearly say real inference is pending.
4. Show SHA-256 evidence and a JSON/TSV row, including failed attempts if any.
5. Show how an organization can run the verifier offline and host Apertus on its own GPU.

**Do not claim a real-model success rate, an executed GPU deployment, or SWE-bench results until independently verified.**
