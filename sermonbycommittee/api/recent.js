// Everything the front page needs in one call: per-week counts and the
// time of the latest post, plus the most recent reflections and replies.
import { weeks } from '../lib/weeks.js';
import { listBlobs, parsePath, readPosts, send } from '../lib/store.js';

const RECENT = 8;

export default async function handler(req, res) {
  try {
    const blobs = (await listBlobs('reflections/'))
      .map(b => ({ ...b, meta: parsePath(b.pathname) }))
      .filter(b => b.meta && weeks.some(w => w.slug === b.meta.week));

    const summary = Object.fromEntries(weeks.map(w => [w.slug, { reflections: 0, replies: 0, latest: null }]));
    for (const b of blobs) {
      const s = summary[b.meta.week];
      b.meta.parentId ? s.replies++ : s.reflections++;
    }

    const recent = (await readPosts(blobs.slice(-RECENT)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // Latest activity per week comes from the pathname timestamps, but the
    // exact ISO time is in the posts, so read one newest post per week.
    const newestPerWeek = weeks.map(w => blobs.filter(b => b.meta.week === w.slug).at(-1)).filter(Boolean);
    for (const p of await readPosts(newestPerWeek)) summary[p.week].latest = p.createdAt;

    // Replies need the name of the person they answer.
    const parents = new Map();
    const want = recent.filter(p => p.parentId && !recent.some(q => q.id === p.parentId));
    const parentBlobs = blobs.filter(b => want.some(p => p.parentId === b.meta.id));
    for (const p of [...recent, ...await readPosts(parentBlobs)]) parents.set(p.id, p.name);

    return send(res, 200, {
      summary,
      recent: recent.map(p => ({ ...p, body: p.body.slice(0, 220), replyTo: p.parentId ? parents.get(p.parentId) || null : null })),
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Could not load recent activity.' });
  }
}
