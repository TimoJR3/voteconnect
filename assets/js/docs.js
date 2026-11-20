/* Страницы-документы (инвесторам, данные): меню на телефоне и 3D-макет района с проектами, прошедшими голосование.
   Без inline-скриптов — их блокирует политика безопасности. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);

  try { const t = localStorage.getItem("vc-theme"); if (t === "dark" || t === "light") document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }

  // Меню на телефоне
  const top = $(".s-top"), menu = $(".s-menu"), nav = $("#siteNav");
  if (top && menu && nav) {
    const onScroll = () => top.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    const setMenu = (open) => { menu.setAttribute("aria-expanded", String(open)); nav.classList.toggle("open", open); $(".s-menu-t", menu).textContent = open ? "Закрыть" : "Меню"; };
    menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menu.focus(); } });
  }

  // 3D-макет: победители голосования по правилу отбора — по числу голосов, пока хватает бюджета
  const host = $("#invModel"); if (!host) return;
  const D = window.VC_DATA;
  let mq = null;
  try {
    if (D && window.VC3D && window.VC3D.supported()) {
      const SHORT = { b1: "Светофор у школы", b2: "Автобус 14 до 23:30", b3: "Свет на набережной", b4: "Навесы на остановках", b5: "Площадка для собак", b7: "Двор на Садовой", b8: "Велодорожка" };
      const B = D.budget, mln = (n) => (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
      let left = B.total; const win = [];
      [...B.projects].sort((a, b) => b.votes - a.votes).forEach((p) => { if (p.cost <= left) { win.push(p.id); left -= p.cost; } });
      const projects = B.projects.filter((p) => SHORT[p.id]).map((p) => ({ id: p.id, price: mln(p.cost) + " млн", short: SHORT[p.id] }));
      let picks = win.filter((id) => SHORT[id]);
      mq = window.VC3D.maquette(host, {
        label: "3D-макет Северного округа с проектами, которые проходят по итогам голосования. Они показаны зелёным.",
        projects, selected: picks, evening: true,
        onToggle: (id) => { picks = picks.includes(id) ? picks.filter((x) => x !== id) : picks.concat(id); mq.setSelected(picks); }
      });
    }
  } catch (e) { mq = null; }
  if (!mq) { host.classList.add("no-3d"); return; }
  const eve = $("#eveBtn");
  const paint = () => { const on = mq.isEvening(); eve.setAttribute("aria-pressed", String(on)); $("span", eve).textContent = on ? "День" : "Вечер"; };
  eve.addEventListener("click", () => { mq.setEvening(!mq.isEvening()); paint(); });
  paint();
})();
