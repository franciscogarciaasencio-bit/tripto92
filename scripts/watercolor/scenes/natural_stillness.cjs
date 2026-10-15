// Natural Rhythm (Levels 116–120): the tide curling in under a low sun, as it always returns.
module.exports = ({ form, stroke, paper, PALETTE: c }) => paper(`
  ${form({ cx: 620, cy: 380, rx: 236, ry: 236 }, c.sun, {
    texture: 'still1', shades: [
      { shape: { cx: 560, cy: 300, rx: 160, ry: 140 }, color: c.paper, opacity: 0.85, wide: true },
      { shape: { cx: 720, cy: 480, rx: 150, ry: 130 }, color: c.tan, opacity: 0.6, wide: true },
    ] })}
  ${form('M96 760 C92 600 180 430 360 392 C520 360 650 430 668 540 C680 610 640 664 576 668 C520 672 488 632 500 590 C456 600 444 650 474 690 C560 730 740 700 900 690 C960 700 960 800 900 840 C780 920 300 930 150 870 C110 850 98 810 96 760 Z', c.water, {
    texture: 'wash2', shades: [
      { shape: { cx: 520, cy: 900, rx: 520, ry: 170 }, color: c.deep, opacity: 0.85, wide: true },
      { shape: { cx: 300, cy: 520, rx: 170, ry: 110 }, color: c.mist, opacity: 0.8, wide: true },
    ] })}
  ${form('M470 400 C580 390 668 450 668 540 C668 610 624 652 572 652 C530 652 504 622 512 590 C548 600 590 586 604 552 C620 500 580 450 510 446 C470 444 432 458 404 478 C414 434 436 406 470 400 Z', c.foam, {
    texture: 'still2', shades: [{ shape: { cx: 630, cy: 590, rx: 60, ry: 60 }, color: c.mist, opacity: 0.7 }] })}
  ${stroke('M170 780 C280 750 390 770 500 800 C640 834 790 812 880 780', c.foam, 13, 0.85)}
  ${stroke('M250 856 C380 838 500 856 610 872 C700 884 790 872 840 856', c.mist, 10, 0.75)}
  ${stroke('M170 620 C220 576 280 562 340 570', c.foam, 10, 0.75)}
`);
