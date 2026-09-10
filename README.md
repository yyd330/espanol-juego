# 🇲🇽 Español Juego

A terminal Spanish learning game built for a Latin American (Mexican) dialect learner at
A2 → B2 level. Zero dependencies — just Python 3.8+.

## Why this exists

From the "ways to make money" thread: build something small, sellable, and genuinely
useful. This is the learning tool first — the monetizable shape is a polished web/mobile
spin-off (flashcard + conjugation drills + XP/leaderboard), which this repo's content
bank (JSON data files) feeds directly.

## Play

```bash
python3 main.py            # full game
python3 main.py quick      # quick round (10 questions)
python3 main.py vocab      # vocabulary only
python3 main.py conjugar   # verb conjugation drills
python3 main.py escenas    # scenario / reading comprehension
python3 main.py trad       # translation round
```

## Content

- `data/vocabularios.json` — thematic word banks (A2 → B2)
- `data/verbos.json` — conjugation drill data (preterite/imperfect focus, Mexican forms)
- `data/escenas.json` — short scenario passages with comprehension questions
- `data/frases.json` — everyday phrases for translation practice

Add entries freely — the game picks them up automatically.

## Rules

- 3 lives ❤️❤️❤️ per round; mistakes cost a life
- Streaks (racha) give bonus points: every 5 correct in a row = +10 bonus
- Score tiers: 0-49 Novato · 50-79 Intermedio · 80-119 Avanzado · 120+ Bilingüe
- All feedback is bilingual (ES / EN)
