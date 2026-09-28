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

  // "New" markers: activity newer than this browser's last look at a week.
  if (!store.get('sbc-first')) store.set('sbc-first', new Date().toISOString());
  const seenAt = slug => [store.get(`sbc-seen-${slug}`), store.get('sbc-first')].filter(Boolean).sort().at(-1);
  const isNew = (iso, slug) => !!iso && iso > seenAt(slug);

  // ---------- Formatting ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const paras = s => esc(s).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  const day = iso => new Date(iso + 'T12:00:00');
  const fmtDay = iso => day(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const fmtLong = iso => day(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const fmtShort = iso => day(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtStamp = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const ago = iso => {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    return d < 7 ? `${d} day${d === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const initials = n => n.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const hue = n => [...n.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const avatar = (n, small) => `<span class="avatar${small ? ' small' : ''}" style="--h:${hue(n)}" aria-hidden="true">${esc(initials(n))}</span>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const todayIso = () => new Date().toLocaleDateString('en-CA');
  const currentWeek = () => weeks.find(w => w.classDate >= todayIso()) || weeks[weeks.length - 1];
  const gospelOf = w => w.readings.find(r => r.key === 'gospel');
  const colorName = w => (w.color === 'white' ? 'White' : 'Green');

  // ---------- Home ----------
  function renderHome(section) {
    document.title = 'Sermon By Committee · Spanish Fort UMC';
    const now = currentWeek();
    const name = store.get('sbc-name');
    app.innerHTML = `
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-copy rise">
            <p class="kicker">${name ? `Welcome back, ${esc(name.split(' ')[0])}` : 'Sunday evenings · Fall 2026'}</p>
            <h1>The sermon starts <em>around the table.</em></h1>
            <p class="lede">Each Sunday evening a group of us reads the coming Sunday's lectionary texts together, and what we find shapes the sermon. This is where the conversation continues between meetings.</p>
            <div class="hero-actions">
              <a class="btn" href="#/${now.slug}">Read this week's texts</a>
              <a class="text-link" href="#/about">How it works</a>
            </div>
          </div>
          <a class="this-week rise delay" href="#/${now.slug}">
            <span class="tw-label">This week</span>
            <span class="tw-date"><span class="tw-mon">${day(now.sunday).toLocaleDateString('en-US', { month: 'short' })}</span><span class="tw-day">${day(now.sunday).getDate()}</span></span>
            <span class="tw-theme">${esc(now.theme)}</span>
            <span class="tw-refs">${now.readings.map(r => esc(r.ref)).join('<br>')}</span>
            <span class="tw-foot"><span>Class meets ${fmtLong(now.classDate)}</span><span class="tw-count" data-count="${now.slug}"></span></span>
          </a>
        </div>
      </section>

      <section class="band-paper">
        <div class="wrap">
          <header class="sec-head">
            <h2>From the conversation</h2>
            <p>The latest reflections and replies from everyone in the class.</p>
          </header>
          <div id="recent" class="recent"><p class="loading">Gathering the latest reflections…</p></div>
        </div>
      </section>

      <section class="band-plain" id="season">
        <div class="wrap">
          <header class="sec-head">
            <h2>The season</h2>
            <p>Seven Sundays of the Revised Common Lectionary, Year A. Each class reads the texts for the Sunday after it meets.</p>
          </header>
          <ol class="season">
            ${weeks.map((w, i) => `
              <li class="color-${w.color}${w === now ? ' is-now' : ''}">
                <a href="#/${w.slug}">
                  <span class="s-num">${String(i + 1).padStart(2, '0')}</span>
                  <span class="s-date">${fmtLong(w.sunday)}</span>
                  <span class="s-theme">${esc(w.theme)}</span>
                  <span class="s-ref">${esc(gospelOf(w).ref)}</span>
                  <span class="s-meta"><span class="s-dot" title="${colorName(w)}"></span>${esc(w.title)}<span class="s-new" data-new="${w.slug}"></span></span>
                  <span class="s-count" data-count="${w.slug}"></span>
                </a>
              </li>`).join('')}
            <li class="season-end"><a href="#/about"><span class="s-num">Then</span><span class="s-theme">Advent begins</span><p>November 29. The class ends as the church starts a new year.</p></a></li>
          </ol>
        </div>
      </section>

      <section class="band-ink" id="about">
        <div class="wrap about-grid">
          <figure class="verse">
            <blockquote>Without counsel, plans go wrong, but with many advisers they succeed.</blockquote>
            <figcaption>Proverbs 15:22</figcaption>
          </figure>
          <div class="about-copy">
            <h2>Why a committee?</h2>
            <p>Committees get a bad name, but the church has done much of its best discernment in rooms full of people reading scripture together. This class trusts that a sermon comes out better when many of us have handled the text first.</p>
            <p>You don't need to be a scholar to take part. Read the passages for the week, then write down what caught your attention, even if it's only a question or a phrase you can't shake. Reply to what others notice. Missed a Sunday? Your reflection still makes it into the room.</p>
          </div>
        </div>
      </section>`;

    loadActivity();
    if (section) requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }));
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
      app.querySelectorAll(`[data-count="${w.slug}"]`).forEach(el => {
        if (s.reflections) el.textContent = plural(s.reflections, 'reflection', 'reflections') + (s.replies ? ` · ${plural(s.replies, 'reply', 'replies')}` : '');
      });
      const nw = app.querySelector(`[data-new="${w.slug}"]`);
      if (nw && isNew(s.latest, w.slug)) nw.innerHTML = '<span class="new">New</span>';
    }
    if (!data.recent.length) {
      box.innerHTML = `<div class="quiet"><p>It's quiet so far. The first reflections will appear here once the class begins.</p><a class="text-link" href="#/${currentWeek().slug}">Be the first to write</a></div>`;
      return;
    }
    const wk = slug => weeks.find(w => w.slug === slug);
    const snip = p => esc(p.body.length >= 220 ? p.body.slice(0, 200).trim() + '…' : p.body);
    const [lead, ...rest] = data.recent;
    box.innerHTML = `
      <a class="lead-quote" href="#/${lead.week}/${lead.parentId || lead.id}">
        <blockquote>${snip(lead)}</blockquote>
        <span class="lq-by">${avatar(lead.name, true)}<span><strong>${esc(lead.name)}</strong> ${lead.parentId ? `replying to ${esc(lead.replyTo || 'a reflection')}` : ''} on <em>${esc(wk(lead.week).theme)}</em> · ${ago(lead.createdAt)}${isNew(lead.createdAt, lead.week) ? ' <span class="new">New</span>' : ''}</span></span>
      </a>
      ${rest.length ? `<ul class="feed">${rest.map(p => `
        <li>
          <a href="#/${p.week}/${p.parentId || p.id}">
            ${avatar(p.name, true)}
            <span class="feed-main">
              <span class="feed-line"><strong>${esc(p.name)}</strong> ${p.parentId ? `replied to ${esc(p.replyTo || 'a reflection')}` : 'reflected'} on <em>${esc(wk(p.week).theme)}</em>${isNew(p.createdAt, p.week) ? ' <span class="new">New</span>' : ''}</span>
              <span class="feed-snip">${snip(p)}</span>
            </span>
            <span class="feed-when">${ago(p.createdAt)}</span>
          </a>
        </li>`).join('')}</ul>` : ''}`;
  }

  // ---------- Week ----------
  const state = { posts: [], filter: '', seenBefore: '', focusId: null };

  function renderWeek(week, focusId) {
    state.seenBefore = seenAt(week.slug);
    state.focusId = focusId;
    state.filter = '';
    document.title = `${week.theme} · Sermon By Committee`;
    const i = weeks.indexOf(week);
    const prev = weeks[i - 1], next = weeks[i + 1];
    app.innerHTML = `
      <section class="week-hero color-${week.color}">
        <div class="wrap">
          <a class="crumb" href="#/season">← The season</a>
          <p class="kicker">${esc(week.title)} · ${fmtDay(week.sunday)}</p>
          <h1 class="rise">${esc(week.theme)}</h1>
          <p class="week-intro">${esc(week.intro)}</p>
          <p class="week-meta"><span class="s-dot"></span>${colorName(week)} · Class meets ${fmtDay(week.classDate)}</p>
        </div>
      </section>

      <div class="wrap reading-room">
        <aside class="scripture" aria-label="Readings">
          <div class="tabs" role="tablist">
            ${week.readings.map(r => `<button role="tab" data-reading="${r.key}" aria-selected="false"><span class="tab-label">${esc(r.label)}</span><span class="tab-ref">${esc(r.ref)}</span></button>`).join('')}
          </div>
          <div class="passage" id="passage"></div>
        </aside>

        <section class="conversation">
          ${adminKey() ? `<p class="admin-note">Delete buttons are on for this browser. <button class="linkish" id="admin-off">Turn off</button></p>` : ''}
          <form id="new-post" class="compose">
            <h2>Add your reflection</h2>
            <p class="compose-sub">A few sentences is plenty. Questions are welcome.</p>
            <div class="row">
              <label>Your name<input name="name" maxlength="60" autocomplete="name" required></label>
              <label>Responding to
                <select name="reading">
                  <option value="">All the readings</option>
                  ${week.readings.map(r => `<option value="${r.key}">${esc(r.ref)}</option>`).join('')}
                </select>
              </label>
            </div>
            <label class="sr-only" for="body-field">Your reflection</label>
            <textarea id="body-field" name="body" rows="5" maxlength="8000" required placeholder="What did you notice?"></textarea>
            <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="actions"><span class="form-msg" role="status"></span><button type="submit" class="btn">Share reflection</button></div>
          </form>

          <div class="conv-head">
            <h2>The conversation <span class="conv-count" id="conv-count"></span></h2>
            <div class="filters" id="filters"></div>
          </div>
          <div id="list"><p class="loading">Loading reflections…</p></div>
        </section>
      </div>

      <nav class="wrap week-pager" aria-label="Other weeks">
        ${prev ? `<a href="#/${prev.slug}" class="pg-prev"><span>Previous week</span>${esc(prev.theme)}</a>` : '<span></span>'}
        ${next ? `<a href="#/${next.slug}" class="pg-next"><span>Next week</span>${esc(next.theme)}</a>` : '<span></span>'}
      </nav>`;

    const tabs = [...app.querySelectorAll('[role=tab]')];
    const show = key => {
      tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.reading === key));
      loadPassage(week.readings.find(r => r.key === key));
    };
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.reading)));
    show('gospel');

    app.querySelector('#admin-off')?.addEventListener('click', () => { store.set('sbc-admin', null); renderWeek(week); });

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
        const { reflection } = await api('/api/reflections', {
          method: 'POST',
          body: { week: week.slug, name: form.name.value, reading: form.reading.value, body: form.body.value, website: form.website.value },
        });
        form.body.value = '';
        msg.textContent = 'Thank you for sharing.';
        state.focusId = reflection?.id || null;
        await loadReflections(week);
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });

    loadReflections(week);
  }

  async function loadPassage(reading) {
    const box = app.querySelector('#passage');
    const q = reading.query || reading.ref;
    const fallbackLink = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(q)}&version=NRSVUE`;
    const head = `<header class="passage-head"><p class="kicker">${esc(reading.label)}</p><h2>${esc(reading.ref)}</h2></header>`;
    if (!scriptureCache.has(q)) {
      box.innerHTML = head + '<p class="loading">Loading the text…</p>';
      scriptureCache.set(q, fetch(`/api/scripture?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ html: null, link: fallbackLink })));
    }
    const data = await scriptureCache.get(q);
    if (!app.querySelector(`[role=tab][data-reading="${reading.key}"][aria-selected=true]`)) return;
    const note = /\d[a-c]\b/.test(reading.ref)
      ? `<p class="part-note">The lectionary reading is ${esc(reading.ref)}; the full verse is shown here.</p>` : '';
    box.innerHTML = head + (data.html
      ? `<div class="passage-body">${data.html}</div>${note}<p class="src">NRSVue · <a href="${data.link}" target="_blank" rel="noopener">Open on Bible Gateway</a></p>`
      : `<p>The text didn't load. <a href="${data.link || fallbackLink}" target="_blank" rel="noopener">Read ${esc(reading.ref)} on Bible Gateway</a>.</p>`);
    box.scrollTop = 0;
  }

  // ---------- Reflections ----------
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

    app.querySelector('#conv-count').textContent = tops.length ? `(${tops.length})` : '';
    const used = week.readings.filter(r => tops.some(p => p.reading === r.key));
    filters.innerHTML = used.length ? [['', 'All'], ...used.map(r => [r.key, r.ref])]
      .map(([k, l]) => `<button data-f="${k}" aria-pressed="${state.filter === k}">${esc(l)}</button>`).join('') : '';
    filters.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.f; drawReflections(week); }));

    if (!tops.length) {
      list.innerHTML = '<div class="quiet"><p>Nobody has written about these texts yet. Yours could be the first reflection the class reads.</p></div>';
      return;
    }
    const shown = state.filter ? tops.filter(p => p.reading === state.filter) : tops;
    const del = p => adminKey() ? `<button class="linkish danger" data-del="${p.id}">Delete</button>` : '';
    const byline = (p, small) => `
      <header class="byline">
        ${avatar(p.name, small)}
        <span class="by-text"><strong>${esc(p.name)}</strong><span class="meta">${fmtStamp(p.createdAt)}${p.reading ? ` · on ${esc(label(p.reading))}` : ''}${fresh(p) ? ' <span class="new">New</span>' : ''}</span></span>
        ${small ? del(p) : ''}
      </header>`;
    list.innerHTML = shown.map(p => `
      <article class="post" id="p-${p.id}">
        ${byline(p)}
        <div class="body">${paras(p.body)}</div>
        ${replies(p.id).length ? `<div class="replies">${replies(p.id).map(r => `
          <div class="reply" id="p-${r.id}">${byline(r, true)}<div class="body">${paras(r.body)}</div></div>`).join('')}</div>` : ''}
        <footer class="post-actions"><button class="linkish" data-reply="${p.id}">Reply</button>${del(p)}</footer>
        <form class="reply-form" data-parent="${p.id}" hidden>
          <div class="row">
            <label>Your name<input name="name" maxlength="60" autocomplete="name" required></label>
          </div>
          <label class="sr-only">Reply</label>
          <textarea name="body" rows="3" maxlength="8000" required placeholder="Write a reply…"></textarea>
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
        const { reflection } = await api('/api/reflections', { method: 'POST', body: { week: week.slug, name: f.name.value, body: f.body.value, parentId: f.dataset.parent } });
        state.focusId = reflection?.id || null;
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
    const target = slug === 'this-week' ? currentWeek() : weeks.find(w => w.slug === slug);
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active',
      a.dataset.nav === slug || (a.dataset.nav === 'this-week' && target === currentWeek() && !!target)));
    if (target) {
      renderWeek(target, postId);
      window.scrollTo(0, 0);
    } else {
      renderHome(['season', 'about'].includes(slug) ? slug : null);
      if (!['season', 'about'].includes(slug)) window.scrollTo(0, 0);
    }
  }

  fetch('/weeks.json').then(r => r.json()).then(d => {
    weeks = d.weeks;
    window.addEventListener('hashchange', route);
    route();
  }).catch(() => { app.innerHTML = '<p class="wrap empty">The page didn\'t load. Please refresh.</p>'; });
})();
