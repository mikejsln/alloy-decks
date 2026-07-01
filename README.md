# alloy-decks

Publish **Claude Design** decks to shareable web URLs — so anyone outside Alloy can view them with **no login**. Build and edit in Claude Design (the source of truth); publishing is a one-way snapshot. No more Google Slides round-trip.

## How it works

1. **Build & edit your deck in Claude Design.** Keep working there — nothing to export to stay productive.
2. **Publish** from an interactive Claude Code session (uses your claude.ai login):
   ```
   /publish-deck <claude-design-project-id> [--slug my-deck] [--gated --password "…"]
   ```
   or directly, once the deck files are pulled into a dir:
   ```
   python3 scripts/publish_design_deck.py --src <dir> --slug my-deck --title "My Deck" [--gated --password "…"]
   ```
3. **Share the URL:** `https://mikejsln.github.io/alloy-decks/<slug>/` — public, no login, keyboard-navigable, and **print-to-PDF is built in** (the deck runtime lays out one slide per page).
4. **Update:** edit in Claude Design, re-run `/publish-deck` with the same `--slug` → same URL refreshes.

## What the publisher does
- Pulls the Claude Design deck (`.dc.html`) + its runtime (`support.js`, `deck-stage.js`, `_ds/…/_ds_bundle.js` + `colors_and_type.css`) + `assets/`.
- **Injects React/ReactDOM** (pinned `18.3.1` + SRI) — the Claude Design deck runtime is a React app; GitHub Pages has no CSP so the CDN loads (the Claude Artifact host's CSP would block it — which is why Pages is the target).
- **Rewrites fonts to Google Fonts** (DM Sans + Roboto Mono). NeuSans is proprietary; per the Alloy design system DM Sans is its sanctioned web substitute, so no font files are shipped.
- Writes `docs/<slug>/`; GitHub Pages serves `main:/docs`.

## Public vs. gated
- **Open decks** are public to anyone with the URL.
- **Confidential decks: use `--gated`.** The slide-bearing `index.html` is **AES-256-GCM encrypted client-side** (PBKDF2-SHA256, 250k iters); the published page is a password prompt that decrypts in-browser and renders the deck in an isolated iframe. The static host only ever serves ciphertext for the confidential part. The runtime files (React, `support.js`, design-system CSS/JS — no secrets) stay plaintext siblings.
  - **Shared team password.** `--gated` uses the shared default password in **`.deck-secret`** (git-ignored — never committed; the repo is public). So the team remembers one password across all gated decks. Override for a one-off with `--password "…"`.
  - **Change the shared password:** `/change-password "<new>"` (or `python3 scripts/change_deck_password.py "<new>"` + re-publish). Because each gated deck bakes the password into its ciphertext, rotation **re-encrypts + re-publishes every gated deck** (a fresh Claude Design pull each) — there's no central password to flip. `decks.json` tracks which decks are gated so rotation finds them all.
  - **Share the password out-of-band** (not in the repo, not in the URL).
  - **The gate is per-deck, not per-person** — one shared password protects all gated decks (so one leak exposes them all), and there's no per-viewer access log. Memorable, but weaker than per-recipient auth. For a deck that needs per-recipient control or an audit trail, use a real auth'd host instead.

## Layout
- `scripts/publish_design_deck.py` — the transform + publish orchestrator.
- `scripts/gate/encrypt.js` — the client-side AES-256-GCM password gate (Node Web Crypto; matches the browser).
- `.claude/commands/publish-deck.md` — the `/publish-deck` command (does the DesignSync pull, then calls the script).
- `docs/<slug>/` — published decks (GitHub Pages source = `main:/docs`).

## Constraints
- Publishing runs **interactively** — the DesignSync MCP tool needs your claude.ai login and can't run headless / in a subagent.
- GitHub Pages is public. Gated decks are protected only by the client-side password; don't publish material NDAs / financials without `--gated`, and even then treat it as "obscured + password-gated," not enterprise access control.
