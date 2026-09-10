/* Español Juego — web game (no dependencies) */
"use strict";

const LIVES_MAX = 3;
const STREAK_EVERY = 5;
const STREAK_BONUS = 10;
const POINTS = 10;

const TITLES = [
  [0, "Novato", "beginner"],
  [50, "Intermedio", "intermediate"],
  [80, "Avanzado", "advanced"],
  [120, "¡Bilingüe!", "bilingual"],
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
    .replace(/[.,!?¿¡;:()]/g, " ") // punctuation → space (anywhere, not just trailing)
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

// ---------- question builders ----------
function buildVocab(data, size) {
  const items = [];
  for (const theme of Object.values(data || {})) {
    for (const w of theme.words || []) {
      items.push({ meta: `📖 ${theme.theme_en} · ${w.level}`, prompt: `¿Qué significa en inglés: «${w.es}»?`, answer: w.en, open: true });
      items.push({ meta: `📖 ${theme.theme_es} · ${w.level}`, prompt: `¿Cómo se dice en español: «${w.en}»?`, answer: w.es, open: true });
    }
  }
  return shuffle(items).slice(0, size);
}

function buildConjugate(data, size) {
  const items = [];
  const groups = [
    [data?.verbs || [], "Pretérito"],
    [data?.imperfect?.verbs || [], "Imperfecto"],
    [data?.mixto?.verbs || [], "Pretérito vs Imperfecto"],
  ];
  for (const [verbs, label] of groups) {
    for (const v of verbs) {
      items.push({
        meta: `✍️ ${label} · ${v.person}`,
        prompt: v.sentence,
        clue: v.clue,
        answer: v.answer,
        open: true,
      });
    }
  }
  return shuffle(items).slice(0, size);
}

function buildEscenas(data, size) {
  const items = [];
  for (const esc of data?.escenas || []) {
    for (const q of esc.questions || []) {
      items.push({
        meta: `📚 ${esc.title} · nivel ${esc.level}`,
        prompt: q.q,
        answer: q.options[q.answer],
        options: q.options,
      });
    }
  }
  return shuffle(items).slice(0, size);
}

function buildTrad(data, size) {
  const items = [];
  for (const f of data?.frases || []) {
    items.push({ meta: "🔄 Traducción EN→ES", prompt: f.en, answer: f.es, open: true });
    items.push({ meta: "🔄 Traducción ES→EN", prompt: f.es, answer: f.en, open: true });
  }
  return shuffle(items).slice(0, size);
}

const BUILDERS = {
  vocab: buildVocab,
  conjugar: buildConjugate,
  escenas: buildEscenas,
  trad: buildTrad,
};
const MODE_LABELS = { vocab: "Vocabulario", conjugar: "Conjugación", escenas: "Escenas", trad: "Traducción" };

// ---------- state ----------
let DATA = null;
let current = null; // { items, idx, score, lives, streak, correct, wrong, mode }

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const screens = { menu: $("screen-menu"), play: $("screen-play"), results: $("screen-results") };

function show(screen) {
  for (const [name, el] of Object.entries(screens)) el.classList.toggle("hidden", name !== screen);
}

function updateHud() {
  $("hud-lives").textContent = "❤️".repeat(current.lives) + "🖤".repeat(LIVES_MAX - current.lives);
  $("hud-progress").textContent = `${Math.min(current.idx + 1, current.items.length)}/${current.items.length}`;
  $("hud-score").textContent = `${current.score} pts`;
}

function renderQuestion() {
  const q = current.items[current.idx];
  $("q-meta").textContent = q.meta;
  $("q-text").textContent = q.prompt;
  $("q-clue").textContent = q.clue || "";
  $("q-clue").classList.toggle("hidden", !q.clue);

  const answersEl = $("answers");
  answersEl.innerHTML = "";
  $("open-answer").classList.toggle("hidden", !q.open);
  $("feedback").classList.add("hidden");
  $("next-bar").classList.add("hidden");
  $("open-input").value = "";

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
  finishQuestion(ok, ok ? "" : q.answer);
}

function finishQuestion(ok, correctAnswer) {
  if (ok) {
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
  } else {
    current.lives--;
    current.wrong++;
    current.streak = 0;
    setFeedback("bad", `❌ Incorrecto.<br>Respuesta: <strong>${escapeHtml(correctAnswer)}</strong><br>❤️ × ${current.lives}`);
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
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function next() {
  if (current.lives <= 0 || current.idx + 1 >= current.items.length) {
    showResults();
    return;
  }
  current.idx++;
  renderQuestion();
}

function startMode(mode, size) {
  const items = mode === "all"
    ? shuffle([...buildAll(DATA, size)])
    : BUILDERS[mode](DATA, size);
  if (!items.length) { alert("No hay datos para este modo. Añade entradas a data/ (y recarga)."); return; }
  current = { items, idx: 0, score: 0, lives: LIVES_MAX, streak: 0, correct: 0, wrong: 0, mode };
  show("play");
  renderQuestion();
}

function buildAll(data, size) {
  const all = [];
  for (const [mode, builder] of Object.entries(BUILDERS)) {
    for (const it of builder(data, size)) all.push(it);
  }
  return all;
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
    (current.mode === "all" ? "Juego completo" : `Modo: ${MODE_LABELS[current.mode] || current.mode}`);
  show("results");
}

// ---------- init ----------
async function init() {
  DATA = await loadData();
  document.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => startMode(btn.dataset.mode, parseInt($("round-size").value, 10)));
  });
  $("open-submit").addEventListener("click", checkOpen);
  $("open-input").addEventListener("keydown", (e) => { if (e.key === "Enter") checkOpen(); });
  $("btn-next").addEventListener("click", next);
  $("btn-replay").addEventListener("click", () => current && startMode(current.mode, parseInt($("round-size").value, 10)));
  $("btn-menu").addEventListener("click", () => show("menu"));
}

init();
