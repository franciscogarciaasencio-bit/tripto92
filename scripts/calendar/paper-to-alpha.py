"""Turn a painting on Ona's paper into ink on transparency ("colour to alpha"), so it sits on any
paper texture like the rest of the app instead of a flat rectangle of slightly different colour.

    python3 -I scripts/calendar/paper-to-alpha.py IN.webp OUT.webp [R G B]

For every pixel, alpha is how far it is from the paper colour toward black (the largest channel), and
the colour is the ink that, laid over that paper, reproduces the original exactly. Paper becomes fully
transparent; washes keep their softness; the original alpha (faded edges) is kept on top.
"""
import sys

import numpy as np
from PIL import Image

source, target = sys.argv[1], sys.argv[2]
paper = np.array([float(v) for v in sys.argv[3:6]] if len(sys.argv) >= 6 else [242, 233, 218])
image = np.asarray(Image.open(source).convert('RGBA')).astype(float)
rgb, original = image[..., :3], image[..., 3:] / 255
toward_black = np.clip((paper - rgb) / paper, 0, 1)
alpha = toward_black.max(axis=2, keepdims=True)
# Faint paper grain under 2 % becomes clean transparency.
alpha = np.where(alpha < .02, 0, alpha)
ink = np.where(alpha > 0, paper - (paper - rgb) / np.maximum(alpha, 1e-6), 0)
out = np.concatenate([np.clip(ink, 0, 255), np.clip(alpha * original, 0, 1) * 255], axis=2)
Image.fromarray(out.round().astype(np.uint8), 'RGBA').save(target, 'WEBP', quality=90, method=6)
print('alpha coverage', round(float((out[..., 3] > 8).mean()), 3))
