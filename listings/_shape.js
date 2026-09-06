// C&F — the common listing shape every rental source must return.
//
// Same contract as sources/_shape.js on the events side. To add a source
// (PropertyGuru, iProperty, EdgeProp, whatever) write one file in this folder
// exporting { id, name, fetchListings } and add a line to index.js. Nothing
// else in the app changes.
//
//   fetchListings()  async, returns an array of the shape below.
//                    Throw on failure. Do NOT return [] to signal an error —
//                    the runner treats [] as "genuinely nothing today" and an
//                    exception as "this source broke", and keeps the previous
//                    listings only in the second case.
//
// Listing shape:
//   ref       string, unique within the source (the site's own listing id)
//   title     string, required
//   url       string, required — the listing page
//   rent      number, required — MYR per month
//   beds      number | null
//   baths     number | null
//   size      number | null — sq ft
//   area      string, required — suburb, e.g. 'Mont Kiara'
//   building  string — condo/building name, '' if unknown
//   builtYear number | null — building completion year. null means UNKNOWN,
//             never a guess. The app greys these out rather than pretending.
//   imgs      [string] — photo urls, first is the cover
//   desc      string — plain text, HTML already stripped
//   transit   string — nearby station, '' if none
//   agent     string — listing agent or agency, '' if unknown
//   listedAt  'YYYY-MM-DD'
//   src       string, set by the runner from the source id

// The app renders these into innerHTML, so third-party markup must die here
// rather than in the browser. Same reasoning as the events feed.
function text(s, max) {
  if (!s) return '';
  return String(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const num = v => {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : n;
};

// Only https image urls make it through. A listing site that starts handing
// out javascript: or data: urls should not be able to put them in the app.
const img = u => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : null);

function clean(rows) {
  const out = [];
  for (const r of rows) {
    if (!r || !r.title || !r.url || !r.area) continue;
    const rent = num(r.rent);
    if (!rent) continue;                       // a rental with no rent is noise
    out.push({
      ref: String(r.ref || ''),
      title: text(r.title, 120),
      url: String(r.url),
      rent,
      beds: num(r.beds),
      baths: num(r.baths),
      size: num(r.size),
      area: text(r.area, 40),
      building: text(r.building, 60),
      builtYear: Number.isInteger(r.builtYear) ? r.builtYear : null,
      imgs: (Array.isArray(r.imgs) ? r.imgs : []).map(img).filter(Boolean).slice(0, 20),
      desc: text(r.desc, 900),
      transit: text(r.transit, 80),
      agent: text(r.agent, 60),
      listedAt: /^\d{4}-\d{2}-\d{2}$/.test(r.listedAt || '') ? r.listedAt : '',
    });
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

module.exports = { clean, text, num, sleep, UA };
