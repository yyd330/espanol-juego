# Español Juego 🇲🇽

A Spanish **learning** game (not just a quiz) for Mexican/Latin American Spanish.
**Teach first, then quiz.** Levels **0 → C1** — absolute beginners to advanced.

**Zero Python. Zero frameworks.** Two ways to play, sharing one content bank:

| Version | Tech | How to play |
|---|---|---|
| 🌐 **Web** | HTML + CSS + JS (vanilla) | `./serve.sh` → open on any phone/laptop in your Wi-Fi |
| 💻 **Terminal** | pure bash + jq | `./juego.sh` |

No build step, no dependencies beyond `gcc` (web) and `jq` (terminal).

---

## 🌐 Web game (recommended)

```bash
cd espanol-juego
./serve.sh            # compiles serve/serve.c with gcc, listens on :8321
```

It prints a LAN URL like `http://192.168.1.241:8321/web/` — open it on your
phone, tablet, or laptop (same Wi-Fi). `serve.sh` is shell; if no `gcc` is
found it falls back to `busybox httpd` (static files only).

### Modes
- **📚 Aprender** — flashcards first (word → flip → meaning + example
  sentence), then an **automatic quiz on exactly what you just studied**.
- **🗣️ Vocabulario** — quiz by theme + level range.
- **⏳ Conjugar** — a **mini-lesson** on the tense group (ser/ir, pretérito,
  imperfecto, condicional, subjuntivo…) is shown *before* the quiz starts.
- **🎬 Escenas** — short real dialogues (taquería, pharmacy, airport, job
  interview…) with reading-comprehension questions.
- **↔️ Traducir** — phrases, Spanish → English.

### Game rules
- 10 points per correct answer, 3 lives, streak of 5 → +10 bonus.
- Accent- and punctuation-insensitive typing (`salio` matches `salió`) —
  phone-friendly.
- Pick your level range (0, a1, a2, b1, b2, c1) and round size (5 or 10).
- Score tiers: Novato → Intermedio → Avanzado → Bilingüe.

## 💻 Terminal game

```bash
./juego.sh            # interactive menu
./juego.sh aprender comida        # flashcards + quiz on one theme
./juego.sh vocab 0 a1            # straight vocab quiz, levels 0→A1
./juego.sh conjugar presente     # mini-lesson + conjugation quiz
./juego.sh escenas 0 c1
./juego.sh trad a2 b2
```

Requires `bash` 4+ and `jq` (`apt install jq` / `brew install jq`).

---

## Content bank (`data/*.json` — shared by both versions)

| File | Size | Coverage |
|---|---|---|
| `vocabularios.json` | 154 words, 11 themes | 0→C1, every word has an example sentence + English gloss |
| `verbos.json` | 60 items, 6 tense groups | present → subjunctive; each group carries a mini-lesson |
| `escenas.json` | 15 dialogues, 62 questions | 0→B2, multiple-choice reading comprehension |
| `frases.json` | 31 survival phrases | 0→B2 |

Mexican-dialect focus: *tacos, pozole, sobremesa, "el metro", "un vaso de
agua"*, pretérito over present perfect (*salí*, not *he salido*), etc.

To add content, edit the JSON files — both versions pick it up on next
start. Keep the schemas:
- vocab: `{theme: {theme_en, theme_es, words: [{es, en, level, ej, ej_en}]}}`
- verbs: `{group: {note, lesson, verbs: [{verb, person, answer, sentence, clue}]}}`
- scenes: `{escenas: [{title, level, texto, questions: [{q, options[], answer}]}]}`
- phrases: `{frases: [{es, en, level}]}`

## Tests

```bash
node tests/test_web.js     # runs the REAL game.js against the REAL JSON (no python)
./serve.sh &  # then: curl -s http://127.0.0.1:8321/web/game.js | head
bash juego.sh trad 0 a1    # smoke-test the terminal loop
```

## Project layout

```
├── serve.sh              # LAN server launcher (shell; compiles C server)
├── serve/serve.c         # tiny static file server (C11, no deps)
├── juego.sh              # terminal game (bash + jq)
├── web/                  # web game: index.html, style.css, game.js
├── data/                 # shared content bank (JSON)
└── tests/test_web.js     # Node vm-sandbox test for web/game.js
```
