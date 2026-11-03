#!/bin/bash
set -e
REPO="gold-coast-trip"
cd "$(dirname "$0")"

USER=$(gh api user --jq .login)
echo "GitHub: $USER"

if [ ! -d .git ]; then
  git init -b main
fi

git add -A
git commit -m "update trip" 2>/dev/null || echo "(無變更)"

if ! gh repo view "$USER/$REPO" >/dev/null 2>&1; then
  echo "建立 repo $USER/$REPO"
  gh repo create "$USER/$REPO" --public --source=. --push
else
  echo "push existing"
  git remote add origin "git@github.com:$USER/$REPO.git" 2>/dev/null || true
  git push -u origin main
fi

gh api -X POST "/repos/$USER/$REPO/pages" \
  -f "source[branch]=main" -f "source[path]=/" 2>/dev/null \
  || echo "(Pages 可能已啟用)"

URL="https://$USER.github.io/$REPO/"
echo ""
echo "🎉 完成"
echo "Pages URL: $URL"
