#!/usr/bin/env node
/**
 * Soft postinstall — never fails `npm install`.
 * When CLAWDBOT_ONESHOT=1 or CI is unset, remind operators to run oneshot.
 * Full install is intentional (user opt-in) so global installs stay fast.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pack = join(root, "skills", "pack-index.json");

if (process.env.CLAWDBOT_ONESHOT === "1" || process.env.npm_config_oneshot === "true") {
  try {
    const { runOneshot } = await import("./oneshot-install.mjs");
    runOneshot({
      skipGo: process.env.CLAWDBOT_SKIP_GO === "1",
      skipBirth: process.env.CLAWDBOT_SKIP_BIRTH === "1",
      skipAutomaton: process.env.CLAWDBOT_SKIP_AUTOMATON === "1",
    });
  } catch (err) {
    console.warn("[clawdbot-go] oneshot postinstall failed:", err?.message || err);
  }
  process.exit(0);
}

// Quiet hint only
if (existsSync(pack) && process.env.npm_config_loglevel !== "silent") {
  console.log("");
  console.log("  🦞 clawdbot-go installed.");
  console.log("  One-shot stack:  npx clawdbot-go install");
  console.log("  Or curl:         curl -fsSL https://raw.githubusercontent.com/Solizardking/clawdbot-go/main/install-npm.sh | bash");
  console.log("");
}
