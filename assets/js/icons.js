/* VoteConnect — набор линейных иконок (24×24, обводка 1.6). Общий для сайта и приложения. */
(function () {
  "use strict";
  const ICONS = {
    feed: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z"/><path d="M17 8h3v9a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12h7M7 15h4"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    consensus: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
    polls: '<path d="M5 20V11M10 20V5M15 20v-7M20 20v-4"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.3.2 3.9 1.8 4.5 4.8"/>',
    promise: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 12l3 3 5-6"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="1"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    groups: '<path d="M4 5h16v10H9l-5 4z"/>',
    megaphone: '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
    book: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>',
    profile: '<rect x="3.5" y="5.5" width="17" height="13" rx="1"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.5-1.6 1.7-2.4 3.2-2.4s2.7.8 3.2 2.4M14.5 10h3.5M14.5 13h3.5"/>',
    chart: '<path d="M4 20h16"/><path d="M5 16l4.5-5 3.5 3 6-7"/><path d="M15 7h4v4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    theme: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5v15a7.5 7.5 0 0 0 0-15z" fill="currentColor"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    heart: '<path d="M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.6 12 19 12 19z"/>',
    heartOn: '<path d="M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.6 12 19 12 19z" fill="currentColor"/>',
    comment: '<path d="M5 5h14v10h-8l-4 3.5V15H5z"/>',
    share: '<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>',
    pen: '<path d="M5 19l1-4L16 5l3 3L9 18z"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    phone: '<rect x="7" y="3.5" width="10" height="17" rx="1.5"/><path d="M11 17.5h2"/>',
    play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    send: '<path d="M4 12l16-7-6 15-2.5-6.5z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    spark: '<path d="M12 4l1.6 4.6L18 10l-4.4 1.4L12 16l-1.6-4.6L6 10l4.4-1.4z"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1"/><path d="M7 14h10v6H7z"/>',
    pin: '<path d="M12 21s6-5.6 6-10.5a6 6 0 0 0-12 0C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    shield: '<path d="M12 3.5l7 2.8V12c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6.3z"/>',
    bridge: '<path d="M3 16h18M5 16v-3M19 16v-3M3 13c3 0 5-4 9-4s6 4 9 4"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
    stop: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };
  const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;
  window.VCIcons = { ICONS, ic };
  document.querySelectorAll("[data-i]").forEach((el) => (el.innerHTML = ic(el.dataset.i)));
})();
