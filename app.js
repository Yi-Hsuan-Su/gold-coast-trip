// 行程網頁：讀 data.json（sync.mjs 從 Google Sheet 產生）→ 渲染 → 捲動動畫
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (s) => esc(s).replace(/★/g, '<span class="star">★</span>');
const nt = (n) => Math.round(n).toLocaleString('en-US');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MEAL = /早餐|午餐|晚餐|Brunch|宵夜/;
const PEND = /待[訂定]/;
const COMPACT = /移動|計程車|機捷|沖水換衣|回程/;

// ponytail: 待辦是手寫清單，行程改了要順手更新這裡；第 4 欄 true = 已完成
const TODO = [
  ['11/7 03:10', '熱氣球 Bubbles & Go（訂單 RXZ786190）', 'Klook', true],
  ['11/7 19:30', 'Citrique 週六海鮮燒烤自助晚餐', 'SevenRooms → EXPERIENCES', true],
  ['11/8 17:30', '螢火蟲夜遊（訂單 CQW841918）', 'Klook', true],
  ['11/9 12:45', "Walter's 午餐（備註要 Porterhouse）", 'SevenRooms', true],
  ['出發前', '預約機場接送：11/5 05:25 家 → 桃園 T2', '預約固定價（約 NT$800–1,000）'],
  ['10/31 前', '確認收到 Hot Air 熱氣球確認信（6 位數訂位編號＋接送時間；看垃圾信）', '沒收到 → Klook 線上客服'],
  ['出發前', '螢火蟲確認單的聯絡電話是台灣手機：台灣門號開漫遊，或請 Klook 改成澳洲號碼（聯絡不到錯過行程不退費）', 'Klook 線上客服'],
  ['11/6 中午', '確認熱氣球航班（6 位數編號＋姓名）', '07 5636 1508（09:00–17:00）／hotair.com.au/reconfirm'],
  ['11/5 入住', '問櫃台：週末早餐時間、海灘毛巾、11/7 有沒有早出發早餐盒', 'Novotel 櫃台'],
  ['11/6 晚上', '7-Eleven 買隔天熱氣球輕食（麵包、優格、果汁、香蕉）', '13 Cavill Ave（24 小時）'],
  ['11/7 20:00', '在 Citrique 用餐時可先掃螢火蟲確認單 QR Code', '確認單已上傳 Funliday 檔案'],
  ['11/8 12:00 前', '一定要掃螢火蟲確認單 QR Code 看司導資訊和接送時間（確認單規定）', '沒顯示 → Klook 線上客服'],
  ['出發前 2 週', '澳洲 ETA 電子簽證', 'AustralianETA App'],
  ['出發前 2 週', '保險：各自洽保險公司（確認含海外突發疾病醫療；不便險自選）', '保險公司'],
  ['11 月初', 'Unicard 切 UP 選（12 月初切回）', '玉山 Wallet'],
  ['這週', '防沙墊、速乾毛巾', '淘寶'],
  ['打包', '入境檢疫：食物（零食、肉製品、水果、泡麵）、藥品都要申報；不帶肉類', '入境申報'],
  ['打包', '防曬乳、帽子、太陽眼鏡（昆士蘭紫外線很強）＋薄外套（Day4 螢火蟲在山上）', ''],
  ['這週', '防水手機袋 ×2＋小防水收納袋（玩水時房卡、手機帶下水）', '蝦皮／淘寶'],
  ['出發前', '澳洲 eSIM（1 張含當地號碼通話＋1 張純上網）', 'KKday／Klook（Optus 或 Telstra）'],
];

// 「06:44 機捷」→ {icon, time, name}
function parseLabel(l) {
  const m = l.match(/^([🚗🚶🚇🚿🚊])?\s*(~?\d{1,2}:\d{2})?\s*(.*)$/u);
  return { icon: m[1] || '', time: m[2] || '', name: m[3] || l };
}

