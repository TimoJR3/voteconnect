const { test, expect } = require("@playwright/test");

const KEY = "voteconnect-demo-v2";
const route = (screen = "vote") => "/app.html?demo=1#/" + screen;
const project = (page, id) => page.locator('[data-pick="' + id + '"]');
const submit = (page) => page.getByRole("button", { name: "Проголосовать", exact: true });

test("VOTE-01 Приложение открывает проекты без регистрации", async ({ page }) => {
  await page.goto("/app.html");
  await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
  await expect(page.locator("[data-pick]")).toHaveCount(8);
  await expect(submit(page)).toBeDisabled();
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(2);
});

test("VOTE-02 Можно выбрать три проекта, даже если их сумма выше бюджета", async ({ page }) => {
  await page.goto(route());
  for (const id of ["b8", "b7", "b3"]) await project(page, id).click();
  await expect(page.getByText("Выбрано 3 из 3")).toBeVisible();
  await expect(page.getByText("Можно выбрать не больше трёх. Снимите отметку, чтобы выбрать другой")).toBeVisible();
  await expect(project(page, "b1")).toBeDisabled();
  await expect(submit(page)).toBeEnabled();
  await project(page, "b7").click();
  await expect(project(page, "b7")).toHaveAttribute("aria-pressed", "false");
  await expect(project(page, "b1")).toBeEnabled();
  await project(page, "b1").click();
  await expect(page.locator('[data-pick][aria-pressed="true"]')).toHaveCount(3);
});

test("VOTE-03 Выбор и отправленный голос переживают перезагрузку", async ({ page }) => {
  await page.goto(route());
  await project(page, "b1").click();
  await project(page, "b8").click();
  await page.reload();
  await expect(project(page, "b1")).toHaveAttribute("aria-pressed", "true");
  await submit(page).click();
  await expect(page.getByRole("heading", { name: "Спасибо, ваш голос учтён" })).toBeVisible();
  await expect(page.getByText("Велодорожка вдоль берега Каспия")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Спасибо, ваш голос учтён" })).toBeVisible();
  await expect(submit(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Посмотреть итоги" }).click();
  await expect(page.getByText(/Проголосовали 2\s319 жителей/)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Пешеходный светофор на проспекте Акушинского" })).toContainText(/1\s291/);
});

test("VOTE-04 Подменённые и повторные id отбрасываются, остаётся до трёх", async ({ page }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: KEY, state: { scenario: "makhachkala", pb: { picks: ["unknown", "b2", "b2", {}, "b6", "b8", "b1"], submitted: "true" } }
  });
  await page.goto(route());
  await expect(page.locator('[data-pick][aria-pressed="true"]')).toHaveCount(3);
  for (const id of ["b2", "b6", "b8"]) await expect(project(page, id)).toHaveAttribute("aria-pressed", "true");
  await expect(project(page, "b1")).toHaveAttribute("aria-pressed", "false");
});

test("VOTE-05 Сброс демо очищает голос и сохраняет тему", async ({ page }) => {
  await page.goto(route());
  await page.getByRole("button", { name: /Светлая тема|Тёмная тема/ }).click();
  const theme = await page.evaluate(() => localStorage.getItem("vc-theme"));
  await project(page, "b1").click();
  await submit(page).click();
  await page.getByRole("link", { name: "Начать демо заново" }).click();
  await expect(submit(page)).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("vc-theme"))).toBe(theme);
  await page.reload();
  await expect(page.getByText("Выбрано 0 из 3")).toBeVisible();
});

test("VOTE-06 Итоги пропускают дорогой проект и включают следующий в остаток", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00"));
  await page.goto(route("results"));
  await expect(page.getByText("Проголосовали 2 318 жителей. Голосование до 7 декабря")).toBeVisible();
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(8);
  await expect(rows.nth(0)).toContainText("Пешеходный светофор на проспекте Акушинского");
  await expect(rows.nth(5)).toContainText("Ремонт дворов на проспекте Петра Первого");
  await expect(rows.nth(5)).not.toContainText("Проходит");
  await expect(rows.nth(6)).toContainText("Проходит");
  await expect(page.getByText("Проходит", { exact: true })).toHaveCount(6);
  await page.getByRole("link", { name: "Отчёт для администрации" }).click();
  await expect(page.getByRole("main")).toBeFocused();
  const report = page.getByRole("table");
  await expect(report.getByRole("row")).toHaveCount(7);
  await expect(report).toContainText("Площадка для выгула собак");
  await expect(report).not.toContainText("Ремонт дворов на проспекте Петра Первого");
  await page.evaluate(() => { window.print = () => { window.printRequested = true; }; });
  await page.getByRole("button", { name: "Скачать PDF" }).click();
  expect(await page.evaluate(() => window.printRequested)).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation")).toBeHidden();
  await expect(page.getByRole("button", { name: "Скачать PDF" })).toBeHidden();
  await expect(report).toBeVisible();
});

