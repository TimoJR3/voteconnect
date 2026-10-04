// Автотесты безопасности и утечек данных VoteConnect. Описание кейсов — docs/SECURITY_TESTS.md.
const { test, expect } = require("@playwright/test");

const KEY = "voteconnect-demo-v2";
// Полезная нагрузка XSS: если экранирование сломается, в DOM появятся img/svg с обработчиками.
const XSS = `<img src=x onerror=window.__xss=1><svg onload=window.__xss=2>`;
const XSS_SHORT = `<img src=x onerror=window.__xss=1>`;   // для полей с ограничением длины
const APP_ROUTES = ["feed", "budget", "consensus", "compass", "polls", "candidates", "candidate/lebedeva", "promises", "calendar",
  "groups", "group/g-transport", "initiatives", "academy", "lesson/m1", "assistant", "profile", "cabinet", "admin", "report"];

const demo = (page, hash = "#/feed") => page.goto(`/app.html?reset=1&demo=1${hash}`);
const go = async (page, hash) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForTimeout(150); };

// Внедрённая разметка не должна попасть в DOM — проверяем структуру, а не только выполнение,
// чтобы политика CSP не маскировала ошибки экранирования.
async function expectNoInjection(page) {
  const found = await page.evaluate(() => ({
    xss: window.__xss || 0,
    img: document.querySelectorAll('img[src="x"]').length,
    handlers: [...document.querySelectorAll("*")].filter((el) => [...el.attributes].some((a) => /^on/i.test(a.name))).length
  }));
  expect(found).toEqual({ xss: 0, img: 0, handlers: 0 });
}

// Сбор всех сетевых запросов страницы.
function recordRequests(page) {
  const list = [];
  page.on("request", (r) => list.push({ url: r.url(), method: r.method() }));
  page.on("websocket", (ws) => list.push({ url: ws.url(), method: "WEBSOCKET" }));
  return list;
}

async function onboard(page, { street, phone, name }) {
  await page.goto("/app.html?reset=1#/feed");
  await page.fill("#obStreet", street); await page.click("[data-ob=addr]");
  await page.fill("#obPhone", phone); await page.click("[data-ob=sendcode]");
  for (let i = 0; i < 4; i++) await page.fill(`[data-code="${i}"]`, String(i + 1));
  await page.fill("#obName", name); await page.click("[data-ob=profile]");
  await page.click("[data-pick=transport]"); await page.click("[data-pick=eco]"); await page.click("[data-ob=interests]");
  await page.check("#obAgree"); await page.click("[data-ob=finish]");
  await page.click('a[data-ob=enter][href="#/feed"]');
  await expect(page.locator("#main h1")).toHaveText("Лента района");
}