// 內容格：第一行是重點、・是細節、⚠ 是必做、①② 是選項
function parseBody(v) {
  const out = { lead: '', items: [], opts: [] };
  for (const raw of String(v).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const opt = out.opts[out.opts.length - 1];
    if (/^[①-⑨]/.test(line)) out.opts.push({ n: line[0], h: line.slice(1).trim(), items: [] });
    else if (line.startsWith('⚠')) out.items.push({ t: 'warn', s: line.slice(1).trim() });
    else if (line.startsWith('✕')) out.items.push({ t: 'no', s: line.slice(1).trim() });
    else if (line.startsWith('・')) (opt ? opt.items : out.items).push({ t: '', s: line.slice(1).trim() });
    else if (!out.lead && !out.opts.length) out.lead = line;
    else (opt ? opt.items : out.items).push({ t: '', s: line });
  }
  return out;
}

// Google 地圖連結（places.json：已逐一在 Google 地圖核對過名稱與地址）
const mapUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.q)}${p.pid ? `&query_place_id=${p.pid}` : ''}`;
const pinsHtml = (ps) => (ps.length ? `<p class="pins">${ps.map((p) => `<a class="pin" href="${mapUrl(p)}" target="_blank" rel="noopener">📍 ${esc(p.name)}</a>`).join('')}</p>` : '');

const li = (it) => `<li class="${it.t}">${fmt(it.s)}</li>`;

function parseDay(d, i) {
  const [, no, date] = d.title.match(/Day(\d+)\s*(.*)/) || [, i + 1, d.title];
  const day = { no: String(no).padStart(2, '0'), date: date.replace('(', ' (').trim(), theme: '', alerts: [], rows: [], foot: {}, pending: false };
  for (const [label, value] of d.rows) {
    if (label === '主題') day.theme = value;
    else if (label === '當日提醒') day.alerts = value.split('\n').filter(Boolean).map((s) => ({ warn: s.startsWith('⚠'), s: s.replace(/^[⚠・]\s*/, '') }));
    else if (['自費', '交通', '住宿'].includes(label)) day.foot[label] = value;
    else {
      const lab = parseLabel(label);
      const pending = PEND.test(value);
      day.pending ||= pending;
      day.rows.push({ ...lab, body: parseBody(value), meal: MEAL.test(label), pending, compact: lab.icon && COMPACT.test(lab.name) });
    }
  }
  return day;
}

function renderRow(r, places = []) {
  if (r.compact) {
    const detail = [r.body.lead, ...r.body.items.map((x) => x.s)].filter(Boolean).join(' · ');
    return `<div class="move reveal"><span class="ic">${r.icon}</span>${r.time ? `<span class="time">${esc(r.time)}</span>` : ''}<span>${fmt(detail)}</span></div>`;
  }
  const b = r.body;
  const badges = (r.meal ? '<span class="badge meal">餐</span>' : '') + (r.pending ? '<span class="badge pend">待定</span>' : '');
  return `<article class="card reveal${r.meal ? ' meal' : ''}${r.pending ? ' pending' : ''}">
    <div class="card-top">${r.time ? `<span class="time">${esc(r.time)}</span>` : ''}<h3>${r.icon} ${esc(r.name)}</h3>${badges}</div>
    ${b.lead ? `<p class="lead">${fmt(b.lead)}</p>` : ''}
    ${b.items.length ? `<ul>${b.items.map(li).join('')}</ul>` : ''}
    ${b.opts.map((o) => `<div class="opt"><p class="opt-h"><em>${o.n}</em>${fmt(o.h)}</p>${o.items.length ? `<ul>${o.items.map(li).join('')}</ul>` : ''}</div>`).join('')}
    ${pinsHtml(places.filter((p) => p.card && r.name.includes(p.card)))}
  </article>`;
}

function renderDay(day, i, img, places) {
  const foot = Object.entries(day.foot).map(([k, v]) => `<div><b>${esc(k)}</b>${fmt(v).replace(/\n/g, '<br>')}</div>`).join('');
  return `<section class="day" id="day${i + 1}" data-dot="DAY ${day.no}">
    <div class="day-bg">${img ? `<img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy">` : ''}</div>
    <div class="day-grid">
      <aside class="day-side">
        <div class="day-no">${day.no}</div>
        <p class="day-date">${esc(day.date)}</p>
        <h2 class="day-theme">${fmt(day.theme)}</h2>
        <ul class="alerts">${day.alerts.map((a) => `<li class="${a.warn ? 'warn' : ''}">${fmt(a.s)}</li>`).join('')}</ul>
      </aside>
      <div class="flow">${day.rows.map((r) => renderRow(r, places.filter((p) => p.day === i + 1))).join('')}${foot ? `<div class="day-foot reveal">${foot}</div>` : ''}</div>
    </div>
  </section>`;
}

function renderOverview(days, images) {
  $('.ov-track').innerHTML = days.map((d, i) => {
    const tags = (d.theme.split('・')[1] || d.theme).split(/\s*\+\s*/).filter(Boolean);
    const img = images[`day${i + 1}`];
    return `<a class="ov-card" href="#day${i + 1}">
      ${img ? `<img src="${esc(img.src)}" alt="" loading="lazy">` : ''}
      <div><div class="ov-no">${d.no}</div><p class="ov-date">${esc(d.date)}</p><p class="ov-theme">${fmt(d.theme.split('・')[0])}</p>
      <p class="ov-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}${d.pending ? '<span class="pend">有待定</span>' : ''}</p></div>
    </a>`;
  }).join('');
}

function renderBudget(rows) {
  const h = rows.findIndex((r) => r[0] === '日期');
  const end = rows.findIndex((r) => r[0] === '合計');
  const items = rows.slice(h + 1, end);
  const pay = rows.find((r) => r[0] === '實付估計') || [];
  const rate = rows.find((r) => r[0] === '匯率')?.[2];
  const groups = new Map();
  for (const r of items) {
    const k = String(r[0]).split(' ')[0];
    const g = groups.get(k) || { lo: 0, hi: 0 };
    g.lo += +r[5] || 0; g.hi += +r[6] || 0;
    groups.set(k, g);
  }
  const max = Math.max(...[...groups.values()].map((g) => g.hi), 1);
  $('.bars').innerHTML = [...groups].map(([k, g]) => `<div class="bar-row">
    <b>${esc(k.toUpperCase())}</b>
    <div class="bar"><s style="width:${(g.hi / max) * 100}%"></s><i style="width:${(g.lo / max) * 100}%"></i></div>
    <span>${g.hi ? (g.lo === g.hi ? `NT$${nt(g.hi)}` : `NT$${nt(g.lo)} – ${nt(g.hi)}`) : '待定'}</span>
  </div>`).join('');
  const lo = $('.n-lo'), hi = $('.n-hi');
  lo.dataset.to = pay[5] || 0; hi.dataset.to = pay[6] || 0;
  // 用最終數字量寬度並鎖住：跳數字時寬度不變，版面就不會換行閃爍（字型載入、視窗縮放後重量）
  const lock = () => [lo, hi].forEach((el) => {
    const cur = el.textContent;
    el.style.minWidth = '';
    el.textContent = nt(+el.dataset.to);
    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    el.textContent = cur;
  });
  lo.textContent = nt(+lo.dataset.to); hi.textContent = nt(+hi.dataset.to);
  document.fonts.ready.then(lock);
  addEventListener('resize', lock);
  const pend = items.filter((r) => /待定/.test(r[7])).map((r) => `${r[0].split(' ')[0]} ${r[1]}`);
  $('.note').textContent = `匯率 1 AUD ≈ ${rate} TWD　｜　尚未計入：${pend.join('、') || '無'}`;
}

function renderTodo() {
  $('.todo-list').innerHTML = TODO.map(([w, what, where, done]) => `<li class="reveal${done ? ' done' : ''}"><small>${esc(w)}</small><b>${esc(what)}</b><em>${done ? '✅ 已訂位' : esc(where)}</em></li>`).join('');
}

function setImg(sel, img) {
  const el = $(sel);
  if (el && img) { el.src = img.src; el.alt = img.alt; }
}

function countdown() {
  const d = Math.ceil((Date.parse('2026-11-05T09:10:00+08:00') - Date.now()) / 864e5);
  $('.hero-meta .count').innerHTML = d > 0 ? `<b>${d}</b><small>天後出發</small>` : d > -5 ? '<b>ON TRIP</b><small>旅程中</small>' : '<b>DONE</b><small>回憶收藏</small>';
}

function animate(lenis) {
  gsap.registerPlugin(ScrollTrigger);

  // 進場
  gsap.timeline()
    .to('.hero-bg img', { scale: 1, duration: 2.6, ease: 'power2.out' }, 0)
    .from('.hero-title span', { yPercent: 110, opacity: 0, duration: 1.2, stagger: .12, ease: 'expo.out' }, .1)
    .from('.hero .kicker, .hero-sub, .hero-meta li', { y: 24, opacity: 0, duration: .8, stagger: .06, ease: 'power3.out' }, .5);

  // hero 捲動：圖往下、字往上淡出
  gsap.to('.hero-bg img', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-in', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 20%', scrub: true } });

  // 總覽：桌機釘住橫向捲
  ScrollTrigger.matchMedia({
    '(min-width: 901px)': () => {
      const track = $('.ov-track');
      const dist = () => track.scrollWidth - innerWidth;
      gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.overview', pin: '.ov-pin', start: 'top top', end: () => `+=${dist()}`, scrub: 1, invalidateOnRefresh: true } });
    },
  });

  // 每天：背景視差、左欄浮現
  gsap.utils.toArray('.day').forEach((sec) => {
    gsap.fromTo($('.day-bg img', sec), { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from(sec.querySelectorAll('.day-no, .day-date, .day-theme, .alerts li'), { y: 50, opacity: 0, duration: 1, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: sec, start: 'top 70%' } });
  });

  // 卡片逐張浮現
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.from(el, { y: 60, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  // 預算：數字跳動＋長條長出來
  ScrollTrigger.create({
    trigger: '.budget', start: 'top 60%', once: true,
    onEnter: () => {
      document.querySelectorAll('.big-num span').forEach((el) => {
        const o = { v: 0 };
        gsap.to(o, { v: +el.dataset.to, duration: 2, ease: 'power2.out', onUpdate: () => (el.textContent = nt(o.v)) });
      });
      gsap.from('.bar s, .bar i', { scaleX: 0, duration: 1.4, stagger: .08, ease: 'expo.out' });
    },
  });
  gsap.fromTo('.budget-bg img', { yPercent: -10, scale: 1.1 }, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.budget', start: 'top bottom', end: 'bottom top', scrub: true } });

  // 進度條
  gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });

  // 側邊點點導覽
  const secs = gsap.utils.toArray('[data-dot]');
  $('.dots').innerHTML = secs.map((s) => `<a href="#${s.id}"><span>${s.dataset.dot}</span><i></i></a>`).join('');
  const links = [...document.querySelectorAll('.dots a')];
  secs.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 50%', end: 'bottom 50%', onToggle: (t) => t.isActive && links.forEach((a, j) => a.classList.toggle('on', i === j)) }));

  // 錨點走 Lenis 平滑捲
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(a.getAttribute('href'), { duration: 1.4 }) : $(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
  });
}

(async function main() {
  const [data, places] = await Promise.all(['data.json', 'places.json'].map(async (f) => (await fetch(f, { cache: 'no-cache' })).json()));
  const days = data.days.map(parseDay);

  setImg('.hero-bg img', data.images.hero);
  setImg('.budget-bg img', data.images.budget);
  countdown();
  renderOverview(days, data.images);
  $('#days').innerHTML = days.map((d, i) => renderDay(d, i, data.images[`day${i + 1}`], places)).join('');
  const hotel = places.find((p) => p.card === '住宿');
  if (hotel) $('.hero-meta').children[2].innerHTML = `<a href="${mapUrl(hotel)}" target="_blank" rel="noopener"><b>Novotel 📍</b><small>Surfers Paradise ×4</small></a>`;
  $('#budget').dataset.dot = 'BUDGET';
  renderBudget(data.budget);
  renderTodo();
  $('.updated').textContent = `行程更新：${new Date(data.updated).toLocaleString('zh-TW', { hour12: false })}`;

  if (REDUCED || !window.gsap) {
    document.querySelectorAll('.big-num span').forEach((el) => (el.textContent = nt(+el.dataset.to)));
    return;
  }
  const lenis = window.Lenis ? new Lenis({ lerp: .09 }) : null;
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  animate(lenis);
  // 圖片載入後高度會變，重算觸發點
  addEventListener('load', () => ScrollTrigger.refresh());
})();
