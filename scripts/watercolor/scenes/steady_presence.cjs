// Steady Presence (Levels 121–125): an old tortoise, unhurried, perfectly at home where it is.
module.exports = ({ form, stroke, bloom, paper, PALETTE: c }) => paper(`
  ${form({ cx: 500, cy: 860, rx: 420, ry: 62 }, c.pebble, { texture: 'still1', opacity: 0.5, shades: [{ shape: { cx: 600, cy: 880, rx: 300, ry: 36 }, color: c.stone, opacity: 0.6 }] })}
  ${form('M200 760 C176 820 196 872 262 878 C320 882 352 846 350 790 Z', c.sage, { texture: 'fur1', shades: [{ shape: { cx: 290, cy: 870, rx: 70, ry: 34 }, color: c.moss, opacity: 0.7 }] })}
  ${form('M560 790 C560 846 590 880 640 880 C700 880 724 840 712 776 Z', c.sage, { texture: 'fur2', shades: [{ shape: { cx: 650, cy: 870, rx: 70, ry: 34 }, color: c.moss, opacity: 0.7 }] })}
  ${form('M676 600 C700 480 790 410 870 420 C944 430 980 510 964 590 C948 670 880 710 806 704 C740 698 690 670 676 600 Z', c.sage, {
    texture: 'fur3', shades: [
      { shape: { cx: 900, cy: 660, rx: 100, ry: 70 }, color: c.moss, opacity: 0.7 },
      { shape: { cx: 840, cy: 470, rx: 80, ry: 50 }, color: c.mint, opacity: 0.85 },
    ] })}
  ${stroke('M808 540 C826 568 870 570 888 540', c.umber, 15)}
  ${stroke('M842 610 C862 626 892 622 908 604', c.umber, 10, 0.9)}
  ${bloom({ cx: 790, cy: 596, rx: 34, ry: 22 }, c.blush, 0.7)}
  ${form('M80 790 C70 510 240 286 470 284 C700 286 832 500 812 790 C640 820 260 824 80 790 Z', c.olive, {
    texture: 'fur4', shades: [
      { shape: { cx: 540, cy: 820, rx: 420, ry: 170 }, color: c.bark, opacity: 0.85, wide: true },
      { shape: { cx: 360, cy: 380, rx: 220, ry: 110 }, color: c.fawn, opacity: 0.85, wide: true },
    ] })}
  ${form('M80 766 C260 806 640 806 812 768 C816 800 812 818 804 830 C620 856 260 856 92 826 C82 808 78 790 80 766 Z', c.sand, {
    texture: 'wash4', shades: [{ shape: { cx: 600, cy: 830, rx: 260, ry: 26 }, color: c.tan, opacity: 0.75 }] })}
  ${stroke('M352 400 C392 370 540 370 580 400 C612 470 594 540 552 572 C500 594 422 594 380 572 C334 540 320 470 352 400 Z', c.bark, 11, 0.6)}
  ${stroke('M352 400 C270 420 200 500 166 600', c.bark, 10, 0.55)}
  ${stroke('M580 400 C660 420 726 500 762 600', c.bark, 10, 0.55)}
  ${stroke('M380 572 C316 626 250 690 218 772', c.bark, 10, 0.5)}
  ${stroke('M552 572 C622 626 680 690 708 772', c.bark, 10, 0.5)}
  ${stroke('M462 594 C464 670 466 730 468 790', c.bark, 9, 0.45)}
`);
