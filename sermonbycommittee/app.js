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
  const scriptureCache = new Map();

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paras = s => esc(s).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  const day = iso => new Date(iso + 'T12:00:00');
  const fmtDay = iso => day(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const fmtShort = iso => day(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    app.innerHTML = `
      <section class="intro">
        <p>Each Sunday evening the class reads the lectionary texts for the coming Sunday together, and what the room finds shapes the sermon. This page keeps that conversation going for the weeks you can't be there, and for the thoughts that come to you on Tuesday.</p>
        <p>Open a week to read the texts and add what you noticed. You can reply to what others have written too.</p>
      </section>
      <a class="now card" href="#/${now.slug}">
        <span class="eyebrow">This week</span>
        <span class="now-title">Texts for ${fmtDay(now.sunday)}</span>
        <span class="now-sub">${esc(now.title)} · ${now.readings.map(r => esc(r.ref)).join(' · ')}</span>
        <span class="go">Read and reflect →</span>
      </a>
      <h2 class="section-h">All weeks</h2>
      <ol class="weeks">
        ${weeks.map(w => `
          <li>
            <a href="#/${w.slug}" class="${w === now ? 'is-now' : ''}">
              <span class="wk-date">Class ${fmtShort(w.classDate)}</span>
              <span class="wk-main">
                <span class="wk-title">${esc(w.title)} <span class="wk-for">for ${fmtShort(w.sunday)}</span></span>
                <span class="wk-refs">${w.readings.find(r => r.key === 'gospel').ref}</span>
              </span>
              <span class="wk-count" data-count="${w.slug}"></span>
            </a>
          </li>`).join('')}
      </ol>`;
    weeks.forEach(async w => {
      try {
        const { reflections } = await api(`/api/reflections?week=${w.slug}`);
        const n = reflections.filter(r => !r.parentId).length;
        const el = app.querySelector(`[data-count="${w.slug}"]`);
        if (el && n) el.textContent = `${n} reflection${n === 1 ? '' : 's'}`;
      } catch {}
    });
  }

  // ---------- Week ----------
  function renderWeek(week) {
    document.title = `${week.title} · Sermon By Committee`;
    const gospel = week.readings.find(r => r.key === 'gospel');
    app.innerHTML = `
      <a class="back" href="#/">← All weeks</a>
      <header class="week-head">
        <span class="eyebrow">${esc(week.title)} · Class meets ${fmtDay(week.classDate)}</span>
        <h1>Texts for ${fmtDay(week.sunday)}</h1>
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
        <h2>Add your reflection</h2>
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
          <div class="actions"><span class="form-msg" role="status"></span><button type="submit" class="btn">Share</button></div>
        </form>
      </section>

      <section class="reflections">
        <div class="ref-head">
          <h2>Reflections</h2>
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
        msg.textContent = 'Thank you. Your reflection is below.';
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
      ? `<div class="text">${data.html}</div>${note}<p class="src"><a href="${data.link}" target="_blank" rel="noopener">Open on Bible Gateway</a></p>`
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

    const used = week.readings.filter(r => tops.some(p => p.reading === r.key));
    filters.innerHTML = used.length ? [['', 'All'], ...used.map(r => [r.key, r.ref])]
      .map(([k, l]) => `<button data-f="${k}" aria-pressed="${state.filter === k}">${esc(l)}</button>`).join('') : '';
    filters.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.f; drawReflections(week); }));

    const shown = state.filter ? tops.filter(p => p.reading === state.filter) : tops;
    if (!tops.length) {
      list.innerHTML = '<p class="empty">No reflections yet. Yours could be the first.</p>';
      return;
    }
    const del = p => adminKey() ? `<button class="linkish danger" data-del="${p.id}">Delete</button>` : '';
    list.innerHTML = shown.map(p => `
      <article class="card post" id="p-${p.id}">
        <header>
          <strong>${esc(p.name)}</strong>
          <span class="meta">${fmtStamp(p.createdAt)}${p.reading ? ` · <span class="pill">${esc(label(p.reading))}</span>` : ''}</span>
        </header>
        <div class="body">${paras(p.body)}</div>
        <div class="replies">
          ${replies(p.id).map(r => `
            <div class="reply" id="p-${r.id}">
              <header><strong>${esc(r.name)}</strong><span class="meta">${fmtStamp(r.createdAt)}</span>${del(r)}</header>
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
    const slug = location.hash.replace(/^#\/?/, '');
    const week = weeks.find(w => w.slug === slug);
    week ? renderWeek(week) : renderHome();
    window.scrollTo(0, 0);
  }

  fetch('/weeks.json').then(r => r.json()).then(d => {
    weeks = d.weeks;
    window.addEventListener('hashchange', route);
    route();
  }).catch(() => { app.innerHTML = '<p class="empty">The page didn\'t load. Please refresh.</p>'; });
})();
