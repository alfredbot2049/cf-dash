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

// Prices, start times and sold-out status come from the JSON endpoint that
// Eventbrite's own site calls. No key, no auth.
//
// The browse-page JSON-LD has no `offers` and the event HTML has no price in
// it at all, which is why this looked impossible at first. This endpoint has
// all of it. Takes up to 10 event ids per call, so we chunk.
const DEST = 'https://www.eventbrite.com/api/v3/destination/events/';

const idFromUrl = u => (String(u).match(/-tickets-(\d+)/) || [])[1] || null;

async function details(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const url = `${DEST}?event_ids=${chunk.join(',')}&expand=ticket_availability`;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!r.ok) { await sleep(500); continue; }
      const j = await r.json();
      for (const e of (j.events || [])) out.set(String(e.id), e);
    } catch (err) { /* this chunk keeps whatever we already knew */ }
    await sleep(500);
  }
  return out;
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

  // Second pass: real prices and times. If it fails we still return the
  // listings, just without price rather than with a wrong one.
  const out = [...seen.values()];
  const byId = new Map();
  for (const ev of out) {
    const id = idFromUrl(ev.url);
    if (id) byId.set(id, ev);
  }
  const got = await details([...byId.keys()]);
  for (const [id, ev] of byId) {
    const d = got.get(id);
    if (!d) continue;
    const ta = d.ticket_availability || {};
    const min = ta.minimum_ticket_price;
    if (ta.is_free === true) { ev.price = 0; ev.tier = 'free'; ev.cur = (min && min.currency) || ''; }
    else if (min && min.major_value != null) {
      ev.price = Number(min.major_value);
      ev.cur = min.currency || '';
      ev.tier = ev.price > 0 ? 'paid' : 'free';
      const max = ta.maximum_ticket_price;
      // Show a range only when the top tier really costs more.
      if (max && Number(max.major_value) > ev.price) ev.priceMax = Number(max.major_value);
    }
    if (ta.is_sold_out) ev.soldOut = true;
    if (d.start_time) ev.start = d.start_time.slice(0, 5);
    if (d.end_time) ev.end = d.end_time.slice(0, 5);
    if (d.summary && !ev.desc) ev.desc = d.summary;
  }
  return out;
}

module.exports = { id: 'eventbrite', name: 'Eventbrite', fetchEvents };
