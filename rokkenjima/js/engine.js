/* ============================================================
   六轩岛密室 · 引擎
   零依赖单文件逻辑层。数据来自 data.js / puzzle.js
   ============================================================ */
(function () {
'use strict';

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var KEY = 'rokkenjima.save.v2';

var G = {
  screen: 'title',
  tab: 'nights',
  solved: [],          // 已解开的锁 id
  wrong: 0,
  hintUsed: 0,
  curLock: null,
  curNight: null,
  sel: {},
  ended: false
};

/* ---------------- 存档 ---------------- */
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      solved: G.solved, wrong: G.wrong, hintUsed: G.hintUsed, ended: G.ended
    }));
  } catch (e) {}
}
function load() {
  try {
    var r = localStorage.getItem(KEY);
    if (!r) return false;
    var d = JSON.parse(r);
    G.solved = d.solved || []; G.wrong = d.wrong || 0;
    G.hintUsed = d.hintUsed || 0; G.ended = !!d.ended;
    return G.solved.length > 0 || G.ended;
  } catch (e) { return false; }
}

/* ---------------- 像素画工具 ---------------- */
var ctx = null;
function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); }

function hash(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFor(id) {
  var h = hash(id) || 1;
  return function () { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

/* 人物像素头像 16x16 */
var PORT = {};
var SKIN = ['#f3c9a3', '#e8b98d', '#d9a173', '#c78d63'];
var HAIR = ['#2b1d1a', '#4a2c1e', '#6b4423', '#8a6a2f', '#c9a227', '#3d3d4e', '#5a3a5c', '#7a2d2d'];
var CLOTH = ['#3a4466', '#5a6988', '#124e89', '#0099db', '#be4a2f', '#6b3fa0', '#2d6b4a', '#7a4a2d', '#8b3a52'];

function portrait(id) {
  if (PORT[id]) return PORT[id];
  var r = rngFor(id);
  var cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  var c = cv.getContext('2d');
  function p(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  var skin = SKIN[(r() * SKIN.length) | 0];
  var hair = HAIR[(r() * HAIR.length) | 0];
  var cloth = CLOTH[(r() * CLOTH.length) | 0];
  var hairStyle = (r() * 3) | 0;
  var longHair = r() > 0.55;
  var accent = CLOTH[(r() * CLOTH.length) | 0];
  // 肩/衣
  p(2, 12, 12, 4, cloth);
  p(2, 12, 12, 1, '#00000030');
  // 领口
  p(7, 12, 2, 2, accent);
  // 脖子
  p(7, 10, 2, 2, skin);
  // 脸
  p(4, 4, 8, 7, skin);
  // 侧影
  p(4, 4, 1, 7, '#00000022');
  // 长发披肩
  if (longHair) { p(3, 5, 1, 8, hair); p(12, 5, 1, 8, hair); }
  // 头发
  if (hairStyle === 0) { p(3, 2, 10, 4, hair); p(3, 2, 2, 7, hair); p(11, 2, 2, 7, hair); }
  else if (hairStyle === 1) { p(3, 2, 10, 3, hair); p(2, 3, 1, 5, hair); p(13, 3, 1, 5, hair); p(5, 5, 2, 2, hair); }
  else { p(4, 1, 8, 4, hair); p(3, 3, 1, 4, hair); p(12, 3, 1, 4, hair); }
  // 眼
  var ey = 7;
  p(6, ey, 1, 1, '#1a1214'); p(9, ey, 1, 1, '#1a1214');
  // 高光
  p(2, 2, 1, 1, '#ffffff22');
  PORT[id] = cv.toDataURL();
  return PORT[id];
}

/* ---------------- 场景绘制（192x108 逻辑像素） ---------------- */
var W = 192, H = 108;
function dither(x, y, w, h, c1, c2) {
  R(x, y, w, h, c1);
  ctx.fillStyle = c2;
  for (var j = 0; j < h; j += 2) for (var i = (j / 2 % 2) * 2; i < w; i += 4) ctx.fillRect((x + i) | 0, (y + j) | 0, 1, 1);
}
function sky(top, bot) {
  for (var y = 0; y < 70; y++) {
    var t = y / 70, c = mix(top, bot, t);
    R(0, y, W, 1, c);
  }
}
function mix(a, b, t) {
  function hx(s) { return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)]; }
  var A = hx(a), B = hx(b);
  var o = '#'; for (var i = 0; i < 3; i++) {
    var v = Math.round(A[i] + (B[i] - A[i]) * t).toString(16); o += (v.length < 2 ? '0' : '') + v;
  }
  return o;
}
var rain = [];
for (var i = 0; i < 70; i++) rain.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 1.4 });
function drawRain(alpha) {
  ctx.fillStyle = 'rgba(160,190,220,' + alpha + ')';
  for (var i = 0; i < rain.length; i++) { var d = rain[i]; ctx.fillRect(d.x | 0, d.y | 0, 1, 3); }
}
function tickRain(t) { for (var i = 0; i < rain.length; i++) { var d = rain[i]; d.y += d.s; d.x -= 0.25; if (d.y > H) { d.y = -3; d.x = Math.random() * W; } } }

