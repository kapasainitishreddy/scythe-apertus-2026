# Submission field checklist (copy when public links are ready)

**Event:** Hack Apertus Online 2026

**Track:** Track 2B — Own Project

**Project title:** Scythe Apertus: Sovereign Autonomous Software Repair

**Team:** Syrava

**Short description:** A sovereign, open-source software repair prototype powered by Apertus v1.5. It diagnoses a failing JavaScript program, proposes a minimal patch, validates it in an offline, unprivileged Docker verifier, and produces an auditable evidence record with SHA-256 hashes and independently observed test outcomes.

**Problem and value:** AI-generated fixes often appear convincing without reproducing the failure, and proprietary agents can require sensitive code to leave an organization's control. Scythe Apertus separates model reasoning from code execution, treats independent tests as its source of truth, and supports organization-administered on-premises deployment.

**Purposeful Apertus use:** Apertus v1.5 is the required model engine for root-cause diagnosis, patch generation, verification-feedback retry, and the final critique. Deterministic hidden tests, not the model, make the correctness decision.

**Technical highlights:** Two-service Docker Compose architecture, one-command `make run`, non-root isolated verifier with no network or model credentials, 12 synthetic benchmark tasks with proven broken/fixed discrimination, local Node unit and integration tests, evidence digest, and an accessible dashboard.

**Honest evaluation status:** All 12 original broken cases fail and all 12 curated reference repairs pass their hidden assertions; 19/19 automated tests passed. The full integration test used a controlled mock endpoint. A genuine Apertus repair rate may only be added after real inference has been performed.

**Repository URL:** https://github.com/kapasainitishreddy/scythe-apertus-2026

**Demo video URL:** https://github.com/kapasainitishreddy/scythe-apertus-2026/blob/main/track_2b/Scythe_Apertus_Demo_Preview.mp4 (109-second prototype walkthrough; live Apertus run not shown)

**Technical report:** Upload `track_2b/Syrava_Report.pdf` (PDF, <= 6 pages excluding references)

**Optional dataset URL:** The dataset is included under `data/cases.json`. If a separate Hugging Face dataset URL is requested, publish per official HF template and include evaluation samples, real model responses and license metadata. Do not fabricate model responses.

**License:** Apache-2.0 code, CC BY 4.0 docs/report, CDLA-Permissive-2.0 dataset.

**Pre-existing work disclosure:** The broader private Scythe/BlackScythe project predates October 2026. This public submission is a separately authored, original Hack Apertus prototype created during the hackathon period. It does not redistribute the older proprietary/private monorepo.

**Official portal:** https://hackapertus.ch/online-hack/submissions
