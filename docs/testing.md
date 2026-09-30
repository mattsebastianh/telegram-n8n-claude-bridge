# Testing

## 1. Bridge
Start it with `cd bridge/claude-session && npm start`, then, using your real `BRIDGE_API_KEY`:

```bash
curl -s http://127.0.0.1:3000/status -H "Authorization: Bearer $BRIDGE_API_KEY"
# {"status":"Online","processPid":...}

curl -s -X POST http://127.0.0.1:3000/execute \
  -H "Authorization: Bearer $BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "say hello"}'
# {"output":"..."}
```

Also check that a wrong key returns `401`, a missing `command` returns `400`, and `POST /reset` restarts the session.

From a container, `docker run --rm --add-host host.docker.internal:host-gateway curlimages/curl -s http://host.docker.internal:3000/status -H "Authorization: Bearer $BRIDGE_API_KEY"` should return the status JSON.

## 2. n8n workflow
1. Open the workflow and click **Execute Workflow** (or activate it).
2. Send a message to the bot from an allowed chat.
3. Confirm the execution passes the **Verify Allowlist** true branch and reaches **Send Response**.

## 3. End to end
1. Send a short prompt from the allowed chat. Expect Claude's reply in Telegram.
2. Send a long-running prompt. The bridge returns partial output with a timeout note after 2 minutes.
3. From another Telegram account, message the bot. Expect no reply.
4. Stop the bridge and send a message. The Send to Claude node fails (see [troubleshooting.md](troubleshooting.md)).
