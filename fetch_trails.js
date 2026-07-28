#!/usr/bin/env node
// C&F — build trails.js: real hiking-trail geometry from OpenStreetMap.
// Zero-spend: no keys, no npm install, just Overpass and global fetch.
//
// The rule that matters here: never draw a line that is not in OSM. A hike
// with no mapped trail comes out as source:"none" with empty segs, because a
// made-up polyline on a map is worse than a blank one — you would drive to it.
//
// Overpass is a free volunteer service. We sleep between queries, send a
// descriptive User-Agent and retry once on 429/504 so this stays welcome.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OUT = path.join(__dirname, 'trails.js');
const HIKES = path.join(__dirname, 'hikes.js');
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const UA = 'cf-dash-trail-fetch/1.0 (personal hiking dashboard; contact via repo)';

const POLITE_MS = 3000;
const RETRIES = 5;
const MAX_NETWORK_WAYS = 60;
const JOIN_M = 25;        // two ways count as connected if endpoints are this close
const NEAR_TRAILHEAD_M = 500; // named geometry further than this misses the car park
const MAX_SEG_POINTS = 150; // above this a segment gets simplified, see simplify()

// ---------- load hikes ----------

// hikes.js is a browser file (window.CF_HIKES = ...). Run it in a vm sandbox
// with a fake window rather than regex-scraping it, so the file stays the one
// source of truth and edits there flow through without touching this script.
function loadHikes() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(HIKES, 'utf8'), sandbox, { filename: 'hikes.js' });
  const db = sandbox.window.CF_HIKES;
  if (!db || !Array.isArray(db.hikes) || !db.hikes.length) {
    throw new Error('hikes.js did not define window.CF_HIKES.hikes');
  }
  return db.hikes;
}

// A query that 504s looks identical in the output to a hike with no trail
// mapped. It is not the same thing, so rather than blanking a trail we already
// had, reuse the previous run's geometry and exit non-zero. Same rule as
// fetch_events.js: a broken fetch must never quietly empty the file.
function readExisting() {
  try {
    const m = fs.readFileSync(OUT, 'utf8').match(/^window\.CF_TRAILS = ([\s\S]*);\s*$/);
    return JSON.parse(m[1]).trails || {};
  } catch (e) { return {}; }
}

// ---------- geo helpers ----------

const R = 6371000;
const rad = d => (d * Math.PI) / 180;

function haversine(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Perpendicular distance in metres from p to the segment a-b, in a local flat
// projection. Fine at these latitudes over a few km.
function perpDist(p, a, b) {
  const kx = Math.cos(rad(p[0])) * 111320;
  const ky = 110540;
  const px = p[1] * kx, py = p[0] * ky;
  const ax = a[1] * kx, ay = a[0] * ky;
  const bx = b[1] * kx, by = b[0] * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ---------- name matching ----------

// Generic hill/trail words carry no identifying information: "Bukit Saga" and
// "Saga Trail" are the same hill. Strip them so a partial match still lands,
// but keep the remaining token set strict enough that "Broga" does not match
// an unrelated "Broga Village Road".
const GENERIC = new Set([
  'trail', 'trails', 'track', 'path', 'route', 'loop', 'hill', 'hills',
  'bukit', 'gunung', 'gunong', 'mount', 'mt', 'mountain', 'peak', 'summit',
  'forest', 'park', 'eco', 'the', 'of', 'and', 'jalan', 'lorong', 'to',
  'west', 'east', 'north', 'south', 'falls', 'waterfall', 'waterfalls',
  'air', 'terjun', 'sungai', 'recreational', 'reserve', 'main', 'new', 'old',
]);

function tokens(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Distinctive tokens only: what is left after the generic words go.
function keyTokens(s) {
  const t = tokens(s).filter(w => !GENERIC.has(w) && w.length > 2);
  return new Set(t);
}

// A way matches the hike if it shares at least one distinctive token. Hike
// names in hikes.js carry parenthetical aliases ("(Mount Ophir)", "(Bukit
// Nanas)") which are themselves valid OSM names, so those tokens count too.
function nameMatches(hikeKeys, wayName) {
  if (!hikeKeys.size) return false;
  const wk = keyTokens(wayName);
  for (const t of wk) if (hikeKeys.has(t)) return true;
  return false;
}

// ---------- overpass ----------

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 429 = rate limited, 504 = the server gave up mid-query. Both are transient
// and both are common on the public endpoint at busy times. One retry was not
// enough: a first run lost four hikes to 504 alone, and every one of them
// turned out to have perfectly good OSM data. Since a failed query is
// indistinguishable in the output from "no trail mapped here", give up slowly.
async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt) await sleep(POLITE_MS * 4 * attempt); // back off further each time
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
        },
        body: 'data=' + encodeURIComponent(query),
      });
    } catch (err) {
      lastErr = err;
      continue;
    }
    if (res.status === 429 || res.status === 504) {
      lastErr = new Error(`Overpass HTTP ${res.status}`);
      continue;
    }
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    return res.json();
  }
  throw lastErr || new Error('Overpass failed after retries');
}

