#!/usr/bin/env python3
"""
render_web_deck.py — render a deck `*.content.json` into an Alloy-branded web
deck (the same <x-dc>/deck-stage.js format the Team Guide uses) and publish it
to the alloy-decks GitHub Pages site. Replaces the Google-Slides render path.

This is the "generated deck" counterpart to /publish-deck (which handles
hand-authored Claude Design decks): a studio agent produces content.json, this
renders it to a web deck and publishes — no Google Slides, no round-trip.

Schema (v1 — the pitch/simple deck): { "meta": {"deck","date","stage"},
"slides": [ {"eyebrow","title","bullets":[...]} ] }. Slide 0 renders as a navy
cover; the rest as paper content slides.

Usage:
  render_web_deck.py --content <deck.content.json> --slug <slug> [--title "…"]
                     [--gated] [--repo ~/alloy-decks] [--no-push]
"""
import argparse, html, json, os, shutil, subprocess, sys, tempfile

DS = "_ds/alloy-partners-design-system-5ae951e7-7a59-41ed-9b4c-d2413e26791d"
NAVY, BLUE, CYAN, PAPER, INK, GRAY = "#081D59", "#2929E2", "#6CE3FF", "#F4F4F4", "#26262B", "#7F7F7F"
FONT = "'NeuSans','DM Sans',system-ui,sans-serif"
MONO = "'Roboto Mono',ui-monospace,monospace"


def esc(s):
    return html.escape(str(s), quote=False)


def cover(meta, s):
    bl = "".join(
        f'<div style="font:400 30px/1.5 {FONT};color:#C3CAD6;margin-top:14px;max-width:42ch;">{esc(b)}</div>'
        for b in s.get("bullets", []))
    return f'''<section data-label="Cover" style="position:relative;background:{NAVY};color:#fff;width:100%;height:100%;display:flex;flex-direction:column;font-family:{FONT};overflow:hidden;">
  <div style="height:12px;background:{BLUE};flex:none;"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:120px 130px;min-height:0;">
    <div style="font:600 26px/1 {MONO};letter-spacing:.22em;text-transform:uppercase;color:{CYAN};margin-bottom:44px;">{esc(s.get("eyebrow",""))}</div>
    <h1 style="font:800 116px/1.02 {FONT};letter-spacing:-.03em;margin:0;max-width:16ch;">{esc(s.get("title",""))}</h1>
    <div style="margin-top:36px;">{bl}</div>
  </div>
  <div style="position:absolute;left:130px;bottom:56px;font:400 22px/1 {MONO};letter-spacing:.06em;color:#8E97A6;">Alloy Partners &times; Grupo AG &middot; {esc(meta.get("stage",""))} &middot; {esc(meta.get("date",""))}</div>
</section>'''


def content_slide(s, idx, total):
    bl = "".join(
        f'''<li style="display:flex;gap:22px;align-items:flex-start;margin-bottom:26px;">
        <span style="flex:none;width:14px;height:14px;margin-top:16px;background:{BLUE};border-radius:3px;"></span>
        <span style="font:400 36px/1.45 {FONT};color:{INK};">{esc(b)}</span></li>'''
        for b in s.get("bullets", []))
    return f'''<section data-label="{esc(s.get('title','Slide'))[:40]}" style="position:relative;background:{PAPER};color:{INK};width:100%;height:100%;display:flex;flex-direction:column;font-family:{FONT};overflow:hidden;">
  <div style="height:12px;background:{BLUE};flex:none;"></div>
  <div style="flex:1;display:flex;flex-direction:column;padding:104px 130px 90px;min-height:0;">
    <div style="font:600 24px/1 {MONO};letter-spacing:.2em;text-transform:uppercase;color:{BLUE};margin-bottom:22px;">{esc(s.get("eyebrow",""))}</div>
    <h2 style="font:800 76px/1.05 {FONT};letter-spacing:-.02em;margin:0 0 48px;color:{NAVY};max-width:22ch;">{esc(s.get("title",""))}</h2>
    <ul style="list-style:none;margin:0;padding:0;max-width:44ch;">{bl}</ul>
  </div>
  <div style="position:absolute;right:130px;bottom:56px;font:400 22px/1 {MONO};color:{GRAY};">{idx:02d} / {total:02d}</div>
</section>'''


def build_dc_html(doc):
    slides = doc.get("slides", [])
    meta = doc.get("meta", {})
    secs = [cover(meta, slides[0])] if slides else []
    for i, s in enumerate(slides[1:], start=2):
        secs.append(content_slide(s, i, len(slides)))
    body = "\n".join(secs)
    return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(meta.get("deck","Deck"))}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="{DS}/colors_and_type.css">
<script src="{DS}/_ds_bundle.js"></script>
</helmet>
<x-import component-from-global-scope="deck-stage" from="./deck-stage.js" width="1920" height="1080" hint-size="100%,100%" data-uneditable="">
{body}
</x-import>
</x-dc>
</body>
</html>'''


def main():
    ap = argparse.ArgumentParser(description="Render a content.json into an Alloy web deck + publish")
    ap.add_argument("--content", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--title", default=None)
    ap.add_argument("--repo", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--gated", action="store_true")
    ap.add_argument("--no-push", action="store_true")
    a = ap.parse_args()

    doc = json.load(open(a.content, encoding="utf-8"))
    title = a.title or doc.get("meta", {}).get("deck", a.slug)

    src = tempfile.mkdtemp(prefix="webdeck-")
    # stamp the canonical Alloy runtime, then the generated deck
    shutil.copytree(os.path.join(a.repo, "runtime"), src, dirs_exist_ok=True)
    with open(os.path.join(src, f"{a.slug}.dc.html"), "w", encoding="utf-8") as f:
        f.write(build_dc_html(doc))

    cmd = [sys.executable, os.path.join(a.repo, "scripts", "publish_design_deck.py"),
           "--src", src, "--slug", a.slug, "--title", title, "--repo", a.repo]
    if a.gated:
        cmd.append("--gated")
    if a.no_push:
        cmd.append("--no-push")
    return subprocess.run(cmd).returncode


if __name__ == "__main__":
    raise SystemExit(main())
