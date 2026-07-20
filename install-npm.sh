#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Zero Clawd — npm one-shot (Grok Build style)                                ║
# ║                                                                              ║
# ║  curl -fsSL https://raw.githubusercontent.com/Solizardking/clawdbot-go/main/install-npm.sh | bash
# ║                                                                              ║
# ║  Installs: RH skill pack (23) · agents skill dirs · env · optional packages  ║
# ║  For Go binary + full source, this also chains the classic install.sh.       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# GitHub source (open-source tree). Override if you rename the public repo.
GITHUB_REPO="${CLAWDBOT_GITHUB_REPO:-Solizardking/Zero-Bruh}"
REPO_RAW="${CLAWDBOT_REPO_RAW:-https://raw.githubusercontent.com/${GITHUB_REPO}}"
REF="${CLAWDBOT_REF:-main}"
NPM_PKG="${CLAWDBOT_NPM_PKG:-clawdbot-go}"
INSTALL_DIR="${CLAWDBOT_INSTALL_DIR:-$HOME/.clawdbot}"
# 1 = also run classic install.sh for Go binary (default)
WITH_GO="${CLAWDBOT_WITH_GO:-1}"
# 1 = force CLAWDBOT_ONESHOT on npm install
FORCE_ONESHOT="${CLAWDBOT_FORCE_ONESHOT:-1}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { printf '%s  ▶%s %s\n' "${CYAN}" "${RESET}" "$*"; }
success() { printf '%s  ✓%s %s\n' "${GREEN}" "${RESET}" "$*"; }
warn()    { printf '%s  ⚠%s %s\n' "${YELLOW}" "${RESET}" "$*"; }
die()     { printf '%s  ✗ ERROR:%s %s\n' "${RED}" "${RESET}" "$*" >&2; exit 1; }

printf '%s' "${CYAN}"
cat << 'EOF'
    ██████╗██╗      █████╗ ██╗    ██╗██████╗ ██████╗  ██████╗ ████████╗
   ██╔════╝██║     ██╔══██╗██║    ██║██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝
   ██║     ██║     ███████║██║ █╗ ██║██║  ██║██████╔╝██║   ██║   ██║
   ██║     ██║     ██╔══██║██║███╗██║██║  ██║██╔══██╗██║   ██║   ██║
   ╚██████╗███████╗██║  ██║╚███╔███╔╝██████╔╝██████╔╝╚██████╔╝   ██║
    ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝
EOF
printf '%s\n' "${RESET}"
printf '%s  🦞 Zero Clawd — npm one-shot installer%s\n' "${BOLD}" "${RESET}"
printf '  Skills · Agents · Packages · Solana + Robinhood omni\n\n'

check_cmd() { command -v "$1" >/dev/null 2>&1; }

# ── Node / npm ───────────────────────────────────────────────────────────────
if ! check_cmd node; then
  warn "Node.js not found — installing via official nvm bootstrap if possible"
  if check_cmd curl; then
    curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/;s/arm64/arm64/').tar.gz -o /tmp/node.tgz 2>/dev/null \
      && warn "Prefer: brew install node  OR  https://nodejs.org" \
      || true
  fi
  die "Install Node.js 18+ from https://nodejs.org then re-run"
fi

NODE_V="$(node -v 2>/dev/null || echo unknown)"
success "Node: ${NODE_V}"

if ! check_cmd npm; then
  die "npm is required (ships with Node.js)"
fi
success "npm: $(npm -v)"

if ! check_cmd npx; then
  die "npx is required"
fi

mkdir -p "${INSTALL_DIR}"

# ── Prefer local tree when curl is run from a checkout ───────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [[ -n "${SCRIPT_DIR}" && -f "${SCRIPT_DIR}/package.json" && -f "${SCRIPT_DIR}/scripts/oneshot-install.mjs" ]]; then
  info "Using local checkout: ${SCRIPT_DIR}"
  (cd "${SCRIPT_DIR}" && npm install --ignore-scripts --no-fund --no-audit 2>/dev/null || true)
  export CLAWDBOT_INSTALL_DIR="${INSTALL_DIR}"
  node "${SCRIPT_DIR}/scripts/oneshot-install.mjs" install --dir "${INSTALL_DIR}" \
    ${CLAWDBOT_SKIP_GO:+--skip-go} \
    ${CLAWDBOT_SKIP_BIRTH:+--skip-birth} \
    ${CLAWDBOT_SKIP_AUTOMATON:+--skip-automaton}
  LOCAL_DONE=1