function sea(y0, c1, c2) {
  for (var y = y0; y < H; y++) {
    var t = (y - y0) / (H - y0);
    R(0, y, W, 1, mix(c1, c2, t));
  }
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (var k = 0; k < 26; k++) {
    var yy = y0 + 4 + ((k * 5 + ((Date.now() / 260) | 0) % 5) % (H - y0 - 4));
    ctx.fillRect(((k * 37) % W), yy, 3, 1);
  }
}
function mansion(x, y, w, h, lit, win) {
  win = win || '#feae34';
  R(x, y, w, h, '#241d2b');
  R(x, y, w, 2, '#3a2f42');
  R(x + (w / 2 | 0) - 6, y - 8, 12, 8, '#2c2333');
  R(x + (w / 2 | 0) - 7, y - 10, 14, 2, '#3a2f42');
  R(x + (w / 2 | 0), y - 12, 1, 2, '#5a4a66');
  // 窗
  for (var j = 0; j < 3; j++) for (var i2 = 0; i2 < 5; i2++) {
    var wx = x + 5 + i2 * 10, wy = y + 5 + j * 9;
    var on = lit && (((i2 * 7 + j * 3 + 2) % 4) !== 0);
    R(wx, wy, 4, 5, on ? win : '#171320');
    if (on) R(wx, wy, 4, 1, '#fff1c0');
  }
  // 大门
  R(x + (w / 2 | 0) - 4, y + h - 12, 8, 12, '#171320');
  R(x + (w / 2 | 0) - 4, y + h - 12, 1, 12, '#3a2f42');
}

