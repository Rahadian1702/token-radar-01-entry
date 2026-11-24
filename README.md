# token-radar-01-entry

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Rahadian1702/token-radar-01-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Rahadian1702/token-radar-01-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every pre-token protocol in the sealed DefiLlama snapshot, ranked by an implied value calibrated on the market caps of live tokens in the same category, with a concrete farm plan for each one. The board covers the whole 40-protocol watchlist plus 160 early pre-token protocols below the $50M floor, and the dashboard is a static page that renders with no network.

## The model (radar-2)

Implied value follows only from the snapshot's own figures. The multiple is not a flat guess: for each category it is the median market-cap-per-TVL of the live tokens in that category, clamped to [0.05, 1.5] and shrunk toward the global median with a prior of strength 3, so a thin category cannot set its own multiple from one observation. Categories with no live tokens take the global median.

```
multiple(category) = (n x median(mcap / tvl of live tokens in the category) + 3 x global_median) / (n + 3)
implied = round( tvl_usd x multiple(category) x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4) )
```

Growth is the protocol's seven-day TVL change; age is the time since it was first listed, the best record of how long it has run with no token. No protocol name is special-cased. The dashboard states every multiple with its comp count, recomputes each row in the page, and ships a what-if sandbox for the two weights.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22 or later, standard library only, no install. The program writes `board.json` (200 ranked rows), `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. Open `out/dashboard/index.html` to use the board; it needs `data.js` beside `dashboard/`.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the output.
- `lib/model.ts` — the radar-2 model, the calibration, the farm plans and the gate checks.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored byte for byte from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol detail view and a filtered view, captured from this dashboard.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
