# Sound milestone browser evidence

12 October 2026, before technical consolidation. These four PNGs are actual React
Native web renders, not native screenshots or mockups: settings-ambience.png,
settings-bells.png, session-sound.png and completion.png.

Browser tests used isolated SQLite storage and a test clock, preserving user data.
Playback checks covered decoded environments/bells, edited preview volumes/fades,
exclusive previews, preference reload, single start/end, live source changes, pause,
resumed timeline at 180 active seconds after a ten-minute pause, ending resonance
across Completion/Home, no recovery replay, Silence and Ending Off without a fallback.

This is playback-event/position evidence, not perceived sound quality or native behavior.
Current automatic checks and physical-device limits are described in docs/AUDIO.md.
