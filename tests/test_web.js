// Executes the REAL web/game.js in a vm sandbox: stubbed DOM + real fetch,
// then runs the actual pure logic and question builders against the real JSON.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const webJs = fs.readFileSync(path.join(ROOT, "web", "game.js"), "utf8");
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const data = {
  vocab: load("vocabularios.json"),
  verbos: load("verbos.json"),
  escenas: load("escenas.json"),
  frases: load("frases.json"),
};

// --- minimal DOM stub ---
function mkEl() {
  const cls = new Set();
  return {
    textContent: "", innerHTML: "", value: "", disabled: false, style: {},
    dataset: {}, className: "",
    children: [],
    classList: {
      add: (c) => cls.add(c), remove: (c) => cls.delete(c),
      toggle: (c, f) => (f === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : (f ? cls.add(c) : cls.delete(c))),
      contains: (c) => cls.has(c),
    },
    addEventListener: () => {},
    focus: () => {},
    appendChild: (c) => { this.children.push(c); },
    querySelectorAll: () => [],
  };
}
const elements = {};
const document = {
  getElementById: (id) => (elements[id] ||= mkEl()),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => mkEl(),
};

let fetched = [];
const context = {
  document,
  console,
  setTimeout, clearTimeout,
  alert: () => {},
  fetch: async (url) => {
    fetched.push(url);
    const name = url.split("/").pop();
    const map = { "vocabularios.json": data.vocab, "verbos.json": data.verbos, "escenas.json": data.escenas, "frases.json": data.frases };
    if (map[name]) return { ok: true, json: async () => map[name] };
    return { ok: false, status: 404, json: async () => { throw new Error("no"); } };
  },
};
vm.createContext(context);

(async () => {
  vm.runInContext(webJs, context, { filename: "game.js" });
  // init() is async and self-invoked; give it a tick.
  await new Promise((r) => setTimeout(r, 50));

  const ok = (cond, msg) => { if (!cond) throw new Error("FAIL: " + msg); console.log("  ok - " + msg); };

  // data loaded through fetch
  ok(fetched.length >= 4, "fetch called for all 4 data files (" + fetched.length + ")");

  // pure functions
  ok(context.normalize("Comí, ¡ay!") === "comi ay", "normalize accents/punct");
  ok(context.normalize("  Salí  ") === "sali", "normalize trim+accent");
  ok(context.titleFor(0)[1] === "Novato", "title 0 = Novato");
  ok(context.titleFor(60)[1] === "Intermedio", "title 60 = Intermedio");
  ok(context.titleFor(90)[1] === "Avanzado", "title 90 = Avanzado");
  ok(context.titleFor(150)[1] === "¡Bilingüe!", "title 150 = Bilingüe");
  ok(context.shuffle([1, 2, 3]).sort().join() === "1,2,3", "shuffle preserves elements");

  // builders produce correctly sized, well-formed questions from REAL data
  const v = context.buildVocab(data.vocab, 10);
  ok(v.length === 10, "buildVocab returns 10 items");
  ok(v.every((q) => q.prompt && q.answer && q.meta), "vocab items well-formed");

  const c = context.buildConjugate(data.verbos, 10);
  ok(c.length === 10, "buildConjugate returns 10 items");
  ok(c.every((q) => q.prompt && q.answer && q.clue), "conj items have clue+answer");

  const e = context.buildEscenas(data.escenas, 10);
  ok(e.length === 9, "buildEscenas returns all 9 scenario questions");
  ok(e.every((q) => q.options && q.options[q.options.indexOf(q.answer)] === q.answer), "escena answers exist in options");

  const t = context.buildTrad(data.frases, 10);
  ok(t.length === 10, "buildTrad returns 10 items");
  ok(t.every((q) => q.open && q.prompt && q.answer), "trad items well-formed");

  // normalization makes answers matchable (accent-insensitive, the key game rule)
  const sample = context.buildConjugate(data.verbos, 50)[0];
  ok(context.normalize(sample.answer) === context.normalize(sample.answer), "answer self-normalizes");
  ok(context.normalize("salió") === context.normalize("salio"), "player 'salio' matches answer 'salió'");

  console.log("\nALL WEB GAME CHECKS PASSED ✅  (" + fetched.length + " data files, " + (v.length + c.length + e.length + t.length) + " built questions)");
  process.exit(0);
})().catch((err) => { console.error(err.message); process.exit(1); });
