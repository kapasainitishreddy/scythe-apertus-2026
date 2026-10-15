# Research foundations and what we actually borrowed

Scythe Apertus is original code. We cite the following ideas and papers as *inspiration*, not as code or benchmark results that we reproduced:

1. **Xia et al., Agentless: Demystifying LLM-based Software Engineering Agents** (2024), https://arxiv.org/abs/2407.01489 . A deliberately simpler localization, patch, validation pipeline often compares favorably to complex agent swarms. Scythe likewise constrains its planning and tool surface.
2. **Zhang et al., AutoCodeRover: Autonomous Program Improvement** (2024), https://arxiv.org/abs/2404.05427 . Structured code search and localization improve the relevance of the context shown to a model. Scythe's initial 12-case benchmark has only one file and does not claim sophisticated repository-wide localization.
3. **Jimenez et al., SWE-bench: Can Language Models Resolve Real-World GitHub Issues?** (2023/2024), https://arxiv.org/abs/2310.06770 . Ground truth must come from independently executed tests, not model self-report. Our small original benchmark borrows the evaluation principle, **not the dataset or numerical scores**.
4. **Yang et al., SWE-smith: Scaling Data for Software Engineering Agents** (2025), https://arxiv.org/abs/2504.21798 . Programmatically constructing reproducible faults is useful for evaluation. Our 12 fixtures were created manually and independently validated; no SWE-smith code was imported.
5. **Official Hack Apertus Track 2B template** (October 2026), https://github.com/HackApertus/project-template/tree/main/track_2b . Defines Docker `make run`, sovereign target, code, report PDF, dataset and demo requirements.
6. **Swiss AI Initiative Apertus v1.5 model card** (2026), https://huggingface.co/swiss-ai/Apertus-v1.5-8B . Defines intended model family, license and deployment details. Model weights are not in the repository.

No patent, paper, social-media post, or external repository was copied into this package. We do not claim a novel algorithm or patentability. The engineering contribution is a reproducible, auditable demonstration of a constrained Apertus-backed code-repair workflow and a separated offline verifier.

7. **Official Apertus 1.5 vLLM Docker deployment** (Swiss AI Initiative), https://www.apertus-ai.org/docs/deploy/azure/#deploy-with-a-docker-container . We reference the official provided container in an optional on-premises Compose overlay rather than copying any model artifacts.
