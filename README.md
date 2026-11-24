# token-radar-01-entry

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Rahadian1702/token-radar-01-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Rahadian1702/token-radar-01-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every genuine pre-token protocol in the sealed DefiLlama snapshot, ranked by an implied value calibrated on the market caps of live tokens in the same category, with a concrete farm plan for each one. The board covers the whole 40-protocol watchlist plus 138 early pre-token protocols below the $50M floor and 19 above it that the watchlist leaves out — wrapped, staked and bridged products are excluded, since they have no token launch to rank — and the dashboard is a static page that renders with no network.

## The model (radar-3)

Implied value follows only from the snapshot's own figures, and it is now two fits, not one. The value fit prices a token if it launches: log(market cap / TVL) against log TVL on the snapshot's 128 live-token comps, a size curve — the market pays less per TVL dollar as protocols grow. The odds fit is a logistic regression on the 447 dated peers, giving the chance a protocol records a token at all, from how long it has run, its TVL and its seven-day growth. Implied value is the two together:

```
multiple(tvl) = exp(-1.84 - 0.48 x ln(tvl / $100M))
if_it_launches = tvl_usd x multiple(tvl)
odds = 1 / (1 + exp(-(-1.01 + 0.69 x years_listed + 0.22 x ln(tvl / $100M) - 2.49 x growth_7d)))
implied = round(if_it_launches x odds)
```

Growth is the seven-day TVL change as a fraction, clamped to [-0.6, 1.2]; age defaults to one year when the listing date is unknown. Every candidate term was tested and the page publishes the table: category, growth, age and chains were all tried in the value fit and kept out, because none lowers the held-out miss in both tests (leave-one-out, and walk-forward, where the tokens listed before 2025 price the ones listed after). The typical leave-one-out miss is about x3.4, against x4.8 for one flat multiple. Each row also carries a P25–P75 range from the leave-one-out residuals, and a farm verdict — FARM, MARGINAL or SKIP — scored net of fees at a stated deposit, drop share and horizon. The odds describe the peers' record, not a forecast: the page never says a token will launch. No protocol name is special-cased.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22 or later, standard library only, no install. The program writes `board.json` (197 ranked rows), `data.js`, `dashboard/` (including a generated `evidence.json` with the ledger, both models with their held-out tests, the top rows and the top farm plans, so the dossier carries real numbers), `screenshots/` and `dossier.json` to the output directory. Open `out/dashboard/index.html` to use the board; it needs `data.js` beside `dashboard/`.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the output.
- `lib/model.ts` — the radar-3 model, the odds and value fits, the ledger, the farm plans and the gate checks.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored byte for byte from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol detail view, a filtered view and the model panel, captured from this dashboard.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