else
  LOCAL_DONE=0
fi

if [[ "${LOCAL_DONE}" != "1" ]]; then
  # ── npm install package (registry or git) ──────────────────────────────────
  info "Installing ${NPM_PKG} via npm..."
  export CLAWDBOT_INSTALL_DIR="${INSTALL_DIR}"
  if [[ "${FORCE_ONESHOT}" == "1" ]]; then
    export CLAWDBOT_ONESHOT=1
  fi

  # Try npm registry first; fall back to GitHub tarball so one-shot works pre-publish.
  if npm view "${NPM_PKG}" version >/dev/null 2>&1; then
    npm install -g "${NPM_PKG}@latest" --no-fund --no-audit || warn "global npm install failed; trying npx"
  else
    warn "Package not on registry yet — installing from GitHub"
    npm install -g "github:${GITHUB_REPO}#${REF}" --no-fund --no-audit 2>/dev/null \
      || npm install -g "https://github.com/${GITHUB_REPO}/archive/refs/heads/${REF}.tar.gz" --no-fund --no-audit \
      || warn "global install from GitHub failed; using npx from raw"
  fi

  info "Running oneshot install..."
  if check_cmd clawdbot-go; then
    clawdbot-go install --dir "${INSTALL_DIR}"
  elif check_cmd zero-clawd; then
    zero-clawd install --dir "${INSTALL_DIR}"
  else
    # Prefer published npm package; fall back to GitHub tree
    npx --yes "${NPM_PKG}@latest" install --dir "${INSTALL_DIR}" 2>/dev/null \
      || npx --yes "github:${GITHUB_REPO}#${REF}" install --dir "${INSTALL_DIR}" 2>/dev/null \
      || {
        # Last resort: download oneshot script alone
        TMP="$(mktemp -d)"
        curl -fsSL "${REPO_RAW}/${REF}/scripts/oneshot-install.mjs" -o "${TMP}/oneshot-install.mjs"
        curl -fsSL "${REPO_RAW}/${REF}/scripts/skill-pack.mjs" -o "${TMP}/skill-pack.mjs"
        mkdir -p "${TMP}/skills"
        # Fetch pack-index + skills via archive
        curl -fsSL "https://github.com/${GITHUB_REPO}/archive/refs/heads/${REF}.tar.gz" -o "${TMP}/src.tgz"
        tar -xzf "${TMP}/src.tgz" -C "${TMP}"
        ROOT="$(find "${TMP}" -maxdepth 1 -type d \( -name 'Zero-Bruh-*' -o -name 'clawdbot-go-*' \) | head -1)"
        [[ -n "${ROOT}" ]] || die "Could not unpack GitHub archive"
        node "${ROOT}/scripts/oneshot-install.mjs" install --dir "${INSTALL_DIR}"
        rm -rf "${TMP}"
      }
  fi
fi

# ── Optional classic Go install (full CLI) ───────────────────────────────────
if [[ "${WITH_GO}" == "1" ]]; then
  if command -v go >/dev/null 2>&1; then
    info "Chaining classic install.sh for Go clawdbot binary..."
    if curl -fsSL "${REPO_RAW}/${REF}/install.sh" | CLAWDBOT_INSTALL_DIR="${INSTALL_DIR}" CLAWDBOT_SKIP_SKILL_SEED=1 bash; then
      success "Go binary install finished"
    else
      warn "Classic install.sh failed — skill pack is still installed; retry later"
    fi
  else
    warn "Go not installed — skill pack is ready; install Go for clawdbot CLI"
    warn "  https://go.dev/dl/  then: curl -fsSL ${REPO_RAW}/${REF}/install.sh | bash"
  fi
fi

printf '\n%s%s  🦞 One-shot complete%s\n' "${GREEN}" "${BOLD}" "${RESET}"
printf '  Skills dir: %s/skills\n' "${INSTALL_DIR}"
printf '  Env:        %s/.env\n' "${INSTALL_DIR}"
printf '  export CLAWDBOT_SKILLS_DIR="%s/skills"\n' "${INSTALL_DIR}"
printf '  Product:    https://funpump.ai · https://cheshireterminal.ai/agents/forge\n\n'