test.describe("Утечка данных", () => {
  test("SEC-01 Ни одного запроса к сторонним серверам на всех страницах и экранах", async ({ page }) => {
    const reqs = recordRequests(page);
    await page.goto("/index.html"); await page.goto("/investors.html");
    await demo(page);
    for (const r of APP_ROUTES) await go(page, `#/${r}`);
    await page.keyboard.press("Control+K"); await page.fill("#q", "автобус"); await page.keyboard.press("Escape");
    await page.click("[data-qr]"); await expect(page.locator("#qr svg")).toBeVisible(); await page.keyboard.press("Escape");
    await go(page, "#/initiatives"); await page.click("#newInit"); await expect(page.locator("#editorBox [data-slate-editor]").first()).toBeVisible();
    const foreign = reqs.filter((r) => /^(https?|wss?):/.test(r.url) && new URL(r.url).host !== "127.0.0.1:4173");
    expect(foreign, "запросы к сторонним серверам").toEqual([]);
  });

  test("SEC-02 Ответы Компаса, голоса и посты не уходят по сети", async ({ page }) => {
    await demo(page, "#/compass");
    const reqs = recordRequests(page);
    for (let i = 0; i < 12; i++) await page.click('[data-ans="2"]');
    await go(page, "#/consensus"); await page.click('[data-cv="s1:1"]'); await page.click('[data-cv="s2:-1"]');
    await go(page, "#/budget"); await page.click("[data-pick-pb=b1]"); await page.click("#pbSubmit");
    await go(page, "#/feed"); await page.click("#composeBtn"); await page.fill("#postText", "Тестовый пост о дворе"); await page.click("#postBtn");
    await go(page, "#/assistant"); await page.fill("#askInput", "Я живу на Мира"); await page.keyboard.press("Enter");
    const notGet = reqs.filter((r) => r.method !== "GET");
    const withQuery = reqs.filter((r) => /^https?:/.test(r.url) && new URL(r.url).search);
    expect(notGet, "запросы, кроме загрузки файлов").toEqual([]);
    expect(withQuery, "запросы с параметрами").toEqual([]);
  });

  test("SEC-03 Имя, адрес и телефон не попадают в адреса запросов", async ({ page }) => {
    const reqs = recordRequests(page);
    await onboard(page, { street: "Садовая 14", phone: "+7 900 111-22-33", name: "Иван Тестов" });
    for (const r of ["feed", "profile", "assistant", "calendar"]) await go(page, `#/${r}`);
    const urls = reqs.map((r) => decodeURIComponent(r.url)).concat(decodeURIComponent(page.url()));
    for (const secret of ["Иван", "Тестов", "Садовая", "9001112233", "111-22-33"]) {
      expect(urls.filter((u) => u.includes(secret)), `«${secret}» в адресе запроса`).toEqual([]);
    }
  });

  test("SEC-04 Номер телефона не сохраняется на устройстве", async ({ page }) => {
    await onboard(page, { street: "Садовая 14", phone: "+7 900 111-22-33", name: "Иван Тестов" });
    const stored = await page.evaluate((k) => localStorage.getItem(k), KEY);
    expect(stored).toContain("Иван Тестов");
    expect(stored.replace(/\D/g, "")).not.toContain("9001112233");
  });

  test("SEC-05 Адрес из формы на сайте убирается из адресной строки", async ({ page }) => {
    await page.goto("/index.html");
    await page.fill('input[name="addr"]', "Садовая 14");
    await page.click('.lp-find button[type="submit"]');
    await expect(page.locator("#obStreet")).toHaveValue("Садовая 14");
    expect(new URL(page.url()).search).toBe("");
  });

  test("SEC-06 Аватар не раскрывает имя пользователя", async ({ page }) => {
    await onboard(page, { street: "Садовая 14", phone: "+7 900 111-22-33", name: "Иван Тестов" });
    const srcs = await page.$$eval("img", (els) => els.map((e) => decodeURIComponent(e.getAttribute("src") || "")));
    expect(srcs.filter((s) => s.includes("Иван"))).toEqual([]);
  });

  test("SEC-07 «Удалить всё» стирает личные данные", async ({ page }) => {
    await onboard(page, { street: "Садовая 14", phone: "+7 900 111-22-33", name: "Иван Тестов" });
    await go(page, "#/compass"); for (let i = 0; i < 12; i++) await page.click('[data-ans="-2"]');
    await go(page, "#/profile");
    page.once("dialog", (d) => d.accept());
    await page.click("#wipeBtn");
    await expect(page.locator("#obStreet")).toBeVisible();
    const stored = await page.evaluate((k) => localStorage.getItem(k), KEY);
    expect(stored).not.toContain("Иван");
    expect(JSON.parse(stored).compass).toEqual({});
  });

  test("SEC-08 Выгрузка «Мои данные» содержит только данные владельца", async ({ page }) => {
    await onboard(page, { street: "Садовая 14", phone: "+7 900 111-22-33", name: "Иван Тестов" });
    await go(page, "#/profile");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
    const data = JSON.parse(require("fs").readFileSync(await dl.path(), "utf8"));
    expect(data.profile.name).toBe("Иван Тестов");
    expect(JSON.stringify(data)).not.toMatch(/password|token|9001112233/i);
  });
});

