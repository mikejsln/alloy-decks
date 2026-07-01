#!/usr/bin/env python3
"""
publish_design_deck.py — assemble a pulled Claude Design deck into the alloy-decks
GitHub Pages repo and publish it to a public (or password-gated) URL.

The DesignSync PULL happens in the /publish-deck command (interactive — the
DesignSync MCP tool needs the member's claude.ai login and can't run headless).
This script does the deterministic transform + publish, given a local directory
of already-pulled RAW design files:

  <src>/<name>.dc.html                 the exported Claude Design deck
  <src>/support.js  <src>/deck-stage.js   the dc-runtime
  <src>/_ds/<design-system>/_ds_bundle.js + colors_and_type.css
  <src>/assets/*.svg (+ any other referenced siblings)

Transforms: inject React/ReactDOM (pinned + SRI) so the dc-runtime renders
standalone; rewrite the design-system CSS to load DM Sans + Roboto Mono from
Google Fonts (NeuSans's sanctioned web substitute — no proprietary font files
shipped). With --gated, the slide-bearing index.html is AES-256-GCM encrypted
behind a password page; the non-confidential runtime files stay plaintext
siblings (the iframe srcdoc resolves them against /<slug>/).

Usage:
  publish_design_deck.py --src <dir> --slug <slug> --title "<title>"
  publish_design_deck.py --src <dir> --slug <slug> --title "<t>" --gated --password <pw>
  ... [--repo ~/alloy-decks] [--no-push]
"""
import argparse, os, shutil, subprocess, sys

# Pinned React UMD + SRI (computed from the exact CDN bytes; see README).
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
    """Replace the local-font preamble (everything before :root) with a Google
    Fonts @import. Leaves the :root tokens + classes untouched."""
    i = css.find(":root")
    return GFONTS + css[i:] if i != -1 else css


def inject_react(html: str) -> str:
    if "react@18" in html:
        return html
    if "<head>" not in html:
        sys.exit("deck html has no <head> — cannot inject the React runtime")
    return html.replace("<head>", "<head>\n" + REACT, 1)


def main() -> int:
    ap = argparse.ArgumentParser(description="Publish a Claude Design deck to alloy-decks Pages")
    ap.add_argument("--src", required=True, help="dir of pulled raw design files")
    ap.add_argument("--slug", required=True, help="URL slug, e.g. team-guide")
    ap.add_argument("--title", default="Deck", help="deck title (password page + tab)")
    ap.add_argument("--repo", default=os.path.expanduser("~/alloy-decks"))
    ap.add_argument("--deck-file", default=None, help="the .dc.html name (default: first found)")
    ap.add_argument("--gated", action="store_true", help="password-protect the deck")
    ap.add_argument("--password", default=None)
    ap.add_argument("--no-push", action="store_true", help="assemble + commit but don't push")
    a = ap.parse_args()
    if a.gated and not a.password:
        sys.exit("--gated requires --password")

    out = os.path.join(a.repo, "docs", a.slug)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out, exist_ok=True)

    # Copy every pulled file into out/ preserving structure; the .dc.html is
    # handled specially (-> index.html); colors_and_type.css is rewritten.
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
        subprocess.run(["node", enc, plain, a.password, idx, a.title], check=True)
        os.remove(plain)

    url = f"https://mikejsln.github.io/alloy-decks/{a.slug}/"
    if not a.no_push:
        subprocess.run(["git", "-C", a.repo, "add", f"docs/{a.slug}"], check=True)
        msg = (f"Publish deck: {a.slug}" + (" (gated)" if a.gated else "") +
               "\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>")
        subprocess.run(["git", "-C", a.repo, "commit", "-q", "-m", msg], check=True)
        subprocess.run(["git", "-C", a.repo, "push", "-q"], check=True)

    print("PUBLISHED:", url + ("   [password required]" if a.gated else ""))
    if a.gated:
        print("Share the password OUT-OF-BAND — it is not stored in the repo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
