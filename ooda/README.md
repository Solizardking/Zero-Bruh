# OODA

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=18&duration=1700&pause=350&color=FFD166&center=true&vCenter=true&width=900&lines=observe+%E2%86%92+orient+%E2%86%92+decide+%E2%86%92+act;market+loop+state+and+TUI+for+agent+control" alt="OODA animated header" />
</p>

`ooda/` is the **Zero Clawd** observe → orient → decide → act harness: agent pulse checks, journals, and optional TUI. **Paper-trading and devnet only** — no real funds, no mainnet connections.

Product: [cheshireterminal.ai/zeroclawd](https://cheshireterminal.ai/zeroclawd) · runtime repo: [Solizardking/Zero-Bruh](https://github.com/Solizardking/Zero-Bruh)

## Quickstart

```bash
cd ooda
npm install

npm run loop -- --ticks 50 --sleep 0.25          # deterministic, no TUI
npm run loop -- --ticks 200 --sleep 0.4 --tui | npm run tui
npm run loop -- --goblin --ticks 100 --llm       # aggressive paper/devnet mode

# Manual flags
npx tsx ooda/loop.ts --ticks 100 --sleep 0.25 --llm
npx tsx ooda/loop.ts --ticks 200 --sleep 0.4 --tui | npx tsx ooda/tui.ts

# Goblin mode (aggressive, 0ms sleep, always uses LLM)
npx tsx ooda/loop.ts --goblin --ticks 100 --llm
```

From the repository root, the Go CLI can launch the same harness:

```bash
npm --prefix ooda ci
clawdbot ooda harness --ticks 50 --sleep 0
clawdbot ooda harness --ticks 200 --sleep 0.4 --tui
clawdbot ooda harness --plan
clawdbot ooda journal --tail 20
```

## Architecture

```text
ooda/
├── loop.ts          ← main harness (CLI entry point)
├── observe.ts       ← market data adapters (synth + Helius/Pyth stub)
├── state.ts         ← position book, PnL accounting, type definitions
├── validate.ts      ← safety validator (enforces CLAWD.md rules)
├── clawd-decision.ts← AI decision function (multi-provider LLM chain)
├── journal.ts       ← append-only tick journal writer/reader
├── tui.ts           ← ANSI TUI dashboard (reads JSONL from loop.ts --tui)
├── CLAWD.md         ← per-tick system prompt + config frontmatter
├── goblin.md        ← GOBLIN MODE variant config
└── journal/
    └── ticks.jsonl  ← append-only operational state
```

## File Reference

### `loop.ts` — Main Harness

The orchestrator. Runs the OODA cycle for N ticks:

1. **Observe** — calls `SynthObserver.tick()` (or Helius/Pyth when wired), optionally fetches a perps OI signal from `../perps/clawd-agents-perps/`
2. **Orient/Decide** — calls `clawdDecision()` (LLM) or `deterministicDecision()` (SMA crossover) or `signalToDecision()` (perps OI)
3. **Validate** — passes raw decision through `validate()` before applying
4. **Act** — `openPosition` / `closePosition` / hold
5. **Journal** — appends every tick to `journal/ticks.jsonl`

**CLI flags:**

| Flag | Default | Description |
| --- | --- | --- |
| `--ticks N` | 50 | Number of ticks to run |
| `--sleep N` | 0.25 | Seconds between ticks |
| `--seed N` | 42 | PRNG seed for synth candles |
| `--llm` | false | Use LLM for decisions |
| `--tui` | false | Emit JSONL for TUI renderer |
| `--goblin` | false | Enable GOBLIN MODE |
| `--perps-oi` | false | Fetch live OI signal from perps module |
| `--perps-symbol` | SOL-PERP | Symbol for perps OI fetch |
| `--perps-oi-mock` | false | Use mock data for OI signal |
| `--commit-every N` | 0 | Git-commit journal every N ticks |

**Kill-switch:** exits with code `1` after `loss_killswitch_consecutive` consecutive losing trades. Configurable in `CLAWD.md` frontmatter.

---

### `observe.ts` — Market Data

- **`SynthObserver`** — seeded deterministic candle generator using `mulberry32` PRNG. Produces OHLCV candles with a slight upward drift. Used by default.
- **`observeFromHelius()`** — stub for a real Pyth/Helius RPC adapter. Falls back to synth until wired.
- **`rejectMainnet(rpcUrl)`** — hard guard; throws on any mainnet RPC URL (bypassed only with `MAINNET_OK=1`).
- **`isStale(candles)`** — staleness check; returns `true` if the last candle is older than `maxAgeSeconds`.

To plug in real data, replace `SynthObserver` usage in `loop.ts` with a call to `observeFromHelius()` once the Pyth account decode is implemented.

---

### `state.ts` — Position Book

In-memory state for one loop run. Reconstructed from `journal/ticks.jsonl` on restart.

**Types:** `Side`, `Position`, `Book`, `Candle`, `State`

**Functions:**

- `createState(startingCash)` — initialize with 10 SOL-equivalent cash
- `openPosition(state, side, size_lamports, currentPrice)` — deducts cash, appends to book
- `closePosition(state, positionId, currentPrice)` — computes PnL (long: profit on price rise; short: profit on price fall), updates `consecutive_losses` / `total_pnl_lamports`
- `unrealisedPnl(state, currentPrice)` — sum of unrealised PnL across open positions

---

### `validate.ts` — Decision Validator

Called on every raw LLM or deterministic output before any state mutation. Invalid decisions are logged as `"rejected"` and the tick proceeds as a `hold`.

**Enforces:**

- `action` must be `hold | open | close`
- `reason` required, max 140 chars
- Prompt-injection guard: rejects reasons containing `private_key`, `seed phrase`, `mnemonic`, etc.
- `open.side` must be `long | short`
- `open.size_lamports` must be a positive integer ≤ `max_position_size_lamports`
- v0: one position at a time (rejects `open` when a position is already open)
- `close.position_id` must exist in the book

**`parseClawdConfig(markdownContent)`** — extracts the YAML frontmatter from `CLAWD.md` / `goblin.md` and validates that `mode=paper` and `network=devnet`.

---

### `clawd-decision.ts` — AI Decision

Assembles the per-tick prompt from `CLAWD.md` + live observations and calls an LLM. Returns one parsed JSON decision.

**Provider priority (uses first key found):**

1. `XAI_API_KEY` → `grok-4.3-fast` (or `XAI_MODEL`)
2. `DEEPSEEK_API_KEY` → `deepseek-v4-flash` (via `DEEPSEEK_BASE_URL`)
3. `ZKROUTER_API_KEY` (or `OPENROUTER_API_KEY`) → `nex-agi/nex-n2-pro:free` via `ZKROUTER_BASE_URL`
4. `ANTHROPIC_API_KEY` → `claude-haiku-4-5-20251001` (or `ANTHROPIC_MODEL`)
5. **Fallback** → `deterministicDecision()` (no key needed)

**`deterministicDecision(obs)`** — 5-candle SMA crossover: opens long when price < SMA × 0.995, opens short when price > SMA × 1.005, closes on reversal. No API key required.

The prompt is assembled fresh each tick — stateless, no conversation history.

### `package.json` — local harness metadata

The `ooda/` directory now carries its own `package.json` so the harness is reproducible as an open-source subproject. It declares the actual runtime dependencies used here:

- `openai` for the OpenAI-compatible router slot
- `execa` for optional journal commits
- `chalk` for the ANSI TUI
- `tsx` and `typescript` for local execution and linting

---

### `journal.ts` — Tick Journal

Append-only JSONL log at `journal/ticks.jsonl`. Every tick (including rejected and killswitch ticks) is written as one JSON line.

**`TickEntry` fields:** `tick`, `now`, `candles_last3`, `book_snapshot`, `decision`, `outcome` (`applied | rejected | killswitch`), `violation?`, `pnl_lamports?`, `total_pnl_lamports?`, `consecutive_losses?`, `event?`

**Functions:**

- `appendTick(entry)` — creates `journal/` dir if needed, appends one JSON line
- `readLastEntries(n)` — returns last N entries (injected into the next tick's observations)
- `clearJournal()` — marks empty for a fresh run (non-destructive)
- `journalPath()` — returns the absolute path for display

The journal is the harness's memory. On restart, replay it to reconstruct state.

> Review `ooda/journal/` before committing if you run long live sessions.

---

### `tui.ts` — ANSI Dashboard

Reads JSONL from `loop.ts --tui` on stdin and renders a live dark-themed dashboard with chalk.

**Features:**

- Full-width box-drawing border (magenta)
- Tick progress bar
- SOL price with unicode sparkline (`▁▂▃▄▅▆▇█`) coloured green/red per move
- Last decision + outcome
- PnL / cash / open positions / consecutive losses stats row
- Rolling 6-line action log with timestamps
- Kill-switch and done banners

**Pipe usage:**

```bash
npx tsx ooda/loop.ts --ticks 200 --sleep 0.4 --tui | npx tsx ooda/tui.ts
```

---

### `CLAWD.md` — Per-Tick Prompt

Config frontmatter + system prompt loaded by `loop.ts` each run (and by `clawd-decision.ts` each tick).

**Frontmatter keys:**

```yaml
mode: paper                        # must be "paper"
network: devnet                    # must be "devnet"
max_action_per_tick: 1
max_position_size_lamports: 1000000
loss_killswitch_consecutive: 3
```

The body is the LLM's instruction set: what decisions it can return, the hard rules it must follow, and the strategy guidelines (SMA, mean reversion, OI delta, quick loss cuts).

---

### `goblin.md` — GOBLIN MODE

```yaml
mode: paper
network: devnet
max_position_size_lamports: 5000000   # 5× normal
loss_killswitch_consecutive: 5
goblin: true
dark_defi_armed: true
tick_sleep_ms: 0
model: grok-4.3-fast
```

Activated with `--goblin`. Loads `goblin.md` instead of `CLAWD.md`, forces `--llm`, sets sleep to 0ms, and defaults to 100 ticks. Same safety contract (paper + devnet), but maximally aggressive strategy:

- Aggressive mean reversion on 3-tick windows
- Momentum continuation on 2+ same-direction ticks
- Take profit at +1%, cut loss at -0.5%
- Follows OI expansion with price, fades OI expansion against price

---

## Safety Contract

All enforced in code — not just prompt guidance:

- `mode: paper` and `network: devnet` are validated at startup; any other value throws
- Mainnet RPC URLs are rejected before any network call
- No private key handling exists anywhere in this module
- Position size is hard-capped per tick
- One position at a time (v0)
- Kill-switch halts the process on consecutive losses
- Every decision (including rejected ones) is journalled

## Environment Variables

| Variable | Used by | Description |
| --- | --- | --- |
| `XAI_API_KEY` | clawd-decision | Grok API key (priority 1) |
| `XAI_MODEL` | clawd-decision | Override Grok model |
| `DEEPSEEK_API_KEY` | clawd-decision | DeepSeek key (priority 2) |
| `DEEPSEEK_BASE_URL` | clawd-decision | DeepSeek base URL |
| `ZKROUTER_API_KEY` | clawd-decision | Preferred Clawd router key on the public zk.x402.wtf stack (priority 3) |
| `ZKROUTER_BASE_URL` | clawd-decision | Override the default router base (`https://clawdrouter-zk.fly.dev/v1`) |
| `OPENROUTER_API_KEY` | clawd-decision | Compatibility fallback for the same OpenAI-format router slot |
| `OPENROUTER_MODEL` | clawd-decision | Override the router model |
| `ANTHROPIC_API_KEY` | clawd-decision | Claude key (priority 4) |
| `ANTHROPIC_MODEL` | clawd-decision | Override Claude model |
| `SOLANA_RPC_URL` | loop | RPC URL (mainnet URLs rejected) |
| `MAINNET_OK` | observe | Set to `1` to bypass mainnet guard |
