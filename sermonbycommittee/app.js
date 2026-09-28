(() => {
  const app = document.getElementById('app');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };

  // ?admin=<key> turns on delete buttons for this browser.
  const params = new URLSearchParams(location.search);
  if (params.has('admin')) {
    store.set('sbc-admin', params.get('admin') || null);
    history.replaceState(null, '', location.pathname + location.hash);
  }
  const adminKey = () => store.get('sbc-admin');

  let weeks = [];

  // "New" markers: activity newer than this browser's last look at a week.
  if (!store.get('sbc-first')) store.set('sbc-first', new Date().toISOString());
  const seenAt = slug => [store.get(`sbc-seen-${slug}`), store.get('sbc-first')].filter(Boolean).sort().at(-1);
  const isNew = (iso, slug) => !!iso && iso > seenAt(slug);
  const ago = iso => {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const d = Math.round(h / 24);
    return d < 7 ? `${d} day${d === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const scriptureCache = new Map();

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paras = s => esc(s).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  const day = iso => new Date(iso + 'T12:00:00');
  const fmtDay = iso => day(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const fmtShort = iso => day(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const initials = n => n.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const hue = n => [...n.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const avatar = (n, small) => `<span class="avatar${small ? ' small' : ''}" style="--h:${hue(n)}" aria-hidden="true">${esc(initials(n))}</span>`;
  const fmtStamp = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const todayIso = () => new Date().toLocaleDateString('en-CA');

  function currentWeek() {
    const t = todayIso();
    return weeks.find(w => w.classDate >= t) || weeks[weeks.length - 1];
  }

  // ---------- Home ----------
  function renderHome() {
    document.title = 'Sermon By Committee';
    const now = currentWeek();
    const name = store.get('sbc-name');
    app.innerHTML = `
      <section class="hero">
        <div class="hero-text">
          <span class="eyebrow">${name ? `Welcome back, ${esc(name.split(' ')[0])}` : 'Welcome to the table'}</span>
          <h1>Read with us.</h1>
          <p>Every Sunday evening a group of us sits down with the lectionary texts for the coming Sunday, and what we find together shapes the sermon. This is where that conversation carries on during the week, whether you missed a Sunday or thought of something on Tuesday.</p>
          <p>Nobody here is expected to be a scholar. A question counts. So does a phrase that stuck with you.</p>
        </div>
        <figure class="verse">
          <blockquote>Without counsel, plans go wrong, but with many advisers they succeed.</blockquote>
          <figcaption>Proverbs 15:22</figcaption>
        </figure>
      </section>

      <a class="now color-${now.color}" href="#/${now.slug}">
        <span class="eyebrow">This week · class meets ${fmtDay(now.classDate)}</span>
        <span class="now-title">${esc(now.theme)}</span>
        <span class="now-sub">Texts for ${fmtDay(now.sunday)} · ${now.readings.map(r => esc(r.ref)).join(' · ')}</span>
        <span class="now-foot"><span class="btn">Read and reflect</span><span class="now-count" data-count="${now.slug}"></span></span>
      </a>

      <section class="activity">
        <h2 class="section-h">Recent activity</h2>
        <div id="recent"><p class="loading">Checking for new reflections…</p></div>
      </section>

      <section class="how">
        <div><span class="how-n">1</span><h3>Sit with the texts</h3><p>Each week has all four readings printed in full. Read one or read them all, whatever time allows.</p></div>
        <div><span class="how-n">2</span><h3>Add your voice</h3><p>Write what you noticed, then read what others saw and reply. Just your name, no account needed.</p></div>
      </section>

      <h2 class="section-h">The season</h2>
      <ol class="weeks">
        ${weeks.map(w => `
          <li>
            <a href="#/${w.slug}" class="color-${w.color}${w === now ? ' is-now' : ''}">
              <span class="wk-date"><span class="wk-mon">${day(w.sunday).toLocaleDateString('en-US', { month: 'short' })}</span><span class="wk-day">${day(w.sunday).getDate()}</span></span>
              <span class="wk-main">
                <span class="wk-title">${esc(w.theme)}${w === now ? ' <span class="badge">This week</span>' : ''}</span>
                <span class="wk-refs">${esc(w.title)} · ${esc(w.readings.find(r => r.key === 'gospel').ref)} · class ${fmtShort(w.classDate)}</span>
              </span>
              <span class="wk-side"><span class="wk-new" data-new="${w.slug}"></span><span class="wk-count" data-count="${w.slug}"></span></span>
            </a>
          </li>`).join('')}
      </ol>`;
    loadActivity();
  }

  async function loadActivity() {
    const box = app.querySelector('#recent');
    let data;
    try {
      data = await api('/api/recent');
    } catch {
      box.innerHTML = '<p class="empty">Recent activity didn\'t load. Refresh to try again.</p>';
      return;
    }
    for (const w of weeks) {
      const s = data.summary[w.slug];
      const n = s.reflections + s.replies;
      app.querySelectorAll(`[data-count="${w.slug}"]`).forEach(el => {
        if (n) el.textContent = `${s.reflections} reflection${s.reflections === 1 ? '' : 's'}${s.replies ? ` · ${s.replies} repl${s.replies === 1 ? 'y' : 'ies'}` : ''}`;
      });
      const nw = app.querySelector(`[data-new="${w.slug}"]`);
      if (nw && isNew(s.latest, w.slug)) nw.innerHTML = '<span class="new-dot">New</span>';
    }
    const wk = slug => weeks.find(w => w.slug === slug);
    box.innerHTML = data.recent.length ? `<ul class="feed">${data.recent.map(p => `
      <li>
        <a href="#/${p.week}/${p.parentId || p.id}">
          ${avatar(p.name, true)}
          <span class="feed-main">
            <span class="feed-line"><strong>${esc(p.name)}</strong> ${p.parentId ? `replied to ${esc(p.replyTo || 'a reflection')}` : 'shared a reflection'} on <em>${esc(wk(p.week).theme)}</em>${isNew(p.createdAt, p.week) ? ' <span class="new-dot">New</span>' : ''}</span>
            <span class="feed-snip">${esc(p.body.length >= 220 ? p.body.slice(0, 200).trim() + '…' : p.body)}</span>
            <span class="feed-when">${ago(p.createdAt)}</span>
          </span>
        </a>
      </li>`).join('')}</ul>` : '<p class="empty">Quiet so far. The first reflections will show up here.</p>';
  }

  // ---------- Week ----------
  function renderWeek(week, focusId) {
    state.seenBefore = seenAt(week.slug);
    state.focusId = focusId;
    document.title = `${week.title} · Sermon By Committee`;
    const gospel = week.readings.find(r => r.key === 'gospel');
    app.innerHTML = `
      <a class="back" href="#/">← All weeks</a>
      <header class="week-head color-${week.color}">
        <span class="eyebrow">${esc(week.title)} · Class meets ${fmtDay(week.classDate)}</span>
        <h1>${esc(week.theme)}</h1>
        <p class="week-when">Texts for ${fmtDay(week.sunday)}</p>
        <p class="week-intro">${esc(week.intro)}</p>
      </header>

      <section class="card scripture">
        <div class="tabs" role="tablist">
          ${week.readings.map(r => `<button role="tab" data-reading="${r.key}" aria-selected="${r === gospel}"><span class="tab-label">${esc(r.label)}</span><span class="tab-ref">${esc(r.ref)}</span></button>`).join('')}
        </div>
        <div class="passage" id="passage"></div>
      </section>

      ${adminKey() ? `<p class="admin-note">Delete buttons are on for this browser. <button class="linkish" id="admin-off">Turn off</button></p>` : ''}

      <section class="card compose">
        <h2>Add your voice</h2>
        <p class="compose-sub">There's no wrong way to do this. A few sentences is plenty.</p>
        <form id="new-post">
          <div class="row">
            <label>Your name<input name="name" maxlength="60" autocomplete="name" required></label>
            <label>About
              <select name="reading">
                <option value="">All the texts</option>
                ${week.readings.map(r => `<option value="${r.key}">${esc(r.ref)}</option>`).join('')}
              </select>
            </label>
          </div>
          <label>What did you notice?<textarea name="body" rows="6" maxlength="8000" required placeholder="A question, a phrase that caught you, a connection between the texts, where this meets your life…"></textarea></label>
          <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="actions"><span class="form-msg" role="status"></span><button type="submit" class="btn">Share with the group</button></div>
        </form>
      </section>

      <section class="reflections">
        <div class="ref-head">
          <h2>What the group is noticing</h2>
          <div class="filters" id="filters"></div>
        </div>
        <div id="list"><p class="loading">Loading reflections…</p></div>
      </section>`;

    const tabs = [...app.querySelectorAll('[role=tab]')];
    const show = key => {
      tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.reading === key));
      loadPassage(week.readings.find(r => r.key === key));
    };
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.reading)));
    show('gospel');

    const off = app.querySelector('#admin-off');
    if (off) off.addEventListener('click', () => { store.set('sbc-admin', null); renderWeek(week); });

    const form = app.querySelector('#new-post');
    form.name.value = store.get('sbc-name') || '';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = form.querySelector('.form-msg');
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      msg.textContent = 'Sharing…';
      try {
        store.set('sbc-name', form.name.value.trim());
        await api('/api/reflections', {
          method: 'POST',
          body: { week: week.slug, name: form.name.value, reading: form.reading.value, body: form.body.value, website: form.website.value },
        });
        form.body.value = '';
        msg.textContent = 'Thank you for sharing. Your reflection is below.';
        await loadReflections(week);
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });

    state.filter = '';
    loadReflections(week);
  }

  async function loadPassage(reading) {
    const box = app.querySelector('#passage');
    const q = reading.query || reading.ref;
    const head = `<h3 class="passage-ref">${esc(reading.ref)}</h3>`;
    const fallbackLink = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(q)}&version=NRSVUE`;
    if (!scriptureCache.has(q)) {
      box.innerHTML = head + '<p class="loading">Loading the text…</p>';
      scriptureCache.set(q, fetch(`/api/scripture?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ html: null, link: fallbackLink })));
    }
    const data = await scriptureCache.get(q);
    if (!app.querySelector(`[role=tab][data-reading="${reading.key}"][aria-selected=true]`)) return;
    const note = /\d[a-c]\b/.test(reading.ref)
      ? `<p class="part-note">The lectionary reading is ${esc(reading.ref)}; the full verse is shown here.</p>` : '';
    box.innerHTML = head + (data.html
      ? `<div class="passage-body">${data.html}</div>${note}<p class="src"><a href="${data.link}" target="_blank" rel="noopener">Open on Bible Gateway</a></p>`
      : `<p>The text didn't load. <a href="${data.link || fallbackLink}" target="_blank" rel="noopener">Read ${esc(reading.ref)} on Bible Gateway</a>.</p>`);
  }

  // ---------- Reflections ----------
  const state = { posts: [], filter: '' };

  async function loadReflections(week) {
    const list = app.querySelector('#list');
    try {
      const { reflections } = await api(`/api/reflections?week=${week.slug}`);
      state.posts = reflections;
      drawReflections(week);
      store.set(`sbc-seen-${week.slug}`, new Date().toISOString());
      if (state.focusId) {
        const el = app.querySelector(`#p-${state.focusId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); }
        state.focusId = null;
      }
    } catch (err) {
      list.innerHTML = `<p class="empty">Couldn't load reflections: ${esc(err.message)}</p>`;
    }
  }

  function drawReflections(week) {
    const list = app.querySelector('#list');
    const filters = app.querySelector('#filters');
    if (!list) return;
    const tops = state.posts.filter(p => !p.parentId).reverse();
    const replies = id => state.posts.filter(p => p.parentId === id);
    const label = key => (week.readings.find(r => r.key === key) || {}).ref;
    const fresh = p => p.createdAt > state.seenBefore && p.name !== store.get('sbc-name');

    const used = week.readings.filter(r => tops.some(p => p.reading === r.key));
    filters.innerHTML = used.length ? [['', 'All'], ...used.map(r => [r.key, r.ref])]
      .map(([k, l]) => `<button data-f="${k}" aria-pressed="${state.filter === k}">${esc(l)}</button>`).join('') : '';
    filters.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.f; drawReflections(week); }));

    const shown = state.filter ? tops.filter(p => p.reading === state.filter) : tops;
    if (!tops.length) {
      list.innerHTML = '<p class="empty">Nobody has written yet this week. Yours could be the first.</p>';
      return;
    }
    const del = p => adminKey() ? `<button class="linkish danger" data-del="${p.id}">Delete</button>` : '';
    list.innerHTML = shown.map(p => `
      <article class="card post" id="p-${p.id}">
        <header>
          ${avatar(p.name)}
          <strong>${esc(p.name)}</strong>
          <span class="meta">${fmtStamp(p.createdAt)}${fresh(p) ? ' <span class="new-dot">New</span>' : ''}${p.reading ? ` · <span class="pill">${esc(label(p.reading))}</span>` : ''}</span>
        </header>
        <div class="body">${paras(p.body)}</div>
        <div class="replies">
          ${replies(p.id).map(r => `
            <div class="reply" id="p-${r.id}">
              <header>${avatar(r.name, true)}<strong>${esc(r.name)}</strong><span class="meta">${fmtStamp(r.createdAt)}${fresh(r) ? ' <span class="new-dot">New</span>' : ''}</span>${del(r)}</header>
              <div class="body">${paras(r.body)}</div>
            </div>`).join('')}
        </div>
        <footer><button class="linkish" data-reply="${p.id}">Reply</button>${del(p)}</footer>
        <form class="reply-form" data-parent="${p.id}" hidden>
          <label>Your name<input name="name" maxlength="60" autocomplete="name" required></label>
          <label>Reply<textarea name="body" rows="3" maxlength="8000" required></textarea></label>
          <div class="actions"><span class="form-msg" role="status"></span><button type="button" class="linkish" data-cancel>Cancel</button><button type="submit" class="btn small">Reply</button></div>
        </form>
      </article>`).join('') || '<p class="empty">No reflections on this reading yet.</p>';

    list.querySelectorAll('[data-reply]').forEach(b => b.addEventListener('click', () => {
      const f = list.querySelector(`form[data-parent="${b.dataset.reply}"]`);
      f.hidden = false;
      f.name.value = f.name.value || store.get('sbc-name') || '';
      (f.name.value ? f.body : f.name).focus();
    }));
    list.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => { b.closest('form').hidden = true; }));
    list.querySelectorAll('form.reply-form').forEach(f => f.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = f.querySelector('.form-msg');
      msg.textContent = 'Sending…';
      try {
        store.set('sbc-name', f.name.value.trim());
        await api('/api/reflections', { method: 'POST', body: { week: week.slug, name: f.name.value, body: f.body.value, parentId: f.dataset.parent } });
        await loadReflections(week);
      } catch (err) {
        msg.textContent = err.message;
      }
    }));
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const isTop = tops.some(p => p.id === b.dataset.del);
      if (!confirm(isTop ? 'Delete this reflection and its replies?' : 'Delete this reply?')) return;
      try {
        await api(`/api/reflections?week=${week.slug}&id=${b.dataset.del}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey() } });
        await loadReflections(week);
      } catch (err) {
        alert(err.message);
      }
    }));
  }

  // ---------- Plumbing ----------
  async function api(url, { method = 'GET', body, headers = {} } = {}) {
    const r = await fetch(url, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }

  function route() {
    const [slug, postId] = location.hash.replace(/^#\/?/, '').split('/');
    const week = weeks.find(w => w.slug === slug);
    week ? renderWeek(week, postId) : renderHome();
    window.scrollTo(0, 0);
  }

  fetch('/weeks.json').then(r => r.json()).then(d => {
    weeks = d.weeks;
    window.addEventListener('hashchange', route);
    route();
  }).catch(() => { app.innerHTML = '<p class="empty">The page didn\'t load. Please refresh.</p>'; });
})();
