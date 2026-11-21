// Проверки браузера. Описание кейсов — docs/SECURITY_TESTS.md.
const { test, expect } = require("@playwright/test");

const KEY = "voteconnect-demo-v2";
const PAGES = ["/index.html", "/investors.html", "/privacy.html", "/app.html?demo=1#/vote"];
const APP_ROUTES = [
  ["vote", "Проекты"],
  ["results", "Итоги голосования"],
  ["report", "Отчёт для администрации"]
];

test("SEC-01 Страницы загружают ресурсы только со своего сайта", async ({ page, baseURL }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("websocket", (socket) => requests.push(socket.url()));

  for (const url of PAGES) await page.goto(url);
  for (const [route] of APP_ROUTES) await page.goto("/app.html#/" + route);
  await page.evaluate(() => document.fonts.ready);
  expect(requests.filter((url) => new URL(url).origin !== new URL(baseURL).origin)).toEqual([]);
});

test("SEC-02 Отметки проектов и отправка голоса остаются в браузере", async ({ page, baseURL }) => {
  await page.goto(PAGES[3], { waitUntil: "networkidle" });
  const requests = [];
  const favicon = new URL("/assets/icons/icon-192.png", baseURL).href;
  page.on("request", (request) => {
    if (request.method() !== "GET" || request.url() !== favicon) requests.push(request.url());
  });

  await page.locator('[data-pick="b1"]').click();
  await page.getByRole("button", { name: "Проголосовать" }).click();
  await expect(page.getByRole("heading", { name: "Спасибо, ваш голос учтён" })).toBeVisible();
  await page.getByRole("link", { name: "Посмотреть итоги" }).click();
  await expect(page.getByRole("heading", { name: "Итоги голосования" })).toBeVisible();
  expect(requests).toEqual([]);
});

test("SEC-14 Разметка из хранилища не попадает в страницу", async ({ page }) => {
  const marker = "<b data-storage-marker>разметка</b>";
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify({
    pb: { picks: [value, "b1"], submitted: true, receipt: value },
    profile: { name: value }
  })), { key: KEY, value: marker });

  await page.goto(PAGES[3]);
  await expect(page.getByRole("heading", { name: "Спасибо, ваш голос учтён" })).toBeVisible();
  await expect(page.locator("[data-storage-marker], #receiptCode")).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem")).toContainText("Светофор с кнопкой у школы № 12");
});

for (const url of PAGES) {
  test("SEC-16 CSP блокирует inline-скрипт на " + url, async ({ page }) => {
    await page.goto(url);
    const violated = await page.evaluate(() => new Promise((resolve) => {
      document.addEventListener("securitypolicyviolation", (event) => resolve(event.blockedURI), { once: true });
      const script = document.createElement("script");
      script.textContent = "window.inlineTestRan = true";
      document.head.appendChild(script);
    }));
    expect(violated).toBe("inline");
    expect(await page.evaluate(() => window.inlineTestRan)).toBeUndefined();
  });
}

test("SEC-18 Внешние ссылки используют noopener и noreferrer", async ({ page }) => {
  for (const url of PAGES) {
    await page.goto(url);
    const unsafe = await page.locator('a[href^="https://"]').evaluateAll((links) =>
      links.filter((link) => link.target !== "_blank" || !link.relList.contains("noopener") || !link.relList.contains("noreferrer"))
        .map((link) => link.href));
    expect(unsafe, url).toEqual([]);
  }
});

test("SEC-19 У каждой страницы есть политика безопасности и реферера", async ({ page }) => {
  for (const url of PAGES) {
    await page.goto(url);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("connect-src 'none';");
    expect(csp).toContain("object-src 'none';");
    expect(csp).toContain("base-uri 'self';");
    expect(await page.locator('meta[name="referrer"]').getAttribute("content")).toBe("strict-origin-when-cross-origin");
  }
});

test("SEC-20 Все оставшиеся страницы открываются без ошибок", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(response.url() + " " + response.status());
  });
  for (const url of PAGES) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  for (const [route, heading] of APP_ROUTES) {
    await page.goto("/app.html#/" + route);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await page.goto("/app.html#/constructor");
  await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("SEC-24 Офлайн-кэш открывает проекты с параметром демо", async ({ page, context }) => {
  await page.goto("/index.html");
  await page.evaluate(() => navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto(PAGES[3]);
  await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
  await expect(page.locator("[data-pick]")).toHaveCount(8);
});

test("SEC-33 Повреждённый JSON и значения неверного типа не мешают голосовать", async ({ page }) => {
  const broken = ["{сломано", "null", '{"pb":null}', '{"pb":{"picks":{},"submitted":true}}',
    '{"pb":{"picks":[],"submitted":true},"__proto__":{"polluted":true}}'];
  await page.goto(PAGES[3]);
  for (const value of broken) {
    await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [KEY, value]);
    await page.reload();
    await expect(page.getByText("Выбрано 0 из 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Проголосовать" })).toBeDisabled();
  }
  expect(await page.evaluate(() => ({}).polluted)).toBeUndefined();
  await page.locator('[data-pick="b1"]').click();
  await page.getByRole("button", { name: "Проголосовать" }).click();
  await expect(page.getByRole("heading", { name: "Спасибо, ваш голос учтён" })).toBeVisible();
});

test("SEC-34 Квитанция сохраняется, а повторное демо выдаёт другой номер", async ({ page }) => {
  await page.goto(PAGES[3]);
  const receipt = page.locator("#receiptCode");
  const cast = async () => {
    await page.locator('[data-pick="b1"]').click();
    await page.getByRole("button", { name: "Проголосовать" }).click();
    await expect(receipt).toHaveText(/^[0-9A-F]{4}(?:-[0-9A-F]{4}){2}$/);
    return receipt.textContent();
  };
  const first = await cast();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).pb, KEY);
  expect(Object.keys(saved).sort()).toEqual(["picks", "receipt", "submitted"]);
  await page.reload();
  await expect(receipt).toHaveText(first);
  await page.getByRole("link", { name: "Начать демо заново" }).click();
  expect(await cast()).not.toBe(first);
});
