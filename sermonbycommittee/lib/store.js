import { list } from '@vercel/blob';

// Each reflection is its own blob:
//   reflections/<week>/<timestamp>_<id>.json            a reflection
//   reflections/<week>/<timestamp>_<id>_<parentId>.json a reply to one
export function blobPath(post) {
  const ts = post.createdAt.replace(/[:.]/g, '-');
  return `reflections/${post.week}/${ts}_${post.id}${post.parentId ? `_${post.parentId}` : ''}.json`;
}

export function parsePath(pathname) {
  const m = /^reflections\/([^/]+)\/[^_]+_([\w-]{36})(?:_([\w-]{36}))?\.json$/.exec(pathname);
  return m && { week: m[1], id: m[2], parentId: m[3] || null };
}

export async function listBlobs(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  // Pathnames start with the creation time, so this is oldest first.
  return blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

export async function readPosts(blobs) {
  const posts = await Promise.all(blobs.map(async b => {
    try {
      const r = await fetch(b.url, { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }));
  return posts.filter(Boolean);
}

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}
