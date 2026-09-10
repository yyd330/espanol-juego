/* Español Juego — web game: learn + quiz (no dependencies).
 *
 * Modes:
 *   aprender  — flashcards (word → reveal meaning + example sentence),
 *               then an automatic quiz on every word you just learned.
 *   vocabulario — vocabulary quiz (level-filtered)
 *   conjugacion — pick a tense group, read the mini-lesson, then quiz
 *   escenas   — reading comprehension (level-filtered)
 *   traduccion — phrase translation (level-filtered)
 *
 * Levels run from "0" (absolute beginner) to "c1".
 */
"use strict";

const LIVES_MAX = 3;
const STREAK_EVERY = 5;
const STREAK_BONUS = 10;
const POINTS = 10;

const LEVELS = ["0", "a1", "a2", "b1", "b2", "c1"];
const LEVEL_RANK = { "0": 0, "a1": 1, "a2": 2, "b1": 3, "b2": 4, "c1": 5 };

const TITLES = [
  [0, "Novato", "beginner"],
  [50, "Intermedio", "intermediate"],
  [100, "Avanzado", "advanced"],
  [160, "¡Bilingüe!", "bilingual"],
];

// ---------- data loading ----------
async function loadData() {
  const bases = ["../data/", "data/"];
  const files = {
    vocab: "vocabularios.json",
    verbos: "verbos.json",
    escenas: "escenas.json",
    frases: "frases.json",
  };
  const out = {};
  for (const [key, file] of Object.entries(files)) {
    let lastErr;
    for (const base of bases) {
      try {
        const res = await fetch(base + file, { cache: "no-store" });
        if (res.ok) { out[key] = await res.json(); break; }
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) { lastErr = e; }
    }
    if (!out[key]) console.warn(`No pude cargar ${file}`, lastErr);
  }
  return out;
}

