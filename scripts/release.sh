#!/usr/bin/env bash
# リリース前チェック → 任意でコミット → 任意で push（origin main）→ 任意で Vercel 明示デプロイ
#
# 使い方:
#   ./scripts/release.sh
#   ./scripts/release.sh --commit "feat: something"
#   ./scripts/release.sh --commit "feat: something" --push
#   ./scripts/release.sh --deploy
#   ./scripts/release.sh --ship
#     → チェック後、ファイル名・領域付きの自動コミット（本文にパス一覧）、main を push（Vercel 自動デプロイ）

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMMIT_MSG=""
DO_DEPLOY=false
DO_PUSH=false
DO_SHIP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit)
      COMMIT_MSG="${2:-}"
      if [[ -z "$COMMIT_MSG" ]]; then echo "error: --commit needs a message"; exit 1; fi
      shift 2
      ;;
    --deploy)
      DO_DEPLOY=true
      shift
      ;;
    --push)
      DO_PUSH=true
      shift
      ;;
    --ship)
      DO_SHIP=true
      DO_PUSH=true
      shift
      ;;
    -h|--help)
      cat <<EOF
Usage: $0 [options]

  (no args)     tsc, build, secret scan のみ
  --ship        上記のあと、ファイル名・領域付き自動コミット（本文にパス一覧）→ push main
  --commit MSG  手動メッセージでコミット（チェック通過後）
  --push        --commit または --ship と併用。origin main へ push（ローカルブランチは main 必須）
  --deploy      Vercel 本番デプロイのみ（チェック通過後）

例:
  $0
  $0 --commit "fix: typo" --push
  $0 --ship
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (use --help)"
      exit 1
      ;;
  esac
done

if [[ "$DO_SHIP" == true && -n "$COMMIT_MSG" ]]; then
  echo "error: --ship と --commit は同時に使えません"
  exit 1
fi

if [[ "$DO_PUSH" == true && "$DO_SHIP" == false && -z "$COMMIT_MSG" ]]; then
  echo "error: --push は --commit または --ship と併用してください"
  exit 1
fi

