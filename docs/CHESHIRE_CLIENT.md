# Cheshire Terminal client ↔ clawdbot-go

This runtime ([**clawdbot-go**](https://www.npmjs.com/package/clawdbot-go)) is the local agent.  
The **Cheshire Terminal** SPA under `cheshire-terminal/client` is the hosted install + connect UI.

## Package

| Item | Value |
|------|--------|
| npm | https://www.npmjs.com/package/clawdbot-go |
| Default console | `http://127.0.0.1:18800` |
| CORS for production SPA | `export CLAWDBOT_CORS_ORIGINS=https://cheshireterminal.ai` |

## SPA tree that talks to this agent

```
cheshire-terminal/client/
  src/App.tsx                         routes /zeroclawd · /clawdbot-go · /clawdbot · /zero-clawd
  src/pages/ClawdbotGoPage.tsx        install one-shots, Connect, health/status/DNA, chat
  src/lib/zeroClawd.ts                normalize base URL, probe mode, allowlist, chat builders
  src/lib/zeroClawd.test.ts           fixtures matching web/backend responses
  src/pages/CheshireComputerPage.tsx  E2B desk → installs clawdbot-go for CLAWD holders
  src/components/                     shared nav, badges, layout
  src/hooks/ · src/contexts/          wallet / auth shell around the hub
  src/main.tsx · index.css            SPA bootstrap
```

## Request paths

| From SPA | To | When |
|----------|-----|------|
| `fetch(http://127.0.0.1:18800/api/health)` etc. | This process (`web/backend`) | Loopback / LAN agent (browser-direct) |
| `POST /api/zeroclawd/probe` | Cheshire Fly API → your public agent | Non-loopback agent base URL |
| `POST /api/zeroclawd/chat` | Cheshire Fly API → agent chat | Hosted chat bridge |
| `GET /api/zeroclawd/npm` | `registry.npmjs.org/clawdbot-go/latest` | Live package card on `/zeroclawd` |

Allowlisted agent paths (browser / probe): see `ZERO_CLAWD_AGENT_ALLOWLIST` in `client/src/lib/zeroClawd.ts`.

## Minimal connect loop

```bash
npm install -g clawdbot-go
export CLAWDBOT_CORS_ORIGINS=https://cheshireterminal.ai
clawdbot web   # or: go run ./web/backend -port 18800
# open https://cheshireterminal.ai/zeroclawd → Connect → http://127.0.0.1:18800
```

## Related product install

```bash
# Computer desk also installs this package
curl -fsSL https://cheshireterminal.ai/api/e2b/install.sh | bash
```
