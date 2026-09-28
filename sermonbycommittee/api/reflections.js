import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { put, del } from '@vercel/blob';
import { findWeek } from '../lib/weeks.js';
import { blobPath, listBlobs, parsePath, readPosts, send } from '../lib/store.js';

// SHA-256 of the admin key. The key itself lives only with the pastor;
// visiting the site once with ?admin=<key> turns on the delete buttons.
const ADMIN_HASH = '909ffa1bc69c05d622b7b5e8e47883fb008da70b96d26c5a721ea700242d4d69';

const MAX_NAME = 60;
const MAX_BODY = 8000;

function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key || typeof key !== 'string') return false;
  const got = createHash('sha256').update(key).digest();
  return timingSafeEqual(got, Buffer.from(ADMIN_HASH, 'hex'));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function getReflections(week) {
  const posts = await readPosts(await listBlobs(`reflections/${week}/`));
  return posts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const week = findWeek(req.query.week);
      if (!week) return send(res, 404, { error: 'Unknown week' });
      return send(res, 200, { reflections: await getReflections(week.slug) });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.website) return send(res, 200, { ok: true }); // honeypot
      const week = findWeek(body.week);
      if (!week) return send(res, 400, { error: 'Unknown week' });
      const name = String(body.name || '').trim().slice(0, MAX_NAME);
      const text = String(body.body || '').trim();
      if (!name) return send(res, 400, { error: 'Please add your name.' });
      if (!text) return send(res, 400, { error: 'Your reflection is empty.' });
      if (text.length > MAX_BODY) return send(res, 400, { error: 'That is longer than the site allows. Try splitting it in two.' });
      const reading = week.readings.some(r => r.key === body.reading) ? body.reading : null;
      const parentId = typeof body.parentId === 'string' && /^[\w-]{36}$/.test(body.parentId) ? body.parentId : null;

      const post = {
        id: randomUUID(),
        week: week.slug,
        name,
        body: text,
        reading: parentId ? null : reading,
        parentId,
        createdAt: new Date().toISOString(),
      };
      await put(blobPath(post), JSON.stringify(post), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return send(res, 201, { reflection: post });
    }

    if (req.method === 'DELETE') {
      if (!isAdmin(req)) return send(res, 403, { error: 'Not allowed' });
      const week = findWeek(req.query.week);
      const id = String(req.query.id || '');
      if (!week || !id) return send(res, 400, { error: 'Missing week or id' });
      // Removing a reflection also removes the replies under it.
      const doomed = (await listBlobs(`reflections/${week.slug}/`))
        .map(b => ({ b, meta: parsePath(b.pathname) }))
        .filter(({ meta }) => meta && (meta.id === id || meta.parentId === id));
      if (doomed.length) await del(doomed.map(d => d.b.url));
      return send(res, 200, { deleted: doomed.map(d => d.meta.id) });
    }

    res.setHeader('allow', 'GET, POST, DELETE');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Something went wrong on our end. Please try again in a minute.' });
  }
}
