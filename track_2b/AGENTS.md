# Scythe Apertus coding rules

Inspired by DietrichGebert/ponytail (MIT): https://github.com/DietrichGebert/ponytail

- Solve the whole task using the smallest readable change. Prefer Node's standard library to dependencies.
- Read callers, tests, verifier boundary and Docker configuration before editing.
- Never remove validation, security protections, error handling or accessibility to save lines.
- Every meaningful code change gets a focused regression test.
- Generated source must never execute in the controller. Only the offline worker can run it.
- Never send benchmark reference solutions or hidden tests to the model.
- Mock output is not an Apertus benchmark. Log all unsuccessful attempts.
- Keep evaluation fixed and results machine-readable, inspired by karpathy/autoresearch.
- No GitHub Actions. Use local Node and isolated Docker verification.
- At the end, state what was not verified and what remains risky.