test("VOTE-07 Клавиатура управляет выбором и переходами", async ({ page }) => {
  await page.goto(route());
  const first = project(page, "b1");
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(first).toBeFocused();
  expect(await first.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.getByRole("link", { name: "Итоги", exact: true }).click();
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page.getByRole("link", { name: "Итоги", exact: true })).toHaveAttribute("aria-current", "page");
});

test("VOTE-08 Главная ведёт к проектам и отчёту", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/index.html");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main ol > li")).toHaveCount(3);
  await expect(page.locator("img, canvas")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Пример отчёта" })).toHaveAttribute("href", "app.html?demo=1#/report");
  const demo = page.getByRole("link", { name: "Попробовать демо" });
  await expect(demo).toBeInViewport({ ratio: 1 });
  await demo.click();
  await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
});

test("VOTE-09 Главная, проекты, итоги и печатный отчёт используют пример Махачкалы", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("в Махачкале");
  await expect(page.getByText(/Проекты, суммы и голоса вымышлены/)).toBeVisible();
  await page.getByRole("link", { name: "Попробовать демо" }).click();

  await expect(page.getByText("Махачкала, Республика Дагестан · демо", { exact: true })).toBeVisible();
  await expect(project(page, "b2")).toContainText("Вечерний автобус до Тарки");
  await page.getByRole("link", { name: "Итоги", exact: true }).click();
  await expect(page.getByText(/Махачкала, демо/)).toBeVisible();
  await expect(page.getByRole("list")).toContainText("Освещение дорожек у озера Ак-Гёль");
  await page.getByRole("link", { name: "Отчёт для администрации" }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Махачкала, Республика Дагестан. Данные демо.", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Освещение дорожек у озера Ак-Гёль");
});

test("VOTE-10 Голос из прежнего демо не засчитывается за проекты Махачкалы", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
    pb: { picks: ["b1"], submitted: true, receipt: "A111-B222-C333" }
  })), KEY);
  await page.goto(route());
  await expect(page.getByText("Выбрано 0 из 3")).toBeVisible();
  await expect(project(page, "b1")).toHaveAttribute("aria-pressed", "false");
  await expect(submit(page)).toBeDisabled();
});

for (const colorScheme of ["light", "dark"]) {
  test("LAYOUT Адаптивность и контраст в теме " + colorScheme, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const url of ["/index.html", "/privacy.html", "/investors.html", route(), route("results"), route("report")]) {
        await page.goto(url);
        const layout = await page.evaluate(async () => {
          await document.fonts.ready;
          const main = document.querySelector("main");
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            width: main.getBoundingClientRect().width,
            theme: getComputedStyle(document.documentElement).colorScheme
          };
        });
        expect(layout.overflow, url + " " + width).toBeLessThanOrEqual(0);
        expect(layout.width, url + " " + width).toBeLessThanOrEqual(640);
        expect(layout.theme).toBe(colorScheme);
        if (width < 560 && ["/privacy.html", "/investors.html"].includes(url)) {
          const rows = await page.locator("main table tbody tr").evaluateAll((elements) =>
            elements.map((row) => getComputedStyle(row).display));
          expect(rows.length).toBeGreaterThan(0);
          expect(rows.every((display) => display === "block"), url).toBe(true);
        }
      }
      await page.goto(route());
      expect(await page.locator(".app-nav").evaluate((el) => getComputedStyle(el).position)).toBe(width < 768 ? "fixed" : "static");
      expect(await page.locator(".project-mark").first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
      const controls = await page.locator("button, .app-nav a").evaluateAll((elements) => {
        function luminance(color) {
          const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map((n) => {
            const channel = Number(n) / 255;
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
          });
          return r * .2126 + g * .7152 + b * .0722;
        }
        return elements.map((element) => {
          const { width, height } = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const fg = luminance(style.color);
          const bg = luminance(style.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.body).backgroundColor : style.backgroundColor);
          return { width, height, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
        });
      });
      expect(controls.every(({ width, height, ratio }) => width >= 44 && height >= 48 && ratio >= 4.5)).toBe(true);
    }
  });
}
