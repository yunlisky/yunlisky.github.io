/* ============================================================
   灯塔 · BEACON  ——  数据层（改这里，不用动引擎）
   ------------------------------------------------------------
   玩法：你在礁石灯塔上，四周全是雾。只有一道光。
        转动光柱把逼近的雾影烧尽，别让它们碰到塔。
   ============================================================ */

const BEACON = {

  /* ---------- 画布 ---------- */
  V: 320,            // 逻辑分辨率（正方形，会被整数感放大）

  /* ---------- 光柱 ---------- */
  BEAM_HALF: 0.150,  // 半角（弧度）≈ 8.6°，全宽约 17°
  BEAM_SPEED: 3.30,  // 最大角速度 rad/s —— 决定了「转向的迟滞感」
  HEAT_RATE: 1.45,   // 正对光心时的升温速率 /秒
  HEAT_EDGE: 0.35,   // 擦到光柱边缘时的升温速率（衰减后的最低值）
  COOL_RATE: 0.60,   // 离开光柱后的降温速率 /秒

  /* ---------- 塔与生命 ---------- */
  HP: 3,
  INVULN: 1.10,      // 受伤后的无敌秒数
  R_EDGE: 182,       // 出怪半径（在画面外）
  R_CORE: 15,        // 碰到这里就算突破

  /* ---------- 脉冲（唯一的资源） ---------- */
  PULSE_CD: 11,      // 冷却秒数
  PULSE_R: 66,       // 清怪半径

  /* ---------- 敌人 ---------- */
  /* hp   = 需要照射的总热量（秒·倍率）
     spd  = 每秒靠近的像素
     size = 视觉半径（同时也是受击的角度容差来源） */
  TYPES: {
    drift: { hp: 1.0, spd: 9.0, score: 10, size: 4.2, col: '#5a6988', split: 0 },
    swift: { hp: 0.7, spd: 17.0, score: 16, size: 3.2, col: '#2ce8f5', split: 0 },
    husk: { hp: 3.0, spd: 5.6, score: 30, size: 6.6, col: '#be4a2f', split: 0 },
    spawn: { hp: 1.3, spd: 11.0, score: 20, size: 5.0, col: '#63c74d', split: 2 }
  },

  /* ---------- 波次 ---------- */
  /* gap  = 同一波里两只怪的间隔秒数；list 按顺序放，角度随机 */
  WAVES: [
    { gap: 0.85, list: ['drift', 'drift', 'drift', 'drift', 'drift'] },
    { gap: 0.80, list: ['drift', 'drift', 'drift', 'swift', 'drift', 'drift', 'swift'] },
    { gap: 0.74, list: ['drift', 'swift', 'drift', 'swift', 'drift', 'swift', 'drift', 'swift'] },
    { gap: 0.68, list: ['husk', 'drift', 'swift', 'drift', 'swift', 'husk', 'drift', 'swift', 'drift'] },
    { gap: 0.62, list: ['spawn', 'drift', 'swift', 'spawn', 'drift', 'swift', 'drift', 'swift', 'drift', 'swift'] },
    { gap: 0.56, list: ['husk', 'swift', 'drift', 'husk', 'swift', 'drift', 'spawn', 'swift', 'drift', 'swift', 'drift', 'swift'] },
    { gap: 0.50, list: ['spawn', 'husk', 'swift', 'drift', 'swift', 'husk', 'drift', 'swift', 'spawn', 'drift', 'swift', 'drift', 'swift', 'drift'] },
    { gap: 0.44, list: ['husk', 'spawn', 'swift', 'swift', 'drift', 'husk', 'spawn', 'swift', 'drift', 'swift', 'drift', 'swift', 'drift', 'swift', 'drift', 'drift'] }
  ],

  /* 每多一波，怪的速度乘上去一点（难度爬升） */
  SPD_PER_WAVE: 0.035,

  /* 波间喘息秒数 */
  BREAK: 2.6,

  /* 通关/结算奖励 */
  BONUS_WAVE: 20,     // 每清一波
  BONUS_LIFE: 120,    // 每剩一命

  /* ---------- 存档键 ---------- */
  KEY_BEST: 'beacon.best'
};

/* 顶层 const 不会自动挂到 window 上（探针页/控制台要读，这里显式暴露一份） */
if (typeof window !== 'undefined') window.BEACON = BEACON;