/* 通用：海岛远景 */
function islandScene(o) {
  sky(o.skyTop, o.skyBot);
  // 天体
  if (o.moon) {
    R(o.moon.x, o.moon.y, 13, 13, o.moon.c); R(o.moon.x + 3, o.moon.y - 2, 8, 17, o.moon.c); R(o.moon.x, o.moon.y + 3, 13, 8, o.moon.c);
    R(o.moon.x + 3, o.moon.y + 3, 4, 4, o.moon.d); R(o.moon.x + 7, o.moon.y + 6, 3, 3, o.moon.d);
  }
  if (o.sun) {
    // 地平线光晕（同色低透明度同心圆，192px 下仍是像素块）
    for (var rr = 30; rr > 2; rr -= 3) {
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = o.sun.c;
      ctx.beginPath(); ctx.arc(o.sun.x, o.sun.y, rr, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffe6b0';
    ctx.beginPath(); ctx.arc(o.sun.x, o.sun.y, 7, 0, 6.2832); ctx.fill();
  }
  // 云
  ctx.fillStyle = o.cloud;
  for (var i = 0; i < 6; i++) {
    var cw = 26 + i * 9;
    ctx.fillRect((i * 41 + ((Date.now() / o.drift) | 0) % (W + 60)) - 30, 6 + i * 7, cw, 3);
  }
  // 海
  sea(o.seaY, o.seaTop, o.seaBot);
  // 岛
  R(0, o.seaY - 8, W, 10, o.land1);
  R(14, o.seaY - 20, 164, 14, o.land2);
  R(34, o.seaY - 28, 124, 10, o.land2);
  R(0, o.seaY - 2, W, 4, o.land3);
  // 玫瑰丛
  for (var k = 0; k < 46; k++) {
    var rx = (k * 13 + 5) % W, ry = o.seaY - 22 + ((k * 7) % 18);
    R(rx, ry, 3, 2, k % 3 ? o.bush : o.rose);
    if (k % 6 === 0) R(rx, ry - 1, 1, 1, o.rose2);
  }
  // 大屋
  mansion(64, o.seaY - 50, 64, 30, true, o.win);
}
function sceneTitle(t) {
  islandScene({
    skyTop: '#150f22', skyBot: '#3d2a48',
    moon: { x: 150, y: 12, c: '#efe7cf', d: '#b3ab95' },
    cloud: 'rgba(88,76,108,.45)', drift: 90,
    seaY: 74, seaTop: '#1c3550', seaBot: '#080e18',
    land1: '#1e2636', land2: '#28304a', land3: '#1a2130',
    bush: '#1f3a2a', rose: '#7a2d2d', rose2: '#c04a52',
    win: '#feae34'
  });
  drawRain(.34);
}
function sceneEnding(t) {
  islandScene({
    skyTop: '#2e1c30', skyBot: '#c9704a',
    sun: { x: 152, y: 42, c: '#f5b566' },
    cloud: 'rgba(120,80,86,.4)', drift: 140,
    seaY: 74, seaTop: '#4a3c58', seaBot: '#221a30',
    land1: '#2a2030', land2: '#3a2a3c', land3: '#241c2c',
    bush: '#2a3a2c', rose: '#8a3038', rose2: '#c9555c',
    win: '#ff6a4a'
  });
  ctx.fillStyle = 'rgba(255,180,110,.10)'; ctx.fillRect(0, 0, W, 74);
}

function scene(kind, t) {
  switch (kind) {
    case 'dining': return scDining(t);
    case 'room2f': return scRoom(t);
    case 'garden': return scGarden(t);
    case 'guest':  return scGuest();
    case 'entrance': return scEntrance();
    case 'path':   return scPath();
    default: return scDining(t);
  }
}
function scDining(t) {
  sky('#241b2c', '#2e2337');
  // 地板
  dither(0, 68, W, 40, '#3a2a24', '#2e211d');
  // 墙裙
  R(0, 60, W, 8, '#3d2c3a'); R(0, 66, W, 2, '#4d3a4a');
  // 窗（月）
  R(16, 18, 26, 34, '#2a2440'); R(18, 20, 22, 30, '#5a6c8a');
  R(29, 20, 1, 30, '#3a3450'); R(18, 34, 22, 1, '#3a3450');
  R(148, 18, 26, 34, '#2a2440'); R(150, 20, 22, 30, '#4a5a78');
  R(161, 20, 1, 30, '#3a3450'); R(150, 34, 22, 1, '#3a3450');
  // 吊灯
  R(94, 0, 1, 12, '#6b5a3a'); R(86, 12, 17, 4, '#8a7448'); R(88, 16, 3, 3, '#fee761'); R(94, 16, 3, 3, '#fee761'); R(100, 16, 3, 3, '#fee761');
  // 长桌
  R(46, 72, 100, 6, '#5a3f2e'); R(46, 78, 100, 3, '#402c20');
  // 椅
  R(50, 84, 10, 12, '#422e22'); R(132, 84, 10, 12, '#422e22');
  // 六具倒伏的身影
  var xs = [58, 76, 94, 112, 130, 66];
  for (var i = 0; i < 6; i++) {
    var x = xs[i], y = 88 + (i % 2) * 4;
    R(x, y, 16, 5, '#2a1a1e'); R(x + 2, y - 4, 5, 5, i < 5 ? '#2a1a1e' : '#33222a');
    ctx.fillStyle = 'rgba(190,40,50,.55)'; ctx.fillRect(x - 2, y + 5, 20, 1); ctx.fillRect(x + 3, y + 6, 12, 1);
  }
  R(0, 0, W, 60, 'rgba(10,6,14,.28)');
}
function scRoom(t) {
  sky('#2a2030', '#33273a');
  dither(0, 66, W, 42, '#3c3028', '#302620');
  R(0, 58, W, 8, '#453346'); R(0, 64, W, 2, '#553d58');
  // 窗
  R(120, 16, 40, 40, '#2a2440'); R(122, 18, 36, 36, '#44546f');
  R(140, 18, 1, 36, '#33304d'); R(122, 36, 36, 1, '#33304d');
  R(126, 22, 10, 12, 'rgba(232,224,200,.35)');
  // 床
  R(20, 74, 78, 8, '#4a3550'); R(20, 82, 78, 16, '#3a2a40');
  R(18, 66, 6, 32, '#5a4260'); R(96, 72, 6, 26, '#5a4260');
  R(30, 70, 18, 8, '#c8bfe0'); R(26, 76, 66, 6, '#6a5570');
  // 两具倒影
  R(112, 84, 22, 7, '#2a1a24'); R(140, 88, 20, 6, '#2a1a24');
  ctx.fillStyle = 'rgba(150,30,45,.55)'; ctx.fillRect(108, 92, 58, 1); ctx.fillRect(112, 93, 44, 1);
  R(0, 0, W, 58, 'rgba(10,6,14,.3)');
}
function scGarden(t) {
  sky('#26303f', '#1b2330');
  sea(60, '#16283a', '#0d1622');
  R(0, 56, W, 6, '#1a2230');
  dither(0, 62, W, 46, '#1e2c22', '#16211a');
  for (var k = 0; k < 60; k++) {
    var rx = (k * 17 + 3) % W, ry = 62 + ((k * 11) % 44);
    R(rx, ry, 4, 3, '#20402c');
    if (k % 3 === 0) R(rx + 1, ry - 1, 2, 2, '#8a2b34');
    if (k % 7 === 0) R(rx - 1, ry - 1, 1, 1, '#c04a52');
  }
  // 石板路
  dither(84, 74, 26, 34, '#4a4a52', '#3c3c46');
  // 倒伏的纱音
  R(88, 80, 20, 6, '#2a1a24'); R(90, 76, 5, 5, '#3a2630');
  R(88, 86, 20, 1, 'rgba(150,30,45,.6)');
  R(0, 0, W, 56, 'rgba(10,14,22,.3)');
  drawRain(.3);
}
function scGuest() {
  sky('#221c2c', '#2a2334');
  dither(0, 60, W, 48, '#332a2a', '#2a2222');
  R(0, 54, W, 6, '#3d2f42'); R(0, 60, W, 2, '#4a3a50');
  // 走廊门
  for (var i = 0; i < 4; i++) {
    var dx = 14 + i * 44;
    R(dx, 18, 26, 40, '#2a2030');
    R(dx + 2, 20, 22, 36, '#3a2c3c');
    R(dx + 22, 38, 3, 3, '#c9a227');
  }
  // 佣人室门（第二扇）打开，透出光
  R(60, 20, 22, 36, '#4a3a28'); R(62, 22, 18, 32, '#6a5538');
  // 两具身影
  R(70, 84, 22, 7, '#2a1a24'); R(104, 88, 20, 6, '#2a1a24');
  ctx.fillStyle = 'rgba(150,30,45,.5)'; ctx.fillRect(66, 92, 64, 1);
  // 壁灯
  R(6, 24, 4, 6, '#feae34'); R(182, 24, 4, 6, '#feae34');
  R(0, 0, W, 54, 'rgba(8,6,12,.35)');
}
function scEntrance() {
  sky('#1e1a28', '#262033');
  dither(0, 62, W, 46, '#332c2c', '#2a2424');
  // 大门
  R(70, 12, 52, 54, '#241a2a');
  R(74, 16, 44, 50, '#30243a');
  R(95, 16, 2, 50, '#181120');
  R(84, 40, 4, 8, '#c9a227'); R(104, 40, 4, 8, '#c9a227');
  // 窗
  R(18, 22, 30, 26, '#2a2440'); R(20, 24, 26, 22, '#3c4a63');
  R(144, 22, 30, 26, '#2a2440'); R(146, 24, 26, 22, '#3c4a63');
  // 倒在南条
  R(80, 76, 30, 8, '#2c1c26'); R(104, 84, 6, 6, '#3a2836');
  ctx.fillStyle = 'rgba(160,32,46,.55)'; ctx.fillRect(74, 84, 60, 1); ctx.fillRect(80, 85, 46, 1);
  R(0, 0, W, 60, 'rgba(8,6,12,.3)');
}
function scPath() {
  sky('#232c3a', '#18202c');
  dither(0, 58, W, 50, '#1c2a20', '#141e18');
  for (var k = 0; k < 70; k++) {
    var rx = (k * 23 + 7) % W, ry = 58 + ((k * 13) % 50);
    R(rx, ry, 4, 3, '#1e3a28');
    if (k % 4 === 0) R(rx + 1, ry - 1, 2, 2, '#7a2d34');
  }
  dither(60, 68, 72, 40, '#484850', '#3a3a44');
  // 朱志香倒在小路
  R(92, 78, 24, 7, '#2a1a24'); R(94, 74, 5, 5, '#3a2630');
  ctx.fillStyle = 'rgba(160,32,46,.6)'; ctx.fillRect(88, 86, 40, 1);
  R(0, 0, W, 56, 'rgba(8,12,20,.34)');
  drawRain(.32);
}

/* ---------------- 画面渲染 ---------------- */
function paint(kind, t) {
  var cv = $('#bg'); if (!cv) return;
  ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (kind === 'title') sceneTitle(t);
  else if (kind === 'ending') sceneEnding(t);
  else scene(kind, t);
}

/* ---------------- 视图 ---------------- */
function render() {
  var v = $('#view');
  if (G.screen === 'title')  return viewTitle(v);
  if (G.screen === 'ending') return viewEnding(v);
  if (G.screen === 'hub')    return viewHub(v);
}

function bar(title, sub) {
  return '<header id="bar"><b>' + title + '</b><span class="sp"></span>' +
    (sub ? '<span class="tag">' + sub + '</span>' : '') +
    '<button class="btn tiny" data-act="title">标题</button></header>';
}

/* ---------- 标题 ---------- */
function viewTitle(v) {
  $('#bgwrap').style.display = 'block';
  var has = load();
  v.innerHTML =
    '<div class="titlewrap">' +
      '<div class="logo">六轩岛<em>密室</em></div>' +
      '<div class="logo2">R O K K E N J I M A &nbsp;·&nbsp; L O C K E D &nbsp;R O O M</div>' +
      '<div class="sub">1986 年 10 月，六轩岛。<br>十七人，八夜，连续的密室。<br>' +
        '红字不可推翻，紫字唯有犯人说谎——<br><b>请你，指出真凶。</b></div>' +
      '<div class="tbtns">' +
        '<button class="btn big" data-act="start">' + (has ? '继续调查' : '开始调查') + '</button>' +
        (has ? '<button class="btn big ghost" data-act="reset">重新开始</button>' : '') +
      '</div>' +
      '<div class="hintline">建议准备好纸和笔记用具。</div>' +
    '</div>';
  $$('[data-act]', v).forEach(function (b) {
    b.onclick = function () {
      var a = b.getAttribute('data-act');
      if (a === 'start') { G.screen = 'hub'; G.tab = 'nights'; render(); }
      if (a === 'reset') { G.solved = []; G.wrong = 0; G.hintUsed = 0; G.ended = false; save(); render(); }
    };
  });
}

/* ---------- 主界面 ---------- */
var TABS = [
  { id:'nights', label:'案卷',  hint:'八夜现场与供词' },
  { id:'people', label:'人物',  hint:'十七名登场者' },
  { id:'rules',  label:'规则',  hint:'真伪与钥匙' },
  { id:'locks',  label:'推演',  hint:'七道推理锁' },
  { id:'case',   label:'指认',  hint:'指出真凶' }
];

function viewHub(v) {
  $('#bgwrap').style.display = 'none';
  var sub = G.ended ? '已破案' : ('推理锁 ' + G.solved.length + '/7');
  var h = bar('六轩岛密室', sub) +
    '<nav id="tabs">' + TABS.map(function (t) {
      var act = (G.tab === t.id) ? ' class="tab on"' : ' class="tab"';
      return '<button' + act + ' data-tab="' + t.id + '" title="' + t.hint + '">' + t.label + '</button>';
    }).join('') + '</nav><main id="body"></main>';
  v.innerHTML = h;
  $$('[data-tab]', v).forEach(function (b) { b.onclick = function () { G.tab = b.getAttribute('data-tab'); render(); }; });
  $('[data-act="title"]', v).onclick = function () { G.screen = 'title'; render(); };
  var body = $('#body', v);
  if (G.tab === 'nights') tabNights(body);
  if (G.tab === 'people') tabPeople(body);
  if (G.tab === 'rules')  tabRules(body);
  if (G.tab === 'locks')  tabLocks(body);
  if (G.tab === 'case')   tabCase(body);
}

/* ---------- 案卷 ---------- */
function tabNights(b) {
  if (G.curNight) return nightReader(b);
  b.innerHTML = '<div class="lede">八夜，六处现场。点开每一夜，读完供词与现场记录。</div>' +
    '<div class="nightlist">' + NIGHTS.map(function (n) {
      return '<button class="nitem" data-night="' + n.id + '">' +
        '<span class="nt">' + n.title + '</span>' +
        '<span class="ns">' + n.sub + '</span>' +
        '<span class="nb">' + n.brief + '</span>' +
        '<span class="nmore">查看供词 ›</span></button>';
    }).join('') + '</div>';
  $$('[data-night]', b).forEach(function (el) {
    el.onclick = function () { G.curNight = el.getAttribute('data-night'); render(); };
  });
}

function nightReader(b) {
  var n = null;
  for (var i = 0; i < NIGHTS.length; i++) if (String(NIGHTS[i].id) === G.curNight) n = NIGHTS[i];
  if (!n) { G.curNight = null; return render(); }
  b.innerHTML =
    '<div class="reader">' +
      '<div class="rhead"><button class="btn tiny" data-back="1">‹ 案卷</button>' +
      '<b>' + n.title + '</b><span class="rs">' + n.sub + '</span></div>' +
      '<div class="rscene"><canvas id="sc" width="192" height="108"></canvas></div>' +
      '<div class="rlog">' + n.log.map(function (l) {
        var cls = 'line';
        if (l.truth === 'red')    cls += ' red';
        if (l.truth === 'purple') cls += ' purple';
        if (l.truth === 'blue')   cls += ' blue';
        if (l.who === '旁白')     cls += ' narrator';
        var tag = l.truth ? '<span class="tmark ' + l.truth + '">' +
          (l.truth === 'red' ? '红字' : l.truth === 'purple' ? '紫字' : '蓝字') + '</span>' : '';
        return '<p class="' + cls + '"><span class="who">' + l.who + '</span>' + tag +
          '<span class="say">「' + l.say + '」</span></p>';
      }).join('') + '</div>' +
      '<div class="rnote">' + n.note + '</div>' +
    '</div>';
  var cv = $('#sc', b); if (cv) { var c2 = cv.getContext('2d'); var saveCtx = ctx; ctx = c2; scene(n.scene, 0); ctx = saveCtx; }
  $('[data-back]', b).onclick = function () { G.curNight = null; render(); };
}

/* ---------- 人物 ---------- */
var GROUPS = [
  { id:'adult',   label:'右代宫家 · 大人' },
  { id:'child',   label:'右代宫家 · 孩子' },
  { id:'servant', label:'佣人 · 持总钥匙' },
  { id:'guest',   label:'宾客' }
];
function tabPeople(b) {
  var dead = PEOPLE.filter(function (p) { return p.st; }).length;
  b.innerHTML = '<div class="lede">全 17 人。已确认死亡 <b class="red">' + dead + '</b> 人，' +
    '存活／状态不明 <b>' + (17 - dead) + '</b> 人。<br><span class="dim">注意：名单上写着「死亡」，并不代表他清白。</span></div>' +
    GROUPS.map(function (g) {
      var list = PEOPLE.filter(function (p) { return p.g === g.id; });
      if (!list.length) return '';
      return '<div class="groupH">' + g.label + '</div><div class="pgrid">' + list.map(function (p) {
        return '<div class="pcard' + (p.st ? ' dead' : '') + '">' +
          '<img class="pav" src="' + portrait(p.id) + '" alt="">' +
          '<div class="pi"><span class="pn">' + p.n + '</span>' +
          '<span class="pt">' + p.t + '</span>' +
          '<span class="ps">' + (p.st ? '第' + p.died + '晚 · 死亡' : '存活') + '</span>' +
          (p.st ? '<span class="pl">' + p.loc + '</span>' : '') +
          '</div></div>';
      }).join('') + '</div>';
    }).join('');
}

/* ---------- 规则 ---------- */
function tabRules(b) {
  b.innerHTML = '<div class="lede">这不是普通的杀人事件。请先把规则读完——它们是这座岛上唯一的法律。</div>' +
    RULES.map(function (r) {
      return '<section class="rulebox"><h3>' + r.h + '</h3>' +
        r.c.map(function (p) { return '<p><b>' + p[0] + '</b>' + p[1] + '</p>'; }).join('') +
        '</section>';
    }).join('') +
    '<div class="quotebox">「只要你，认真地打算和我战斗。」<br>' +
    '<span class="dim">—— 我不打算再给任何的提示和询问机会。作为见证人，我保证：由以上的情报，可以推测出犯人。</span></div>';
}

/* ---------- 推演 ---------- */
function lockUnlocked(i) { return i === 0 || G.solved.indexOf(LOCKS[i - 1].id) >= 0; }

function tabLocks(b) {
  if (G.curLock) return lockView(b);
  b.innerHTML = '<div class="lede">七道锁，依次解开。答错会留下污点，但不会阻止你继续——除非你想拿到最高的评价。</div>' +
    '<div class="locklist">' + LOCKS.map(function (l, i) {
      var done = G.solved.indexOf(l.id) >= 0;
      var open = lockUnlocked(i);
      var cls = 'litem' + (done ? ' done' : '') + (open ? '' : ' locked');
      return '<button class="' + cls + '" data-lock="' + l.id + '"' + (open ? '' : ' disabled') + '>' +
        '<span class="ln">' + (done ? '✔' : (open ? '▸' : '🔒')) + '</span>' +
        '<span class="lt">' + l.title + '</span>' +
        '<span class="lx">' + (done ? '已解开' : (open ? '挑战' : '需先解开上一锁')) + '</span></button>';
    }).join('') + '</div>' +
    '<div class="lede small">累计失误 <b class="' + (G.wrong ? 'red' : '') + '">' + G.wrong + '</b> 次 · ' +
    '使用提示 <b>' + G.hintUsed + '</b> 次</div>';
  $$('[data-lock]', b).forEach(function (el) {
    el.onclick = function () { G.curLock = el.getAttribute('data-lock'); G.sel = {}; render(); };
  });
}

function lockView(b) {
  var l = null, idx = -1;
  for (var i = 0; i < LOCKS.length; i++) if (LOCKS[i].id === G.curLock) { l = LOCKS[i]; idx = i; }
  if (!l) { G.curLock = null; return render(); }
  if (!lockUnlocked(idx)) { G.curLock = null; return render(); }
  if (l.type === 'people') return peopleLock(b, l);

  var opts = l.options.map(function (o) {
    var on = !!G.sel[o.id];
    return '<button class="opt' + (on ? ' on' : '') + '" data-opt="' + o.id + '">' + o.label + '</button>';
  }).join('');
  b.innerHTML =
    '<div class="lockwrap">' +
      '<div class="lhead"><button class="btn tiny" data-back="1">‹ 推演</button><b>' + l.title + '</b>' +
        '<span class="rs">' + l.sub + '</span></div>' +
      '<div class="lprompt">' + l.prompt.replace(/\n/g, '<br>') + '</div>' +
      '<div class="opts">' + opts + '</div>' +
      '<div class="lactions">' +
        '<button class="btn" data-hint="1">提示</button>' +
        '<button class="btn primary" data-submit="1">确认推理</button>' +
      '</div>' +
      '<div class="fb" id="fb"></div>' +
    '</div>';
  $('[data-back]', b).onclick = function () { G.curLock = null; render(); };
  $$('[data-opt]', b).forEach(function (el) {
    el.onclick = function () {
      var id = el.getAttribute('data-opt');
      if (l.type === 'single') G.sel = {};
      G.sel[id] = !G.sel[id];
      $$('[data-opt]', b).forEach(function (e2) { e2.classList.toggle('on', !!G.sel[e2.getAttribute('data-opt')]); });
    };
  });
  $('[data-hint]', b).onclick = function () {
    G.hintUsed++; save();
    $('#fb', b).innerHTML = '<div class="fbox hint"><b>提示</b>' + l.hint + '</div>';
  };
  $('[data-submit]', b).onclick = function () { grade(b, l); };
}

function peopleLock(b, l) {
  b.innerHTML =
    '<div class="lockwrap">' +
      '<div class="lhead"><button class="btn tiny" data-back="1">‹ 推演</button><b>' + l.title + '</b>' +
        '<span class="rs">' + l.sub + '</span></div>' +
      '<div class="lprompt">' + l.prompt.replace(/\n/g, '<br>') + '</div>' +
      '<div class="pgrid pick">' + PEOPLE.map(function (p) {
        var on = !!G.sel[p.id];
        return '<button class="pcard pick' + (on ? ' on' : '') + '" data-pick="' + p.id + '">' +
          '<img class="pav" src="' + portrait(p.id) + '" alt="">' +
          '<div class="pi"><span class="pn">' + p.n + '</span><span class="pt">' + p.t + '</span></div>' +
          '<span class="chk">' + (on ? '✔' : '') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="lactions">' +
        '<button class="btn" data-hint="1">提示</button>' +
        '<button class="btn primary" data-submit="1">提交指认</button>' +
      '</div>' +
      '<div class="fb" id="fb"></div>' +
    '</div>';
  $('[data-back]', b).onclick = function () { G.curLock = null; render(); };
  $$('[data-pick]', b).forEach(function (el) {
    el.onclick = function () {
      var id = el.getAttribute('data-pick');
      G.sel[id] = !G.sel[id];
      el.classList.toggle('on', !!G.sel[id]);
      $('.chk', el).textContent = G.sel[id] ? '✔' : '';
    };
  });
  $('[data-hint]', b).onclick = function () {
    G.hintUsed++; save();
    $('#fb', b).innerHTML = '<div class="fbox hint"><b>提示</b>' + l.hint + '</div>';
  };
  $('[data-submit]', b).onclick = function () { grade(b, l); };
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) < 0) return false;
  return true;
}

function grade(b, l) {
  var picked = Object.keys(G.sel).filter(function (k) { return G.sel[k]; });
  var fb = $('#fb', b);
  if (!picked.length) { fb.innerHTML = '<div class="fbox warn">还没有选择任何一项。</div>'; return; }
  if (sameSet(picked, l.answer)) {
    if (G.solved.indexOf(l.id) < 0) G.solved.push(l.id);
    save();
    haptic(18);
    fb.innerHTML = '<div class="fbox ok"><b>解开了</b>' + l.explain.replace(/\n/g, '<br>') +
      '<div class="next">' +
      (l.id === 'L7'
        ? '<button class="btn primary" data-go="ending">揭晓真相 ›</button>'
        : '<button class="btn primary" data-go="back">返回推演 ›</button>') +
      '</div></div>';
    $$('[data-go]', fb).forEach(function (g) {
      g.onclick = function () {
        if (g.getAttribute('data-go') === 'ending') { G.ended = true; save(); G.screen = 'ending'; render(); }
        else { G.curLock = null; render(); }
      };
    });
  } else {
    G.wrong++; save();
    haptic(45);
    var missing = l.answer.filter(function (a) { return picked.indexOf(a) < 0; });
    var extra = picked.filter(function (a) { return l.answer.indexOf(a) < 0; });
    var msg = '这个组合无法成立。';
    if (extra.length) msg += '<br><span class="dim">其中至少有一个，是不该被指认的。</span>';
    if (missing.length) msg += '<br><span class="dim">还有该被指认的人，被你漏掉了。</span>';
    fb.innerHTML = '<div class="fbox bad"><b>驳回</b>' + msg + '<div class="next dim">失误 +1</div></div>';
  }
}

/* ---------- 指认 ---------- */
function tabCase(b) {
  var allSolved = G.solved.length >= 7;
  if (!allSolved) {
    b.innerHTML = '<div class="lede">最终的指认，需要先解开七道推理锁。<br>' +
      '<span class="dim">当前进度：' + G.solved.length + ' / 7。</span></div>' +
      '<div class="lede small">去向：<button class="btn tiny" data-go="locks">推演板 ›</button></div>';
    $('[data-go]', b).onclick = function () { G.tab = 'locks'; render(); };
    return;
  }
  b.innerHTML = '<div class="lede">七锁俱开。\n现在，说出他们的名字。</div>' +
    '<div class="finalbox"><button class="btn primary big" data-final="1">开始最终指认</button></div>';
  $('[data-final]', b).onclick = function () { G.curLock = 'L7'; G.sel = {}; G.tab = 'locks'; render(); };
}

/* ---------- 结局 ---------- */
function viewEnding(v) {
  $('#bgwrap').style.display = 'block';
  var rank = G.wrong === 0 && G.hintUsed === 0 ? 'S' : (G.wrong <= 2 ? 'A' : (G.wrong <= 5 ? 'B' : 'C'));
  var names = SOLUTION.culprits.map(function (id) {
    for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].id === id) return PEOPLE[i].n;
    return id;
  }).join('　·　');
  v.innerHTML =
    '<div class="endwrap">' +
      '<div class="endtitle">' + SOLUTION.title + '</div>' +
      '<div class="endnames">' + names + '</div>' +
      '<div class="endhtml">' + SOLUTION.html.map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</div>' +
      '<div class="endh">推演链</div>' +
      '<ol class="endchain">' + SOLUTION.chain.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ol>' +
      '<div class="endrank">评价 <b class="rk r' + rank + '">' + rank + '</b>' +
        '<span class="dim">　失误 ' + G.wrong + ' 次 · 提示 ' + G.hintUsed + ' 次</span></div>' +
      '<div class="endbtns">' +
        '<button class="btn" data-go="hub">回到案卷</button>' +
        '<button class="btn ghost" data-go="reset">重新推理</button>' +
      '</div>' +
    '</div>';
  $$('[data-go]', v).forEach(function (g) {
    g.onclick = function () {
      if (g.getAttribute('data-go') === 'hub') { G.screen = 'hub'; G.tab = 'nights'; render(); }
      else { G.solved = []; G.wrong = 0; G.hintUsed = 0; G.ended = false; save(); G.screen = 'title'; render(); }
    };
  });
}

