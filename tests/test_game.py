"""Tests for the game engine + data files. Run: python3 -m pytest -q (or python3 tests/test_game.py)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from engine import Game, normalize, title_for, load_json, LIVES_MAX


def test_normalize_strips_accents_and_punctuation():
    assert normalize("Comí, ay!") == "comi, ay"  # trailing punctuation stripped
    assert normalize("  Salí  ") == "sali"
    assert normalize("¿Dónde?") == "donde"


def test_title_tiers():
    assert "Novato" in title_for(0)
    assert "Intermedio" in title_for(60)
    assert "Avanzado" in title_for(90)
    assert "Biling" in title_for(150)


def test_data_files_valid():
    for name, key in [
        ("vocabularios.json", None),
        ("verbos.json", "verbs"),
        ("escenas.json", "escenas"),
        ("frases.json", "frases"),
    ]:
        data = load_json(name)
        assert data is not None, f"{name} failed to load"
        if key:
            assert len(data[key]) >= 3, f"{name}:{key} too small"


def test_vocabulary_entries_well_formed():
    data = load_json("vocabularios.json")
    count = 0
    for theme in data.values():
        assert "theme_en" in theme and "theme_es" in theme
        for w in theme["words"]:
            assert w["es"] and w["en"]
            assert w["level"] in ("a2", "b1", "b2")
            count += 1
    assert count >= 20


def test_conjugation_answers_nonempty():
    data = load_json("verbos.json")
    groups = [data["verbs"], data["imperfect"]["verbs"], data["mixto"]["verbs"]]
    for verbs in groups:
        for v in verbs:
            assert v["answer"].strip(), f"empty answer in {v}"
            assert v["person"]
            assert v["sentence"]


def test_escenas_answers_index_in_range():
    data = load_json("escenas.json")
    for esc in data["escenas"]:
        for q in esc["questions"]:
            assert 0 <= q["answer"] < len(q["options"])


def test_game_scoring_and_lives():
    game = Game(round_size=10)
    game._feedback(correct=True, correct_answer="x")
    game._feedback(correct=True, correct_answer="x")
    assert game.score == 20 and game.correct == 2 and game.streak == 2
    game._feedback(correct=False, correct_answer="x", your_answer="y")
    assert game.lives == LIVES_MAX - 1 and game.streak == 0
    # streak bonus: 5 in a row
    for _ in range(STREAK_NEEDED):
        game._feedback(correct=True, correct_answer="x")
    assert game.score == 20 + STREAK_NEEDED * 10 + STREAK_BONUS


STREAK_NEEDED = 5
STREAK_BONUS = 10


def test_play_round_short_circuits_on_zero_lives():
    game = Game(round_size=10)
    game.lives = 0
    items = [{"prompt": "p", "answer": "a", "open": True}]
    # play() should break immediately, not ask input
    game.play(items)
    assert game.correct + game.wrong == 0


def test_data_counts():
    frases = load_json("frases.json")["frases"]
    assert len(frases) >= 8
    for f in frases:
        assert f["es"] and f["en"]
