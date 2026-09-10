"""Espanol Juego — terminal game engine (stdlib only)."""
from __future__ import annotations

import json
import random
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

BANNER = r"""
 ____    _ _        _      ____
|  _ \  | (_) ___  | |    / ___|___  _ __ ___
| | | | | | |/ __| | |    | |   / _ \| '_ ` _ \
| |_|_| | | | (__  | |___ | |__| (_) | | | | | |
|____/  |_|_|\___| |_____|\____\___/|_| |_| |_|
        JUEGO — A2 → B2, acento mexicano
"""

LIVES_MAX = 3
STREAK_BONUS_EVERY = 5
STREAK_BONUS = 10

TITLES = [
    (0, "Novato (beginner)"),
    (50, "Intermedio (intermediate)"),
    (80, "Avanzado (advanced)"),
    (120, "¡Bilingüe! (bilingual)"),
]


def title_for(score: int) -> str:
    label = TITLES[0][1]
    for threshold, t in TITLES:
        if score >= threshold:
            label = t
    return label


def normalize(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[.,!?\s]+$", "", text)
    for a, b in [
        ("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ü", "u"),
        ("ñ", "n"), ("¿", ""), ("¡", ""),
    ]:
        text = text.replace(a, b)
    return text


def load_json(name: str):
    path = DATA_DIR / name
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"  ⚠️  {path.name}: JSON inválido — {exc}")
        return None