/* ---------------- 动画 ---------------- */
var last = 0, acc = 0;
function loop(t) {
  var dt = t - last; last = t; acc += dt;
  if (acc > 60) {
    acc = 0; tickRain(t);
    if (G.screen === 'title' || G.screen === 'ending') paint(G.screen, t);
  }
  requestAnimationFrame(loop);
}

/* ---------------- 触屏反馈 ---------------- */
/* WebView 里 navigator.vibrate 时灵时不灵，优先走原生桥 */
function haptic(ms) {
  ms = ms || 12;
  try { if (window.RokNative && window.RokNative.buzz) { window.RokNative.buzz(ms); return; } } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

/* ---------------- 安卓返回键 ---------------- */
/* 壳工程在 onBackPressed 里调它；返回 'exit' 才会真的退出 App */
window.RokAndroidBack = function () {
  try {
    if (G.screen === 'ending') { G.screen = 'hub'; G.tab = 'nights'; render(); return 'handled'; }
    if (G.screen === 'hub') {
      if (G.curNight) { G.curNight = null; render(); return 'handled'; }
      if (G.curLock)  { G.curLock = null;  render(); return 'handled'; }
    }
    if (G.screen !== 'title') { G.screen = 'title'; render(); return 'handled'; }
    return 'exit';
  } catch (e) { return 'exit'; }
};

/* ---------------- 启动 ---------------- */
window.RK = {
  G: G, LOCKS: LOCKS, PEOPLE: PEOPLE, NIGHTS: NIGHTS,
  draw: function () { render(); },
  paint: function (k) { paint(k, 0); }
};

function boot() {
  load();
  G.screen = 'title';
  G.curLock = null; G.curNight = null;
  render();
  paint('title', 0);
  requestAnimationFrame(loop);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
