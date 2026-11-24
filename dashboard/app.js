// Token Radar's dashboard (radar-4). It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, the ledger of all 758 protocols, the odds, ranges and farm verdicts,
// a per-protocol detail drawer, and the held-out tests behind both fitted models. No network: every
// byte it shows is in data.js. No outside address appears anywhere here.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', band: 'all', verdict: 'all', sort: 'implied', dir: -1, selected: null,
    deposit: DATA.farm.deposit_usd, dropPct: Math.round(DATA.farm.drop_share * 100), weeks: DATA.farm.horizon_weeks };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(0);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2) + 'x';
  }
  function fmtOdds(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return Math.round(n * 100) + '%';
  }

  // The page recomputes a row from the snapshot figures and the fitted coefficients, and checks the
  // numbers board.json carries, so the page's code and the board's data are the same arithmetic.
  function multipleOf(row) {
    var v = DATA.value_model;
    return Math.exp(v.intercept + v.slope * Math.log(Math.max(1, row.tvl_usd) / 1e8));
  }
  function ifLaunchesOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * multipleOf(row)));
  }
  function impliedOf(row) {
    return Math.max(1, Math.round(ifLaunchesOf(row) * row.token_odds));
  }
  function yearsOf(row) {
    return row.age_days === null || row.age_days === undefined ? DATA.model.unknown_age_years : row.age_days / 365;
  }
  function growthFracOf(row) {
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    return Math.min(DATA.model.growth_cap, Math.max(DATA.model.growth_floor, g)) / 100;
  }
  function logitParts(row) {
    var o = DATA.odds_model;
    return [
      { label: 'Base rate of peers', value: o.intercept },
      { label: 'Years listed', value: o.years_coef * yearsOf(row) },
      { label: 'Size, ln TVL', value: o.size_coef * Math.log(Math.max(1, row.tvl_usd) / 1e8) },
      { label: '7-day growth', value: o.growth_coef * growthFracOf(row) }
    ];
  }

  // The farm verdict, the same arithmetic as lib/model.ts verdictFor. At the stated defaults the
  // board's own verdict is shown; moved controls recompute it with this function.
  function gasDollars(chain) {
    return chain === 'Ethereum' ? { setup: 6, weekly: 3 } : { setup: 1, weekly: 1 };
  }
  function verdictFor(row, deposit, drop, weeks) {
    var d = row.implied_value_usd * drop * (deposit / row.tvl_usd);
    var g = gasDollars(row.chains && row.chains.length ? row.chains[0] : '');
    var fees = 2 * g.setup + weeks * g.weekly;
    var net = d - fees;
    var hours = (30 + 10 * weeks) / 60;
    var netHour = net / hours;
    var tbill = deposit * DATA.farm.tbill_rate * (weeks / 52);
    var v = net > 0 && netHour >= DATA.farm.net_hour_bar && net >= tbill ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
    return { verdict: v, net: net, netHour: netHour, drop: d, fees: fees };
  }
  function atDefaults() {
    return state.deposit === DATA.farm.deposit_usd && state.dropPct === Math.round(DATA.farm.drop_share * 100) && state.weeks === DATA.farm.horizon_weeks;
  }
  function verdictOf(row) {
    if (atDefaults()) return { verdict: row.verdict, net: row.verdict_net_usd, netHour: row.verdict_net_hour_usd, drop: null, fees: null };
    return verdictFor(row, state.deposit, state.dropPct / 100, state.weeks);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is not re-derived here: each row carries the six steps board.json holds, written
  // by the model's own derivation from the protocol's category, chains, TVL and age. The drawer
  // shows those steps verbatim, so the page and the board can never disagree on a plan.

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (state.band !== 'all' && r.band !== state.band) return false;
      if (state.verdict !== 'all' && verdictOf(r).verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function verdictCounts() {
    var c = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { c[verdictOf(r).verdict]++; });
    return c;
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'launches') { av = a.if_launches_usd; bv = b.if_launches_usd; }
      else if (key === 'net') { av = verdictOf(a).net; bv = verdictOf(b).net; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function countBy(list, keyFn) {
    var counts = {};
    list.forEach(function (r) { var k = keyFn(r); counts[k] = (counts[k] || 0) + 1; });
    return Object.keys(counts).map(function (k) { return { key: k, n: counts[k] }; }).sort(function (a, b) { return b.n - a.n || (a.key < b.key ? -1 : 1); });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    // Every headline fact is computed here from the rows, not carried: the coverage count is a count
    // of board rows on the watchlist, and the totals are sums over the board.
    var watchlist = {};
    DATA.watchlist.forEach(function (s) { watchlist[s] = true; });
    var covered = DATA.rows.filter(function (r) { return watchlist[r.slug]; }).length;
    var total = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var v = DATA.value_model;
    var o = DATA.odds_model;
    var keptValue = v.terms.filter(function (t) { return t.status === 'kept'; }).length;
    var keptOdds = o.terms.filter(function (t) { return t.status === 'kept'; }).length;
    // The scenario summary is live: it counts the rows whose farm verdict is FARM at the current
    // deposit, drop share and horizon, so it stays true when the reader moves the controls.
    var farmCounts = verdictCounts();
    return el('section', { class: 'lede' },
      el('div', null,
        el('div', { class: 'kicker', text: 'Pre-token protocols · ranked by implied value' }),
        el('h1', { text: 'Which token launch is worth farming next?' }),
        el('p', { text: 'Implied value is TVL times a fitted multiple — the value if a token launches — times token odds from the peers\u2019 own record. The house watchlist is the floor: ' + DATA.watchlist.length + ' pre-token protocols at or above $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL. The radar adds every other genuine pre-token protocol in the snapshot. It is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: covered + ' / ' + DATA.watchlist.length })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.rows.length) })),
        el('div', { class: 'fact' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(total) })),
        el('div', { class: 'fact' }, el('span', { text: 'Typical miss, out of sample' }), el('b', { text: 'x' + v.loo_miss.toFixed(2) + ' / x' + v.wf_miss.toFixed(2) })),
        el('div', { class: 'fact' }, el('span', { text: 'Range honesty, P25–P75 / P10–P90' }), el('b', { text: Math.round(100 * v.range_cover_2575 / v.range_n) + '% / ' + Math.round(100 * v.range_cover_1090 / v.range_n) + '%' })),
        el('div', { class: 'fact' }, el('span', { text: 'Token odds, Brier' }), el('b', { text: o.loo_brier.toFixed(3) + ' vs ' + o.base_loo_brier.toFixed(3) })),
        el('div', { class: 'fact' }, el('span', { text: 'Terms kept, both tests' }), el('b', { text: keptValue + ' of ' + (v.terms.length - 2) + ' · ' + keptOdds + ' of ' + (o.terms.length - 2) })),
        el('div', { class: 'fact' }, el('span', { text: 'Worth farming, this scenario' }), el('b', { text: farmCounts.FARM + ' of ' + DATA.rows.length }))
      )
    );
  }

  function ledger() {
    // The ledger is a partition, and the page proves it: the groups sum to the snapshot's protocol
    // count, each protocol in exactly one group.
    var L = DATA.ledger;
    var groups = [
      { label: 'Ranked · watchlist', n: L.watchlist, cls: 'lg-rank' },
      { label: 'Ranked · early, below the floor', n: L.early, cls: 'lg-rank' },
      { label: 'Ranked · off-list, above the floor', n: L.above, cls: 'lg-rank' },
      { label: 'Token trades', n: L.trades, cls: 'lg-token' },
      { label: 'Token recorded, no usable cap', n: L.no_cap, cls: 'lg-token' },
      { label: 'Set aside · bridge', n: L.bridge, cls: 'lg-out' },
      { label: 'Set aside · liquid staking', n: L.liquid_staking, cls: 'lg-out' },
      { label: 'Set aside · exchange', n: L.exchange, cls: 'lg-out' },
      { label: 'Set aside · versioned or wrapped', n: L.versioned_wrapped, cls: 'lg-out' }
    ];
    var sum = groups.reduce(function (n, g) { return n + g.n; }, 0);
    var bar = el('div', { class: 'ledger-bar', role: 'img', 'aria-label': 'All ' + L.total + ' snapshot protocols in exactly one group' });
    groups.forEach(function (g) {
      if (g.n > 0) bar.appendChild(el('i', { class: g.cls, style: 'width:' + (100 * g.n / L.total).toFixed(2) + '%', title: g.label + ': ' + g.n }));
    });
    return el('section', { class: 'panel ledger' },
      el('h2', { text: 'Protocol accounting' }),
      el('p', { class: 'sub', text: 'All ' + L.total + ' snapshot protocols in exactly one group: ' + (L.watchlist + L.early + L.above) + ' ranked as pre-token, ' + (L.trades + L.no_cap) + ' already record a token, ' + (L.bridge + L.liquid_staking + L.exchange + L.versioned_wrapped) + ' set aside by the house list\u2019s own rules. The groups sum to ' + sum + ' of ' + L.total + (sum === L.total ? ': every protocol is accounted for.' : ': the ledger does not add up.') }),
      bar,
      el('div', { class: 'ledger-keys' }, groups.map(function (g) {
        return el('span', { class: 'ledger-key' }, el('i', { class: 'swatch ' + g.cls }), g.label + ' ', el('b', { class: 'num', text: String(g.n) }));
      }))
    );
  }


  function tabButton(label, pressed, onclick) {
    return el('button', { type: 'button', 'aria-pressed': pressed ? 'true' : 'false', text: label, onclick: onclick });
  }

  function controls() {
    var categories = countBy(DATA.rows, function (r) { return r.category || 'Other'; }).map(function (c) { return c.key; });
    var chains = countBy(DATA.rows, function (r) { return (r.chains || [])[0] || 'Other'; }).map(function (c) { return c.key; });
    var counts = verdictCounts();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var deposit = el('select', { id: 'deposit', 'aria-label': 'Deposit for the farm verdict' },
      [100, 500, 1000, 5000, 10000].map(function (d) { return el('option', { value: String(d), text: '$' + d.toLocaleString('en-US'), selected: d === state.deposit ? 'selected' : null }); })
    );
    deposit.addEventListener('change', function () { state.deposit = parseInt(deposit.value, 10); render(); });
    var drop = el('input', { type: 'range', id: 'drop', min: '1', max: '20', step: '1', value: String(state.dropPct), 'aria-label': 'Share of the token drop that goes to farmers' });
    var dropOut = el('b', { class: 'num', text: state.dropPct + '%' });
    drop.addEventListener('input', function () { state.dropPct = parseInt(drop.value, 10); dropOut.textContent = drop.value + '%'; render(); });
    var weeks = el('input', { type: 'range', id: 'weeks', min: '4', max: '52', step: '1', value: String(state.weeks), 'aria-label': 'Farming horizon in weeks' });
    var weeksOut = el('b', { class: 'num', text: state.weeks + ' wk' });
    weeks.addEventListener('input', function () { state.weeks = parseInt(weeks.value, 10); weeksOut.textContent = weeks.value + ' wk'; render(); });
    return el('div', null,
      el('div', { class: 'controls' },
        el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
        el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
        el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
        el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' },
          tabButton('Pre-token', state.tab === 'pre-token', function () { state.tab = 'pre-token'; render(); }),
          tabButton('Live token', state.tab === 'live', function () { state.tab = 'live'; render(); })
        )),
        el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
      ),
      el('div', { class: 'controls farm-controls' },
        el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Board tier' }), el('div', { class: 'tabs' },
          tabButton('All tiers', state.band === 'all', function () { state.band = 'all'; render(); }),
          tabButton('Watchlist', state.band === 'watchlist', function () { state.band = 'watchlist'; render(); }),
          tabButton('Early', state.band === 'early', function () { state.band = 'early'; render(); }),
          tabButton('Off-list', state.band === 'above', function () { state.band = 'above'; render(); })
        )),
        el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Farm verdict' }), el('div', { class: 'tabs' },
          tabButton('Any verdict', state.verdict === 'all', function () { state.verdict = 'all'; render(); }),
          tabButton('Farm ' + counts.FARM, state.verdict === 'FARM', function () { state.verdict = 'FARM'; render(); }),
          tabButton('Marginal ' + counts.MARGINAL, state.verdict === 'MARGINAL', function () { state.verdict = 'MARGINAL'; render(); }),
          tabButton('Skip ' + counts.SKIP, state.verdict === 'SKIP', function () { state.verdict = 'SKIP'; render(); })
        )),
        el('div', { class: 'field' }, el('label', { for: 'deposit', text: 'Deposit' }), deposit),
        el('div', { class: 'field slider' }, el('label', { for: 'drop', text: 'Drop share to farmers' }), el('div', { class: 'slider-row' }, drop, dropOut)),
        el('div', { class: 'field slider' }, el('label', { for: 'weeks', text: 'Horizon' }), el('div', { class: 'slider-row' }, weeks, weeksOut)),
        atDefaults() ? null : el('button', { class: 'button', type: 'button', text: 'Reset farm scenario', onclick: function () { state.deposit = DATA.farm.deposit_usd; state.dropPct = Math.round(DATA.farm.drop_share * 100); state.weeks = DATA.farm.horizon_weeks; render(); } })
      )
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▾' : ' ▴' }) : null
      )
    );
  }

  function verdictPill(v) {
    return el('span', { class: 'verdict verdict-' + v.toLowerCase(), text: v === 'MARGINAL' ? 'Marginal' : v === 'FARM' ? 'Farm' : 'Skip' });
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.band = 'all'; state.verdict = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list.reduce(function (m, r) { return Math.max(m, r.implied_value_usd); }, 1);
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var verdict = verdictOf(r);
      var netClass = verdict.net >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'class': r.rank <= 3 ? 'top3' : null,
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', null, el('span', { class: 'rank-badge', text: String(r.rank) })),
        el('td', null, el('div', { class: 'name' },
          el('div', null, el('b', { text: r.name }), r.band === 'early' ? el('span', { class: 'tag-early', text: 'early' }) : r.band === 'above' ? el('span', { class: 'tag-above', text: 'off-list' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'odds' },
          el('div', { class: 'bar odds-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.round(r.token_odds * 100) + '%' })),
          el('span', { class: 'num', text: fmtOdds(r.token_odds) })
        )),
        el('td', { class: 'num', text: fmtUsd(r.if_launches_usd) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        ),
          el('span', { class: 'sub num', text: fmtUsd(r.p25_usd) + '–' + fmtUsd(r.p75_usd) })),
        el('td', null, el('div', { class: 'verdict-cell' }, verdictPill(verdict.verdict), el('span', { class: 'num ' + netClass, text: fmtMoney(verdict.net) }))),
        el('td', { class: 'num ' + netClass, text: fmtMoney(verdict.netHour) + '/h' })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. The verdict is net of fees at a $' + state.deposit.toLocaleString('en-US') + ' deposit, ' + state.dropPct + '% of the drop to farmers, ' + state.weeks + ' weeks. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('odds', 'Token odds'),
            sortHeader('launches', 'If it launches'),
            sortHeader('implied', 'Implied value · P25–P75'),
            sortHeader('net', 'Verdict · net'),
            sortHeader('net', 'Net / hour')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: fmtMult(r.mcap_tvl_ratio) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. Their market-cap-per-TVL ratios fit the size curve. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function termStatus(s) {
    if (s === 'kept') return el('span', { class: 'term-kept', text: 'kept' });
    if (s === 'baseline') return el('span', { class: 'term-base', text: 'baseline' });
    if (s === 'control') return el('span', { class: 'term-control', text: 'must not help' });
    return el('span', { class: 'term-not', text: 'tested, not kept' });
  }

  function modelPanel() {
    var v = DATA.value_model;
    var o = DATA.odds_model;
    var valueRows = v.terms.map(function (t) {
      return el('tr', null,
        el('td', null, el('div', null, el('b', { text: t.term }), el('div', { class: 'sub', text: t.reason }))),
        el('td', { class: 'num', text: 'x' + t.loo_miss.toFixed(2) }),
        el('td', { class: 'num', text: 'x' + t.wf_miss.toFixed(2) }),
        el('td', null, termStatus(t.status))
      );
    });
    var oddsRows = o.terms.map(function (t) {
      return el('tr', null,
        el('td', null, el('div', null, el('b', { text: t.term }), el('div', { class: 'sub', text: t.reason }))),
        el('td', { class: 'num', text: t.loo_brier.toFixed(3) + ' (' + Math.round(100 * t.loo_acc) + '%)' }),
        el('td', { class: 'num', text: t.wf_brier.toFixed(3) + ' (' + Math.round(100 * t.wf_acc) + '%)' }),
        el('td', null, termStatus(t.status))
      );
    });
    var curveRows = [5e6, 1e7, 1e8, 1e9, 1e10].map(function (tvl) {
      var mult = Math.exp(v.intercept + v.slope * Math.log(tvl / 1e8));
      return el('tr', null,
        el('td', { class: 'num', text: fmtUsd(tvl) + ' TVL' }),
        el('td', { class: 'num', text: fmtMult(mult) }),
        el('td', { class: 'num', text: fmtUsd(tvl * mult) })
      );
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by two fits on the snapshot\u2019s own record; no name is special-cased. A term is kept only when it lowers the held-out miss in both tests: leave-one-out, and walk-forward, where the tokens listed earlier price the ones listed later.' }),
      el('div', { class: 'formula' },
        'if it launches = tvl_usd x exp(' + v.intercept.toFixed(2) + ' + ' + v.slope.toFixed(2) + ' x ln(tvl_usd / $100M));  fitted on ' + v.comps + ' live tokens (multiple at $100M TVL ' + fmtMult(v.multiple_at_100m) + '; bootstrap s.e. ' + v.intercept_se.toFixed(2) + ' / ' + v.slope_se.toFixed(2) + ' over 200 refits)'
      ),
      el('div', { class: 'formula' },
        'token odds = 1 / (1 + exp(-(' + o.intercept.toFixed(2) + ' + ' + o.years_coef.toFixed(2) + ' x years listed + ' + o.size_coef.toFixed(2) + ' x ln(tvl_usd / $100M) + ' + o.growth_coef.toFixed(2) + ' x 7-day growth)));  fitted on ' + o.peers + ' dated peers, ' + o.peers_with_token + ' of which record a token'
      ),
      el('div', { class: 'formula' },
        'implied value = if it launches x token odds;  P25–P75 range = implied x [' + v.range_p25.toFixed(2) + ', ' + v.range_p75.toFixed(2) + '], from the value model\u2019s own leave-one-out residuals'
      ),
      el('h3', { text: 'Value model: typical multiplicative miss, ' + v.comps + ' traded tokens' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }), el('th', { text: 'Leave-one-out' }), el('th', { text: 'Walk-forward' }), el('th', { text: 'Kept?' }))),
        el('tbody', null, valueRows)
      ),
      el('h3', { text: 'Token odds: Brier score, share called right, ' + o.peers + ' peers' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }), el('th', { text: 'Leave-one-out' }), el('th', { text: 'Walk-forward' }), el('th', { text: 'Kept?' }))),
        el('tbody', null, oddsRows)
      ),
      el('h3', { text: 'Is the printed range honest?' }),
      el('p', { class: 'sub', text: 'Replayed on the ' + v.range_n + ' tokens listed after ' + DATA.model.walk_forward_cut + ', with the ranges set from the earlier tokens alone: the P25–P75 range held ' + v.range_cover_2575 + ' of ' + v.range_n + ' real caps (' + Math.round(100 * v.range_cover_2575 / v.range_n) + '%, the range claims 50%), and the P10–P90 range held ' + v.range_cover_1090 + ' of ' + v.range_n + ' (' + Math.round(100 * v.range_cover_1090 / v.range_n) + '%, claims 80%). The ranges are wide because pricing a token from TVL alone is noisy.' }),
      el('p', { class: 'sub', text: 'Growth and age do not help price a token, so the value model is the size curve alone; the same two features do help tell which peers record a token, so they live in the odds. The odds describe the peers\u2019 record, not a launch date — and a protocol that has run years with no token is the case the record describes least well.' }),
      el('h3', { text: 'The size curve, in numbers' }),
      el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Protocol size' }), el('th', { text: 'Fitted multiple' }), el('th', { text: 'Value if it launches' }))),
        el('tbody', null, curveRows)
      )
    );
  }

  function foot() {
    return el('footer', { class: 'foot' },
      el('span', { text: 'Data: DefiLlama protocol index, snapshot ' + DATA.as_of + ', ' + DATA.watchlist.length + ' watchlist protocols of 758 tracked at or above $5M TVL. The board says a protocol records no token, never that it has none: the snapshot is DefiLlama\u2019s record, not proof.' }),
      el('span', { text: 'Implied value is this entry\u2019s own claim from the snapshot\u2019s figures. It is not a price, not a prediction of a launch, and not financial advice.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = row.farm_steps;
    var recomputed = impliedOf(row);
    var recomputedLaunches = ifLaunchesOf(row);
    var parts = logitParts(row);
    var logitSum = parts.reduce(function (n, p) { return n + p.value; }, 0);
    var oddsCheck = 1 / (1 + Math.exp(-logitSum));
    var v = verdictFor(row, state.deposit, state.dropPct / 100, state.weeks);
    var shown = verdictOf(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.rows.length + (row.band === 'early' ? ' · early radar' : row.band === 'above' ? ' · above the floor, off the list' : ' · watchlist') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted multiple (size curve)' }), el('b', { class: 'num', text: fmtMult(multipleOf(row)) })),
        el('div', null, el('span', { text: 'Value if it launches' }), el('b', { class: 'num', text: fmtUsd(row.if_launches_usd) })),
        el('div', null, el('span', { text: 'Token odds (peers\u2019 record)' }), el('b', { class: 'num', text: fmtOdds(row.token_odds) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'P25–P75 range' }), el('b', { class: 'num', text: fmtUsd(row.p25_usd) + ' – ' + fmtUsd(row.p75_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same two fits score every protocol. The page recomputes this row as ' + fmtUsd(recomputedLaunches) + ' if it launches and ' + fmtUsd(recomputed) + ' implied' + (recomputed === row.implied_value_usd && recomputedLaunches === row.if_launches_usd ? ', the same numbers board.json carries.' : ', which differ from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Where the token odds come from' }),
      el('div', { class: 'equation' }, parts.map(function (p) {
        return el('div', null, el('span', { text: p.label }), el('b', { class: 'num', text: (p.value >= 0 ? '+' : '') + p.value.toFixed(2) + ' logits' }));
      }),
        el('div', { class: 'total' }, el('span', { text: 'Odds from the logit sum' }), el('b', { class: 'num', text: fmtOdds(oddsCheck) }))
      ),
      el('p', { class: 'sub', text: DATA.odds_model.peers_with_token + ' of ' + DATA.odds_model.peers + ' dated peers record a token (' + Math.round(100 * DATA.odds_model.base_rate) + '%). Age is ' + fmtAge(row.age_days) + ' on the record' + (row.age_days === null ? ', so the model uses its one-year default' : '') + '; seven-day growth ' + fmtPct(row.change_7d) + '. The odds are the peers\u2019 record, not a forecast.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm verdict' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Verdict at this scenario' }), verdictPill(shown.verdict)),
        el('div', null, el('span', { text: 'Expected drop' }), el('b', { class: 'num', text: fmtMoney(v.drop) })),
        el('div', null, el('span', { text: 'Fees (gas over ' + state.weeks + ' weeks)' }), el('b', { class: 'num', text: fmtMoney(v.fees) })),
        el('div', null, el('span', { text: 'Net of fees' }), el('b', { class: 'num', text: fmtMoney(shown.net) })),
        el('div', null, el('span', { text: 'Net per hour' }), el('b', { class: 'num', text: fmtMoney(shown.netHour) + '/h' }))
      ),
      el('p', { class: 'sub', text: 'Scenario: a $' + state.deposit.toLocaleString('en-US') + ' deposit, ' + state.dropPct + '% of the drop to farmers, ' + state.weeks + ' weeks. The drop is the implied value times the drop share times the deposit\u2019s share of the pool; the fees are the plan\u2019s gas. FARM beats a T-bill and $' + DATA.farm.net_hour_bar + ' an hour.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(ledger());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(foot());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
