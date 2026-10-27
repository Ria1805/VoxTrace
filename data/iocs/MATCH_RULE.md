# IOC match rule (applies at every score, including score < 0.5)

The detector score and an IOC match are independent evidence. A low score does not cancel an IOC match.
But the two kinds of IOC are handled differently.

1. Exact indicator (type: domain, phone, sha256, ...), from a curated public feed:
   raise severity by ONE tier (LOW->MEDIUM, MEDIUM->HIGH). Cap at HIGH.
2. Tool reference (type: tts_tool): log it as context. Never changes severity.
3. CRITICAL (block/terminate session) is reached only by score >= 0.90. An IOC match alone never blocks.

Why:
- One weak clue is not proof. Spoofed caller IDs mean a listed phone number may belong to an innocent person.
- Voice-cloning tools have many legitimate users, so naming one is not evidence of fraud.
- Blocking a session is hard to undo, so it should rest on the detector score.
- Capping at HIGH means the worst result of a wrong IOC entry is a held transaction and a manual check, not a blocked caller.

Implemented in voxtrace/playbook.py (respond()).
