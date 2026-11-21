/* VoteConnect — демо-данные. Город и жители вымышлены. */

window.VC_DATA = {
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
      { id: "b1", title: "Светофор с кнопкой у школы № 12", cost: 1800000, votes: 1290, author: "Родительский комитет" },
      { id: "b2", title: "Вечерний автобус 14 до 23:30 на год", cost: 3400000, votes: 1180, author: "Павел Р." },
      { id: "b3", title: "Освещение набережной реки Светлой", cost: 4200000, votes: 1040, author: "Группа «Чистая Светлая»" },
      { id: "b4", title: "Навесы и табло на 12 остановках", cost: 2600000, votes: 960, author: "Группа «Удобный транспорт»" },
      { id: "b6", title: "Бесплатные кружки робототехники в школе № 5", cost: 2100000, votes: 880, author: "Группа «Родители и школа»" },
      { id: "b7", title: "Ремонт двора на Садовой, 14–18", cost: 5600000, votes: 720, author: "Жители Садовой" },
      { id: "b5", title: "Площадка для выгула собак в сквере Юности", cost: 900000, votes: 610, author: "Ирина Л." },
      { id: "b8", title: "Велодорожка вдоль Ленинградской", cost: 6800000, votes: 540, author: "Группа «Удобный транспорт»" }
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
