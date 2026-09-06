// C&F — Mudah.my rental source.
//
// Two stages, on purpose.
//
// 1. FUNNEL. search.mudah.my is a plain JSON API with no key and no bot wall.
//    It returns rent, size, beds, baths, area and building name for every
//    listing, ~8.4k of them for KL. We pull the lot and filter locally rather
//    than trusting their query params: several documented filters
//    (price_min, size_min, rooms) are silently ignored by the API, so a
//    server-side filter would look like it worked while quietly returning
//    everything. Local filtering also means changing the brief costs nothing.
//
// 2. DETAIL. The funnel has no photos. Mudah's image CDN needs a per-image
//    hash we cannot compute, so the urls have to be read off the listing page,
//    which sits behind Cloudflare and blocks plain fetch. Playwright gets
//    through. We only ever run this on listings that already survived the
//    funnel, so it is a few hundred pages, not eight thousand.
//
// The detail stage is best-effort by design: if Cloudflare blocks us the
// listing still ships with price, size and area, just without photos. A
// listing with no photo is worth less than one with photos, but far more than
// no listing at all.

const fs = require('fs');
const path = require('path');
const { clean, text, num, sleep, UA } = require('./_shape');

// Enrichment is expensive and the answers barely change, so both passes cache
// to disk and are committed with the feed. This is what keeps the nightly run
// cheap and what makes a rate-limited run recoverable instead of wasted.
const DETAILS = path.join(__dirname, 'details.json');
const CACHE = path.join(__dirname, 'buildings.json');
// Cloudflare hands out a clearance cookie once it is satisfied. Keeping it
// between runs means we get challenged less often. Deliberately NOT committed
// (see .gitignore) — it is a per-machine token, not project data.
const STATE = path.join(__dirname, '.browser-state.json');

async function context(chromium) {
  const b = await chromium.launch({ headless: true });
  const opts = { userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'en-US' };
  if (fs.existsSync(STATE)) opts.storageState = STATE;
  const ctx = await b.newContext(opts);
  // Images and fonts are pure weight: we want urls out of the page data, not
  // the pixels. Blocking them roughly halves the run.
  await ctx.route('**/*', r => {
    const t = r.request().resourceType();
    return (t === 'image' || t === 'font' || t === 'media') ? r.abort() : r.continue();
  });
  return { b, ctx };
}
async function closeContext({ b, ctx }) {
  try { await ctx.storageState({ path: STATE }); } catch (e) {}
  await b.close();
}

// details.json is committed, so it must not grow without bound. Well past what
// a live feed needs, drop anything that has fallen out of the current feed.
function prune(cache, live) {
  const keys = Object.keys(cache);
  if (keys.length <= 4000) return cache;
  const keep = new Set(live.map(a => String(a.list_id)));
  for (const k of keys) if (!keep.has(k)) delete cache[k];
  return cache;
}

function loadJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return {}; }
}
function saveJson(f, o) { fs.writeFileSync(f, JSON.stringify(o, null, 1)); }

const REGION_KL = 9;          // verified against the API, not guessed
const CAT_CONDO = 2020;       // Apartment / Condominium
const PAGE = 200;             // the API accepts this; 9000 is the ceiling on `from`

// Cast wider than the brief so the app can loosen a filter without a re-fetch.
// The tight numbers Fares actually wants live in the UI, where they are
// editable. This is just the net.
const NET = {
  rentMin: 2500,
  rentMax: 5200,
  bedsMin: 2,
  sizeMin: 900,
};

// Mudah rate-limits hard. Six workers with an 80ms gap got 7 pages through and
// was refused 593 times; the numbers below are what actually survives. The
// disk cache is what makes this viable: a nightly run only has to enrich
// listings it has never seen, so the expensive first pass happens once.
const DETAIL_CONCURRENCY = 2;
const DETAIL_GAP = 900;       // ms between page loads, per worker
const DETAIL_CAP = 220;       // new pages per run, so a cold start spreads over a few nights
const GIVE_UP_AFTER = 25;     // consecutive refusals before we stop bothering them

