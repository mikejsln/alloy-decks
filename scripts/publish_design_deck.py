#!/usr/bin/env python3
"""
publish_design_deck.py — assemble a pulled Claude Design deck into the alloy-decks
GitHub Pages repo and publish it to a public (or password-gated) URL.

The DesignSync PULL happens in the /publish-deck command (interactive — the
DesignSync MCP tool needs the member's claude.ai login and can't run headless).
This script does the deterministic transform + publish, given a local directory
of already-pulled RAW design files.

Transforms: inject React/ReactDOM (pinned + SRI) so the dc-runtime renders
standalone; rewrite the design-system CSS to load DM Sans + Roboto Mono from
Google Fonts (NeuSans's sanctioned web substitute). With --gated, the
slide-bearing index.html is AES-256-GCM encrypted behind a password page.

Password for --gated: --password wins; else the SHARED default in the repo's
gitignored `.deck-secret`; else error. Every publish records the deck in
`decks.json` (gated flag + project id) so `change_deck_password.py` knows which
decks to re-encrypt on rotation.

Usage:
  publish_design_deck.py --src <dir> --slug <slug> --title "<title>" [--project-id <id>]
  publish_design_deck.py --src <dir> --slug <slug> --title "<t>" --gated [--password <pw>]
  ... [--repo ~/alloy-decks] [--no-push]
"""
import argparse, json, os, shutil, subprocess, sys

REACT = (
    '<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" '
    'integrity="sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z"></script>\n'
    '<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" '
    'integrity="sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1"></script>\n'
)
GFONTS = (
    '/* Fonts via Google Fonts CDN (Pages allows external hosts). Per the Alloy\n'
    '   design system, DM Sans is NeuSans\'s sanctioned web substitute, so the\n'
    '   "NeuSans","DM Sans" stack falls to DM Sans here. */\n'
    '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;'
    '1,9..40,100..1000&family=Roboto+Mono:wght@400;500;700&display=swap");\n\n'
)


def rewrite_css(css: str) -> str:
    i = css.find(":root")
    return GFONTS + css[i:] if i != -1 else css


def inject_react(html: str) -> str:
    if "react@18" in html:
        return html
    if "<head>" not in html:
        sys.exit("deck html has no <head> — cannot inject the React runtime")
    return html.replace("<head>", "<head>\n" + REACT, 1)


def resolve_password(a) -> str:
    """--password wins; else the shared default in .deck-secret; else error."""
    if a.password:
        return a.password
    secret = os.path.join(a.repo, ".deck-secret")
    if os.path.exists(secret):
        pw = open(secret, encoding="utf-8").read().strip()
        if pw:
            return pw
    sys.exit("--gated needs a password: pass --password, or seed the shared "
             "default in .deck-secret (git-ignored).")


def update_registry(a):
    """Record this deck so change_deck_password.py can find gated decks to rotate."""
    reg_path = os.path.join(a.repo, "decks.json")
    reg = {}
    if os.path.exists(reg_path):
        reg = json.load(open(reg_path, encoding="utf-8"))
    reg[a.slug] = {
        "gated": bool(a.gated),
        "title": a.title,
        "project_id": a.project_id,   # needed to re-pull on rotation (gated only)
        "deck_file": a.deck_file,
    }
    with open(reg_path, "w", encoding="utf-8") as f:
        json.dump(reg, f, indent=2, sort_keys=True)
        f.write("\n")
    return reg_path


def main() -> int:
    ap = argparse.ArgumentParser(description="Publish a Claude Design deck to alloy-decks Pages")
    ap.add_argument("--src", required=True, help="dir of pulled raw design files")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--title", default="Deck")
    ap.add_argument("--repo", default=os.path.expanduser("~/alloy-decks"))
    ap.add_argument("--project-id", default=None, help="Claude Design project id (recorded for rotation)")
    ap.add_argument("--deck-file", default=None, help="the .dc.html name (default: first found)")
    ap.add_argument("--gated", action="store_true")
    ap.add_argument("--password", default=None, help="overrides the shared default in .deck-secret")
    ap.add_argument("--no-push", action="store_true")
    a = ap.parse_args()

    password = resolve_password(a) if a.gated else None

    out = os.path.join(a.repo, "docs", a.slug)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out, exist_ok=True)

    dc = None
    for root, _, files in os.walk(a.src):
        for fn in files:
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, a.src)
            if fn.endswith(".dc.html") and (a.deck_file is None or fn == a.deck_file):
                dc = p
                continue
            dst = os.path.join(out, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if fn == "colors_and_type.css":
                with open(dst, "w", encoding="utf-8") as f:
                    f.write(rewrite_css(open(p, encoding="utf-8").read()))
            else:
                shutil.copyfile(p, dst)
    if not dc:
        sys.exit(f"no *.dc.html found under {a.src}")

    idx = os.path.join(out, "index.html")
    with open(idx, "w", encoding="utf-8") as f:
        f.write(inject_react(open(dc, encoding="utf-8").read()))

    if a.gated:
        enc = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gate", "encrypt.js")
        plain = idx + ".plain"
        os.rename(idx, plain)
        subprocess.run(["node", enc, plain, password, idx, a.title], check=True)
        os.remove(plain)

    reg_path = update_registry(a)

    url = f"https://mikejsln.github.io/alloy-decks/{a.slug}/"
    if not a.no_push:
        subprocess.run(["git", "-C", a.repo, "add", f"docs/{a.slug}", os.path.basename(reg_path)], check=True)
        msg = (f"Publish deck: {a.slug}" + (" (gated)" if a.gated else "") +
               "\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>")
        subprocess.run(["git", "-C", a.repo, "commit", "-q", "-m", msg], check=True)
        subprocess.run(["git", "-C", a.repo, "push", "-q"], check=True)

    print("PUBLISHED:", url + ("   [password required]" if a.gated else ""))
    if a.gated:
        print("Password: the shared default (.deck-secret)" if not a.password else "Password: (explicit --password)")
        print("Share it out-of-band; it is NOT stored in the repo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
