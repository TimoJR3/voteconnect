/* Лендинг (без inline-скриптов — их блокирует политика безопасности). */
(function () {
  "use strict";
  const end = new Date(window.VC_DATA.budget.stages[2].to + "T00:00:00");
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  document.getElementById("voteEnd").textContent = end.getDate() + " " + MON[end.getMonth()];

  // Адрес передаём в приложение через sessionStorage, а не в адресе запроса (?addr=…):
  // так он не попадает в логи сервера и историю браузера. Без sessionStorage форма уходит обычным способом.
  const form = document.querySelector(".lp-find");
  form.addEventListener("submit", (e) => {
    const addr = form.elements.addr.value.trim(); if (!addr) return;
    try { sessionStorage.setItem("vc-addr", addr); e.preventDefault(); location.href = "app.html"; } catch (err) { /* обычная отправка формы */ }
  });
})();
