---
description: >-
  Run release checks (tsc, build, secret scan), optional git commit (manual or
  auto from diffs), push to origin main. Vercel auto-deploys on push.
  Use when shipping, before deploy, or when the user says リリース / デプロイ /
  release / preflight / ship.
---

# Release pipeline（g7-dashboard）

プロジェクトルートでシェルを実行する。**push は常に `origin main`（ローカルも `main` 必須）。**

## チェックのみ（コミット・プッシュしない）

```bash
./scripts/release.sh
```

1. `npx tsc --noEmit`
2. `npm run build`
3. 追跡ファイルの簡易シークレット検出（GitHub PAT、秘密鍵、Google API キー風パターンなど）

## 一発リリース（おすすめ）：自動コミット + push main

```bash
./scripts/release.sh --ship
```

- チェック後 `git add -A` → コミット → `git push origin main`
- **Vercel が main への push で自動デプロイ**（Dashboard で完了確認）
- **自動コミット**は次を含む（`scripts/release.sh` 内）:
  - **件名**: 変更種別 prefix（`feat:` / `fix:` / `docs:` / `chore(ui):` / `chore(api):` / `chore(cron):` / `chore(ci):`）と変更ファイル名最大3つ
  - **本文**: 変更パス一覧
- **背景・理由まで履歴に残したいとき**は `--ship` ではなく `--commit` を使う（下記）

## 意図・背景を明確にしたいとき（推奨）

```bash
./scripts/release.sh --commit "fix(cron): skip Discord on full success; alert on partial only" --push
```

`--ship` と `--commit` は同時に使えない。

## 手動コミットメッセージのみ

```bash
./scripts/release.sh --commit "feat: your message in English" --push
```

## Vercel を明示デプロイ（push 済み or 再デプロイしたいとき）

```bash
./scripts/release.sh --deploy
```

`npx vercel deploy --prod --yes`（Vercel CLI ログイン済み想定）。通常は `--ship` の push だけで十分。

## 前提

- **Vercel**: GitHub `main` 連携済み。環境変数は Vercel Dashboard → Settings → Environment Variables
- **push**: `origin` の **main** へ。別ブランチの場合は `main` にマージしてから `--ship`

## エージェント向けメモ

- デプロイまで一発: `./scripts/release.sh --ship`（Vercel 自動デプロイ）
- ユーザーが「なぜ変更したか」を履歴に残したい場合は `./scripts/release.sh --commit "..." --push` を提案
- `.env.local` や `data/news-snapshot.json` が stage されないよう `.gitignore` を確認
- `memo.txt` 等にトークンが残っているとシークレットチェックで失敗する
