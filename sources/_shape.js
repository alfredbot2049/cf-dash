// C&F — the common event shape every source must return.
//
// Adding a new source (Ticketmaster, Eventbrite, whatever) means writing one
// file in this folder that exports { id, name, fetchEvents } and listing it in
// index.js. Nothing else in the app needs to change.
//
//   id     short slug, used for dedupe + the source chip in the UI
//   name   human label shown in the app
//   fetchEvents()  async, returns an array of the shape below.
//                  Throw on failure. Do NOT return [] to signal an error —
//                  the runner treats [] as "this source is genuinely empty"
//                  and an exception as "this source broke", and those are
//                  handled differently.
//
// Event shape:
//   name    string, required
//   date    'YYYY-MM-DD', required
//   venue   string, required (events with no real place get dropped)
//   url     string, link to the event page
//   img     string, poster url or ''
//   cat     string, category label e.g. 'Music'
//   price   number | null  — the actual amount, null if we cannot get it
//   tier    'free' | 'paid' | null — what the app filters on
//   cur     string, currency code e.g. 'MYR', '' if unknown
//   src     string, set by the runner from the source id
//
// price and tier are separate on purpose. Some sources tell you an event is
// paid without telling you how much (Eventbrite), and inventing a number to
// fill the gap would show a wrong ticket price. tier drives the filter chips,
// price is only rendered when we actually know it.

// Keep only events that are upcoming, in a real venue, and not an online-only
// listing. Shared by every source so the rules stay in one place.
const ONLINE = /webinar|online|virtual|zoom|livestream|live stream/i;

// Descriptions arrive as HTML from both sources. Strip it here rather than in
// the app: the app renders these into innerHTML, so letting raw third-party
// markup through would be an injection hole on a page holding their data.
function text(s, max) {
  if (!s) return '';
  return String(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function clean(events, today) {
  const out = [];
  for (const e of events) {
    if (!e || !e.name || !e.date || !e.venue) continue;
    if (e.date < today) continue;
    if (ONLINE.test(e.name + ' ' + e.venue)) continue;
    out.push({
      name: String(e.name).trim(),
      date: e.date,
      venue: String(e.venue).trim().slice(0, 60),
      url: e.url || '',
      img: e.img || '',
      cat: e.cat || 'Event',
      price: typeof e.price === 'number' ? e.price : null,
      tier: e.tier || (typeof e.price === 'number' ? (e.price > 0 ? 'paid' : 'free') : null),
      cur: e.cur || '',
      // detail-view extras, all optional
      desc: text(e.desc, 700),
      addr: text(e.addr, 160),
      start: e.start || '',        // 'HH:MM' local
      end: e.end || '',
      lat: e.lat || null,
      lon: e.lon || null,
      age: e.age || null,
      tickets: Array.isArray(e.tickets) ? e.tickets.slice(0, 12) : null,
    });
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

module.exports = { clean, sleep, UA, ONLINE, text };
