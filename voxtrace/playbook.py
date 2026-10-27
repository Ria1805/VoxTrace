"""Incident response playbook (owner: Harshita). Maps score + intel to severity and actions.

IOC rule (see data/iocs/MATCH_RULE.md):
  * Exact indicators (domain, phone, sha256, ...) raise severity by ONE tier, capped at HIGH.
    They never reach CRITICAL on their own: CRITICAL blocks the session, so it needs the score.
  * Tool references (type "tts_tool") are logged only. Those tools have legitimate users.
"""

PLAYBOOK = [
    # (min fused score, severity, actions)
    (0.90, "CRITICAL", ["Block/terminate session", "Preserve evidence (already hashed)", "Notify security lead",
                        "Escalate for manual voice-print / frame review", "File incident report"]),
    (0.70, "HIGH", ["Hold transaction pending out-of-band verification", "Escalate for manual review",
                    "Preserve evidence"]),
    (0.50, "MEDIUM", ["Flag for analyst triage", "Request callback on known-good number"]),
    (0.00, "LOW", ["Log only"]),
]

ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
ESCALATION_CAP = "HIGH"          # an IOC match alone can never push past this
CONTEXT_ONLY_TYPES = {"tts_tool"}  # logged, never escalate


def respond(fused_score: float, ioc_matches: list):
    exact = [m for m in (ioc_matches or []) if m.get("type") not in CONTEXT_ONLY_TYPES]
    context = [m for m in (ioc_matches or []) if m.get("type") in CONTEXT_ONLY_TYPES]

    for floor, sev, actions in PLAYBOOK:
        if fused_score >= floor:
            actions = list(actions)
            if exact:
                new_sev = ORDER[min(ORDER.index(sev) + 1, ORDER.index(ESCALATION_CAP))]
                if ORDER.index(new_sev) > ORDER.index(sev):
                    sev = new_sev
                    actions = list(next(a for f, s, a in PLAYBOOK if s == sev))
                actions.insert(0, "Known scam infrastructure matched: severity raised one tier")
            if context:
                actions.append("Context logged: claimed voice-cloning tool "
                               + ", ".join(sorted({str(m.get('value')) for m in context})))
            return sev, actions