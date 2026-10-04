/* VoteConnect — очистка пользовательских данных перед выводом.
   Отдельный модуль, чтобы его можно было проверять автотестами (tests/). */
(function () {
  "use strict";

  // Экранирование текста для вставки в HTML и в значения атрибутов.
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Белый список для текста инициатив: только блоки и простое форматирование, без атрибутов.
  // DOMParser создаёт инертный документ: скрипты не выполняются, картинки не загружаются,
  // поэтому вредоносный HTML не срабатывает даже во время разбора.
  const INLINE = { STRONG: "b", B: "b", EM: "i", I: "i", MARK: "mark" };
  const DROP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "IFRAME", "OBJECT", "SVG", "MATH"]);   // содержимое не выводим вовсе
  function cleanHTML(src) {
    const doc = new DOMParser().parseFromString(String(src), "text/html");
    const inline = (n) => [...n.childNodes].map((c) => {
      if (c.nodeType === 3) return esc(c.textContent);
      if (c.nodeType !== 1 || DROP.has(c.tagName.toUpperCase())) return "";
      const tag = INLINE[c.tagName];
      return tag ? `<${tag}>${inline(c)}</${tag}>` : inline(c);
    }).join("");
    const out = [];
    doc.body.querySelectorAll("h1,h2,h3,p,li,blockquote").forEach((n) => {
      if (n.parentElement && n.parentElement.closest("h1,h2,h3,p,li,blockquote")) return;   // вложенные блоки уже вошли в родителя
      const t = inline(n).trim(); if (!t) return;
      out.push(/^H/.test(n.tagName) ? `<h4>${t}</h4>` : n.tagName === "LI" ? `<p>• ${t}</p>` : n.tagName === "BLOCKQUOTE" ? `<p><i>${t}</i></p>` : `<p>${t}</p>`);
    });
    return out.join("");
  }

  // Ячейка CSV: кавычки экранируются, а значения, которые Excel принял бы за формулу
  // (=, +, -, @, табуляция, перевод строки), получают апостроф — защита от CSV-инъекции.
  function csvCell(v) {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }

  window.VCSanitize = { esc, cleanHTML, csvCell };
})();
