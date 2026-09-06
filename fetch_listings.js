#!/usr/bin/env node
// C&F — build listings.js from every source in listings/.
// Zero-spend: no keys, no paid tiers.
//
// Same hard rule as the events feed: a broken source must never quietly empty
// the list. If a source throws we keep what it gave us last time and exit
// non-zero so the run actually goes red, instead of reporting success over an
// empty file.

const fs = require('fs');
const path = require('path');
// Explicit /index.js: the output file is listings.js and the source folder is
// listings/, and Node resolves './listings' to the FILE. Requiring the folder
// loosely pulls in the data file we are about to overwrite.
const SOURCES = require('./listings/index.js');

const OUT = path.join(__dirname, 'listings.js');
const log = m => console.error(m);

function readExisting() {
  try {
    const m = fs.readFileSync(OUT, 'utf8').match(/^window\.CF_LISTINGS=([\s\S]*);\s*$/);
    const j = JSON.parse(m[1]);
    return Array.isArray(j.listings) ? j.listings : [];
  } catch (e) { return []; }
}

(async () => {
  const previous = readExisting();
  const failed = [];
  const kept = [];

  for (const src of SOURCES) {
    try {
      const got = await src.fetchListings(m => log(`[${src.id}] ${m}`));
      kept.push(...got.map(l => ({ ...l, src: src.id })));
      log(`${src.name}: ${got.length}`);
    } catch (err) {
      const stale = previous.filter(l => l.src === src.id);
      kept.push(...stale);
      failed.push(`${src.name} (${err.message})`);
      log(`${src.name}: FAILED, reusing ${stale.length} from last run — ${err.message}`);
    }
  }

  // Never lose enrichment we already paid for. The listing sites rate-limit
  // the photo/description pass, so a run can legitimately come back with the
  // right listings and no pictures. Without this, one throttled night would
  // strip photos off the whole feed and the app would look broken.
  const prior = new Map(previous.map(l => [l.src + '|' + l.ref, l]));
  for (const l of kept) {
    const was = prior.get(l.src + '|' + l.ref);
    if (!was) continue;
    if (!(l.imgs || []).length && (was.imgs || []).length) l.imgs = was.imgs;
    if (!l.desc && was.desc) l.desc = was.desc;
    if (!l.transit && was.transit) l.transit = was.transit;
    if (l.builtYear == null && was.builtYear != null) l.builtYear = was.builtYear;
  }

  // The same unit listed twice by one agency, or by two sources. Keep the
  // first, which is registry order, but prefer the entry that actually has
  // photos — a duplicate with pictures is more useful than one without.
  const seen = new Map();
  for (const l of kept) {
    const key = (l.src + '|' + l.ref).toLowerCase();
    const dupe = (l.building + '|' + l.rent + '|' + l.size + '|' + l.beds).toLowerCase();
    const k = l.ref ? key : dupe;
    const cur = seen.get(k);
    if (!cur || ((l.imgs || []).length > (cur.imgs || []).length)) seen.set(k, l);
  }
  const listings = [...seen.values()].sort((a, b) => (a.rent - b.rent));

  if (!listings.length) {
    log('REFUSING TO WRITE: every source failed and there is nothing to fall back on.');
    process.exit(1);
  }

  const withPix = listings.filter(l => (l.imgs || []).length).length;
  const withYear = listings.filter(l => l.builtYear).length;

  fs.writeFileSync(OUT, 'window.CF_LISTINGS=' + JSON.stringify({
    fetchedAt: new Date().toISOString(),
    sources: SOURCES.map(s => ({ id: s.id, name: s.name })),
    listings,
  }) + ';');

  log(`WROTE ${listings.length} listings (${withPix} with photos, ${withYear} with a build year)`);
  if (failed.length) {
    log(`\nSOURCE FAILURES: ${failed.join('; ')}`);
    log('Feed was preserved from the last good run, but fix this.');
    process.exit(1);
  }
})();
