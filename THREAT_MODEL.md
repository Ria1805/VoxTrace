# VoxTrace evidence log — threat model and security-property matrix

Use this for the paper's DFIR section and limitations. Every row is an automated test in
`tests/test_custody.py` (`pytest -q tests/test_custody.py -v` regenerates the evidence).

## What to call it
**"Tamper-evident detection and evidence-integrity log."** Do **not** claim:
- **Non-repudiation.** HMAC is a shared secret: whoever can verify can also sign. Proving
  *who* created a record would need asymmetric signatures (Ed25519) with the private key
  in a separate signing service/HSM, plus authenticated users.
- **Full chain of custody.** The log records detection events by the system. It does not
  record acquisition source, human custodians, access, export or transfer. (Future work:
  custody event types with an authenticated actor and purpose — see ISO/IEC 27037.)

## Assets and trust boundaries
| Component | Where it lives | Trusted? |
|---|---|---|
| SQLite ledger, anchor file, evidence files | data folder (`VOXTRACE_HOME`) | No — assume an attacker may write here |
| Signing key (32 bytes) | outside the data folder (enforced), or env var; refused if readable by others or owned by another user | Yes |
| SIEM event log (signed heads) | written locally, meant to be shipped off the host by the Wazuh agent | **Assumed** — shipping not yet tested; the local copy is NOT trusted |
| System clock | host | **Not** trusted for evidentiary time (see limitations) |

## Security-property matrix
Attacker capability: **DB** = can write the SQLite file · **FS** = can write anything in the data folder · **KEY** = holds the signing key · **EXT** = the verifier checks against the off-box SIEM head (in the tests this is *simulated* with a separate folder).

Outcome: **Detected** = verify() reports it · **Prevented** = the write or start-up is refused · **Not detected** = the attack succeeds.

| # | Attack | Capability | Outcome | Mechanism | Test |
|---|---|---|---|---|---|
| 1 | Edit a field (verdict, score) | DB | Detected | record hash | `test_db_edit_field` |
| 2 | Backdate a timestamp | DB | Detected | record hash | `test_db_edit_timestamp_only` |
| 3 | Delete a middle record | DB | Detected | sequence + chain | `test_db_delete_middle` |
| 4 | Delete newest record(s) | DB | Detected | signed anchor | `test_db_delete_newest` |
| 5 | Delete every record | DB | Detected | signed anchor | `test_db_delete_all` |
| 6 | Insert a forged record | DB | Detected | hash + signature | `test_db_insert_forged_record` |
| 7 | Reorder records | DB | Detected | sequence in hash | `test_db_reorder_records` |
| 8 | Edit, then recompute the whole chain | DB | Detected | HMAC signature | `test_db_edit_then_recompute_chain_without_key` |
| 9 | Swap evidence file and update stored hash | DB+FS | Detected | record hash | `test_db_swap_evidence_and_update_stored_hash` |
| 10 | Modify / delete an evidence file (audio or video) | FS | Detected | per-file SHA-256 | `test_evidence_file_modified`, `test_video_tamper_…`, `test_missing_video_…` |
| 11 | Swap evidence while the model is scoring it | FS | Prevented | hash on receipt + re-hash | `test_evidence_swapped_during_analysis_refused` |
| 12 | Delete / forge / corrupt the anchor | FS | Detected | anchor signature | `test_fs_delete_anchor`, `test_fs_forge_anchor`, `test_fs_corrupt_anchor_reported` |
| 13 | Truncate, then let a normal insert "heal" it | FS | Prevented | pre-append anchor check | `test_fs_truncate_then_legit_insert_refused` |
| 14 | Restore an old DB + anchor backup (rollback) | FS | Not detected alone · Detected with EXT (simulated) | external signed head | `test_limit_fs_rollback_…`, `test_fs_rollback_…_external_head` |
| 15 | Wipe DB + anchor completely | FS | Not detected alone · Detected with EXT (simulated) | external signed head | `test_fs_wipe_…_external_head` |
| 16 | Key placed in the data folder (directly, in a subfolder, or via a symlink), or readable by others | FS | Prevented | key checks | `test_preplanted_world_readable_key_refused`, `test_colocated_key_refused`, `test_key_in_data_subfolder_refused`, `test_fs_symlinked_key_…` |
| 17 | Forged lines in the shipped log | FS | Prevented (forged lines ignored) | head signature | `test_external_log_ignores_forged_lines` |
| 18 | Rewrite history with the key | KEY | Not detected alone · Detected with EXT (simulated), only for heads shipped before the key leaked | — / external head | `test_limit_key_holder_can_forge` |
| 19 | Malformed values in the DB | DB | Detected (reported, no crash) | per-record checks | `test_db_garbage_values_reported_not_raised` |
| 20 | Substitute own key and re-sign the whole history | FS (key folder) | Not detected alone · Detected with recorded key fingerprint | `expected_key_fp` / `VOXTRACE_KEY_FP` | `test_fs_substituted_key_caught_by_fingerprint` |
| 21 | Drop, rename or replace the table with a filtering view | DB | Detected (reported, no crash) | schema check + anchor | `test_db_table_dropped_…`, `test_db_table_replaced_by_view` |
| 22 | Add an unsigned column carrying misleading data | DB | Detected | schema check | `test_db_extra_unsigned_column_reported` |
| 23 | Add a trigger that silently blocks or alters new records | DB | Detected | schema check (+ record hash if it alters) | `test_db_blocking_trigger_reported` |

