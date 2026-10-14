# Sessions 2–3: progression design and simulations

## Research and design decisions

Lally et al.'s real-world study found wide individual variation in reported automaticity
and found one missed opportunity did not materially change its development. It studied
eating/drinking/activity choices, not Ona or meditation. Our design inference is to encourage
repeatable, manageable practice and allow returning after a break. Ona's timings are product
targets, not measurements of habit formation. [Original paper](https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674).

A later methodological review explains why frequency and self-reported automaticity must
be distinguished. Ona therefore measures recorded practice, not proven psychological habit
or meditation skill. [Gardner, Rebar & Lally](https://discovery.ucl.ac.uk/id/eprint/10144814/1/23311908.2022.pdf).

Headspace documents consecutive-session streaks and eight-hour-separated repeat sessions;
Calm offers daily sessions around ten minutes. These illustrate repetition and manageable
practice, not evidence that their progression formulas improve habits. Ona keeps its own
captured-date semantics, explicit six-hour gate and gentle momentum decay rather than a
resetting streak. No proprietary code, assets or formula was copied.
[Headspace](https://help.headspace.com/hc/en-us/articles/215730567-How-does-the-run-streak-feature-work),
[Calm](https://support.calm.com/hc/en-us/articles/115005140414-What-are-the-Calm-Dailies-Daily-Meditations-Movement).

We compared keeping V4's exponential growth (fast early, asymptotic late), keeping the
fourteen-day cosmetic score (different score from the bonus), and an exact contribution
model. The chosen V5 model has one score for reward and display: +1/60 per eligible practice,
maximum two per captured date and a six-hour separation after the earlier qualifying end.
It reaches full exactly at the requested 60/30-day targets and makes each eligible return
the same readable step. Five dots mark 12/24/36/48/60 contributions; the bar is continuous.

The four-day half-life remains a deliberately brisk recent-momentum metaphor, separate
from the much slower protected level decay. One missed day softens momentum without
destroying it. Long gaps begin rebuilding immediately. Duration rewards and level thresholds
remain unchanged: the actual new daily simulation still meets the 8–9 month target.

## Reproduce

`node scripts/simulate-progression-v5.cjs --write` compiles and runs shipped pure domain
functions. UTC sessions use stable IDs and actual timestamps; counts refer to calendar
days from first practice. Output is simulations.json, integer centi-Ripples. It exercises
daily, double, skipped Sundays, short, nearby, longer and inactive routines. No user DB
or guessed reward formula is involved. Legacy V4 simulation remains independently runnable.

| Routine | Full Consistency | Level 100 | Level 125 | 30-day Ripples |
| --- | --- | --- | --- | --- |
| 10 min daily | Day 60 | Day 272 | Day 375 | 2,648.00 |
| 10 min twice, 6h+ apart | Day 30 | Day 155 | Day 366 | 5,052.00 |
| 10 min, skip Sundays | Not reached in 500 days | Day 355 | Day 492 | 2,230.31 |
| 3 min daily | Day 60 | Day 473 | Not reached in 500 days | 1,498.11 |
| 1 min daily | Never qualifies | Level 0 | Level 0 | 452.70 |
| Nearby 10 + 10 min | Day 60 | Day 219 | Day 366 | 3,310.00 |
| 30 min daily | Day 60 | Day 197 | Day 366 | 3,697.27 |

Double/longer practice can advance faster, while Level 125 still needs 365 distinct
qualifying dates **and** 365 elapsed days; first possible day is 366 with these timestamps.
Everyday ten-minute practice reaches Level 100 after about nine months. A new three-minute
session earns 45.56 Ripples (46 displayed) and remains at Level 0; its base is unchanged.
After 60 daily sessions, four complete inactive dates leave Consistency about half full.
Three complete inactive dates preserve effective progression; the fourth applies the first
level-progress decay. After a year, the example retains its protected Level 16 from peak31.

## Historical continuity

V1–V4 definitions and award receipts remain intact. V5 starts prospectively with an
immutable activation identifying source version, explicit logical context and history prefix.
Settled V4 bonus momentum is carried into the new score, without re-awarding XP or resetting
achievements. Upgraded users consequently need not start from zero or take 60 further days.
New-user simulations above have no legacy migration seed. The old fourteen-day display
is retained only when presenting old completion endpoints; current V5 display uses real C.
