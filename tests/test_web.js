#!/usr/bin/env node
/* Web game test harness — runs the real game.js against the real JSON data.
 * No Python: this is Node only.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✓", msg); }
  else { failures++; console.error("  ✗ FAIL:", msg); }
}

// ---- stub DOM ----
function el(id) {
  const e = {
    id,
    textContent: "",
    innerHTML: "",
    value: id === "round-size" ? "10" : id === "level-from" ? "0" : id === "level-to" ? "c1" : "",
    disabled: false,
    _classes: new Set(id === "screen-menu" ? [] : ["hidden"]),
    _listeners: {},
    _children: [],
    _options: [],
    add: (opt) => e._options.push(opt),
    appendChild: (child) => e._children.push(child),
    addEventListener: (ev, fn) => { (e._listeners[ev] ||= []).push(fn); },
    focus: () => {},
  };
  e.classList = {
    add: (...c) => c.forEach((x) => e._classes.add(x)),
    remove: (...c) => c.forEach((x) => e._classes.delete(x)),
    toggle: (c, force) => {
      const has = e._classes.has(c);
      const want = force === undefined ? !has : force;
      if (want) e._classes.add(c); else e._classes.delete(c);
    },
    contains: (c) => e._classes.has(c),
  };
  return e;
}

const IDS = [
  "screen-menu", "screen-play", "screen-learn", "screen-lesson", "screen-results",
  "hud-lives", "hud-progress", "hud-score", "streak-badge",
  "q-context", "q-meta", "q-text", "q-clue", "answers",
  "open-answer", "open-input", "open-submit", "feedback", "next-bar", "btn-next",
  "trophy", "results-title", "results-detail", "btn-replay", "btn-menu",
  "level-from", "level-to", "round-size", "conj-group", "learn-theme", "open-input",
  "lesson-title", "lesson-text", "btn-lesson-start", "btn-lesson-back",
  "learn-progress", "learn-cards", "learn-done", "learn-done-text",
  "flashcard", "fc-level", "fc-word", "fc-reveal", "fc-en", "fc-ej", "fc-ej-en",
  "fc-hint", "btn-flip", "fc-know", "btn-know", "btn-review",
  "btn-learn-quiz", "btn-learn-exit", "btn-learn-menu",
];
const documentStub = {
  _els: {},
  getElementById: (id) => (documentStub._els[id] ||= el(id)),
  createElement: (tag) => el("dyn-" + Math.random().toString(36).slice(2)),
  querySelectorAll: () => [],
};
const OptionCtor = function (label, value) { this.label = label; this.value = value; };

// real fetch over local files
function localFetch(url) {
  return new Promise((resolve, reject) => {
    const clean = url.replace(/^\.\.\//, "").replace(/^data\//, "data/");
    const file = path.join(ROOT, clean.startsWith("web/") || clean.startsWith("data/") ? clean : "web/" + clean);
    fs.readFile(file, "utf8", (err, data) => {
      if (err) { reject(err); return; }
      resolve({ ok: true, status: 200, json: async () => JSON.parse(data) });
    });
  });
}

const sandbox = {
  document: documentStub,
  window: { scrollTo: () => {} },
  fetch: localFetch,
  Option: OptionCtor,
  console,
  setTimeout,
  clearTimeout,
  alert: (m) => { sandbox._lastAlert = m; },
};
vm.createContext(sandbox);

async function main() {
  console.log("Running real game.js in a sandbox…");
  vm.runInContext(read("web/game.js"), sandbox, { filename: "game.js" });
  await new Promise((r) => setTimeout(r, 200)); // let init() finish (async)

  console.log("\n[1] Data loaded:");
  const b = (expr) => vm.runInContext(expr, sandbox);
  const DATA = b("DATA");
  assert(DATA && DATA.vocab && DATA.verbos && DATA.escenas && DATA.frases, "all 4 data files loaded");

  const vcount = Object.values(DATA.vocab).reduce((n, t) => n + t.words.length, 0);
  console.log("  vocab words:", vcount);
  assert(vcount >= 100, "expanded vocabulary (>=100 words)");

  const levelsSeen = new Set();
  Object.values(DATA.vocab).forEach((t) => t.words.forEach((w) => levelsSeen.add(w.level)));
  for (const want of ["0", "a1", "a2", "b1", "b2", "c1"]) {
    assert(levelsSeen.has(want), `vocab covers level ${want}`);
  }

  console.log("\n[2] normalize():");
  const n = (s) => vm.runInContext(`normalize(${JSON.stringify(s)})`, sandbox);
  assert(n("  ¡Hola, Mundo! ") === "hola mundo", "strip punctuation + accents anywhere");
  assert(n("Salí") === "sali", "salí → sali");
  assert(n("año nuevo") === "ano nuevo", "ñ → n");

  console.log("\n[3] Question builders:");
  // set level range via stub elements
  documentStub._els["level-from"].value = "0";
  documentStub._els["level-to"].value = "c1";

  const vocabItems = b(`buildVocab(DATA.vocab, 10)`);
  assert(vocabItems.length === 10, "buildVocab returns 10 items");
  assert(vocabItems.every((q) => q.prompt && q.answer), "vocab items have prompt+answer");

  const levelZero = b(`(() => { const items=[]; for (const [k,t] of Object.entries(DATA.vocab)) for (const w of t.words) if (w.level==='0') items.push(w); return items.length; })()`);
  assert(levelZero >= 20, `level-0 words available (${levelZero}) for beginners`);

  const conjItems = b(`buildConjugate(DATA.verbos, 10, {group:'presente'})`);
  assert(conjItems.length === 10 && conjItems.every((q) => q.sentence || q.prompt), "presente group quiz builds");
  const subjItems = b(`buildConjugate(DATA.verbos, 5, {group:'subjuntivo'})`);
  assert(subjItems.length === 5, "subjuntivo group quiz builds");

  const lesson = b(`getLesson(DATA.verbos, 'presente')`);
  assert(lesson.length > 50, "presente mini-lesson exists");
  assert(b(`getLesson(DATA.verbos, 'subjuntivo')`).length > 50, "subjuntivo mini-lesson exists");

  const escItems = b(`buildEscenas(DATA.escenas, 8)`);
  assert(escItems.length === 8 && escItems.every((q) => q.options && q.context), "scenes quiz builds with context");
  const sceneCount = b(`DATA.escenas.escenas.length`);
  assert(sceneCount >= 12, `expanded scene bank (${sceneCount} scenes)`);

  const tradItems = b(`buildTrad(DATA.frases, 6)`);
  assert(tradItems.length === 6, "translation quiz builds");
  assert(b(`DATA.frases.frases.length`) >= 25, `expanded phrase bank (${b(`DATA.frases.frases.length`)})`);

  console.log("\n[4] Learn mode:");
  const cards = b(`buildLearnCards(DATA.vocab, {theme:'all'})`);
  assert(cards.length >= 20 && cards.every((c) => c.es && c.en && c.ej), `flashcards built with example sentences (got ${cards.length})`);
  const themeCards = b(`buildLearnCards(DATA.vocab, {theme:'comida'})`);
  assert(themeCards.every((c) => c.theme === "Comida y bebidas"), "theme filter works");

  // full learn session: 3 cards, all known → quiz
  b(`startLearn(3)`);
  for (let i = 0; i < 3; i++) {
    b(`flipCard()`);
    b(`cardDone(true)`);
  }
  const learnQuiz = b(`startLearnQuiz()`);
 assert(b("current") && b("current").items.length >= 3, "learn session starts a quiz on learned words");
 assert(b("current.mode") === "aprender", "learn quiz flagged as aprender mode");
 // answer all correctly to verify scoring path
 for (let i = 0; i < b("current.items.length"); i++) {
   documentStub._els["open-input"].value = b(`current.items[${i}].answer`);
   b(`checkOpen()`);
   if (b("current.lives") > 0) b(`next()`);
 }
 assert(b("current.score") >= 30, `scoring works in learn quiz (score=${b("current.score")})`);
  assert(documentStub._els["screen-results"].classList.contains("hidden") === false, "results screen shown at end");

  console.log("\n[5] Conjugation lesson → quiz flow:");
  documentStub.getElementById("conj-group").value = "preterito";
  b(`startMode('conjugar', 5)`);
  // preterito has no lesson → should jump straight to quiz
  assert(!documentStub.getElementById("screen-play").classList.contains("hidden"), "preterito quiz starts (no lesson)");
  b(`startMode('conjugar', 5)`);
  assert(!documentStub.getElementById("screen-play").classList.contains("hidden"), "replay works");

  documentStub.getElementById("conj-group").value = "presente";
  b(`startMode('conjugar', 5)`);
  assert(!documentStub.getElementById("screen-lesson").classList.contains("hidden"), "presente shows lesson first");
  assert(documentStub.getElementById("lesson-text").textContent.length > 50, "lesson text rendered");
  const btnStart = documentStub.getElementById("btn-lesson-start");
  const startHandlers = btnStart._listeners["click"] || [];
  assert(startHandlers.length === 1, "lesson start button wired");
  startHandlers[0]();
  assert(!documentStub.getElementById("screen-play").classList.contains("hidden"), "lesson start → quiz begins");

  console.log("\n[6] Level filter:");
  documentStub.getElementById("level-from").value = "b1";
  documentStub.getElementById("level-to").value = "c1";
  const adv = b(`buildEscenas(DATA.escenas, 50)`);
  assert(adv.length > 0 && adv.every((q) => ["b1", "b2", "c1"].includes((q.meta.match(/nivel (\S+)/) || [])[1])), "b1→c1 filter works for scenes");
  documentStub.getElementById("level-from").value = "0";
  documentStub.getElementById("level-to").value = "a1";
  const beg = b(`buildVocab(DATA.vocab, 100)`);
  assert(beg.length > 0 && beg.every((q) => (q.meta.match(/nivel (\S+)/) || [])[1] !== undefined), "0→a1 filter returns items");
  documentStub.getElementById("level-from").value = "0";
  documentStub.getElementById("level-to").value = "c1";

  console.log(failures === 0 ? "\n✅ ALL WEB TESTS PASSED" : `\n❌ ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
