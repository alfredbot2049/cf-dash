// C&F — Ticketmelon (KL gigs, club nights, concerts).
//
// Uses the same endpoint their own website calls. No key, no signup, no cost.
// Found via window.__GLOBAL_CONFIG__.API_HOST on any ticketmelon.com page —
// note it is api-frontend.ticketmelon.com, NOT api.ticketmelon.com (that host
// exists but 403s everything and the site never calls it).
//
// Two calls:
//   1. /v1/buyer/home-page/events        all published events, one shot, ~5MB
//   2. /v1/buyer/event-page/{id}/ticket-types/default   prices, per event
//
// Call 2 needs the header `app_id: ticketmelon`. That is a public constant
// from the same __GLOBAL_CONFIG__, not a credential. If it ever starts
// rejecting us we lose prices but keep the listings.

const { clean, sleep } = require('./_shape');

const API = 'https://api-frontend.ticketmelon.com';
const KL_TZ = 'Asia/Kuala_Lumpur';

// epoch ms -> 'YYYY-MM-DD' in KL local time, not UTC. A 9pm KL gig is already
// the next day in UTC, and showing it on the wrong day is exactly the kind of
// thing that gets you standing outside a closed venue.
const klDate = ms => new Intl.DateTimeFormat('en-CA', {
  timeZone: KL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(ms));

// Returns every visible ticket type, so the app can show the real price list
// rather than just "from RM40".
async function tickets(eventId) {
  const r = await fetch(`${API}/v1/buyer/event-page/${eventId}/ticket-types/default`, {
    headers: { app_id: 'ticketmelon' },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const types = Array.isArray(j) ? j : (Array.isArray(j.message) ? j.message : []);
  const out = types
    .filter(t => t && !t.is_hidden && Number.isFinite(Number(t.price)))
    .map(t => ({ name: String(t.name || 'Ticket').trim().slice(0, 40), price: Number(t.price) }));
  return out.length ? out : null;
}

const klTime = ms => new Intl.DateTimeFormat('en-GB', {
  timeZone: KL_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(ms));

async function fetchEvents() {
  const r = await fetch(`${API}/v1/buyer/home-page/events`);
  if (!r.ok) throw new Error(`ticketmelon list HTTP ${r.status}`);
  const j = await r.json();
  const all = Array.isArray(j.message) ? j.message : [];
  if (!all.length) throw new Error('ticketmelon returned no events at all');

  const today = klDate(Date.now());
  const my = all.filter(e =>
    e && e.timezone && e.timezone.country === KL_TZ && e.show_starttime > 0
  );

  const rows = my.map(e => ({
    _id: e.event_id,
    name: String(e.name || '').trim(),   // trimmed here so the byName key below
                                         // matches what clean() produces
    date: klDate(e.show_starttime),
    venue: (e.venue && e.venue.name) || '',
    url: e.eo_slug && e.slug ? `https://www.ticketmelon.com/${e.eo_slug}/${e.slug}` : '',
    img: e.img_poster || e.img_banner || '',
    cat: (Array.isArray(e.categories) && e.categories[0]) || 'Event',
    cur: (e.currency && e.currency.code) || 'MYR',
    desc: e.description || '',
    addr: (e.venue && e.venue.address) || '',
    lat: (e.venue && e.venue.latitude) || null,
    lon: (e.venue && e.venue.longitude) || null,
    start: klTime(e.show_starttime),
    end: e.show_endtime > 0 ? klTime(e.show_endtime) : '',
    age: e.age_restriction || e.custom_age_restriction || null,
  }));

  // Only price the ones we are actually going to show. 60-ish calls, spaced.
  const upcoming = clean(rows, today);
  const byName = new Map(rows.map(r => [r.name + '|' + r.date, r._id]));
  for (const ev of upcoming) {
    const id = byName.get(ev.name + '|' + ev.date);
    if (!id) continue;
    // clean() ran before we had prices, so set these here as well.
    try {
      const t = await tickets(id);
      if (t) {
        const p = Math.min(...t.map(x => x.price));
        ev.tickets = t;
        ev.price = p;
        ev.tier = p > 0 ? 'paid' : 'free';
      }
    } catch (e) { /* keep the listing, price just stays unknown */ }
    await sleep(120);
  }
  return upcoming;
}

module.exports = { id: 'ticketmelon', name: 'Ticketmelon', fetchEvents };
