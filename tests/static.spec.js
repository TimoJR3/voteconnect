// Статические проверки кода и репозитория (без браузера). Описание кейсов — docs/SECURITY_TESTS.md.
const { test, expect } = require("@playwright/test");
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PAGES = ["index.html", "app.html", "investors.html"];
const OWN_JS = ["assets/js/app.js", "assets/js/data.js", "assets/js/icons.js", "assets/js/sanitize.js", "assets/js/landing.js", "sw.js"];

function repoFiles(dir = ROOT, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if ([".git", "node_modules", "test-results", "playwright-report", ".claude"].includes(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) repoFiles(p, out);
    else if (/\.(js|jsx|html|css|md|json|yml|yaml|txt|webmanifest)$/.test(name)) out.push(p);
  }
  return out;
}

test("SEC-21 Нет встроенных скриптов и обработчиков событий в HTML и шаблонах", () => {
  for (const f of PAGES) {
    const html = read(f);
    expect(html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi), `${f}: встроенный <script>`).toBeNull();
    expect(html.match(/\son[a-z]+\s*=/gi), `${f}: обработчик on*=`).toBeNull();
  }
  for (const f of OWN_JS) {
    expect(read(f).match(/\son(error|load|click|mouse\w+|focus|input)\s*=\s*["']/gi), `${f}: обработчик в шаблоне`).toBeNull();
  }
});

test("SEC-22 Страницы не подключают ресурсы со сторонних серверов", () => {
  for (const f of [...PAGES, "assets/css/style.css", "assets/css/fonts.css", ...OWN_JS]) {
    const src = read(f);
    const refs = [
      ...src.matchAll(/<(?:script|img|iframe|source|video|audio)[^>]+src=["'](https?:)?\/\/[^"']+/gi),
      ...src.matchAll(/<link[^>]+href=["'](https?:)?\/\/[^"']+/gi),
      ...src.matchAll(/url\(\s*["']?(https?:)?\/\/[^)]+\)/gi),
      ...src.matchAll(/\.src\s*=\s*["'`]https?:\/\/[^"'`]+/gi)
    ].map((m) => m[0]).filter((r) => !/<link[^>]+rel=["'](canonical)["']/.test(r));
    expect(refs, f).toEqual([]);
  }
});

test("SEC-23 Код приложения не отправляет данные по сети", () => {
  for (const f of OWN_JS.filter((x) => x !== "sw.js")) {
    expect(read(f).match(/\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource|navigator\.share/g), f).toBeNull();
  }
});

test("SEC-24 Service worker кэширует только свои GET-запросы", () => {
  const sw = read("sw.js");
  expect(sw).toMatch(/request\.method\s*!==\s*"GET"\)\s*return/);
  expect(sw).toMatch(/startsWith\(self\.location\.origin\)/);
});

test("SEC-25 В репозитории нет ключей, токенов и паролей", () => {
  const patterns = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /sk-[A-Za-z0-9]{20,}/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /(api[_-]?key|secret|password)\s*[:=]\s*["'][^"']{8,}["']/i];
  const hits = [];
  for (const f of repoFiles()) {
    if (f.endsWith("package-lock.json") || f.endsWith(".bundle.js") || f.endsWith(".min.js")) continue;
    const text = fs.readFileSync(f, "utf8");
    for (const p of patterns) if (p.test(text)) hits.push(`${path.relative(ROOT, f)}: ${p}`);
  }
  expect(hits).toEqual([]);
});

test("SEC-26 Личные данные в демо вымышлены и помечены", () => {
  const data = read("assets/js/data.js");
  expect(data).toMatch(/вымышлены/);
  expect(data).not.toMatch(/\+7\s?\d{3}\s?\d{3}-?\d{2}-?\d{2}/);   // нет реальных телефонов
  expect(data).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);         // нет email-адресов
});
