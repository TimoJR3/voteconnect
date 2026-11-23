/* VoteConnect — голосование за проекты района. */
(function () {
  "use strict";

  const KEY = "voteconnect-demo-v2";
  const LIMIT = 3;
  const { budget, city, region, scenario } = window.VC_DATA;
  const projects = budget.projects;
  const projectIds = new Set(projects.map((project) => project.id));
  const { esc } = window.VCSanitize;
  const main = document.querySelector("#main");
  const navLinks = document.querySelectorAll(".app-nav a");
  const fmt = (number) => number.toLocaleString("ru-RU");
  const rub = (amount) => (amount / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " млн ₽";
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

  const emptyVote = () => ({ picks: [], submitted: false, receipt: "" });

  function readVote() {
    try {
      const state = JSON.parse(localStorage.getItem(KEY));
      // Одинаковые ID в другом сценарии могут означать другие проекты.
      if (state?.scenario !== scenario) return emptyVote();
      const saved = state.pb;
      if (!Array.isArray(saved?.picks)) return emptyVote();

      const picks = [...new Set(saved.picks.filter((id) => projectIds.has(id)))].slice(0, LIMIT);
      const submitted = saved.submitted === true && picks.length > 0;
      const receipt = submitted && picks.length === saved.picks.length &&
        typeof saved.receipt === "string" && /^[0-9A-F]{4}(?:-[0-9A-F]{4}){2}$/.test(saved.receipt) ? saved.receipt : "";
      return { picks, submitted, receipt };
    } catch {
      return emptyVote();
    }
  }

  let vote = readVote();
  let submitting = false;

  function storeVote(value) {
    localStorage.setItem(KEY, JSON.stringify({ scenario, pb: value }));
  }

  // Случайная соль не сохраняется. Номер нельзя связать с набором проектов.
  async function makeReceipt(picks) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    let hex = salt;
    if (crypto.subtle) {
      const message = salt + ":" + [...picks].sort().join(",");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
      hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return hex.slice(0, 12).toUpperCase().replace(/(.{4})(?!$)/g, "$1-");
  }

  const pbVotes = (project) => project.votes + (vote.submitted && vote.picks.includes(project.id) ? 1 : 0);
  const pbVoters = () => budget.voters + (vote.submitted ? 1 : 0);
  const rankedProjects = () => [...projects].sort((a, b) => pbVotes(b) - pbVotes(a));

  function pbWinners(ranked) {
    let left = budget.total;
    return ranked.filter((project) => {
      if (project.cost > left) return false;
      left -= project.cost;
      return true;
    });
  }

  function projectsView() {
    if (vote.submitted) {
      return `<h1>Спасибо, ваш голос учтён</h1>
        <ul class="plain-list chosen-list" role="list">
          ${vote.picks.map((id) => `<li>${esc(projects.find((project) => project.id === id).title)}</li>`).join("")}
        </ul>
        ${vote.receipt ? `<p class="small muted">Номер голоса: <span id="receiptCode">${esc(vote.receipt)}</span></p>` : ""}
        <div class="page-actions">
          <a class="button" href="#/results">Посмотреть итоги</a>
          <a class="action-link small" id="resetVote" href="#/vote">Начать демо заново</a>
        </div>
        <p class="form-error small" id="voteError" role="alert"></p>`;
    }

    return `<h1>Проекты</h1>
      <p class="small muted">${esc(city)}, ${esc(region)} · демо</p>
      <ul class="plain-list project-list" role="list">
        ${projects.map((project) => `<li><button class="project" type="button" data-pick="${esc(project.id)}" aria-pressed="false">
          <span class="project-mark" aria-hidden="true"></span>
          <span><strong>${esc(project.title)}</strong>
            <span class="project-detail small muted">${esc(rub(project.cost))} · идея: ${esc(project.author)}</span>
          </span>
        </button></li>`).join("")}
      </ul>
      <p class="small muted limit-note" id="voteLimit" hidden>Можно выбрать не больше трёх. Снимите отметку, чтобы выбрать другой</p>
      <p class="form-error small" id="voteError" role="alert"></p>
      <div class="vote-panel"><div class="wrap">
        <span id="voteCount" class="small" role="status">Выбрано ${esc(vote.picks.length)} из ${LIMIT}</span>
        <button class="button" type="button" id="submitVote" disabled>Проголосовать</button>
      </div></div>`;
  }

  function resultsView() {
    const ranked = rankedProjects();
    const winners = new Set(pbWinners(ranked));
    const leader = Math.max(1, pbVotes(ranked[0]));
    const closes = dateLabel.format(new Date(budget.stages[2].to + "T00:00:00"));
    return `<h1>Итоги голосования</h1>
      <p class="small muted">Проголосовали ${esc(fmt(pbVoters()))} жителей. Голосование до ${esc(closes)}</p>
      <ol class="plain-list results-list" role="list">
        ${ranked.map((project, index) => `<li class="result-row">
          <span class="small muted">${index + 1}</span>
          <div class="result-name"><strong>${esc(project.title)}</strong>
            ${winners.has(project) ? '<span class="small passing">Проходит</span>' : ""}
          </div>
          <span class="result-votes small">${esc(fmt(pbVotes(project)))}<span class="visually-hidden"> голосов</span></span>
          <meter min="0" max="${esc(leader)}" value="${esc(pbVotes(project))}" aria-hidden="true"></meter>
        </li>`).join("")}
      </ol>
      <p class="small muted">${esc(city)}, демо. Проекты проходят по числу голосов, пока хватает ${esc(rub(budget.total))}.</p>
      <a class="action-link" href="#/report">Отчёт для администрации</a>`;
  }

  function reportView() {
    const winners = pbWinners(rankedProjects());
    return `<h1>Отчёт для администрации</h1>
      <p class="small muted">${esc(city)}, ${esc(region)}. Данные демо.</p>
      <dl class="report-numbers">
        <div><dt class="small muted">Проголосовали</dt><dd>${esc(fmt(pbVoters()))}</dd></div>
        <div><dt class="small muted">Проходят</dt><dd>${esc(fmt(winners.length))}</dd></div>
      </dl>
      <table aria-label="Проходящие проекты">
        <thead><tr><th scope="col">Проект</th><th scope="col">Стоимость</th><th scope="col">Голоса</th></tr></thead>
        <tbody>${winners.map((project) => `<tr><th scope="row">${esc(project.title)}</th>
          <td>${esc(rub(project.cost))}</td><td>${esc(fmt(pbVotes(project)))}</td></tr>`).join("")}</tbody>
      </table>
      <button class="button print-button" type="button" id="printReport">Скачать PDF</button>`;
  }

  function updateVoteControls() {
    const submit = main.querySelector("#submitVote");
    if (!submit) return;
    const atLimit = vote.picks.length === LIMIT;
    for (const button of main.querySelectorAll("[data-pick]")) {
      const selected = vote.picks.includes(button.dataset.pick);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = submitting || (atLimit && !selected);
    }
    main.querySelector("#voteLimit").hidden = !atLimit;
    const count = main.querySelector("#voteCount");
    const label = `Выбрано ${vote.picks.length} из ${LIMIT}`;
    if (count.textContent !== label) count.textContent = label;
    submit.disabled = submitting || vote.picks.length === 0;
  }

  function toggleProject(id) {
    if (submitting || vote.submitted || !projectIds.has(id)) return;
    const stored = readVote();
    if (stored.submitted) {
      vote = stored;
      render(true);
      return;
    }

    if (vote.picks.includes(id)) vote.picks = vote.picks.filter((pick) => pick !== id);
    else if (vote.picks.length < LIMIT) vote.picks = [...vote.picks, id];
    else return;

    try { storeVote(vote); } catch { /* Выбор остаётся доступен в открытой вкладке. */ }
    main.querySelector("#voteError").textContent = "";
    updateVoteControls();
  }

  async function submitVote() {
    if (submitting || vote.submitted || !vote.picks.length) return;
    submitting = true;
    updateVoteControls();

    try {
      const picks = [...vote.picks];
      const receipt = await makeReceipt(picks);
      const commit = () => {
        const stored = readVote();
        if (stored.submitted) return stored;
        const submitted = { picks, receipt, submitted: true };
        storeVote(submitted);
        return submitted;
      };
      vote = navigator.locks ? await navigator.locks.request(KEY, commit) : commit();
    } catch {
      const error = main.querySelector("#voteError");
      if (error) error.textContent = "Не удалось сохранить голос. Проверьте настройки браузера и попробуйте снова.";
    } finally {
      submitting = false;
    }

    if (vote.submitted) render(location.hash === "#/vote");
    else updateVoteControls();
  }

  function resetVote(event) {
    event.preventDefault();
    try {
      localStorage.removeItem(KEY);
    } catch {
      main.querySelector("#voteError").textContent = "Не удалось очистить данные демо. Проверьте настройки браузера и попробуйте снова.";
      return;
    }
    vote = emptyVote();
    render(true);
  }

  function render(focus = false) {
    const hash = location.hash;
    const route = hash === "#/results" || hash === "#/report" ? hash : "#/vote";
    if (hash !== route) history.replaceState(null, "", route);
    main.innerHTML = route === "#/results" ? resultsView() : route === "#/report" ? reportView() : projectsView();
    for (const link of navLinks) {
      if (link.hash === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.body.classList.toggle("has-vote-panel", !!main.querySelector(".vote-panel"));
    updateVoteControls();
    if (focus) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    }
  }

  main.addEventListener("click", (event) => {
    const project = event.target.closest("[data-pick]");
    if (project && !project.disabled) toggleProject(project.dataset.pick);
    else if (event.target.closest("#submitVote")) submitVote();
    else if (event.target.closest("#resetVote")) resetVote(event);
    else if (event.target.closest("#printReport")) window.print();
  });
  window.addEventListener("hashchange", () => render(true));
  window.addEventListener("storage", (event) => {
    if (event.storageArea !== localStorage || (event.key !== KEY && event.key !== null)) return;
    const previous = vote.submitted;
    vote = readVote();
    if (location.hash === "#/vote" && previous === vote.submitted) updateVoteControls();
    else render();
  });

  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
