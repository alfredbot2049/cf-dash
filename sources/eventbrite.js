// C&F — Eventbrite (KL markets, workshops, food things, meetups).
//
// Scrapes the JSON-LD that Eventbrite server-renders into its browse pages.
// There is no usable free API: Eventbrite shut public event search off in 2020
// and their API now only returns events you own.
//
// KNOWN LIMITATION, do not treat a failure here as a code bug:
// Eventbrite blocks datacenter IPs. From a normal machine this returns ~45
// events; from a GitHub Actions runner every request comes back 405 and this
// source yields nothing. That is why it throws instead of returning [] — the
// runner then keeps the last good Eventbrite events rather than silently
// wiping the feed, which is exactly what used to happen.

const { clean, sleep, UA } = require('./_shape');

const CATS = [
  ['', 'Event'],
  ['music--', 'Music'],
  ['performing-arts--', 'Arts'],
  ['food-and-drink--', 'Food'],
  ['arts--', 'Arts'],
  ['nightlife--', 'Nightlife'],
];

// Eventbrite's browse JSON-LD carries no `offers` and their event pages no
// longer expose price anywhere in the HTML (checked 2026-07-28). The one
// reliable free/paid signal left is their own `free--events` filter, so we
// pull that separately and treat "listed there" as free, "not listed" as paid.
async function freeNames() {
  const names = new Set();
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`https://www.eventbrite.com/d/malaysia--kuala-lumpur/free--events/?page=${page}`,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
    if (!r.ok) break;
    const found = parse(await r.text(), 'Event');
    if (!found.length) break;
    for (const e of found) names.add(e.name.trim().toLowerCase());
    await sleep(400);
  }
  return names;
}

function parse(html, catLabel) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const out = [];
  for (const b of blocks) {
    let j; try { j = JSON.parse(b); } catch (e) { continue; }
    const arr = Array.isArray(j) ? j : (j.itemListElement ? j.itemListElement.map(x => x.item || x) : [j]);
    for (const e of arr) {
      if (!e || e['@type'] !== 'Event' || !e.name || !e.startDate) continue;
      const loc = e.location || {};
      const venue = loc.name || (loc.address && (loc.address.streetAddress || loc.address.addressLocality)) || '';
      const img = Array.isArray(e.image) ? e.image[0] : (typeof e.image === 'string' ? e.image : (e.image && e.image.url) || '');
      // JSON-LD offers give us free-vs-paid without a second request.
      const offers = [].concat(e.offers || []);
      const nums = offers.map(o => Number(o && o.price)).filter(n => Number.isFinite(n));
      const addr = loc.address || {};
      const geo = loc.geo || {};
      out.push({
        name: e.name,
        date: e.startDate.slice(0, 10),
        venue,
        url: (e.url || '').split('?')[0],
        img,
        cat: catLabel,
        price: nums.length ? Math.min(...nums) : null,
        cur: (offers[0] && offers[0].priceCurrency) || '',
        desc: e.description || '',
        addr: [addr.streetAddress, addr.addressLocality, addr.postalCode].filter(Boolean).join(', '),
        // startDate looks like 2026-07-30T20:00:00+08:00, so the clock time is
        // already local to KL. Slice rather than parse, which would drag it
        // through the viewer's timezone.
        start: (e.startDate.slice(11, 16) || ''),
        end: (e.endDate || '').slice(11, 16),
        lat: geo.latitude || null,
        lon: geo.longitude || null,
      });
    }
  }
  return out;
}

async function fetchEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Map();
  let blocked = 0;

  for (const [slug, label] of CATS) {
    const url = `https://www.eventbrite.com/d/malaysia--kuala-lumpur/${slug}events/`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
    if (!r.ok) { blocked++; await sleep(400); continue; }
    for (const ev of clean(parse(await r.text(), label), today)) {
      const key = (ev.name + '|' + ev.date).toLowerCase();
      if (!seen.has(key)) seen.set(key, ev);   // first category label wins
    }
    await sleep(400);
  }

  if (blocked === CATS.length) throw new Error(`eventbrite blocked us on all ${blocked} requests (datacenter IP?)`);

  // Second pass for free/paid. If this fails we still return the listings,
  // just with price unknown rather than wrong.
  let free = new Set();
  try { free = await freeNames(); } catch (e) { /* price stays null */ }
  const out = [...seen.values()];
  // We learn free-vs-paid but never the actual amount, so set `tier` only and
  // leave `price` null. Faking a number here would put a wrong ticket price in
  // front of you, which is worse than showing none.
  if (free.size) {
    for (const ev of out) ev.tier = free.has(ev.name.toLowerCase()) ? 'free' : 'paid';
  }
  return out;
}

module.exports = { id: 'eventbrite', name: 'Eventbrite', fetchEvents };
