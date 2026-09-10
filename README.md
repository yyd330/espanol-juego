# 🇲🇽 Español Juego

A **web** Spanish learning game for a Latin American (Mexican) dialect learner at
A2 → B2 level. Play it in any browser — on your laptop, phone, or tablet — from your
own Wi-Fi, or anywhere it's hosted.

## 📱 Play in your browser

The game is plain **HTML + CSS + JavaScript** (no build step, no dependencies). Two ways to run it:

### Option A — serve it on your local network (phones + laptops on the same Wi-Fi)
```bash
cd espanol-juego
python3 serve.py            # default port 8321
#   python3 serve.py 9000   # custom port
```
It prints a URL like `http://192.168.1.241:8321/web/`. Open that on any device on the
same network. Only needs `python3` (standard library). Stop with **Ctrl+C**.

> If a phone can't connect: check that the machine's firewall allows the port, and that
> the phone and machine are on the same Wi-Fi. The printed IP is your machine's LAN address.

### Option B — just open the file
`web/index.html` works directly: the `data/*.json` files load via `fetch` relative to the
page, so opening the file from a browser that allows local `fetch` (or a quick
`python3 -m http.server` in the repo root) is enough to play on one machine.

## 🎮 The game

- **4 modes** + full game:
  - 📖 **Vocabulario** — thematic ES↔EN (food, travel, work, health; A2→B2)
  - ✍️ **Conjugación** — pretérito / imperfecto / pretérito-vs-imperfecto, Mexican forms
    (`salí`, not "he salido")
  - 📚 **Escenas** — short scenario passages + reading comprehension (A2→B2)
  - 🔄 **Traducción** — everyday phrases EN↔ES
- **Rules:** 3 lives ❤️❤️❤️, +10 per correct, streak bonus (+10 every 5 in a row),
  score tiers Novato → Intermedio → Avanzado → Bilingüe
- **Accent-insensitive** checking — `salió` / `salio`, `ñ`/`n`, punctuation all accepted,
  so typing on a phone keyboard never penalizes you
- Mobile-friendly layout (works in portrait on a phone)

## 📂 Content (edit freely)

The questions come from four JSON banks — add entries and reload the page, the game
picks them up automatically:

| File | Feeds |
|---|---|
| `data/vocabularios.json` | Vocabulario (thematic words, level-tagged) |
| `data/verbos.json` | Conjugación (preterite / imperfect / mixed) |
| `data/escenas.json` | Escenas (passage + multiple-choice questions) |
| `data/frases.json` | Traducción (phrase pairs) |

This JSON content bank is the seed for the monetizable shape: a web/mobile app
(flashcards + conjugation drills + XP/leaderboard) consumes the exact same files.

## 🕹️ Terminal mode (bonus)

Also playable offline in the terminal:
```bash
python3 main.py            # full game
python3 main.py vocab quick
python3 main.py conjugar
```

## 🧪 Tests

```bash
python3 -m pytest -q     # terminal engine + data integrity
node tests/test_web.js   # web game logic (runs the real game.js against real JSON)
```
