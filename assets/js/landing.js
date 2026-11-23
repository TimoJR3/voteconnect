/* Сайт: корзина бюджета на 3D-макете, модель согласия, меню и форма адреса.
   Без inline-скриптов — их блокирует политика безопасности. */
(function () {
  "use strict";
  const D = window.VC_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const dayMon = (iso) => { const d = new Date(iso + "T00:00:00"); return d.getDate() + " " + MON[d.getMonth()]; };
  // Год пишем, только если он не текущий: «3 мая 2027»
  const dayMonY = (iso) => { const y = +iso.slice(0, 4); return dayMon(iso) + (y !== new Date().getFullYear() ? " " + y : ""); };

  /* ---------- Адрес ---------- */
  // Подключаем первым, чтобы форма работала, даже если 3D не запустится.
  // Адрес передаём в приложение через sessionStorage, а не в адресе запроса (?addr=…):
  // так он не попадает в логи сервера и историю браузера. Без sessionStorage форма уходит обычным способом.
  const form = $(".lp-find");
  form.addEventListener("submit", (e) => {
    const addr = form.elements.addr.value.trim();
    if (!addr) { e.preventDefault(); form.elements.addr.focus(); return; }
    try { sessionStorage.setItem("vc-addr", addr); e.preventDefault(); location.href = "app.html"; } catch (err) { /* обычная отправка формы */ }
  });

  // 3D не должно ломать страницу: при любой ошибке показываем фото вместо макета
  const safe3D = (fn) => { try { return fn(); } catch (e) { return null; } };

  // Тема, выбранная в приложении, действует и на сайте
  try { const t = localStorage.getItem("vc-theme"); if (t === "dark" || t === "light") document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }

  /* ---------- Шапка и меню ---------- */
  const top = $(".s-top"), menu = $(".s-menu"), nav = $("#siteNav");
  const onScroll = () => top.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  function setMenu(open) { menu.setAttribute("aria-expanded", String(open)); nav.classList.toggle("open", open); $(".s-menu-t", menu).textContent = open ? "Закрыть" : "Меню"; }
  menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menu.focus(); } });
  document.addEventListener("click", (e) => { if (nav.classList.contains("open") && !e.target.closest(".s-top")) setMenu(false); });

  /* ---------- Даты цикла ---------- */
  const st = D.budget.stages, today = new Date().toISOString().slice(0, 10);
  $("#voteEnd").textContent = dayMon(st[2].to);
  $$("#stages li").forEach((li, i) => {
    const s = st[i]; if (!s) return;
    $(".s-date", li).textContent = dayMonY(s.from) + " — " + dayMonY(s.to);
    if (today > s.to) li.classList.add("done"); else if (today >= s.from) { li.classList.add("now"); li.setAttribute("aria-current", "step"); }
  });

  /* ---------- Корзина бюджета ---------- */
  const TOTAL = D.budget.total;
  const byId = Object.fromEntries(D.budget.projects.map((p) => [p.id, p]));
  const SHORT = { b1: "Светофор у школы", b2: "Автобус до Тарки", b3: "Свет у Ак-Гёль", b4: "Навесы на остановках", b7: "Двор на Петра Первого" };
  const ids = $$(".s-proj").map((b) => b.dataset.id).filter((id) => byId[id]);
  const mln = (n) => (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  let picks = ["b1", "b3"];
  try {
    const saved = JSON.parse(sessionStorage.getItem("vc-pb-picks") || "null");
    if (Array.isArray(saved)) picks = saved.filter((id) => ids.includes(id));
  } catch (e) { /* ignore */ }
  const spent = () => picks.reduce((a, id) => a + byId[id].cost, 0);
  if (spent() > TOTAL) picks = [];

  const note = $("#pbNote"), noteDefault = note.innerHTML;
  let noteTimer = 0;
  function say(text) {
    note.textContent = text; clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.innerHTML = noteDefault; $("#voteEnd").textContent = dayMon(st[2].to); }, 4200);
  }

  let mq = null;
  function renderBudget() {
    const s = spent(), left = TOTAL - s;
    $("#pbSum").textContent = `${mln(s)} из ${mln(TOTAL)} млн ₽`;
    $("#pbBar").style.width = Math.min(100, (s / TOTAL) * 100) + "%";
    $("#pbMeterBar").setAttribute("aria-valuenow", mln(s).replace(",", "."));
    $$(".s-proj").forEach((b) => {
      const id = b.dataset.id, on = picks.includes(id);
      b.setAttribute("aria-pressed", String(on));
      const tooMuch = !on && byId[id] && byId[id].cost > left;
      if (tooMuch) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
    });
    const go = $("#pbGo");
    go.textContent = picks.length ? `Проголосовать в демо (${picks.length})` : "Проголосовать в демо";
    if (mq) mq.setSelected(picks);
  }
  function toggle(id) {
    if (!byId[id]) return;
    const i = picks.indexOf(id);
    if (i >= 0) { picks.splice(i, 1); }
    else {
      const left = TOTAL - spent();
      if (byId[id].cost > left) { say(`Не помещается: в корзине осталось ${mln(left)} млн ₽. Уберите другой проект.`); return; }
      picks.push(id);
    }
    renderBudget();
  }
  $$(".s-proj").forEach((b) => {
    b.addEventListener("click", () => toggle(b.dataset.id));
    b.addEventListener("pointerenter", () => mq && mq.hover(b.dataset.id));
    b.addEventListener("pointerleave", () => mq && mq.hover(null));
    b.addEventListener("focus", () => mq && mq.hover(b.dataset.id));
    b.addEventListener("blur", () => mq && mq.hover(null));
  });
  // Корзина переезжает в демо-приложение: оно подхватит её на экране бюджета
  $("#pbGo").addEventListener("click", () => { try { sessionStorage.setItem("vc-pb-picks", JSON.stringify(picks)); } catch (e) { /* ignore */ } });

  const has3D = !!(window.VC3D && safe3D(() => window.VC3D.supported()));
  const host = $("#maquette");
  if (has3D) {
    mq = safe3D(() => window.VC3D.maquette(host, {
      label: "Условный 3D-макет района Махачкалы с набережной, школой и жилыми дворами. Выбранные проекты показаны зелёным.",
      projects: ids.map((id) => ({ id, price: mln(byId[id].cost) + " млн", short: SHORT[id] || byId[id].title })),
      selected: picks,
      onToggle: toggle,
      onHover: (id) => $$(".s-proj").forEach((b) => b.classList.toggle("hover", b.dataset.id === id))
    }));
  }
  if (!mq) host.classList.add("no-3d");
  renderBudget();

  const eve = $("#eveBtn");
  function paintEve() {
    const on = mq && mq.isEvening();
    eve.setAttribute("aria-pressed", String(!!on));
    $("span", eve).textContent = on ? "День" : "Вечер";
    eve.setAttribute("aria-label", on ? "Показать макет днём" : "Показать макет вечером");
  }
  if (mq) { eve.addEventListener("click", () => { mq.setEvening(!mq.isEvening()); paintEve(); }); paintEve(); }

  /* ---------- Модель согласия ---------- */
  const C = D.consensus, css = getComputedStyle(document.documentElement);
  const clusters = C.clusters.map((c, i) => ({ ...c, hex: (css.getPropertyValue("--c" + (i + 1)) || "#888").trim() }));
  const SHOW = ["s8", "s4", "s3", "s2"];
  const stmts = C.statements.filter((s) => SHOW.includes(s.id)).sort((a, b) => SHOW.indexOf(a.id) - SHOW.indexOf(b.id));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function verdict(id) {
    const v = clusters.map((c) => ({ short: c.short, a: c.agree[id] }));
    if (v.every((x) => x.a >= 0.8)) return { text: "Согласны все", all: true };
    const hi = v.reduce((a, b) => (b.a > a.a ? b : a)), lo = v.reduce((a, b) => (b.a < a.a ? b : a));
    return { text: `${cap(hi.short)} за, ${lo.short} против`, all: false };
  }
  const box = $("#stmts");
  stmts.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "s-stmt"; b.dataset.s = s.id; b.setAttribute("aria-pressed", String(i === 0));
    const t = document.createElement("span"); t.className = "s-stmt-t"; t.textContent = s.text.replace(/\.$/, "");
    const bars = document.createElement("span"); bars.className = "s-bars";
    bars.setAttribute("role", "img");
    bars.setAttribute("aria-label", clusters.map((c) => `${c.short} ${Math.round(c.agree[s.id] * 100)}%`).join(", "));
    clusters.forEach((c, gi) => { const bar = document.createElement("i"); bar.style.setProperty("--v", Math.round(c.agree[s.id] * 100) + "%"); bar.style.setProperty("--c", `var(--c${gi + 1})`); bars.appendChild(bar); });
    const vd = verdict(s.id);
    const v = document.createElement("span"); v.className = "s-stmt-v" + (vd.all ? " all" : ""); v.textContent = vd.text;
    b.append(t, bars, v);
    box.appendChild(b);
  });
  const consHost = $("#consModel");
  const cons = has3D ? safe3D(() => window.VC3D.consensus(consHost, { clusters, statement: SHOW[0] })) : null;
  if (!cons) consHost.classList.add("no-3d");
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".s-stmt"); if (!b) return;
    $$(".s-stmt", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    if (cons) cons.show(b.dataset.s);
  });
})();
