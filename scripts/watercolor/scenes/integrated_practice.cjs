// Woven In (Levels 106–110): a small round bird asleep in the nest it has woven.
module.exports = ({ form, stroke, bloom, paper, PALETTE: c }) => paper(`
  ${form({ cx: 512, cy: 440, rx: 292, ry: 272 }, '#c99a6e', {
    texture: 'fur1', shades: [
      { shape: { cx: 700, cy: 600, rx: 230, ry: 230 }, color: '#a8744c', opacity: 0.8, wide: true },
      { shape: { cx: 420, cy: 270, rx: 170, ry: 100 }, color: '#e4c49e', opacity: 0.85, wide: true },
    ] })}
  ${form('M440 196 C436 150 470 120 512 128 C520 100 556 88 584 104 C562 116 560 140 572 160 C580 176 572 192 556 200 C520 210 470 210 440 196 Z', '#b07e52', {
    texture: 'fur2', shades: [{ shape: { cx: 540, cy: 180, rx: 60, ry: 30 }, color: '#8f6038', opacity: 0.6 }] })}
  ${form({ cx: 512, cy: 640, rx: 196, ry: 150 }, c.cream, {
    texture: 'wash3', shades: [{ shape: { cx: 500, cy: 540, rx: 120, ry: 50 }, color: c.paper, opacity: 0.9 }] })}
  ${form('M716 380 C800 410 838 520 806 620 C736 616 682 556 668 486 C660 430 676 386 716 380 Z', c.ochre, {
    texture: 'fur3', shades: [{ shape: { cx: 790, cy: 590, rx: 80, ry: 80 }, color: c.olive, opacity: 0.75 }] })}
  ${stroke('M376 414 C402 452 466 454 494 414', c.umber, 17)}
  ${stroke('M530 414 C558 454 622 452 648 414', c.umber, 17)}
  ${form('M486 462 L540 462 L513 504 Z', '#d6924c', { texture: 'still1', shades: [{ shape: { cx: 528, cy: 490, rx: 22, ry: 16 }, color: '#b47437', opacity: 0.6 }] })}
  ${bloom({ cx: 380, cy: 486, rx: 42, ry: 27 }, c.blush, 0.75)}
  ${bloom({ cx: 646, cy: 486, rx: 42, ry: 27 }, c.blush, 0.75)}
  ${form('M96 620 C140 590 200 626 252 612 C330 640 420 650 512 650 C604 650 694 640 772 612 C824 626 884 590 928 620 C936 800 780 936 512 940 C244 936 88 800 96 620 Z', c.olive, {
    texture: 'fur4', shades: [
      { shape: { cx: 600, cy: 960, rx: 460, ry: 190 }, color: c.bark, opacity: 0.85, wide: true },
      { shape: { cx: 360, cy: 670, rx: 260, ry: 60 }, color: c.fawn, opacity: 0.85 },
    ] })}
  ${stroke('M118 656 C300 730 560 744 904 646', c.fawn, 12, 0.85)}
  ${stroke('M150 744 C320 820 600 830 878 734', c.tan, 10, 0.75)}
  ${stroke('M230 836 C380 892 620 896 800 826', c.fawn, 9, 0.65)}
  ${stroke('M170 660 C260 740 350 830 460 912', c.umber, 7, 0.5)}
  ${stroke('M856 660 C770 740 680 830 566 914', c.umber, 7, 0.5)}
  ${stroke('M330 680 C380 770 430 850 500 922', c.tan, 6, 0.55)}
  ${stroke('M700 680 C650 770 600 850 530 922', c.tan, 6, 0.55)}
  ${stroke('M64 590 C104 580 146 594 178 620', c.bark, 10, 0.85)}
  ${stroke('M846 622 C880 586 924 572 964 580', c.bark, 10, 0.85)}
  ${stroke('M244 612 C236 580 210 562 180 556', c.olive, 8, 0.85)}
  ${stroke('M780 612 C792 580 816 566 844 562', c.olive, 8, 0.85)}
`);
