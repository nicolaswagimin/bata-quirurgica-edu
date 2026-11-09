"""Compose a PNG review sheet from existing renders; plain Python + Pillow.

Usage: python3 render_sheet_v2.py N. Never imports Blender modules.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
OUT=HERE/'.work/out'
IDS=('v3-secado','v3-tomar-bata','v3-despliegue','v3-mangas','v3-amarre','v3-guantes','v3-tarjeta-giro')


def font(size):
    """Use a Unicode system font, with Pillow's fallback on other machines."""
    for path in ('/System/Library/Fonts/Supplemental/Arial.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if Path(path).exists():
            return ImageFont.truetype(path,size)
    return ImageFont.load_default(size=size)


def lines(draw,text,typeface,width):
    """Wrap exact protocol wording to the sheet width, without truncation."""
    result=[]
    current=''
    for word in text.split():
        test=(current+' '+word).strip()
        if draw.textlength(test,font=typeface)>width and current:
            result.append(current)
            current=word
        else:
            current=test
    return result+[current]


def render(step):
    """Compose front, three-quarter and detail with title + action/look text."""
    protocol=json.loads((HERE.parents[1]/'content/protocolos/ar-practica-v3.json').read_text())
    entry=next(s for s in protocol['steps'] if s['id']==IDS[step-1])
    detail={4:'hands',5:'back'}.get(step,'detail')
    paths=[OUT/f'v2-paso{step}-{suffix}.png' for suffix in ('front','three',detail)]
    missing=[str(p) for p in paths if not p.exists()]
    if missing:
        raise FileNotFoundError('Render first: '+', '.join(missing))
    width=1860
    sheet=Image.new('RGB',(width,1220),'#f5f7fa')
    draw=ImageDraw.Draw(sheet)
    draw.text((30,24),f'{step}. {entry["title"]}',font=font(36),fill='#17304b')
    for i,path in enumerate(paths):
        with Image.open(path) as image:
            image=image.convert('RGB')
            image.thumbnail((620,930))
            sheet.paste(image,(620*i+(620-image.width)//2,88))
    # Three semantic lines, copied from action/look; wrap visually if necessary.
    action=entry['action']
    look=entry['look']
    clauses=look.split('; ',1)
    if len(clauses)==1:
        words=look.split()
        middle=len(words)//2
        clauses=[' '.join(words[:middle]),' '.join(words[middle:])]
    text=[action,clauses[0],clauses[1]]
    y=1036
    for value in text:
        for line in lines(draw,value,font(24),width-60):
            draw.text((30,y),line,font=font(24),fill='#17304b')
            y+=31
    if y>sheet.height:
        expanded=Image.new('RGB',(width,y+24),'#f5f7fa')
        expanded.paste(sheet,(0,0))
        # Repaint text if it exceeded original sheet height.
        d=ImageDraw.Draw(expanded)
        y=1036
        for value in text:
            for line in lines(d,value,font(24),width-60):
                d.text((30,y),line,font=font(24),fill='#17304b')
                y+=31
        sheet=expanded
    path=OUT/f'v2-paso{step}-preview.png'
    sheet.save(path)
    print('PATHS',[str(path)])
    return path


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('step',type=int,choices=range(1,8))
    render(parser.parse_args().step)
