---
description: Publish a Claude Design deck to a public (or password-gated) web URL on the alloy-decks GitHub Pages site — so anyone outside Alloy can view it with no login. Build & edit the deck in Claude Design (the source of truth); this snapshots it to the web. Re-run after edits to refresh the same URL.
argument-hint: <claude-design-project-id> [--file "<Deck>.dc.html"] [--slug <slug>] [--gated --password <pw>]
---

You are publishing a **Claude Design deck** to the public **alloy-decks** GitHub Pages site. Claude Design is the source of truth — the team builds & edits there; this command is a one-way snapshot to a shareable URL. Run it in an interactive Claude Code session (it uses your claude.ai login for DesignSync). Work in the `alloy-decks` repo clone (`~/alloy-decks`).

**Arguments:** `$ARGUMENTS`
- `<project-id>` — the Claude Design project UUID (from the project URL `claude.ai/design/p/<id>`).
- `--file` — the deck file name (default: the project's single `*.dc.html`).
- `--slug` — the URL slug (default: kebab-case of the project/deck name).
- `--gated` — password-protect the deck (client-side AES-256-GCM). Uses the **shared team password** in `.deck-secret` by default (override with `--password <pw>`). Confidential decks MUST use `--gated` — the site is otherwise public by URL. Pass `--project-id <id>` on gated publishes so `/change-password` can re-pull the deck on rotation.

## Process
1. **Confirm the project.** `DesignSync get_project` on the id (verify name + that you can read it). If the tool errors on auth, tell the user to run in an interactive session with their claude.ai login (it can't run headless).
2. **List + pull the files.** `DesignSync list_files`. Into a fresh temp dir (`mktemp -d`), pull with `DesignSync get_file` and write each (base64-decode when `isBase64`), **preserving the project-relative paths**:
   - the deck `*.dc.html`
   - `support.js`, `deck-stage.js`
   - `_ds/<design-system>/_ds_bundle.js` and `_ds/<design-system>/colors_and_type.css`
   - every file under `assets/` the deck references (SVGs, etc.)
   - Only pull what the deck references (open the `.dc.html` and grep its `src=`/`href=`). This deck family has **no raster images** — do not pull `screenshots/`/`uploads/` unless the deck actually references them. Skip local font files: the publish script rewrites fonts to Google Fonts.
3. **Publish.** Run:
   ```
   python3 scripts/publish_design_deck.py --src <tempdir> --slug <slug> --title "<project name>" [--gated --password <pw>]
   ```
   It injects React (pinned + SRI), rewrites the CSS to Google Fonts, (encrypts if `--gated`), writes `docs/<slug>/`, commits, and pushes.
4. **Verify** (before telling the user it's live): the script prints the URL. Optionally serve `docs/<slug>/` locally and load it in a browser to confirm it renders (13-ish `<section>` slides, no console errors); for `--gated`, confirm the password page unlocks. GitHub Pages takes ~30-60s to deploy.
5. **Report:** the public URL. For `--gated`, remind the user the **password must be shared out-of-band** (it is not in the repo), and that "revoke" = re-publish with a new password.

## Guardrails
- **Confidential decks → always `--gated`.** The alloy-decks site is public; only the encrypted `index.html` protects gated slide content. Never publish confidential material open.
- **Never fabricate deck content** — if a DesignSync pull fails, stop and report; do not hand-write slides.
- Re-running with the same `--slug` refreshes the same URL (edit in Claude Design → re-publish).
