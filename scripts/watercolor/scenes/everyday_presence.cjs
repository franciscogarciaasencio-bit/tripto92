// Everyday Presence (Levels 111–115): a cup of tea, still warm, on an ordinary day.
module.exports = ({ form, stroke, bloom, paper, PALETTE: c }) => paper(`
  ${form('M440 380 C380 320 470 270 440 200 C424 160 444 120 476 96 C470 140 500 170 506 210 C520 270 460 320 500 380 Z', c.foam, { texture: 'still1', opacity: 0.8,
    shades: [{ shape: { cx: 470, cy: 240, rx: 40, ry: 90 }, color: c.mist, opacity: 0.6 }] })}
  ${form('M570 370 C530 320 600 284 578 228 C568 200 580 170 604 152 C604 186 626 210 628 244 C632 300 586 330 612 370 Z', c.foam, { texture: 'still2', opacity: 0.65 })}
  ${form({ cx: 512, cy: 868, rx: 410, ry: 96 }, c.cream, {
    texture: 'still1', shades: [
      { shape: { cx: 620, cy: 930, rx: 380, ry: 70 }, color: c.fawn, opacity: 0.85, wide: true },
      { shape: { cx: 512, cy: 846, rx: 240, ry: 44 }, color: c.tan, opacity: 0.6 },
    ] })}
  ${form('M786 520 C904 512 940 610 896 676 C862 726 796 738 744 730 L756 672 C800 680 846 664 856 628 C866 588 842 568 794 572 Z', '#b9c3a2', {
    texture: 'still2', shades: [{ shape: { cx: 890, cy: 680, rx: 70, ry: 80 }, color: '#86977a', opacity: 0.8 }] })}
  ${form('M188 448 C188 448 300 468 512 468 C724 468 836 448 836 448 C832 650 772 790 650 840 C596 862 428 862 374 840 C252 790 192 650 188 448 Z', '#b9c3a2', {
    texture: 'still3', shades: [
      { shape: { cx: 720, cy: 790, rx: 260, ry: 210 }, color: '#86977a', opacity: 0.85, wide: true },
      { shape: { cx: 330, cy: 560, rx: 90, ry: 170 }, color: '#dfe3cc', opacity: 0.9 },
    ] })}
  ${form('M416 640 C440 580 520 560 584 580 C560 640 500 680 416 640 Z', c.paper, {
    texture: 'still1', shades: [{ shape: { cx: 560, cy: 620, rx: 60, ry: 40 }, color: c.cream, opacity: 0.7 }] })}
  ${stroke('M430 636 C480 616 530 600 576 582', '#86977a', 6, 0.8)}
  ${form({ cx: 512, cy: 452, rx: 330, ry: 66 }, c.paper, {
    texture: 'still2', shades: [{ shape: { cx: 700, cy: 470, rx: 160, ry: 40 }, color: c.tan, opacity: 0.6 }] })}
  ${form({ cx: 512, cy: 462, rx: 290, ry: 44 }, c.ochre, {
    texture: 'wash6', shades: [
      { shape: { cx: 620, cy: 478, rx: 200, ry: 30 }, color: c.olive, opacity: 0.75 },
      { shape: { cx: 410, cy: 452, rx: 120, ry: 20 }, color: c.sun, opacity: 0.85 },
    ] })}
`);
