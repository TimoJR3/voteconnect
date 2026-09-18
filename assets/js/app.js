/* VoteConnect — интерактивный прототип (vanilla JS, без сборки). */
(function () {
  "use strict";
  const D = window.VC_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toLocaleString("ru-RU");
  const cand = (id) => D.candidates.find((c) => c.id === id);
  const topic = (id) => D.topics.find((t) => t.id === id);
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--primary)"/><path d="M9 16.5l4.5 4.5L23 11" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Vote<b>Connect</b></span>`;

  /* ---------- Состояние (хранится только в браузере пользователя) ---------- */
  const KEY = "voteconnect-demo-v1";
  const defaults = () => ({
    compass: {}, weights: {}, consensus: {}, polls: {}, likes: {}, supported: {},
    academy: {}, badges: {}, xp: 0, going: {}, posts: [], args: [], myInitiatives: [],
    privacy: { views: "me", activity: "friends", matches: "me" },
    profile: null, readNotifs: {}, comments: {}, commentLikes: {}, answered: {}
  });
  let S = defaults();
  try {
    if (/[?&]reset=1/.test(location.search)) localStorage.removeItem(KEY);
    const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(defaults(), JSON.parse(raw));
  } catch (e) { /* приватный режим */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }
  function addXP(n) { S.xp += n; save(); }
  function award(id) {
    if (S.badges[id]) return;
    S.badges[id] = true; addXP(25);
    const b = D.badges.find((x) => x.id === id);
    toast(`${b.icon} Новый значок: «${b.name}» · +25 XP`);
  }
  const level = () => Math.floor(S.xp / 100) + 1;
  const myName = () => (S.profile && S.profile.name) || "Гость";
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  const myAva = () => initials(myName());

  /* ---------- Таймеры «живых» данных ---------- */
  let timers = [];
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

  /* ---------- Каркас ---------- */
  $$("[data-logo]").forEach((el) => (el.innerHTML = LOGO));
  const daysLeft = Math.max(0, Math.ceil((new Date(D.election.date + "T08:00:00") - new Date()) / 864e5));
  $("#countdown").innerHTML = `
    <div class="small" style="opacity:.85">До выборов в городской совет</div>
    <div class="num">${daysLeft} дн.</div>
    <div class="small" style="opacity:.85;margin-top:6px">8 ноября 2026 · ${esc(D.district)}</div>`;
  $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  function topbar(title, sub, extra = "") {
    const unread = D.notifications.filter((n) => !S.readNotifs[n.id]).length;
    return `<div class="topbar"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="spacer"></div>${extra}
      <button class="icon-btn" data-search aria-label="Поиск" title="Поиск (Ctrl+K)">🔍</button>
      <button class="icon-btn bell" data-bell aria-label="Уведомления">🔔${unread ? `<span class="dot">${unread}</span>` : ""}</button>
      <button class="icon-btn" data-theme-toggle aria-label="Сменить тему">◐</button></div>`;
  }
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; }
  try { applyTheme(localStorage.getItem("vc-theme")); } catch (e) { /* ignore */ }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-theme-toggle]")) return;
    const dark = getComputedStyle(document.documentElement).colorScheme === "dark";
    const next = dark ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("vc-theme", next); } catch (err) { /* ignore */ }
  });

  /* ---------- Компас: расчёт совпадений ---------- */
  function compassDone() { return Object.keys(S.compass).length >= Math.ceil(D.compass.length * 0.6); }
  function matches() {
    return D.candidates.map((c) => {
      let dist = 0, max = 0;
      D.compass.forEach((st, i) => {
        const u = S.compass[i];
        if (u === undefined || u === null) return;
        const w = S.weights[i] ? 2 : 1;
        dist += w * Math.abs(u - c.positions[i]); max += w * 4;
      });
      return { c, pct: max ? Math.round((1 - dist / max) * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct);
  }
  const POS = { "-2": ["Против", "bad"], "-1": ["Скорее против", "bad"], "0": ["Нейтрально", ""], "1": ["Скорее за", "ok"], "2": ["За", "ok"] };
  const posChip = (v) => (v === undefined || v === null) ? `<span class="chip pos">—</span>` : `<span class="chip pos ${POS[v][1]}">${POS[v][0]}</span>`;

  /* ==========================================================
     ЭКРАНЫ
     ========================================================== */
  const views = {};

  /* ---------- Лента ---------- */
  let feedSort = "bridge";
  views.feed = () => {
    const posts = [...S.posts, ...D.feed];
    const sorted = feedSort === "bridge" ? [...posts].sort((a, b) => (b.bridge ?? .5) - (a.bridge ?? .5))
      : feedSort === "verified" ? posts.filter((p) => p.verified) : posts;
    const top = compassDone() ? matches()[0] : null;
    return topbar("Лента", `${esc(D.city)} · ${esc(D.district)}`) + `
    <div class="layout">
      <div class="stack">
        <div class="card composer">
          <div class="row" style="align-items:flex-start">
            <div class="avatar">${esc(myAva())}</div>
            <div style="flex:1">
              <textarea id="postText" placeholder="Что важно для вашего района? Предложите идею или задайте вопрос кандидатам…" maxlength="500"></textarea>
              <div class="row" style="margin-top:8px">
                <select id="postTopic" class="chip" style="border:none;padding:.4em .8em">
                  <option value="">Без темы</option>${D.topics.map((t) => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join("")}
                </select>
                <span class="spacer"></span>
                <span class="small muted" id="toneHint"></span>
                <button class="btn small" id="postBtn">Опубликовать</button>
              </div>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="tabs" role="tablist">
            <button data-sort="bridge" class="${feedSort === "bridge" ? "active" : ""}">🌉 Объединяющее</button>
            <button data-sort="new" class="${feedSort === "new" ? "active" : ""}">🕒 Новое</button>
            <button data-sort="verified" class="${feedSort === "verified" ? "active" : ""}">✔ С источниками</button>
          </div>
        </div>
        ${feedSort === "bridge" ? `<div class="explain small"><b>Как работает «Объединяющее»:</b> выше поднимаются посты, которые одобряют люди с <i>разными</i> взглядами, а не просто самые залайканные. Так вместо «эхо-камер» лента показывает то, что объединяет округ.</div>` : ""}
        ${sorted.map(postCard).join("")}
      </div>
      <div class="stack">
        ${top ? `<div class="card"><div class="small muted" style="font-weight:700">ВАШЕ СОВПАДЕНИЕ ПО КОМПАСУ</div>
          <div class="row" style="margin-top:10px"><div class="avatar">${top.c.avatar}</div><div><b>${esc(top.c.name)}</b><div class="small muted">${esc(D.parties[top.c.party].name)}</div></div><span class="spacer"></span><b style="font-size:22px;color:var(--primary)">${top.pct}%</b></div>
          <a class="btn soft small" style="margin-top:12px" href="#/compass">Смотреть всех</a></div>`
        : `<div class="card"><h3>🧭 За кого голосовать?</h3><p class="muted small">Ответьте на 12 утверждений о жизни города — и узнайте, чьи позиции ближе к вашим. Ответы не покидают ваше устройство.</p><a class="btn" href="#/compass">Пройти Компас · 3 мин</a></div>`}
        <div class="card"><h3>📣 Набирают поддержку</h3>
          ${D.initiatives.slice(0, 3).map((i) => `<div style="margin:10px 0"><a href="#/initiatives"><b>${esc(i.title)}</b></a><div class="bar" style="margin:6px 0"><span style="width:${Math.min(100, i.support / i.goal * 100)}%"></span></div><div class="small muted">${fmt(i.support)} из ${fmt(i.goal)}</div></div>`).join("")}
        </div>
        <div class="card"><h3>📅 Скоро</h3>${upcoming(3)}</div>
      </div>
    </div>`;
  };
  function postCard(p) {
    const c = p.candidate ? cand(p.candidate) : null;
    const t = p.topic ? topic(p.topic) : null;
    const liked = S.likes[p.id];
    const typeChip = p.type === "official" ? `<span class="chip primary">🏛 Официально</span>` : c ? `<span class="chip"><i class="party-dot" style="background:${D.parties[c.party].color}"></i>Кандидат</span>` : "";
    return `<article class="card post fade-in ${p.flagged ? "flagged" : ""}">
      <div class="post-head">
        <div class="avatar" style="${p.flagged ? "background:var(--muted)" : ""}">${esc(p.avatar)}</div>
        <div><div class="name">${c ? `<a href="#/candidate/${c.id}" style="color:inherit">${esc(p.author)}</a>` : esc(p.author)} ${c && c.verified ? "<span title='Личность подтверждена'>☑️</span>" : ""}</div>
        <div class="small muted">${esc(p.time)}${t ? ` · ${t.icon} ${t.name}` : ""}</div></div>
        <span class="spacer"></span>${typeChip}
      </div>
      <div class="post-text">${esc(p.text)}</div>
      ${p.note ? `<div class="note ${p.flagged ? "bad" : ""}">${p.flagged ? "⛔" : "ℹ️"} ${esc(p.note)}</div>` : ""}
      <div class="row">
        ${p.verified ? `<span class="chip ok">✔ ${esc(p.verified)}</span>` : ""}
        <div class="bridge-meter" title="Доля одобрения среди людей с разными взглядами">🌉 Мост
          ${p.bridge == null ? `<span>считаем…</span>` : `<div class="bar"><span style="width:${p.bridge * 100}%"></span></div><span>${Math.round(p.bridge * 100)}%</span>`}
        </div>
      </div>
      <div class="post-actions">
        <button data-like="${p.id}" class="${liked ? "on" : ""}">${liked ? "❤️" : "🤍"} ${fmt(p.likes + (liked ? 1 : 0))}</button>
        <button data-cm="${p.id}" class="${openThreads[p.id] ? "on-soft" : ""}">💬 ${fmt(p.comments + (S.comments[p.id] || []).length)}</button>
        <button data-share="${p.id}">↗ Поделиться</button>
        <span class="spacer"></span>
        ${!p.flagged ? `<button data-note="${p.id}" title="Добавить контекст с источником">📝 Добавить контекст</button>` : ""}
      </div>
      ${openThreads[p.id] ? threadHTML(p) : ""}
    </article>`;
  }
  const openThreads = {};
  function threadHTML(p) {
    const list = [...(D.comments[p.id] || []), ...(S.comments[p.id] || [])];
    return `<div class="thread fade-in">
      ${list.map((c, i) => { const k = p.id + ":" + i, liked = S.commentLikes[k]; const cc = c.candidate ? cand(c.candidate) : null;
        return `<div class="comment"><div class="avatar sm" style="${cc ? `background:${D.parties[cc.party].color}` : ""}">${esc(c.avatar)}</div>
        <div class="bubble"><div class="row" style="gap:6px"><b>${esc(c.author)}</b>${cc ? `<span class="chip">Кандидат</span>` : ""}<span class="small muted">${esc(c.time)}</span></div>
        <div>${esc(c.text)}</div><button class="link-btn ${liked ? "on" : ""}" data-cl="${k}">${liked ? "❤️" : "🤍"} ${c.likes + (liked ? 1 : 0)}</button></div></div>`; }).join("") || `<p class="small muted">Комментариев пока нет — будьте первым.</p>`}
      <div class="comment"><div class="avatar sm">${esc(myAva())}</div><div style="flex:1;display:flex;gap:8px"><input class="cm-input" data-ci="${p.id}" placeholder="Написать комментарий…" maxlength="300"><button class="btn small" data-cs="${p.id}">➤</button></div></div>
    </div>`;
  }
  const RUDE = ["идиот", "дурак", "туп", "бред", "заткнись", "дебил", "позор", "клоун"];
  const isRude = (s) => RUDE.some((w) => s.toLowerCase().includes(w));
  function bindFeed() {
    const ta = $("#postText");
    ta.addEventListener("input", () => {
      $("#toneHint").innerHTML = isRude(ta.value) ? `<span style="color:var(--warn)">🤖 Похоже на переход на личности — переформулируете?</span>` : "";
    });
    $("#postBtn").addEventListener("click", () => {
      const text = ta.value.trim();
      if (text.length < 5) return toast("Напишите чуть подробнее");
      if (isRude(text)) return toast("🤖 ИИ-модератор: давайте обсуждать идеи, а не людей");
      S.posts.unshift({ id: "u" + Date.now(), type: "citizen", author: myName(), avatar: myAva(), time: "только что", text, topic: $("#postTopic").value || null, verified: null, bridge: null, likes: 0, comments: 0 });
      save(); addXP(5); toast("Опубликовано · +5 XP"); render();
    });
    $$("[data-sort]").forEach((b) => b.addEventListener("click", () => { feedSort = b.dataset.sort; render(); }));
    $$("[data-like]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.like; S.likes[id] = !S.likes[id]; save(); render(); }));
    $$("[data-share]").forEach((b) => b.addEventListener("click", async () => {
      const url = location.href.split("#")[0] + "#/feed";
      try { await navigator.clipboard.writeText(url); toast("Ссылка скопирована"); } catch (e) { toast(url); }
    }));
    $$("[data-note]").forEach((b) => b.addEventListener("click", () => toast("Контекст публикуется, когда его одобрят люди с разными взглядами")));
    $$("[data-cm]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.cm; openThreads[id] = !openThreads[id]; render(); const i = $(`[data-ci="${id}"]`); if (i) i.focus(); }));
    $$("[data-cl]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.cl; S.commentLikes[k] = !S.commentLikes[k]; save(); render(); }));
    const send = (id) => {
      const inp = $(`[data-ci="${id}"]`), text = inp.value.trim();
      if (text.length < 2) return;
      if (isRude(text)) return toast("🤖 ИИ-модератор: похоже на оскорбление — переформулируйте");
      (S.comments[id] = S.comments[id] || []).push({ author: myName(), avatar: myAva(), text, likes: 0, time: "сейчас" });
      save(); addXP(2); render(); const n = $(`[data-ci="${id}"]`); if (n) n.focus();
    };
    $$("[data-cs]").forEach((b) => b.addEventListener("click", () => send(b.dataset.cs)));
    $$("[data-ci]").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") send(i.dataset.ci); }));
  }

  /* ---------- Компас взглядов ---------- */
  let cq = 0;
  views.compass = () => {
    const n = D.compass.length;
    if (cq >= n || (cq === 0 && compassDone() && location.hash.indexOf("retake") < 0)) return compassResults();
    const st = D.compass[cq], t = topic(st.topic), cur = S.compass[cq];
    return topbar("Компас взглядов", "Сравните свои позиции с позициями кандидатов округа") + `
    <div class="layout"><div class="card fade-in">
      <div class="progress-dots">${D.compass.map((_, i) => `<i class="${i < cq ? "done" : i === cq ? "cur" : ""}"></i>`).join("")}</div>
      <div class="row" style="margin-top:18px"><span class="chip">${t.icon} ${t.name}</span><span class="small muted">Утверждение ${cq + 1} из ${n}</span></div>
      <div class="statement">${esc(st.text)}</div>
      <div class="scale">
        ${[[-2, "Полностью против"], [-1, "Скорее против"], [0, "Нейтрально"], [1, "Скорее за"], [2, "Полностью за"]].map(([v, l]) => `<button data-ans="${v}" class="${cur === v ? "sel" : ""}">${l}</button>`).join("")}
      </div>
      <div class="row" style="margin-top:18px">
        <label class="row small" style="gap:8px;font-weight:700"><input type="checkbox" id="imp" ${S.weights[cq] ? "checked" : ""}> Для меня это особенно важно (×2)</label>
        <span class="spacer"></span>
        ${cq > 0 ? `<button class="btn ghost small" id="prevQ">← Назад</button>` : ""}
        <button class="btn ghost small" id="skipQ">Пропустить</button>
      </div>
    </div>
    <div class="stack">
      <div class="explain small"><b>🔒 Приватность по умолчанию.</b> Ответы считаются прямо в вашем браузере и никуда не отправляются. Политические взгляды — чувствительные данные, поэтому VoteConnect не хранит их на сервере без явного согласия.</div>
      <div class="card small"><b>Откуда позиции кандидатов?</b><p class="muted" style="margin:6px 0 0">Каждый кандидат заполняет ту же анкету и прикладывает обоснование. Редакция сверяет ответы с публичными заявлениями и голосованиями — расхождения помечаются.</p></div>
    </div></div>`;
  };
  function compassResults() {
    const m = matches();
    return topbar("Ваши совпадения", `Учтено ответов: ${Object.keys(S.compass).length} из ${D.compass.length}`, `<a class="btn ghost small" href="#/compass/retake" id="retake">Пройти заново</a>`) + `
    <div class="layout"><div class="stack">
      ${m.map((x, i) => `<div class="card fade-in match" style="animation-delay:${i * 60}ms">
        <div class="avatar lg" style="background:${D.parties[x.c.party].color}">${x.c.avatar}</div>
        <div><b style="font-size:17px"><a href="#/candidate/${x.c.id}" style="color:inherit">${esc(x.c.name)}</a></b>
          <div class="small muted"><i class="party-dot" style="background:${D.parties[x.c.party].color}"></i>${esc(D.parties[x.c.party].name)} · ${esc(x.c.role)}</div>
          <div class="bar" style="margin-top:8px"><span style="width:${x.pct}%;background:${D.parties[x.c.party].color}"></span></div></div>
        <div class="pct">${x.pct}%</div></div>`).join("")}
      <div class="card"><h3>Где вы совпадаете и расходитесь с лидером</h3>
        <div style="overflow-x:auto"><table class="diff-table"><thead><tr><th>Утверждение</th><th>Вы</th><th>${esc(m[0].c.name.split(" ")[0])}</th></tr></thead><tbody>
        ${D.compass.map((st, i) => `<tr><td>${esc(st.text)}${S.weights[i] ? " <b title='Важно'>★</b>" : ""}</td><td>${posChip(S.compass[i])}</td><td>${posChip(m[0].c.positions[i])}</td></tr>`).join("")}
        </tbody></table></div></div>
    </div>
    <div class="stack">
      <div class="card"><h3>Что дальше?</h3>
        <p class="small muted">Совпадение — повод присмотреться, а не готовый ответ. Сравните обещания и прошлые результаты кандидатов.</p>
        <div class="stack" style="gap:8px"><a class="btn soft" href="#/promises">✅ Проверить обещания</a><a class="btn soft" href="#/calendar">📅 Сходить на дебаты</a><a class="btn soft" href="#/candidate/${m[0].c.id}">❓ Задать вопрос кандидату</a></div></div>
      <div class="explain small"><b>Методика.</b> Для каждого утверждения считаем расстояние между вашим ответом и ответом кандидата (шкала от −2 до +2), важные темы учитываются с весом ×2. Методика открыта и лежит в репозитории проекта.</div>
    </div></div>`;
  }
  function bindCompass() {
    const r = $("#retake");
    if (r) r.addEventListener("click", (e) => { e.preventDefault(); cq = 0; S.compass = {}; S.weights = {}; save(); location.hash = "#/compass/retake"; render(); });
    const next = () => { cq++; if (cq >= D.compass.length) { award("compass"); location.hash = "#/compass"; } render(); };
    $$("[data-ans]").forEach((b) => b.addEventListener("click", () => {
      S.compass[cq] = Number(b.dataset.ans); S.weights[cq] = $("#imp").checked; save(); next();
    }));
    const skip = $("#skipQ"); if (skip) skip.addEventListener("click", () => { delete S.compass[cq]; save(); next(); });
    const prev = $("#prevQ"); if (prev) prev.addEventListener("click", () => { cq--; render(); });
  }

  /* ---------- Карта согласия (в духе Pol.is) ---------- */
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
  let crowd = null, crowdCount = 0;
  function makeCrowd() {
    const r = rng(42), pts = [];
    D.consensus.clusters.forEach((cl, ci) => {
      for (let i = 0; i < cl.size; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.33;
        pts.push({ x: cl.center[0] + Math.cos(a) * d, y: cl.center[1] + Math.sin(a) * d * 0.85, c: ci });
      }
    });
    crowdCount = 1847; return pts;
  }
  function userPos() {
    const v = S.consensus; let x = 0, y = 0, n = 0;
    D.consensus.statements.forEach((s) => { if (v[s.id] === 1 || v[s.id] === -1) { x += v[s.id] * s.load[0]; y += v[s.id] * s.load[1]; n++; } });
    if (!n) return null;
    return { x: Math.max(-1, Math.min(1, (x / n) * 1.25)), y: Math.max(-1, Math.min(1, (y / n) * 1.25)), n };
  }
  function nearestCluster(p) {
    let best = 0, bd = 9;
    D.consensus.clusters.forEach((c, i) => { const d = Math.hypot(c.center[0] - p.x, c.center[1] - p.y); if (d < bd) { bd = d; best = i; } });
    return D.consensus.clusters[best];
  }
  function cmapSVG() {
    const W = 540, H = 400, sx = (x) => W / 2 + x * W * 0.42, sy = (y) => H / 2 - y * H * 0.42;
    const up = userPos();
    return `<svg class="cmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Карта мнений участников">
      <line x1="${W / 2}" y1="16" x2="${W / 2}" y2="${H - 16}" stroke="var(--border)" stroke-dasharray="4 6"/>
      <line x1="16" y1="${H / 2}" x2="${W - 16}" y2="${H / 2}" stroke="var(--border)" stroke-dasharray="4 6"/>
      ${D.consensus.clusters.map((c) => `<ellipse cx="${sx(c.center[0])}" cy="${sy(c.center[1])}" rx="${W * 0.17}" ry="${H * 0.15}" fill="${c.color}" opacity=".10"/>
        <text x="${sx(c.center[0])}" y="${sy(c.center[1]) - H * 0.16}" text-anchor="middle" font-size="13" font-weight="800" fill="${c.color}">${c.name}</text>`).join("")}
      <g id="crowd">${crowd.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4" fill="${D.consensus.clusters[p.c].color}" opacity=".75"/>`).join("")}</g>
      ${up ? `<g><circle cx="${sx(up.x)}" cy="${sy(up.y)}" r="16" fill="var(--accent)" opacity=".25"><animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite"/></circle>
        <circle cx="${sx(up.x)}" cy="${sy(up.y)}" r="8" fill="var(--accent)" stroke="#fff" stroke-width="2.5"/>
        <text x="${sx(up.x)}" y="${sy(up.y) + 26}" text-anchor="middle" font-size="13" font-weight="800" fill="var(--text)">Вы</text></g>` : ""}
    </svg>`;
  }
  views.consensus = () => {
    if (!crowd) crowd = makeCrowd();
    const C = D.consensus, up = userPos();
    const common = C.statements.filter((s) => C.clusters.every((c) => c.agree[s.id] >= 0.7));
    const divisive = C.statements.map((s) => { const v = C.clusters.map((c) => c.agree[s.id]); return { s, gap: Math.max(...v) - Math.min(...v) }; })
      .filter((x) => x.gap >= 0.6).sort((a, b) => b.gap - a.gap);
    const bars = (s) => `<div class="cluster-bars" title="Доля «за» в каждой группе">${C.clusters.map((c) => `<span style="height:${Math.max(3, c.agree[s.id] * 34)}px;background:${c.color}"></span>`).join("")}</div>`;
    return topbar("Карта согласия", `Вопрос недели: «${esc(C.question)}»`, `<span class="live" id="liveCount">${fmt(crowdCount)} участников</span>`) + `
    <div class="layout"><div class="stack">
      <div class="card">
        ${cmapSVG()}
        <div class="row" style="margin-top:12px"><div class="legend">${C.clusters.map((c) => `<span><i style="background:${c.color}"></i>${c.name} ${esc(c.label)}</span>`).join("")}</div></div>
        ${up ? `<div class="explain small" style="margin-top:12px"><b>Вы ближе всего к группе «${esc(nearestCluster(up).label.replace(/[«»]/g, ""))}»</b> — но посмотрите: по многим вопросам вы согласны и с другими группами.</div>`
        : `<p class="small muted" style="margin:12px 0 0">Проголосуйте хотя бы по одному утверждению — и появитесь на карте.</p>`}
      </div>
      <div class="card"><h3>Ваше мнение</h3><p class="small muted">Здесь нет комментариев и ответов — только короткие утверждения и голоса. Алгоритм сам находит группы мнений и то, что их объединяет.</p>
        ${C.statements.map((s) => { const v = S.consensus[s.id]; return `<div class="vote-row"><div>${esc(s.text)}</div><div class="vote-btns">
          <button data-cv="${s.id}:1" class="${v === 1 ? "sel a" : ""}">👍 За</button><button data-cv="${s.id}:-1" class="${v === -1 ? "sel d" : ""}">👎 Против</button><button data-cv="${s.id}:0" class="${v === 0 ? "sel p" : ""}">Пропуск</button></div></div>`; }).join("")}
      </div>
    </div>
    <div class="stack">
      <div class="card" id="commonCard"><h3>🤝 Точки согласия</h3><p class="small muted">Поддержаны больше чем 70% в <b>каждой</b> группе — отличный старт для депутатов.</p>
        ${common.map((s) => `<div class="row" style="flex-wrap:nowrap;padding:8px 0;border-bottom:1px solid var(--border)"><div class="small" style="flex:1"><b>${esc(s.text)}</b></div>${bars(s)}</div>`).join("")}</div>
      <div class="card"><h3>⚡ Где мнения расходятся</h3>
        ${divisive.map((x) => `<div class="row" style="flex-wrap:nowrap;padding:8px 0;border-bottom:1px solid var(--border)"><div class="small" style="flex:1">${esc(x.s.text)}</div>${bars(x.s)}</div>`).join("")}</div>
      <div class="explain small"><b>Зачем это грантодателю?</b> Карта превращает тысячи голосов в понятный отчёт для городского совета: что поддерживают все и где нужен диалог.</div>
    </div></div>`;
  };
  function bindConsensus() {
    $$("[data-cv]").forEach((b) => b.addEventListener("click", () => {
      const [id, v] = b.dataset.cv.split(":"); S.consensus[id] = Number(v); save(); award("consensus"); render();
    }));
    every(() => {
      const ci = Math.floor(Math.random() * 3), c = D.consensus.clusters[ci], a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 0.33;
      crowd.push({ x: c.center[0] + Math.cos(a) * d, y: c.center[1] + Math.sin(a) * d * 0.85, c: ci });
      crowdCount++;
      const g = $("#crowd"); if (!g) return;
      const W = 540, H = 400, p = crowd[crowd.length - 1];
      const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      el.setAttribute("cx", (W / 2 + p.x * W * 0.42).toFixed(1)); el.setAttribute("cy", (H / 2 - p.y * H * 0.42).toFixed(1));
      el.setAttribute("r", "4"); el.setAttribute("fill", c.color); el.setAttribute("opacity", ".75");
      el.innerHTML = `<animate attributeName="r" values="0;9;4" dur=".8s"/>`;
      g.appendChild(el);
      $("#liveCount").textContent = `${fmt(crowdCount)} участников`;
    }, 2500);
  }

  /* ---------- Опросы ---------- */
  const pollVotes = D.polls.map((p) => p.votes.slice());
  views.polls = () => topbar("Опросы", "Результаты обновляются в реальном времени", `<span class="live">В эфире</span>`) + `
    <div class="grid two">${D.polls.map((p, pi) => {
      const mine = S.polls[p.id], votes = pollVotes[pi].map((v, i) => v + (mine === i ? 1 : 0)), total = votes.reduce((a, b) => a + b, 0);
      return `<div class="card" data-poll="${pi}"><h3>${esc(p.text)}</h3>
        ${p.options.map((o, i) => `<button class="poll-opt ${mine === i ? "mine" : ""}" data-pv="${pi}:${i}" ${mine !== undefined ? "aria-disabled='true'" : ""}>
          <span class="fill" style="width:${mine !== undefined ? (votes[i] / total * 100).toFixed(1) : 0}%"></span>
          <span>${mine === i ? "✓ " : ""}${esc(o)}</span><span data-pct>${mine !== undefined ? Math.round(votes[i] / total * 100) + "%" : ""}</span></button>`).join("")}
        <div class="small muted" data-total>${mine !== undefined ? `Проголосовало: ${fmt(total)}` : "Проголосуйте, чтобы увидеть результаты — так они меньше влияют на ваш выбор"}</div></div>`;
    }).join("")}
      <div class="card"><h3>🔐 Как защищены опросы</h3><ul class="small muted" style="padding-left:18px;margin:0">
        <li>Один человек — один голос: подтверждённый аккаунт, без хранения паспортных данных.</li>
        <li>Результаты видны после голосования — меньше «эффекта толпы».</li>
        <li>Обнаружение бот-ферм по аномалиям активности, открытый отчёт о снятых голосах.</li>
        <li>Опросы платформы — не выборы и не подменяют официальное голосование.</li></ul></div>
    </div>`;
  function bindPolls() {
    $$("[data-pv]").forEach((b) => b.addEventListener("click", () => {
      const [pi, i] = b.dataset.pv.split(":").map(Number), id = D.polls[pi].id;
      if (S.polls[id] !== undefined) return;
      S.polls[id] = i; save(); addXP(3); render();
    }));
    every(() => {
      D.polls.forEach((p, pi) => {
        const i = Math.floor(Math.random() * p.options.length); pollVotes[pi][i] += 1 + Math.floor(Math.random() * 3);
        const mine = S.polls[p.id]; if (mine === undefined) return;
        const card = $(`[data-poll="${pi}"]`); if (!card) return;
        const votes = pollVotes[pi].map((v, k) => v + (mine === k ? 1 : 0)), total = votes.reduce((a, b) => a + b, 0);
        $$(".poll-opt", card).forEach((el, k) => { $(".fill", el).style.width = (votes[k] / total * 100).toFixed(1) + "%"; $("[data-pct]", el).textContent = Math.round(votes[k] / total * 100) + "%"; });
        $("[data-total]", card).textContent = `Проголосовало: ${fmt(total)}`;
      });
    }, 1800);
  }

  /* ---------- Кандидаты ---------- */
  let candTopic = "";
  views.candidates = () => {
    const m = compassDone() ? Object.fromEntries(matches().map((x) => [x.c.id, x.pct])) : null;
    const list = D.candidates.filter((c) => !candTopic || c.focus.includes(candTopic));
    return topbar("Кандидаты округа", esc(D.district)) + `
    <div class="row" style="margin-bottom:16px"><div class="tabs"><button data-ct="" class="${!candTopic ? "active" : ""}">Все</button>
      ${D.topics.map((t) => `<button data-ct="${t.id}" class="${candTopic === t.id ? "active" : ""}">${t.icon} ${t.name}</button>`).join("")}</div></div>
    <div class="grid three">${list.map((c) => `<div class="card cand fade-in">
      <div class="row"><div class="avatar lg" style="background:${D.parties[c.party].color}">${c.avatar}</div>
        <div style="flex:1"><b style="font-size:17px">${esc(c.name)}</b> ${c.verified ? "☑️" : ""}<div class="small muted"><i class="party-dot" style="background:${D.parties[c.party].color}"></i>${esc(D.parties[c.party].name)}, ${c.age}</div></div>
        ${m ? `<div style="text-align:right"><b style="color:var(--primary);font-size:20px">${m[c.id]}%</b><div class="small muted">совпадение</div></div>` : ""}</div>
      <div class="small">${esc(c.role)}</div>
      <div class="row" style="gap:6px">${c.focus.map((f) => `<span class="chip">${topic(f).icon} ${topic(f).name}</span>`).join("")}</div>
      <div class="small muted">Отвечает на вопросы: <b style="color:var(--text)">${c.responseRate}%</b></div>
      <a class="btn soft small" href="#/candidate/${c.id}">Профиль и вопросы →</a></div>`).join("")}
    </div>`;
  };
  function bindCandidates() { $$("[data-ct]").forEach((b) => b.addEventListener("click", () => { candTopic = b.dataset.ct; render(); })); }

  const QA = {
    lebedeva: [["Что вы сделаете с автобусом 14?", "Предложу выделенную полосу на Садовой и публичный GPS-мониторинг — данные Павла уже показывают, где теряется время."]],
    vorontsov: [["Почему развязку исключили из бюджета?", "Бюджет 2026 года сокращён на 12%. Проект готов, будем добиваться включения в программу 2027 года."]],
    sokolova: [["Кто будет содержать новый парк?", "Предлагаю модель попечительского совета жителей и отдельную строку в бюджете района — расчёт опубликую до дебатов."]],
    orlov: [["Не приведёт ли снижение сборов к дыре в бюджете?", "По нашей модели выпадающие доходы компенсируются ростом числа зарегистрированных предприятий в течение двух лет."]],
    kuznetsov: [["Где взять врачей на вечерние приёмы?", "Часть смен готовы взять ординаторы медуниверситета — есть предварительная договорённость."]]
  };
  views.candidate = (id) => {
    const c = cand(id); if (!c) return views.candidates();
    const pr = D.promises.filter((p) => p.who === id), ev = D.events.filter((e) => e.org === c.name);
    return topbar(esc(c.name), `${esc(D.parties[c.party].name)} · ${esc(D.district)}`, `<a class="btn ghost small" href="#/candidates">← Все кандидаты</a>`) + `
    <div class="layout"><div class="stack">
      <div class="card"><div class="row"><div class="avatar lg" style="background:${D.parties[c.party].color}">${c.avatar}</div><div style="flex:1"><h2 style="margin:0">${esc(c.name)} ${c.verified ? "☑️" : ""}</h2><div class="muted">${esc(c.role)}</div></div>
        <button class="btn" id="followBtn">${S.going["f-" + id] ? "✓ Вы подписаны" : "+ Подписаться"}</button></div>
        <p style="margin-top:14px">${esc(c.bio)}</p>
        <div class="row">${c.focus.map((f) => `<span class="chip">${topic(f).icon} ${topic(f).name}</span>`).join("")}<span class="chip ok">Отвечает на ${c.responseRate}% вопросов</span></div></div>
      <div class="card"><h3>❓ Вопросы жителей</h3>
        ${(QA[id] || []).map(([q, a]) => `<div class="arg"><b>${esc(q)}</b><div class="small" style="margin-top:6px"><b>${esc(c.name.split(" ")[0])}:</b> ${esc(a)}</div></div>`).join("")}
        <label class="field" style="margin-top:8px">Ваш вопрос<textarea id="qText" placeholder="Вопросы с наибольшей поддержкой кандидат обязуется разобрать публично"></textarea></label>
        <button class="btn small" id="askBtn" style="margin-top:8px">Отправить вопрос</button></div>
      <div class="card"><h3>Позиции по Компасу</h3><div style="overflow-x:auto"><table class="diff-table"><tbody>
        ${D.compass.map((st, i) => `<tr><td>${esc(st.text)}</td><td>${posChip(c.positions[i])}</td>${compassDone() ? `<td>${posChip(S.compass[i])}<div class="small muted" style="text-align:center">вы</div></td>` : ""}</tr>`).join("")}</tbody></table></div></div>
    </div><div class="stack">
      <div class="card"><h3>✅ Обещания</h3>${pr.length ? pr.map(promiseRow).join("") : `<p class="small muted">Кандидат впервые участвует в выборах — обещания этой кампании появятся в трекере после регистрации.</p>`}</div>
      <div class="card"><h3>📅 Мероприятия</h3>${ev.length ? ev.map(eventRow).join("") : `<p class="small muted">Нет запланированных.</p>`}</div>
    </div></div>`;
  };
  function bindCandidate(id) {
    $("#followBtn").addEventListener("click", () => { S.going["f-" + id] = !S.going["f-" + id]; save(); render(); });
    $("#askBtn").addEventListener("click", () => {
      const q = $("#qText").value.trim(); if (q.length < 8) return toast("Сформулируйте вопрос подробнее");
      if (isRude(q)) return toast("🤖 ИИ-модератор: вопрос похож на оскорбление — переформулируйте");
      $("#qText").value = ""; addXP(5); toast("Вопрос отправлен. Сейчас его поддерживают 1 человек — вы!");
    });
    bindEventButtons();
  }

  /* ---------- Трекер обещаний ---------- */
  const ST = { done: ["Выполнено", "ok"], progress: ["В процессе", "warn"], broken: ["Не выполнено", "bad"] };
  function promiseRow(p) {
    const c = cand(p.who);
    return `<div class="promise"><div><b>${esc(p.text)}</b><div class="small muted">${esc(c.name)} · обещано в ${p.date} · источник: ${esc(p.source)}</div></div>
      <span class="chip ${ST[p.status][1]}">${ST[p.status][0]}</span>
      <div class="bar" style="grid-column:1/-1"><span style="width:${p.progress}%;background:var(--${ST[p.status][1]})"></span></div></div>`;
  }
  views.promises = () => {
    const cnt = (s) => D.promises.filter((p) => p.status === s).length;
    return topbar("Трекер обещаний", "Каждое обещание — с датой, статусом и источником") + `
    <div class="grid three" style="margin-bottom:16px">
      <div class="card"><div class="small muted">Выполнено</div><b style="font-size:32px;color:var(--ok)">${cnt("done")}</b></div>
      <div class="card"><div class="small muted">В процессе</div><b style="font-size:32px;color:var(--warn)">${cnt("progress")}</b></div>
      <div class="card"><div class="small muted">Не выполнено</div><b style="font-size:32px;color:var(--bad)">${cnt("broken")}</b></div>
    </div>
    <div class="layout"><div class="card">${D.promises.map(promiseRow).join("")}</div>
    <div class="stack"><div class="explain small"><b>Как это работает.</b> Обещания собираются из программ, выступлений и постов кандидатов. Статус меняется только со ссылкой на документ: протокол, бюджет, акт приёмки. Любой житель может предложить обновление — его проверяют волонтёры-фактчекеры.</div>
    <div class="card small"><b>Почему это важно</b><p class="muted" style="margin:6px 0 0">Трекер превращает выборы из разовой кампании в непрерывную подотчётность: избиратель видит не только обещания, но и их исполнение.</p></div></div></div>`;
  };

  /* ---------- Календарь ---------- */
  let calMonth = 8; // сентябрь 2026 (0 — январь)
  const TODAY = new Date();
  const todayISO = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;
  function eventRow(e) {
    const d = new Date(e.date + "T00:00:00"), i = D.events.indexOf(e);
    return `<div class="event-item"><div class="event-date"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()].slice(0, 3)}</small></div>
      <div><b>${esc(e.title)}</b><div class="small muted">${e.time} · ${esc(e.place)} · ${esc(e.org)}</div></div>
      <div class="row" style="gap:6px"><button class="btn small ${S.going["e" + i] ? "" : "ghost"}" data-go-ev="${i}">${S.going["e" + i] ? "✓ Иду" : "Пойду"}</button><button class="icon-btn" data-ics="${i}" title="Добавить в календарь (.ics)">⤓</button></div></div>`;
  }
  function upcoming(n) {
    return D.events.filter((e) => e.date >= todayISO).slice(0, n).map((e) => {
      const d = new Date(e.date + "T00:00:00");
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><b class="small">${d.getDate()} ${MONTHS[d.getMonth()]}, ${e.time}</b><div>${esc(e.title)}</div></div>`;
    }).join("") + `<a class="btn ghost small" style="margin-top:10px" href="#/calendar">Весь календарь</a>`;
  }
  views.calendar = () => {
    const y = 2026, first = new Date(y, calMonth, 1), days = new Date(y, calMonth + 1, 0).getDate(), off = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < off; i++) cells.push(`<div class="day empty"></div>`);
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const evs = D.events.filter((e) => e.date === iso);
      cells.push(`<div class="day ${iso === todayISO ? "today" : ""}"><span class="n">${d}</span>${evs.map((e) => `<button class="ev ev-${e.type}" data-ev="${D.events.indexOf(e)}" title="${esc(e.title)}">${esc(e.title)}</button>`).join("")}</div>`);
    }
    const monthEvents = D.events.filter((e) => new Date(e.date + "T00:00:00").getMonth() === calMonth);
    return topbar("Календарь событий", "Митинги, дебаты, встречи и важные даты") + `
    <div class="layout"><div class="stack">
      <div class="card">
        <div class="row" style="margin-bottom:12px"><button class="icon-btn" id="calPrev" ${calMonth <= 8 ? "disabled" : ""} aria-label="Предыдущий месяц">‹</button>
          <h3 style="margin:0;min-width:150px;text-align:center">${MONTHS_NOM[calMonth]} ${y}</h3>
          <button class="icon-btn" id="calNext" ${calMonth >= 10 ? "disabled" : ""} aria-label="Следующий месяц">›</button><span class="spacer"></span>
          <div class="legend">${["Важно", "Дебаты", "Встреча", "Обучение", "Акция"].map((t) => `<span><i class="ev-${t}"></i>${t}</span>`).join("")}</div></div>
        <div class="cal">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => `<div class="dow">${d}</div>`).join("")}${cells.join("")}</div>
      </div>
      <div class="card"><h3>События месяца</h3>${monthEvents.map(eventRow).join("") || `<p class="muted">Нет событий.</p>`}</div>
    </div><div class="stack">
      <div class="card"><h3>📍 Где мой участок?</h3><p class="small muted">Демо: введите улицу, чтобы найти участок и маршрут.</p>
        <label class="field">Улица<input id="street" placeholder="например, Садовая" list="streets"></label>
        <datalist id="streets"><option>Садовая</option><option>Ленинградская</option><option>Мира</option><option>Набережная</option></datalist>
        <button class="btn small" id="findBtn" style="margin-top:10px">Найти</button><div id="station" class="small" style="margin-top:10px"></div></div>
      <div class="explain small"><b>Напоминания.</b> Отметьте «Пойду» — и VoteConnect напомнит о событии. Кнопка ⤓ скачивает файл .ics для Google, Apple и Outlook-календаря.</div>
    </div></div>`;
  };
  function downloadICS(e) {
    const dt = e.date.replace(/-/g, "") + "T" + e.time.replace(":", "") + "00";
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VoteConnect//demo//RU", "BEGIN:VEVENT", `UID:${dt}-${Math.random().toString(36).slice(2)}@voteconnect`,
      `DTSTART:${dt}`, `SUMMARY:${e.title}`, `LOCATION:${e.place}`, `DESCRIPTION:Организатор: ${e.org}. VoteConnect (демо)`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "voteconnect-event.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    award("planner");
  }
  function bindEventButtons() {
    $$("[data-go-ev]").forEach((b) => b.addEventListener("click", () => { const k = "e" + b.dataset.goEv; S.going[k] = !S.going[k]; save(); if (S.going[k]) toast("Напомним за день до события"); render(); }));
    $$("[data-ics]").forEach((b) => b.addEventListener("click", () => downloadICS(D.events[b.dataset.ics])));
  }
  function bindCalendar() {
    const p = $("#calPrev"), n = $("#calNext");
    p.addEventListener("click", () => { calMonth = Math.max(8, calMonth - 1); render(); });
    n.addEventListener("click", () => { calMonth = Math.min(10, calMonth + 1); render(); });
    $$("[data-ev]").forEach((b) => b.addEventListener("click", () => { const e = D.events[b.dataset.ev]; toast(`${e.title} · ${e.time}, ${e.place}`); }));
    $("#findBtn").addEventListener("click", () => {
      const s = $("#street").value.trim(); if (!s) return;
      const num = 700 + (s.length * 7) % 40;
      $("#station").innerHTML = `<div class="arg"><b>Участок № ${num}</b><br>Школа № ${(s.length % 20) + 1}, ул. ${esc(s)}, д. ${(s.length * 3) % 50 + 1}<br><span class="muted">≈ 9 минут пешком · доступная среда ✓</span></div>`;
    });
    bindEventButtons();
  }

  /* ---------- Группы и дебаты ---------- */
  views.groups = () => topbar("Группы и дебаты", "Сообщества по темам и структурированные дискуссии") + `
    <div class="explain" style="margin-bottom:16px"><b>🌉 Правило моста.</b> Чтобы ответить в дебатах, нужно сначала своими словами пересказать позицию другой стороны. Это простое правило снижает токсичность и заставляет слышать друг друга.</div>
    <div class="grid three">${D.groups.map((g) => `<a class="card" href="#/group/${g.id}" style="color:inherit;text-decoration:none">
      <div style="font-size:30px">${topic(g.topic).icon}</div><h3>${esc(g.name)}</h3><p class="small muted">${esc(g.desc)}</p>
      <div class="row"><span class="chip">👥 ${fmt(g.members)}</span>${g.id === D.debate.group ? `<span class="chip accent">🔥 Идут дебаты</span>` : ""}</div></a>`).join("")}</div>`;
  views.group = (id) => {
    const g = D.groups.find((x) => x.id === id); if (!g) return views.groups();
    const db = D.debate, mine = S.args.filter((a) => a.group === id);
    const argHTML = (a) => `<div class="arg fade-in"><div class="row"><b>${esc(a.author)}</b><span class="spacer"></span><span class="chip">▲ ${a.score}</span></div>
      <div style="margin-top:6px">${esc(a.text)}</div><div class="understood">Как я понял(а) другую сторону: «${esc(a.understood)}»</div></div>`;
    const posts = D.feed.filter((p) => p.topic === g.topic);
    return topbar(`${topic(g.topic).icon} ${esc(g.name)}`, `${fmt(g.members)} участников · ${esc(g.desc)}`, `<a class="btn ghost small" href="#/groups">← Все группы</a>`) + `
    <div class="card" style="margin-bottom:16px"><div class="small muted" style="font-weight:800">ДЕБАТЫ НЕДЕЛИ</div>
      <h2 style="margin:6px 0 16px">«${esc(g.id === db.group ? db.thesis : "Какие три проблемы в этой теме нужно решить в первую очередь?")}»</h2>
      <div class="debate">
        <div class="col-pro"><h3>👍 За</h3>${(g.id === db.group ? db.pro : []).concat(mine.filter((a) => a.side === "pro")).map(argHTML).join("") || `<p class="small muted">Будьте первым.</p>`}</div>
        <div class="col-contra"><h3>👎 Против</h3>${(g.id === db.group ? db.contra : []).concat(mine.filter((a) => a.side === "contra")).map(argHTML).join("") || `<p class="small muted">Будьте первым.</p>`}</div>
      </div></div>
    <div class="layout"><div class="card"><h3>Добавить аргумент</h3>
      <div class="stack" style="gap:12px">
        <label class="field">Ваша сторона<select id="side"><option value="pro">За</option><option value="contra">Против</option></select></label>
        <label class="field">1. Как вы понимаете позицию другой стороны? <span class="small muted" style="font-weight:500">Правило моста: минимум 20 символов</span><textarea id="und" placeholder="Сторонники/противники считают, что…"></textarea></label>
        <label class="field">2. Ваш аргумент<textarea id="argt" placeholder="Факты, опыт, источники"></textarea></label>
        <div class="row"><span class="small muted" id="argHint"></span><span class="spacer"></span><button class="btn" id="argBtn" disabled>Опубликовать аргумент</button></div>
      </div></div>
      <div class="stack"><div class="card"><h3>Посты по теме</h3>${posts.map((p) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><b class="small">${esc(p.author)}</b><div class="small">${esc(p.text.slice(0, 120))}…</div></div>`).join("") || `<p class="small muted">Пока нет.</p>`}</div></div></div>`;
  };
  function bindGroup(id) {
    const und = $("#und"), argt = $("#argt"), btn = $("#argBtn"), hint = $("#argHint");
    const check = () => {
      const rude = isRude(und.value + " " + argt.value);
      btn.disabled = und.value.trim().length < 20 || argt.value.trim().length < 10 || rude;
      hint.innerHTML = rude ? `<span style="color:var(--warn)">🤖 Обсуждаем идеи, а не людей — переформулируйте</span>`
        : und.value.trim().length < 20 ? `Сначала перескажите позицию оппонента (${und.value.trim().length}/20)` : "✓ Правило моста соблюдено";
    };
    und.addEventListener("input", check); argt.addEventListener("input", check); check();
    btn.addEventListener("click", () => {
      S.args.push({ group: id, side: $("#side").value, author: myName(), text: argt.value.trim(), understood: und.value.trim(), score: 1 });
      save(); addXP(10); award("bridge"); render();
    });
  }

  /* ---------- «Голосуй за меня»: гражданские инициативы ---------- */
  views.initiatives = () => {
    const all = [...S.myInitiatives, ...D.initiatives];
    return topbar("Голосуй за меня", "Гражданские инициативы: предложите идею и соберите единомышленников") + `
    <div class="layout"><div class="stack">
      ${all.map((i) => {
        const sup = i.support + (S.supported[i.id] ? 1 : 0), reached = sup >= i.goal;
        return `<div class="card initiative fade-in ${reached ? "reached" : ""}">
          <div class="row"><span class="chip">${topic(i.topic).icon} ${topic(i.topic).name}</span>${reached ? `<span class="chip ok">🎯 Порог достигнут · кандидаты отвечают</span>` : ""}<span class="spacer"></span><span class="small muted">${esc(i.author)}</span></div>
          <h3 style="margin:0">${esc(i.title)}</h3><p style="margin:0">${esc(i.text)}</p>
          <div class="bar"><span style="width:${Math.min(100, sup / i.goal * 100)}%;${reached ? "background:var(--ok)" : ""}"></span></div>
          <div class="row"><b>${fmt(sup)}</b><span class="muted small">из ${fmt(i.goal)} подписей · ответов кандидатов: ${i.responses}</span><span class="spacer"></span>
            <button class="btn small ${S.supported[i.id] ? "soft" : "accent"}" data-sup="${i.id}">${S.supported[i.id] ? "✓ Вы поддержали" : "Поддержать"}</button></div></div>`;
      }).join("")}
    </div><div class="stack">
      <div class="card"><h3>✍️ Предложить инициативу</h3><div class="stack" style="gap:10px">
        <label class="field">Название<input id="inTitle" maxlength="80" placeholder="Коротко и конкретно"></label>
        <label class="field">Тема<select id="inTopic">${D.topics.map((t) => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join("")}</select></label>
        <label class="field">Что предлагаете?<textarea id="inText" placeholder="Проблема → решение → кто должен это сделать"></textarea></label>
        <button class="btn" id="inBtn">Опубликовать</button></div></div>
      <div class="explain small"><b>Как это работает.</b> Инициатива, набравшая порог подписей, попадает в «обязательный ответ»: все кандидаты, подписавшие хартию VoteConnect, публично отвечают на неё в течение 14 дней. Ответы видны в трекере.</div>
    </div></div>`;
  };
  function bindInitiatives() {
    $$("[data-sup]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.sup; S.supported[id] = !S.supported[id]; save(); if (S.supported[id]) { award("voice"); addXP(2); } render(); }));
    $("#inBtn").addEventListener("click", () => {
      const title = $("#inTitle").value.trim(), text = $("#inText").value.trim();
      if (title.length < 5 || text.length < 15) return toast("Заполните название и описание");
      if (isRude(title + text)) return toast("🤖 ИИ-модератор: уберите оскорбления");
      S.myInitiatives.unshift({ id: "my" + Date.now(), title, text, topic: $("#inTopic").value, author: myName(), support: 0, goal: 1000, responses: 0 });
      save(); addXP(15); toast("Инициатива опубликована · +15 XP"); render();
    });
  }

  /* ---------- Академия ---------- */
  views.academy = () => {
    const done = Object.keys(S.academy).length;
    return topbar("Академия избирателя", "Короткие уроки по 3 минуты — с квизом и значками") + `
    <div class="card" style="margin-bottom:16px"><div class="row"><b>Пройдено ${done} из ${D.academy.length}</b><span class="spacer"></span><span class="chip primary">Уровень ${level()} · ${S.xp} XP</span></div>
      <div class="bar" style="margin-top:10px"><span style="width:${done / D.academy.length * 100}%"></span></div></div>
    <div class="grid two">${D.academy.map((m) => `<div class="card module"><div class="ico">${m.icon}</div><h3 style="margin:0">${esc(m.title)}</h3>
      <div class="small muted">${m.cards.length} карточки · ${m.quiz.length} вопроса · +${m.xp} XP</div>
      <div class="row"><a class="btn small ${S.academy[m.id] ? "soft" : ""}" href="#/lesson/${m.id}">${S.academy[m.id] ? "✓ Пройдено · повторить" : "Начать урок"}</a></div></div>`).join("")}</div>`;
  };
  let lesson = { id: null, step: 0, answered: null, score: 0 };
  views.lesson = (id) => {
    const m = D.academy.find((x) => x.id === id); if (!m) return views.academy();
    if (lesson.id !== id) lesson = { id, step: 0, answered: null, score: 0 };
    const total = m.cards.length + m.quiz.length, s = lesson.step;
    let body;
    if (s < m.cards.length) {
      body = `<div class="small muted" style="font-weight:800">КАРТОЧКА ${s + 1} / ${m.cards.length}</div><div class="lesson-card" style="margin:14px 0 20px">${esc(m.cards[s])}</div>
        <div class="row">${s > 0 ? `<button class="btn ghost" data-step="-1">← Назад</button>` : ""}<span class="spacer"></span><button class="btn" data-step="1">Дальше →</button></div>`;
    } else if (s < total) {
      const q = m.quiz[s - m.cards.length], ans = lesson.answered;
      body = `<div class="small muted" style="font-weight:800">ВОПРОС ${s - m.cards.length + 1} / ${m.quiz.length}</div><h2 style="margin:14px 0 18px">${esc(q.q)}</h2>
        ${q.a.map((a, i) => `<button class="answer ${ans !== null ? (i === q.correct ? "right" : i === ans ? "wrong" : "") : ""}" data-qa="${i}" ${ans !== null ? "disabled" : ""}>${esc(a)}</button>`).join("")}
        ${ans !== null ? `<div class="row" style="margin-top:10px"><b>${ans === q.correct ? "✅ Верно!" : "❌ Не совсем — правильный ответ подсвечен"}</b><span class="spacer"></span><button class="btn" data-step="1">Дальше →</button></div>` : ""}`;
    } else {
      body = `<div style="text-align:center;padding:20px 0"><div style="font-size:56px">🎉</div><h2>Урок пройден!</h2><p class="muted">Правильных ответов: ${lesson.score} из ${m.quiz.length} · +${m.xp} XP</p>
        <a class="btn" href="#/academy">К списку уроков</a></div>`;
    }
    return topbar(`${m.icon} ${esc(m.title)}`, "Академия избирателя", `<a class="btn ghost small" href="#/academy">← Все уроки</a>`) + `
      <div class="card fade-in" style="max-width:720px"><div class="bar" style="margin-bottom:18px"><span style="width:${Math.min(s, total) / total * 100}%"></span></div>${body}</div>`;
  };
  function bindLesson(id) {
    const m = D.academy.find((x) => x.id === id); if (!m) return;
    $$("[data-step]").forEach((b) => b.addEventListener("click", () => {
      lesson.step += Number(b.dataset.step); lesson.answered = null;
      if (lesson.step >= m.cards.length + m.quiz.length && !S.academy[id]) {
        S.academy[id] = true; addXP(m.xp); save();
        if (Object.keys(S.academy).length >= 2) award("scholar");
      }
      render();
    }));
    $$("[data-qa]").forEach((b) => b.addEventListener("click", () => {
      const q = m.quiz[lesson.step - m.cards.length]; lesson.answered = Number(b.dataset.qa);
      if (lesson.answered === q.correct) lesson.score++;
      render();
    }));
  }

  /* ---------- Профиль ---------- */
  views.profile = () => {
    const m = compassDone() ? matches().slice(0, 3) : null;
    const opt = (k, v, l) => `<option value="${v}" ${S.privacy[k] === v ? "selected" : ""}>${l}</option>`;
    const sel = (k) => `<select data-priv="${k}">${opt(k, "me", "🔒 Только я")}${opt(k, "friends", "👥 Друзья")}${opt(k, "all", "🌐 Все")}</select>`;
    const stats = [["Постов", S.posts.length], ["Аргументов", S.args.length], ["Поддержано инициатив", Object.values(S.supported).filter(Boolean).length], ["Уроков", Object.keys(S.academy).length]];
    return topbar("Гражданский паспорт", "Ваш профиль, прогресс и настройки приватности") + `
    <div class="layout"><div class="stack">
      <div class="card"><div class="row"><div class="avatar lg">${esc(myAva())}</div><div style="flex:1"><h2 style="margin:0">${esc(myName())}</h2><div class="muted small">☑️ Подтверждённый житель · ${esc(D.city)} · ${esc((S.profile && S.profile.district) || D.district)}</div>
        ${S.profile && S.profile.interests ? `<div class="row" style="gap:6px;margin-top:8px">${S.profile.interests.map((t) => `<span class="chip">${topic(t).icon} ${topic(t).name}</span>`).join("")}</div>` : ""}</div>
        <div style="text-align:right"><div class="chip primary">Уровень ${level()}</div><div class="small muted" style="margin-top:4px">${S.xp} XP</div></div></div>
        <div class="bar" style="margin-top:14px"><span style="width:${S.xp % 100}%"></span></div><div class="small muted" style="margin-top:4px">${100 - (S.xp % 100)} XP до уровня ${level() + 1}</div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-top:16px">${stats.map(([l, v]) => `<div><b style="font-size:24px">${v}</b><div class="small muted">${l}</div></div>`).join("")}</div></div>
      <div class="card"><h3>Значки</h3><div class="grid two">${D.badges.map((b) => `<div class="badge ${S.badges[b.id] ? "got" : ""}"><span class="b-ico">${b.icon}</span><div><b>${b.name}</b><div class="small muted">${b.desc}</div></div></div>`).join("")}</div></div>
      <div class="card"><h3>🧭 Мои взгляды</h3>${m ? m.map((x) => `<div class="row" style="padding:6px 0"><span>${esc(x.c.name)}</span><span class="spacer"></span><b>${x.pct}%</b></div>`).join("") + `<p class="small muted" style="margin-top:8px">Видно: ${S.privacy.matches === "me" ? "только вам" : S.privacy.matches === "friends" ? "друзьям" : "всем"}</p>`
        : `<p class="muted small">Вы ещё не прошли Компас.</p><a class="btn small" href="#/compass">Пройти</a>`}</div>
    </div><div class="stack">
      <div class="card" id="privacyCard"><h3>🔐 Приватность</h3>
        <div class="switch"><span>Политические предпочтения</span>${sel("views")}</div>
        <div class="switch"><span>Результаты Компаса</span>${sel("matches")}</div>
        <div class="switch"><span>Активность и значки</span>${sel("activity")}</div>
        <p class="small muted" style="margin-top:10px">По умолчанию взгляды видны только вам. Мы никогда не продаём данные и не используем их для таргетированной политической рекламы.</p>
        <div class="row"><button class="btn ghost small" id="exportBtn">⤓ Скачать мои данные</button><button class="btn ghost small" id="wipeBtn" style="color:var(--bad)">Удалить мои данные</button></div></div>
    </div></div>`;
  };
  function bindProfile() {
    $$("[data-priv]").forEach((s) => s.addEventListener("change", () => { S.privacy[s.dataset.priv] = s.value; save(); toast("Настройки сохранены"); render(); }));
    $("#exportBtn").addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" })); a.download = "voteconnect-my-data.json"; a.click();
    });
    $("#wipeBtn").addEventListener("click", () => {
      if (!confirm("Удалить все данные демо на этом устройстве? Вы вернётесь к регистрации.")) return;
      S = defaults(); save(); cq = 0; ob = { step: 0, interests: [] }; location.hash = "#/feed"; render();
    });
  }

  /* ---------- Кабинет кандидата ---------- */
  const DRAFTS = {
    cq1: "Спасибо за вопрос! Проект выделенной полосы на Садовой готов. Если меня изберут, внесу его на первое же заседание совета — цель запустить полосу до весны 2027 года. Промежуточные шаги буду публиковать здесь.",
    cq2: "Да, это мой приоритет. Предлагаю начать с 1% городского бюджета и расширять долю, если жители активно участвуют. Опыт нашего района показал, что это работает.",
    cq3: "Я за пешеходную улицу по выходным, но только вместе с пропусками для жителей улицы Мира и объездным маршрутом автобуса. Предлагаю пилот на 2 месяца с публичной оценкой.",
    cq4: "Обязательно. Раз в месяц — отчёт здесь, в VoteConnect, и раз в квартал — открытая встреча с жителями. Все мои голосования будут видны в трекере."
  };
  function lineChart(labels, values) {
    const W = 640, H = 220, pl = 44, pr = 16, pt = 16, pb = 30, max = Math.ceil(Math.max(...values) / 500) * 500;
    const x = (i) => pl + i * (W - pl - pr) / (values.length - 1), y = (v) => pt + (1 - v / max) * (H - pt - pb);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const ticks = [0, max / 2, max];
    return `<div class="chart" data-chart='${JSON.stringify({ labels, values })}'>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Подписчики по неделям: с ${fmt(values[0])} до ${fmt(values[values.length - 1])}">
        ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--border)"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(t)}</text>`).join("")}
        ${labels.map((l, i) => (i % 2 === 1 || i === labels.length - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${l}</text>` : "").join("")}
        <path d="M${pts.join("L")}L${x(values.length - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="var(--primary)" opacity=".10"/>
        <polyline points="${pts.join(" ")}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="4.5" fill="var(--primary)" stroke="var(--surface)" stroke-width="2"/>
        <text x="${x(values.length - 1) - 8}" y="${y(values[values.length - 1]) - 10}" text-anchor="end" font-size="12" font-weight="800" fill="var(--text)">${fmt(values[values.length - 1])}</text>
        <line class="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--muted)" stroke-dasharray="3 3" opacity="0"/>
        <circle class="xh-dot" r="5" fill="var(--primary)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
        <rect class="hit" x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}" fill="transparent"/>
      </svg><div class="tip" hidden></div></div>`;
  }
  function bindCharts() {
    $$(".chart").forEach((wrap) => {
      const { labels, values } = JSON.parse(wrap.dataset.chart), svg = $("svg", wrap), tip = $(".tip", wrap);
      const W = 640, H = 220, pl = 44, pr = 16, pt = 16, pb = 30, max = Math.ceil(Math.max(...values) / 500) * 500;
      const move = (e) => {
        const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
        const i = Math.max(0, Math.min(values.length - 1, Math.round((px - pl) / ((W - pl - pr) / (values.length - 1)))));
        const cx = pl + i * (W - pl - pr) / (values.length - 1), cy = pt + (1 - values[i] / max) * (H - pt - pb);
        $(".xh", svg).setAttribute("x1", cx); $(".xh", svg).setAttribute("x2", cx); $(".xh", svg).setAttribute("opacity", ".6");
        $(".xh-dot", svg).setAttribute("cx", cx); $(".xh-dot", svg).setAttribute("cy", cy); $(".xh-dot", svg).setAttribute("opacity", "1");
        tip.hidden = false; tip.innerHTML = `<span class="muted">Неделя ${labels[i]}</span><br><b>${fmt(values[i])}</b> подписчиков${i ? ` <span class="muted">(+${fmt(values[i] - values[i - 1])})</span>` : ""}`;
        const left = cx / W * r.width; tip.style.left = Math.min(r.width - 170, Math.max(0, left - 85)) + "px"; tip.style.top = (cy / H * r.height - 64) + "px";
      };
      const leave = () => { tip.hidden = true; $(".xh", svg).setAttribute("opacity", "0"); $(".xh-dot", svg).setAttribute("opacity", "0"); };
      $(".hit", svg).addEventListener("pointermove", move); $(".hit", svg).addEventListener("pointerleave", leave);
    });
  }
  views.cabinet = () => {
    const K = D.cabinet, c = cand(K.candidate);
    const open = K.questions.filter((q) => !S.answered[q.id]), done = K.questions.filter((q) => S.answered[q.id]);
    const rate = Math.round((K.answerRate * 50 + done.length * 100) / (50 + done.length));
    const kpi = (label, val, delta, hint) => `<div class="card kpi"><div class="small muted">${label}</div><div class="kpi-val">${val}</div><div class="small ${delta && delta[0] === "+" ? "up" : "muted"}">${delta || hint || ""}</div></div>`;
    const maxC = Math.max(...K.concerns.map((x) => x[1]));
    return topbar("Кабинет кандидата", `${esc(c.name)} · ${esc(D.parties[c.party].name)} · ${esc(D.district)}`, `<button class="btn ghost small" data-print>📄 Отчёт</button>`) + `
    <div class="grid kpis" id="kpis">
      ${kpi("Подписчики", fmt(K.followers), `+${K.followersDelta}% за неделю`)}
      ${kpi("Охват постов за 7 дней", fmt(K.reach), `+${K.reachDelta}% за неделю`)}
      ${kpi("Ответы на вопросы", rate + "%", null, `место #${K.rank} среди кандидатов округа`)}
      ${kpi("Ждут ответа", open.length + K.pendingInitiatives.filter((i) => i.daysLeft !== null && !S.answered[i.id]).length, null, "вопросы и инициативы")}
    </div>
    <div class="layout" style="margin-top:16px"><div class="stack">
      <div class="card"><div class="row"><h3 style="margin:0">Рост аудитории</h3><span class="spacer"></span><span class="small muted">подписчики, по неделям</span></div>${lineChart(K.weeks, K.followersByWeek)}</div>
      <div class="card" id="qqueue"><div class="row"><h3 style="margin:0">❓ Вопросы жителей</h3><span class="spacer"></span><span class="chip">по поддержке</span></div>
        <p class="small muted">Жители голосуют за вопросы — сверху самые важные для округа. Ответы публикуются в вашем профиле.</p>
        ${open.map((q) => `<div class="q-item"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div class="q-sup">▲<b>${q.support}</b></div>
          <div style="flex:1"><b>${esc(q.text)}</b><div class="small muted">${esc(q.author)} · ${topic(q.topic).icon} ${topic(q.topic).name}</div>
          <textarea class="q-ans" data-qa-text="${q.id}" placeholder="Ваш публичный ответ…"></textarea>
          <div class="row" style="margin-top:8px"><button class="btn ghost small" data-draft="${q.id}">✨ Черновик от ИИ</button><span class="spacer"></span><button class="btn small" data-answer="${q.id}">Ответить публично</button></div></div></div></div>`).join("") || `<p class="muted">🎉 Все вопросы отвечены.</p>`}
        ${done.length ? `<details style="margin-top:12px"><summary class="small" style="cursor:pointer;font-weight:700">Отвечено: ${done.length}</summary>${done.map((q) => `<div class="arg" style="margin-top:8px"><b>${esc(q.text)}</b><div class="small" style="margin-top:6px">${esc(S.answered[q.id])}</div></div>`).join("")}</details>` : ""}
      </div>
    </div><div class="stack">
      <div class="card"><h3>Что волнует округ</h3><p class="small muted">Доля упоминаний в постах, опросах и на Карте согласия, %</p>
        ${K.concerns.map(([n, v]) => `<div class="hbar" title="${esc(n)}: ${v}%"><div class="row" style="justify-content:space-between"><span class="small">${esc(n)}</span><b class="small">${v}%</b></div><div class="bar"><span style="width:${v / maxC * 100}%"></span></div></div>`).join("")}</div>
      <div class="card"><h3>🎯 Инициативы для ответа</h3>
        ${K.pendingInitiatives.map((i) => `<div class="q-item"><b>${esc(i.title)}</b><div class="small muted">${fmt(i.support)} подписей</div>
          ${S.answered[i.id] ? `<span class="chip ok">✓ Ответ опубликован</span>` : i.daysLeft !== null ? `<div class="row" style="margin-top:6px"><span class="chip warn">⏳ осталось ${i.daysLeft} дн.</span><span class="spacer"></span><button class="btn small" data-init-ans="${i.id}">Ответить</button></div>` : `<span class="chip">Порог ещё не достигнут</span>`}</div>`).join("")}</div>
      <div class="explain small"><b>Равные условия.</b> Все инструменты кабинета бесплатны для каждого зарегистрированного кандидата. Платного продвижения политического контента на платформе нет.</div>
    </div></div>`;
  };
  function bindCabinet() {
    bindCharts();
    $$("[data-draft]").forEach((b) => b.addEventListener("click", () => {
      const ta = $(`[data-qa-text="${b.dataset.draft}"]`), text = DRAFTS[b.dataset.draft]; ta.value = ""; let i = 0;
      b.disabled = true;
      const t = setInterval(() => { ta.value = text.slice(0, i += 3); if (i >= text.length) { clearInterval(t); b.disabled = false; } }, 16);
      timers.push(t);
    }));
    $$("[data-answer]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.answer, text = $(`[data-qa-text="${id}"]`).value.trim();
      if (text.length < 20) return toast("Ответ слишком короткий — жители ценят конкретику");
      S.answered[id] = text; save(); toast("✓ Ответ опубликован и отправлен автору вопроса"); render();
    }));
    $$("[data-init-ans]").forEach((b) => b.addEventListener("click", () => { S.answered[b.dataset.initAns] = "ok"; save(); toast("✓ Ответ на инициативу опубликован"); render(); }));
    $$("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));
  }

  /* ---------- Онбординг ---------- */
  let ob = { step: 0, interests: [] };
  function renderOnboarding() {
    clearTimers();
    document.body.classList.add("ob-mode");
    const box = $("#onboard"); box.hidden = false;
    const s = ob.step, total = 4;
    let body = "";
    if (s === 0) {
      body = `<div class="ob-logo">${LOGO}</div><h1 class="ob-title">Ваш голос —<br>ваш город</h1>
        <p class="muted">Узнайте, чьи взгляды совпадают с вашими, влияйте на решения района и обсуждайте без токсичности.</p>
        <ul class="ob-list"><li><span>🧭</span>Компас взглядов — совпадение с кандидатами за 3 минуты</li><li><span>🤝</span>Карта согласия: что объединяет жителей</li><li><span>🔒</span>Ваши взгляды видны только вам</li></ul>
        <button class="btn block" data-ob="next">Создать профиль</button>
        <button class="btn ghost block" data-ob="demo">Войти в демо без регистрации</button>`;
    } else if (s === 1) {
      body = `<h2>Подтвердите номер</h2><p class="muted small">Один человек — один голос. Номер нужен только для защиты от ботов: в рабочей версии хранится лишь его хэш.</p>
        <label class="field">Телефон<input id="obPhone" inputmode="tel" autocomplete="off" placeholder="+7 900 000-00-00" value="${esc(ob.phone || "")}"></label>
        ${ob.codeSent ? `<div class="row" style="margin-top:16px"><b class="small">Код из SMS</b><span class="chip accent">демо: подойдёт любой</span></div>
          <div class="code">${[0, 1, 2, 3].map((i) => `<input maxlength="1" inputmode="numeric" data-code="${i}" aria-label="Цифра ${i + 1}">`).join("")}</div>` : ""}
        <button class="btn block" data-ob="${ob.codeSent ? "verify" : "sendcode"}">${ob.codeSent ? "Подтвердить" : "Получить код"}</button>`;
    } else if (s === 2) {
      body = `<h2>Расскажите о себе</h2><p class="muted small">Округ нужен, чтобы показать ваших кандидатов, участок и события рядом.</p>
        <div class="stack" style="gap:12px"><label class="field">Как к вам обращаться<input id="obName" maxlength="40" placeholder="Имя и фамилия" value="${esc(ob.name || "")}"></label>
        <label class="field">Избирательный округ<select id="obDistrict">${D.districts.map((d) => `<option ${ob.district === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></label>
        <label class="field">Улица <span class="small muted" style="font-weight:500">(необязательно)</span><input id="obStreet" maxlength="60" placeholder="например, Садовая" value="${esc(ob.street || "")}"></label></div>
        <button class="btn block" data-ob="profile">Дальше</button>`;
    } else if (s === 3) {
      body = `<h2>Что вам важно?</h2><p class="muted small">Выберите хотя бы 2 темы — лента и группы подстроятся под вас.</p>
        <div class="picks">${D.topics.map((t) => `<button class="pick ${ob.interests.includes(t.id) ? "on" : ""}" data-pick="${t.id}"><span>${t.icon}</span>${t.name}</button>`).join("")}</div>
        <button class="btn block" data-ob="interests" ${ob.interests.length < 2 ? "disabled" : ""}>Дальше · выбрано ${ob.interests.length}</button>`;
    } else if (s === 4) {
      body = `<h2>Приватность и правила</h2>
        <div class="ob-rule"><span>🔒</span><div><b>Взгляды видны только вам</b><div class="small muted">Результаты Компаса считаются на устройстве. Открыть их другим можно в настройках.</div></div></div>
        <div class="ob-rule"><span>🚫</span><div><b>Никакой политической рекламы</b><div class="small muted">Мы не продаём данные и не показываем таргетированную агитацию.</div></div></div>
        <div class="ob-rule"><span>🌉</span><div><b>Обсуждаем идеи, а не людей</b><div class="small muted">ИИ-модератор мягко подскажет, если сообщение похоже на оскорбление.</div></div></div>
        <label class="row small" style="margin:14px 0;gap:10px;font-weight:700;flex-wrap:nowrap"><input type="checkbox" id="obAgree" ${ob.agree ? "checked" : ""}> Принимаю правила сообщества</label>
        <button class="btn block" data-ob="finish" ${ob.agree ? "" : "disabled"}>Готово</button>`;
    } else {
      body = `<div style="text-align:center"><div class="ob-party">🎉</div><h2>Добро пожаловать, ${esc(ob.name.split(" ")[0])}!</h2>
        <p class="muted">Вы подтверждённый житель округа. Начните с Компаса — через 3 минуты узнаете, чьи позиции ближе к вашим.</p></div>
        <a class="btn block" href="#/compass" data-ob="enter">🧭 Пройти Компас взглядов</a><a class="btn ghost block" href="#/feed" data-ob="enter">Перейти в ленту</a>`;
    }
    box.innerHTML = `<div class="ob-card card fade-in">
      ${s > 0 && s <= total ? `<div class="row" style="margin-bottom:18px"><button class="icon-btn" data-ob="back" aria-label="Назад">←</button><div class="progress-dots" style="flex:1">${[1, 2, 3, 4].map((i) => `<i class="${i < s ? "done" : i === s ? "cur" : ""}"></i>`).join("")}</div><span class="small muted">${s}/${total}</span></div>` : ""}
      ${body}</div>`;
    bindOnboarding();
  }
  function finishOnboarding(profile) {
    S.profile = profile; S.xp += 20; save();
    $("#onboard").hidden = true; document.body.classList.remove("ob-mode");
  }
  function bindOnboarding() {
    const go = (n) => { ob.step = n; renderOnboarding(); };
    $$("[data-ob]").forEach((b) => b.addEventListener("click", (e) => {
      const a = b.dataset.ob;
      if (a === "next") go(1);
      else if (a === "back") go(ob.step - 1);
      else if (a === "demo") { finishOnboarding({ name: "Демо Житель", district: D.district, street: "", interests: ["transport", "eco"] }); render(); }
      else if (a === "sendcode") {
        ob.phone = $("#obPhone").value;
        if (ob.phone.replace(/\D/g, "").length < 10) return toast("Введите номер полностью");
        ob.codeSent = true; renderOnboarding(); toast("Код отправлен (демо)"); $("[data-code='0']").focus();
      } else if (a === "verify") {
        if ($$("[data-code]").some((i) => !i.value)) return toast("Введите 4 цифры кода");
        ob.phone = ""; toast("✓ Номер подтверждён"); go(2);
      } else if (a === "profile") {
        ob.name = $("#obName").value.trim(); ob.district = $("#obDistrict").value; ob.street = $("#obStreet").value.trim();
        if (ob.name.length < 2) return toast("Как к вам обращаться?");
        go(3);
      } else if (a === "interests") go(4);
      else if (a === "finish") go(5);
      else if (a === "enter") { e.preventDefault(); finishOnboarding({ name: ob.name, district: ob.district, street: ob.street, interests: ob.interests }); location.hash = b.getAttribute("href"); render(); toast("Профиль создан · +20 XP"); }
    }));
    $$("[data-pick]").forEach((b) => b.addEventListener("click", () => {
      const t = b.dataset.pick; ob.interests = ob.interests.includes(t) ? ob.interests.filter((x) => x !== t) : [...ob.interests, t]; renderOnboarding();
    }));
    const agree = $("#obAgree"); if (agree) agree.addEventListener("change", () => { ob.agree = agree.checked; renderOnboarding(); });
    $$("[data-code]").forEach((inp, i, all) => {
      inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); if (inp.value && all[i + 1]) all[i + 1].focus(); if (all.every((x) => x.value)) $("[data-ob='verify']").click(); });
      inp.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !inp.value && all[i - 1]) all[i - 1].focus(); });
    });
    const ph = $("#obPhone"); if (ph) ph.addEventListener("keydown", (e) => { if (e.key === "Enter") $("[data-ob='sendcode']").click(); });
  }

  /* ---------- Уведомления, поиск, QR ---------- */
  function closeLayers() { $$(".layer").forEach((l) => l.remove()); }
  function openNotifs(anchor) {
    const had = $(".notif-panel"); closeLayers(); if (had) return;
    const r = anchor.getBoundingClientRect(), p = document.createElement("div");
    p.className = "layer notif-panel card fade-in";
    p.style.top = r.bottom + 8 + "px"; p.style.right = Math.max(8, innerWidth - r.right) + "px";
    p.innerHTML = `<div class="row"><b>Уведомления</b><span class="spacer"></span><button class="link-btn" data-readall>Прочитать все</button></div>
      ${D.notifications.map((n) => `<a class="notif ${S.readNotifs[n.id] ? "" : "unread"}" href="${n.link}" data-nid="${n.id}"><span class="n-ico">${n.icon}</span><span style="flex:1">${esc(n.text)}<br><span class="small muted">${n.time} назад</span></span></a>`).join("")}`;
    document.body.appendChild(p);
    $$("[data-nid]", p).forEach((a) => a.addEventListener("click", () => { S.readNotifs[a.dataset.nid] = true; save(); closeLayers(); }));
    $("[data-readall]", p).addEventListener("click", () => { D.notifications.forEach((n) => (S.readNotifs[n.id] = true)); save(); closeLayers(); render(); });
  }
  function searchIndex() {
    return [
      ...D.candidates.map((c) => ({ g: "Кандидаты", t: c.name, s: c.role, l: "#/candidate/" + c.id, i: c.avatar })),
      ...D.groups.map((g) => ({ g: "Группы", t: g.name, s: g.desc, l: "#/group/" + g.id, i: topic(g.topic).icon })),
      ...D.initiatives.map((x) => ({ g: "Инициативы", t: x.title, s: x.text, l: "#/initiatives", i: "📣" })),
      ...D.events.map((e) => ({ g: "События", t: e.title, s: `${e.date.split("-").reverse().slice(0, 2).join(".")} · ${e.place}`, l: "#/calendar", i: "📅" })),
      ...D.academy.map((m) => ({ g: "Академия", t: m.title, s: m.cards[0], l: "#/lesson/" + m.id, i: m.icon })),
      ...D.promises.map((p) => ({ g: "Обещания", t: p.text, s: cand(p.who).name, l: "#/promises", i: "✅" }))
    ];
  }
  function openSearch() {
    closeLayers();
    const m = document.createElement("div"); m.className = "layer modal-bg";
    m.innerHTML = `<div class="modal card fade-in" role="dialog" aria-label="Поиск"><div class="search-box"><span>🔍</span><input id="q" placeholder="Кандидаты, группы, события, инициативы…" autocomplete="off"><kbd>Esc</kbd></div><div id="results" class="results"></div></div>`;
    document.body.appendChild(m);
    const idx = searchIndex(), q = $("#q", m), out = $("#results", m);
    const draw = () => {
      const v = q.value.trim().toLowerCase();
      const hits = v ? idx.filter((x) => (x.t + " " + x.s).toLowerCase().includes(v)).slice(0, 12) : idx.filter((x) => x.g === "Кандидаты" || x.g === "Группы").slice(0, 8);
      let last = "";
      out.innerHTML = hits.map((x) => { const head = x.g !== last ? `<div class="res-g">${x.g}</div>` : ""; last = x.g; return head + `<a class="res" href="${x.l}"><span class="res-i">${esc(x.i)}</span><span><b>${esc(x.t)}</b><br><span class="small muted">${esc(x.s.slice(0, 90))}</span></span></a>`; }).join("") || `<p class="muted" style="padding:12px">Ничего не нашлось</p>`;
      $$(".res", out).forEach((a) => a.addEventListener("click", closeLayers));
    };
    q.addEventListener("input", draw); draw(); q.focus();
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { const a = $(".res", out); if (a) { location.hash = a.getAttribute("href"); closeLayers(); } } });
    m.addEventListener("click", (e) => { if (e.target === m) closeLayers(); });
  }
  const PUBLIC_URL = "https://timojr3.github.io/voteconnect/app.html";
  function openQR() {
    closeLayers();
    const url = /^(localhost|127\.)/.test(location.hostname) || location.protocol === "file:" ? PUBLIC_URL : location.href.split("#")[0].split("?")[0];
    const m = document.createElement("div"); m.className = "layer modal-bg";
    m.innerHTML = `<div class="modal card fade-in" style="max-width:360px;text-align:center"><h3>📱 Откройте на телефоне</h3><p class="small muted">Наведите камеру — прототип откроется как приложение. Его можно установить на главный экран.</p>
      <div id="qr" class="qr">загрузка…</div><div class="small muted" style="word-break:break-all">${esc(url)}</div><button class="btn ghost small" style="margin-top:14px" data-close>Закрыть</button></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", (e) => { if (e.target === m || e.target.hasAttribute("data-close")) closeLayers(); });
    const draw = () => { const qr = window.qrcode(0, "M"); qr.addData(url); qr.make(); $("#qr", m).innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); };
    if (window.qrcode) return draw();
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
    s.onload = draw; s.onerror = () => ($("#qr", m).textContent = "Нет сети — откройте ссылку ниже"); document.head.appendChild(s);
  }

  /* ---------- Демо-тур для презентации ---------- */
  const TOUR = [
    { r: "#/feed", sel: ".tabs", t: "Лента, которая объединяет", x: "Обычные соцсети продвигают самое скандальное. Здесь по умолчанию включено «Объединяющее»: наверху посты, которые одобряют люди с разными взглядами." },
    { r: "#/feed", sel: ".post .bridge-meter", t: "Рейтинг моста", x: "У каждого поста видно, какая доля людей из разных групп мнений его поддерживает. Это главный сигнал ранжирования вместо лайков." },
    { r: "#/feed", sel: ".post.flagged", t: "Защита от фейков", x: "Ложный пост о «переносе выборов» получает контекст с официальным источником и исключается из рекомендаций." },
    { r: "#/compass", sel: ".statement, .match", t: "Компас взглядов", x: "12 утверждений о жизни города — и процент совпадения с каждым кандидатом. Расчёт идёт на устройстве, взгляды никуда не отправляются." },
    { r: "#/consensus", sel: ".cmap", t: "Карта согласия", x: "Жители голосуют по коротким утверждениям, алгоритм сам находит группы мнений. Новые участники появляются на карте в реальном времени." },
    { r: "#/consensus", sel: "#commonCard", t: "Что объединяет всех", x: "Утверждения, которые поддерживают больше 70% в каждой группе, — готовая повестка для городского совета, основанная на согласии, а не на споре." },
    { r: "#/group/g-transport", sel: "#und", t: "Правило моста", x: "Чтобы возразить в дебатах, нужно сначала пересказать позицию оппонента. Без этого кнопка публикации не активна." },
    { r: "#/initiatives", sel: ".initiative.reached", t: "«Голосуй за меня»", x: "Жители предлагают инициативы. Набрав порог подписей, инициатива требует публичного ответа всех кандидатов за 14 дней." },
    { r: "#/cabinet", sel: "#kpis", t: "Вторая сторона: кандидаты", x: "У кандидатов и депутатов — свой кабинет: аудитория, вопросы жителей, темы округа. Это делает платформу нужной обеим сторонам." },
    { r: "#/cabinet", sel: "#qqueue", t: "Вопросы и ИИ-помощник", x: "Вопросы ранжируются по поддержке жителей. ИИ помогает подготовить черновик ответа — публикует его всегда сам кандидат." },
    { r: "#/profile", sel: "#privacyCard", t: "Приватность по умолчанию", x: "Политические взгляды — чувствительные данные. По умолчанию они видны только владельцу, данные можно скачать или удалить в один клик." }
  ];
  let tourStep = -1;
  function startTour() {
    if (!S.profile) finishOnboarding({ name: "Демо Житель", district: D.district, street: "", interests: ["transport", "eco"] });
    tourStep = 0; showTour();
  }
  function endTour() { tourStep = -1; $$(".tour").forEach((e) => e.remove()); }
  function showTour() {
    const st = TOUR[tourStep];
    if (location.hash !== st.r) { location.hash = st.r; } else render();
    setTimeout(() => {
      const el = $(st.sel.split(", ").map((s) => "#main " + s).join(", "));
      $$(".tour").forEach((e) => e.remove());
      const spot = document.createElement("div"); spot.className = "tour tour-spot";
      const tip = document.createElement("div"); tip.className = "tour tour-tip card";
      tip.innerHTML = `<div class="row"><span class="chip primary">${tourStep + 1} / ${TOUR.length}</span><span class="spacer"></span><button class="link-btn" data-tour="end">Завершить ✕</button></div>
        <h3 style="margin:10px 0 6px">${st.t}</h3><p class="small" style="margin:0 0 14px">${st.x}</p>
        <div class="row">${tourStep > 0 ? `<button class="btn ghost small" data-tour="prev">← Назад</button>` : ""}<span class="spacer"></span>
        <button class="btn small" data-tour="next">${tourStep === TOUR.length - 1 ? "Готово 🎉" : "Далее →"}</button></div>`;
      document.body.append(spot, tip);
      const place = () => {
        if (!el) { spot.style.display = "none"; tip.classList.add("center"); return; }
        const r = el.getBoundingClientRect(), pad = 8;
        Object.assign(spot.style, { top: r.top - pad + "px", left: r.left - pad + "px", width: r.width + pad * 2 + "px", height: Math.min(r.height, innerHeight * 0.6) + pad * 2 + "px" });
        if (innerWidth <= 860) return;
        const tw = 360, below = r.top + Math.min(r.height, innerHeight * 0.6) + 20;
        tip.style.left = Math.max(16, Math.min(innerWidth - tw - 16, r.left)) + "px";
        tip.style.top = (below + 190 < innerHeight ? below : Math.max(16, r.top - 210)) + "px";
      };
      if (el && innerWidth <= 860) { el.scrollIntoView({ block: "start", behavior: "instant" }); scrollBy(0, -76); }
      else if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
      place();
      $$("[data-tour]", tip).forEach((b) => b.addEventListener("click", () => {
        const a = b.dataset.tour;
        if (a === "end") return endTour();
        if (a === "next" && tourStep === TOUR.length - 1) { endTour(); toast("Спасибо за внимание! 🎉"); return; }
        tourStep += a === "next" ? 1 : -1; showTour();
      }));
    }, 120);
  }
  window.addEventListener("resize", () => { if (tourStep >= 0) showTour(); });

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-search]")) return openSearch();
    const bell = e.target.closest("[data-bell]"); if (bell) return openNotifs(bell);
    if (e.target.closest("[data-qr]")) return openQR();
    if (e.target.closest("[data-tour-start]")) { $("#sidebar").classList.remove("open"); return startTour(); }
    if (!e.target.closest(".notif-panel")) $$(".notif-panel").forEach((p) => p.remove());
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    if (e.key === "Escape") { closeLayers(); if (tourStep >= 0) endTour(); }
    if (tourStep >= 0 && e.key === "ArrowRight") $("[data-tour='next']")?.click();
    if (tourStep >= 0 && e.key === "ArrowLeft") $("[data-tour='prev']")?.click();
  });

  /* ---------- Маршрутизация ---------- */
  const binders = {
    feed: bindFeed, compass: bindCompass, consensus: bindConsensus, polls: bindPolls, candidates: bindCandidates, candidate: bindCandidate,
    calendar: bindCalendar, group: bindGroup, cabinet: bindCabinet, initiatives: bindInitiatives, lesson: bindLesson, profile: bindProfile
  };
  const navOf = { candidate: "candidates", group: "groups", lesson: "academy" };
  let lastRoute = "";
  function render() {
    clearTimers();
    if (!S.profile) return renderOnboarding();
    $("#onboard").hidden = true; document.body.classList.remove("ob-mode");
    closeLayers();
    const parts = (location.hash.replace(/^#\/?/, "") || "feed").split("/");
    let [route, arg] = parts;
    if (!views[route]) route = "feed";
    if (route === "compass" && arg === "retake" && lastRoute !== "compass") cq = 0;
    const main = $("#main");
    main.innerHTML = views[route](arg);
    if (binders[route]) binders[route](arg);
    $$("#nav a, #tabbar a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#/" + (navOf[route] || route)));
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.go)));
    if (lastRoute !== route + (arg || "")) { window.scrollTo(0, 0); $("#sidebar").classList.remove("open"); }
    lastRoute = route + (arg || "");
  }
  window.addEventListener("hashchange", render);
  render();
  if (/[?&]tour=1/.test(location.search)) setTimeout(startTour, 400);
  if (location.search) history.replaceState(null, "", location.pathname + location.hash);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