test.describe("Внедрение кода (XSS)", () => {
  test("SEC-09 Имя пользователя с HTML отображается как текст", async ({ page }) => {
    await onboard(page, { street: "Садовая 14", phone: "+7 900 111-22-33", name: XSS_SHORT });
    for (const r of ["feed", "profile", "assistant", "compass"]) { await go(page, `#/${r}`); await expectNoInjection(page); }
    // Положительная проверка: имя показано ровно как введено — значит, оно экранировано, а не «съедено» разметкой.
    await go(page, "#/profile");
    await expect(page.locator("#main h1").first()).toHaveText(XSS_SHORT);
  });

  test("SEC-10 Пост и комментарий с HTML", async ({ page }) => {
    await demo(page);
    await page.click("#composeBtn"); await page.fill("#postText", XSS); await page.click("#postBtn");
    await expect(page.locator(".post").first()).toContainText("<img src=x");
    await page.click('[data-cm="p3"]'); await page.fill('[data-ci="p3"]', XSS); await page.keyboard.press("Enter");
    await expectNoInjection(page);
  });

  test("SEC-11 Помощник, поиск и дебаты с HTML", async ({ page }) => {
    await demo(page, "#/assistant");
    await page.fill("#askInput", XSS); await page.keyboard.press("Enter"); await expectNoInjection(page);
    await page.keyboard.press("Control+K"); await page.fill("#q", XSS); await expectNoInjection(page); await page.keyboard.press("Escape");
    await go(page, "#/group/g-transport");
    await page.fill("#und", `${XSS} они считают иначе`); await page.fill("#argt", `${XSS} аргумент`); await page.click("#argBtn");
    await expectNoInjection(page);
  });

  test("SEC-12 Инициатива: заголовок и текст редактора с HTML", async ({ page }) => {
    await demo(page, "#/initiatives");
    await page.click("#newInit");
    const blocks = page.locator("#editorBox [data-slate-editor]"); await expect(blocks.first()).toBeVisible();
    const editor = blocks.last();   // пустой абзац после «Кто должен сделать»
    await page.fill("#inTitle", XSS_SHORT + " светофор");
    await editor.click();
    await page.keyboard.type(`${XSS} нужен светофор у школы`);
    await page.click("#inBtn");
    await expect(page.locator(".init-card").first()).toContainText("светофор");
    await expectNoInjection(page);
  });

  test("SEC-13 HTML в адресе страницы не внедряется", async ({ page }) => {
    await page.goto(`/app.html?reset=1&addr=${encodeURIComponent(`"><img src=x onerror=window.__xss=1>`)}`);
    await expectNoInjection(page);
    await demo(page);
    for (const h of [`#/candidate/${XSS}`, `#/group/${XSS}`, `#/lesson/${XSS}`, `#/${XSS}`]) { await go(page, h); await expectNoInjection(page); }
  });

  test("SEC-14 Подменённые данные в хранилище браузера не внедряются", async ({ page }) => {
    await demo(page);
    await page.evaluate(([k, x]) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.profile.name = x; s.profile.street = x; s.profile.district = x;
      s.posts = [{ id: "evil", type: "citizen", author: x, time: x, text: x, likes: 0, comments: 0 }];
      s.chat = [{ me: true, text: x }, { me: false, text: x, used: [x] }];
      s.memory = [{ type: "fact", key: x, value: x, conf: 1 }];
      s.myInitiatives = [{ id: "e1", title: x, html: x + "<p>текст</p>", text: x, topic: "edu", author: x, support: 0, goal: 10, responses: 0 }];
      s.comments = { p3: [{ author: x, text: x, likes: 0 }] };
      localStorage.setItem(k, JSON.stringify(s));
    }, [KEY, XSS]);
    await page.reload();
    for (const r of ["feed", "profile", "assistant", "initiatives"]) { await go(page, `#/${r}`); await expectNoInjection(page); }
    await go(page, "#/feed"); await page.click('[data-cm="p3"]'); await expectNoInjection(page);
  });

  test("SEC-15 Очистка текста инициатив оставляет только безопасные теги", async ({ page }) => {
    await demo(page);
    const cases = await page.evaluate(() => {
      const c = window.VCSanitize.cleanHTML;
      return [
        c(`<h3 onclick="x()">Проблема</h3><p style="color:red">текст</p>`),
        c(`<p>а<img src=x onerror="window.__xss=1">б</p>`),
        c(`<p>а<script>window.__xss=2</script>б</p>`),
        c(`<p><a href="javascript:alert(1)">ссылка</a></p>`),
        c(`<p><b onmouseover="x()">жирный</b> <iframe src="//evil"></iframe></p>`),
        c(`<svg><script>window.__xss=3</script></svg><p>после</p>`)
      ];
    });
    expect(cases).toEqual([
      "<h4>Проблема</h4><p>текст</p>",
      "<p>аб</p>",
      "<p>аб</p>",
      "<p>ссылка</p>",
      "<p><b>жирный</b></p>",
      "<p>после</p>"
    ]);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__xss || 0)).toBe(0);
  });

  for (const pageUrl of ["/index.html", "/investors.html", "/app.html?demo=1"]) {
    test(`SEC-16 Политика безопасности блокирует внедрённый скрипт: ${pageUrl}`, async ({ page }) => {
      const violations = [];
      page.on("console", (m) => { if (/Content Security Policy/.test(m.text())) violations.push(m.text()); });
      await page.goto(pageUrl);
      await page.evaluate(() => {
        document.body.insertAdjacentHTML("beforeend", `<img src="data:," onerror="window.__csp=1"><div onclick="window.__csp=2"></div>`);
        document.querySelector("[onclick]").click();
        const s = document.createElement("script"); s.textContent = "window.__csp=3"; document.body.appendChild(s);
      });
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => window.__csp || 0)).toBe(0);
      expect(violations.length).toBeGreaterThan(0);
    });
  }
});

