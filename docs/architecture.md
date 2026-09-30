# System Architecture

## Overview
This document describes the architecture of the Telegram ↔ n8n ↔ Claude Code system.

### Components
1. **Telegram Bot**: User interface for sending commands and receiving outputs.
2. **Cloudflare Tunnel (`cloudflared`, optional)**: Publishes n8n's webhook on a public HTTPS hostname so Telegram can deliver updates without opening router ports.
3. **n8n (Dockerized Orchestrator)**: Validates the sender against the allowlist, calls the bridge, and sends the reply.
4. **Local Bridge (Node.js API)**: Exposes a REST API to n8n, managing the underlying `claude` CLI via pseudo-terminal (`pty`).

### System Diagram
![Architecture diagram](architecture.svg)

### Network Flow
```mermaid
sequenceDiagram
    participant User as Telegram Client
    participant TG as Telegram Bot API
    participant CF as Cloudflare Tunnel
    participant n8n as n8n Container
    participant Bridge as Bridge API (Host, 127.0.0.1:3000)
    participant Claude as Claude CLI (PTY)

    User->>TG: Send message
    TG->>CF: HTTPS webhook update (WEBHOOK_URL)
    CF->>n8n: Forward to n8n:5678 (Telegram Trigger)
    n8n->>n8n: Verify Allowlist (chat.id and from.id in TELEGRAM_ALLOWED_USER_IDS)
    alt sender not allowed
        n8n--xTG: Drop silently (no reply)
    else sender allowed
        n8n->>Bridge: POST /execute { command } + Bearer BRIDGE_API_KEY
        Bridge->>Bridge: Check source IP is localhost and API key
        Bridge->>Bridge: Queue command (one at a time)
        Bridge->>Claude: Write command + Enter to PTY
        Claude-->>Bridge: stdout (ANSI stripped) until prompt ❯
        alt Claude not ready
            Bridge-->>n8n: 503 Claude session is not ready
        else prompt seen, or "Not logged in"
            Bridge-->>n8n: 200 { output }
        else no prompt within 2 minutes
            Bridge-->>n8n: 200 { output (partial), note: timeout }
        end
        n8n->>TG: Send Response (sendMessage to chat.id)
        TG-->>User: Claude output
    end
```

## Component Details

### n8n Orchestrator
Running in Docker with the official `n8nio/n8n` image, published on host port `5680` (`N8N_HOST_PORT` in `.env`).
It reaches the bridge API running natively on the Mac through `host.docker.internal`. It receives only `BRIDGE_API_KEY` and `TELEGRAM_ALLOWED_USER_IDS` from `.env`.

### Cloudflare Tunnel
An optional `cloudflared` container (`docker-compose --profile tunnel`) connects out to Cloudflare and forwards the public hostname in `WEBHOOK_URL` to `http://n8n:5678`. Replies go straight from n8n to the Telegram Bot API and do not use the tunnel. The bridge is never exposed through it.

### Bridge API (`/bridge/claude-session`)
A lightweight Express server built with Node.js.
Uses `node-pty` to spawn `claude` in an interactive shell.
Features:
- Runs `claude` as the PTY process itself (through a login shell for `PATH`) and restarts it if it exits.
- Strips ANSI codes to clean up output.
- Detects Claude's `❯` prompt (or a "Not logged in" message) to determine when Claude has finished execution; falls back to partial output after a 2-minute timeout.
- Runs one command at a time and returns collected output to HTTP requests; returns 503 while Claude is not ready.
- `POST /reset` restarts the session, and `GET /status` reports its state.
- Rejects non-localhost callers and requests without the `Bearer BRIDGE_API_KEY` header.
