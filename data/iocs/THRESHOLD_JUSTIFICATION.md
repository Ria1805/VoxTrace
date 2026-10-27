# Playbook thresholds: justification (draft for the paper)

Status: these cut-offs are design choices. They are not yet backed by measured results from the final detector.
The fused score is a weighted average, not a calibrated probability, so "0.70" does not mean "70% chance of fake".
The paper must say the thresholds are provisional and show how they were later tuned (last section).

## Principle
Each tier triggers a more costly action, so the bar for it is higher. The higher the cost of a wrong call,
the higher the score we require.

| Score | Severity | Action | Why this cut-off |
|---|---|---|---|
| < 0.50 | LOW | Log only | Below the detector's own "more likely real than fake" line. Nothing is lost: the sample is still hashed and stored. |
| 0.50 to 0.69 | MEDIUM | Analyst triage, callback on a known-good number | 0.50 is the natural decision boundary for a two-class score. The actions cost a few minutes and nothing is blocked, so a wrong alert is cheap. |
| 0.70 to 0.89 | HIGH | Hold transaction until verified another way | Holding a payment delays a real customer, so we ask for clearly more than a coin flip. The hold is reversible once the caller is verified. |
| >= 0.90 | CRITICAL | Block session, notify lead, file report | Blocking is hard to undo and a wrong block hurts a real person, so it needs the strongest evidence. |

## IOC rule
Exact IOC matches raise severity by one tier, capped at HIGH. Tool references are logged only.
Reasons are in data/iocs/MATCH_RULE.md.

## How to tune them (fill in from real results)
1. Fit the detector on the training split, then pick cut-offs on a development split only. Never on the test split.
2. Set 0.50 near the equal-error-rate point.
3. Set 0.70 where the false-alarm rate on real calls is at most [X]%.
4. Set 0.90 where the false-alarm rate on real calls is at most [Y]%.
5. Repeat on telephony-quality (band-limited) audio, since real scam calls sound like that.
6. Report the final numbers and how many real calls each tier would have flagged.

[X] and [Y] are left blank on purpose: choose them with the team after seeing real results.
