#!/usr/bin/env node
/**
 * CLI entry for `npx clawdbot-go` / `zero-clawd` / `clawdbot-stack`.
 */
import { main } from "../scripts/oneshot-install.mjs";

main(process.argv.slice(2));
