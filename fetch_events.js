#!/usr/bin/env node
// C&F — fetch real Kuala Lumpur events from Eventbrite's public JSON-LD.
// Zero-spend, no API key. Writes app/events.js as `window.CF_EVENTS = [...]`.
// Run on a schedule to keep the What's On tab current.
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const CATS = [
  ['', 'Event'],
  ['music--', 'Music'],
  ['performing-arts--', 'Arts'],
  ['food-and-drink--', 'Food'],
  ['arts--', 'Arts'],
  ['nightlife--', 'Nightlife'],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseEvents(html, catLabel) {
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
      out.push({
        name: String(e.name).trim(),
        date: e.startDate.slice(0, 10),
        venue: String(venue).trim().slice(0, 60),
        url: (e.url || '').split('?')[0],
        img: img || '',
        cat: catLabel,
      });
    }
  }
  return out;
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Map();
  for (const [slug, label] of CATS) {
    const url = `https://www.eventbrite.com/d/malaysia--kuala-lumpur/${slug}events/`;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
      if (!r.ok) { process.stderr.write(`x(${r.status})`); continue; }
      const html = await r.text();
      for (const ev of parseEvents(html, label)) {
        if (ev.date < today) continue;                       // upcoming only
        if (!ev.venue) continue;                              // must have a real place
        if (/webinar|online|virtual|zoom|masterclass online/i.test(ev.name + ' ' + ev.venue)) continue;
        const key = (ev.name + '|' + ev.date).toLowerCase();
        if (!seen.has(key)) seen.set(key, ev);               // dedupe, keep first (category-specific label wins by order)
      }
      process.stderr.write('.');
    } catch (e) { process.stderr.write('X'); }
    await sleep(400);
  }
  const events = [...seen.values()].sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 45);
  const payload = { fetchedAt: new Date().toISOString(), events };
  const outPath = path.join(__dirname, "events.js");
  fs.writeFileSync(outPath, 'window.CF_EVENTS=' + JSON.stringify(payload) + ';');
  console.error(`\nWROTE ${events.length} events -> ${outPath}`);
})();
