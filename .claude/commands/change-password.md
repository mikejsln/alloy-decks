---
description: Change the SHARED password used for all gated Alloy decks, and re-publish every gated deck to take the new password. Because client-side-encrypted decks bake the password into each file, rotation re-encrypts + re-publishes each gated deck (fresh DesignSync pull). Run interactively (needs your claude.ai login).
argument-hint: <new-password>
---

You are rotating the **shared gated-deck password** for the `alloy-decks` site. Work in `~/alloy-decks`. Run interactively — re-publishing gated decks re-pulls them from Claude Design via DesignSync (needs the claude.ai login).

**Argument:** `$ARGUMENTS` — the new shared password.

## Process
1. **Set the shared secret + get the work-list:**
   ```
   python3 scripts/change_deck_password.py "<new-password>"
   ```
   This writes the new password to `.deck-secret` (git-ignored) and prints every gated deck (slug + `project_id`) that must be re-published.
2. **Re-publish each gated deck** (skip if the list is empty). For each `{slug, project_id, deck_file}`:
   - Do the same DesignSync pull as `/publish-deck` (get_file the deck + runtime + `_ds` + assets into a fresh temp dir, preserving paths).
   - Re-publish with the new password (it's now the default, so no `--password` needed):
     ```
     python3 scripts/publish_design_deck.py --src <tmp> --slug <slug> --title "<title>" --project-id <project_id> --gated
     ```
   Do them one at a time; each commits + pushes.
3. **Report:** confirm the new password is active for all gated decks + the next `--gated` publish, and remind the user to **re-share the new password with the team out-of-band** (old links keep working but now need the new password). GitHub Pages takes ~30-60s per deck to redeploy.

## Notes
- The password is **never committed** (`.deck-secret` is git-ignored). Each teammate who publishes needs the current value locally.
- "Rotation" is a real re-encrypt of every gated deck — there is no central password to flip. That's inherent to client-side static encryption.
- Open (non-gated) decks are unaffected.
