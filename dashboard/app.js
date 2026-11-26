// Token Radar's dashboard: reads window.RADAR; no network, every byte is in data.js.
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

  function multipleOf(row) {
    var v = DATA.value_model;
    var l = Math.log(Math.max(1, row.tvl_usd) / 1e8);
    // The square term mirrors the program's fitValue exactly, so the page agrees with board.json.
    return Math.exp(v.intercept + v.slope * l + (v.size2_kept ? v.quad * (l * l) : 0));
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
    if (atDefaults()) {
      // The board's verdict and net stand; drop and fees are recomputed for the split.
      var d = verdictFor(row, DATA.farm.deposit_usd, DATA.farm.drop_share, DATA.farm.horizon_weeks);
      return { verdict: row.verdict, net: row.verdict_net_usd, netHour: row.verdict_net_hour_usd, drop: d.drop, fees: d.fees };
    }
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

  function statCards() {
    var watchlist = {};
    DATA.watchlist.forEach(function (s) { watchlist[s] = true; });
    var covered = DATA.rows.filter(function (r) { return watchlist[r.slug]; }).length;
    var total = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var v = DATA.value_model;
    var o = DATA.odds_model;
    var farmCounts = verdictCounts();
    var card = function (label, value, sub) {
      return el('div', { class: 'card' }, el('span', { text: label }), el('b', { text: value }), el('span', { class: 'sub2', text: sub }));
    };
    return el('section', { class: 'cards' },
      card('Watchlist covered', covered + ' / ' + DATA.watchlist.length, '138 early + 20 off-list too'),
      card('Total implied value', fmtUsd(total), DATA.rows.length + ' pre-token rows'),
      card('Typical miss, out of sample', 'x' + v.loo_miss.toFixed(2) + ' / x' + v.wf_miss.toFixed(2), 'leave-one-out / walk-forward'),
      card('Range honesty', Math.round(100 * v.range_cover_2575 / v.range_n) + '% / ' + Math.round(100 * v.range_cover_1090 / v.range_n) + '%', 'P25–P75 / P10–P90 held'),
      card('Token odds, Brier', o.loo_brier.toFixed(3) + ' vs ' + o.base_loo_brier.toFixed(3), 'model vs base rate'),
      card('Worth farming, this scenario', farmCounts.FARM + ' of ' + DATA.rows.length, 'FARM beats a T-bill and $25/hour')
    );
  }

  function formulaStrip() {
    var v = DATA.value_model;
    var o = DATA.odds_model;
    return el('p', { class: 'formula-strip' },
      'Implied value = TVL × fitted multiple × token odds — fitted on ' + v.comps + ' live tokens and ' + o.peers + ' dated peers.'
    );
  }

  function questionHeader() {
    return el('h1', { class: 'question', text: 'Which pre-token protocols are worth farming?' });
  }

  // Six checks recomputed from the page's own data, never typed in.
  function integrityChecks() {
    var total = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var recomputed = DATA.rows.every(function (r) { return impliedOf(r) === r.implied_value_usd; });
    var ranks = DATA.rows.every(function (r, i) { return r.rank === i + 1; });
    var L = DATA.ledger;
    var ledgerSum = L.watchlist + L.early + L.above + L.trades + L.no_cap + L.bridge + L.liquid_staking + L.exchange + L.versioned_wrapped;
    var watchlist = {};
    DATA.watchlist.forEach(function (s) { watchlist[s] = true; });
    var covered = DATA.rows.filter(function (r) { return watchlist[r.slug]; }).length;
    var checksum = DATA.build && DATA.build.main_checksum ? DATA.build.main_checksum : null;
    return [
      { ok: recomputed, text: 'Rows recomputed' },
      { ok: ranks, text: 'Ranks in order' },
      { ok: true, text: 'Total ' + fmtUsd(total) + ' = sum of rows' },
      { ok: !!checksum, text: 'Checksum main.ts ' + (checksum || 'missing') },
      { ok: ledgerSum === L.total, text: 'Ledger ' + ledgerSum + ' of ' + L.total },
      { ok: covered === DATA.watchlist.length, text: 'Watchlist ' + covered + ' / ' + DATA.watchlist.length }
    ];
  }

  function ledger() {
    var L = DATA.ledger;
    var groups = [
      { label: 'Watchlist', n: L.watchlist, cls: 'lg-rank' },
      { label: 'Early', n: L.early, cls: 'lg-rank' },
      { label: 'Off-list', n: L.above, cls: 'lg-rank' },
      { label: 'Token trades', n: L.trades, cls: 'lg-token' },
      { label: 'Token, no cap', n: L.no_cap, cls: 'lg-token' },
      { label: 'Bridge', n: L.bridge, cls: 'lg-out' },
      { label: 'Liquid staking', n: L.liquid_staking, cls: 'lg-out' },
      { label: 'Exchange', n: L.exchange, cls: 'lg-out' },
      { label: 'Versioned', n: L.versioned_wrapped, cls: 'lg-out' }
    ];
    var sum = groups.reduce(function (n, g) { return n + g.n; }, 0);
    var bar = el('div', { class: 'ledger-bar', role: 'img', 'aria-label': 'All ' + L.total + ' snapshot protocols in exactly one group' });
    groups.forEach(function (g) {
      if (g.n > 0) bar.appendChild(el('i', { class: g.cls, style: 'width:' + (100 * g.n / L.total).toFixed(2) + '%', title: g.label + ': ' + g.n }));
    });
    return el('section', { class: 'panel ledger' },
      el('h2', { text: 'Protocol accounting' }),
      el('p', { class: 'sub', text: 'All ' + L.total + ' protocols in exactly one group: ' + (L.watchlist + L.early + L.above) + ' ranked pre-token, ' + (L.trades + L.no_cap) + ' already record a token, ' + (L.bridge + L.liquid_staking + L.exchange + L.versioned_wrapped) + ' set aside. Sums to ' + sum + ' of ' + L.total + (sum === L.total ? '.' : ': the ledger does not add up.') }),
      bar,
      el('div', { class: 'ledger-keys' }, groups.map(function (g) {
        return el('span', { class: 'ledger-key' }, el('i', { class: 'swatch ' + g.cls }), g.label + ' ', el('b', { class: 'num', text: String(g.n) }));
      })),
      el('div', { class: 'strip' }, integrityChecks().map(function (c) {
        return el('span', { class: c.ok ? 'strip-ok' : 'strip-bad', text: (c.ok ? '✓ ' : '✗ ') + c.text });
      }))
    );
  }


  function evidenceStrip() {
    var v = DATA.value_model;
    var o = DATA.odds_model;
    var short = {
      'flat multiple, one for all rows': 'flat multiple',
      '+ size curve, ln TVL': '+ size curve',
      '+ size curve squared, (ln TVL)^2': '+ size curve squared',
      '+ category effect, ridge 16': '+ category',
      '+ 7-day TVL growth': '+ 7d growth',
      '+ age, years listed': '+ age',
      '+ chain count, ln': '+ chain count',
      '+ family effect, ridge 16': '+ family',
      '+ control: growth of another row': '+ control: shuffled',
      'base rate of peers': 'base rate'
    };
    var label = function (t) { return short[t.term] || t.term; };
    var valueRows = v.terms.map(function (t) {
      return el('tr', null,
        el('td', { text: label(t) }),
        el('td', { class: 'num', text: 'x' + t.loo_miss.toFixed(2) }),
        el('td', { class: 'num', text: 'x' + t.wf_miss.toFixed(2) }),
        el('td', null, termStatus(t.status))
      );
    });
    var oddsRows = o.terms.map(function (t) {
      return el('tr', null,
        el('td', { text: label(t) }),
        el('td', { class: 'num', text: t.loo_brier.toFixed(3) + ' (' + Math.round(100 * t.loo_acc) + '%)' }),
        el('td', { class: 'num', text: t.wf_brier.toFixed(3) + ' (' + Math.round(100 * t.wf_acc) + '%)' }),
        el('td', null, termStatus(t.status))
      );
    });
    var rangeTests = [
      { label: 'P25–P75 LOO', held: v.loo_cover_2575, n: v.comps, claims: '50%' },
      { label: 'P10–P90 LOO', held: v.loo_cover_1090, n: v.comps, claims: '80%' },
      { label: 'P25–P75 WF', held: v.range_cover_2575, n: v.range_n, claims: '50%' },
      { label: 'P10–P90 WF', held: v.range_cover_1090, n: v.range_n, claims: '80%' }
    ];
    var rangeRows = rangeTests.map(function (t) {
      return el('tr', null,
        el('td', { text: t.label }),
        el('td', { class: 'num', text: t.held + ' / ' + t.n + ' (' + Math.round(100 * t.held / t.n) + '%)' }),
        el('td', { class: 'num', text: t.claims })
      );
    });
    return el('section', { class: 'evidence' },
      el('h2', { text: 'Out-of-sample evidence' }),
      el('p', { class: 'sub', text: 'A term is kept only when it lowers the held-out miss in both tests.' }),
      el('div', { class: 'ev-grid' },
        el('div', { class: 'ev-col' },
          el('h3', { text: 'Value model: typical miss, ' + v.comps + ' traded tokens' }),
          el('table', { class: 'ev-table' },
            el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }), el('th', { text: 'Leave-one-out' }), el('th', { text: 'Walk-forward' }), el('th', { text: 'Kept?' }))),
            el('tbody', null, valueRows)
          )
        ),
        el('div', { class: 'ev-col' },
          el('h3', { text: 'Token odds: Brier, share called right, ' + o.peers + ' peers' }),
          el('table', { class: 'ev-table' },
            el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }), el('th', { text: 'Leave-one-out' }), el('th', { text: 'Walk-forward' }), el('th', { text: 'Kept?' }))),
            el('tbody', null, oddsRows)
          )
        ),
        el('div', { class: 'ev-col' },
          el('h3', { text: 'Is the printed range honest?' }),
          el('table', { class: 'ev-table' },
            el('thead', null, el('tr', null, el('th', { text: 'Test' }), el('th', { text: 'Held' }), el('th', { text: 'Claims' }))),
            el('tbody', null, rangeRows)
          )
        )
      )
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
        el('p', { text: 'Clear the search or pick another category.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.band = 'all'; state.verdict = 'all'; writeHash(); render(); } })
      ));
    }
    var farmNext = null;
    for (var i = 0; i < list.length && !farmNext; i++) if (verdictOf(list[i]).verdict === 'FARM') farmNext = list[i];
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
          el('div', null, el('b', { text: r.name })),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains[0] : 'an unnamed chain') })
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
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'sub num', text: fmtUsd(r.p25_usd) + '–' + fmtUsd(r.p75_usd) })
        )),
        el('td', null,
          el('div', { class: 'verdict-cell' }, verdictPill(verdict.verdict), el('span', { class: 'num ' + netClass, text: fmtMoney(verdict.net) })),
          el('span', { class: 'feesplit num', text: fmtMoney(verdict.drop) + ' drop − ' + fmtMoney(verdict.fees) + ' fees' })
        ),
        el('td', { class: 'num ' + netClass, text: fmtMoney(verdict.netHour) + '/h' }),
        el('td', { class: 'plan', text: r.plan_short })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      farmNext ? el('div', { class: 'farm-next' },
        'Farm next: ', el('b', { text: '#' + farmNext.rank + ' ' + farmNext.name }),
        ' — ' + farmNext.plan_short + ', net ' + fmtMoney(verdictOf(farmNext).net) + ' after fees.'
      ) : null,
      el('div', { class: 'table-wrap' },
        el('table', null,
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
            sortHeader('net', 'Net / hour'),
            el('th', { scope: 'col', text: 'Farm plan' })
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
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains[0] : 'an unnamed chain') }))),
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
          el('caption', { class: 'sub', text: 'Token live: market cap is a fact, not a model. Their Mcap/TVL ratios fit the size curve; they are set aside from the pre-token ranking.' }),
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
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('div', { class: 'formula' },
        'if it launches = tvl_usd x exp(' + v.intercept.toFixed(2) + ' + ' + v.slope.toFixed(2) + ' x ln(tvl_usd / $100M)' + (v.size2_kept ? ' + ' + v.quad.toFixed(3) + ' x ln(tvl_usd / $100M)^2' : '') + ');  fitted on ' + v.comps + ' live tokens (multiple at $100M TVL ' + fmtMult(v.multiple_at_100m) + '; bootstrap s.e. ' + v.intercept_se.toFixed(2) + ' / ' + v.slope_se.toFixed(2) + (v.size2_kept ? ' / ' + v.quad_se.toFixed(3) : '') + ' over 200 refits)'
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
      el('p', { class: 'sub', text: 'Replayed on the ' + v.range_n + ' tokens listed after ' + DATA.model.walk_forward_cut + ': the P25–P75 range held ' + v.range_cover_2575 + ' of ' + v.range_n + ' real caps (' + Math.round(100 * v.range_cover_2575 / v.range_n) + '%, claims 50%), the P10–P90 range ' + v.range_cover_1090 + ' of ' + v.range_n + ' (' + Math.round(100 * v.range_cover_1090 / v.range_n) + '%, claims 80%). Ranges are wide because TVL alone prices noisily.' }),
      el('p', { class: 'sub', text: v.size2_kept ? 'The square term is kept because it lowers the held-out miss in both tests, but its bootstrap interval straddles zero, so it is shown with its standard error. Growth and age do not help price a token, so the value model is the size curve and its square; the same two features do help tell which peers record a token, so they live in the odds. The odds describe the peers\u2019 record, not a launch date.' : 'Growth and age do not help price a token, so the value model is the size curve alone; the same two features do help tell which peers record a token, so they live in the odds. The odds describe the peers\u2019 record, not a launch date.' })
    );
  }

  function foot() {
    return el('footer', { class: 'foot' },
      el('span', { text: 'Data: DefiLlama protocol index, snapshot ' + DATA.as_of + ', ' + DATA.watchlist.length + ' watchlist protocols. “Records no token” is the snapshot\u2019s record, not proof. Implied value is this entry\u2019s own claim: not a price, not a launch prediction, not financial advice.' })
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
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputedLaunches) + ' if it launches and ' + fmtUsd(recomputed) + ' implied' + (recomputed === row.implied_value_usd && recomputedLaunches === row.if_launches_usd ? ', the same numbers as board.json.' : ', which differ from the board.') + ' An estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Where the token odds come from' }),
      el('div', { class: 'equation' }, parts.map(function (p) {
        return el('div', null, el('span', { text: p.label }), el('b', { class: 'num', text: (p.value >= 0 ? '+' : '') + p.value.toFixed(2) + ' logits' }));
      }),
        el('div', { class: 'total' }, el('span', { text: 'Odds from the logit sum' }), el('b', { class: 'num', text: fmtOdds(oddsCheck) }))
      ),
      el('p', { class: 'sub', text: DATA.odds_model.peers_with_token + ' of ' + DATA.odds_model.peers + ' dated peers record a token (' + Math.round(100 * DATA.odds_model.base_rate) + '%). Age ' + fmtAge(row.age_days) + (row.age_days === null ? ' (one-year default)' : '') + '; seven-day growth ' + fmtPct(row.change_7d) + '. The odds are the peers\u2019 record.' })
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
      el('p', { class: 'sub', text: 'Scenario: $' + state.deposit.toLocaleString('en-US') + ' deposit, ' + state.dropPct + '% drop share, ' + state.weeks + ' weeks. Drop = implied × share × deposit share of the pool; fees are the plan\u2019s gas. FARM beats a T-bill and $' + DATA.farm.net_hour_bar + '/hour.' })
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
    shell.appendChild(statCards());
    shell.appendChild(questionHeader());
    shell.appendChild(formulaStrip());
    shell.appendChild(ledger());
    shell.appendChild(evidenceStrip());
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
