/* VoteConnect — приложение (vanilla JS, без сборки). */
(function () {
  "use strict";
  const D = window.VC_DATA;
  const { ic } = window.VCIcons;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toLocaleString("ru-RU");
  const cand = (id) => D.candidates.find((c) => c.id === id);
  const topic = (id) => D.topics.find((t) => t.id === id);
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5c-6.1 0-11 4.8-11 10.8C5 21.2 16 29.5 16 29.5s11-8.3 11-16.2C27 7.3 22.1 2.5 16 2.5z" fill="var(--primary)"/><path d="M10.8 13.6l3.6 3.6 7-7.2" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>VoteConnect</span>`;
  const photo = (id, w = 900) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;
  const AVA_BG = ["e2efe6", "f3e3c7", "dbe4f3", "f1d6d3", "ece3f5", "e8e2d6"];
  const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  function ava(name, cls = "", seed) {
    const s = seed || name, bg = AVA_BG[hash(s) % AVA_BG.length];
    return `<span class="avatar ${cls}">${esc(initials(name))}<img src="https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(s)}&backgroundColor=${bg}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  }

  /* ---------- Состояние (только в браузере пользователя) ---------- */
  const KEY = "voteconnect-demo-v2";
  const defaults = () => ({
    compass: {}, weights: {}, consensus: {}, polls: {}, likes: {}, supported: {}, academy: {}, badges: {}, xp: 0,
    going: {}, posts: [], args: [], myInitiatives: [], comments: {}, commentLikes: {}, answered: {}, readNotifs: {},
    privacy: { views: "me", activity: "friends", matches: "me" }, profile: null, memory: [], chat: []
  });
  let S = defaults();
  try {
    if (/[?&]reset=1/.test(location.search)) localStorage.removeItem(KEY);
    const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(defaults(), JSON.parse(raw));
  } catch (e) { /* приватный режим */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const myName = () => (S.profile && S.profile.name) || "Гость";

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    $("#toasts").appendChild(t); setTimeout(() => t.remove(), 2800);
  }
  const addXP = (n) => { S.xp += n; save(); };
  function award(id) {
    if (S.badges[id]) return;
    S.badges[id] = true; addXP(25);
    toast(`Новый значок: «${D.badges.find((x) => x.id === id).name}»`);
  }
  const level = () => Math.floor(S.xp / 100) + 1;
  let timers = [];
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

  /* ---------- Каркас ---------- */
  $$("[data-logo]").forEach((el) => (el.innerHTML = LOGO));
  const daysLeft = Math.max(0, Math.ceil((new Date(D.election.date + "T08:00:00") - new Date()) / 864e5));
  const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c);
  $("#countdown").innerHTML = `<div class="num">${daysLeft}</div><div class="small">${plural(daysLeft, "день", "дня", "дней")} до выборов<br><span class="muted">8 ноября</span></div>`;
  $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; }
  try { applyTheme(localStorage.getItem("vc-theme")); } catch (e) { /* ignore */ }
  function refreshShell() {
    const unread = D.notifications.filter((n) => !S.readNotifs[n.id]).length;
    $("#bellDot").hidden = !unread; $("#bellDot").textContent = unread;
    $("#meAva").innerHTML = ava(myName(), "sm me");
    $("#districtName").textContent = ((S.profile && S.profile.district) || D.district).split(" ")[0];
  }
  const pageHead = (title, sub = "", extra = "") => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><span class="spacer"></span>${extra}</div>`;

  /* ---------- Карта согласия: геометрия и группа пользователя ---------- */
  const G = D.consensus.clusters;
  function userPos() {
    const v = S.consensus; let x = 0, y = 0, n = 0;
    D.consensus.statements.forEach((s) => { if (v[s.id] === 1 || v[s.id] === -1) { x += v[s.id] * s.load[0]; y += v[s.id] * s.load[1]; n++; } });
    return n ? { x: Math.max(-1, Math.min(1, x / n * 1.25)), y: Math.max(-1, Math.min(1, y / n * 1.25)) } : null;
  }
  function nearestIdx(p) {
    let best = 0, bd = 9;
    G.forEach((c, i) => { const d = Math.hypot(c.center[0] - p.x, c.center[1] - p.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const myGroup = () => { const p = userPos(); return p ? nearestIdx(p) : 1; };

  /* ---------- Полоска поддержки по группам ---------- */
  function support(sup) {
    const sum = sup.reduce((a, b) => a + b, 0) || 1, min = Math.min(...sup);
    return `<div class="support" title="Доля одобрения в каждой группе мнений">
      <div class="spec">${sup.map((v, i) => `<span class="${"abc"[i]}" style="width:${(v / sum * 100).toFixed(1)}%"></span>`).join("")}</div>
      <span class="val">${min >= 70 ? "Согласны все" : "Мнения расходятся"}</span>
      <div class="cap">${sup.map((v, i) => `<span><i style="background:var(--c${i + 1})"></i>${G[i].short} ${v}%</span>`).join("")}</div>
    </div>`;
  }

  /* ---------- Компас: расчёт ---------- */
  const compassDone = () => Object.keys(S.compass).length >= Math.ceil(D.compass.length * 0.6);
  function matches() {
    return D.candidates.map((c) => {
      let dist = 0, max = 0;
      D.compass.forEach((st, i) => {
        const u = S.compass[i]; if (u === undefined || u === null) return;
        const w = S.weights[i] ? 2 : 1; dist += w * Math.abs(u - c.positions[i]); max += w * 4;
      });
      return { c, pct: max ? Math.round((1 - dist / max) * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct);
  }
  const POS = { "-2": ["Против", "bad"], "-1": ["Скорее против", "bad"], "0": ["Нейтрально", ""], "1": ["Скорее за", "ok"], "2": ["За", "ok"] };
  const posChip = (v) => (v === undefined || v === null) ? `<span class="chip pos">—</span>` : `<span class="chip pos ${POS[v][1]}">${POS[v][0]}</span>`;
  const COMPASS_PHOTO = { transport: "1780866701554-254dcf3fac8e", "eco-n": "1683144651287-f00e40a97199", eco: "1789062665477-b58eb89a22b6", digital: "1714931773030-5d57ca092d77",
    housing: "1714931773030-5d57ca092d77", social: "1706217968045-2210de668c03", edu: "1608487583634-0f31766e4cb1", health: "1777529178036-18e4a92ec0b6" };

  const views = {}, binders = {};
  const RUDE = ["идиот", "дурак", "туп", "бред", "заткнись", "дебил", "клоун"];
  const isRude = (s) => RUDE.some((w) => s.toLowerCase().includes(w));

  /* ================= ЛЕНТА ================= */
  let feedSort = "all", composerOpen = false;
  const openThreads = {};
  const allPosts = () => [...S.posts, ...D.feed];
  function blindSpot() {
    const g = myGroup();
    return allPosts().filter((p) => p.support && p.support[g] < 55 && Math.max(...p.support.filter((_, i) => i !== g)) >= 70);
  }
  views.feed = () => {
    const posts = allPosts();
    const list = feedSort === "all" ? [...posts].sort((a, b) => Math.min(...(b.support || [50])) - Math.min(...(a.support || [50])))
      : feedSort === "blind" ? blindSpot() : posts;
    const top = compassDone() ? matches()[0] : null, g = myGroup();
    return pageHead("Лента района", `${esc(D.city)} · ${esc((S.profile && S.profile.district) || D.district)}`) + `
    <div class="layout"><div class="stack">
      <div class="card">${composerOpen ? `<div class="composer-open">
          <div class="row">${ava(myName())}<b>${esc(myName())}</b></div>
          <textarea id="postText" placeholder="Что происходит в районе? Идея, проблема, вопрос кандидатам" maxlength="500"></textarea>
          <div class="row"><select id="postTopic"><option value="">Без темы</option>${D.topics.map((t) => `<option value="${t.id}">${t.name}</option>`).join("")}</select>
            <span class="small muted" id="toneHint"></span><span class="spacer"></span>
            <button class="btn ghost small" id="postCancel">Отмена</button><button class="btn small" id="postBtn">Опубликовать</button></div></div>`
        : `<div class="composer">${ava(myName())}<button class="fake" id="composeBtn">Что происходит в районе?</button></div>`}</div>
      <div class="seg" role="tablist">
        <button data-sort="all" class="${feedSort === "all" ? "active" : ""}" title="Сначала то, что поддерживают все группы">Для всех</button>
        <button data-sort="new" class="${feedSort === "new" ? "active" : ""}">Новое</button>
        <button data-sort="blind" class="${feedSort === "blind" ? "active" : ""}">${ic("eye")} Слепое пятно<span class="n">${blindSpot().length}</span></button>
      </div>
      ${feedSort === "blind" ? `<div class="info">${ic("info")}<span>Это обсуждают другие группы, но почти не видит ваша — «${esc(G[g].short)}».${userPos() ? "" : ` Группа уточнится после <a href="#/consensus">Карты согласия</a>.`}</span></div>` : ""}
      ${list.map(postCard).join("") || `<div class="card empty">Здесь пока пусто</div>`}
    </div>
    <aside class="rail">
      ${top ? `<a class="card" href="#/compass" style="color:inherit;text-decoration:none"><div class="small muted">Ближе всего к вам</div>
          <div class="row" style="margin-top:8px">${ava(top.c.name, "", top.c.id)}<div><b>${esc(top.c.name)}</b><div class="small muted">${esc(D.parties[top.c.party].name)}</div></div><span class="spacer"></span><b style="font-size:22px;color:var(--primary)">${top.pct}%</b></div></a>`
        : `<div class="card"><h3>За кого голосовать?</h3><p class="small muted">12 вопросов о жизни района — и видно, чьи позиции ближе.</p><a class="btn small" href="#/compass">Пройти Компас</a></div>`}
      <div class="card"><h3>Скоро</h3>${upcoming(2)}</div>
      <div class="card"><h3>Собирают подписи</h3>
        ${D.initiatives.slice(0, 2).map((i) => `<a href="#/initiatives" style="display:block;color:inherit;margin:10px 0">
          <b class="small">${esc(i.title)}</b><div class="bar" style="margin:6px 0"><span style="width:${Math.min(100, i.support / i.goal * 100)}%"></span></div>
          <span class="small muted">${fmt(i.support)} из ${fmt(i.goal)}</span></a>`).join("")}</div>
    </aside></div>`;
  };
  function postCard(p) {
    const c = p.candidate ? cand(p.candidate) : null, t = p.topic ? topic(p.topic) : null, liked = S.likes[p.id];
    const cmCount = p.comments + (S.comments[p.id] || []).length;
    return `<article class="card post fade-in ${p.flagged ? "flagged" : ""}">
      <div class="post-body">
        <div class="post-head">${p.type === "official" ? `<span class="avatar" style="background:var(--primary);color:#fff">${ic("shield")}</span>` : ava(p.author, "", c ? c.id : p.author)}
          <div><div class="name">${c ? `<a href="#/candidate/${c.id}">${esc(p.author)}</a>` : esc(p.author)}${c && c.verified ? ` <span class="vmark" title="Личность подтверждена">${ic("check")}</span>` : ""}</div>
          <div class="meta">${c ? `Кандидат · ${esc(D.parties[c.party].name)}` : p.type === "official" ? "Официальный аккаунт" : "Житель района"} · ${esc(p.time)}</div></div>
        </div>
        <p class="post-text">${esc(p.text)}</p>
        ${t || p.verified ? `<div class="row" style="margin-top:10px">${t ? `<span class="chip">${t.name}</span>` : ""}${p.verified ? `<span class="chip ok">${ic("check")} ${esc(p.verified)}</span>` : ""}</div>` : ""}
        ${p.note ? `<div class="note ${p.flagged ? "bad" : ""}"><b>${p.flagged ? "Ложная информация" : "Контекст от жителей"}</b>${esc(p.note.replace(/^(Контекст от сообщества|Ложная информация)\.?:?\s*/, ""))}</div>` : ""}
      </div>
      ${p.photo ? `<img class="post-photo" src="${photo(p.photo)}" alt="" loading="lazy">` : ""}
      ${p.support && !p.flagged ? `<div class="post-foot">${support(p.support)}</div>` : ""}
      <div class="post-actions">
        <button data-like="${p.id}" class="${liked ? "on" : ""}">${ic(liked ? "heartOn" : "heart")} ${fmt(p.likes + (liked ? 1 : 0))}</button>
        <button data-cm="${p.id}">${ic("comment")} ${fmt(cmCount)}</button>
        <button data-share="${p.id}">${ic("share")} Поделиться</button>
        <span class="spacer"></span>
        ${!p.flagged ? `<button data-note="${p.id}" title="Добавить контекст с источником">${ic("pen")}</button>` : ""}
      </div>
      ${openThreads[p.id] ? threadHTML(p) : ""}
    </article>`;
  }
  function threadHTML(p) {
    const list = [...(D.comments[p.id] || []), ...(S.comments[p.id] || [])];
    return `<div class="thread">
      ${list.map((c, i) => {
        const k = p.id + ":" + i, liked = S.commentLikes[k], cc = c.candidate ? cand(c.candidate) : null;
        return `<div class="comment">${ava(c.author, "sm", cc ? cc.id : c.author)}<div class="bubble"><b>${esc(c.author)}</b>${cc ? ` <span class="muted small">· кандидат</span>` : ""}
          <div>${esc(c.text)}</div><button class="link-btn ${liked ? "on" : ""}" data-cl="${k}">${ic(liked ? "heartOn" : "heart")} ${c.likes + (liked ? 1 : 0)}</button></div></div>`;
      }).join("")}
      <div class="comment">${ava(myName(), "sm")}<div style="flex:1;display:flex;gap:8px"><input class="cm-input" data-ci="${p.id}" placeholder="Ответить…" maxlength="300"><button class="btn small" data-cs="${p.id}" aria-label="Отправить">${ic("send")}</button></div></div>
    </div>`;
  }
  binders.feed = () => {
    const cb = $("#composeBtn"); if (cb) cb.addEventListener("click", () => { composerOpen = true; render(); $("#postText").focus(); });
    const ta = $("#postText");
    if (ta) {
      ta.addEventListener("input", () => { $("#toneHint").textContent = isRude(ta.value) ? "Похоже на оскорбление — переформулируете?" : ""; });
      $("#postCancel").addEventListener("click", () => { composerOpen = false; render(); });
      $("#postBtn").addEventListener("click", () => {
        const text = ta.value.trim();
        if (text.length < 5) return toast("Напишите чуть подробнее");
        if (isRude(text)) return toast("Давайте обсуждать идеи, а не людей");
        S.posts.unshift({ id: "u" + Date.now(), type: "citizen", author: myName(), time: "только что", text, topic: $("#postTopic").value || null, verified: null, likes: 0, comments: 0 });
        composerOpen = false; save(); addXP(5); feedSort = "new"; render(); toast("Опубликовано");
      });
    }
    $$("[data-sort]").forEach((b) => b.addEventListener("click", () => { feedSort = b.dataset.sort; render(); }));
    $$("[data-like]").forEach((b) => b.addEventListener("click", () => { S.likes[b.dataset.like] = !S.likes[b.dataset.like]; save(); render(); }));
    $$("[data-share]").forEach((b) => b.addEventListener("click", async () => {
      const url = location.href.split("#")[0] + "#/feed";
      try { await navigator.clipboard.writeText(url); toast("Ссылка скопирована"); } catch (e) { toast(url); }
    }));
    $$("[data-note]").forEach((b) => b.addEventListener("click", () => toast("Контекст появится, когда его одобрят разные группы")));
    $$("[data-cm]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.cm; openThreads[id] = !openThreads[id]; render(); const i = $(`[data-ci="${id}"]`); if (i) i.focus(); }));
    $$("[data-cl]").forEach((b) => b.addEventListener("click", () => { S.commentLikes[b.dataset.cl] = !S.commentLikes[b.dataset.cl]; save(); render(); }));
    const send = (id) => {
      const inp = $(`[data-ci="${id}"]`), text = inp.value.trim(); if (text.length < 2) return;
      if (isRude(text)) return toast("Похоже на оскорбление — переформулируйте");
      (S.comments[id] = S.comments[id] || []).push({ author: myName(), text, likes: 0 });
      save(); addXP(2); render(); const n = $(`[data-ci="${id}"]`); if (n) n.focus();
    };
    $$("[data-cs]").forEach((b) => b.addEventListener("click", () => send(b.dataset.cs)));
    $$("[data-ci]").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") send(i.dataset.ci); }));
  };

  /* ================= КОМПАС ================= */
  let cq = 0;
  views.compass = (arg) => {
    const n = D.compass.length;
    if (cq >= n || (cq === 0 && compassDone() && arg !== "retake")) return compassResults();
    const st = D.compass[cq], cur = S.compass[cq];
    return pageHead("Компас взглядов", `Вопрос ${cq + 1} из ${n}`) + `
      <div class="progress"><span style="width:${cq / n * 100}%"></span></div>
      <div class="card q-card fade-in">
        <img class="q-photo" src="${photo(COMPASS_PHOTO[st.topic], 1000)}" alt="">
        <div class="q-in"><div class="q-step">${topic(st.topic).name}</div>
          <div class="q-text">${esc(st.text)}</div>
          <div class="answers">${[[2, "Полностью за"], [1, "Скорее за"], [0, "Не знаю"], [-1, "Скорее против"], [-2, "Полностью против"]].map(([v, l]) => `<button data-ans="${v}" class="${cur === v ? "sel" : ""}">${l}</button>`).join("")}</div>
          <div class="row" style="margin-top:14px">
            <label class="row small" style="gap:8px"><input type="checkbox" id="imp" ${S.weights[cq] ? "checked" : ""}> Для меня это важно</label>
            <span class="spacer"></span>${cq > 0 ? `<button class="btn ghost small" id="prevQ">Назад</button>` : ""}<button class="btn ghost small" id="skipQ">Пропустить</button></div>
        </div>
      </div>
      <div class="info" style="margin-top:12px;max-width:640px">${ic("lock")}<span>Ответы остаются на вашем устройстве.</span></div>`;
  };
  function compassResults() {
    const m = matches();
    return pageHead("Ваши совпадения", `Учтено ответов: ${Object.keys(S.compass).length} из ${D.compass.length}`, `<a class="btn ghost small" href="#/compass/retake" id="retake">Пройти заново</a>`) + `
    <div class="layout"><div class="stack">
      <div class="card pad0">${m.map((x) => `<a class="match-row" href="#/candidate/${x.c.id}">${ava(x.c.name, "lg", x.c.id)}
        <div><b>${esc(x.c.name)}</b><div class="small muted"><i class="party-dot" style="background:${D.parties[x.c.party].color}"></i>${esc(D.parties[x.c.party].name)}</div>
        <div class="bar"><span style="width:${x.pct}%"></span></div></div><div class="pct">${x.pct}%</div></a>`).join("")}</div>
      <div class="card"><h3>Вы и ${esc(m[0].c.name.split(" ")[0])}</h3>
        <div style="overflow-x:auto"><table class="diff-table"><thead><tr><th></th><th>Вы</th><th>${esc(m[0].c.name.split(" ")[0])}</th></tr></thead><tbody>
        ${D.compass.map((st, i) => `<tr><td>${esc(st.text)}</td><td>${posChip(S.compass[i])}</td><td>${posChip(m[0].c.positions[i])}</td></tr>`).join("")}</tbody></table></div></div>
    </div>
    <aside class="rail"><div class="card"><h3>Дальше</h3><div class="stack" style="gap:8px">
      <a class="btn soft" href="#/promises">Проверить обещания</a><a class="btn soft" href="#/calendar">Сходить на дебаты</a><a class="btn soft" href="#/candidate/${m[0].c.id}">Задать вопрос</a></div></div></aside></div>`;
  }
  binders.compass = () => {
    const r = $("#retake");
    if (r) r.addEventListener("click", (e) => { e.preventDefault(); cq = 0; S.compass = {}; S.weights = {}; save(); location.hash = "#/compass/retake"; });
    const next = () => { cq++; if (cq >= D.compass.length) { award("compass"); location.hash = "#/compass"; } render(); };
    $$("[data-ans]").forEach((b) => b.addEventListener("click", () => { S.compass[cq] = Number(b.dataset.ans); S.weights[cq] = $("#imp").checked; save(); next(); }));
    const skip = $("#skipQ"); if (skip) skip.addEventListener("click", () => { delete S.compass[cq]; save(); next(); });
    const prev = $("#prevQ"); if (prev) prev.addEventListener("click", () => { cq--; render(); });
  };

  /* ================= КАРТА СОГЛАСИЯ ================= */
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
  let crowd = null, crowdCount = 1847;
  function makeCrowd() {
    const r = rng(42), pts = [];
    G.forEach((cl, ci) => { for (let i = 0; i < cl.size; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 0.33; pts.push({ x: cl.center[0] + Math.cos(a) * d, y: cl.center[1] + Math.sin(a) * d * 0.85, c: ci }); } });
    return pts;
  }
  const MW = 540, MH = 400, sx = (x) => MW / 2 + x * MW * 0.42, sy = (y) => MH / 2 - y * MH * 0.42;
  function cmapSVG() {
    const up = userPos();
    return `<svg class="cmap" viewBox="0 0 ${MW} ${MH}" role="img" aria-label="Карта мнений участников">
      ${G.map((c, i) => `<ellipse cx="${sx(c.center[0])}" cy="${sy(c.center[1])}" rx="${MW * 0.17}" ry="${MH * 0.15}" fill="var(--c${i + 1})" opacity=".1"/>
        <text x="${sx(c.center[0])}" y="${sy(c.center[1]) - MH * 0.16}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--c${i + 1})">${c.short}</text>`).join("")}
      <g id="crowd">${crowd.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4" fill="var(--c${p.c + 1})" opacity=".8"/>`).join("")}</g>
      ${up ? `<circle cx="${sx(up.x)}" cy="${sy(up.y)}" r="16" fill="var(--text)" opacity=".12"><animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite"/></circle>
        <circle cx="${sx(up.x)}" cy="${sy(up.y)}" r="8" fill="var(--text)" stroke="var(--surface)" stroke-width="2.5"/>
        <text x="${sx(up.x)}" y="${sy(up.y) + 26}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">Вы</text>` : ""}
    </svg>`;
  }
  views.consensus = () => {
    if (!crowd) crowd = makeCrowd();
    const C = D.consensus, up = userPos();
    const common = C.statements.filter((s) => G.every((c) => c.agree[s.id] >= 0.7));
    const divisive = C.statements.map((s) => { const v = G.map((c) => c.agree[s.id]); return { s, gap: Math.max(...v) - Math.min(...v) }; }).filter((x) => x.gap >= 0.6).sort((a, b) => b.gap - a.gap);
    const bars = (s) => `<div class="cluster-bars" title="Доля «за» в каждой группе">${G.map((c, i) => `<span style="height:${Math.max(3, c.agree[s.id] * 32)}px;background:var(--c${i + 1})"></span>`).join("")}</div>`;
    return pageHead("Карта согласия", esc(C.question), `<span class="live" id="liveCount">${fmt(crowdCount)} участников</span>`) + `
    <div class="layout wide"><div class="stack">
      <div class="card">${cmapSVG()}
        <div class="legend" style="margin-top:12px">${G.map((c, i) => `<span><i style="background:var(--c${i + 1})"></i>${esc(c.label.replace(/[«»]/g, ""))}</span>`).join("")}</div>
        ${up ? `<p class="small" style="margin:10px 0 0">Вы ближе к группе «${esc(G[nearestIdx(up)].short)}».</p>` : ""}</div>
      <div class="card"><h3>Ваше мнение</h3>
        ${C.statements.map((s) => { const v = S.consensus[s.id]; return `<div class="vote-row"><div>${esc(s.text)}</div><div class="vote-btns">
          <button data-cv="${s.id}:1" class="${v === 1 ? "sel a" : ""}">За</button><button data-cv="${s.id}:-1" class="${v === -1 ? "sel d" : ""}">Против</button><button data-cv="${s.id}:0" class="${v === 0 ? "sel p" : ""}">Пропуск</button></div></div>`; }).join("")}</div>
    </div>
    <aside class="rail">
      <div class="card" id="commonCard"><h3>С чем согласны все</h3>
        ${common.map((s) => `<div class="row" style="flex-wrap:nowrap;padding:8px 0;border-bottom:1px solid var(--border)"><div class="small" style="flex:1">${esc(s.text)}</div>${bars(s)}</div>`).join("")}</div>
      <div class="card"><h3>Где расходятся</h3>
        ${divisive.map((x) => `<div class="row" style="flex-wrap:nowrap;padding:8px 0;border-bottom:1px solid var(--border)"><div class="small" style="flex:1">${esc(x.s.text)}</div>${bars(x.s)}</div>`).join("")}</div>
    </aside></div>`;
  };
  binders.consensus = () => {
    $$("[data-cv]").forEach((b) => b.addEventListener("click", () => { const [id, v] = b.dataset.cv.split(":"); S.consensus[id] = Number(v); save(); award("consensus"); render(); }));
    every(() => {
      const ci = Math.floor(Math.random() * 3), c = G[ci], a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 0.33;
      const p = { x: c.center[0] + Math.cos(a) * d, y: c.center[1] + Math.sin(a) * d * 0.85, c: ci }; crowd.push(p); crowdCount++;
      const g = $("#crowd"); if (!g) return;
      const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      el.setAttribute("cx", sx(p.x).toFixed(1)); el.setAttribute("cy", sy(p.y).toFixed(1)); el.setAttribute("r", "4"); el.setAttribute("fill", `var(--c${ci + 1})`); el.setAttribute("opacity", ".8");
      el.innerHTML = `<animate attributeName="r" values="0;9;4" dur=".8s"/>`; g.appendChild(el);
      $("#liveCount").textContent = `${fmt(crowdCount)} участников`;
    }, 2500);
  };

  /* ================= ОПРОСЫ ================= */
  const pollVotes = D.polls.map((p) => p.votes.slice());
  views.polls = () => pageHead("Опросы", "Результаты видны после голосования", `<span class="live">Идёт голосование</span>`) + `
    <div class="grid two">${D.polls.map((p, pi) => {
      const mine = S.polls[p.id], votes = pollVotes[pi].map((v, i) => v + (mine === i ? 1 : 0)), total = votes.reduce((a, b) => a + b, 0);
      return `<div class="card" data-poll="${pi}"><h3>${esc(p.text)}</h3>
        ${p.options.map((o, i) => `<button class="poll-opt ${mine === i ? "mine" : ""}" data-pv="${pi}:${i}">
          <span class="fill" style="width:${mine !== undefined ? (votes[i] / total * 100).toFixed(1) : 0}%"></span><span>${esc(o)}</span><span data-pct>${mine !== undefined ? Math.round(votes[i] / total * 100) + "%" : ""}</span></button>`).join("")}
        <div class="small muted" data-total>${mine !== undefined ? `${fmt(total)} голосов` : "Один человек — один голос"}</div></div>`;
    }).join("")}</div>`;
  binders.polls = () => {
    $$("[data-pv]").forEach((b) => b.addEventListener("click", () => {
      const [pi, i] = b.dataset.pv.split(":").map(Number), id = D.polls[pi].id; if (S.polls[id] !== undefined) return;
      S.polls[id] = i; save(); addXP(3); render();
    }));
    every(() => D.polls.forEach((p, pi) => {
      pollVotes[pi][Math.floor(Math.random() * p.options.length)] += 1 + Math.floor(Math.random() * 3);
      const mine = S.polls[p.id], card = $(`[data-poll="${pi}"]`); if (mine === undefined || !card) return;
      const votes = pollVotes[pi].map((v, k) => v + (mine === k ? 1 : 0)), total = votes.reduce((a, b) => a + b, 0);
      $$(".poll-opt", card).forEach((el, k) => { $(".fill", el).style.width = (votes[k] / total * 100).toFixed(1) + "%"; $("[data-pct]", el).textContent = Math.round(votes[k] / total * 100) + "%"; });
      $("[data-total]", card).textContent = `${fmt(total)} голосов`;
    }), 1800);
  };

  /* ================= КАНДИДАТЫ ================= */
  let candTopic = "";
  views.candidates = () => {
    const m = compassDone() ? Object.fromEntries(matches().map((x) => [x.c.id, x.pct])) : null;
    const list = D.candidates.filter((c) => !candTopic || c.focus.includes(candTopic));
    return pageHead("Кандидаты", esc(D.district)) + `
    <div class="seg" style="margin-bottom:14px"><button data-ct="" class="${!candTopic ? "active" : ""}">Все</button>${D.topics.map((t) => `<button data-ct="${t.id}" class="${candTopic === t.id ? "active" : ""}">${t.name}</button>`).join("")}</div>
    <div class="grid three">${list.map((c) => `<a class="card cand-card" href="#/candidate/${c.id}" style="color:inherit;text-decoration:none">
      <div class="row">${ava(c.name, "lg", c.id)}<div style="flex:1;min-width:0"><b>${esc(c.name)}</b><div class="small muted"><i class="party-dot" style="background:${D.parties[c.party].color}"></i>${esc(D.parties[c.party].name)}</div></div>
      ${m ? `<b style="color:var(--primary);font-size:20px">${m[c.id]}%</b>` : ""}</div>
      <div class="small">${esc(c.role)}</div>
      <div class="small muted">Отвечает на ${c.responseRate}% вопросов</div></a>`).join("")}</div>`;
  };
  binders.candidates = () => $$("[data-ct]").forEach((b) => b.addEventListener("click", () => { candTopic = b.dataset.ct; render(); }));

  const QA = {
    lebedeva: [["Что вы сделаете с автобусом 14?", "Выделенная полоса на Садовой и открытый GPS-мониторинг маршрута."]],
    vorontsov: [["Почему развязку исключили из бюджета?", "Бюджет 2026 года сокращён на 12%. Проект готов, добиваемся включения в 2027 год."]],
    sokolova: [["Кто будет содержать новый парк?", "Попечительский совет жителей и отдельная строка в бюджете района."]],
    orlov: [["Не будет ли дыры в бюджете?", "Выпадающие доходы компенсирует рост числа предприятий за два года."]],
    kuznetsov: [["Где взять врачей на вечерние приёмы?", "Часть смен готовы взять ординаторы медуниверситета."]]
  };
  const CAND_COVER = { lebedeva: "1714931773030-5d57ca092d77", vorontsov: "1683144651287-f00e40a97199", sokolova: "1789062665477-b58eb89a22b6", orlov: "1780866701554-254dcf3fac8e", kuznetsov: "1777529178036-18e4a92ec0b6" };
  views.candidate = (id) => {
    const c = cand(id); if (!c) return views.candidates();
    const pr = D.promises.filter((p) => p.who === id), ev = D.events.filter((e) => e.org === c.name), my = compassDone() ? matches().find((x) => x.c.id === id) : null;
    return `<div class="layout"><div class="stack">
      <div class="card pad0"><div class="cover"><img src="${photo(CAND_COVER[id], 1200)}" alt=""></div>
        <div class="card-in"><div class="row" style="align-items:flex-end">${ava(c.name, "xl ring", c.id)}<span class="spacer"></span>
          <button class="btn ${S.going["f-" + id] ? "ghost" : ""} small" id="followBtn">${S.going["f-" + id] ? "Вы подписаны" : "Подписаться"}</button></div>
          <h1 style="margin:12px 0 2px">${esc(c.name)} ${c.verified ? `<span class="vmark" title="Личность подтверждена">${ic("check")}</span>` : ""}</h1>
          <div class="muted"><i class="party-dot" style="background:${D.parties[c.party].color}"></i>${esc(D.parties[c.party].name)} · ${esc(c.role)}</div>
          <p style="margin:12px 0 0">${esc(c.bio)}</p>
          <div class="row" style="margin-top:12px">${my ? `<span class="chip on">Совпадение ${my.pct}%</span>` : ""}<span class="chip">Отвечает на ${c.responseRate}% вопросов</span></div></div></div>
      <div class="card"><h3>Вопросы жителей</h3>
        ${(QA[id] || []).map(([q, a]) => `<div class="arg"><b>${esc(q)}</b><div style="margin-top:6px">${esc(a)}</div></div>`).join("")}
        <div class="ask"><input id="qText" placeholder="Ваш вопрос кандидату"><button class="btn" id="askBtn">Спросить</button></div></div>
      <div class="card"><h3>Позиции</h3><div style="overflow-x:auto"><table class="diff-table"><tbody>
        ${D.compass.map((st, i) => `<tr><td>${esc(st.text)}</td><td>${posChip(c.positions[i])}</td></tr>`).join("")}</tbody></table></div></div>
    </div>
    <aside class="rail">
      <div class="card"><h3>Обещания</h3>${pr.length ? pr.map(promiseRow).join("") : `<p class="small muted">Первые выборы — обещаний прошлых созывов нет.</p>`}</div>
      <div class="card"><h3>События</h3>${ev.length ? ev.map(eventRow).join("") : `<p class="small muted">Пока нет.</p>`}</div>
    </aside></div>`;
  };
  binders.candidate = (id) => {
    $("#followBtn").addEventListener("click", () => { S.going["f-" + id] = !S.going["f-" + id]; save(); render(); });
    $("#askBtn").addEventListener("click", () => {
      const q = $("#qText").value.trim(); if (q.length < 8) return toast("Сформулируйте вопрос подробнее");
      if (isRude(q)) return toast("Похоже на оскорбление — переформулируйте");
      $("#qText").value = ""; addXP(5); toast("Вопрос отправлен. Жители могут его поддержать");
    });
    bindEventButtons();
  };

  /* ================= ОБЕЩАНИЯ ================= */
  const ST = { done: ["Выполнено", "ok"], progress: ["В процессе", "warn"], broken: ["Не выполнено", "bad"] };
  function promiseRow(p) {
    const c = cand(p.who);
    return `<div class="promise"><div><b>${esc(p.text)}</b><div class="small muted">${esc(c.name)} · ${p.date} · ${esc(p.source)}</div></div>
      <span class="chip ${ST[p.status][1]}">${ST[p.status][0]}</span>
      <div class="bar" style="grid-column:1/-1"><span style="width:${p.progress}%;background:var(--${ST[p.status][1]})"></span></div></div>`;
  }
  views.promises = () => {
    const cnt = (s) => D.promises.filter((p) => p.status === s).length;
    return pageHead("Обещания", "Статус меняется только со ссылкой на документ") + `
      <div class="grid three" style="margin-bottom:14px;max-width:760px">${[["done", "Выполнено"], ["progress", "В процессе"], ["broken", "Не выполнено"]].map(([k, l]) => `<div class="card kpi"><div class="lbl">${l}</div><div class="kpi-val" style="color:var(--${ST[k][1]})">${cnt(k)}</div></div>`).join("")}</div>
      <div class="card" style="max-width:760px">${D.promises.map(promiseRow).join("")}</div>`;
  };

  /* ================= СОБЫТИЯ ================= */
  let calMonth = 8;
  const TODAY = new Date(), pad = (n) => String(n).padStart(2, "0");
  const todayISO = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-${pad(TODAY.getDate())}`;
  function eventRow(e) {
    const d = new Date(e.date + "T00:00:00"), i = D.events.indexOf(e);
    return `<div class="event-item"><div class="event-date"><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()].slice(0, 3)}</small></div>
      <div><b>${esc(e.title)}</b><div class="small muted">${e.time} · ${esc(e.place)}</div></div>
      <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn small ${S.going["e" + i] ? "" : "ghost"}" data-go-ev="${i}">${S.going["e" + i] ? "Иду" : "Пойду"}</button><button class="icon-btn" data-ics="${i}" title="В календарь">${ic("download")}</button></div></div>`;
  }
  function upcoming(n) {
    return D.events.filter((e) => e.date >= todayISO).slice(0, n).map((e) => {
      const d = new Date(e.date + "T00:00:00");
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="small muted">${d.getDate()} ${MONTHS[d.getMonth()]}, ${e.time}</div><b class="small">${esc(e.title)}</b></div>`;
    }).join("") + `<a class="small" style="display:inline-block;margin-top:10px;font-weight:600" href="#/calendar">Все события</a>`;
  }
  views.calendar = () => {
    const y = 2026, first = new Date(y, calMonth, 1), days = new Date(y, calMonth + 1, 0).getDate(), off = (first.getDay() + 6) % 7, cells = [];
    for (let i = 0; i < off; i++) cells.push(`<div class="day empty"></div>`);
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${pad(calMonth + 1)}-${pad(d)}`, evs = D.events.filter((e) => e.date === iso);
      cells.push(`<div class="day ${iso === todayISO ? "today" : ""}"><span class="n">${d}</span>${evs.map((e) => `<button class="ev ev-${e.type}" data-ev="${D.events.indexOf(e)}" title="${esc(e.title)}">${esc(e.title)}</button>`).join("")}</div>`);
    }
    const monthEvents = D.events.filter((e) => new Date(e.date + "T00:00:00").getMonth() === calMonth);
    return pageHead("События", "Встречи, дебаты и важные даты") + `
    <div class="layout wide"><div class="stack">
      <div class="card"><div class="row" style="margin-bottom:12px"><button class="icon-btn" id="calPrev" ${calMonth <= 8 ? "disabled" : ""} aria-label="Назад" style="transform:scaleX(-1)">${ic("chevron")}</button>
        <h3 style="margin:0;min-width:120px;text-align:center">${MONTHS_NOM[calMonth]}</h3><button class="icon-btn" id="calNext" ${calMonth >= 10 ? "disabled" : ""} aria-label="Вперёд">${ic("chevron")}</button>
        <span class="spacer"></span><div class="legend">${["Важно", "Дебаты", "Встреча", "Обучение", "Акция"].map((t) => `<span><i class="ev-${t}"></i>${t}</span>`).join("")}</div></div>
        <div class="cal">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => `<div class="dow">${d}</div>`).join("")}${cells.join("")}</div></div>
      <div class="card">${monthEvents.map(eventRow).join("") || `<p class="muted">Нет событий.</p>`}</div>
    </div>
    <aside class="rail"><div class="card"><h3>Где мой участок?</h3>
      <div class="ask" style="margin:0"><input id="street" placeholder="Улица" value="${esc((S.profile && S.profile.street) || "")}"><button class="btn" id="findBtn">Найти</button></div>
      <div id="station" class="small" style="margin-top:10px"></div></div></aside></div>`;
  };
  function stationFor(s) { return { num: 700 + (s.length * 7) % 40, school: (s.length % 20) + 1, house: (s.length * 3) % 50 + 1 }; }
  function downloadICS(e) {
    const dt = e.date.replace(/-/g, "") + "T" + e.time.replace(":", "") + "00";
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VoteConnect//RU", "BEGIN:VEVENT", `UID:${dt}-${Math.random().toString(36).slice(2)}@voteconnect`, `DTSTART:${dt}`, `SUMMARY:${e.title}`, `LOCATION:${e.place}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "voteconnect-event.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); award("planner");
  }
  function bindEventButtons() {
    $$("[data-go-ev]").forEach((b) => b.addEventListener("click", () => { const k = "e" + b.dataset.goEv; S.going[k] = !S.going[k]; save(); if (S.going[k]) toast("Напомним за день"); render(); }));
    $$("[data-ics]").forEach((b) => b.addEventListener("click", () => downloadICS(D.events[b.dataset.ics])));
  }
  binders.calendar = () => {
    $("#calPrev").addEventListener("click", () => { calMonth = Math.max(8, calMonth - 1); render(); });
    $("#calNext").addEventListener("click", () => { calMonth = Math.min(10, calMonth + 1); render(); });
    $$("[data-ev]").forEach((b) => b.addEventListener("click", () => { const e = D.events[b.dataset.ev]; toast(`${e.title} · ${e.time}, ${e.place}`); }));
    const find = () => { const s = $("#street").value.trim(); if (!s) return; const st = stationFor(s);
      $("#station").innerHTML = `<div class="arg"><b>Участок № ${st.num}</b><br>Школа № ${st.school}, ул. ${esc(s)}, ${st.house}<br><span class="muted">9 минут пешком · доступная среда</span></div>`; };
    $("#findBtn").addEventListener("click", find); $("#street").addEventListener("keydown", (e) => { if (e.key === "Enter") find(); });
    bindEventButtons();
  };

  /* ================= ГРУППЫ И ДЕБАТЫ ================= */
  const GROUP_PHOTO = { eco: "1789062665477-b58eb89a22b6", transport: "1632276536839-84cad7fd03b0", "eco-n": "1683144651287-f00e40a97199", edu: "1608487583634-0f31766e4cb1", health: "1777529178036-18e4a92ec0b6", digital: "1714931773030-5d57ca092d77" };
  views.groups = () => pageHead("Группы и дебаты", "Чтобы возразить, сначала перескажите позицию другой стороны") + `
    <div class="grid three">${D.groups.map((g) => `<a class="card init-card" href="#/group/${g.id}" style="color:inherit;text-decoration:none">
      <img src="${photo(GROUP_PHOTO[g.topic], 600)}" alt="" loading="lazy"><div class="in"><h3>${esc(g.name)}</h3><div class="small muted">${esc(g.desc)}</div>
      <div class="row"><span class="chip">${fmt(g.members)} участников</span>${g.id === D.debate.group ? `<span class="chip on">Идут дебаты</span>` : ""}</div></div></a>`).join("")}</div>`;
  views.group = (id) => {
    const g = D.groups.find((x) => x.id === id); if (!g) return views.groups();
    const db = D.debate, mine = S.args.filter((a) => a.group === id), isDeb = g.id === db.group;
    const argHTML = (a) => `<div class="arg fade-in"><div class="row"><b>${esc(a.author)}</b><span class="spacer"></span><span class="small muted">${ic("thumb")} ${a.score}</span></div>
      <div style="margin-top:6px">${esc(a.text)}</div><div class="understood">Понял(а) другую сторону так: ${esc(a.understood)}</div></div>`;
    return pageHead(esc(g.name), `${fmt(g.members)} участников`, `<a class="btn ghost small" href="#/groups">Все группы</a>`) + `
    <div class="card" style="margin-bottom:14px"><div class="small muted">Дебаты недели</div><h2 style="margin:4px 0 14px">${esc(isDeb ? db.thesis : "Какие три проблемы решить в первую очередь?")}</h2>
      <div class="debate"><div class="col-pro"><h3>За</h3>${(isDeb ? db.pro : []).concat(mine.filter((a) => a.side === "pro")).map(argHTML).join("") || `<p class="small muted">Будьте первым.</p>`}</div>
      <div class="col-contra"><h3>Против</h3>${(isDeb ? db.contra : []).concat(mine.filter((a) => a.side === "contra")).map(argHTML).join("") || `<p class="small muted">Будьте первым.</p>`}</div></div></div>
    <div class="card" style="max-width:720px"><h3>Ваш аргумент</h3><div class="stack" style="gap:12px">
      <label class="field">Сторона<select id="side"><option value="pro">За</option><option value="contra">Против</option></select></label>
      <label class="field">Как вы понимаете позицию другой стороны?<textarea id="und" placeholder="Они считают, что…"></textarea></label>
      <label class="field">Ваш аргумент<textarea id="argt" placeholder="Факты, опыт, источники"></textarea></label>
      <div class="row"><span class="small muted" id="argHint"></span><span class="spacer"></span><button class="btn" id="argBtn" disabled>Опубликовать</button></div></div></div>`;
  };
  binders.group = (id) => {
    const und = $("#und"), argt = $("#argt"), btn = $("#argBtn"), hint = $("#argHint");
    const check = () => {
      const rude = isRude(und.value + " " + argt.value), n = und.value.trim().length;
      btn.disabled = n < 20 || argt.value.trim().length < 10 || rude;
      hint.textContent = rude ? "Обсуждаем идеи, а не людей" : n < 20 ? `Сначала позиция другой стороны: ${n}/20` : "Готово";
    };
    und.addEventListener("input", check); argt.addEventListener("input", check); check();
    btn.addEventListener("click", () => { S.args.push({ group: id, side: $("#side").value, author: myName(), text: argt.value.trim(), understood: und.value.trim(), score: 1 }); save(); addXP(10); award("bridge"); render(); });
  };

  /* ================= ИНИЦИАТИВЫ (редактор Yoopta) ================= */
  let initForm = false, editorHandle = null;
  const TEMPLATE = "<h3>Проблема</h3><p></p><h3>Решение</h3><p></p><h3>Кто должен сделать</h3><p></p>";
  const INLINE = { STRONG: "b", B: "b", EM: "i", I: "i", MARK: "mark" };
  function cleanHTML(src) {
    const box = document.createElement("div"); box.innerHTML = src; const out = [];
    const inline = (n) => [...n.childNodes].map((c) => c.nodeType === 3 ? esc(c.textContent) : INLINE[c.tagName] ? `<${INLINE[c.tagName]}>${inline(c)}</${INLINE[c.tagName]}>` : inline(c)).join("");
    box.querySelectorAll("h1,h2,h3,p,li,blockquote").forEach((n) => {
      const t = inline(n).trim(); if (!t) return;
      out.push(/^H/.test(n.tagName) ? `<h4>${t}</h4>` : n.tagName === "LI" ? `<p>• ${t}</p>` : n.tagName === "BLOCKQUOTE" ? `<p><i>${t}</i></p>` : `<p>${t}</p>`);
    });
    return out.join("");
  }
  function loadEditor() {
    if (window.VCEditor) return Promise.resolve(window.VCEditor);
    return new Promise((ok, fail) => { const s = document.createElement("script"); s.src = "assets/js/editor.bundle.js"; s.onload = () => ok(window.VCEditor); s.onerror = fail; document.head.appendChild(s); });
  }
  views.initiatives = () => {
    const all = [...S.myInitiatives, ...D.initiatives];
    return pageHead("Инициативы", "Набрали порог — кандидаты отвечают публично за 14 дней", initForm ? "" : `<button class="btn" id="newInit">${ic("plus")} Предложить</button>`) + `
    ${initForm ? `<div class="card" style="max-width:760px;margin-bottom:14px"><h3>Новая инициатива</h3><div class="stack" style="gap:12px">
      <label class="field">Название<input id="inTitle" maxlength="80" placeholder="Коротко и конкретно"></label>
      <label class="field">Тема<select id="inTopic">${D.topics.map((t) => `<option value="${t.id}">${t.name}</option>`).join("")}</select></label>
      <div><div class="editor-box" id="editorBox"><p class="muted small">Загружаем редактор…</p></div>
        <div class="editor-hint">Редактор Yoopta: выделите текст для форматирования, <kbd>/</kbd> — вставить блок.</div></div>
      <div class="row"><span class="spacer"></span><button class="btn ghost" id="inCancel">Отмена</button><button class="btn" id="inBtn">Опубликовать</button></div></div></div>` : ""}
    <div class="grid three">${all.map((i) => {
      const sup = i.support + (S.supported[i.id] ? 1 : 0), reached = sup >= i.goal;
      return `<div class="card init-card fade-in ${reached ? "reached" : ""}">${i.photo ? `<img src="${photo(i.photo, 700)}" alt="" loading="lazy">` : ""}
        <div class="in"><div class="row"><span class="chip">${topic(i.topic).name}</span>${reached ? `<span class="chip on">Порог достигнут</span>` : ""}</div>
        <h3>${esc(i.title)}</h3>${i.html ? `<div class="body small">${i.html}</div>` : `<div class="small">${esc(i.text)}</div>`}
        <div class="small muted">${esc(i.author)} · ответов кандидатов: ${i.responses}</div>
        <span class="spacer"></span><div class="bar"><span style="width:${Math.min(100, sup / i.goal * 100)}%"></span></div>
        <div class="row"><b>${fmt(sup)}</b><span class="small muted">из ${fmt(i.goal)}</span><span class="spacer"></span>
          <button class="btn small ${S.supported[i.id] ? "ghost" : ""}" data-sup="${i.id}">${S.supported[i.id] ? "Вы поддержали" : "Поддержать"}</button></div></div></div>`;
    }).join("")}</div>`;
  };
  binders.initiatives = () => {
    $$("[data-sup]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.sup; S.supported[id] = !S.supported[id]; save(); if (S.supported[id]) { award("voice"); addXP(2); } render(); }));
    const nb = $("#newInit"); if (nb) nb.addEventListener("click", () => { initForm = true; render(); });
    if (!initForm) return;
    const box = $("#editorBox");
    loadEditor().then((E) => { box.innerHTML = ""; editorHandle = E.mount(box, { template: TEMPLATE }); })
      .catch(() => { box.innerHTML = `<textarea id="inText" style="width:100%;min-height:140px;border:none;outline:none;resize:vertical;background:transparent" placeholder="Проблема, решение, кто должен сделать"></textarea>`; editorHandle = null; });
    $("#inCancel").addEventListener("click", () => { initForm = false; if (editorHandle) editorHandle.destroy(); editorHandle = null; render(); });
    $("#inBtn").addEventListener("click", () => {
      const title = $("#inTitle").value.trim();
      const text = editorHandle ? editorHandle.getText() : ($("#inText") ? $("#inText").value.trim() : "");
      const body = editorHandle ? cleanHTML(editorHandle.getHTML()) : `<p>${esc(text)}</p>`;
      const meaningful = text.replace(/Проблема|Решение|Кто должен сделать/g, "").trim();
      if (title.length < 5 || meaningful.length < 15) return toast("Добавьте название и опишите проблему и решение");
      if (isRude(title + text)) return toast("Уберите оскорбления");
      S.myInitiatives.unshift({ id: "my" + Date.now(), title, html: body, text, topic: $("#inTopic").value, author: myName(), support: 0, goal: 1000, responses: 0 });
      if (editorHandle) editorHandle.destroy(); editorHandle = null; initForm = false;
      save(); addXP(15); render(); toast("Инициатива опубликована");
    });
  };

  /* ================= АКАДЕМИЯ ================= */
  views.academy = () => {
    const done = Object.keys(S.academy).length;
    return pageHead("Академия", `Пройдено ${done} из ${D.academy.length} · уровень ${level()}`) + `
    <div class="grid two">${D.academy.map((m, i) => `<a class="card module" href="#/lesson/${m.id}" style="color:inherit;text-decoration:none">
      <div class="row"><div class="num">${i + 1}</div><span class="spacer"></span>${S.academy[m.id] ? `<span class="chip ok">${ic("check")} Пройдено</span>` : `<span class="chip">3 минуты</span>`}</div>
      <h3 style="margin:4px 0 0">${esc(m.title)}</h3><div class="small muted">${m.cards.length} карточки и ${m.quiz.length} вопроса</div></a>`).join("")}</div>`;
  };
  let lesson = { id: null, step: 0, answered: null, score: 0 };
  views.lesson = (id) => {
    const m = D.academy.find((x) => x.id === id); if (!m) return views.academy();
    if (lesson.id !== id) lesson = { id, step: 0, answered: null, score: 0 };
    const total = m.cards.length + m.quiz.length, s = lesson.step;
    let body;
    if (s < m.cards.length) body = `<div class="small muted">${s + 1} / ${m.cards.length}</div><div class="lesson-card" style="margin:12px 0 20px">${esc(m.cards[s])}</div>
      <div class="row">${s > 0 ? `<button class="btn ghost" data-step="-1">Назад</button>` : ""}<span class="spacer"></span><button class="btn" data-step="1">Дальше</button></div>`;
    else if (s < total) {
      const q = m.quiz[s - m.cards.length], ans = lesson.answered;
      body = `<div class="small muted">Вопрос ${s - m.cards.length + 1} из ${m.quiz.length}</div><h2 style="margin:10px 0 16px">${esc(q.q)}</h2>
        ${q.a.map((a, i) => `<button class="answer ${ans !== null ? (i === q.correct ? "right" : i === ans ? "wrong" : "") : ""}" data-qa="${i}" ${ans !== null ? "disabled" : ""}>${esc(a)}</button>`).join("")}
        ${ans !== null ? `<div class="row" style="margin-top:10px"><b>${ans === q.correct ? "Верно" : "Не совсем — правильный ответ отмечен"}</b><span class="spacer"></span><button class="btn" data-step="1">Дальше</button></div>` : ""}`;
    } else body = `<div style="text-align:center;padding:16px 0"><div class="ob-done">${ic("check")}</div><h2>Урок пройден</h2><p class="muted">Правильно: ${lesson.score} из ${m.quiz.length}</p><a class="btn" href="#/academy">К урокам</a></div>`;
    return pageHead(esc(m.title), "Академия", `<a class="btn ghost small" href="#/academy">Все уроки</a>`) + `
      <div class="progress"><span style="width:${Math.min(s, total) / total * 100}%"></span></div><div class="card fade-in" style="max-width:640px">${body}</div>`;
  };
  binders.lesson = (id) => {
    const m = D.academy.find((x) => x.id === id); if (!m) return;
    $$("[data-step]").forEach((b) => b.addEventListener("click", () => {
      lesson.step += Number(b.dataset.step); lesson.answered = null;
      if (lesson.step >= m.cards.length + m.quiz.length && !S.academy[id]) { S.academy[id] = true; addXP(m.xp); save(); if (Object.keys(S.academy).length >= 2) award("scholar"); }
      render();
    }));
    $$("[data-qa]").forEach((b) => b.addEventListener("click", () => { const q = m.quiz[lesson.step - m.cards.length]; lesson.answered = Number(b.dataset.qa); if (lesson.answered === q.correct) lesson.score++; render(); }));
  };

  /* ================= ПОМОЩНИК С ПАМЯТЬЮ (модель ai-memory-service) ================= */
  const STATEMENT_KEYS = ["bus_lanes", "small_business_tax", "parks_budget", "participatory_budget", "center_highrise", "council_streams", "large_families", "waste_plant", "school_finance", "face_cameras", "paid_parking", "farm_markets"];
  function memories() {
    const P = S.profile || {}, list = [];
    list.push({ type: "fact", key: "location.district", value: P.district || D.district, conf: 1 });
    const streets = [...(P.street ? [P.street] : []), ...S.memory.filter((m) => m.key === "location.street").map((m) => m.value)];
    if (streets.length) list.push({ type: "fact", key: "location.street", value: streets[streets.length - 1], conf: 0.98, old: streets.length > 1 ? streets[streets.length - 2] : null });
    (P.interests || []).forEach((t) => list.push({ type: "preference", key: `interest.${t}`, value: topic(t).name, conf: 0.9 }));
    S.memory.filter((m) => m.key !== "location.street").forEach((m) => list.push(m));
    D.compass.forEach((st, i) => { const v = S.compass[i]; if (v === 2 || v === -2) list.push({ type: "opinion", key: `opinion.${STATEMENT_KEYS[i]}`, value: v > 0 ? "за" : "против", conf: 0.85 }); });
    D.events.forEach((e, i) => { if (S.going["e" + i]) list.push({ type: "event", key: "event.going", value: `${e.title}, ${e.date.split("-").reverse().slice(0, 2).join(".")}`, conf: 0.95 }); });
    return list;
  }
  const TYPE_RU = { fact: "факт", preference: "интерес", opinion: "мнение", event: "событие" };
  function answer(q) {
    const t = q.toLowerCase(), mem = memories(), P = S.profile || {}, used = [];
    const short = mem.some((m) => m.key === "comms.style");
    const street = (mem.find((m) => m.key === "location.street") || {}).value;
    const ints = P.interests || [];
    const moved = t.match(/(живу|переехал[аи]?)\s+(на|по)\s+(улиц[еу]\s+)?([а-яё-]+)/i);
    if (moved) {
      const val = moved[4][0].toUpperCase() + moved[4].slice(1);
      S.memory.push({ type: "fact", key: "location.street", value: val, conf: 0.98 }); save();
      return { text: `Запомнил: вы живёте на улице ${val}. Прежний адрес больше не используется — участок и события пересчитаю.`, used: ["location.street"] };
    }
    if (/коротк|проще|без воды/.test(t)) {
      if (!short) { S.memory.push({ type: "preference", key: "comms.style", value: "коротко и простым языком", conf: 0.9 }); save(); }
      return { text: "Хорошо, буду отвечать коротко.", used: ["comms.style"] };
    }
    if (/встреч|событ|когда|дебат/.test(t)) {
      const future = D.events.filter((e) => e.date >= todayISO);
      const byInterest = future.find((e) => ints.some((i) => e.title.toLowerCase().includes(topic(i).name.toLowerCase().slice(0, 6))));
      const ev = byInterest || future.find((e) => e.type === "Дебаты") || future[0];
      if (byInterest) ints.forEach((i) => used.push(`interest.${i}`));
      const d = new Date(ev.date + "T00:00:00");
      return { text: short ? `${ev.title}: ${d.getDate()} ${MONTHS[d.getMonth()]}, ${ev.time}, ${ev.place}.` : `Вам подойдёт «${ev.title}» — ${d.getDate()} ${MONTHS[d.getMonth()]} в ${ev.time}, ${ev.place}. Отметить «Пойду» можно в разделе «События».`, used };
    }
    if (/участ|где голос|куда идти/.test(t)) {
      if (!street) return { text: "Подскажите вашу улицу — например, «я живу на Садовой».", used: [] };
      const st = stationFor(street);
      return { text: `Ваш участок № ${st.num}: школа № ${st.school}, ул. ${street}, ${st.house}. Голосование 8 ноября с 8:00 до 20:00.`, used: ["location.street", "location.district"] };
    }
    if (/кандидат|за кого|совпад|голосовать/.test(t)) {
      if (!compassDone()) return { text: "Сначала пройдите Компас — 12 вопросов. Тогда покажу, чьи позиции ближе к вашим.", used: [] };
      const top = matches()[0]; mem.filter((x) => x.type === "opinion").slice(0, 2).forEach((x) => used.push(x.key));
      return { text: `Ближе всего к вам ${top.c.name} — ${top.pct}%. Это подсказка, а не агитация: сравните обещания в разделе «Обещания».`, used };
    }
    if (/инициатив|подпис/.test(t)) {
      const i = D.initiatives.find((x) => ints.includes(x.topic)) || D.initiatives[0]; ints.forEach((x) => used.push(`interest.${x}`));
      return { text: `По вашим темам собирает подписи «${i.title}» — ${fmt(i.support)} из ${fmt(i.goal)}.`, used };
    }
    return { text: "Могу подсказать участок, ближайшие события, кандидатов по Компасу и инициативы по вашим темам. Ещё скажите, где живёте — запомню.", used: [] };
  }
  const greet = () => ({ me: false, text: `Здравствуйте, ${myName().split(" ")[0]}! Я помню ваш район и интересы. Спросите что-нибудь.` });
  views.assistant = () => {
    const mem = memories(), chat = S.chat.length ? S.chat : [greet()];
    return pageHead("Помощник", "Отвечает с учётом того, что знает о вас") + `
    <div class="asst"><div class="card">
      <div class="chat" id="chat">${chat.map((m) => `<div class="msg ${m.me ? "me" : ""}">${esc(m.text)}${m.used && m.used.length ? `<div class="used">Учёл: ${m.used.map((k) => `<code>${esc(k)}</code>`).join(" ")}</div>` : ""}</div>`).join("")}</div>
      <div class="sugg" style="margin-top:10px">${["Где мой участок?", "Когда ближайшая встреча?", "За кого мне голосовать?", "Я живу на Мира", "Отвечай короче"].map((s) => `<button class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <div class="ask"><input id="askInput" placeholder="Спросите помощника"><button class="btn" id="askSend" aria-label="Отправить">${ic("send")}</button></div></div>
    <aside class="card" id="memList"><h3>Что помнит помощник</h3>
      ${mem.map((m) => `<div class="mem"><span class="t">${TYPE_RU[m.type]}</span><code>${esc(m.key)}</code><span class="conf">${m.conf.toFixed(2)}</span><div>${esc(m.value)}</div>${m.old ? `<div class="old">было: ${esc(m.old)}</div>` : ""}</div>`).join("")}
      <p class="small muted" style="margin:12px 0 0">Модель памяти — как в открытом <a href="https://github.com/Darginec05/ai-memory-service" target="_blank" rel="noopener">ai-memory-service</a>: новое значение заменяет старое, история сохраняется. В демо всё хранится только в браузере.</p>
      <button class="btn ghost small" id="memWipe" style="margin-top:10px">Забыть всё</button></aside></div>`;
  };
  binders.assistant = () => {
    const chatEl = $("#chat"); chatEl.scrollTop = chatEl.scrollHeight;
    const ask = (q) => {
      q = q.trim(); if (!q) return;
      if (!S.chat.length) S.chat.push(greet());
      S.chat.push({ me: true, text: q }); const a = answer(q); S.chat.push({ me: false, text: a.text, used: a.used });
      S.chat = S.chat.slice(-30); save(); render(); const i = $("#askInput"); if (i) i.focus();
    };
    $("#askSend").addEventListener("click", () => ask($("#askInput").value));
    $("#askInput").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(e.target.value); });
    $$("[data-sugg]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.sugg)));
    $("#memWipe").addEventListener("click", () => { S.memory = []; S.chat = []; save(); render(); toast("Память помощника очищена"); });
  };

  /* ================= ПРОФИЛЬ ================= */
  views.profile = () => {
    const m = compassDone() ? matches().slice(0, 3) : null, P = S.profile || {};
    const opt = (k, v, l) => `<option value="${v}" ${S.privacy[k] === v ? "selected" : ""}>${l}</option>`;
    const sel = (k) => `<select data-priv="${k}">${opt(k, "me", "Только я")}${opt(k, "friends", "Соседи")}${opt(k, "all", "Все")}</select>`;
    return `<div class="layout"><div class="stack">
      <div class="card"><div class="row">${ava(myName(), "xl")}<div style="flex:1"><h1 style="margin:0">${esc(myName())}</h1>
        <div class="muted">${esc(D.city)} · ${esc(P.district || D.district)}${P.street ? ` · ул. ${esc(P.street)}` : ""}</div>
        <div class="row" style="margin-top:8px">${(P.interests || []).map((t) => `<span class="chip">${topic(t).name}</span>`).join("")}</div></div></div>
        <div class="row" style="margin-top:16px"><b>Уровень ${level()}</b><span class="small muted">${S.xp} очков</span></div>
        <div class="bar" style="margin-top:6px"><span style="width:${S.xp % 100}%"></span></div></div>
      <div class="card"><h3>Значки</h3><div class="grid two" style="gap:0 14px">${D.badges.map((b) => `<div class="badge ${S.badges[b.id] ? "got" : ""}"><span class="b-ico">${b.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span><div><b class="small">${b.name}</b><div class="small muted">${b.desc}</div></div></div>`).join("")}</div></div>
      <div class="card"><h3>Совпадения по Компасу</h3>${m ? m.map((x) => `<div class="row" style="padding:6px 0">${ava(x.c.name, "sm", x.c.id)}<span>${esc(x.c.name)}</span><span class="spacer"></span><b>${x.pct}%</b></div>`).join("") : `<a class="btn small" href="#/compass">Пройти Компас</a>`}</div>
    </div>
    <aside class="rail"><div class="card" id="privacyCard"><h3>Кто видит</h3>
      <div class="switch"><span class="small">Мои взгляды</span>${sel("views")}</div>
      <div class="switch"><span class="small">Результаты Компаса</span>${sel("matches")}</div>
      <div class="switch"><span class="small">Активность</span>${sel("activity")}</div>
      <p class="small muted" style="margin:10px 0">Мы не продаём данные и не показываем политическую рекламу.</p>
      <div class="row"><button class="btn ghost small" id="exportBtn">${ic("download")} Мои данные</button><button class="btn ghost small" id="wipeBtn" style="color:var(--bad)">Удалить всё</button></div></div>
      <button class="btn ghost" data-theme-toggle>${ic("theme")} Сменить тему</button></aside></div>`;
  };
  binders.profile = () => {
    $$("[data-priv]").forEach((s) => s.addEventListener("change", () => { S.privacy[s.dataset.priv] = s.value; save(); toast("Сохранено"); }));
    $("#exportBtn").addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" })); a.download = "voteconnect-my-data.json"; a.click(); });
    $("#wipeBtn").addEventListener("click", () => { if (!confirm("Удалить все данные на этом устройстве?")) return; S = defaults(); save(); cq = 0; ob = { step: 0, interests: [] }; location.hash = "#/feed"; render(); });
  };

  /* ================= КАБИНЕТ КАНДИДАТА ================= */
  const DRAFTS = {
    cq1: "Проект выделенной полосы на Садовой готов. Если меня изберут, внесу его на первое заседание — цель запустить до весны 2027 года.",
    cq2: "Да. Предлагаю начать с 1% городского бюджета и расширять долю, если жители активно участвуют.",
    cq3: "За пешеходную улицу по выходным — но с пропусками для жителей улицы Мира и объездом для автобуса. Сначала пилот на 2 месяца.",
    cq4: "Раз в месяц — отчёт здесь, раз в квартал — открытая встреча. Все мои голосования будут в трекере обещаний."
  };
  const CW = 640, CH = 220, PL = 44, PR = 16, PT = 16, PB = 30;
  function lineChart(labels, values) {
    const max = Math.ceil(Math.max(...values) / 500) * 500, last = values.length - 1;
    const x = (i) => PL + i * (CW - PL - PR) / last, y = (v) => PT + (1 - v / max) * (CH - PT - PB);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    return `<div class="chart" data-chart='${JSON.stringify({ labels, values })}'><svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Подписчики по неделям: с ${fmt(values[0])} до ${fmt(values[last])}">
      ${[0, max / 2, max].map((t) => `<line x1="${PL}" x2="${CW - PR}" y1="${y(t)}" y2="${y(t)}" stroke="var(--border)"/><text x="${PL - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(t)}</text>`).join("")}
      ${labels.map((l, i) => (i % 2 === 1 || i === last) ? `<text x="${x(i)}" y="${CH - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${l}</text>` : "").join("")}
      <path d="M${pts.join("L")}L${x(last)},${y(0)}L${x(0)},${y(0)}Z" fill="var(--primary)" opacity=".1"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(last)}" cy="${y(values[last])}" r="4.5" fill="var(--primary)" stroke="var(--surface)" stroke-width="2"/>
      <text x="${x(last) - 8}" y="${y(values[last]) - 10}" text-anchor="end" font-size="12" font-weight="700" fill="var(--text)">${fmt(values[last])}</text>
      <line class="xh" x1="0" x2="0" y1="${PT}" y2="${CH - PB}" stroke="var(--muted)" stroke-dasharray="3 3" opacity="0"/>
      <circle class="xh-dot" r="5" fill="var(--primary)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
      <rect class="hit" x="${PL}" y="${PT}" width="${CW - PL - PR}" height="${CH - PT - PB}" fill="transparent"/></svg><div class="tip" hidden></div></div>`;
  }
  function bindCharts() {
    $$(".chart").forEach((wrap) => {
      const { labels, values } = JSON.parse(wrap.dataset.chart), svg = $("svg", wrap), tip = $(".tip", wrap);
      const max = Math.ceil(Math.max(...values) / 500) * 500, last = values.length - 1;
      const move = (e) => {
        const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * CW;
        const i = Math.max(0, Math.min(last, Math.round((px - PL) / ((CW - PL - PR) / last))));
        const cx = PL + i * (CW - PL - PR) / last, cy = PT + (1 - values[i] / max) * (CH - PT - PB);
        $(".xh", svg).setAttribute("x1", cx); $(".xh", svg).setAttribute("x2", cx); $(".xh", svg).setAttribute("opacity", ".6");
        $(".xh-dot", svg).setAttribute("cx", cx); $(".xh-dot", svg).setAttribute("cy", cy); $(".xh-dot", svg).setAttribute("opacity", "1");
        tip.hidden = false; tip.innerHTML = `<span class="muted">${labels[i]}</span><br><b>${fmt(values[i])}</b> подписчиков${i ? ` <span class="muted">+${fmt(values[i] - values[i - 1])}</span>` : ""}`;
        tip.style.left = Math.min(r.width - 170, Math.max(0, cx / CW * r.width - 85)) + "px"; tip.style.top = (cy / CH * r.height - 64) + "px";
      };
      const leave = () => { tip.hidden = true; $(".xh", svg).setAttribute("opacity", "0"); $(".xh-dot", svg).setAttribute("opacity", "0"); };
      $(".hit", svg).addEventListener("pointermove", move); $(".hit", svg).addEventListener("pointerleave", leave);
    });
  }
  views.cabinet = () => {
    const K = D.cabinet, c = cand(K.candidate), open = K.questions.filter((q) => !S.answered[q.id]), done = K.questions.filter((q) => S.answered[q.id]);
    const rate = Math.round((K.answerRate * 50 + done.length * 100) / (50 + done.length)), maxC = Math.max(...K.concerns.map((x) => x[1]));
    const kpi = (l, v, d, h) => `<div class="card kpi"><div class="lbl">${l}</div><div class="kpi-val">${v}</div><div class="small ${d ? "up" : "muted"}">${d || h || ""}</div></div>`;
    return pageHead("Кабинет кандидата", `${esc(c.name)} · ${esc(D.parties[c.party].name)}`, `<button class="btn ghost small" data-print>${ic("print")} Отчёт</button>`) + `
    <div class="grid kpis" id="kpis">${kpi("Подписчики", fmt(K.followers), `+${K.followersDelta}% за неделю`)}${kpi("Охват за 7 дней", fmt(K.reach), `+${K.reachDelta}% за неделю`)}
      ${kpi("Ответы на вопросы", rate + "%", null, `место ${K.rank} в округе`)}${kpi("Ждут ответа", open.length + K.pendingInitiatives.filter((i) => i.daysLeft !== null && !S.answered[i.id]).length, null, "вопросы и инициативы")}</div>
    <div class="layout wide" style="margin-top:14px"><div class="stack">
      <div class="card"><div class="row"><h3 style="margin:0">Подписчики</h3><span class="spacer"></span><span class="small muted">по неделям</span></div>${lineChart(K.weeks, K.followersByWeek)}</div>
      <div class="card" id="qqueue"><h3>Вопросы жителей</h3>
        ${open.map((q) => `<div class="q-item"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div class="q-sup">${ic("thumb")}<b>${q.support}</b></div>
          <div style="flex:1"><b>${esc(q.text)}</b><div class="small muted">${esc(q.author)} · ${topic(q.topic).name}</div>
          <textarea class="q-ans" data-qa-text="${q.id}" placeholder="Ваш публичный ответ"></textarea>
          <div class="row" style="margin-top:8px"><button class="btn ghost small" data-draft="${q.id}">${ic("spark")} Черновик ИИ</button><span class="spacer"></span><button class="btn small" data-answer="${q.id}">Ответить</button></div></div></div></div>`).join("") || `<p class="muted">Все вопросы отвечены.</p>`}
        ${done.length ? `<details style="margin-top:10px"><summary class="small" style="cursor:pointer;font-weight:600">Отвечено: ${done.length}</summary>${done.map((q) => `<div class="arg" style="margin-top:8px"><b>${esc(q.text)}</b><div class="small" style="margin-top:6px">${esc(S.answered[q.id])}</div></div>`).join("")}</details>` : ""}</div>
    </div>
    <aside class="rail">
      <div class="card"><h3>Что волнует округ</h3>${K.concerns.map(([n, v]) => `<div class="hbar" title="${esc(n)}: ${v}%"><div class="row" style="justify-content:space-between"><span class="small">${esc(n)}</span><b class="small">${v}%</b></div><div class="bar"><span style="width:${v / maxC * 100}%"></span></div></div>`).join("")}</div>
      <div class="card"><h3>Инициативы</h3>${K.pendingInitiatives.map((i) => `<div class="q-item"><b class="small">${esc(i.title)}</b><div class="small muted">${fmt(i.support)} подписей</div>
        ${S.answered[i.id] ? `<span class="chip ok">Ответ опубликован</span>` : i.daysLeft !== null ? `<div class="row" style="margin-top:6px"><span class="chip warn">${i.daysLeft} дн. на ответ</span><span class="spacer"></span><button class="btn small" data-init-ans="${i.id}">Ответить</button></div>` : `<span class="chip">Порог не достигнут</span>`}</div>`).join("")}</div>
      <p class="small muted">Кабинет бесплатен для всех кандидатов — равные условия.</p>
    </aside></div>`;
  };
  binders.cabinet = () => {
    bindCharts();
    $$("[data-draft]").forEach((b) => b.addEventListener("click", () => {
      const ta = $(`[data-qa-text="${b.dataset.draft}"]`), text = DRAFTS[b.dataset.draft]; let i = 0; ta.value = ""; b.disabled = true;
      const t = setInterval(() => { ta.value = text.slice(0, i += 3); if (i >= text.length) { clearInterval(t); b.disabled = false; } }, 16); timers.push(t);
    }));
    $$("[data-answer]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.answer, text = $(`[data-qa-text="${id}"]`).value.trim(); if (text.length < 20) return toast("Слишком коротко — жители ценят конкретику");
      S.answered[id] = text; save(); toast("Ответ опубликован"); render();
    }));
    $$("[data-init-ans]").forEach((b) => b.addEventListener("click", () => { S.answered[b.dataset.initAns] = "ok"; save(); toast("Ответ опубликован"); render(); }));
    $$("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));
  };

  /* ================= РЕГИСТРАЦИЯ ================= */
  let ob = { step: 0, interests: [] };
  const addrParam = (location.search.match(/[?&]addr=([^&]+)/) || [])[1];
  if (addrParam) ob.street = decodeURIComponent(addrParam.replace(/\+/g, " "));
  function renderOnboarding() {
    clearTimers(); document.body.classList.add("ob-mode");
    const box = $("#onboard"); box.hidden = false; const s = ob.step;
    let body = "";
    if (s === 0) body = `<div class="logo">${LOGO}</div><h1 class="ob-title">Что решают в вашем районе</h1>
      <p class="muted">Кандидаты, их обещания и то, о чём договорились соседи.</p>
      <label class="field">Ваш адрес<input id="obStreet" placeholder="Например, Садовая, 14" value="${esc(ob.street || "")}" autocomplete="street-address"></label>
      <button class="btn block" data-ob="addr">Продолжить</button><button class="btn ghost block" data-ob="demo">Демо без регистрации</button>`;
    else if (s === 1) body = `<h2>Подтвердите номер</h2><p class="muted small">Один человек — один голос. Номер нигде не показывается.</p>
      <label class="field">Телефон<input id="obPhone" inputmode="tel" autocomplete="off" placeholder="+7 900 000-00-00" value="${esc(ob.phone || "")}"></label>
      ${ob.codeSent ? `<div class="row" style="margin-top:14px"><b class="small">Код из SMS</b><span class="chip">в демо подойдёт любой</span></div><div class="code">${[0, 1, 2, 3].map((i) => `<input maxlength="1" inputmode="numeric" data-code="${i}" aria-label="Цифра ${i + 1}">`).join("")}</div>` : ""}
      <button class="btn block" data-ob="${ob.codeSent ? "verify" : "sendcode"}">${ob.codeSent ? "Подтвердить" : "Получить код"}</button>`;
    else if (s === 2) body = `<h2>Как вас зовут?</h2>
      <label class="field">Имя и фамилия<input id="obName" maxlength="40" value="${esc(ob.name || "")}"></label>
      <div class="info" style="margin-top:12px">${ic("pin")}<span>Ваш округ — <b>${esc(D.district)}</b>. Определили по адресу${ob.street ? ` «${esc(ob.street)}»` : ""}.</span></div>
      <button class="btn block" data-ob="profile">Дальше</button>`;
    else if (s === 3) body = `<h2>Что вам важно?</h2><p class="muted small">Выберите хотя бы две темы.</p>
      <div class="picks">${D.topics.map((t) => `<button class="pick ${ob.interests.includes(t.id) ? "on" : ""}" data-pick="${t.id}">${t.name}</button>`).join("")}</div>
      <button class="btn block" data-ob="interests" ${ob.interests.length < 2 ? "disabled" : ""}>Дальше</button>`;
    else if (s === 4) body = `<h2>Правила района</h2>
      <div class="ob-rule">${ic("lock")}<div><b>Ваши взгляды видны только вам</b></div></div>
      <div class="ob-rule">${ic("shield")}<div><b>Никакой политической рекламы</b></div></div>
      <div class="ob-rule">${ic("bridge")}<div><b>Спорим об идеях, а не о людях</b></div></div>
      <label class="row small" style="margin:10px 0;gap:10px;flex-wrap:nowrap"><input type="checkbox" id="obAgree" ${ob.agree ? "checked" : ""}> Согласен с правилами</label>
      <button class="btn block" data-ob="finish" ${ob.agree ? "" : "disabled"}>Готово</button>`;
    else body = `<div style="text-align:center"><div class="ob-done">${ic("check")}</div><h2>Добро пожаловать, ${esc((ob.name || "").split(" ")[0])}!</h2><p class="muted">Начните с Компаса — 3 минуты.</p></div>
      <a class="btn block" href="#/compass" data-ob="enter">Пройти Компас</a><a class="btn ghost block" href="#/feed" data-ob="enter">В ленту района</a>`;
    box.innerHTML = `<img class="bgimg" src="${photo("1789062665477-b58eb89a22b6", 1600)}" alt="">
      <div class="ob-card fade-in">${s > 0 && s < 5 ? `<div class="row" style="margin-bottom:16px"><button class="icon-btn" data-ob="back" aria-label="Назад" style="transform:scaleX(-1)">${ic("chevron")}</button><div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= s ? "done" : ""}"></i>`).join("")}</div></div>` : ""}${body}</div>`;
    bindOnboarding();
  }
  function finishOnboarding(profile) { S.profile = profile; S.xp += 20; save(); $("#onboard").hidden = true; document.body.classList.remove("ob-mode"); }
  function bindOnboarding() {
    const go = (n) => { ob.step = n; renderOnboarding(); };
    $$("[data-ob]").forEach((b) => b.addEventListener("click", (e) => {
      const a = b.dataset.ob;
      if (a === "addr") { ob.street = $("#obStreet").value.trim().replace(/^ул(\.|ица)?\s*/i, ""); if (ob.street.length < 3) return toast("Введите улицу"); go(1); }
      else if (a === "back") go(ob.step - 1);
      else if (a === "demo") { finishOnboarding({ name: "Алина Демо", district: D.district, street: "Садовая", interests: ["transport", "eco"] }); render(); }
      else if (a === "sendcode") { ob.phone = $("#obPhone").value; if (ob.phone.replace(/\D/g, "").length < 10) return toast("Введите номер полностью"); ob.codeSent = true; renderOnboarding(); $("[data-code='0']").focus(); }
      else if (a === "verify") { if ($$("[data-code]").some((i) => !i.value)) return toast("Введите 4 цифры"); ob.phone = ""; go(2); }
      else if (a === "profile") { ob.name = $("#obName").value.trim(); if (ob.name.length < 2) return toast("Как к вам обращаться?"); go(3); }
      else if (a === "interests") go(4);
      else if (a === "finish") go(5);
      else if (a === "enter") { e.preventDefault(); finishOnboarding({ name: ob.name, district: D.district, street: (ob.street || "").split(",")[0], interests: ob.interests }); location.hash = b.getAttribute("href"); render(); }
    }));
    $$("[data-pick]").forEach((b) => b.addEventListener("click", () => { const t = b.dataset.pick; ob.interests = ob.interests.includes(t) ? ob.interests.filter((x) => x !== t) : [...ob.interests, t]; renderOnboarding(); }));
    const agree = $("#obAgree"); if (agree) agree.addEventListener("change", () => { ob.agree = agree.checked; renderOnboarding(); });
    $$("[data-code]").forEach((inp, i, all) => {
      inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); if (inp.value && all[i + 1]) all[i + 1].focus(); if (all.every((x) => x.value)) $("[data-ob='verify']").click(); });
      inp.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !inp.value && all[i - 1]) all[i - 1].focus(); });
    });
    [["#obStreet", "addr"], ["#obPhone", "sendcode"], ["#obName", "profile"]].forEach(([sel, act]) => { const el = $(sel); if (el) el.addEventListener("keydown", (e) => { if (e.key === "Enter") $(`[data-ob='${act}']`).click(); }); });
  }

  /* ================= УВЕДОМЛЕНИЯ, ПОИСК, QR ================= */
  const closeLayers = () => $$(".layer").forEach((l) => l.remove());
  function openNotifs(anchor) {
    const had = $(".notif-panel"); closeLayers(); if (had) return;
    const r = anchor.getBoundingClientRect(), p = document.createElement("div");
    p.className = "layer notif-panel fade-in"; p.style.top = r.bottom + 8 + "px"; p.style.right = Math.max(8, innerWidth - r.right) + "px";
    p.innerHTML = `<div class="row"><b>Уведомления</b><span class="spacer"></span><button class="link-btn" data-readall>Прочитать все</button></div>
      ${D.notifications.map((n) => `<a class="notif ${S.readNotifs[n.id] ? "" : "unread"}" href="${n.link}" data-nid="${n.id}"><span class="n-ico"></span><span style="flex:1">${esc(n.text)}<br><span class="small muted">${n.time} назад</span></span></a>`).join("")}`;
    document.body.appendChild(p);
    $$("[data-nid]", p).forEach((a) => a.addEventListener("click", () => { S.readNotifs[a.dataset.nid] = true; save(); closeLayers(); refreshShell(); }));
    $("[data-readall]", p).addEventListener("click", () => { D.notifications.forEach((n) => (S.readNotifs[n.id] = true)); save(); closeLayers(); refreshShell(); });
  }
  function openSearch() {
    closeLayers();
    const idx = [
      ...D.candidates.map((c) => ({ g: "Кандидаты", t: c.name, s: c.role, l: "#/candidate/" + c.id, i: ava(c.name, "sm", c.id) })),
      ...D.groups.map((g) => ({ g: "Группы", t: g.name, s: g.desc, l: "#/group/" + g.id, i: "Г" })),
      ...D.initiatives.map((x) => ({ g: "Инициативы", t: x.title, s: x.text, l: "#/initiatives", i: "И" })),
      ...D.events.map((e) => ({ g: "События", t: e.title, s: `${e.date.split("-").reverse().slice(0, 2).join(".")} · ${e.place}`, l: "#/calendar", i: "С" })),
      ...D.academy.map((m) => ({ g: "Академия", t: m.title, s: m.cards[0], l: "#/lesson/" + m.id, i: "А" }))
    ];
    const m = document.createElement("div"); m.className = "layer modal-bg";
    m.innerHTML = `<div class="modal card fade-in" role="dialog" aria-label="Поиск"><div class="search-box">${ic("search")}<input id="q" placeholder="Кандидаты, события, инициативы" autocomplete="off"><kbd>Esc</kbd></div><div class="results" id="results"></div></div>`;
    document.body.appendChild(m);
    const q = $("#q", m), out = $("#results", m);
    const draw = () => {
      const v = q.value.trim().toLowerCase(); let last = "";
      const hits = v ? idx.filter((x) => (x.t + " " + x.s).toLowerCase().includes(v)).slice(0, 12) : idx.filter((x) => x.g === "Кандидаты");
      out.innerHTML = hits.map((x) => { const h = x.g !== last ? `<div class="res-g">${x.g}</div>` : ""; last = x.g; return h + `<a class="res" href="${x.l}"><span class="res-i">${x.i}</span><span><b>${esc(x.t)}</b><br><span class="small muted">${esc(x.s.slice(0, 80))}</span></span></a>`; }).join("") || `<p class="empty">Ничего не нашлось</p>`;
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
    m.innerHTML = `<div class="modal card fade-in" style="max-width:360px;text-align:center"><h3>Откройте на телефоне</h3><p class="small muted">Наведите камеру на код.</p><div id="qr" class="qr">загрузка…</div><button class="btn ghost small" data-close>Закрыть</button></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", (e) => { if (e.target === m || e.target.hasAttribute("data-close")) closeLayers(); });
    const draw = () => { const qr = window.qrcode(0, "M"); qr.addData(url); qr.make(); $("#qr", m).innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); };
    if (window.qrcode) return draw();
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
    s.onload = draw; s.onerror = () => ($("#qr", m).textContent = url); document.head.appendChild(s);
  }

  /* ================= ДЕМО-ТУР ================= */
  const TOUR = [
    { r: "#/feed", sel: ".seg", t: "Лента района", x: "Наверху — то, что поддерживают все группы жителей, а не самое громкое." },
    { r: "#/feed", sel: ".post .support", t: "Кто поддерживает", x: "Полоска показывает одобрение в каждой группе мнений. Спорные темы видны сразу." },
    { r: "#/feed", sel: "[data-sort=blind]", t: "Слепое пятно", x: "То, что обсуждают другие группы, но почти не видит ваша. Лекарство от эхо-камер." },
    { r: "#/compass", sel: ".q-card, .match-row", t: "Компас взглядов", x: "12 вопросов о районе — и процент совпадения с каждым кандидатом. Ответы не покидают телефон." },
    { r: "#/consensus", sel: ".cmap", t: "Карта согласия", x: "Жители голосуют по коротким утверждениям, алгоритм находит группы мнений." },
    { r: "#/consensus", sel: "#commonCard", t: "С чем согласны все", x: "Готовая повестка для городского совета — основанная на согласии." },
    { r: "#/initiatives", sel: ".init-card.reached", t: "Инициативы", x: "Набрали порог подписей — кандидаты обязаны ответить публично." },
    { r: "#/assistant", sel: "#memList", t: "Помощник с памятью", x: "Помнит район, интересы и мнения жителя — по модели открытого ai-memory-service." },
    { r: "#/cabinet", sel: "#kpis", t: "Кабинет кандидата", x: "Вторая сторона платформы: аудитория, вопросы жителей и черновики ответов с ИИ." },
    { r: "#/profile", sel: "#privacyCard", t: "Приватность", x: "Взгляды видны только владельцу. Данные можно скачать или удалить." }
  ];
  let tourStep = -1;
  function startTour() { if (!S.profile) finishOnboarding({ name: "Алина Демо", district: D.district, street: "Садовая", interests: ["transport", "eco"] }); tourStep = 0; showTour(); }
  function endTour() { tourStep = -1; $$(".tour").forEach((e) => e.remove()); }
  function showTour() {
    const st = TOUR[tourStep];
    if (location.hash !== st.r) location.hash = st.r; else render();
    setTimeout(() => {
      const el = $(st.sel.split(", ").map((s) => "#main " + s).join(", "));
      $$(".tour").forEach((e) => e.remove());
      const spot = document.createElement("div"); spot.className = "tour tour-spot";
      const tip = document.createElement("div"); tip.className = "tour tour-tip card";
      tip.innerHTML = `<div class="row"><span class="small muted">${tourStep + 1} из ${TOUR.length}</span><span class="spacer"></span><button class="link-btn" data-tour="end">Закрыть</button></div>
        <h3 style="margin:8px 0 6px">${st.t}</h3><p class="small" style="margin:0 0 14px">${st.x}</p>
        <div class="row">${tourStep > 0 ? `<button class="btn ghost small" data-tour="prev">Назад</button>` : ""}<span class="spacer"></span><button class="btn small" data-tour="next">${tourStep === TOUR.length - 1 ? "Готово" : "Дальше"}</button></div>`;
      document.body.append(spot, tip);
      if (el && innerWidth <= 860) { el.scrollIntoView({ block: "start", behavior: "instant" }); scrollBy(0, -70); }
      else if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
      if (!el) { spot.style.display = "none"; tip.classList.add("center"); }
      else {
        const r = el.getBoundingClientRect(), p = 8, h = Math.min(r.height, innerHeight * 0.6);
        Object.assign(spot.style, { top: r.top - p + "px", left: r.left - p + "px", width: r.width + p * 2 + "px", height: h + p * 2 + "px" });
        if (innerWidth > 860) {
          const below = r.top + h + 20;
          tip.style.left = Math.max(16, Math.min(innerWidth - 376, r.left)) + "px";
          tip.style.top = (below + 190 < innerHeight ? below : Math.max(16, r.top - 200)) + "px";
        }
      }
      $$("[data-tour]", tip).forEach((b) => b.addEventListener("click", () => {
        const a = b.dataset.tour; if (a === "end") return endTour();
        if (a === "next" && tourStep === TOUR.length - 1) { endTour(); return; }
        tourStep += a === "next" ? 1 : -1; showTour();
      }));
    }, 150);
  }
  window.addEventListener("resize", () => { if (tourStep >= 0) showTour(); });

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-search]")) return openSearch();
    const bell = e.target.closest("[data-bell]"); if (bell) return openNotifs(bell);
    if (e.target.closest("[data-qr]")) return openQR();
    if (e.target.closest("[data-tour-start]")) { $("#sidebar").classList.remove("open"); return startTour(); }
    if (e.target.closest("[data-theme-toggle]")) {
      const next = getComputedStyle(document.documentElement).colorScheme === "dark" ? "light" : "dark";
      applyTheme(next); try { localStorage.setItem("vc-theme", next); } catch (err) { /* ignore */ } return;
    }
    const go = e.target.closest("[data-go]"); if (go) { location.hash = go.dataset.go; return; }
    if (!e.target.closest(".notif-panel")) $$(".notif-panel").forEach((p) => p.remove());
    if (!e.target.closest("#sidebar") && !e.target.closest("#menuBtn")) $("#sidebar").classList.remove("open");
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    if (e.key === "Escape") { closeLayers(); if (tourStep >= 0) endTour(); }
    if (tourStep >= 0 && e.key === "ArrowRight") { const b = $("[data-tour='next']"); if (b) b.click(); }
    if (tourStep >= 0 && e.key === "ArrowLeft") { const b = $("[data-tour='prev']"); if (b) b.click(); }
  });

  /* ================= МАРШРУТИЗАЦИЯ ================= */
  const navOf = { candidate: "candidates", group: "groups", lesson: "academy" };
  let lastRoute = "";
  function render() {
    clearTimers();
    if (!S.profile) return renderOnboarding();
    $("#onboard").hidden = true; document.body.classList.remove("ob-mode"); closeLayers(); refreshShell();
    let [route, arg] = (location.hash.replace(/^#\/?/, "") || "feed").split("/");
    if (!views[route]) route = "feed";
    if (route === "compass" && arg === "retake" && lastRoute.indexOf("compass") !== 0) cq = 0;
    if (route !== "initiatives" && editorHandle) { editorHandle.destroy(); editorHandle = null; initForm = false; }
    $("#main").innerHTML = views[route](arg);
    if (binders[route]) binders[route](arg);
    $$("#nav a, #tabbar a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#/" + (navOf[route] || route)));
    if (lastRoute !== route + (arg || "")) { window.scrollTo(0, 0); $("#sidebar").classList.remove("open"); }
    lastRoute = route + (arg || "");
  }
  window.addEventListener("hashchange", render);
  render();
  if (/[?&]tour=1/.test(location.search)) setTimeout(startTour, 400);
  if (location.search) history.replaceState(null, "", location.pathname + location.hash);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
