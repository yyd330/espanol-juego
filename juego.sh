#!/usr/bin/env bash
# Español Juego — terminal version. Pure bash + jq. NO Python.
#
#   ./juego.sh                  # menu (pick mode + level range)
#   ./juego.sh vocab 0 a1       # jump straight: mode [level-from level-to]
#   ./juego.sh learn comida     # learn flashcards for a theme, then quiz
#   ./juego.sh conjugar presente
#   ./juego.sh escenas | trad | quiz
#
# Modes:  vocab | conjugar | escenas | trad | aprender | learn
#   aprender = teach-first: flashcards (word → meaning + example) → auto quiz
#   vocab/conjugar/escenas/trad = straight quiz (conjugar shows a mini-lesson)
#
# Requires: bash 4+, jq (brew install jq / apt install jq)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$ROOT/data"
QUIZ_N=10

command -v jq >/dev/null || { echo "ERROR: jq is required (brew install jq | apt install jq)."; exit 1; }
for f in vocabularios.json verbos.json escenas.json frases.json; do
  [[ -f "$DATA/$f" ]] || { echo "ERROR: missing data/$f (run from repo root)."; exit 1; }
done

# ---------- helpers ----------
norm() {  # accent/punctuation-insensitive comparison key
  local s="$1"
  s="${s,,}"                                   # lowercase
  s=${s//á/a}; s=${s//é/e}; s=${s//í/i}; s=${s//ó/o}; s=${s//ú/u}; s=${s//ü/u}
  s=${s//ñ/n}
  s=${s//[.,!?¿¡;:()]/ }                       # punctuation → space
  s=$(echo "$s" | tr -s ' ')                   # squeeze spaces
  echo "${s#"${s%%[![:space:]]*}"}${s%"${s##*[![:space:]]}"}"  # trim
}

shuf_pick() {  # shuffle $1 (newline list), take $2
  echo "$1" | shuf | head -n "$2"
}

ask() {  # ask() prompt var — read one line (stdin)
  read -r -p "$1" "$2" || true
}

show_lesson() {  # print a mini-lesson if the verb group has one
  local group="$1" lesson
  lesson=$(jq -r --arg g "$group" '.[$g].lesson // empty' "$DATA/verbos.json")
  if [[ -n "$lesson" ]]; then
    echo
    echo "── LECCIÓN RÁPIDA ─────────────────────────────"
    echo "$lesson"
    echo "────────────────────────────────────────────────"
    echo
    read -r -p "Presiona Enter para empezar el quiz… " _|| true
  fi
}

# ---------- flashcards (learn first) ----------
flashcards() {  # args = NDJSON lines
  local -a cards=()
  local line es en ej ejen i n
  for line in "$@"; do
    es=$(jq -r '.es' <<<"$line"); en=$(jq -r '.en' <<<"$line")
    ej=$(jq -r '.ej // empty' <<<"$line"); ejen=$(jq -r '.ej_en // empty' <<<"$line")
    cards+=("$es"$'\t'"$en"$'\t'"$ej"$'\t'"$ejen")
  done
  n=${#cards[@]}
  echo
  echo "═══ APRENDER: memoriza y marca si la conocías ═══"
  for i in "${!cards[@]}"; do
    IFS=$'\t' read -r es en ej ejen <<< "${cards[$i]}"
    echo
    echo "  Carta $((i+1)) de $n"
    echo "  🇲🇽  $es"
    read -r -p "  ¿Qué significa? (Enter para ver)" _|| true
    echo "  🇺🇸  $en"
    [[ -n "$ej" ]] && { echo "  ej:  $ej"; [[ -n "$ejen" ]] && echo "      $ejen"; }
    read -r -p "  ¿La conocías? (s = sí / n = no) " _|| true
  done
  echo
  echo "¡Listo! Ahora un quiz solo con estas ${n} palabras…"
  echo
}

# ---------- one quiz round ----------
# args = NDJSON lines: {prompt, answer, meta}
play() {
  local n=$# score=0 lives=3 streak=0 correct=0 prompt answer meta guess line
  echo
  echo "═══ QUIZ: ${n} preguntas · 3 vidas · +10 pts · racha x5 = +10 bonus ═══"
  local idx=0
  for line in "$@"; do
    idx=$((idx+1))
    prompt=$(jq -r '.prompt' <<<"$line")
    answer=$(jq -r '.answer' <<<"$line")
    meta=$(jq -r '.meta // empty' <<<"$line")
    echo
    echo "  [${idx}/${n}]${meta:+ ($meta)}"
    printf '%b\n' "$prompt"
    read -r -p "  Tu respuesta > " guess|| true
    if [[ -n "$guess" && "$(norm "$guess")" == "$(norm "$answer")" ]]; then
      score=$((score+10)); streak=$((streak+1)); correct=$((correct+1))
      if (( streak == 5 )); then score=$((score+10)); echo "  🔥 ¡Racha de 5! +10 bonus"; fi
      echo "  ✅ ¡Correcto! ($answer)"
    else
      lives=$((lives-1)); streak=0
      echo "  ❌ Respuesta correcta: $answer   (vidas: $lives)"
      if (( lives == 0 )); then echo; echo "  💀 Sin vidas — fin de la ronda."; break; fi
    fi
  done
  local tier="Novato"
  if   (( score >= 120 )); then tier="Bilingüe 🌎"
  elif (( score >= 80  )); then tier="Avanzado 📈"
  elif (( score >= 40  )); then tier="Intermedio 📗"
  fi
  echo
  echo "════════ RESULTADO ════════"
  echo "  Puntos: $score · Aciertos: $correct/$n · Nivel: $tier"
  echo "  🏆 ¡Buen trabajo! (¡Buen trabajo!)"
  echo "═══════════════════════════"
}

# ---------- question builders (jq → NDJSON; bash shuffles) ----------
# Each builder emits one JSON object per question: {prompt, answer, meta}
q_vocab() {  # $1 from $2 to level
  jq -c --arg from "$1" --arg to "$2" '
    [ .[] | .words[] | select(.level >= $from and .level <= $to) ]
    | .[] | {prompt: (.es + "  →  (¿en inglés?)"), answer: .en, meta: ("vocab nivel " + .level)}
  ' "$DATA/vocabularios.json" | shuf | head -n "$QUIZ_N"
}
q_conjugar() {  # $1 group
  jq -c --arg g "$1" '
    .[$g].verbs[]
    | {prompt: (.sentence + "\n  (" + (.clue // "") + ")"), answer: .answer, meta: "conjugar"}
  ' "$DATA/verbos.json" | shuf | head -n "$QUIZ_N"
}
q_escenas() {  # multiple-choice reading comprehension, one Q per scene
  jq -c --arg from "$1" --arg to "$2" '
    [ .escenas[] | select(.level >= $from and .level <= $to) ]
    | .[] | . as $s | $s.questions[0]
    | {prompt: ($s.texto + "\n\n  " + .q + "\n  " + ([.options[] | tostring] | join("\n  ")) + "\n  (responde con el texto de la opción)"),
       answer: .options[.answer],
       meta: ("escena · nivel " + $s.level)}
  ' "$DATA/escenas.json" | shuf | head -n "$QUIZ_N"
}
q_trad() {
  jq -c --arg from "$1" --arg to "$2" '
    [ .frases[] | select(.level >= $from and .level <= $to) ]
    | .[] | {prompt: (.es + "  →  (¿a inglés?)"), answer: .en, meta: ("trad nivel " + .level)}
  ' "$DATA/frases.json" | shuf | head -n "$QUIZ_N"
}

# ---------- learn mode: teach, then quiz on the same words ----------
mode_learn() {  # $1 theme (or "all")
  local theme="${1:-all}" cards
  if [[ "$theme" == "all" ]]; then
    cards=$(jq -c '
      [ .[] | .words[] | {es: .es, en: .en, ej: (.ej // ""), ej_en: (.ej_en // "")} ]
      | .[]
    ' "$DATA/vocabularios.json" | shuf | head -n 10)
  else
    cards=$(jq -c --arg t "$theme" '
      [ .[$t].words[] | {es: .es, en: .en, ej: (.ej // ""), ej_en: (.ej_en // "")} ]
      | .[]
    ' "$DATA/vocabularios.json" | shuf | head -n 10)
  fi
  local -a lines=()
  mapfile -t lines <<<"$cards"
  flashcards "${lines[@]}"
  local -a quiz=()
  mapfile -t quiz < <(echo "$cards" | jq -c '{prompt: (.es + "  →  (¿en inglés?)"), answer: .en, meta: "aprender (lo que acabas de ver)"}')
  play "${quiz[@]}"
}

# ---------- menu ----------
menu() {
  local themes
  themes=$(jq -r 'keys_unsorted[]' "$DATA/vocabularios.json" | head -20)
  echo
  echo "════════════════════════════════════════"
  echo "  🇲🇽 ESPAÑOL JUEGO — terminal (bash + jq)"
  echo "  Diálogos en español · niveles 0 → C1"
  echo "════════════════════════════════════════"
  echo
  echo "  Temas disponibles (para aprender):"
  echo "    $(echo "$themes" | tr '\n' ' ')"
  echo
  echo "  1) aprender    — flashcards PRIMERO, luego quiz (recomendado)"
  echo "  2) vocab       — quiz de vocabulario"
  echo "  3) conjugar    — mini-lección + quiz de verbos"
  echo "  4) escenas     — comprensión de lectura (diálogos)"
  echo "  5) trad        — frases: español → inglés"
  echo "  0) salir"
  echo
  local choice from to theme grp
  read -r -p "Elige modo [1-5] > " choice || exit 0
  read -r -p "Nivel desde (0, a1, a2, b1, b2, c1) [0] > " from; from="${from:-0}"
  read -r -p "Nivel hasta (0, a1, a2, b1, b2, c1) [c1] > " to; to="${to:-c1}"

  local -a qs cards
  case "$choice" in
    1) read -r -p "Tema (todos = 'all') > " theme; mode_learn "${theme:-all}" ;;
    2) mapfile -t qs < <(q_vocab "$from" "$to");  play "${qs[@]}" ;;
    3) read -r -p "Grupo: presente, preterito(=verbs), imperfect, mixto, condicional, subjuntivo > " grp
       show_lesson "${grp:-presente}"
       mapfile -t qs < <(q_conjugar "${grp:-presente}")
       play "${qs[@]}" ;;
    4) mapfile -t qs < <(q_escenas "$from" "$to"); play "${qs[@]}" ;;
    5) mapfile -t qs < <(q_trad "$from" "$to");    play "${qs[@]}" ;;
    0) echo "¡Hasta luego! 👋" ;;
    *) echo "Opción no válida." ;;
  esac
}

# ---------- dispatch ----------
MODE="${1:-menu}"
qs=()
case "$MODE" in
  menu) menu ;;
  aprender|learn) mode_learn "${2:-all}" ;;
  vocab)  mapfile -t qs < <(q_vocab "${2:-0}" "${3:-c1}");    play "${qs[@]}" ;;
  conjugar) show_lesson "${2:-presente}";
            mapfile -t qs < <(q_conjugar "${2:-presente}");   play "${qs[@]}" ;;
  escenas) mapfile -t qs < <(q_escenas "${2:-0}" "${3:-c1}"); play "${qs[@]}" ;;
  trad)   mapfile -t qs < <(q_trad "${2:-0}" "${3:-c1}");     play "${qs[@]}" ;;
  quick)  QUIZ_N=5; shift; "$0" "$@" ;;
  -h|--help) sed -n '2,20p' "$0" ;;
  *) echo "Modo desconocido: $MODE  (usa --help)"; exit 1 ;;
esac
