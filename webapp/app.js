(function () {
  "use strict";

  const C = window.CONTENT;
  const tg = window.Telegram && window.Telegram.WebApp;
  const app = document.getElementById("app");
  const backBtn = document.getElementById("back");

  if (tg && tg.initData !== undefined) {
    tg.ready();
    tg.expand();
  }

  // ---------- Хранилище (только на устройстве пользователя) ----------
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem("at_" + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem("at_" + key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
    },
  };

  // ---------- Утилиты ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const haptic = (type) => { try { tg && tg.HapticFeedback.impactOccurred(type || "light"); } catch (e) { /* вне Telegram */ } };
  const go = (route) => { location.hash = route; };

  function openExternal(url) {
    if (tg && tg.openLink && tg.initData) return tg.openLink(url);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  }

  function hasCrisisWords(text) {
    const t = text.toLowerCase();
    return C.crisis.triggers.some((w) => t.includes(w));
  }

  // Таймеры текущего экрана останавливаются при переходе на другой.
  let timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; };

  function render(html) {
    app.innerHTML = html;
    window.scrollTo(0, 0);
    bindClicks();
  }

  function bindClicks() {
    app.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => { haptic(); go(el.dataset.go); }));
    app.querySelectorAll("[data-psy]").forEach((el) => el.addEventListener("click", () => openExternal(C.config.psychatUrl)));
  }

  const psychologistCard = () => `
    <button class="card" data-go="psychologist">
      <span class="title">Поговорить с психологом</span>
      <span class="sub">Первая встреча 20 минут бесплатно</span>
    </button>`;

  // ---------- Экраны ----------
  const views = {
    home() {
      const done = store.get("course_done", []);
      const tests = store.get("tests", []);
      const last = tests[tests.length - 1];
      render(`
        <h1>Как вы сейчас?</h1>
        <button class="card sos" data-go="sos">
          <span class="title">Мне тревожно прямо сейчас</span>
          <span class="sub">Помощь за 3 минуты</span>
        </button>
        <button class="card" data-go="course">
          <span class="title">Курс «14 дней спокойнее»</span>
          <span class="sub">${done.length ? `Пройдено дней: ${done.length} из ${C.course.length}` : "10 минут в день, техники КПТ"}</span>
        </button>
        <button class="card" data-go="test">
          <span class="title">Тест на тревожность</span>
          <span class="sub">${last ? `Последний результат: ${last.score} из 21` : "7 вопросов, 2 минуты"}</span>
        </button>
        <h2>Техники</h2>
        ${C.techniques.map((t) => `
          <button class="card" data-go="technique/${t.id}">
            <span class="title">${t.title}</span>
            <span class="sub">${t.short}</span>
          </button>`).join("")}
        <h2>Поддержка</h2>
        ${psychologistCard()}
        <p class="muted">${C.disclaimer}</p>
      `);
    },

    sos() {
      const statements = C.sos.statements;
      render(`
        <h1>${C.sos.title}</h1>
        <p>${C.sos.intro}</p>
        <div class="notice" id="statement">${statements[0]}</div>
        <h2>Шаг 1. Подышите вместе с кругом</h2>
        ${breathingWidget(C.breathing.find((b) => b.id === "panic"), 120)}
        <h2>Шаг 2. Вернитесь в «здесь и сейчас»</h2>
        <button class="btn secondary" data-go="grounding">Заземление 5-4-3-2-1</button>
        <h2>Стало легче?</h2>
        <div class="grid2">
          <button class="card" data-go="home"><span class="title">Да, спасибо</span></button>
          <button class="card" data-go="sos-worse"><span class="title">Нет, всё ещё плохо</span></button>
        </div>
      `);
      let i = 0;
      every(() => {
        i = (i + 1) % statements.length;
        const el = document.getElementById("statement");
        if (el) el.textContent = statements[i];
      }, 8000);
      startBreathing(C.breathing.find((b) => b.id === "panic"), 120);
    },

    "sos-worse"() {
      render(`
        <h1>Вы не одни с этим</h1>
        <p>Если тревога не отпускает или такие состояния повторяются, это важный сигнал, что с этим лучше работать вместе со специалистом.</p>
        <button class="btn" data-psy>${C.psychologist.button}</button>
        <button class="btn secondary" data-go="breathing">Ещё подышать</button>
        <div class="notice danger-box" style="margin-top:20px">
          Если есть мысли причинить себе вред — <a href="#crisis">откройте экран экстренной помощи</a>.
        </div>
      `);
    },

    technique(id) {
      const t = C.techniques.find((x) => x.id === id);
      if (!t) return go("home");
      render(`
        <h1>${t.title}</h1>
        <p>${t.body}</p>
        ${t.tool ? `<button class="btn" data-go="${t.tool}">Начать</button>` : ""}
        ${t.id === "steps" ? stepsForm() : ""}
      `);
      if (t.id === "steps") bindSteps();
    },

    breathing() {
      const current = store.get("breath_mode", "calm");
      const mode = C.breathing.find((b) => b.id === current) || C.breathing[0];
      render(`
        <h1>Дыхание</h1>
        <div class="chips">
          ${C.breathing.map((b) => `<button class="chip ${b.id === mode.id ? "selected" : ""}" data-mode="${b.id}">${b.name}</button>`).join("")}
        </div>
        <p class="muted">${mode.hint}</p>
        ${breathingWidget(mode, 180)}
      `);
      app.querySelectorAll("[data-mode]").forEach((el) => el.addEventListener("click", () => {
        store.set("breath_mode", el.dataset.mode);
        clearTimers();
        views.breathing();
      }));
      startBreathing(mode, 180);
    },

    grounding() {
      let step = 0;
      const steps = C.grounding;
      const draw = () => {
        if (step >= steps.length) {
          render(`
            <h1>Отлично</h1>
            <p>Вы вернули внимание в настоящий момент. Оцените, как вы сейчас.</p>
            <button class="btn" data-go="home">На главную</button>
            <button class="btn secondary" data-go="breathing">Подышать ещё</button>
          `);
          return;
        }
        const s = steps[step];
        render(`
          <div class="progress"><i style="width:${(step / steps.length) * 100}%"></i></div>
          <div class="big-number">${s.n}</div>
          <p style="text-align:center">${s.prompt}</p>
          <p class="muted" style="text-align:center">Назовите про себя или вслух, не торопитесь.</p>
          <button class="btn" id="next">Готово</button>
        `);
        document.getElementById("next").addEventListener("click", () => { haptic(); step++; draw(); });
      };
      draw();
    },

    pmr() {
      let i = 0;
      const groups = C.pmr;
      const run = () => {
        if (i >= groups.length) {
          render(`
            <h1>Готово</h1>
            <p>Побудьте ещё минуту в расслаблении. Заметьте, как ощущается тело сейчас по сравнению с началом.</p>
            <button class="btn" data-go="home">На главную</button>
          `);
          return;
        }
        const [name, action] = groups[i];
        render(`
          <div class="progress"><i style="width:${(i / groups.length) * 100}%"></i></div>
          <h1>${name}</h1>
          <p id="pmr-text">${action} и удерживайте напряжение…</p>
          <div class="big-number" id="pmr-count">5</div>
        `);
        countdown(5, "pmr-count", () => {
          haptic("medium");
          document.getElementById("pmr-text").textContent = "Резко отпустите. Почувствуйте, как уходит напряжение…";
          countdown(10, "pmr-count", () => { i++; run(); });
        });
      };
      render(`
        <h1>Мышечная релаксация</h1>
        <p>Сядьте или лягте удобно. Мы пройдём ${groups.length} групп мышц: напрягаем 5 секунд, расслабляем 10. Напрягайте мышцы не до боли.</p>
        <button class="btn" id="start">Начать</button>
      `);
      document.getElementById("start").addEventListener("click", run);
    },

    diary() {
      const entries = store.get("diary", []);
      render(`
        <h1>Дневник мыслей</h1>
        <form id="diary-form">
          <label>Ситуация. Что произошло?</label>
          <textarea name="situation" required></textarea>
          <label>Тревожная мысль. Что пронеслось в голове?</label>
          <textarea name="thought" required></textarea>
          <label>Насколько сильна тревога: <b id="lvl">5</b> из 10</label>
          <input type="range" name="level" min="0" max="10" value="5">
          <label>Взвешенная мысль. Как ещё можно на это посмотреть? Что бы вы сказали другу?</label>
          <textarea name="alternative"></textarea>
          <button class="btn" type="submit">Сохранить</button>
        </form>
        <button class="btn secondary" data-go="distortions">Подсказка: ловушки мышления</button>
        ${entries.length ? `<h2>Прошлые записи</h2>` : ""}
        ${entries.slice().reverse().map((e) => `
          <div class="card">
            <span class="sub">${new Date(e.date).toLocaleDateString("ru-RU")} · тревога ${e.level}/10</span>
            <span class="title">${esc(e.thought)}</span>
            ${e.alternative ? `<span class="sub">→ ${esc(e.alternative)}</span>` : ""}
          </div>`).join("")}
        <p class="muted">Записи хранятся только на вашем устройстве.</p>
      `);
      const form = document.getElementById("diary-form");
      form.level.addEventListener("input", () => { document.getElementById("lvl").textContent = form.level.value; });
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const entry = {
          date: Date.now(),
          situation: form.situation.value.trim(),
          thought: form.thought.value.trim(),
          level: Number(form.level.value),
          alternative: form.alternative.value.trim(),
        };
        entries.push(entry);
        store.set("diary", entries);
        haptic("medium");
        if (hasCrisisWords(entry.situation + " " + entry.thought + " " + entry.alternative)) return go("crisis");
        views.diary();
      });
    },

    distortions() {
      render(`
        <h1>Ловушки мышления</h1>
        <p>Тревожный мозг часто ошибается одинаково. Узнали свою мысль? Уже хорошо: значит, это не факт, а привычка ума.</p>
        ${C.distortions.map(([name, ex]) => `<div class="card"><span class="title">${name}</span><span class="sub">${ex}</span></div>`).join("")}
        <button class="btn" data-go="diary">К дневнику</button>
      `);
    },

    worry() {
      const list = store.get("worries", []);
      render(`
        <h1>Время для беспокойства</h1>
        <p class="muted">Запишите мысль и отложите её до своего времени.</p>
        <form id="worry-form">
          <input type="text" name="w" placeholder="Что тревожит?" required>
          <button class="btn" type="submit">Отложить на потом</button>
        </form>
        ${list.length ? `<h2>Отложенные мысли</h2>` + list.map((w) => `<div class="card">${esc(w)}</div>`).join("") : ""}
        <h2>Моё время</h2>
        <p class="muted">Когда наступит ваше время, включите таймер на 15 минут и перечитайте список.</p>
        <div class="big-number" id="worry-count">15:00</div>
        <button class="btn secondary" id="worry-start">Начать 15 минут</button>
        ${list.length ? `<button class="btn secondary" id="worry-clear">Время вышло, очистить список</button>` : ""}
      `);
      document.getElementById("worry-form").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const v = ev.target.w.value.trim();
        if (!v) return;
        list.push(v);
        store.set("worries", list);
        if (hasCrisisWords(v)) return go("crisis");
        views.worry();
      });
      document.getElementById("worry-start").addEventListener("click", () => countdown(15 * 60, "worry-count", () => haptic("heavy"), true));
      const clear = document.getElementById("worry-clear");
      if (clear) clear.addEventListener("click", () => { store.set("worries", []); views.worry(); });
    },

    steps() { go("technique/steps"); },

    test() {
      const answers = [];
      const ask = (i) => {
        if (i >= C.gad7.items.length) return finishTest(answers);
        render(`
          <div class="progress"><i style="width:${(i / C.gad7.items.length) * 100}%"></i></div>
          <p class="muted">${C.gad7.question}</p>
          <h1>${C.gad7.items[i]}</h1>
          ${C.gad7.options.map((o, v) => `<button class="option" data-v="${v}">${o}</button>`).join("")}
        `);
        app.querySelectorAll("[data-v]").forEach((el) => el.addEventListener("click", () => {
          haptic();
          el.classList.add("selected");
          answers[i] = Number(el.dataset.v);
          later(() => ask(i + 1), 180);
        }));
      };
      ask(0);
    },

    result() {
      const tests = store.get("tests", []);
      const last = tests[tests.length - 1];
      if (!last) return go("test");
      const level = C.gad7.levels.find((l) => last.score <= l.max);
      const prev = tests[tests.length - 2];
      render(`
        <h1>Ваш результат</h1>
        <div class="big-number">${last.score}<span class="muted" style="font-size:20px"> / 21</span></div>
        <h2 style="text-align:center;margin-top:0">${level.name}</h2>
        ${prev ? `<p class="muted" style="text-align:center">В прошлый раз: ${prev.score}</p>` : ""}
        <p>${level.text}</p>
        ${level.recommendPsychologist ? `
          <div class="notice">${C.psychologist.text}</div>
          <button class="btn" data-psy>${C.psychologist.button}</button>
          <button class="btn secondary" data-go="course">Начать курс самопомощи</button>
        ` : `
          <button class="btn" data-go="course">Начать курс «14 дней спокойнее»</button>
        `}
        <p class="muted" style="margin-top:16px">${C.gad7.note}</p>
      `);
    },

    course() {
      const done = store.get("course_done", []);
      const paidFrom = C.config.paidFromDay;
      render(`
        <h1>14 дней спокойнее</h1>
        <p class="muted">Каждый день — немного теории и одна практика. Новый день открывается, когда вы отметите предыдущий.</p>
        ${C.course.map((d, i) => {
          const n = i + 1;
          const isDone = done.includes(n);
          const open = n === 1 || done.includes(n - 1);
          const paid = paidFrom && n >= paidFrom;
          return `
            <button class="card day ${isDone ? "done" : ""} ${open ? "" : "locked"}" ${open ? `data-go="day/${n}"` : "disabled"}>
              <span class="num">${isDone ? "✓" : n}</span>
              <span><span class="title">${d.title}</span>${paid ? `<span class="sub">Платный день</span>` : ""}</span>
            </button>`;
        }).join("")}
        ${psychologistCard()}
      `);
    },

    day(nStr) {
      const n = Number(nStr);
      const d = C.course[n - 1];
      if (!d) return go("course");
      const done = store.get("course_done", []);
      render(`
        <p class="muted">День ${n} из ${C.course.length}</p>
        <h1>${d.title}</h1>
        <p>${d.text}</p>
        <h2>Практика</h2>
        <div class="notice">${d.practice}</div>
        ${d.tool ? `<button class="btn secondary" data-go="${d.tool}">Открыть упражнение</button>` : ""}
        ${done.includes(n)
          ? `<button class="btn secondary" data-go="course">День пройден ✓</button>`
          : `<button class="btn" id="done">Отметить день пройденным</button>`}
        ${n === 3 || n === 7 || n === 14 ? `
          <h2>Хотите разобрать это со специалистом?</h2>
          <p class="muted">Курс даёт инструменты, а психолог помогает понять, почему тревога появляется именно у вас.</p>
          <button class="btn secondary" data-psy>${C.psychologist.button}</button>` : ""}
      `);
      const btn = document.getElementById("done");
      if (btn) btn.addEventListener("click", () => {
        if (!done.includes(n)) done.push(n);
        store.set("course_done", done);
        haptic("medium");
        go("course");
      });
    },

    psychologist() {
      render(`
        <h1>${C.psychologist.title}</h1>
        <p>${C.psychologist.text}</p>
        <button class="btn" data-psy>${C.psychologist.button}</button>
        <p class="muted" style="margin-top:16px">Откроется сайт ПсиЧата. Ответы теста и записи дневника никуда не передаются.</p>
      `);
    },

    crisis() {
      render(`
        <h1>${C.crisis.title}</h1>
        <p>${C.crisis.text}</p>
        ${C.crisis.contacts.map((c) => `
          <div class="card contact">
            <span><span class="title">${c.name}</span><span class="sub">${c.note}</span></span>
            <a href="tel:${c.phone.replace(/[^\d+]/g, "")}">${c.phone}</a>
          </div>`).join("")}
        <h2>Пока вы ждёте ответа</h2>
        <p>Если можете, побудьте рядом с другим человеком или напишите тому, кому доверяете. Уберите от себя то, чем можно причинить вред.</p>
        <button class="btn secondary" data-psy>Связаться с психологом ПсиЧата</button>
      `);
    },
  };

  // ---------- Виджеты ----------
  function breathingWidget(mode, seconds) {
    return `
      <div class="breath-wrap"><div class="breath" id="breath">Готовы?</div></div>
      <p class="muted" style="text-align:center" id="breath-left">${Math.round(seconds / 60)} мин</p>`;
  }

  function startBreathing(mode, seconds) {
    const circle = document.getElementById("breath");
    const leftEl = document.getElementById("breath-left");
    let phase = 0;
    let left = seconds;
    const step = () => {
      if (!document.body.contains(circle)) return;
      const [name, dur] = mode.phases[phase % mode.phases.length];
      circle.textContent = name;
      circle.style.transitionDuration = dur + "s";
      if (name === "Вдох") circle.style.transform = "scale(1.9)";
      if (name === "Выдох") circle.style.transform = "scale(1)";
      phase++;
      later(step, dur * 1000);
    };
    later(step, 800);
    every(() => {
      left--;
      if (left <= 0) {
        leftEl.textContent = "Хорошо. Можно продолжать, сколько нужно.";
        return;
      }
      leftEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    }, 1000);
  }

  function countdown(sec, elId, done, asClock) {
    let left = sec;
    const el = document.getElementById(elId);
    const fmt = (s) => (asClock ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : String(s));
    el.textContent = fmt(left);
    const id = every(() => {
      left--;
      if (el) el.textContent = fmt(Math.max(left, 0));
      if (left <= 0) {
        clearInterval(id);
        done();
      }
    }, 1000);
  }

  function stepsForm() {
    const steps = store.get("ladder", []);
    return `
      <h2>Моя лестница</h2>
      <form id="steps-form">
        <input type="text" name="s" placeholder="Следующий шаг, от лёгкого к трудному" required>
        <button class="btn secondary" type="submit">Добавить шаг</button>
      </form>
      ${steps.map((s, i) => `
        <button class="card day ${s.done ? "done" : ""}" data-step="${i}">
          <span class="num">${s.done ? "✓" : i + 1}</span><span>${esc(s.text)}</span>
        </button>`).join("")}`;
  }

  function bindSteps() {
    const steps = store.get("ladder", []);
    document.getElementById("steps-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = ev.target.s.value.trim();
      if (!v) return;
      steps.push({ text: v, done: false });
      store.set("ladder", steps);
      views.technique("steps");
    });
    app.querySelectorAll("[data-step]").forEach((el) => el.addEventListener("click", () => {
      const s = steps[Number(el.dataset.step)];
      s.done = !s.done;
      store.set("ladder", steps);
      haptic("medium");
      views.technique("steps");
    }));
  }

  function finishTest(answers) {
    const score = answers.reduce((a, b) => a + b, 0);
    const tests = store.get("tests", []);
    tests.push({ date: Date.now(), score });
    store.set("tests", tests);
    go("result");
  }

  // ---------- Маршрутизация ----------
  function route() {
    clearTimers();
    const [name, arg] = (location.hash.slice(1) || "home").split("/");
    const view = views[name] || views.home;
    const isHome = view === views.home;
    backBtn.hidden = isHome;
    if (tg && tg.BackButton) isHome ? tg.BackButton.hide() : tg.BackButton.show();
    view(arg);
  }

  const goBack = () => (history.length > 1 ? history.back() : go("home"));
  backBtn.addEventListener("click", goBack);
  if (tg && tg.BackButton) tg.BackButton.onClick(goBack);
  document.getElementById("crisis-btn").addEventListener("click", () => go("crisis"));
  window.addEventListener("hashchange", route);
  route();
})();
