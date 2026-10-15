# Demo video, maximum two minutes

**Recommended recording:** 16:9 screen capture, 1080p, no longer than 2:00. Do not present fixture validation or mock results as model success.

| Timestamp | On screen | Spoken narration |
|---|---|---|
| 0:00–0:12 | Scythe Apertus dashboard | “An AI-generated patch can look correct and still fail. Scythe Apertus focuses on repairs developers can verify.” |
| 0:12–0:27 | Architecture diagram: controller → Apertus → offline verifier → evidence | “Apertus handles diagnosis and patch generation. It never receives arbitrary shell access. An isolated, network-disabled Docker worker tests candidate code.” |
| 0:27–0:43 | Select a fixture and click Verify fixture | “Before measuring AI performance, we validate our original twelve-task dataset. Every broken case must fail, and every independently prepared reference fix must pass.” |
| 0:43–1:18 | If a *real* Apertus endpoint is connected: click Run Apertus repair, show a live diagnosis and candidate patch | “Now Apertus inspects the bug and proposes a minimal replacement. The verifier runs hidden assertions, and failures can trigger one bounded retry.” |
| 1:18–1:40 | Show the actual evidence JSON, verifier result and hashes | “We do not accept model confidence as proof. Scythe records the exact source hashes, every test result, model identity, usage, and a tamper-evident record digest.” |
| 1:40–1:55 | Show Docker Compose + research/evaluation README | “The entire prototype is open source, runs on-premises, and exposes its evaluation limitations so others can reproduce it.” |
| 1:55–2:00 | Project title and public repo URL | “Scythe Apertus. Fix the bug. Prove the fix.” |

**If real Apertus inference is unavailable:** Replace 0:43–1:40 with an explicitly captioned “Architecture and verifier demonstration, no real model run,” and show the baseline/fixture validation plus source. This is a valid product walkthrough **but not evidence of Apertus repair success**.

## Publication

Upload the actual recording to an unlisted/public video host and place its accessible URL in the submission form. An MP4 file on your own computer is not a public URL until uploaded. Avoid using background music or third-party assets unless licensed.