generate_auto_commit_subject() {
  local files=() line n prefix scope
  while IFS= read -r line; do
    [[ -n "$line" ]] && files+=("$line")
  done < <(git diff --cached --name-only)
  n=${#files[@]}
  if [[ "$n" -eq 0 ]]; then
    echo ""
    return 1
  fi

  local all_md=true
  local has_ui=false has_api=false has_cron=false has_ci=false
  for line in "${files[@]}"; do
    [[ "$line" == *.md ]] || all_md=false
    case "$line" in
      app/*.tsx|components/*|app/globals.css|tailwind.config.ts) has_ui=true ;;
      app/api/*|lib/*) has_api=true ;;
      cron/*) has_cron=true ;;
      scripts/*|.github/*|vercel.json|next.config.ts) has_ci=true ;;
    esac
  done

  local areas=0
  [[ "$has_ui" == true ]] && areas=$((areas + 1))
  [[ "$has_api" == true ]] && areas=$((areas + 1))
  [[ "$has_cron" == true ]] && areas=$((areas + 1))
  [[ "$has_ci" == true ]] && areas=$((areas + 1))

  if [[ "$all_md" == true ]]; then
    prefix="docs"
    scope=""
  elif [[ "$areas" -gt 1 ]]; then
    prefix="chore"
    scope=""
  elif [[ "$has_ui" == true ]]; then
    prefix="chore"
    scope="ui"
  elif [[ "$has_api" == true ]]; then
    prefix="chore"
    scope="api"
  elif [[ "$has_cron" == true ]]; then
    prefix="chore"
    scope="cron"
  elif [[ "$has_ci" == true ]]; then
    prefix="chore"
    scope="ci"
  else
    prefix="chore"
    scope=""
  fi

  local names=()
  local seen="|"
  for line in "${files[@]}"; do
    local base
    base="$(basename "$line")"
    case "$seen" in
      *"|${base}|"*) continue ;;
    esac
    seen="${seen}${base}|"
    names+=("$base")
  done
  local namepart="" extra=""
  local maxnames=3
  local u=${#names[@]}
  local parts=() i=0
  for name in "${names[@]}"; do
    [[ "$i" -ge "$maxnames" ]] && break
    parts+=("$name")
    i=$((i + 1))
  done
  if [[ ${#parts[@]} -gt 0 ]]; then
    namepart=$(printf '%s, ' "${parts[@]}" | sed 's/, $//')
  else
    namepart="(no basename)"
  fi
  if [[ "$u" -gt "$maxnames" ]]; then
    extra=" (+$(( u - maxnames )) more)"
  fi

  local subject
  if [[ -n "$scope" ]]; then
    subject="${prefix}(${scope}): ${namepart}${extra}"
  else
    subject="${prefix}: ${namepart}${extra}"
  fi

  if [[ ${#subject} -gt 72 ]]; then
    subject="${subject:0:69}..."
  fi
  echo "$subject"
}

generate_auto_commit_body() {
  local n
  n=$(git diff --cached --name-only | wc -l | tr -d ' ')
  if [[ "$n" -eq 0 ]]; then
    return 1
  fi
  echo "Changed paths (${n}):"
  git diff --cached --name-only | sed 's/^/- /'
  echo ""
  echo "For intent/background in history, prefer: ./scripts/release.sh --commit \"fix(api): …\" --push"
}

assert_on_main_branch() {
  local cur
  cur="$(git branch --show-current)"
  if [[ "$cur" != "main" ]]; then
    echo "ERROR: push は main ブランチでのみ実行してください（現在: ${cur}）。git switch main してから再実行してください。"
    exit 1
  fi
}

echo "==> 1/3 TypeScript"
npx tsc --noEmit

echo "==> 2/3 production build"
npm run build

echo "==> 3/3 秘密情報チェック（ヒューリスティック）"
FOUND=0
while IFS= read -r -d '' f; do
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf) continue ;;
  esac
  if grep -qE '(ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]+|glpat-[a-zA-Z0-9_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35})' "$f" 2>/dev/null; then
    echo "  疑わしいパターン: $f"
    grep -nE '(ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]+|glpat-[a-zA-Z0-9_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35})' "$f" || true
    FOUND=1
  fi
done < <(git ls-files -z)

if [[ "$FOUND" -ne 0 ]]; then
  echo "ERROR: 上記を修正するか、ローカルメモからトークンを削除してから再実行してください。"
  exit 1
fi

if [[ -n "$COMMIT_MSG" ]] || [[ "$DO_SHIP" == true ]]; then
  git add -A
fi

if [[ -n "$COMMIT_MSG" ]]; then
  echo "==> git commit（手動メッセージ）"
  if git diff --cached --quiet; then
    echo "コミットする変更がありません（作業ツリーは空）"
  else
    git commit -m "$COMMIT_MSG"
  fi
elif [[ "$DO_SHIP" == true ]]; then
  echo "==> git commit（変更内容から自動生成：ファイル名・領域付き。意図は --commit で）"
  if git diff --cached --quiet; then
    echo "変更なしのためコミットをスキップ"
  else
    AUTO_SUBJECT="$(generate_auto_commit_subject)"
    AUTO_BODY="$(generate_auto_commit_body)"
    echo "  件名: $AUTO_SUBJECT"
    git commit -m "$AUTO_SUBJECT" -m "$AUTO_BODY"
  fi
fi

if [[ "$DO_PUSH" == true ]]; then
  assert_on_main_branch
  echo "==> git push origin main"
  git push origin main
  echo "    Vercel が main への push で自動デプロイします"
fi

if [[ "$DO_DEPLOY" == true ]]; then
  echo "==> Vercel 本番デプロイ（vercel CLI / ログイン済み想定）"
  npx vercel deploy --prod --yes
fi

echo "OK: 完了"
