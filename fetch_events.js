#!/usr/bin/env node
// C&F — build events.js from every source in sources/.
// Zero-spend: no keys, no paid tiers, no npm install.
//
// The rule that matters here: a broken source must never quietly empty the
// feed. Before this, one bad run wrote {events:[]} over a good file and the
// job still reported success, so What's On sat empty for a week with a green
// tick next to it. Now a source that throws keeps its previous events and the
// run exits non-zero so it actually goes red.

const fs = require('fs');
const path = require('path');
const SOURCES = require('./sources');

const OUT = path.join(__dirname, 'events.js');

function readExisting() {
  try {
    const m = fs.readFileSync(OUT, 'utf8').match(/^window\.CF_EVENTS=([\s\S]*);\s*$/);
    const j = JSON.parse(m[1]);
    return Array.isArray(j.events) ? j.events : [];
  } catch (e) { return []; }
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const previous = readExisting();
  const failed = [];
  const kept = [];

  for (const src of SOURCES) {
    try {
      const got = await src.fetchEvents();
      kept.push(...got.map(e => ({ ...e, src: src.id })));
      console.error(`${src.name}: ${got.length}`);
    } catch (err) {
      // Fall back to whatever this source gave us last time, minus anything
      // that has since happened.
      const stale = previous.filter(e => e.src === src.id && e.date >= today);
      kept.push(...stale);
      failed.push(`${src.name} (${err.message})`);
      console.error(`${src.name}: FAILED, reusing ${stale.length} from last run — ${err.message}`);
    }
  }

  // Same gig listed by two sources: keep the first, which is registry order.
  const seen = new Map();
  for (const e of kept) {
    const key = (e.name + '|' + e.date).toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(key)) seen.set(key, e);
  }
  const events = [...seen.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!events.length) {
    console.error('REFUSING TO WRITE: every source failed and there is nothing to fall back on.');
    process.exit(1);
  }

  const free = events.filter(e => e.tier === 'free').length;
  const paid = events.filter(e => e.tier === 'paid').length;

  fs.writeFileSync(OUT, 'window.CF_EVENTS=' + JSON.stringify({
    fetchedAt: new Date().toISOString(),
    sources: SOURCES.map(s => ({ id: s.id, name: s.name })),
    events,
  }) + ';');

  console.error(`WROTE ${events.length} events (${free} free, ${paid} paid, ${events.length - free - paid} unclassified)`);
  if (failed.length) {
    console.error(`\nSOURCE FAILURES: ${failed.join('; ')}`);
    console.error('Feed was preserved from the last good run, but fix this.');
    process.exit(1);
  }
})();
