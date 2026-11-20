// Регрессионные тесты: ошибки, найденные контрольным аудитом 13 октября 2026. Описание — docs/SECURITY_TESTS.md.
const { test, expect } = require("@playwright/test");

const demo = (page, hash = "#/feed") => page.goto(`/app.html?reset=1&demo=1${hash}`);
const go = async (page, hash) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForTimeout(150); };
const watchErrors = (page) => { const list = []; page.on("pageerror", (e) => list.push(e.message)); return list; };

test.describe("Регрессии", () => {
  test("REG-01 Календарь переходит через Новый год и показывает день голосования", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-20T12:00:00"));   // события демо сдвигаются на январь
    await demo(page, "#/calendar");
    await expect(page.locator("#calPrev")).toBeDisabled();
    const months = [], titles = [];
    for (let i = 0; i < 4; i++) {
      months.push((await page.locator(".cal").locator("xpath=..").locator("h3").textContent()).trim());
      titles.push(...await page.$$eval(".cal .ev", (els) => els.map((e) => e.title)));
      if (await page.locator("#calNext").isDisabled()) break;
      await page.click("#calNext");
    }
    expect(months).toEqual(["Ноябрь", "Декабрь", "Январь 2027"]);
    expect(titles).toContain("ДЕНЬ ГОЛОСОВАНИЯ");
  });

  test("REG-02 Колонки календаря одинаковые и не вылезают за карточку", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await demo(page, "#/calendar");
    const m = await page.evaluate(() => {
      const cal = document.querySelector(".cal"), w = [...cal.querySelectorAll(".dow")].map((d) => d.getBoundingClientRect().width);
      return { spread: Math.max(...w) - Math.min(...w), overflow: cal.scrollWidth - cal.clientWidth, outside: cal.getBoundingClientRect().right - cal.parentElement.getBoundingClientRect().right };
    });
    expect(m.spread).toBeLessThan(2);
    expect(m.overflow).toBeLessThanOrEqual(0);
    expect(m.outside).toBeLessThanOrEqual(0);
  });

  test("REG-03 Служебные и неизвестные адреса не ломают приложение", async ({ page }) => {
    const errors = watchErrors(page);
    await demo(page);
    for (const h of ["#/toString", "#/valueOf", "#/__proto__", "#/constructor/x", "#/hasOwnProperty"]) {
      await go(page, h); await expect(page.locator("#main h1")).toHaveText("Лента района");
    }
    await go(page, "#/candidate/nobody"); await page.click('[data-ct="eco"]');
    await expect(page.locator('[data-ct="eco"]')).toHaveClass(/active/);   // фильтр списка работает
    await go(page, "#/group/nobody");
    expect(errors).toEqual([]);
  });

  test("REG-04 Испорченный адрес ?addr=% открывает регистрацию, а не пустой экран", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/app.html?reset=1&addr=%");
    await expect(page.locator("#obStreet")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("REG-05 Адрес с главной после демо-тура начинает настоящую регистрацию", async ({ page }) => {
    await demo(page);
    await page.goto("/index.html");
    await page.fill('input[name="addr"]', "Лесная, 3"); await page.click('.lp-find button[type="submit"]');
    await expect(page.locator("#obStreet")).toHaveValue("Лесная, 3");
  });

  test("REG-06 Компас: если пропустить все вопросы, совпадений и значка нет", async ({ page }) => {
    await demo(page, "#/compass");
    await page.click("#cmpAgree");
    for (let i = 0; i < 12; i++) await page.click("#skipQ");
    await expect(page.locator("#main")).toContainText("Вы пропустили все вопросы");
    await expect(page.locator(".match-row")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("voteconnect-demo-v2")).badges.compass)).toBeUndefined();
  });

  test("REG-07 Склонения в отчёте для совета и кабинете", async ({ page }) => {
    await demo(page, "#/report");
    await expect(page.locator(".report-kpis")).toContainText("решения, которые поддерживают все группы");
    await expect(page.locator(".report")).not.toContainText("решений, которые");
    await go(page, "#/admin");
    await expect(page.locator("#adminKpis")).toContainText("утверждения на Карте согласия");
  });

  test("REG-08 Файл календаря соответствует стандарту: DTSTAMP и экранирование", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));   // первое событие месяца — субботник «Набережная, у моста»
    await demo(page, "#/calendar");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("[data-ics]").first().click()]);
    const ics = require("fs").readFileSync(await dl.path(), "utf8");
    expect(ics).toMatch(/\r\nDTSTAMP:\d{8}T\d{6}Z\r\n/);
    expect(ics).toMatch(/LOCATION:Набережная\\, у моста/);
  });

  test("REG-09 Число участников и голоса в опросах не растут сами по себе", async ({ page }) => {
    await demo(page, "#/consensus");
    const before = await page.locator(".page-head").textContent();
    await page.waitForTimeout(3000);
    expect(await page.locator(".page-head").textContent()).toBe(before);
    await go(page, "#/polls"); await page.locator("[data-pv]").first().click();
    const total = await page.locator("[data-total]").first().textContent();
    await page.waitForTimeout(2500);
    expect(await page.locator("[data-total]").first().textContent()).toBe(total);
  });

  test("REG-10 Поиск участка помечен как демо и ведёт на сайт ЦИК", async ({ page }) => {
    await demo(page, "#/calendar");
    await page.click("#findBtn");
    await expect(page.locator("#station")).toContainText("Демо");
    await expect(page.locator('#station a[href^="https://www.cikrf.ru"]')).toHaveCount(1);
  });
  test("REG-09 Корзина с 3D-макета главной переезжает в голосование", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/index.html");
    await page.click('.s-proj[data-id="b2"]');                      // b1 и b3 выбраны по умолчанию
    await expect(page.locator("#pbSum")).toContainText("9,4 из 15");
    await page.click('.s-proj[data-id="b7"]');                      // 9,4 + 5,6 — ровно весь бюджет
    await expect(page.locator("#pbSum")).toContainText("15 из 15");
    await page.click('.s-proj[data-id="b4"]', { force: true });     // помечен «не помещается»: нажатие объясняет, корзина не меняется
    await expect(page.locator("#pbSum")).toContainText("15 из 15");
    await expect(page.locator("#pbNote")).toContainText("Не помещается");
    await page.click("#pbGo");
    await page.waitForURL(/app.html/);
    await page.evaluate(() => (location.hash = "#/budget"));
    await expect(page.locator("#pbMeter")).toContainText("15 млн");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("voteconnect-demo-v2")).pb.picks.sort())).toEqual(["b1", "b2", "b3", "b7"]);
    expect(errors).toEqual([]);
  });

  test("REG-10 Подменённая корзина с главной не ломает бюджет и не выходит за 15 млн", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/index.html");
    await page.evaluate(() => sessionStorage.setItem("vc-pb-picks", JSON.stringify(["b8", "b7", "b3", "<img src=x>", "b8", null, { id: "b1" }])));
    await page.goto("/app.html?reset=1&demo=1#/budget");
    await expect(page.locator("#pbMeter")).toContainText("12,4 млн");   // b8 6,8 + b7 5,6; b3 уже не помещается
    expect(await page.evaluate(() => sessionStorage.getItem("vc-pb-picks"))).toBeNull();
    await page.evaluate(() => sessionStorage.setItem("vc-pb-picks", "{сломано"));
    await page.goto("/app.html?demo=1#/budget");
    await expect(page.locator("#pbMeter")).toBeVisible();
    expect(errors).toEqual([]);
  });
  test("REG-11 На телефоне макет есть в ленте и в бюджете, метки работают", async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await demo(page, "#/feed");
    await expect(page.locator(".feed-3d .m3d-pin")).toHaveCount(7, { timeout: 10000 });
    await page.locator('.feed-3d .m3d-pin[data-id="b1"] .m3d-pin-in').click();   // в ленте метка открывает бюджет
    await expect(page).toHaveURL(/budget/);
    await page.locator('.pb-3d .m3d-pin[data-id="b1"] .m3d-pin-in').click();     // в бюджете — кладёт проект в корзину
    await expect(page.locator("#pbMeter")).toContainText("1,8 млн");
    await expect(page.locator('.pb-3d .m3d-pin[data-id="b1"]')).toHaveClass(/on/);
    expect(errors).toEqual([]);
  });
});
