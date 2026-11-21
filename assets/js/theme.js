/* Выбор темы хранится в браузере и применяется на всех страницах. */
(function () {
  "use strict";

  const key = "vc-theme";
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const button = document.querySelector("#themeToggle");

  try {
    const stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark") root.dataset.theme = stored;
  } catch { /* Системная тема доступна и без хранилища. */ }

  if (!button) return;
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : system.matches;
  const paint = () => { button.textContent = isDark() ? "Светлая тема" : "Тёмная тема"; };
  paint();
  system.addEventListener("change", paint);
  button.addEventListener("click", () => {
    const theme = isDark() ? "light" : "dark";
    root.dataset.theme = theme;
    try { localStorage.setItem(key, theme); } catch { /* Тема действует до перезагрузки. */ }
    paint();
  });
})();
