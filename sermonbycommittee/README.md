# Sermon By Committee

Reflection board for the Sunday evening Sermon By Committee class at SFUMC.
Deployed as its own Vercel project (`sermonbycommittee`, root directory `sermonbycommittee/`).

- `weeks.json`: the class weeks, lectionary readings and intro paragraphs. Add or remove a week here.
- `api/reflections.js`: reads, posts and deletes reflections, stored as one JSON file each in the `sermonbycommittee-reflections` Vercel Blob store.
- `api/scripture.js`: loads each NRSVue passage and caches it at the edge for a month.

Visiting the site once with `?admin=<key>` turns on delete buttons in that browser. The key is not in this repo; only its SHA-256 hash is.
