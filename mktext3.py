#!/usr/bin/env python3
"""v3 overlays: typed-on center text (frame sequences) + positioned card captions."""
import subprocess, os, shutil

BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
OUT = "/tmp/promo"

BASE = """<html><head><meta charset="utf-8"><style>
  html,body{{margin:0;padding:0;width:1920px;height:1080px;background:transparent;}}
  .card{{position:absolute;{pos};max-width:{maxw}px;background:rgba(24,30,46,.94);
        border-left:8px solid {accent};border-radius:10px;padding:34px 44px 38px;
        box-shadow:0 14px 50px rgba(0,0,0,.5);}}
  .kick{{font-family:Georgia,serif;font-size:24px;letter-spacing:5px;text-transform:uppercase;
        color:{accent};margin-bottom:12px;font-weight:bold;}}
  .line{{font-family:Georgia,serif;font-size:{size}px;line-height:1.22;color:#fff;}}
  .typewrap{{position:absolute;left:0;top:0;width:1920px;height:1080px;display:flex;
        align-items:center;justify-content:center;}}
  .typecard{{background:rgba(24,30,46,.90);border-radius:14px;padding:56px 72px;
        box-shadow:0 18px 70px rgba(0,0,0,.55);max-width:1500px;}}
  .typeline{{font-family:Georgia,serif;font-size:{size}px;line-height:1.25;color:#fff;
        text-align:center;}}
  .caret{{display:inline-block;width:5px;height:1em;background:#9aa3c8;vertical-align:-0.12em;
        margin-left:6px;}}
</style></head><body>{body}</body></html>"""

def shot(html, path):
    hp = path.replace(".png", ".html")
    open(hp, "w").write(html)
    subprocess.run([BRAVE, "--headless", "--disable-gpu", "--hide-scrollbars",
                    "--default-background-color=00000000", "--window-size=1920,1080",
                    f"--screenshot={path}", f"file://{hp}"], capture_output=True)
    os.remove(hp)

# ---- typed center sequences (2 chars per frame, then 6 caret-hold frames) ----
def typed(name, text, size):
    d = os.path.join(OUT, name)
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    f = 0
    steps = list(range(2, len(text) + 1, 2))
    if steps and steps[-1] != len(text): steps.append(len(text))
    for n in steps:
        body = f'<div class="typewrap"><div class="typecard"><div class="typeline">{text[:n]}<span class="caret"></span></div></div></div>'
        shot(BASE.format(pos="", maxw=0, accent="#9aa3c8", size=size, body=body),
             os.path.join(d, "f%04d.png" % f)); f += 1
    for _ in range(6):
        body = f'<div class="typewrap"><div class="typecard"><div class="typeline">{text}</div></div></div>'
        shot(BASE.format(pos="", maxw=0, accent="#9aa3c8", size=size, body=body),
             os.path.join(d, "f%04d.png" % f)); f += 1
    print(name, f, "frames")

typed("tseq-open", "Three resources to help local churches and leaders.", 76)
typed("tseq-out", "Explore it all at doingchurchtogether.org", 64)

# ---- positioned card captions, two beats per scene ----
CARDS = [
    # name, kicker, line, accent, size, position, maxwidth
    ("w-hubA", "The Church Resource Hub",
     "A shared library of working documents from real churches.",
     "#e8b04b", 46, "left:84px;bottom:96px", 860),
    ("w-hubB", "The Church Resource Hub",
     "Search more than 150 resources by ministry area, download one, and adapt it for your congregation.",
     "#e8b04b", 42, "left:84px;bottom:96px", 900),
    ("w-bookA", "The Pastor's Handbook",
     "A 34-chapter field guide for leading a local church.",
     "#7fb069", 46, "right:96px;top:120px", 760),
    ("w-bookB", "The Pastor's Handbook",
     "Every chapter teaches one piece of the work and links the exact tool from the Hub.",
     "#7fb069", 42, "right:96px;top:120px", 800),
    ("w-botA", "A Real World Case Study",
     "One pastor's example of working out theology and practice in a visual and connected way.",
     "#9aa3c8", 42, "left:84px;bottom:130px", 820),
    ("w-botB", "Theology and Practice",
     "Ask anything. The assistant answers from the full text of the sources and names them.",
     "#9aa3c8", 42, "left:84px;bottom:130px", 820),
    ("w-compA", "Comparative Theology",
     "How the Christian traditions relate, in what they believe and how they branched.",
     "#c98b8b", 42, "left:84px;bottom:96px", 860),
    ("w-compB", "Comparative Theology",
     "Maps, spectrums, and a doctrine matrix, each tradition drawn fairly from its own voice.",
     "#c98b8b", 42, "left:84px;bottom:96px", 880),
]
for name, kick, line, accent, size, pos, maxw in CARDS:
    body = f'<div class="card"><div class="kick">{kick}</div><div class="line">{line}</div></div>'
    shot(BASE.format(pos=pos, maxw=maxw, accent=accent, size=size, body=body),
         os.path.join(OUT, name + ".png"))
    print("card", name)
