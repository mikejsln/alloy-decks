#!/usr/bin/env python3
"""
change_deck_password.py — set the SHARED default deck password and list the gated
decks that must be re-published to take it.

Client-side-encrypted static decks bake the password into each file's ciphertext,
so there is no central password to flip: rotating means re-encrypting + re-publishing
every gated deck. This script updates the shared secret and prints the rotation
work-list; the /change-password command then re-pulls each gated deck from Claude
Design and re-publishes it with the new password.

Usage: change_deck_password.py <new-password> [--repo ~/alloy-decks]
"""
import argparse, json, os, sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("new_password")
    ap.add_argument("--repo", default=os.path.expanduser("~/alloy-decks"))
    a = ap.parse_args()
    if not a.new_password.strip():
        sys.exit("password must not be empty")

    with open(os.path.join(a.repo, ".deck-secret"), "w", encoding="utf-8") as f:
        f.write(a.new_password.strip())
    print(f"Shared deck password updated (stored in .deck-secret, git-ignored).")

    reg_path = os.path.join(a.repo, "decks.json")
    reg = json.load(open(reg_path, encoding="utf-8")) if os.path.exists(reg_path) else {}
    gated = {s: d for s, d in reg.items() if d.get("gated")}
    if not gated:
        print("No gated decks in decks.json — nothing to re-publish. New password "
              "applies to the next --gated publish.")
        return 0
    print(f"\n{len(gated)} gated deck(s) must be RE-PUBLISHED to take the new password")
    print("(each needs a fresh DesignSync pull + re-encrypt — the /change-password command does this):")
    for slug, d in gated.items():
        print(f"  - {slug}   project_id={d.get('project_id')}   deck_file={d.get('deck_file') or '(auto)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
