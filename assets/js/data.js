/* VoteConnect — демо для Махачкалы. Проекты, авторы идей, суммы и голоса вымышлены. */

window.VC_DATA = {
  scenario: "makhachkala",
  city: "Махачкала",
  region: "Республика Дагестан",
  budget: {
    total: 15000000,
    voters: 2318,
    stages: [
      { id: "ideas", name: "Сбор идей", from: "2026-08-01", to: "2026-08-24" },
      { id: "review", name: "Проверка смет", from: "2026-08-25", to: "2026-09-09" },
      { id: "vote", name: "Голосование", from: "2026-09-10", to: "2026-10-05" },
      { id: "build", name: "Реализация", from: "2027-03-01", to: "2027-10-31" }
    ],
    projects: [
      { id: "b1", title: "Светофор для пешеходов на проспекте Акушинского", cost: 1800000, votes: 1290, author: "Родительский комитет" },
      { id: "b2", title: "Вечерний автобус до посёлка Тарки", cost: 3400000, votes: 1180, author: "Жители посёлка Тарки" },
      { id: "b3", title: "Освещение дорожек у озера Ак-Гёль", cost: 4200000, votes: 1040, author: "Жители Редукторного посёлка" },
      { id: "b4", title: "Навесы на остановках проспекта Расула Гамзатова", cost: 2600000, votes: 960, author: "Пассажиры городских автобусов" },
      { id: "b6", title: "Кружки по робототехнике для школьников Махачкалы", cost: 2100000, votes: 880, author: "Родители школьников" },
      { id: "b7", title: "Ремонт дворов на проспекте Петра Первого", cost: 5600000, votes: 720, author: "Жители проспекта Петра Первого" },
      { id: "b5", title: "Площадка для выгула собак в Редукторном посёлке", cost: 900000, votes: 610, author: "Владельцы собак" },
      { id: "b8", title: "Велодорожка вдоль берега Каспия", cost: 6800000, votes: 540, author: "Группа велосипедистов" }
    ]
  }
};

// Даты демо сдвигаются относительно 18 сентября 2026 года из исходного сценария.
(function () {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = Math.max(0, today - Date.UTC(2026, 8, 18));
  const move = (iso) => new Date(Date.parse(iso + "T00:00:00Z") + shift).toISOString().slice(0, 10);

  for (const stage of window.VC_DATA.budget.stages) {
    stage.from = move(stage.from);
    stage.to = move(stage.to);
  }
})();
