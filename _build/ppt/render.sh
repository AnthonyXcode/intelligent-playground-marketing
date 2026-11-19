#!/bin/sh
# Render deck to PNGs in render/. For QA only, a temp copy swaps Microsoft JhengHei -> Heiti TC
# (JhengHei isn't installed on this Mac; LibreOffice's fallback for bold is a serif).
cd "$(dirname "$0")"
D=../../IntelligentPlayground_智能運動場.pptx
rm -rf render && mkdir -p render
.venv/bin/python - "$D" render/qa.pptx <<'PY'
import sys,zipfile
zi=zipfile.ZipFile(sys.argv[1]); zo=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED)
for it in zi.infolist():
    b=zi.read(it.filename)
    if it.filename.endswith('.xml'): b=b.replace(b'Microsoft JhengHei',b'Heiti TC')
    zo.writestr(it,b)
zo.close()
PY
/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf --outdir render render/qa.pptx >/dev/null 2>&1
.venv/bin/python -c "
import pymupdf
d=pymupdf.open('render/qa.pdf')
for i,p in enumerate(d): p.get_pixmap(dpi=110).save(f'render/slide-{i+1:02d}.png')
print(len(d),'pages')"
rm -f render/qa.pptx
