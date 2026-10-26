#!/usr/bin/env python3
"""Build the single-file site.

Combines src/template.html, the JavaScript modules in src/ and the images in
assets/images/ into one self-contained index.html (scripts inlined, images as
data URIs). Uses only the Python standard library.

    python build.py            # writes index.html
    python build.py out.html   # writes somewhere else
"""
import base64, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC, IMG = ROOT / 'src', ROOT / 'assets' / 'images'

# order matters: later modules extend earlier ones
MODULES = ['engine.js', 'content.js', 'world.js', 'game.js', 'vehicles.js', 'physics.js', 'ui.js', 'device.js', 'lights.js']
IMAGES = {
    'REF01': 'ref-01-cyber-chowk.jpg', 'REF02': 'ref-02-setu-bridge.webp', 'REF03': 'ref-03-vajra-s1-studio.jpg',
    'REF04': 'ref-04-bazaar-drift.webp', 'REF05': 'ref-05-city-map.webp', 'REF06': 'ref-06-old-city-gate.jpg',
    'REF07': 'ref-07-holo-interchange.webp',
}

def main():
    html = (SRC / 'template.html').read_text(encoding='utf-8')
    js = '\n'.join((SRC / m).read_text(encoding='utf-8') for m in MODULES)
    if '__SCRIPTS__' not in html:
        sys.exit('template.html is missing the __SCRIPTS__ placeholder')
    html = html.replace('__SCRIPTS__', js)
    for key, name in IMAGES.items():
        ext = pathlib.Path(name).suffix.lower()
        mime = 'image/jpeg' if ext in ('.jpg', '.jpeg') else ('image/png' if ext == '.png' else 'image/webp')
        data = base64.b64encode((IMG / name).read_bytes()).decode()
        html = html.replace(f'__{key}__', f'data:{mime};base64,{data}')
    left = [k for k in IMAGES if f'__{k}__' in html]
    if left:
        sys.exit(f'unreplaced placeholders: {left}')
    cover_file = ROOT / 'case-studies' / 'wallvista' / 'wallvista-cover.png'
    if cover_file.exists():
        cover_b64 = f'data:image/png;base64,{base64.b64encode(cover_file.read_bytes()).decode()}'
        html = html.replace('case-studies/wallvista/wallvista-cover.png', cover_b64)
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'index.html'
    out.write_text(html, encoding='utf-8')
    case_study = ROOT / 'case-studies' / 'wallvista'
    if out.resolve().parent != ROOT:
        shutil.copytree(case_study, out.resolve().parent / 'case-studies' / 'wallvista', dirs_exist_ok=True)
    print(f'built {out.name}: {len(html) / 1024 / 1024:.2f} MB')

if __name__ == '__main__':
    main()