class Game:
    def __init__(self, round_size: int = 10):
        self.round_size = round_size
        self.score = 0
        self.lives = LIVES_MAX
        self.streak = 0
        self.correct = 0
        self.wrong = 0

    def _feedback(self, correct: bool, correct_answer: str, your_answer: str = ""):
        if correct:
            self.score += 10
            self.correct += 1
            self.streak += 1
            if self.streak % STREAK_BONUS_EVERY == 0:
                self.score += STREAK_BONUS
                print(f"  🔥 ¡Racha de {self.streak}! +{STREAK_BONUS} bono")
            print("  ✅ ¡Correcto! +10\n")
        else:
            self.lives -= 1
            self.wrong += 1
            self.streak = 0
            shown = f" (tú: {your_answer})" if your_answer else ""
            print(f"  ❌ Incorrecto{shown}.  Respuesta: {correct_answer}")
            print(f"     ❤️ × {self.lives} restantes\n")

    def play(self, items):
        """Run a round of question items (dicts with 'prompt','answer','options' or 'open')."""
        items = list(items)
        random.shuffle(items)
        items = items[: self.round_size]
        if not items:
            print("  (no hay datos para este modo todavía — añade entradas a data/)")
            return
        print(f"\n  — Ronda: {len(items)} preguntas, {LIVES_MAX} vidas —\n")
        for i, item in enumerate(items, 1):
            if self.lives <= 0:
                break
            print(f"  [{i}/{len(items)}] {item['prompt']}")
            if item.get("options"):
                for j, opt in enumerate(item["options"], 1):
                    print(f"       {j}. {opt}")
                ans = self._input("  Tu respuesta (1-%d): " % len(item["options"]))
                if ans.isdigit() and 1 <= int(ans) <= len(item["options"]):
                    chosen = item["options"][int(ans) - 1]
                    ok = normalize(chosen) == normalize(item["answer"])
                else:
                    chosen = ans
                    ok = False
            else:
                ans = self._input("  Tu respuesta: ")
                chosen = ans
                ok = normalize(ans) == normalize(item["answer"])
            self._feedback(ok, item["answer"], chosen if not ok else "")
        self._summary()

    @staticmethod
    def _input(prompt: str) -> str:
        try:
            return input(prompt)
        except (EOFError, KeyboardInterrupt):
            print()
            raise

    def _summary(self):
        total = self.correct + self.wrong
        pct = (100 * self.correct // total) if total else 0
        print("=" * 46)
        print(f"  Puntaje final: {self.score}")
        print(f"  Correctas: {self.correct} / {total}  ({pct}%)")
        print(f"  Título: {title_for(self.score)}")
        print("=" * 46 + "\n")


# ---------------------------------------------------------------- modes

def mode_vocab(round_size: int) -> Game:
    data = load_json("vocabularios.json") or {}
    items = []
    for theme in data.values():
        for w in theme.get("words", []):
            items.append(
                {
                    "prompt": f"📖 ({theme['theme_en']}) ¿Qué significa en inglés:  «{w['es']}»?",
                    "answer": w["en"],
                    "open": True,
                }
            )
            items.append(
                {
                    "prompt": f"📖 ({theme['theme_es']}) ¿Cómo se dice en español:  «{w['en']}»?",
                    "answer": w["es"],
                    "open": True,
                }
            )
    game = Game(round_size)
    game.play(items)
    return game


def mode_conjugate(round_size: int) -> Game:
    data = load_json("verbos.json") or {}
    items = []
    sections = [data.get("verbs", []), (data.get("imperfect") or {}).get("verbs", []),
                (data.get("mixto") or {}).get("verbs", [])]
    labels = ["pretérito", "imperfecto", "pretérito vs imperfecto"]
    for verbs, label in zip(sections, labels):
        for v in verbs:
            items.append(
                {
                    "prompt": f"✍️  ({label}, {v['person']}) {v['sentence']}\n      Pista: {v['clue']}",
                    "answer": v["answer"],
                    "open": True,
                }
            )
    game = Game(round_size)
    game.play(items)
    return game


def mode_escenas(round_size: int) -> Game:
    data = load_json("escenas.json") or {}
    items = []
    for esc in data.get("escenas", []):
        for q in esc.get("questions", []):
            items.append(
                {
                    "prompt": f"📚 «{esc['title']}» (nivel {esc['level']})\n{q['q']}",
                    "answer": q["options"][q["answer"]],
                    "options": q["options"],
                }
            )
    game = Game(round_size)
    game.play(items)
    return game


def mode_trad(round_size: int) -> Game:
    data = load_json("frases.json") or {}
    items = []
    for f in data.get("frases", []):
        items.append(
            {
                "prompt": f"🔄 Traduce al español:  «{f['en']}»",
                "answer": f["es"],
                "open": True,
            }
        )
        items.append(
            {
                "prompt": f"🔄 Traduce al inglés:  «{f['es']}»",
                "answer": f["en"],
                "open": True,
            }
        )
    game = Game(round_size)
    game.play(items)
    return game


MODES = {
    "vocab": ("Vocabulario", mode_vocab),
    "conjugar": ("Conjugación", mode_conjugate),
    "escenas": ("Escenas (lectura)", mode_escenas),
    "trad": ("Traducción", mode_trad),
}


def play_all(round_size: int) -> None:
    grand = Game(round_size)
    grand.score, grand.lives, grand.streak = 0, LIVES_MAX, 0
    grand.correct, grand.wrong = 0, 0
    for name, (label, fn) in MODES.items():
        print("\n" + "█" * 46)
        print(f"  MODO: {label.upper()}")
        print("█" * 46)
        game = fn(round_size)
        grand.score += game.score
        grand.correct += game.correct
        grand.wrong += game.wrong
        grand.lives = 0  # fresh lives per mode already handled inside
    grand.lives = LIVES_MAX
    total = grand.correct + grand.wrong
    pct = (100 * grand.correct // total) if total else 0
    print("=" * 46)
    print(f"  🏆 Puntaje TOTAL: {grand.score}")
    print(f"  Correctas: {grand.correct} / {total}  ({pct}%)")
    print(f"  Título final: {title_for(grand.score)}")
    print("=" * 46)


def main(argv):
    print(BANNER)
    args = [a.lower() for a in argv]
    round_size = 10
    if "quick" in args:
        round_size = 5
        args.remove("quick")
    if not args:
        try:
            play_all(round_size)
        except (EOFError, KeyboardInterrupt):
            print("\n  ⏹  Ronda interrumpida — hasta la próxima, ¡buen provecho! (round cut off — see you next time)")
        return
    if args[0] in MODES:
        try:
            MODES[args[0]][1](round_size)
        except (EOFError, KeyboardInterrupt):
            print("\n  ⏹  Ronda interrumpida — hasta la próxima, ¡buen provecho! (round cut off — see you next time)")
    else:
        print("  Modos disponibles:")
        for name, (label, _) in MODES.items():
            print(f"    python3 main.py {name:<9} — {label}")
        print("    python3 main.py <modo> quick   — 5 preguntas")
        sys.exit(1)
