https://yi-hsuan-su.github.io/gold-coast-trip/

行程資料來源是 Google Sheet（`黃金海岸_直排`、`黃金海岸_預算`），網頁只讀 `data.json`，不含任何 token。

更新行程：

```bash
set -a; . ~/travel-sheet-script/.env; set +a; node sync.mjs   # 重抓 data.json（token 在本機 .env）
./deploy.sh                                                          # commit + push
```

換封面圖：改 `sync.mjs` 裡的 `IMAGES` 關鍵字再 sync。
