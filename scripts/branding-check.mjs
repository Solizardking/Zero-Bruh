/**
 * Public branding regression checks for the Zero Clawd open-source release.
 * Asserts product surfaces and user-facing chrome — not the technical clawdbot* aliases.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("install-npm product line includes zeroclawd + agent hub", () => {
  const src = read("install-npm.sh");
  assert.match(src, /cheshireterminal\.ai\/zeroclawd/);
  assert.match(src, /cheshireterminal\.ai\/agents/);
  assert.match(src, /cheshireterminal\.ai\/agents\/forge/);
  assert.match(src, /funpump\.ai/);
});

test("install.sh DNA and env use Zero Clawd product name", () => {
  const src = read("install.sh");
  assert.match(src, /--agent-name "Zero Clawd"/);
  assert.match(src, /Zero Clawd Environment/);
  assert.doesNotMatch(src, /--agent-name "ClawdBot"/);
  assert.doesNotMatch(src, /# ClawdBot Environment/);
});

test("web and UI chrome titles are Zero Clawd", () => {
  assert.match(read("web/frontend/index.html"), /<title>Zero Clawd — Console<\/title>/);
  assert.match(read("ui/index.html"), /<title>Zero Clawd Control<\/title>/);
  assert.match(read("web/frontend/src/App.tsx"), /Zero Clawd ops console online/);
  const backend = read("web/backend/main.go");
  assert.match(backend, /Zero Clawd — Web Console/);
  assert.match(backend, /title>Zero Clawd — Console</);
  assert.match(backend, /h1>🦞 Zero Clawd</);
  assert.match(backend, /"agent":\s+"Zero Clawd"/);
  assert.match(backend, /AgentName:\s+"Zero Clawd"/);
  assert.doesNotMatch(backend, /ClawdBot OS/);
});

test("CLI DNA default agent-name is Zero Clawd", () => {
  const main = read("cmd/clawdbot/main.go");
  assert.match(main, /agent-name", "Zero Clawd"/);
});

test("constants AppName is Zero Clawd", () => {
  assert.match(read("pkg/constants/constants.go"), /AppName\s+=\s+"Zero Clawd"/);
});
