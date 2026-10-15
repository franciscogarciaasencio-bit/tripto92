"""Contact sheet: paintings on Ona sand at app sizes, next to the Monkey Mind reference.
Usage: python3 scripts/watercolor/sheet.py OUT.png A.png [B.png ...]"""
import sys
from PIL import Image
out_path, *paths = sys.argv[1:]
monkey = 'assets/ona/stages/monkey_mind.png'
items = [monkey] + paths
cell = 300
sheet = Image.new('RGB', (cell * len(items), cell + 150), (242, 233, 218))
for index, p in enumerate(items):
    art = Image.open(p).convert('RGBA')
    big = art.resize((260, 260), Image.LANCZOS)
    sheet.paste(big, (index * cell + 20, 10), big)
    for j, size in enumerate([112, 46]):
        small = art.resize((size, size), Image.LANCZOS)
        sheet.paste(small, (index * cell + 30 + j * 130, cell - 10 + (112 - size) // 2), small)
sheet.save(out_path)
