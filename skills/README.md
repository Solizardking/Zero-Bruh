# Robinhood Crypto Agent Open Stack

Open-source skill pack for **anyone** building Robinhood Chain / EVM trading and launch agents with Zero Clawd (`go-bot` / `clawdbot`).

This pack is redistributable with the go-bot tree. No private monorepo paths required.

**Also redistributed** (skills only, not the Go binary) into the npm package
`cheshire-terminal-agents` as `skills/rh-crypto-agent/`. From ClawdBrowser:

```bash
node scripts/sync-go-bot-rh-skills-to-robinhood-agents.mjs
node --experimental-strip-types --test scripts/go-bot-rh-integration-unit.test.ts
```

## Skills (see `pack-index.json` for authoritative list)

Core open stack includes RH launch (`rh-bonded-launch`, `rh-launchpad-v3`), Uniswap
swap/LP/v4 skills, strategy bots (`copy-trade`, `dca-bot`, `index-bot`), payments,
`viem-integration`, plus Cheshire agent-registry skills (`cheshire-agent-*`,
`cheshire-zk-omni`).

## Point clawdbot at this pack

From the go-bot checkout:

```bash
export CLAWDBOT_SKILLS_DIR="$(pwd)/skills"
clawdbot catalog skills
# or
go run ./cmd/clawdbot catalog skills --skills-dir ./skills
```

When `CLAWDBOT_SKILLS_DIR` is unset, go-bot prefers this bundled `./skills` directory if present (walked from the current working directory), then falls back to `~/skills/skills`.

Solana-first catalogs remain usable: set `CLAWDBOT_SKILLS_DIR` to your Solana skill library; the bundled RH/EVM pack is still merged into `catalog` reports when discovered.

## Robinhood use cases

- Permissionless bonded token launch (`rh-bonded-launch`) and V3 graduation (`rh-launchpad-v3`)
- Swaps / LP / Uniswap v4 hooks via the Uniswap-oriented skills
- DCA, index baskets, and copy-trade strategy skills
- EVM reads/writes with `viem-integration`

## License

Same as the parent repository (MIT) unless individual skill files note otherwise.
