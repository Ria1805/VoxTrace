# VoxTrace Wazuh integration

This guide connects the VoxTrace JSON Lines event file to a Wazuh single-node manager. The tested smoke test used Wazuh 4.14.9 and synthetic events. It verifies file collection and alert-rule routing; it does not test media-detection accuracy, real incidents, actual tampering, or an independently retained off-host ledger head.

## Requirements

- A VoxTrace checkout and a running VoxTrace API configured with `VOXTRACE_HOME`.
- Docker Desktop and the official Wazuh Docker single-node deployment.
- The VoxTrace event file at `$VOXTRACE_HOME/voxtrace-events.jsonl`.

Use the same `VOXTRACE_HOME` for the API and the host-side Wazuh bind mount. In the terminal where you run Docker Compose, set it and point `VOXTRACE_REPO` at this checkout; create the host event file if this is a fresh setup:

```bash
export VOXTRACE_HOME="$HOME/voxtrace-data"
export VOXTRACE_REPO="/path/to/VoxTrace"
mkdir -p "$VOXTRACE_HOME"
touch "$VOXTRACE_HOME/voxtrace-events.jsonl"
```

Start the API with the same `VOXTRACE_HOME` and the key settings documented in the project README. Keep the ledger key outside the data directory. Do not commit the key, certificates, local event file, or a machine-specific path.

## Configure file collection

In the Wazuh Docker repository's `single-node/docker-compose.yml`, add this volume under the `wazuh.manager` service:

```yaml
      - "${VOXTRACE_HOME:?Set VOXTRACE_HOME}/voxtrace-events.jsonl:/var/log/voxtrace-events.jsonl:ro"
```

In `single-node/config/wazuh_cluster/wazuh_manager.conf`, add this inside `<ossec_config>` and before its closing tag:

```xml
  <localfile>
    <location>/var/log/voxtrace-events.jsonl</location>
    <log_format>json</log_format>
  </localfile>
```

From the Wazuh `single-node` directory, recreate the manager so it applies the mount and configuration:

```bash
docker compose up -d --force-recreate wazuh.manager
```

Copy the VoxTrace rules into the manager and restart it to load them. Set `VOXTRACE_REPO` to the path of this checkout first:

```bash
docker cp "$VOXTRACE_REPO/siem/voxtrace_wazuh_rules.xml" "$(docker compose ps -q wazuh.manager):/var/ossec/etc/rules/voxtrace_rules.xml"
docker compose restart wazuh.manager
```

Confirm the source file is mounted and Wazuh is monitoring it:

```bash
docker compose exec wazuh.manager ls -l /var/log/voxtrace-events.jsonl
docker compose exec wazuh.manager grep -i 'voxtrace-events.jsonl' /var/ossec/logs/ossec.log
```

The manager log should report that it is analyzing `/var/log/voxtrace-events.jsonl`.

## Test the rules

First test parsing and rule matching without adding lines to the live event file:

```bash
docker compose exec wazuh.manager /var/ossec/bin/wazuh-logtest
```

Paste one JSON line from `synthetic_test_events.jsonl` at a time. The expected matches are rule `100502` at Wazuh level 10 and rule `100503` at level 12.

To test live file collection and alert generation, append the explicitly synthetic fixtures to the host event file:

```bash
cat "$VOXTRACE_REPO/siem/synthetic_test_events.jsonl" >> "$VOXTRACE_HOME/voxtrace-events.jsonl"
```

These test lines remain in the local JSONL file and create test alerts. Wait several seconds, then inspect the manager's alerts:

```bash
docker compose exec wazuh.manager grep -E '"id":"100502"|"id":"100503"' /var/ossec/logs/alerts/alerts.json | tail -n 2
```

Expected alert records include `location` `/var/log/voxtrace-events.jsonl`. In Wazuh's severity overview, level 10 is grouped as Medium and level 12 as High. This Wazuh level is separate from the event's VoxTrace `severity` field.

## Test-event limitations

The fixtures contain `"test": true` and deliberately use dummy values. The incident fixture does not come from `/analyze`, and the verification fixture does not indicate real ledger tampering. These tests demonstrate event collection and rule matching only. A healthy `chain_intact: true` verification event should not trigger rule `100503`. The Wazuh 4.14.9 smoke test warned that its bundled MITRE database did not contain `T1566.004` and `T1656`; the rules still matched, but MITRE enrichment was not established. The local Docker test also does not establish off-host rollback, wipe, or key-compromise detection; that requires a separately administered trusted head.