test.describe("Выгрузки, ссылки и заголовки", () => {
  test("SEC-17 CSV-выгрузка защищена от формул Excel", async ({ page }) => {
    await demo(page, "#/admin");
    const unit = await page.evaluate(() => ["=1+1", "+7 900", "-2", "@SUM(A1)", "обычный текст", 'кавычка "x"'].map(window.VCSanitize.csvCell));
    expect(unit).toEqual([`"'=1+1"`, `"'+7 900"`, `"'-2"`, `"'@SUM(A1)"`, `"обычный текст"`, `"кавычка ""x"""`]);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#csvBtn")]);
    const cells = require("fs").readFileSync(await dl.path(), "utf8").replace(/^﻿/, "").split(/\r\n/).flatMap((l) => l.split(";"));
    expect(cells.filter((c) => /^"?[=+\-@]/.test(c))).toEqual([]);
  });

  test("SEC-18 Внешние ссылки открываются без доступа к нашей вкладке", async ({ page }) => {
    const bad = [];
    for (const url of ["/index.html", "/investors.html", "/app.html?demo=1#/assistant"]) {
      await page.goto(url);
      bad.push(...await page.$$eval('a[href^="http"]', (as) => as.filter((a) => !a.href.startsWith(location.origin))
        .filter((a) => !(a.rel.includes("noopener") && a.rel.includes("noreferrer"))).map((a) => a.href)));
    }
    expect(bad).toEqual([]);
  });

  test("SEC-19 На каждой странице есть политика безопасности и политика реферера", async ({ page }) => {
    for (const url of ["/index.html", "/investors.html", "/app.html"]) {
      await page.goto(url);
      const meta = await page.evaluate(() => ({
        csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "",
        ref: document.querySelector('meta[name="referrer"]')?.content || ""
      }));
      expect(meta.csp, url).toContain("script-src 'self'");
      expect(meta.csp, url).toContain("object-src 'none'");
      expect(meta.csp, url).toContain("base-uri 'self'");
      expect(meta.ref, url).toBe("strict-origin-when-cross-origin");
    }
  });

  test("SEC-20 Все экраны открываются без ошибок JavaScript", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await demo(page);
    for (const r of APP_ROUTES) await go(page, `#/${r}`);
    await page.click("[data-tour-start]");
    for (let i = 0; i < 11; i++) { const next = page.locator("[data-tour=next]"); if (!(await next.count())) break; await next.click(); await page.waitForTimeout(200); }
    expect(errors).toEqual([]);
  });
});