// bbox radius: the bigger trails genuinely run further from the car park, so
// scale off `dist` where hikes.js has it rather than using one blunt number.
function radiusKm(h) {
  if (typeof h.dist === 'number' && h.dist > 0) {
    const r = h.dist * 0.45;
    return Math.max(2.5, Math.min(6, r));
  }
  return h.tier <= 2 ? 2.5 : 3;
}

function bboxAround(lat, lon, km) {
  const dLat = km / 110.574;
  const dLon = km / (111.320 * Math.cos(rad(lat)));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
}

function queryFor(h) {
  const [s, w, n, e] = bboxAround(h.lat, h.lon, radiusKm(h));
  const f = v => v.toFixed(5);
  return `[out:json][timeout:90];
way["highway"~"^(path|footway|track|steps)$"](${f(s)},${f(w)},${f(n)},${f(e)});
out geom;`;
}

// ---------- selection ----------

function wayPoints(el) {
  return (el.geometry || []).filter(g => g && g.lat != null).map(g => [g.lat, g.lon]);
}

function closestApproach(pts, lat, lon) {
  let best = Infinity;
  for (const p of pts) {
    const d = haversine(p, [lat, lon]);
    if (d < best) best = d;
  }
  return best;
}

// Grow a connected walkable network out from the way nearest the trailhead.
// This is the fallback for unnamed trails: OSM often maps the path but leaves
// the name off, and the thing a hiker actually wants is "what can I walk from
// the car park", which is exactly the connected component.
function buildNetwork(ways, lat, lon) {
  let seed = -1;
  let seedDist = Infinity;
  ways.forEach((w, i) => {
    const d = closestApproach(w.pts, lat, lon);
    if (d < seedDist) { seedDist = d; seed = i; }
  });
  // A "nearest" way 1km from the car park is not this trail, it is whatever
  // else happened to be in the box.
  if (seed < 0 || seedDist > 400) return [];

  const chosen = new Set([seed]);
  const endpoints = [];
  const addEnds = i => {
    const p = ways[i].pts;
    endpoints.push(p[0], p[p.length - 1]);
  };
  addEnds(seed);

  let grew = true;
  while (grew && chosen.size < MAX_NETWORK_WAYS) {
    grew = false;
    for (let i = 0; i < ways.length && chosen.size < MAX_NETWORK_WAYS; i++) {
      if (chosen.has(i)) continue;
      const p = ways[i].pts;
      const ends = [p[0], p[p.length - 1]];
      let touches = false;
      for (const e of ends) {
        for (const x of endpoints) {
          if (haversine(e, x) <= JOIN_M) { touches = true; break; }
        }
        if (touches) break;
      }
      if (touches) {
        chosen.add(i);
        addEnds(i);
        grew = true;
      }
    }
  }
  return [...chosen].map(i => ways[i]);
}

// ---------- simplification ----------

// Douglas-Peucker. Overpass returns full survey detail; at the zoom this map
// draws at, sub-10m wiggle is invisible but it is most of the bytes. The file
// ships to a browser on mobile data, so long segments get thinned.
function simplify(pts, tolM) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tolM) return [pts[0], pts[pts.length - 1]];
  const left = simplify(pts.slice(0, idx + 1), tolM);
  const right = simplify(pts.slice(idx), tolM);
  return left.slice(0, -1).concat(right);
}

// 5 decimals is ~1m, far finer than any trail needs and it halves the bytes
// against raw OSM precision.
const round5 = pts => pts.map(p => [
  Math.round(p[0] * 1e5) / 1e5,
  Math.round(p[1] * 1e5) / 1e5,
]);

// Drop consecutive duplicates left behind by rounding.
function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

function toSegments(ways, tolM) {
  const segs = [];
  for (const w of ways) {
    let pts = w.pts;
    if (pts.length > MAX_SEG_POINTS) pts = simplify(pts, tolM);
    pts = dedupe(round5(pts));
    if (pts.length >= 2) segs.push(pts);
  }
  return segs;
}

function bboxOf(segs) {
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
  for (const s of segs) for (const [la, lo] of s) {
    if (la < minLat) minLat = la;
    if (lo < minLon) minLon = lo;
    if (la > maxLat) maxLat = la;
    if (lo > maxLon) maxLon = lo;
  }
  if (minLat === Infinity) return null;
  return { minLat, minLon, maxLat, maxLon };
}

const countPts = segs => segs.reduce((n, s) => n + s.length, 0);

// ---------- main ----------

