/* C&F — "Send to C & F" bookmarklet source.
 *
 * Why this exists: PropertyGuru, iProperty, EdgeProp and Speedhome all run bot
 * protection that refuses automated readers, and we are not in the business of
 * defeating that. But Fares and Charlotte are ordinary visitors to those sites.
 * This runs in THEIR browser, in THEIR session, on a page they already opened,
 * and pushes what is on screen into the app. No wall is being climbed: a person
 * looked at a page and pressed a button.
 *
 * It is deliberately generic. Most property sites emit schema.org JSON-LD and
 * Open Graph tags, so field extraction works on sites nobody has hand-tuned,
 * and falls back to reading the visible page when they do not.
 *
 * Build:  node -e "console.log('javascript:'+encodeURIComponent(require('fs').readFileSync('grab.js','utf8')))"
 */
(function () {
  var APP = 'https://alfredbot2049.github.io/cf-dash/';

  var txt = function (s, n) {
    return String(s == null ? '' : s).replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, n || 200);
  };
  var meta = function (p) {
    var e = document.querySelector('meta[property="' + p + '"],meta[name="' + p + '"]');
    return e ? e.getAttribute('content') : '';
  };
  var digits = function (s) {
    var m = String(s == null ? '' : s).replace(/,/g, '').match(/\d[\d.]*/);
    return m ? parseFloat(m[0]) : null;
  };

  // schema.org blobs, flattened. Sites nest these differently (@graph, arrays,
  // a bare object), so walk whatever shape turns up rather than guessing.
  var ld = [];
  (function () {
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      try {
        var j = JSON.parse(nodes[i].textContent);
        (function push(o) {
          if (!o) return;
          if (Array.isArray(o)) { o.forEach(push); return; }
          if (typeof o !== 'object') return;
          ld.push(o);
          if (o['@graph']) push(o['@graph']);
        })(j);
      } catch (e) {}
    }
  })();
  var fromLd = function (keys) {
    for (var i = 0; i < ld.length; i++)
      for (var k = 0; k < keys.length; k++) {
        var v = ld[i][keys[k]];
        if (v != null && v !== '') return v;
      }
    return null;
  };

  // Price. JSON-LD first, then any on-page element that looks like a monthly
  // rent. Anything under 500 is a fee or a per-sqft figure, not rent.
  var rent = digits(fromLd(['price']) ||
    (fromLd(['offers']) && fromLd(['offers']).price) || '');
  if (!rent || rent < 500) {
    var m = document.body.innerText.match(/RM\s?([\d,]{3,10})\s*(?:\/|per\s|\bmo)/i)
         || document.body.innerText.match(/RM\s?([\d,]{4,10})/);
    if (m) rent = digits(m[1]);
  }

  var body = document.body.innerText;
  var pick = function (re) { var m = body.match(re); return m ? digits(m[1]) : null; };

  // Images: og:image is the reliable one; top up from the biggest <img> tags on
  // the page, skipping icons, logos and tracking pixels.
  var imgs = [];
  var og = meta('og:image'); if (og) imgs.push(og);
  var all = document.querySelectorAll('img');
  for (var i = 0; i < all.length && imgs.length < 20; i++) {
    var src = all[i].currentSrc || all[i].src || '';
    if (!/^https:\/\//.test(src)) continue;
    if (/logo|icon|sprite|avatar|placeholder|blank|pixel/i.test(src)) continue;
    if ((all[i].naturalWidth || all[i].width || 0) < 300) continue;
    if (imgs.indexOf(src) === -1) imgs.push(src);
  }

  var payload = {
    title: txt(fromLd(['name']) || meta('og:title') || document.title, 120),
    building: txt(fromLd(['name']) || meta('og:title') || '', 60),
    url: location.href.split('#')[0],
    rent: rent,
    beds: pick(/(\d+)\s*(?:bed|bd\b|bilik)/i),
    baths: pick(/(\d+)\s*(?:bath|ba\b)/i),
    size: pick(/([\d,]{3,7})\s*(?:sq\.?\s?ft|sqft|square feet)/i),
    area: txt(meta('og:locality') || (fromLd(['address']) &&
      (fromLd(['address']).addressLocality || fromLd(['address']).streetAddress)) || '', 40),
    builtYear: (function () { var m = body.match(/(?:completed|completion|built)\D{0,12}((?:19|20)\d{2})/i); return m ? +m[1] : null; })(),
    desc: txt(meta('og:description') || fromLd(['description']) || '', 900),
    agent: txt(meta('og:site_name') || location.hostname.replace(/^www\./, ''), 60),
    imgs: imgs,
  };

  if (!payload.rent) {
    alert('Could not find a rent on this page. Open the listing itself, then try again.');
    return;
  }
  // base64 so a stray & or # in a description cannot break the url
  var b = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  window.open(APP + '?add=' + encodeURIComponent(b) + '#homes', '_blank');
})();
