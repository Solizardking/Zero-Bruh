#!/usr/bin/env node
/**
 * postinstall — never fails `npm install`.
 *
 * Default (one-shot skills): copy the full bundled skill pack into
 *   ~/.clawdbot/skills  and symlink every SKILL.md into
 *   ~/.agents|~/.claude|~/.codex/skills
 *
 * Skip skills prepackage:
 *   CLAWDBOT_SKIP_SKILLS=1 npm install clawdbot-go
 *
 * Full stack (Go binary + birth seeds + automaton) on postinstall:
 *   CLAWDBOT_ONESHOT=1 npm install clawdbot-go
 *   # or: npx clawdbot-go install
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pack = join(root, "skills", "pack-index.json");
const silent = process.env.npm_config_loglevel === "silent";

async function main() {
  if (!existsSync(pack)) {
    if (!silent) console.warn("[clawdbot-go] no skills/pack-index.json — skip skill prepackage");
    return;
  }

  const fullOneshot =
    process.env.CLAWDBOT_ONESHOT === "1" ||
    process.env.npm_config_oneshot === "true";

  try {
    const { runOneshot, installSkillPackOnly } = await import("./oneshot-install.mjs");

    if (fullOneshot) {
      runOneshot({
        skipGo: process.env.CLAWDBOT_SKIP_GO === "1",
        skipBirth: process.env.CLAWDBOT_SKIP_BIRTH === "1",
        skipAutomaton: process.env.CLAWDBOT_SKIP_AUTOMATON === "1",
        force: process.env.CLAWDBOT_FORCE === "1",
      });
      return;
    }

    // Default: prepackage ALL bundled skills (fast, no Go/birth)
    if (process.env.CLAWDBOT_SKIP_SKILLS === "1") {
      if (!silent) {
        console.log("");
        console.log("  🦞 clawdbot-go installed (skills prepackage skipped).");
        console.log("  One-shot skills:  npx clawdbot-go install --skip-go --skip-birth --skip-automaton");
        console.log("  Full stack:       npx clawdbot-go install");
        console.log("");
      }
      return;
    }

    const installDir =
      process.env.CLAWDBOT_INSTALL_DIR || join(homedir(), ".clawdbot");
    const result = installSkillPackOnly({
      installDir,
      force: process.env.CLAWDBOT_FORCE === "1",
    });

    if (!silent) {
      console.log("");
      console.log("  🦞 clawdbot-go — skill pack prepackaged (one-shot)");
      console.log(`  Skills: ${result.skillCount} → ${result.skillsDir}`);
      console.log(`  Linked: ${result.linked} agent skill entries`);
      console.log(`  export CLAWDBOT_SKILLS_DIR="${result.skillsDir}"`);
      console.log("  Full stack (Go + birth):  npx clawdbot-go install");
      console.log(
        "  Curl oneshot: curl -fsSL https://raw.githubusercontent.com/Solizardking/Zero-Bruh/main/install-npm.sh | bash",
      );
      console.log("");
    }
  } catch (err) {
    console.warn("[clawdbot-go] postinstall skill prepackage failed:", err?.message || err);
    if (!silent) {
      console.log("  Retry: npx clawdbot-go install --skip-go --skip-birth --skip-automaton");
    }
  }
}

await main();
