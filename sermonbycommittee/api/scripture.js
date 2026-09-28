// Loads one lectionary passage in the NRSVue and returns cleaned-up HTML.
// Responses are cached at Vercel's edge for a month, so each passage is
// fetched from the source only rarely.

import { weeks } from '../lib/weeks.js';

const VERSION = 'NRSVUE';
const ALLOWED_QUERIES = new Set(weeks.flatMap(w => w.readings.map(r => r.query || r.ref)));

const KEEP_TAGS = new Set(['p', 'br', 'h3', 'h4', 'sup', 'span', 'div']);

function extractPassage(html) {
  const start = html.indexOf('<div class="passage-text">');
  if (start < 0) return null;
  const stops = ['<div class="footnotes">', '<div class="crossrefs', '<div class="publisher-info', '<div class="passage-other-trans']
    .map(s => html.indexOf(s, start))
    .filter(i => i > 0);
  return html.slice(start, stops.length ? Math.min(...stops) : undefined);
}

function clean(fragment) {
  let s = fragment
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[\s\S]*?<\/h1>/gi, '')
    .replace(/<sup[^>]*class=['"](?:footnote|crossreference)['"][^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<a[^>]*class=['"]full-chap-link['"][^>]*>[\s\S]*?<\/a>/gi, '')
    // A chapter number opens verse 1; show it as a verse number.
    .replace(/<span class="chapternum">[\s\S]*?<\/span>/gi, '<sup class="versenum">1&nbsp;</sup>');

  // Keep a small set of tags, and only their class attribute.
  s = s.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!KEEP_TAGS.has(tag)) return '';
    if (m.startsWith('</')) return `</${tag}>`;
    const cls = /class=['"]([^'"]*)['"]/i.exec(attrs);
    const safe = cls ? cls[1].split(/\s+/).filter(c => /^(versenum|poetry|indent-\d+|indent-\d+-breaks|top-\d+|text|line)$/.test(c)).join(' ') : '';
    return safe ? `<${tag} class="${safe}">` : `<${tag}>`;
  });
  return s.replace(/\n{2,}/g, '\n').trim();
}

export default async function handler(req, res) {
  const q = String(req.query.q || '');
  if (!ALLOWED_QUERIES.has(q)) {
    res.statusCode = 404;
    return res.end('Unknown passage');
  }
  const link = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(q)}&version=${VERSION}`;
  try {
    const r = await fetch(`${link}&interface=print`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SermonByCommittee/1.0; church class reading page)' },
    });
    const passage = r.ok ? extractPassage(await r.text()) : null;
    if (!passage) throw new Error(`No passage text (status ${r.status})`);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=2592000, stale-while-revalidate=2592000');
    return res.end(JSON.stringify({ html: clean(passage), link }));
  } catch (err) {
    console.error(q, err);
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({ html: null, link }));
  }
}
