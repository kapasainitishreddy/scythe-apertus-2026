# Track 2B: Scythe Apertus

**An inspectable, sovereign software-repair agent powered by Apertus 1.5.**

| Field | Value |
|---|---|
| Competition | Hack Apertus 2026, Online, Track 2B: Own Project |
| Team | Syrava |
| Models | Apertus v1.5 8B (default); compatible self-hosted Apertus models configurable |
| Target deployment | **On-premises**, on organization-administered hardware |
| Model use | Bug diagnosis, minimal code generation, verification-feedback repair, final critique |
| Verifier | Separate unprivileged Docker container, with no networking or LLM credentials |
| Output | SHA-256 evidence report per actual Apertus attempt |
| Project status | Tested prototype, genuine Apertus inference pending external endpoint |

## The problem

AI coding agents frequently generate plausible fixes without demonstrating that they solve the stated failure, and some require private source to leave the developer's infrastructure. Scythe Apertus focuses on an auditable repair loop: diagnose, patch, run deterministic tests outside the agent's execution boundary, and preserve evidence.

## One-command Docker run (mandatory)

**Prerequisites:** Docker Engine + Docker Compose plugin, at least 1 GB available to the two small app containers. A self-hosted Apertus model server is optional for fixture validation but required for actual model repair. Model weights are not redistributed.

```bash
make run
```

This builds and starts two services: a local dashboard/controller on **http://localhost:8787** and an offline, network-disabled verifier worker. No GitHub Actions or third-party SaaS credentials are needed to start the dashboard and validate the original benchmark fixtures.

**To run genuine Apertus inference:**

```bash
export LLM_NAME='swiss-ai/Apertus-v1.5-8B'
export LLM_BASE_URL='http://host.docker.internal:8000/v1'
# Export LLM_API_KEY only if YOUR inference gateway requires a bearer token.
make run
```

The model server should implement OpenAI-compatible `POST /chat/completions` with the configured `model` name. When using a containerized or hosted gateway, replace the URL and model ID as actually served. For an entirely on-premises topology, host Apertus on local administered compute and restrict that endpoint to your internal network. The verifier service stays `network_mode: none` regardless of the selected model endpoint.

**If no model URL is configured:** the dashboard deliberately shows “MODEL NOT CONNECTED”, disables the repair action, and still allows checking every broken/reference pair. It does not simulate a real model repair or invent success rates.

## Optional: fully on-premises Apertus server (GPU machine)

For a host with suitable NVIDIA GPU memory, NVIDIA drivers/toolkit, and permission to download the Apertus weights, the package also includes a model-serving overlay using the **Swiss AI Initiative's own Apertus 1.5 vLLM Docker image**:

```bash
# Provide your own Hugging Face model-download token in your shell.
export HF_TOKEN='YOUR_TOKEN_FROM_HF'  # Do not commit it
make run-onprem
```

This composes the controller, offline verifier and a third `apertus` model server on the same organization-administered Docker host. The model is served on the internal Compose network, not exposed on a public port. The model may take time to download and initialize; wait for its logs to show readiness before invoking **Run Apertus repair**. 

**This optional GPU configuration is provided but was not executed on the current authoring machine.** It is not suitable for a 4 GB consumer GPU. Official model guidance: https://huggingface.co/swiss-ai/Apertus-v1.5-8B/blob/main/README.md .

## Public assets

