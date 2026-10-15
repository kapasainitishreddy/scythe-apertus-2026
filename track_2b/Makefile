.PHONY: run run-onprem test stop logs verify clean-help

# Required official Hack Apertus entrypoint. Runs two non-root containers.
run:
	docker compose up --build

# Optional all-on-premises deployment with the official Apertus v1.5 vLLM image.
# Requires an NVIDIA GPU, model access, and Docker NVIDIA toolkit.
run-onprem:
	docker compose -f compose.yaml -f compose.onprem.yaml up --build

# All package tests are independent of GitHub Actions and cloud services.
test:
	node --test tests/*.test.mjs

# Query dashboard and exercise original defect/reference verification manually.
verify:
	@echo "Open http://localhost:8787 and click Verify fixture."
	@echo "Optional with actual Apertus: supply LLM_BASE_URL and LLM_NAME before make run."

logs:
	docker compose logs --tail=100

stop:
	docker compose down

# No automatic volume deletion - preserves all evidence artifacts.
clean-help:
	@echo "Volumes are preserved by default; remove them manually only if intended."