async function api(from) {
  const url = `https://search.mudah.my/v1/search?category=${CAT_CONDO}&type=let`
            + `&region=${REGION_KL}&limit=${PAGE}&from=${from}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`search API HTTP ${r.status}`);
  const j = await r.json();
  return (j.data || []).map(x => x.attributes);
}

async function funnel() {
  const rows = [];
  for (let from = 0; from < 9000; from += PAGE) {
    const batch = await api(from);
    if (!batch.length) break;
    rows.push(...batch);
    await sleep(120);
  }
  if (!rows.length) throw new Error('search API returned nothing at all');

  return rows.filter(a =>
    a.monthly_rent >= NET.rentMin &&
    a.monthly_rent <= NET.rentMax &&
    num(a.rooms_name) >= NET.bedsMin &&
    num(a.size) >= NET.sizeMin
  );
}

// ---- stage 2: photos + description, via a real browser -------------------

function browser() {
  try { return require('playwright').chromium; }
  catch (e) { return null; }
}

async function detailPass(rows, log) {
  const chromium = browser();
  const cache = loadJson(DETAILS);
  const found = new Map();

  // Anything already enriched is free. Only pay for what is new.
  let cached = 0;
  for (const a of rows) {
    const hit = cache[a.list_id];
    if (hit) { found.set(a.list_id, hit); cached++; }
  }

  if (!chromium) {
    log(`playwright not installed, ${cached} from cache, no new photos`);
    return found;
  }

  const targets = rows.filter(a => !cache[a.list_id]).slice(0, DETAIL_CAP);
  if (!targets.length) {
    log(`detail pass: ${cached} from cache, nothing new to fetch`);
    return found;
  }
  let blocked = 0, streak = 0, stopped = false;

  const session = await context(chromium);
  const ctx = session.ctx;

  const queue = targets.slice();
  const worker = async () => {
    const page = await ctx.newPage();
    while (queue.length && !stopped) {
      const a = queue.shift();
      try {
        await page.goto(a.adview_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const nd = await page.evaluate(() => {
          const e = document.getElementById('__NEXT_DATA__');
          return e ? e.textContent : null;
        });
        if (!nd) { blocked++; streak++; if (streak >= GIVE_UP_AFTER) stopped = true; continue; }
        const d = JSON.parse(nd);
        const byId = ((d.props || {}).initialState || {}).adDetails;
        const at = byId && byId.byID && byId.byID[a.list_id] && byId.byID[a.list_id].attributes;
        if (!at) { blocked++; streak++; if (streak >= GIVE_UP_AFTER) stopped = true; continue; }
        streak = 0;
        let transit = '';
        for (const blk of at.descriptionParams || [])
          for (const p of blk.params || [])
            if (p.id === 'railway_station') transit = p.realValue || '';
        const rec = {
          imgs: at.imageHd || at.image || [],
          desc: at.body || '',
          transit,
          buildingUrl: at.buildingUrl || '',
        };
        found.set(a.list_id, rec);
        cache[a.list_id] = rec;
      } catch (e) {
        blocked++; streak++;
        if (streak >= GIVE_UP_AFTER) stopped = true;
      }
      await sleep(DETAIL_GAP + Math.random() * 400);
    }
    await page.close();
  };

  await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));
  await closeContext(session);
  saveJson(DETAILS, prune(cache, rows));
  log(`detail pass: ${cached} cached + ${found.size - cached} new, ${blocked} refused`
      + (stopped ? ` (backed off after ${GIVE_UP_AFTER} in a row — they are rate-limiting, next run picks up where this stopped)` : ''));
  return found;
}


// ---- stage 3: building completion year ------------------------------------
//
// Fares' hardest filter is building age: he wants roughly a 3-year-old
// building, not a 15-year-old one. Nothing in the listing carries that, but
// Mudah keeps a page per building with a Completion Year field.
//
// Buildings barely change, and many listings share one, so this is cached on
// disk and each building is fetched at most once ever. A building whose page
// leaves the field blank stays null. null means UNKNOWN and the app says so —
// we never infer a year, because a wrong year would silently filter out a
// place he would have liked, or let through one he would not.

async function buildingPass(rows, extra, log) {
  const chromium = browser();
  const cache = loadJson(CACHE);

  // Unique building pages we still know nothing about.
  const wanted = new Map();
  for (const a of rows) {
    const url = (extra.get(a.list_id) || {}).buildingUrl;
    if (!url || !a.building_id) continue;
    if (Object.prototype.hasOwnProperty.call(cache, a.building_id)) continue;
    if (!wanted.has(a.building_id)) wanted.set(a.building_id, url);
  }

  if (chromium && wanted.size) {
    const session = await context(chromium);
    const ctx = session.ctx;
    const queue = [...wanted.entries()];
    const worker = async () => {
      const page = await ctx.newPage();
      while (queue.length) {
        const [id, url] = queue.shift();
        let year = null;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const txt = await page.evaluate(() => document.body ? document.body.innerText : '');
          const m = txt.match(/Completion Year\s*([12]\d{3})/i);
          if (m) {
            const y = parseInt(m[1], 10);
            // Sanity band. A "completion year" outside this is a parse error,
            // not a building, and must not become a filter input.
            if (y >= 1950 && y <= new Date().getFullYear() + 6) year = y;
          }
        } catch (e) { /* leave null, try again on a future run */ }
        cache[id] = year;
        await sleep(700 + Math.random() * 300);
      }
      await page.close();
    };
    await Promise.all(Array.from({ length: 2 }, worker));
    await closeContext(session);
    saveJson(CACHE, cache);
  }

  const known = Object.values(cache).filter(v => v != null).length;
  log(`buildings: ${Object.keys(cache).length} known, ${known} with a completion year`);
  return cache;
}

// ---- assembly ------------------------------------------------------------

async function fetchListings(log = () => {}) {
  const rows = await funnel();
  log(`funnel: ${rows.length} of the KL condo rentals match the net`);

  // Newest first, so the detail cap spends its budget on fresh listings
  // rather than whatever the search index felt like returning.
  rows.sort((x, y) => (y.list_ts || 0) - (x.list_ts || 0));

  let extra = new Map();
  try {
    extra = await detailPass(rows, log);
  } catch (e) {
    log(`detail pass failed entirely (${e.message}), shipping without photos`);
  }

  let years = {};
  try {
    years = await buildingPass(rows, extra, log);
  } catch (e) {
    log(`building pass failed (${e.message}), ages will read as unknown`);
  }

  return clean(rows.map(a => {
    const x = extra.get(a.list_id) || {};
    return {
      ref: String(a.list_id),
      title: a.subject,
      url: a.adview_url,
      rent: a.monthly_rent,
      beds: num(a.rooms_name),
      baths: num(a.bathroom_name),
      size: num(a.size),
      area: a.subarea_name,
      building: a.building_name || '',
      builtYear: Number.isInteger(years[a.building_id]) ? years[a.building_id] : null,
      imgs: x.imgs || [],
      desc: x.desc || '',
      transit: x.transit || '',
      agent: a.name || '',
      listedAt: (a.date || '').slice(0, 10),
    };
  }));
}

module.exports = { id: 'mudah', name: 'Mudah.my', fetchListings };
