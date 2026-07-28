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

async function prices(eventId) {
  const r = await fetch(`${API}/v1/buyer/event-page/${eventId}/ticket-types/default`, {
    headers: { app_id: 'ticketmelon' },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const types = Array.isArray(j) ? j : (Array.isArray(j.message) ? j.message : []);
  const vals = types
    .filter(t => t && !t.is_hidden)
    .map(t => Number(t.price))
    .filter(n => Number.isFinite(n));
  return vals.length ? Math.min(...vals) : null;   // cheapest way in
}

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
  }));

  // Only price the ones we are actually going to show. 60-ish calls, spaced.
  const upcoming = clean(rows, today);
  const byName = new Map(rows.map(r => [r.name + '|' + r.date, r._id]));
  for (const ev of upcoming) {
    const id = byName.get(ev.name + '|' + ev.date);
    if (!id) continue;
    // clean() ran before we had prices, so set tier here as well as price.
    try {
      const p = await prices(id);
      if (p !== null) { ev.price = p; ev.tier = p > 0 ? 'paid' : 'free'; }
    } catch (e) { /* keep the listing, price just stays unknown */ }
    await sleep(120);
  }
  return upcoming;
}

module.exports = { id: 'ticketmelon', name: 'Ticketmelon', fetchEvents };
