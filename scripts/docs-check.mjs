/**
 * End-to-end docs + installer surface checks for Zero Clawd.
 * Verifies README paths, script contracts, pkg map completeness, SOL GPT catalog.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("installer scripts are bash-valid", () => {
  for (const script of ["start.sh", "install.sh", "install-npm.sh"]) {
    execFileSync("bash", ["-n", join(root, script)], { stdio: "pipe" });
  }
});

test("start.sh defaults CORS for Cheshire Connect", () => {
  const src = read("start.sh");
  assert.match(src, /CLAWDBOT_CORS_ORIGINS/);
  assert.match(src, /cheshireterminal\.ai/);
  assert.match(src, /scripts\/launch\.mjs/);
  assert.ok(existsSync(join(root, "scripts/launch.mjs")));
});

test("install.sh prefers local checkout when present", () => {
  const src = read("install.sh");
  assert.match(src, /LOCAL_SOURCE_DIR/);
  assert.match(src, /Using local source checkout/);
  assert.match(src, /CLAWDBOT_FORCE_REMOTE_SOURCE/);
  assert.match(src, /Connect from Cheshire Terminal/);
});

test("install-npm.sh chains local install.sh from checkout", () => {
  const src = read("install-npm.sh");
  assert.match(src, /\$\{SCRIPT_DIR\}\/install\.sh/);
  assert.match(src, /local install\.sh/);
  assert.match(src, /CLAWDBOT_CORS_ORIGINS=https:\/\/cheshireterminal\.ai/);
});

test("README Start here table covers scripts + docs", () => {
  const readme = read("README.md");
  assert.match(readme, /## Start here \(3 minutes\)/);
  assert.match(readme, /install-npm\.sh/);
  assert.match(readme, /install\.sh/);
  assert.match(readme, /start\.sh/);
  assert.match(readme, /docs\/PKG_MAP\.md/);
  assert.match(readme, /docs\/SOL_GPT_TOOLS\.md/);
  assert.match(readme, /docs\/CHESHIRE_CLIENT\.md/);
  assert.match(readme, /CLAWDBOT_CORS_ORIGINS=https:\/\/cheshireterminal\.ai/);
  assert.match(readme, /127\.0\.0\.1:18800/);
});

test(".env.example exists with CORS + trading keys", () => {
  const env = read(".env.example");
  assert.match(env, /CLAWDBOT_CORS_ORIGINS/);
  assert.match(env, /MOONSHOT_API_KEY/);
  assert.match(env, /HELIUS_API_KEY/);
  assert.match(env, /DFLOW_API_KEY/);
  assert.match(env, /BLOCKSCOUT_API_KEY/);
});

test("PKG_MAP documents every pkg/* directory", () => {
  const map = read("docs/PKG_MAP.md");
  const dirs = readdirSync(join(root, "pkg"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  assert.equal(dirs.length, 53, `expected 53 packages, got ${dirs.length}`);
  for (const name of dirs) {
    assert.match(map, new RegExp(`\\*\\*${name}\\*\\*|\\b${name}/`), `PKG_MAP missing ${name}`);
  }
});

test("SOL_GPT_TOOLS catalog is 72 tools with 37 core", () => {
  const doc = read("docs/SOL_GPT_TOOLS.md");
  assert.match(doc, /"shipped":72/);
  assert.match(doc, /"core":37/);
  assert.match(doc, /"phoenix":16/);
  // Spot-check representative tools from each group
  for (const tool of [
    "list_phoenix_markets",
    "get_price",
    "get_chart",
    "get_net_worth",
    "get_wallet_identity",
    "prepare_user_swap",
    "search_prediction_markets",
    "browse_web",
    "search_solana_agents",
    "search_tools",
  ]) {
    assert.match(doc, new RegExp(`\`${tool}\``), `missing tool ${tool}`);
  }
  assert.match(doc, /live_orders-none/);
  // Mentioned only as excluded — never as a catalog table row.
  assert.match(doc, /Not in catalog:[\s\S]*`execute_swap`/);
  assert.doesNotMatch(doc, /\|\s*`execute_swap`\s*\|/);
});

test("CHESHIRE_CLIENT has create-agent + connect loop", () => {
  const doc = read("docs/CHESHIRE_CLIENT.md");
  assert.match(doc, /# Cheshire Terminal client ↔ clawdbot-go/);
  assert.match(doc, /create-agent/);
  assert.match(doc, /CLAWDBOT_CORS_ORIGINS=https:\/\/cheshireterminal\.ai/);
  assert.match(doc, /\.\/start\.sh/);
});