- [Public source repository](https://github.com/kapasainitishreddy/scythe-apertus-2026)
- [Report PDF](https://github.com/kapasainitishreddy/scythe-apertus-2026/blob/main/track_2b/Syrava_Report.pdf)
- [109-second demo preview](https://github.com/kapasainitishreddy/scythe-apertus-2026/blob/main/track_2b/Scythe_Apertus_Demo_Preview.mp4). This shows architecture and true fixture-validation results; it is not a recording of live Apertus inference.

## End-to-end demonstration

1. Open the dashboard, select `pagination-offset`, and click **Verify fixture**. The verifier executes the broken source (must fail) and the reference source (must pass). This is a dataset quality check **not a model result**.
2. Provide an authentic on-premises Apertus endpoint through `LLM_BASE_URL`; restart `make run`.
3. Click **Run Apertus repair**. Apertus produces a concise diagnosis and a complete replacement patch limited to `bug.cjs`.
4. The offline worker executes hidden Node assertions against that patch in a restricted container. A failed test result is fed back to Apertus, allowing one more candidate.
5. Apertus critiques the verified result. Success requires **both** the independent tests and a passing critique.
6. Audit the evidence: before/after SHA-256, per-attempt verifier status, test-output hash, model identifier, token counts when returned, and final record digest. On success or failure the record is saved to the persistent Docker `evidence` volume.

## Fixed-evaluator benchmark (optional real Apertus run)

Ponytail and Karpathy's autoresearch informed this small, inspectable approach: **keep the verifier fixed, record every attempt, and avoid unnecessary frameworks**. Once an actual Apertus model endpoint is running, start with two cases:

```bash
docker compose exec -T app node src/benchmark.mjs --limit 2
# Full twelve-case experiment:
docker compose exec -T app node src/benchmark.mjs --limit 12
# Or focus on just one broken example:
docker compose exec -T app node src/benchmark.mjs --case pagination-offset
```

Each attempt produces evidence; the batch produces `repairbench-<id>.json` and `.tsv` under the persistent `/artifacts` volume. The runner refuses to start without `LLM_BASE_URL`, never replaces model output with a known reference fix, and counts failures and errors. You can copy an artifact out with `docker compose cp app:/artifacts/<filename> ./<filename>`.

To understand the five official judging criteria and learn from comparable past winners, see [What judges expect](docs/EXPECTATIONS.md).

## Architecture

```text
┌─────────────────────────────── On-premises Docker host ─────────────────────────────┐
│ Browser  →  Controller / dashboard  →  Apertus v1.5 inference server (organization) │
│                       │                                                             │
│                  Candidate patch                                                    │
│                       ↓                                                             │
│             Docker requests volume (read-only in verifier)                         │
│                       ↓                                                             │
│        Offline verifier container • no network • no API keys                       │
│                       ↓                                                             │
│             Docker results volume (read-only in controller)                        │
│                       ↓                                                             │
│            Evidence JSON + SHA-256 → persistent artifacts volume                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

The prototype currently repairs one allowed file in an original, synthetic benchmark. This is intentionally narrower than the commercial Scythe IDE, and the limitation is explicit.

## Repository and dataset

`src/` contains only the new Hack Apertus implementation, `data/cases.json` has twelve original defects with hidden assertions and reference solutions, `tests/` contains independent unit and integration tests, and `docs/` contains architecture, research attribution, reproducibility, and a video script. `data/` is substantially under the 100 MB limit.

**Reference fixes and hidden tests are never included in model prompts.** They appear in the public dataset solely for reproducibility. The model receives the broken source, issue and verifier feedback. No benchmark outcome is counted if the reference implementation, not Apertus, supplied the patch.

## Local verification, no GitHub Actions

If you have Node 20+ available, run:

```bash
node --test tests/*.test.mjs
```

This validates the curated dataset and executes a full queue-based integration test with a **mock endpoint explicitly labeled as such**. It does not require Docker. The strict Docker separation is defined in `compose.yaml`; its actual runtime requires Docker and should be verified on a Docker-enabled machine before final publication.

## Evidence and honest boundaries

- **25/25** package tests passed on the local test environment as of October 15, 2026.
- **12/12** broken implementations fail their hidden checks; **12/12** curated reference repairs pass those checks.
- **Real Apertus repair success rate:** not measured until a genuine model endpoint is used.
- The configured model identifier is not cryptographically attested by the HTTP API. Evidence records explicitly say `modelIdentityVerified: false`; independent source/test verification is separate from provider/model authenticity.
- **`make run` Docker Compose:** provided and YAML-parsed, not executed in the current build container because Docker is unavailable there.
- This test suite is **not** SWE-bench. It does not establish performance on realistic multi-file enterprise repositories.
- The UI does not authenticate remote users; bind the dashboard to loopback or place it behind a trusted reverse proxy if used outside a judge's workstation.

## Safety

Model-generated content is never executed by the controller. The worker does not receive `LLM_API_KEY` and has no network access or privilege escalation. Its child Node process also uses the permission model to block filesystem writes, child-process spawning and file reads outside the isolated fixture. The workflow restricts patches to one fixture file. Docker process isolation is defense in depth, not a formal security guarantee.

## Submission status

A working app and a verified dataset are included. Before claiming the competition is fully submitted, the team must publish this folder in a **public** repo based on the official template, run genuine Apertus inference, link a <=2-minute public/unlisted demo video, and upload the report PDF through the official Hack Apertus portal. Do not mistake the ZIP for a submitted entry.

## Licensing

Source code Apache-2.0. Documentation and media CC BY 4.0. Submitted dataset CDLA-Permissive-2.0. All data is originally authored and contains no personal information. See [licensing details](LICENSES/README.md).
