/* Экранирование текста для вставки в HTML и атрибуты. */
(function () {
  "use strict";

  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (text) => String(text).replace(/[&<>"']/g, (char) => entities[char]);

  window.VCSanitize = { esc };
})();
