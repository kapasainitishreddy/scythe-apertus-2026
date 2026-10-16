# Evaluation protocol: original RepairBench-12

## Objective

Measure whether an Apertus language model, shown only a bug report, buggy source and verifier feedback, produces a patch that satisfies independent assertions. Do not count model self-confidence as correctness.

## Corpus

- 12 originally authored CommonJS snippets covering access-control host matching, pagination, backoff, configuration, deduplication, exact lookup, clamping, inclusive dates, cache expiration, numeric sorting, integer parsing, and tax/discount order.
- Each case includes `broken`, `reference` (held out from the model prompt), `hiddenTests`, license, provenance and a boolean indicating no personal data.
- The fixtures are small synthetic algorithmic problems, not sampled user repositories. They are not comparable to SWE-bench.

## Baseline validation

The corpus is accepted only if all broken implementations fail the relevant tests and all reference implementations pass. Baseline pass/fail is **not a model success rate**. It verifies test-discriminating capability.

## Model assessment

For a real Apertus run, each case must record: original SHA-256; model and endpoint; diagnosis; each generated patch SHA-256 and summary; independent verifier pass/fail and its output digest; final critique; timestamp; usage if returned; and digest of complete evidence. A case is resolved only if the independent verifier passes and the independent critique verdict is `pass`.

The model receives no hidden test code, no reference patch, and no library of previous answers in prompts. The code being evaluated executes only in the isolated verifier service with network disabled.

## Caveats

- The dataset is publicly available for reproduction, so long-term evaluation must use a private holdout not disclosed to the model.
- Artificial problems may be easy to memorize or heuristically correct.
- The verifier runs hidden tests in the same ephemeral directory as candidate code, so malicious code could introspect a test file. Future versions should use stronger instrumentation and externally scored tests.
- Docker security boundaries must be checked on the specific judge host. They reduce risk but do not eliminate kernel/container escape risks.
- We do not report a real model repair rate unless a genuine Apertus endpoint completes evaluation.

## Observed reproducibility result on 2026-10-15

- 12/12 broken implementations failed their hidden assertions.
- 12/12 curated reference implementations passed.
- 25/25 local Node tests passed, including a full controller-to-offline-worker integration test that used a mock LLM endpoint.
- Genuine Apertus inference **not yet measured**.
- Docker Compose runtime **not executed on this authoring host** (Docker CLI unavailable). Compose YAML parsed successfully.

## Fixed experiment ledger

For real Apertus inference, start the two Docker services and run `docker compose exec -T app node src/benchmark.mjs --limit 2`. After validating the endpoint and inspecting reports, use `--limit 12`. JSON and TSV files include every successful, unresolved or errored case with elapsed milliseconds, calls, token counts when reported, and a link to the SHA-256 evidence record. No model-free or mocked benchmark counts as Apertus performance.

## Security regression checks

The offline worker uses Node's permission model inside Docker. It denies generated code writes, spawning child processes, and reading files outside the temporary fixture. Four security tests specifically exercise these boundaries. The known limitation remains that the fixture's public tests can be analyzed by a motivated adversary; a blinded external holdout is needed before making broad reliability claims.
