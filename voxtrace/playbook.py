"""Incident response playbook (owner: Harshita). Maps score + intel to severity and actions."""

PLAYBOOK = [
    # (min fused score, severity, actions)
    (0.90, "CRITICAL", ["Block/terminate session", "Preserve evidence (already hashed)", "Notify security lead",
                        "Escalate for manual voice-print / frame review", "File incident report"]),
    (0.70, "HIGH", ["Hold transaction pending out-of-band verification", "Escalate for manual review",
                    "Preserve evidence"]),
    (0.50, "MEDIUM", ["Flag for analyst triage", "Request callback on known-good number"]),
    (0.00, "LOW", ["Log only"]),
]


def respond(fused_score: float, ioc_matches: list):
    for floor, sev, actions in PLAYBOOK:
        if fused_score >= floor:
            actions = list(actions)
            if ioc_matches and sev in ("MEDIUM", "LOW"):
                sev = "HIGH"
                actions.insert(0, "Known scam infrastructure matched: escalate severity")
            elif ioc_matches:
                actions.insert(0, "Known scam infrastructure matched")
            return sev, actions
