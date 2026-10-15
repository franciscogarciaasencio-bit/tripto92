"""Cut a watercolour illustration out of its flat paper background, with soft, fringe-free edges.

Usage: python3 scripts/watercolor/cutout.py SOURCE.png OUTPUT.png [--size 384]
Flood-fills the background from the borders (so light areas inside the figure, like a face, stay),
derives partial alpha from the colour distance in a narrow edge band, un-mixes the paper colour
from semi-transparent pixels, crops to the figure with even margins and writes a square RGBA PNG.
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage

parser = argparse.ArgumentParser()
parser.add_argument('source'); parser.add_argument('output')
parser.add_argument('--size', type=int, default=384)
parser.add_argument('--margin', type=float, default=0.06)
args = parser.parse_args()

rgb = np.asarray(Image.open(args.source).convert('RGB')).astype(np.float64)
h, w, _ = rgb.shape
border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
paper = np.median(border, axis=0)
distance = np.sqrt(((rgb - paper) ** 2).sum(axis=2))

# Background = paper-coloured pixels connected to the border.
near_paper = distance < 22
labels, _ = ndimage.label(near_paper)
edge_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
outside = np.isin(labels, list(edge_labels))

# Soft edge: within a few pixels of the outside, alpha follows how far the colour is from paper.
band = ndimage.binary_dilation(outside, iterations=4) & ~outside
alpha = np.where(outside, 0.0, 1.0)
soft = np.clip((distance - 10) / 46, 0, 1)
alpha[band] = soft[band]
alpha = ndimage.gaussian_filter(alpha, 0.6)
alpha[outside & (ndimage.distance_transform_edt(~outside) == 0) & (distance < 14)] = 0

# Un-mix paper from partially transparent pixels so no cream halo remains on other backgrounds.
a = np.clip(alpha, 1e-3, 1)[..., None]
colour = np.clip((rgb - (1 - a) * paper) / a, 0, 255)
colour = np.where(alpha[..., None] > 0.98, rgb, colour)

ys, xs = np.where(alpha > 0.05)
top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
side = int(max(bottom - top, right - left) * (1 + 2 * args.margin))
cy, cx = (top + bottom) / 2, (left + right) / 2
canvas = np.zeros((side, side, 4))
y0, x0 = int(cy - side / 2), int(cx - side / 2)
sy0, sx0 = max(0, y0), max(0, x0)
sy1, sx1 = min(h, y0 + side), min(w, x0 + side)
canvas[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0, :3] = colour[sy0:sy1, sx0:sx1]
canvas[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0, 3] = alpha[sy0:sy1, sx0:sx1] * 255
image = Image.fromarray(canvas.astype(np.uint8), 'RGBA').resize((args.size, args.size), Image.LANCZOS)
image.save(args.output, optimize=True)
print(f'paper {paper.round().astype(int).tolist()} -> {args.output} {args.size}px')
