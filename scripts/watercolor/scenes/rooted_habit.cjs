// Rooted Practice (Levels 101–105): a sturdy young tree whose roots hold a round mound of earth.
module.exports = ({ form, stroke, bloom, paper, PALETTE: c }) => paper(`
  ${form('M132 900 C150 760 300 640 512 636 C724 640 874 760 892 900 C800 966 660 984 512 984 C364 984 224 966 132 900 Z', c.fawn, {
    texture: 'wash2', shades: [
      { shape: { cx: 600, cy: 940, rx: 420, ry: 120 }, color: c.olive, opacity: 0.8, wide: true },
      { shape: { cx: 420, cy: 690, rx: 200, ry: 60 }, color: c.sand, opacity: 0.85 },
    ] })}
  ${stroke('M500 700 C470 742 412 770 330 790', c.bark, 13)}
  ${stroke('M526 700 C560 744 620 770 700 794', c.bark, 13)}
  ${stroke('M512 712 C510 770 500 820 486 870', c.bark, 11)}
  ${stroke('M404 764 C380 800 340 822 290 834', c.bark, 8, 0.75)}
  ${stroke('M636 770 C664 806 704 826 748 836', c.bark, 8, 0.75)}
  ${stroke('M498 800 C470 830 440 850 404 866', c.bark, 6, 0.7)}
  ${form('M470 712 C478 640 476 560 456 470 C490 458 534 458 568 470 C548 560 546 640 554 712 C534 724 490 724 470 712 Z', c.olive, {
    texture: 'fur1', shades: [
      { shape: { cx: 556, cy: 600, rx: 30, ry: 160 }, color: c.bark, opacity: 0.8 },
      { shape: { cx: 480, cy: 560, rx: 18, ry: 120 }, color: c.fawn, opacity: 0.6 },
    ] })}
  ${form('M512 70 C640 70 728 150 740 248 C826 270 870 350 846 430 C824 510 742 548 668 540 C624 590 400 590 356 540 C282 548 200 510 178 430 C154 350 198 270 284 248 C296 150 384 70 512 70 Z', c.leaf, {
    texture: 'fur2', shades: [
      { shape: { cx: 512, cy: 560, rx: 380, ry: 110 }, color: c.moss, opacity: 0.85, wide: true },
      { shape: { cx: 430, cy: 190, rx: 170, ry: 90 }, color: c.mint, opacity: 0.8, wide: true },
      { shape: { cx: 760, cy: 420, rx: 90, ry: 120 }, color: c.moss, opacity: 0.6 },
      { shape: { cx: 300, cy: 470, rx: 120, ry: 70 }, color: c.moss, opacity: 0.55 },
      { shape: { cx: 600, cy: 360, rx: 110, ry: 60 }, color: c.moss, opacity: 0.35 },
      { shape: { cx: 700, cy: 230, rx: 70, ry: 50 }, color: c.sage, opacity: 0.7 },
    ] })}
  ${bloom({ cx: 330, cy: 330, rx: 50, ry: 34 }, c.mint, 0.55)}
  ${bloom({ cx: 600, cy: 300, rx: 40, ry: 26 }, c.mint, 0.4)}
`);
