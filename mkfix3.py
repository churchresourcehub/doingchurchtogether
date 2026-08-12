#!/usr/bin/env python3
"""Regenerate opener (three-fold) and botA (case study) caption cards, both orientations."""
import subprocess, os

BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
OUT = "/tmp/promo"

BASE = """<html><head><meta charset="utf-8"><style>
  html,body{{margin:0;padding:0;width:{W}px;height:{H}px;background:transparent;}}
  .card{{position:absolute;{pos};max-width:{maxw}px;background:rgba(24,30,46,.94);
        border-left:8px solid {accent};border-radius:10px;padding:34px 44px 38px;
        box-shadow:0 14px 50px rgba(0,0,0,.5);}}
  .kick{{font-family:Georgia,serif;font-size:{kick}px;letter-spacing:5px;text-transform:uppercase;
        color:{accent};margin-bottom:12px;font-weight:bold;}}
  .line{{font-family:Georgia,serif;font-size:{size}px;line-height:1.22;color:#fff;}}
  .typewrap{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;display:flex;
        align-items:center;justify-content:center;}}
  .typecard{{background:rgba(24,30,46,.90);border-radius:14px;padding:56px 72px;
        box-shadow:0 18px 70px rgba(0,0,0,.55);max-width:{tmaxw}px;}}
  .typeline{{font-family:Georgia,serif;font-size:{size}px;line-height:1.25;color:#fff;
        text-align:center;}}
</style></head><body>{body}</body></html>"""

def shot(html, path, w, h):
    hp = path.replace(".png", ".html")
    open(hp, "w").write(html)
    subprocess.run([BRAVE, "--headless", "--disable-gpu", "--hide-scrollbars",
                    "--default-background-color=00000000", f"--window-size={w},{h}",
                    f"--screenshot={path}", f"file://{hp}"], capture_output=True)
    os.remove(hp)

OPEN_TEXT = "Three resources to help local churches and leaders."
BOT_KICK = "A Real World Case Study"
BOT_LINE = "One pastor's example of working out theology and practice in a visual and connected way."

# horizontal opener
body = f'<div class="typewrap"><div class="typecard"><div class="typeline">{OPEN_TEXT}</div></div></div>'
shot(BASE.format(W=1920, H=1080, pos="", maxw=0, accent="#9aa3c8", size=76, kick=24, tmaxw=1500, body=body),
     os.path.join(OUT, "w-open.png"), 1920, 1080)
print("w-open")

# vertical opener
body = f'<div class="typewrap"><div class="typecard"><div class="typeline">{OPEN_TEXT}</div></div></div>'
shot(BASE.format(W=1080, H=1920, pos="", maxw=0, accent="#9aa3c8", size=58, kick=24, tmaxw=780, body=body),
     os.path.join(OUT, "vw-open.png"), 1080, 1920)
print("vw-open")

# horizontal botA
body = f'<div class="card"><div class="kick">{BOT_KICK}</div><div class="line">{BOT_LINE}</div></div>'
shot(BASE.format(W=1920, H=1080, pos="left:50%;top:50%;transform:translate(-50%,-50%)", maxw=820, accent="#9aa3c8", size=42, kick=24, tmaxw=0, body=body),
     os.path.join(OUT, "w-botA.png"), 1920, 1080)
print("w-botA")

# vertical botA
body = f'<div class="card"><div class="kick">{BOT_KICK}</div><div class="line">{BOT_LINE}</div></div>'
shot(BASE.format(W=1080, H=1920, pos="left:50%;top:50%;transform:translate(-50%,-50%)", maxw=810, accent="#9aa3c8", size=44, kick=28, tmaxw=0, body=body),
     os.path.join(OUT, "vw-botA.png"), 1080, 1920)
print("vw-botA")

# comparative caption B: mentions the interactive assistant (added 8/12 evening)
COMP_KICK = "Comparative Theology"
COMP_LINE = "Maps, spectrums, and an interactive assistant that answers your questions from each tradition's own sources."
body = f'<div class="card"><div class="kick">{COMP_KICK}</div><div class="line">{COMP_LINE}</div></div>'
shot(BASE.format(W=1920, H=1080, pos="left:84px;bottom:96px", maxw=900, accent="#c98b8b", size=42, kick=24, tmaxw=0, body=body),
     os.path.join(OUT, "w-compB.png"), 1920, 1080)
print("w-compB")
body = f'<div class="card"><div class="kick">{COMP_KICK}</div><div class="line">{COMP_LINE}</div></div>'
shot(BASE.format(W=1080, H=1920, pos="left:90px;top:800px", maxw=810, accent="#c98b8b", size=44, kick=28, tmaxw=0, body=body),
     os.path.join(OUT, "vw-compB.png"), 1080, 1920)
print("vw-compB")