// ---------- helpers ----------
function normalize(s) {
  return s.toLowerCase()
    .replace(/[.,!?¿¡;:()"]/g, " ")
    .replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i")
    .replace(/ó/g, "o").replace(/ú/g, "u").replace(/ü/g, "u")
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function titleFor(score) {
  let t = TITLES[0];
  for (const [min, es, en] of TITLES) if (score >= min) t = [min, es, en];
  return t;
}

function levelRange() {
  const from = document.getElementById("level-from").value;
  const to = document.getElementById("level-to").value;
  return [from, to];
}

function inLevel(level, from, to) {
  if (!level) return true;
  const r = LEVEL_RANK[level];
  if (r === undefined) return true;
  return r >= LEVEL_RANK[from] && r <= LEVEL_RANK[to];
}

// ---------- question builders ----------
function buildVocab(data, size, opts) {
  opts = opts || {};
  const [from, to] = levelRange();
  const items = [];
  for (const [themeKey, theme] of Object.entries(data || {})) {
    if (opts.theme && opts.theme !== "all" && opts.theme !== themeKey) continue;
    for (const w of theme.words || []) {
      if (!inLevel(w.level, from, to)) continue;
      items.push({
        meta: `📖 ${theme.theme_es} · nivel ${w.level}`,
        prompt: `¿Qué significa en inglés: «${w.es}»?`,
        answer: w.en, open: true, word: w,
      });
      items.push({
        meta: `📖 ${theme.theme_es} · nivel ${w.level}`,
        prompt: `¿Cómo se dice en español: «${w.en}»?`,
        answer: w.es, open: true, word: w,
      });
    }
  }
  return shuffle(items).slice(0, size);
}

/* Vocab quiz restricted to a given list of words (used by the Learn mode). */
function buildVocabFromWords(words, size) {
  const items = [];
  for (const w of words || []) {
    items.push({
      meta: `📖 nivel ${w.level} · ¡acaba de aprenderla!`,
      prompt: `¿Qué significa en inglés: «${w.es}»?`,
      answer: w.en, open: true, word: w,
    });
    items.push({
      meta: `📖 nivel ${w.level} · ¡acaba de aprenderla!`,
      prompt: `¿Cómo se dice en español: «${w.en}»?`,
      answer: w.es, open: true, word: w,
    });
  }
  return shuffle(items).slice(0, size);
}

const VERB_GROUPS = [
  ["presente", "Presente", (d) => (d.presente || {}).verbs || []],
  ["preterito", "Pretérito", (d) => d.verbs || []],
  ["imperfecto", "Imperfecto", (d) => (d.imperfect || {}).verbs || []],
  ["mixto", "Pretérito vs Imperfecto", (d) => (d.mixto || {}).verbs || []],
  ["condicional", "Condicional y futuro", (d) => (d.condicional || {}).verbs || []],
  ["subjuntivo", "Subjuntivo", (d) => (d.subjuntivo || {}).verbs || []],
];

function getLesson(data, group) {
  if (!data || !group || group === "all") return "";
  const map = { presente: "presente", imperfecto: "imperfect", mixto: "mixto", condicional: "condicional", subjuntivo: "subjuntivo" };
  const g = data[map[group]];
  return (g && g.lesson) || "";
}
function getGroupVerbs(data, group) {
  const map = { presente: "presente", preterito: "", imperfecto: "imperfect", mixto: "mixto", condicional: "condicional", subjuntivo: "subjuntivo" };
  const key = map[group];
  if (key === "") return data.verbs || [];
  return ((data || {})[key] || {}).verbs || [];
}

function buildConjugate(data, size, opts) {
  opts = opts || {};
  const [from, to] = levelRange();
  const groups = (opts.group && opts.group !== "all")
    ? VERB_GROUPS.filter(([k]) => k === opts.group)
    : VERB_GROUPS;
  const items = [];
  for (const [key, label, get] of groups) {
    for (const v of get(data)) {
      if (!inLevel(v.level, from, to)) continue;
      items.push({
        meta: `✍️ ${label} · ${v.person}${v.level ? " · nivel " + v.level : ""}`,
        prompt: v.sentence,
        clue: v.clue,
        answer: v.answer,
        open: true,
      });
    }
  }
  return shuffle(items).slice(0, size);
}

function buildEscenas(data, size, opts) {
  const [from, to] = levelRange();
  const items = [];
  for (const esc of data?.escenas || []) {
    if (!inLevel(esc.level, from, to)) continue;
    for (const q of esc.questions || []) {
      items.push({
        meta: `📚 ${esc.title} · nivel ${esc.level}`,
        context: esc.texto,
        prompt: q.q,
        answer: q.options[q.answer],
        options: q.options,
      });
    }
  }
  return shuffle(items).slice(0, size);
}

function buildTrad(data, size, opts) {
  const [from, to] = levelRange();
  const items = [];
  for (const f of data?.frases || []) {
    if (!inLevel(f.level, from, to)) continue;
    items.push({ meta: `🔄 Traducción EN→ES · nivel ${f.level}`, prompt: f.en, answer: f.es, open: true });
    items.push({ meta: `🔄 Traducción ES→EN · nivel ${f.level}`, prompt: f.es, answer: f.en, open: true });
  }
  return shuffle(items).slice(0, size);
}

/* Learn mode: cards = one entry per word (ES first), with example sentence. */
function buildLearnCards(data, opts) {
  opts = opts || {};
  const [from, to] = levelRange();
  const cards = [];
  const themes = Object.entries(data || {});
  const list = opts.theme && opts.theme !== "all" ? themes.filter(([k]) => k === opts.theme) : themes;
  for (const [key, theme] of list) {
    for (const w of theme.words || []) {
      if (!inLevel(w.level, from, to)) continue;
      cards.push({ es: w.es, en: w.en, ej: w.ej, ej_en: w.ej_en, level: w.level, theme: theme.theme_es, word: w });
    }
  }
  return shuffle(cards);
}

const BUILDERS = {
  vocab: buildVocab,
  conjugar: buildConjugate,
  escenas: buildEscenas,
  trad: buildTrad,
};
const MODE_LABELS = {
  vocab: "Vocabulario",
  conjugar: "Conjugación",
  escenas: "Escenas",
  trad: "Traducción",
  aprender: "Aprender",
  all: "Juego completo",
};

// ---------- state ----------
let DATA = null;
let current = null;   // quiz round state
let learnState = null; // flashcard state
let pendingQuiz = null; // quiz to start after a lesson/learn session

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const screens = {
  menu: $("screen-menu"),
  play: $("screen-play"),
  learn: $("screen-learn"),
  lesson: $("screen-lesson"),
  results: $("screen-results"),
};

function show(screen) {
  for (const [name, el] of Object.entries(screens)) el.classList.toggle("hidden", name !== screen);
  window.scrollTo(0, 0);
}

function updateHud() {
  $("hud-lives").textContent = "❤️".repeat(current.lives) + "🖤".repeat(LIVES_MAX - current.lives);
  $("hud-progress").textContent = `${Math.min(current.idx + 1, current.items.length)}/${current.items.length}`;
  $("hud-score").textContent = `${current.score} pts`;
}

function renderQuestion() {
  const q = current.items[current.idx];
  $("q-meta").textContent = q.meta;
  $("q-context").textContent = q.context || "";
  $("q-context").classList.toggle("hidden", !q.context);
  $("q-text").textContent = q.prompt;
  $("q-clue").textContent = q.clue || "";
  $("q-clue").classList.toggle("hidden", !q.clue);

  const answersEl = $("answers");
  answersEl.innerHTML = "";
  $("open-answer").classList.toggle("hidden", !q.open);
  $("feedback").classList.add("hidden");
  $("next-bar").classList.add("hidden");
  $("open-input").value = "";
  $("open-input").disabled = false;
  $("open-submit").disabled = false;

  if (q.options) {
    for (const opt of q.options) {
      const btn = document.createElement("button");
      btn.className = "answer-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => checkOption(btn, opt, q));
      answersEl.appendChild(btn);
    }
  } else {
    $("open-input").focus();
  }
  updateHud();
}

function setFeedback(kind, html) {
  const el = $("feedback");
  el.className = "feedback " + kind;
  el.innerHTML = html;
}

function checkOption(btn, opt, q) {
  const ok = normalize(opt) === normalize(q.answer);
  for (const b of document.querySelectorAll(".answer-btn")) b.disabled = true;
  btn.classList.add(ok ? "correct" : "wrong");
  if (!ok) {
    for (const b of document.querySelectorAll(".answer-btn")) {
      if (normalize(b.textContent) === normalize(q.answer)) b.classList.add("correct");
    }
  }
  finishQuestion(ok, ok ? "" : q.answer);
}

function checkOpen() {
  const q = current.items[current.idx];
  const ans = $("open-input").value;
  if (!ans.trim()) return;
  $("open-input").disabled = true;
  $("open-submit").disabled = true;
  const ok = normalize(ans) === normalize(q.answer);
  let extra = "";
  if (q.word && q.word.ej && !ok) {
    extra = `<br><em>${q.word.ej}</em><br><small>${q.word.ej_en || ""}</small>`;
  }
  if (!ok) {
    current.lives--;
    current.wrong++;
    current.streak = 0;
    setFeedback("bad", `❌ Incorrecto.<br>Respuesta: <strong>${escapeHtml(q.answer)}</strong>${extra}<br>❤️ × ${current.lives}`);
  } else {
    current.score += POINTS;
    current.correct++;
    current.streak++;
    let bonus = "";
    if (current.streak % STREAK_EVERY === 0) {
      current.score += STREAK_BONUS;
      bonus = `<br>🔥 ¡Racha de ${current.streak}! +${STREAK_BONUS} bono`;
      flashStreak();
    }
    setFeedback("good", `✅ ¡Correcto! +${POINTS}${bonus}`);
  }
  updateHud();
  $("next-bar").classList.remove("hidden");
  $("btn-next").focus();
}

function flashStreak() {
  const el = $("streak-badge");
  el.textContent = `🔥 racha ×${current.streak}`;
  el.classList.remove("hidden");
  clearTimeout(flashStreak._t);
  flashStreak._t = setTimeout(() => el.classList.add("hidden"), 1800);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function next() {
  if (current.lives <= 0 || current.idx + 1 >= current.items.length) {
    showResults();
    return;
  }
  current.idx++;
  renderQuestion();
}

function startQuiz(items, mode) {
  if (!items.length) { alert("No hay datos para esta combinación. Prueba otro rango de niveles u otro tema."); return; }
  current = { items, idx: 0, score: 0, lives: LIVES_MAX, streak: 0, correct: 0, wrong: 0, mode };
  show("play");
  renderQuestion();
}

function startMode(mode, size) {
  if (mode === "aprender") { startLearn(size); return; }
  if (mode === "conjugar") {
    const group = $("conj-group").value;
    const lesson = getLesson(DATA.verbos, group);
    if (lesson) { showLesson("✍️ Lección rápida: conjugación", lesson, () => {
      startQuiz(buildConjugate(DATA.verbos, size, { group }), "conjugar");
    }); }
    else {
      startQuiz(buildConjugate(DATA.verbos, size, { group }), "conjugar");
    }
    return;
  }
  if (mode === "all") {
    const all = [];
    for (const [m, builder] of Object.entries(BUILDERS)) {
      for (const it of builder(DATA[m === "vocab" ? "vocab" : m === "conjugar" ? "verbos" : m === "escenas" ? "escenas" : "frases"], size)) all.push(it);
    }
    startQuiz(shuffle(all), "all");
    return;
  }
  const dataKey = { vocab: "vocab", conjugar: "verbos", escenas: "escenas", trad: "frases" }[mode];
  startQuiz(BUILDERS[mode](DATA[dataKey], size), mode);
}

// ---------- lesson screen ----------
function showLesson(title, text, onDone) {
  $("lesson-title").textContent = title;
  $("lesson-text").textContent = text;
  pendingQuiz = onDone;
  show("lesson");
  $("btn-lesson-start").focus();
}

// ---------- learn (flashcards) mode ----------
function startLearn(size) {
  const theme = $("learn-theme").value;
  const cards = buildLearnCards(DATA.vocab, { theme });
  if (!cards.length) { alert("No hay palabras para ese tema y rango de niveles."); return; }
  learnState = { cards, idx: 0, learned: [], revealed: false, size };
  show("learn");
  renderCard();
}

function renderCard() {
  $("learn-done").classList.add("hidden");
  $("learn-cards").classList.remove("hidden");
  const c = learnState.cards[learnState.idx];
  $("fc-level").textContent = `${c.theme} · nivel ${c.level}`;
  $("learn-progress").textContent = `Palabra ${learnState.idx + 1} de ${learnState.cards.length}`;
  $("fc-word").textContent = c.es;
  $("fc-reveal").classList.add("hidden");
  $("fc-know").classList.add("hidden");
  $("btn-flip").classList.remove("hidden");
  $("btn-flip").disabled = false;
  learnState.revealed = false;
  $("btn-flip").focus();
}

function flipCard() {
  const c = learnState.cards[learnState.idx];
  $("fc-en").textContent = c.en;
  $("fc-ej").textContent = c.ej || "";
  $("fc-ej-en").textContent = c.ej_en || "";
  $("fc-reveal").classList.remove("hidden");
  $("fc-know").classList.remove("hidden");
  $("btn-flip").classList.add("hidden");
  learnState.revealed = true;
  $("btn-know").focus();
}

function cardDone(knewIt) {
  const c = learnState.cards[learnState.idx];
  if (!learnState.learned.some((w) => w.es === c.es)) {
    learnState.learned.push(c.word || { es: c.es, en: c.en, level: c.level, ej: c.ej, ej_en: c.ej_en });
  }
  if (learnState.idx + 1 >= learnState.cards.length) {
    // done learning → offer a quiz on exactly the words just seen
    $("learn-cards").classList.add("hidden");
    $("learn-done").classList.remove("hidden");
    $("learn-done-text").textContent =
      `🎓 ¡Excelente! Repasaste ${learnState.learned.length} palabras. ` +
      (knewIt ? "¡Te fuiste bien!" : "Está bien: las repitimos en el quiz.");
    $("btn-learn-quiz").disabled = false;
    return;
  }
  learnState.idx++;
  renderCard();
}

function startLearnQuiz() {
  const learned = learnState.learned;
  const size = Math.max(3, learnState.size);
  learnState = null;
  startQuiz(buildVocabFromWords(learned, size), "aprender");
}

function showResults() {
  const total = current.correct + current.wrong;
  const pct = total ? Math.round((100 * current.correct) / total) : 0;
  const [, es, en] = titleFor(current.score);
  $("trophy").textContent = current.lives > 0 ? "🏆" : "💔";
  $("results-title").textContent = `${es} (${en})`;
  $("results-detail").innerHTML =
    `Puntaje: <strong>${current.score}</strong> pts<br>` +
    `Correctas: ${current.correct} / ${total} (${pct}%)<br>` +
    `Modo: ${MODE_LABELS[current.mode] || current.mode}`;
  show("results");
}

// ---------- init ----------
async function init() {
  DATA = await loadData();

  // populate level selectors
  const lf = $("level-from"), lt = $("level-to");
  for (const l of LEVELS) {
    lf.add(new Option(l.toUpperCase(), l));
    lt.add(new Option(l.toUpperCase(), l));
  }
  lf.value = "0"; lt.value = "c1";

  // populate learn theme selector
  const ltSel = $("learn-theme");
  ltSel.add(new Option("Todos los temas", "all"));
  for (const [key, theme] of Object.entries(DATA.vocab || {})) {
    ltSel.add(new Option(theme.theme_es, key));
  }

  document.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => startMode(btn.dataset.mode, parseInt($("round-size").value, 10)));
  });
  $("open-submit").addEventListener("click", checkOpen);
  $("open-input").addEventListener("keydown", (e) => { if (e.key === "Enter") checkOpen(); });
  $("btn-next").addEventListener("click", next);
  $("btn-replay").addEventListener("click", () => current && startMode(current.mode, parseInt($("round-size").value, 10)));
  $("btn-menu").addEventListener("click", () => show("menu"));
  $("btn-lesson-start").addEventListener("click", () => { const f = pendingQuiz; pendingQuiz = null; if (f) f(); });
  $("btn-flip").addEventListener("click", flipCard);
  $("btn-know").addEventListener("click", () => cardDone(true));
  $("btn-review").addEventListener("click", () => cardDone(false));
  $("btn-learn-quiz").addEventListener("click", startLearnQuiz);
  $("btn-learn-exit").addEventListener("click", () => { learnState = null; show("menu"); });
  $("btn-learn-menu").addEventListener("click", () => { learnState = null; show("menu"); });
  $("btn-lesson-back").addEventListener("click", () => { pendingQuiz = null; show("menu"); });
  $("flashcard").addEventListener("click", (e) => {
    if (learnState && !learnState.revealed && e.target.id !== "btn-flip") flipCard();
  });
}

init();