(async () => {
  const hikes = loadHikes();
  const previous = readExisting();
  const trails = {};
  const rows = [];
  const failures = [];

  for (let i = 0; i < hikes.length; i++) {
    const h = hikes[i];
    if (i) await sleep(POLITE_MS);

    let elements = [];
    try {
      const json = await overpass(queryFor(h));
      elements = json.elements || [];
    } catch (err) {
      failures.push(`${h.id} (${err.message})`);
      const stale = previous[h.id];
      if (stale && stale.segs && stale.segs.length) {
        trails[h.id] = stale;
        const pts = countPts(stale.segs);
        rows.push({ id: h.id, source: stale.source, ways: stale.ways, points: pts, stale: true });
        console.error(`${h.id}: QUERY FAILED (${err.message}) — reusing ${stale.ways} ways from last run`);
      } else {
        trails[h.id] = { segs: [], bbox: null, source: 'none', ways: 0 };
        rows.push({ id: h.id, source: 'none', ways: 0, points: 0 });
        console.error(`${h.id}: QUERY FAILED — ${err.message}, and nothing to fall back on`);
      }
      continue;
    }

    const ways = elements
      .map(el => ({ id: el.id, name: (el.tags && el.tags.name) || '', pts: wayPoints(el) }))
      .filter(w => w.pts.length >= 2);

    const hikeKeys = keyTokens(h.name);
    let picked = ways.filter(w => w.name && nameMatches(hikeKeys, w.name));
    let source = 'name-match';

    if (!picked.length) {
      picked = buildNetwork(ways, h.lat, h.lon);
      source = picked.length ? 'network' : 'none';
    } else {
      // A named match can be real and still be the wrong part of the hike.
      // Gunung Datuk only has its summit ridge named; the climb up from the
      // car park is unnamed, so name-match alone drew a fragment 2.9km from
      // where you actually park. When nothing named comes near the trailhead,
      // add the connected network too so the approach is on the map.
      const nearest = Math.min(...picked.map(w => closestApproach(w.pts, h.lat, h.lon)));
      if (nearest > NEAR_TRAILHEAD_M) {
        const net = buildNetwork(ways, h.lat, h.lon);
        if (net.length) {
          const have = new Set(picked.map(w => w.id));
          picked = picked.concat(net.filter(w => !have.has(w.id)));
          source = 'name-match+network';
        }
      }
    }

    const segs = picked.length ? toSegments(picked, 6) : [];
    if (!segs.length) source = 'none';

    trails[h.id] = {
      segs,
      bbox: bboxOf(segs),
      source,
      ways: segs.length,
    };
    const pts = countPts(segs);
    rows.push({ id: h.id, source, ways: segs.length, points: pts });
    console.error(`${h.id}: ${ways.length} ways in box, ${segs.length} kept via ${source}, ${pts} points`);
  }

  let payload = { fetchedAt: new Date().toISOString(), trails };
  let body = 'window.CF_TRAILS = ' + JSON.stringify(payload) + ';\n';

  // Second pass if we blew the budget: tighten the tolerance rather than
  // dropping trails, so every hike keeps its shape, just coarser.
  const LIMIT = 600 * 1024;
  if (Buffer.byteLength(body) > LIMIT) {
    console.error(`over ${LIMIT} bytes, re-simplifying at 15m`);
    for (const id of Object.keys(trails)) {
      const t = trails[id];
      if (!t.segs.length) continue;
      t.segs = t.segs.map(s => (s.length > MAX_SEG_POINTS ? dedupe(round5(simplify(s, 15))) : s))
        .filter(s => s.length >= 2);
      t.bbox = bboxOf(t.segs);
      t.ways = t.segs.length;
    }
    payload = { fetchedAt: payload.fetchedAt, trails };
    body = 'window.CF_TRAILS = ' + JSON.stringify(payload) + ';\n';
  }

  fs.writeFileSync(OUT, body);

  const withGeom = rows.filter(r => r.source !== 'none');
  const named = rows.filter(r => r.source.startsWith('name-match'));
  const net = rows.filter(r => r.source === 'network');
  const none = rows.filter(r => r.source === 'none');

  console.error('');
  console.error('id           strategy     ways  points');
  for (const r of rows) {
    console.error(`${r.id.padEnd(12)} ${r.source.padEnd(12)} ${String(r.ways).padStart(4)}  ${String(r.points).padStart(6)}${r.stale ? '  (stale, query failed)' : ''}`);
  }
  console.error('');
  console.error(`WROTE ${OUT} (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB)`);
  console.error(`${withGeom.length}/${rows.length} hikes have geometry: ${named.length} by name, ${net.length} by network fallback.`);
  console.error(`${none.length} with nothing${none.length ? ': ' + none.map(r => r.id).join(', ') : ''}`);
  if (failures.length) {
    console.error(`\nQUERY FAILURES: ${failures.join('; ')}`);
    process.exit(1);
  }
})();
