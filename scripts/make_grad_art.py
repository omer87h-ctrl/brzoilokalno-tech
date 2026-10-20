"""Generate original vector illustration; no external imagery or font files."""
from pathlib import Path
import random

random.seed(73127)
out = Path(__file__).resolve().parents[1] / 'igra' / 'skyline.svg'
art = ['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000" viewBox="0 0 1500 1000"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#173c64"/><stop offset=".55" stop-color="#41657a"/><stop offset="1" stop-color="#e1a26f"/></linearGradient><linearGradient id="water" x2="1" y2="1"><stop stop-color="#2a7794"/><stop offset="1" stop-color="#0a2d4d"/></linearGradient><radialGradient id="glow"><stop stop-color="#ffe1a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffc16b" stop-opacity="0"/></radialGradient></defs><rect width="1500" height="1000" fill="url(#sky)"/>']
for i in range(80):
    x,y = random.randrange(1500),random.randrange(450)
    art.append(f'<circle cx="{x}" cy="{y}" r="{random.choice([1,1,2])}" fill="#dceeff" opacity=".55"/>')
art += ['<path d="M0 430 170 340 310 409 475 300 660 410 840 320 1050 390 1250 278 1500 400V1000H0Z" fill="#214a65"/><path d="M0 520 220 440 450 500 680 400 920 478 1150 360 1500 460V1000H0Z" fill="#173c52"/><path d="M0 720Q480 430 1500 710V1000H0Z" fill="#204d46"/><path d="M1500 650C1150 610 1200 820 700 860S350 1000 0 960V1000H1500Z" fill="url(#water)"/>']
for row in range(8):
    for col in range(14):
        x=320+col*83-row*33;y=470+row*45+col*5
        if x<250: continue
        h=random.randint(25,70);w=random.randint(32,53);d=18
        c=random.choice(['#b1a085','#829c9e','#b6b5a1','#819db6','#b89980'])
        art.append(f'<ellipse cx="{x}" cy="{y+30}" rx="48" ry="17" fill="#091f2a" opacity=".45"/><path d="M{x-w} {y-h}l{w} 17v{h}l-{w} -17Z" fill="{c}"/><path d="M{x} {y-h+17}l{d} -12v{h}l-{d} 12Z" fill="#3d5b68"/><path d="M{x-w-4} {y-h}l{w//2+4} -18L{x+d+4} {y-h+5}l-{d+4} 12Z" fill="#4e6170"/>')
        for k in range(3):
            for a in range(2):
                xx=x-w+6+k*10;yy=y-h+12+a*15+k*3
                art.append(f'<path d="M{xx} {yy}l6 2v7l-6 -2Z" fill="#ffd99a"/>')
        art.append(f'<ellipse cx="{x}" cy="{y+40}" rx="50" ry="24" fill="url(#glow)"/>')
for x,y in [(660,760),(810,710),(1050,800),(1200,700),(490,820)]:
    art.append(f'<rect x="{x}" y="{y-85}" width="5" height="85" rx="2" fill="#142f3d"/><circle cx="{x+2}" cy="{y-90}" r="7" fill="#ffe4ac"/><circle cx="{x+2}" cy="{y-90}" r="60" fill="url(#glow)"/>')
art+=['<path d="M550 855 720 930 1370 790 1240 745Z" fill="#294854"/><path d="M560 840 720 912 1360 778 1240 729Z" fill="#668087"/><path d="M560 840 720 912 1360 778" fill="none" stroke="#eabf7e" stroke-width="6"/><path d="M720 920v56m170-92v56m180-94v65m180-106v60" stroke="#153c51" stroke-width="18"/>','</svg>']
out.write_text(''.join(art),encoding='utf-8')
print('Original skyline:',out.stat().st_size,'bytes')
