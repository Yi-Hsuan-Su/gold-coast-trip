// 從 Google Sheet（Apps Script Web App）拉行程＋預算＋封面圖 → data.json
// 用法：SHEET_URL=... SHEET_TOKEN=... node sync.mjs
// token 只在本機用，不會寫進 data.json / 網頁
import { writeFileSync } from 'node:fs';

const { SHEET_URL, SHEET_TOKEN } = process.env;
if (!SHEET_URL || !SHEET_TOKEN) throw new Error('需要 SHEET_URL、SHEET_TOKEN 環境變數');

const call = async (params) => {
  const q = new URLSearchParams({ token: SHEET_TOKEN, ...params });
  const r = await fetch(`${SHEET_URL}?${q}`, { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(`${params.action}: ${j.error}`);
  return j;
};

// 每天的封面圖關鍵字（換圖就改這裡）
const IMAGES = {
  hero: 'Surfers Paradise Gold Coast skyline beach',
  day1: 'airplane wing sunset clouds',
  day2: 'koala eucalyptus tree',
  day3: 'hot air balloons sunrise countryside',
  day4: 'kayak turquoise water',
  day5: 'Brisbane city skyline river',
  budget: 'tropical beach sunset palm trees',
};

const [plan, budget] = await Promise.all([
  call({ action: 'read', tab: '黃金海岸_直排' }),
  call({ action: 'read', tab: '黃金海岸_預算' }),
]);

// 直排：每天兩欄（項目｜內容），第一列是 Day 表頭
const v = plan.values;
const days = [];
for (let c = 0; c + 1 < v[0].length; c += 2) {
  if (!v[0][c + 1]) continue;
  const rows = [];
  for (let r = 1; r < v.length && v[r][c] !== ''; r++) rows.push([String(v[r][c]), String(v[r][c + 1])]);
  days.push({ title: String(v[0][c + 1]), rows });
}

const images = {};
for (const [k, q] of Object.entries(IMAGES)) {
  const j = await call({ action: 'pexels', q });
  // ponytail: 取 pexels 第一張，選錯就改 IMAGES 關鍵字
  images[k] = j.src ? { src: j.src.replace(/\?.*$/, '?auto=compress&cs=tinysrgb&w=1920'), alt: j.alt || '' } : null;
}

const data = { updated: new Date().toISOString(), days, budget: budget.values, images };
writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify(data, null, 1));
console.log(`data.json：${days.length} 天、預算 ${budget.values.length} 列、圖 ${Object.values(images).filter(Boolean).length} 張`);
