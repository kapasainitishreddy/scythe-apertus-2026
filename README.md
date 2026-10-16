# Scythe Apertus

**Sovereign software repair with verifiable evidence.** A Hack Apertus 2026, Track 2B (Own Project) submission by Syrava.

This repository contains **only the new Hack Apertus prototype**, not the pre-existing Scythe/BlackScythe Forge IDE monorepo. The app uses Apertus v1.5 to diagnose and repair small software defects and delegates all generated-code execution to a separate, network-disabled Docker container. Every real model attempt yields a reproducible evidence record with SHA-256 content and verifier-output hashes.

## Run the official track layout

The official template's required directory is **`track_2b/`**, preserved without renaming.

```bash
cd track_2b
make run
```

Then open http://localhost:8787. The application starts in **fixture-validation mode** without model credentials, permitting honest baseline/reference tests; real model repair is available **only when `LLM_BASE_URL` points to an actual Apertus endpoint**.

Use an on-premises OpenAI-compatible Apertus v1.5 inference server (such as vLLM), then set `LLM_NAME`, `LLM_BASE_URL` and optional `LLM_API_KEY` before calling `make run`. See [track instructions](track_2b/README.md).

The code is dependency-light: Node.js standard library, offline `node:test`, and Docker Compose. **GitHub Actions is neither required nor included.**

## Links

- [Public submission repository](https://github.com/kapasainitishreddy/scythe-apertus-2026)
- [Technical report PDF](https://github.com/kapasainitishreddy/scythe-apertus-2026/blob/main/track_2b/Syrava_Report.pdf)
- [109-second prototype walkthrough (not a real-model benchmark)](https://github.com/kapasainitishreddy/scythe-apertus-2026/blob/main/track_2b/Scythe_Apertus_Demo_Preview.mp4)

## Deliverables

- [Track README](track_2b/README.md) with installation, environment, and honest claims
- [Technical report](track_2b/technical_report.md) and [six-page-or-fewer PDF](track_2b/Syrava_Report.pdf)
- [Original 12-case dataset](track_2b/data/cases.json), provenance and per-item license
- [UI + model workflow](track_2b/src/), separated from [offline verifier](track_2b/src/verifier.mjs)
- [Docker entrypoint](track_2b/Makefile), [Docker Compose](track_2b/compose.yaml)
- [Independent tests](track_2b/tests/) and documented evaluation protocol
- [2-minute demo narration](track_2b/docs/DEMO_SCRIPT.md)

## Start here: original build and judging guide

- [What Hack Apertus judges expect](track_2b/docs/EXPECTATIONS.md)
- [Karpathy-inspired fixed evaluator](track_2b/src/benchmark.mjs)
- [Offline verifier safety tests](track_2b/tests/security.test.mjs)
- [Ponytail-inspired engineering rules](track_2b/AGENTS.md)

The new batch CLI stores honest real-model results, including failed runs, as JSON and TSV. It refuses to run unless a model endpoint is configured. Cloudflare hosting is deliberately not needed for the sovereign on-premises submission.

## Evaluation status

Local Node execution passed 27/27 tests, including all 12 broken/reference fixture pairs, the HTTP-to-verifier pipeline with a **mock LLM response server**, and security regression cases. This is **not** a real Apertus repair result. No `LLM_BASE_URL` or `LLM_API_KEY` was configured in this environment, so genuine inference was not run. Docker is unavailable here, so a clean-checkout `make run` was not executed. The API endpoint/model identity cannot be independently authenticated by this prototype; evidence never claims cryptographic model verification.

## Licensing

Code Apache-2.0 (root LICENSE); original data CDLA-Permissive-2.0; documentation/report/media CC BY 4.0. See `track_2b/LICENSES/README.md`.

## Competition

[Hack Apertus official project template](https://github.com/HackApertus/project-template) | [Official submission portal](https://hackapertus.ch/online-hack/submissions)
