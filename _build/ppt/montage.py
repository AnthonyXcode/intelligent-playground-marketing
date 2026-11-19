# QA helper: tiles render/slide-XX.png into render/sheet-N.png (2 cols x 3 rows)
from PIL import Image
import glob
fs=sorted(glob.glob('render/slide-*.png')); ims=[Image.open(f) for f in fs]
w,h=ims[0].size; w2,h2=w//2,h//2
for k in range(0,len(ims),6):
    sh=Image.new('RGB',(w2*2+10,h2*3+20),'grey')
    for j,im in enumerate(ims[k:k+6]): sh.paste(im.resize((w2,h2)),((j%2)*(w2+10),(j//2)*(h2+10)))
    sh.save(f'render/sheet-{k//6+1}.png')
