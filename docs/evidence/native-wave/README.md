# Historical native wave evidence

On 11 October 2026, four PNGs (native-0.png through native-3.png) were captured from
the mounted Home SVG's **actual iPhone renderer** via Svg.toDataURL and the connected
Hermes inspector. The transparent wave viewport is 1206 × 306 pixels (402 × 102 points).

Capture times UTC: 14:22:42.142, 14:22:46.460, 14:22:50.568, 14:22:55.203.
The dark curve center moved between rows 248–251, 265–268, 234–237 and 212–214;
each later image differed from the first by over 19,000 pixels. Native shared phase
measured 18,002 ms against configured 18,000 ms. Reduce Motion was off.

These frames prove native path deformation in that release. Later amplitude/layout
changes, whole-screen pacing, Reduce Motion on, safe areas and navigation still require
physical-device observation. Superseded browser/milestone screenshots were removed
during consolidation; current policy is in docs/ONA_UI.md.