Operational properties (not attacks): crash between commit and anchor write does not raise
a false alarm (the anchor may lag; it can never be ahead, and anchor writes are serialised
by the DB lock so it never moves backwards); 40 threads on one connection and 4 processes on one DB produce a valid
chain; checking the log while other processes write gives no false alarms; 8 processes
opening a brand-new ledger together all succeed; numpy/int scores round-trip; NaN/inf/bool
scores are rejected; databases from the old unsigned schema are refused with a clear
message; an exported copy keeps every record and can be verified read-only by an examiner.

## Limitations (state these in the paper)
1. **Rollback, wipe and key compromise are only detected with the off-box head (EXT),
   and that defence is unproven end to end.** The code writes the signed heads
   (`voxtrace-events.jsonl`) and can verify against them, but shipping to a live Wazuh
   has **not been tested**; in the tests the off-box copy is a separate local folder.
   Before submission, either run that live test or present rows 14, 15 and 18 as
   simulated.
2. **Key holder can forge** (row 18). There's no non-repudiation; see "What to call it".
   The off-box head only protects heads that were shipped *before* the key leaked: a key
   holder can append a validly signed fake head to the local log before it ships.
3. **A substituted key is only caught if its fingerprint is checked.** An attacker who can
   write the key folder (outside the data folder) as the service user can swap the key and
   re-sign history (row 20). Record the fingerprint printed at start-up somewhere
   independent and set `VOXTRACE_KEY_FP`, so `/verify` compares it.
4. **`actor` is free text, not an authenticated identity.** The API does not set it per user.
5. **The API's `/verify` reads the LOCAL copy of the event log** as its external head,
   which an FS attacker can truncate. It demonstrates the mechanism; real verification
   must use the SIEM server's copy.
6. **Timestamps come from the host clock.** For evidentiary time, anchor heads with an
   RFC 3161 timestamping authority (future work).
7. **Integrity starts at receipt.** The hash proves the file hasn't changed since VoxTrace
   received it, not that it is the original recording. Acquisition metadata (source,
   caller ID, device, who submitted it) is not recorded.
8. **Verification uses absolute paths on the same host.** There is no export bundle for
   handing evidence + ledger to an examiner on another machine.
9. **The tests are written by the system's authors.** Present them as a security-property
   test matrix, not as an independent evaluation. Review history: two rounds by separate
   reviewers (attacker, correctness, forensics) on 24 Oct; a third adversarial round
   (rows 20–23) was run by the same author who wrote the fixes, so it is not independent. A
   human security reviewer outside the team should still attack it before submission.

## Standards to cite
ISO/IEC 27037 (identification, collection, acquisition, preservation of digital evidence),
NIST SP 800-86 (Guide to Integrating Forensic Techniques into Incident Response), RFC 3161
(trusted timestamps). For Indian courts: the electronic-record certificate under s.63 of the
Bharatiya Sakshya Adhiniyam, 2023 (replaced Indian Evidence Act s.65B, in force 1 July 2024).
Word it as "the log's hashes can support a s.63 certificate", not that VoxTrace satisfies
s.63, and check the Schedule form's hash fields before citing specifics.

## Naming in the paper
The code keeps the names `custody.py` / `CustodyLedger`; in the paper's text and figures
call the component the *evidence-integrity log*.

## Setup
    python -m voxtrace.custody genkey ~/.voxtrace/ledger.key      # once, outside the data folder
    VOXTRACE_HOME=./vt-data VOXTRACE_KEY_FILE=~/.voxtrace/ledger.key uvicorn voxtrace.api:app
Back up the key separately. Losing it makes every record unverifiable; leaking it allows forgery.

**Keep the data folder on a local disk** (not OneDrive/Dropbox/Google Drive or a network
share): SQLite's WAL mode does not work there and syncing its side files can corrupt the DB.

**Backup / hand-over:** never copy `incidents.db` by hand while VoxTrace is running (recent
records may still be in `incidents.db-wal`). Use:

    ledger.export("/path/handover/incidents.db")        # writes incidents.db + incidents.db.head
    CustodyLedger("/path/handover/incidents.db", key_path=..., read_only=True).verify()

**Starting a fresh ledger:** move `incidents.db*` *and* `incidents.db.head` aside together.
