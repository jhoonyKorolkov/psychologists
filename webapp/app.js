(function () {
  "use strict";

  const C = window.CONTENT;
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData);
  const gsap = window.gsap;
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const app = document.getElementById("app");
  const backBtn = document.getElementById("back");
  const tabbar = document.getElementById("tabbar");

  // ---------- Telegram ----------
  if (inTelegram) {
    tg.ready();
    tg.expand();
    if (tg.colorScheme) document.documentElement.dataset.theme = tg.colorScheme;
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      tg.setHeaderColor(bg);
      tg.setBackgroundColor(bg);
    } catch (e) { /* старые клиенты */ }
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

  const today = () => new Date().toISOString().slice(0, 10);
  function logPractice(type) {
    const log = store.get("log", []);
    log.push({ d: today(), t: type });
    store.set("log", log);
  }
  function streak() {
    const days = new Set(store.get("log", []).map((e) => e.d).concat(store.get("moods", []).map((m) => m.d)));
    let n = 0;
    const d = new Date();
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------- Утилиты ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const haptic = (type) => { try { inTelegram && tg.HapticFeedback.impactOccurred(type || "light"); } catch (e) { /* вне Telegram */ } };
  const hapticOk = () => { try { inTelegram && tg.HapticFeedback.notificationOccurred("success"); } catch (e) { /* вне Telegram */ } };
  const go = (route) => { location.hash = route; };
  const cap = (str) => str.charAt(0).toUpperCase() + str.slice(1);
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  function openExternal(url) {
    if (inTelegram && tg.openLink) return tg.openLink(url);
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

  // Отметка выполненного: большая галочка поднимается и встаёт на место, телефон отвечает вибрацией.
  function celebrate() {
    hapticOk();
    const mark = app.querySelector(".step-num");
    if (!gsap || reduceMotion || !mark) return;
    gsap.fromTo(mark, { scale: 0.3, rotate: -20, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.8, ease: "back.out(2.4)" });
  }

  // Таймеры текущего экрана останавливаются при переходе на другой.
  let timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; };

  function animateIn(root) {
    if (!gsap || reduceMotion) return;
    gsap.from(root.children, { y: 18, opacity: 0, duration: 0.5, stagger: 0.045, ease: "power3.out", clearProps: "transform,opacity" });
  }

  function countUp(el, to, suffix) {
    if (!el) return;
    if (!gsap || reduceMotion) { el.textContent = to + (suffix || ""); return; }
    const obj = { v: 0 };
    gsap.to(obj, { v: to, duration: 1, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(obj.v) + (suffix || ""); } });
  }

  function render(html, opts) {
    app.innerHTML = html;
    window.scrollTo(0, 0);
    bindClicks();
    if (!opts || opts.animate !== false) animateIn(app);
  }

  function bindClicks() {
    app.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => { haptic(); go(el.dataset.go); }));
    app.querySelectorAll("[data-psy]").forEach((el) => el.addEventListener("click", () => { haptic("medium"); openExternal(C.config.psychatUrl); }));
  }

  // ---------- Иконки (stroke, 24×24) ----------
  const ICONS = {
    breathing: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h6"/>',
    grounding: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pmr: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    diary: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>',
    worry: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/>',
    steps: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
    distortions: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"/>',
    test: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9z"/><path d="M9 13l2 2 4-4"/>',
    today: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    practices: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    course: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
    progress: '<path d="M3 20h18"/><path d="M6 16v-5"/><path d="M11 16V6"/><path d="M16 16v-8"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    swap: '<path d="M7 7h12l-3-3"/><path d="M17 17H5l3 3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-4-3-6-4-9.5-1.5 2-2 3.5-2 5-1.5-1-2.5-3-2.5-5C7 8 5 11.5 5 15.5 5 19.3 8 22 12 22z"/>',
  };
  const icon = (name, size) =>
    `<svg width="${size || 22}" height="${size || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  backBtn.innerHTML = icon("back", 20);

  // ---------- Настроение ----------
  const MOODS = [
    { name: "Ужасно", color: "#e99a86", mouth: -5 },
    { name: "Плохо", color: "#f2bf95", mouth: -2.5 },
    { name: "Так себе", color: "#ecd9a2", mouth: 0 },
    { name: "Хорошо", color: "#b5dcc6", mouth: 3 },
    { name: "Отлично", color: "#86cdb5", mouth: 5.5 },
  ];
  function moodFace(i) {
    const m = MOODS[i];
    const y = m.mouth < 0 ? 26 : 24;
    return `<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <circle cx="20" cy="20" r="17"/>
      <path d="M14 15.5v1.5M26 15.5v1.5"/>
      <path d="M13 ${y} Q20 ${y + m.mouth} 27 ${y}"/>
    </svg>`;
  }
  const MOOD_REPLIES = [
    ["Сочувствуем. Давайте попробуем снизить напряжение прямо сейчас — 3 минуты дыхания правда помогают.", "sos", "Помочь сейчас"],
    ["Бывают такие дни. Небольшая практика поможет телу немного отпустить.", "breathing", "Подышать 3 минуты"],
    ["Хороший момент позаботиться о себе, пока тревога не выросла.", "course", "К курсу"],
    ["Здорово! Закрепим: пара минут практики сегодня сделает навык крепче.", "practices", "Выбрать практику"],
    ["Отлично! Запомните это состояние — к нему можно возвращаться.", "progress", "Мой прогресс"],
  ];

  // ---------- Общие блоки ----------
  function ringSvg(value, total, cls) {
    const r = 26, c = 2 * Math.PI * r;
    const off = c * (1 - (total ? value / total : 0));
    return `<div class="ring ${cls || ""}">
      <svg viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="${r}" fill="none" stroke-width="6"/>
      <circle class="bar" cx="32" cy="32" r="${r}" fill="none" stroke-width="6" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}"/></svg>
      <span class="label">${value}/${total}</span></div>`;
  }
  function fillRings() {
    // Сначала кольцо рисуется пустым, затем заполняется — так видна анимация.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      app.querySelectorAll(".ring .bar").forEach((b) => { b.style.strokeDashoffset = b.dataset.off; });
    }));
  }

  // Короткая ссылка в ПсиЧат для мест, где большая карточка была бы лишней.
  const psyLink = (text) => `<button class="psy-link" data-psy>${icon("chat", 18)} ${text || "Разобрать это с психологом"}</button>`;

  const psychologistCard = () => `
    <button class="card warm" data-go="psychologist">
      <div class="row">
        <span class="ico">${icon("chat", 26)}</span>
        <span class="grow"><span class="title">Поговорить с психологом</span><span class="sub">Первая встреча 20 минут бесплатно</span></span>
        <span class="chev">${icon("next", 18)}</span>
      </div>
    </button>`;

  const practiceItem = (t, route) => `
    <button class="item" data-go="${route || (t.tool && t.id !== "steps" ? t.tool : "technique/" + t.id)}">
      <span class="ico">${icon(t.id, 24)}</span>
      <span class="grow"><span class="title">${t.title}</span><span class="sub">${t.short}</span></span>
      <span class="meta">${t.duration}</span>
    </button>`;

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  }

  function courseState() {
    const done = store.get("course_done", []);
    let next = 1;
    while (done.includes(next) && next <= C.course.length) next++;
    return { done, next: Math.min(next, C.course.length), finished: done.length >= C.course.length };
  }

  // ---------- Экраны ----------
  const views = {
    today() {
      const cs = courseState();
      const tests = store.get("tests", []);
      const last = tests[tests.length - 1];
      const moods = store.get("moods", []);
      const todayMood = moods.find((m) => m.d === today());
      const dayTitle = C.course[cs.next - 1].title;
      render(`
        <div>
          <h1>${greeting()}</h1>
          <p class="muted" style="margin-top:8px">${cap(new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }))}</p>
        </div>

        <div class="card">
          <span class="title">Как вы сейчас?</span>
          <div class="moods">
            ${MOODS.map((m, i) => `<button class="mood ${todayMood && todayMood.v === i ? "selected" : ""}" data-mood="${i}" aria-label="${m.name}">${moodFace(i)}${m.name}</button>`).join("")}
          </div>
          <div id="mood-reply">${todayMood ? moodReply(todayMood.v) : ""}</div>
        </div>

        <button class="hero" data-go="sos">
          <span class="rings" aria-hidden="true"><i class="r1"></i><i class="r2"></i><i class="r3"></i></span>
          <span class="hero-title">Тревожно сейчас?</span>
          <span class="hero-sub">Дыхание и заземление помогут за 3 минуты.</span>
          <span class="go">${icon("play", 14)} Начать</span>
        </button>

        ${psychologistCard()}

        <button class="card" data-go="${cs.finished ? "course" : "day/" + cs.next}">
          <div class="row">
            ${ringSvg(cs.done.length, C.course.length)}
            <span class="grow">
              <span class="title">${cs.finished ? "Курс пройден" : dayTitle}</span>
              <span class="sub">${cs.finished ? "14 дней спокойнее" : `Курс, день ${cs.next} из ${C.course.length}`}</span>
            </span>
            <span class="chev">${icon("next", 18)}</span>
          </div>
        </button>

        <h2>Быстрые практики</h2>
        <div class="list">${C.techniques.slice(0, 4).map((t) => practiceItem(t)).join("")}</div>

        <button class="card" data-go="test">
          <div class="row">
            <span class="ico">${icon("test", 26)}</span>
            <span class="grow"><span class="title">Тест на тревожность</span>
            <span class="sub">${last ? `Последний результат: ${last.score} из 21` : "7 вопросов · 2 минуты"}</span></span>
            <span class="chev">${icon("next", 18)}</span>
          </div>
        </button>

        <div class="card">
          <span class="title">Тревога возвращается снова и снова?</span>
          <p class="sub" style="margin-top:6px">Самопомощь снимает остроту, а психолог помогает понять причину. В ПсиЧате первая встреча 20 минут бесплатно и анонимно.</p>
          <button class="btn" style="margin-top:14px" data-psy>${C.psychologist.button}</button>
        </div>
        <p class="muted">${C.disclaimer}</p>
      `);
      fillRings();
      app.querySelectorAll("[data-mood]").forEach((el) => el.addEventListener("click", () => {
        const v = Number(el.dataset.mood);
        const list = store.get("moods", []).filter((m) => m.d !== today());
        list.push({ d: today(), v });
        store.set("moods", list);
        haptic("medium");
        app.querySelectorAll("[data-mood]").forEach((b) => b.classList.toggle("selected", b === el));
        if (gsap && !reduceMotion) gsap.fromTo(el.querySelector("svg"), { scale: 0.6, rotate: -15 }, { scale: 1, rotate: 0, duration: 0.6, ease: "back.out(3)" });
        const box = document.getElementById("mood-reply");
        box.innerHTML = moodReply(v);
        box.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
        box.querySelectorAll("[data-psy]").forEach((b) => b.addEventListener("click", () => openExternal(C.config.psychatUrl)));
        if (gsap && !reduceMotion) gsap.from(box.children, { y: 8, opacity: 0, duration: 0.4 });
      }));
    },

    practices() {
      render(`
        <h1>Практики</h1>
        <p class="lead">Короткие упражнения из когнитивно-поведенческой терапии. Лучше всего работают, если делать их каждый день, а не только в трудный момент.</p>
        <h2>Упражнения</h2>
        <div class="list">${C.techniques.map((t) => practiceItem(t, "technique/" + t.id)).join("")}</div>
        <h2>Справочник и тест</h2>
        <div class="list">
          ${practiceItem({ id: "distortions", title: "Ловушки мышления", short: "Как тревожный ум ошибается", duration: "" }, "distortions")}
          ${practiceItem({ id: "test", title: "Тест на тревожность", short: "GAD-7, 7 вопросов", duration: "2 мин" }, "test")}
        </div>
        ${psychologistCard()}
      `);
    },

    course() {
      const cs = courseState();
      const paidFrom = C.config.paidFromDay;
      render(`
        <h1>14 дней спокойнее</h1>
        <div class="card">
          <div class="row">
            ${ringSvg(cs.done.length, C.course.length, "big")}
            <span class="grow">
              <span class="title">${cs.finished ? "Курс пройден" : cs.done.length ? "Вы на пути" : "Начнём?"}</span>
              <span class="sub">Каждый день — немного теории и одна практика, около 10 минут.</span>
            </span>
          </div>
          ${cs.finished ? "" : `<button class="btn" data-go="day/${cs.next}">${cs.done.length ? "Продолжить: день " + cs.next : "Начать первый день"}</button>`}
        </div>
        <div class="path">
          ${C.course.map((d, i) => {
            const n = i + 1;
            const isDone = cs.done.includes(n);
            const isCurrent = !isDone && n === cs.next;
            const open = isDone || isCurrent;
            const paid = paidFrom && n >= paidFrom;
            return `
              <button class="card node ${isDone ? "done" : ""} ${isCurrent ? "current" : ""} ${open ? "" : "locked"}" ${open ? `data-go="day/${n}"` : "disabled"}>
                <span class="num">${isDone ? "✓" : n}</span>
                <span class="grow"><span class="title">${d.title}</span>${paid ? `<span class="sub">Платный день</span>` : `<span class="sub">День ${n}</span>`}</span>
              </button>`;
          }).join("")}
        </div>
        ${psychologistCard()}
      `);
      fillRings();
    },

    progress() {
      const log = store.get("log", []);
      const moods = store.get("moods", []).slice(-14);
      const tests = store.get("tests", []).slice(-8);
      const cs = courseState();
      render(`
        <h1>Мой прогресс</h1>
        <div class="stats">
          <div class="card stat field"><b id="st-streak">0</b><span>${plural(streak(), "день", "дня", "дней")} подряд</span></div>
          <div class="card stat"><b id="st-prac">0</b><span>практик</span></div>
          <div class="card stat"><b id="st-course">0</b><span>дней курса</span></div>
        </div>
        <h2>Настроение</h2>
        <div class="card">${moods.length >= 2 ? moodChart(moods) : `<p class="muted">Отмечайте настроение на главном экране — здесь появится график за 2 недели.</p>`}</div>
        <h2>Уровень тревоги (GAD-7)</h2>
        <div class="card">${tests.length ? testChart(tests) : `<p class="muted">Пройдите тест, чтобы видеть, как меняется тревога. Повторяйте раз в 2 недели.</p>`}
          <button class="btn secondary" style="margin-top:16px" data-go="test">${tests.length ? "Пройти ещё раз" : "Пройти тест"}</button>
        </div>
        ${psychologistCard()}
        <p class="muted">Все данные хранятся только на вашем телефоне.</p>
      `);
      countUp(document.getElementById("st-streak"), streak());
      countUp(document.getElementById("st-prac"), log.length);
      countUp(document.getElementById("st-course"), cs.done.length);
      if (gsap && !reduceMotion) {
        const line = app.querySelector(".chart .line");
        if (line) {
          const len = line.getTotalLength();
          gsap.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, ease: "power2.out" });
        }
        gsap.from(app.querySelectorAll(".chart .bar"), { scaleY: 0, transformOrigin: "50% 100%", duration: 0.7, stagger: 0.06, ease: "back.out(1.6)" });
      }
    },

    sos() {
      const mode = C.breathing.find((b) => b.id === "panic");
      const statements = C.sos.statements;
      render(`
        <h1>${C.sos.title}</h1>
        <p>${C.sos.intro}</p>
        <div class="notice" id="statement">${statements[0]}</div>
        <h2>Шаг 1. Дышите вместе со сферой</h2>
        ${orbWidget()}
        <h2>Шаг 2. Вернитесь в «здесь и сейчас»</h2>
        <button class="card" data-go="grounding"><div class="row"><span class="ico">${icon("grounding", 26)}</span><span class="grow"><span class="title">Заземление 5-4-3-2-1</span><span class="sub">2 минуты</span></span><span class="chev">${icon("next", 18)}</span></div></button>
        <h2>Стало легче?</h2>
        <div class="pair">
          <button class="btn" data-go="sos-better">Да, спасибо</button>
          <button class="btn secondary" data-go="sos-worse">Всё ещё плохо</button>
        </div>
      `);
      let i = 0;
      every(() => {
        i = (i + 1) % statements.length;
        const el = document.getElementById("statement");
        if (!el) return;
        if (gsap && !reduceMotion) {
          gsap.to(el, { opacity: 0, y: -6, duration: 0.3, onComplete: () => { el.textContent = statements[i]; gsap.fromTo(el, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4 }); } });
        } else el.textContent = statements[i];
      }, 8000);
      startBreathing(mode, 120);
    },

    "sos-better"() {
      logPractice("sos");
      render(`
        <div class="step-num">✓</div>
        <h1 class="center">Вы справились</h1>
        <p class="center muted">Вы только что сами помогли себе выйти из тревоги. Чем чаще тренировать эти навыки в спокойном состоянии, тем быстрее они срабатывают в трудный момент.</p>
        <button class="btn" data-go="course">Тренироваться в курсе</button>
        <button class="btn secondary" data-go="today">На главную</button>
        ${psyLink()}
      `);
      celebrate();
    },

    "sos-worse"() {
      render(`
        <h1>Вы не одни с этим</h1>
        <p>Если тревога не отпускает или такие состояния повторяются, это важный сигнал: с этим лучше работать вместе со специалистом.</p>
        ${psychologistCard()}
        <button class="btn secondary" data-go="breathing">Ещё подышать</button>
        <div class="notice danger">Если есть мысли причинить себе вред — <a href="#crisis" style="color:inherit;font-weight:800">откройте экран экстренной помощи</a>.</div>
      `);
    },

    technique(id) {
      const t = C.techniques.find((x) => x.id === id);
      if (!t) return go("today");
      render(`
        <div><h1>${t.title}</h1><p class="muted" style="margin-top:8px">${t.duration}, ${t.short.toLowerCase()}</p></div>
        <p class="lead">${t.body}</p>
        ${t.tool && t.id !== "steps" ? `<button class="btn" data-go="${t.tool}">${icon("play", 16)} Начать</button>` : ""}
        ${t.id === "steps" ? stepsForm() : ""}
        ${psychologistCard()}
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
        ${orbWidget()}
      `);
      app.querySelectorAll("[data-mode]").forEach((el) => el.addEventListener("click", () => {
        store.set("breath_mode", el.dataset.mode);
        haptic();
        clearTimers();
        views.breathing();
      }));
      startBreathing(mode, 180, () => logPractice("breathing"));
    },

    grounding() {
      let step = 0;
      const steps = C.grounding;
      const draw = () => {
        if (step >= steps.length) {
          logPractice("grounding");
          render(`
            <div class="step-num">✓</div>
            <h1 class="center">Вы здесь и сейчас</h1>
            <p class="center muted">Внимание вернулось в настоящий момент. Прислушайтесь: как вы себя чувствуете?</p>
            <button class="btn" data-go="today">На главную</button>
            <button class="btn secondary" data-go="breathing">Подышать ещё</button>
            ${psyLink()}
          `);
          return celebrate();
        }
        const s = steps[step];
        render(`
          <div class="dots">${steps.map((_, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>
          <div class="step-num" id="gnum">${s.n}</div>
          <h1 class="center">${s.sense[0].toUpperCase() + s.sense.slice(1)}</h1>
          <p class="center lead">${s.prompt}</p>
          <p class="muted center">Назовите про себя или вслух, не торопитесь.</p>
          <button class="btn" id="next">Готово</button>
        `);
        if (gsap && !reduceMotion) gsap.from("#gnum", { scale: 0.4, opacity: 0, duration: 0.6, ease: "back.out(2.2)" });
        document.getElementById("next").addEventListener("click", () => { haptic("medium"); step++; draw(); });
      };
      draw();
    },

    pmr() {
      let i = 0;
      const groups = C.pmr;
      const run = () => {
        if (i >= groups.length) {
          logPractice("pmr");
          render(`
            <div class="step-num">✓</div>
            <h1 class="center">Тело отпустило</h1>
            <p class="center muted">Побудьте ещё минуту в расслаблении. Заметьте, как ощущается тело сейчас по сравнению с началом.</p>
            <button class="btn" data-go="today">На главную</button>
            ${psyLink()}
          `);
          return celebrate();
        }
        const [name, action] = groups[i];
        render(`
          <div class="dots">${groups.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
          <h1 class="center">${name}</h1>
          <p class="center lead" id="pmr-text">${action} и удерживайте напряжение…</p>
          <div class="count" id="pmr-count">5</div>
        `);
        countdown(5, "pmr-count", () => {
          haptic("heavy");
          const t = document.getElementById("pmr-text");
          t.textContent = "Резко отпустите. Почувствуйте, как уходит напряжение…";
          if (gsap && !reduceMotion) gsap.from(t, { opacity: 0, duration: 0.5 });
          countdown(10, "pmr-count", () => { i++; run(); });
        });
      };
      render(`
        <h1>Мышечная релаксация</h1>
        <p class="lead">Сядьте или лягте удобно. Мы пройдём ${groups.length} групп мышц: напрягаем 5 секунд, расслабляем 10. Напрягайте мышцы не до боли.</p>
        <button class="btn" id="start">${icon("play", 16)} Начать</button>
      `);
      document.getElementById("start").addEventListener("click", run);
    },

    diary() {
      const entries = store.get("diary", []);
      render(`
        <h1>Дневник мыслей</h1>
        <form id="diary-form">
          <label for="d-situation">Ситуация. Что произошло?</label>
          <textarea id="d-situation" name="situation" placeholder="Например: начальник попросил зайти после обеда" required></textarea>
          <label for="d-thought">Тревожная мысль. Что пронеслось в голове?</label>
          <textarea id="d-thought" name="thought" placeholder="Например: меня уволят" required></textarea>
          <label for="d-level">Насколько сильна тревога: <span id="lvl">5</span> из 10</label>
          <input id="d-level" type="range" name="level" min="0" max="10" value="5">
          <label for="d-alt">Взвешенная мысль. Как ещё можно на это посмотреть?</label>
          <textarea id="d-alt" name="alternative" placeholder="Что бы вы сказали другу с такой мыслью?"></textarea>
          <button class="btn" type="submit">Сохранить запись</button>
        </form>
        <button class="btn secondary" data-go="distortions">${icon("distortions", 18)} Подсказка: ловушки мышления</button>
        ${entries.length ? `<h2>Прошлые записи</h2>` : ""}
        ${entries.slice().reverse().map((e) => `
          <div class="card entry">
            <span class="title">${esc(e.thought)}</span>
            ${e.alternative ? `<span class="sub">${esc(e.alternative)}</span>` : ""}
            <span class="sub">${new Date(e.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}, тревога ${e.level} из 10</span>
          </div>`).join("")}
        ${psychologistCard()}
        <p class="muted">Записи хранятся только на вашем устройстве.</p>
      `);
      const form = document.getElementById("diary-form");
      form.level.addEventListener("input", () => { document.getElementById("lvl").textContent = form.level.value; haptic(); });
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
        logPractice("diary");
        if (hasCrisisWords(entry.situation + " " + entry.thought + " " + entry.alternative)) return go("crisis");
        hapticOk();
        views.diary();
      });
    },

    distortions() {
      render(`
        <h1>Ловушки мышления</h1>
        <p class="lead">Тревожный мозг часто ошибается одинаково. Узнали свою мысль? Это хорошо: значит, это не факт, а привычка ума.</p>
        ${C.distortions.map(([name, ex]) => `<div class="card"><span class="title">${name}</span><span class="sub">${ex}</span></div>`).join("")}
        <button class="btn" data-go="diary">К дневнику</button>
        ${psyLink()}
      `);
    },

    worry() {
      const list = store.get("worries", []);
      render(`
        <h1>Время для беспокойства</h1>
        <p class="muted">Запишите мысль и отложите её до своего времени.</p>
        <form id="worry-form">
          <input id="w-text" type="text" name="w" placeholder="Что тревожит?" required>
          <button class="btn" type="submit">Отложить на потом</button>
        </form>
        ${list.length ? `<h2>Отложенные мысли</h2>` + list.map((w) => `<div class="card">${esc(w)}</div>`).join("") : ""}
        <h2>Моё время</h2>
        <div class="card">
          <p class="muted">Когда наступит ваше время, включите таймер и перечитайте список. Часть мыслей уже потеряет силу.</p>
          <div class="count" id="worry-count">15:00</div>
          <button class="btn secondary" id="worry-start">${icon("clock", 18)} Начать 15 минут</button>
          ${list.length ? `<button class="btn secondary" id="worry-clear">Время вышло, очистить список</button>` : ""}
        </div>
        ${psychologistCard()}
      `);
      document.getElementById("worry-form").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const v = ev.target.w.value.trim();
        if (!v) return;
        list.push(v);
        store.set("worries", list);
        if (hasCrisisWords(v)) return go("crisis");
        haptic("medium");
        views.worry();
      });
      document.getElementById("worry-start").addEventListener("click", () => {
        logPractice("worry");
        countdown(15 * 60, "worry-count", () => hapticOk(), true);
      });
      const clear = document.getElementById("worry-clear");
      if (clear) clear.addEventListener("click", () => { store.set("worries", []); views.worry(); });
    },

    steps() { go("technique/steps"); },

    test() {
      const answers = [];
      const n = C.gad7.items.length;
      const ask = (i) => {
        if (i >= n) return finishTest(answers);
        render(`
          <div class="dots">${C.gad7.items.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
          <p class="muted">${C.gad7.question}</p>
          <h1>${C.gad7.items[i]}</h1>
          <div class="stack">
            ${C.gad7.options.map((o, v) => `<button class="option" data-v="${v}"><span class="dot"></span>${o}</button>`).join("")}
          </div>
        `);
        app.querySelectorAll("[data-v]").forEach((el) => el.addEventListener("click", () => {
          haptic();
          el.classList.add("selected");
          answers[i] = Number(el.dataset.v);
          later(() => ask(i + 1), 260);
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
      const arc = Math.PI * 100;
      render(`
        <h1 class="center">Ваш результат</h1>
        <svg class="gauge" viewBox="0 0 240 135" aria-hidden="true">
          <path class="track" d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke-width="16" stroke-linecap="round"/>
          <path class="bar ${last.score >= 15 ? "bad" : last.score >= 10 ? "warn" : ""}" id="gbar" d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke-width="16" stroke-dasharray="${arc}" stroke-dashoffset="${arc}"/>
        </svg>
        <div class="score"><span id="score">0</span><small> / 21</small></div>
        <h2 class="center">${level.name}</h2>
        ${prev ? `<p class="muted center">В прошлый раз: ${prev.score}${prev.score > last.score ? ", стало лучше" : ""}</p>` : ""}
        <p class="lead">${level.text}</p>
        ${level.recommendPsychologist ? `
          <div class="card warm"><p>${C.psychologist.text}</p></div>
          <button class="btn" data-psy>${C.psychologist.button}</button>
          <button class="btn secondary" data-go="course">Начать курс самопомощи</button>
        ` : `
          <button class="btn" data-go="course">Начать курс «14 дней спокойнее»</button>
        `}
        <p class="muted">${C.gad7.note}</p>
      `);
      const bar = document.getElementById("gbar");
      const target = arc * (1 - last.score / 21);
      if (gsap && !reduceMotion) gsap.to(bar, { strokeDashoffset: target, duration: 1.4, ease: "power3.out", delay: 0.2 });
      else bar.style.strokeDashoffset = target;
      countUp(document.getElementById("score"), last.score);
    },

    day(nStr) {
      const n = Number(nStr);
      const d = C.course[n - 1];
      if (!d) return go("course");
      const done = store.get("course_done", []);
      render(`
        <div class="dots">${C.course.map((_, k) => `<i class="${done.includes(k + 1) || k + 1 === n ? "on" : ""}"></i>`).join("")}</div>
        <div><h1>${d.title}</h1><p class="muted" style="margin-top:8px">День ${n} из ${C.course.length}</p></div>
        <p class="lead">${d.text}</p>
        <div class="card">
          <span class="title">Практика дня</span>
          <p style="margin-top:6px">${d.practice}</p>
          ${d.tool ? `<button class="btn secondary" style="margin-top:16px" data-go="${d.tool}">${icon(d.tool === "test" ? "test" : d.tool, 18)} Открыть упражнение</button>` : ""}
        </div>
        ${done.includes(n)
          ? `<button class="btn secondary" data-go="course">День пройден ✓</button>`
          : `<button class="btn" id="done">Отметить день пройденным</button>`}
        ${n === 3 || n === 7 || n === 14 ? `
          <h2>Хотите разобрать это со специалистом?</h2>
          <p class="muted">Курс даёт инструменты, а психолог помогает понять, почему тревога появляется именно у вас.</p>
          ${psychologistCard()}` : psyLink()}
      `);
      const btn = document.getElementById("done");
      if (btn) btn.addEventListener("click", () => {
        if (!done.includes(n)) done.push(n);
        store.set("course_done", done);
        logPractice("course");
        celebrate();
        later(() => go("course"), 700);
      });
    },

    psychologist() {
      render(`
        <h1>${C.psychologist.title}</h1>
        <p class="lead">Иногда техник недостаточно, и это нормально. Психолог поможет понять, откуда берётся тревога именно у вас, и подобрать то, что сработает.</p>
        <div class="stack">
          <div class="card"><div class="row"><span class="ico">${icon("clock", 26)}</span><span class="grow"><span class="title">20 минут бесплатно</span><span class="sub">Познакомиться и понять, подходит ли специалист</span></span></div></div>
          <div class="card"><div class="row"><span class="ico">${icon("shield", 26)}</span><span class="grow"><span class="title">Анонимно</span><span class="sub">Чат, аудио или видео — как вам удобнее</span></span></div></div>
          <div class="card"><div class="row"><span class="ico">${icon("swap", 26)}</span><span class="grow"><span class="title">Бесплатная замена</span><span class="sub">Если специалист не подойдёт, подберут другого</span></span></div></div>
        </div>
        <button class="btn" data-psy>${C.psychologist.button}</button>
        <p class="muted">Откроется сайт ПсиЧата. Ответы теста и записи дневника никуда не передаются.</p>
      `);
    },

    crisis() {
      render(`
        <h1>${C.crisis.title}</h1>
        <p class="lead">${C.crisis.text}</p>
        ${C.crisis.contacts.map((c) => `
          <div class="card contact">
            <span><span class="title">${c.name}</span><span class="sub">${c.note}</span></span>
            <a class="phone" href="tel:${c.phone.replace(/[^\d+]/g, "")}">${c.phone}</a>
          </div>`).join("")}
        <h2>Пока вы ждёте ответа</h2>
        <p>Если можете, побудьте рядом с другим человеком или напишите тому, кому доверяете. Уберите от себя то, чем можно причинить вред.</p>
        <button class="btn secondary" data-psy>Связаться с психологом ПсиЧата</button>
      `);
    },
  };

  function moodReply(v) {
    const [text, route, label] = MOOD_REPLIES[v];
    return `<p class="mood-reply">${text}</p><button class="btn secondary" data-go="${route}">${label}</button>${v <= 1 ? psyLink("Поговорить с психологом") : ""}`;
  }

  // ---------- Дыхательная сфера ----------
  function orbWidget() {
    const c = 2 * Math.PI * 140;
    return `
      <div class="orb-stage">
        <svg class="orb-ring" viewBox="0 0 300 300"><circle class="track" cx="150" cy="150" r="140"/>
          <circle class="bar" id="orb-bar" cx="150" cy="150" r="140" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg>
        <div class="orb-halo h1" id="h1"></div>
        <div class="orb-halo h2" id="h2"></div>
        <div class="orb-core" id="core"></div>
        <div class="orb-label"><b id="orb-phase">Готовы?</b><span id="orb-sec"></span></div>
      </div>
      <p class="timer" id="breath-left">&nbsp;</p>
      ${psyLink("Поговорить с психологом")}`;
  }

  function startBreathing(mode, seconds, onFinish) {
    const core = document.getElementById("core");
    const h1 = document.getElementById("h1");
    const h2 = document.getElementById("h2");
    const phaseEl = document.getElementById("orb-phase");
    const secEl = document.getElementById("orb-sec");
    const bar = document.getElementById("orb-bar");
    const leftEl = document.getElementById("breath-left");
    const circ = 2 * Math.PI * 140;
    const scales = { "Вдох": [1.5, 1.32, 1.18], "Выдох": [1, 1, 1] };
    let phase = 0;
    let left = seconds;
    let finished = false;

    const setScale = (s, dur) => {
      [core, h2, h1].forEach((el, k) => {
        el.style.transitionDuration = dur + "s";
        el.style.transform = `scale(${s[k]})`;
      });
    };
    const step = () => {
      if (!document.body.contains(core)) return;
      const [name, dur] = mode.phases[phase % mode.phases.length];
      phaseEl.textContent = name;
      if (scales[name]) setScale(scales[name], dur);
      haptic(name === "Вдох" ? "soft" : "light");
      let s = dur;
      secEl.textContent = s;
      for (let k = 1; k < dur; k++) later(() => { secEl.textContent = dur - k; }, k * 1000);
      phase++;
      later(step, dur * 1000);
    };
    later(step, 900);
    every(() => {
      left--;
      bar.style.strokeDashoffset = circ * Math.max(left, 0) / seconds;
      if (left <= 0) {
        leftEl.textContent = "Хорошо. Можно продолжать, сколько нужно.";
        if (!finished) { finished = true; hapticOk(); onFinish && onFinish(); }
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

  // ---------- Графики ----------
  function moodChart(moods) {
    const W = 320, H = 150, P = 24;
    const x = (i) => P + (i * (W - 2 * P)) / (moods.length - 1);
    const y = (v) => H - P - (v * (H - 2 * P)) / 4;
    const pts = moods.map((m, i) => [x(i), y(m.v)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${H - P} L${pts[0][0].toFixed(1)} ${H - P} Z`;
    const fmt = (s) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    return `<svg class="chart" viewBox="0 0 ${W} ${H + 10}" role="img" aria-label="График настроения">
      <line class="base" x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}"/>
      <path class="area" d="${area}"/>
      <path class="line" d="${d}"/>
      ${pts.map((p) => `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="4"/>`).join("")}
      <text x="${P}" y="${H + 8}">${fmt(moods[0].d)}</text>
      <text x="${W - P}" y="${H + 8}" text-anchor="end">${fmt(moods[moods.length - 1].d)}</text>
    </svg>`;
  }

  function testChart(tests) {
    const W = 320, H = 150, P = 24;
    const bw = Math.min(36, (W - 2 * P) / tests.length - 10);
    const step = (W - 2 * P) / tests.length;
    const y = (v) => H - P - (v * (H - 2 * P)) / 21;
    return `<svg class="chart" viewBox="0 0 ${W} ${H + 10}" role="img" aria-label="История результатов теста">
      <line class="base" x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}"/>
      ${tests.map((t, i) => {
        const cx = P + step * i + step / 2;
        const cls = t.score >= 15 ? "bad" : t.score >= 10 ? "warn" : "";
        return `<rect class="bar ${cls}" x="${cx - bw / 2}" y="${y(t.score)}" width="${bw}" height="${Math.max(H - P - y(t.score), 3)}" rx="8"/>
          <text class="val" x="${cx}" y="${y(t.score) - 8}" text-anchor="middle">${t.score} из 21</text>
          <text x="${cx}" y="${H + 8}" text-anchor="middle">${new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "numeric" })}</text>`;
      }).join("")}
    </svg>`;
  }

  // ---------- Лестница шагов ----------
  function stepsForm() {
    const steps = store.get("ladder", []);
    return `
      <h2>Моя лестница</h2>
      <form id="steps-form">
        <input id="s-text" type="text" name="s" placeholder="Следующий шаг, от лёгкого к трудному" required>
        <button class="btn secondary" type="submit">Добавить шаг</button>
      </form>
      <div class="path" style="margin-top:14px">
        ${steps.map((s, i) => `
          <button class="card node ${s.done ? "done" : ""}" data-step="${i}">
            <span class="num">${s.done ? "✓" : i + 1}</span><span class="grow">${esc(s.text)}</span>
          </button>`).join("")}
      </div>`;
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
      if (s.done) { logPractice("steps"); celebrate(); } else haptic();
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

  // ---------- Нижнее меню ----------
  const TABS = [["today", "Сегодня"], ["practices", "Практики"], ["course", "Курс"], ["progress", "Прогресс"]];
  tabbar.innerHTML = `<i class="tab-indicator" id="tab-ind"></i>` +
    TABS.map(([id, name]) => `<button class="tab" data-tab="${id}">${icon(id, 22)}<span>${name}</span></button>`).join("");
  tabbar.querySelectorAll("[data-tab]").forEach((el) => el.addEventListener("click", () => { haptic(); go(el.dataset.tab); }));

  // ---------- Маршрутизация ----------
  const tabIds = TABS.map((t) => t[0]);
  function route() {
    clearTimers();
    let [name, arg] = (location.hash.slice(1) || "today").split("/");
    if (name === "home") name = "today";
    const view = views[name] || views.today;
    const tabIndex = tabIds.indexOf(views[name] ? name : "today");
    const isTab = tabIndex >= 0;
    tabbar.hidden = !isTab;
    document.body.classList.toggle("no-tabs", !isTab);
    backBtn.hidden = isTab;
    if (inTelegram && tg.BackButton) isTab ? tg.BackButton.hide() : tg.BackButton.show();
    if (isTab) {
      document.getElementById("tab-ind").style.transform = `translateX(${tabIndex * 100}%)`;
      tabbar.querySelectorAll(".tab").forEach((t, i) => t.classList.toggle("active", i === tabIndex));
    }
    view(arg);
  }

  const goBack = () => (history.length > 1 ? history.back() : go("today"));
  backBtn.addEventListener("click", goBack);
  if (inTelegram && tg.BackButton) tg.BackButton.onClick(goBack);
  const crisisBtn = document.getElementById("crisis-btn");
  crisisBtn.innerHTML = `${icon("phone", 16)} Мне очень плохо`;
  crisisBtn.addEventListener("click", () => go("crisis"));
  window.addEventListener("hashchange", route);
  route();
})();
