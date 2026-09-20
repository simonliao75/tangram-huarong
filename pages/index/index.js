const LEVELS = require('./levels.js');

Page({
  data: {},

  onLoad() {
    this.initGame();
  },

  async initGame() {
    // 获取系统信息
    const sys = wx.getWindowInfo();
    let W = sys.windowWidth;
    let H = sys.windowHeight;
    let DPR = sys.pixelRatio || 1;
    let safeTop = 0, safeBottom = 0;
    if (sys.safeArea) {
      safeTop = Math.max(0, sys.safeArea.top || 0);
      safeBottom = Math.max(0, H - (sys.safeArea.bottom || H));
    }

    // 获取 canvas 节点
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        // 设置画布大小
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        ctx.scale(DPR, DPR);

        this.canvas = canvas;
        this.ctx = ctx;
        this.W = W;
        this.H = H;
        this.DPR = DPR;
        this.safeTop = safeTop;
        this.safeBottom = safeBottom;

        // 初始化游戏状态
        this.initState();

        // 启动游戏循环
        this.lastTime = 0;
        const loop = (now) => {
          this.render(now);
          this.raf = canvas.requestAnimationFrame(loop);
        };
        canvas.requestAnimationFrame(loop);
      });
  },

  initState() {
    // 常量与关卡数据
    this.BOX = 3;
    this.EPS = 1e-6;
    this.GOAL = [1, 0];
    this.DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
    this.DIR_NAME = {"1,0":"右","-1,0":"左","0,1":"上","0,-1":"下","1,1":"右上","1,-1":"右下","-1,1":"左上","-1,-1":"左下"};

    // 多关卡：数据来自 levels.js（每关含目标块 goal 与出口偏移 GOAL）
    this.levelIndex = 0;
    this.setLevel(0);

    // 状态
    this.pieces = null;
    this.moves = 0;
    this.won = false;
    this.selected = null;
    this.undoStack = [];
    this.t0 = null;
    this.timerHandle = null;
    this.timeText = '00:00';
    this.pauseAt = null;
    this.hintUntil = 0;
    this.hintId = null;
    this.shake = null;
    this.goalFlashUntil = 0;
    this.hintLineText = '把蓝色方块移到底部正中的蓝框（出口）｜按住棋子拖动，或点选后用方向盘';
    this.hintPieceId = null;
    this.hintCount = this.loadHintCount();   // 累计使用提示次数（跨会话持久化）
    this.hintConsumed = true;                // 上次提示是否已被棋盘操作消耗

    // 布局
    this.PAD = 12;
    this.B = 300;
    this.bx = 0;
    this.by = 0;
    this.hudTop = 12;
    this.hintY = 52;
    this.dpadBtns = [];
    this.ctrlBtns = [];
    this.againBtn = null;
    this.restartBtn = null;
    this.confirmRestart = false;   // 重新闯关二次确认弹窗
    this.dpadTop = 0;
    this.ctrlTop = 0;

    // 拖拽状态
    this.drag = null;
    this.resX = 0;
    this.resY = 0;

    this.reset();
    this.layout();
  },

  setLevel(idx) {
    idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
    this.levelIndex = idx;
    this.LEVEL = LEVELS[idx];
    this.GOAL = this.LEVEL.goal.slice();
    this.optimal = this.LEVEL.optimal;
  },

  gotoLevel(idx) {
    this.confirmRestart = false;
    this.setLevel(idx);
    this.reset();
    this.layout();
  },

  restartAdventure() {
    // 完全重置：清空所有关卡进度、连击、累计提示次数，从第一关重新闯关
    try {
      wx.removeStorageSync('tangram_best');
      wx.removeStorageSync('tangram_combo');
      wx.removeStorageSync('tangram_hints');
    } catch (e) {}
    this.confirmRestart = false;
    this.hintConsumed = true;
    this.hintCount = 0;      // HUD 提示次数归零
    this.setLevel(0);
    this.reset();
    this.layout();
    this.hintLine('已重新开始，从第一关闯关吧！');
  },

  starsFor(m) {
    return m <= this.optimal ? 3 : m <= this.optimal + 5 ? 2 : 1;
  },

  loadAllBest() {
    try { return wx.getStorageSync('tangram_best') || {}; } catch (e) { return {}; }
  },

  levelStars(id) {
    const b = this.loadAllBest()[id];
    return b ? (b.stars || 1) : 0;
  },

  totalStars() {
    return LEVELS.reduce((s, L) => s + this.levelStars(L.id), 0);
  },

  isUnlocked(idx) {
    if (idx <= 0) return true;
    return this.levelStars(LEVELS[idx - 1].id) > 0;
  },

  layout() {
    const W = this.W;
    const H = this.H;
    const safeTop = this.safeTop;
    const safeBottom = this.safeBottom;

    const cell = 46;
    const gap = 5;
    const grid = 3 * cell + 2 * gap;
    const hudH = 56;
    const hintH = 22;
    const gapB = 14;
    const gapC = 16;
    const gapNav = 12;
    const navH = 42;
    const padT = 16;
    const padB = 16;
    const padTop = Math.max(padT, safeTop + 8);
    const padBot = Math.max(padB, safeBottom + 12);

    const boardMaxW = Math.floor((W - 2 * this.PAD) * 0.75);
    const restartH = 50;   // 重新闯关按钮行的高度（40 + 10 上边距）
    let B = Math.floor(Math.min(boardMaxW, H - (padTop + hudH + hintH + grid + 44 + gapB + gapC + navH + gapNav + restartH + padBot), 340));
    if (B < 140) B = 140;

    const totalH = padTop + hudH + hintH + B + gapB + grid + gapC + 44 + gapNav + navH + restartH + padBot;
    let topPad = Math.max(padTop, Math.floor((H - totalH) / 2));

    if (topPad + totalH > H - safeBottom) {
      B = Math.max(120, B - (topPad + totalH - (H - safeBottom)));
      topPad = padTop;
    }

    this.B = B;
    this.hudTop = topPad + 10;
    this.hintY = this.hudTop + hudH - 6;
    this.by = this.hintY + hintH + 6;
    this.bx = Math.floor((W - B) / 2);
    this.dpadTop = this.by + B + gapB;
    this.ctrlTop = this.dpadTop + grid + gapC;

    const gx = Math.floor((W - grid) / 2);
    this.dpadBtns = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = gx + c * (cell + gap);
        const y = this.dpadTop + r * (cell + gap);
        const label = r === 1 && c === 1 ? '·' : ['↖','↑','↗','←','·','→','↙','↓','↘'][r * 3 + c];
        const d = r === 1 && c === 1 ? null : [[-1,1],[0,1],[1,1],[-1,0],null,[1,0],[-1,-1],[0,-1],[1,-1]][r * 3 + c];
        this.dpadBtns.push({ x, y, w: cell, h: cell, label, d });
      }
    }

    const cw = Math.floor((W - 2 * this.PAD - 16) / 3);
    const ch = 44;
    this.ctrlBtns = [
      { x: this.PAD, y: this.ctrlTop, w: cw, h: ch, label: '撤销', primary: false, action: 'undo' },
      { x: this.PAD + cw + 8, y: this.ctrlTop, w: cw, h: ch, label: '重开', primary: false, action: 'reset' },
      { x: this.PAD + 2 * (cw + 8), y: this.ctrlTop, w: cw, h: ch, label: '提示', primary: true, action: 'hint' },
    ];

    const aw = 150;
    const ah = 46;
    this.againBtn = { x: Math.floor((W - aw) / 2), y: 0, w: aw, h: ah, label: '再玩一次', primary: true };

    // 关卡切换按钮（底部）
    const nw = Math.floor((W - 2 * this.PAD - 12) / 2);
    const ny = this.ctrlTop + 44 + gapNav;
    this.navBtns = [
      { x: this.PAD, y: ny, w: nw, h: navH, label: '‹ 上一关', action: 'prev', enabled: this.levelIndex > 0 },
      { x: this.PAD + nw + 12, y: ny, w: nw, h: navH, label: this.isUnlocked(this.levelIndex + 1) ? '下一关 ›' : '🔒 下一关', action: 'next', enabled: this.isUnlocked(this.levelIndex + 1) },
    ];

    // 重新闯关：危险操作，单独一行、红色样式，与常规按钮分开
    this.restartBtn = {
      x: this.PAD, y: ny + navH + 10, w: W - 2 * this.PAD, h: 40,
      label: '🏁 重新闯关', action: 'restart', danger: true
    };
  },

  modelToCanvas(p) {
    const s = this.B / this.BOX;
    return [this.bx + p[0] * s, this.by + (this.BOX - p[1]) * s];
  },

  clientToModel(cx, cy) {
    const s = this.B / this.BOX;
    return { x: (cx - this.bx) / s, y: this.BOX - (cy - this.by) / s };
  },

  translate(poly, ox, oy) {
    return poly.map(([x, y]) => [x + ox, y + oy]);
  },

  worldOf(p, ox = p.offset[0], oy = p.offset[1]) {
    return this.translate(p.poly, ox, oy);
  },

  centroid(poly) {
    let sx = 0, sy = 0;
    for (const [x, y] of poly) { sx += x; sy += y; }
    return [sx / poly.length, sy / poly.length];
  },

  circled(n) {
    return String.fromCharCode(0x245F + n);
  },

  inBox(poly) {
    return poly.every(([x, y]) => x >= -this.EPS && y >= -this.EPS && x <= this.BOX + this.EPS && y <= this.BOX + this.EPS);
  },

  project(poly, ax) {
    let mn = Infinity, mx = -Infinity;
    for (const [x, y] of poly) {
      const d = x * ax[0] + y * ax[1];
      if (d < mn) mn = d;
      if (d > mx) mx = d;
    }
    return [mn, mx];
  },

  overlaps(a, b) {
    const ps = [a, b];
    for (const p of ps) {
      for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i];
        const [x2, y2] = p[(i + 1) % p.length];
        const ax = [-(y2 - y1), x2 - x1];
        const [a0, a1] = this.project(a, ax);
        const [b0, b1] = this.project(b, ax);
        if (a1 <= b0 + this.EPS || b1 <= a0 + this.EPS) return false;
      }
    }
    return true;
  },

  pointIn(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  },

  piece(id) {
    return this.pieces.find(p => p.id === id);
  },

  cross(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  },

  convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const n = p.length;
    if (n <= 1) return p;
    const lower = [], upper = [];
    for (let i = 0; i < n; i++) {
      while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], p[i]) <= 0) lower.pop();
      lower.push(p[i]);
    }
    for (let i = n - 1; i >= 0; i--) {
      while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 0) upper.pop();
      upper.push(p[i]);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  },

  sweptOf(p, ox, oy, nx, ny) {
    return this.convexHull(this.worldOf(p, ox, oy).concat(this.worldOf(p, nx, ny)));
  },

  canPlace(offs, i, ox, oy) {
    const poly = this.translate(this.pieces[i].poly, ox, oy);
    if (!this.inBox(poly)) return false;
    const swept = this.sweptOf(this.pieces[i], offs[i][0], offs[i][1], ox, oy);
    for (let j = 0; j < this.pieces.length; j++) {
      if (j !== i && this.overlaps(swept, this.translate(this.pieces[j].poly, offs[j][0], offs[j][1]))) return false;
    }
    return true;
  },

  offsets() {
    return this.pieces.map(p => p.offset.slice());
  },

  keyOf(offs) {
    return offs.map(o => o[0] + ',' + o[1]).join('|');
  },

  isWinState(offs) {
    const g = this.pieces.findIndex(p => p.goal);
    return Math.abs(offs[g][0] - this.GOAL[0]) < this.EPS && Math.abs(offs[g][1] - this.GOAL[1]) < this.EPS;
  },

  tryMove(id, dx, dy) {
    if (this.won) return false;
    const i = this.pieces.findIndex(p => p.id === id);
    if (i < 0) return false;
    const cur = this.offsets();
    if (!this.canPlace(cur, i, cur[i][0] + dx, cur[i][1] + dy)) {
      this.doShake(id);
      return false;
    }
    this.undoStack.push(cur);
    this.pieces[i].offset = [cur[i][0] + dx, cur[i][1] + dy];
    if (!this.t0) { this.t0 = Date.now(); this.startTimer(); }
    this.moves++;
    this.hintLine('');
    this.hintConsumed = true;   // 棋盘被有效操作，消耗掉上一次提示，允许下次提示计数
    if (this.isWinState(this.offsets())) this.win();
    return true;
  },

  undo() {
    if (this.won || !this.undoStack.length) return;
    const offs = this.undoStack.pop();
    this.pieces.forEach((p, i) => p.offset = offs[i].slice());
    if (this.moves > 0) this.moves--;
    this.hintLine('');
  },

  reset() {
    this.pieces = this.LEVEL.pieces.map(p => ({ ...p, poly: p.poly.map(v => v.slice()), offset: p.offset.slice() }));
    this.moves = 0;
    this.won = false;
    this.selected = null;
    this.undoStack = [];
    this.stopTimer();
    this.t0 = null;
    this.timeText = '00:00';
    this.pauseAt = null;
    const gn = this.pieces.find(p => p.goal).name.replace('(目标)', '');
    this.hintLine('把【' + gn + '】移到虚线框（出口）｜按住棋子拖动，或点选后用方向盘');
    if (this.hintId) { clearTimeout(this.hintId); this.hintId = null; }
    this.hintUntil = 0;
    this.shake = null;
    this.newRecord = false;
    this.prevBestMoves = null;
    this.comboBanner = null;
    this.goalFlashUntil = Date.now() + 3000;   // 每关开始闪烁提示目标块 3 秒
  },

  startTimer() {
    if (this.timerHandle) return;
    this.timerHandle = setInterval(() => {
      this.timeText = this.fmt(Date.now() - this.t0);
    }, 250);
  },

  stopTimer() {
    if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; }
  },

  fmt(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  },

  win() {
    this.won = true;
    this.stopTimer();
    const timeMs = Date.now() - this.t0;
    const stars = this.starsFor(this.moves);
    const prevBest = this.loadAllBest()[this.LEVEL.id];
    // 记录破纪录信息供弹窗显示
    if (prevBest && this.moves < prevBest.moves) this.newRecord = true;
    else if (prevBest && stars > (prevBest.stars || 1)) this.newRecord = true;
    else this.newRecord = false;
    this.prevBestMoves = prevBest ? prevBest.moves : null;
    this.saveBest(this.moves, timeMs, stars);
    // 连击彩蛋：3 星累加，否则清零
    let combo = this.loadCombo();
    if (stars === 3) { combo++; this.saveCombo(combo); }
    else { combo = 0; this.saveCombo(0); }
    const txt = this.comboText(combo);
    this.comboBanner = txt ? { text: txt, tier: combo >= 7 ? 2 : combo >= 5 ? 1 : 0 } : null;
    // 通关后刷新导航按钮（解锁下一关）
    if (this.navBtns) {
      this.navBtns[1].enabled = this.isUnlocked(this.levelIndex + 1);
      this.navBtns[1].label = this.isUnlocked(this.levelIndex + 1) ? '下一关 ›' : '🔒 下一关';
    }
  },

  saveBest(moves, timeMs, stars) {
    try {
      const prev = wx.getStorageSync('tangram_best') || {};
      const cur = prev[this.LEVEL.id] || { moves: Infinity, timeMs: Infinity };
      const better = moves < cur.moves || (moves === cur.moves && timeMs < cur.timeMs);
      if (better) {
        prev[this.LEVEL.id] = { moves, timeMs, stars, at: new Date().toISOString() };
        wx.setStorageSync('tangram_best', prev);
      }
    } catch (e) {}
  },

  loadCombo() {
    try { return parseInt(wx.getStorageSync('tangram_combo') || '0', 10); } catch (e) { return 0; }
  },

  saveCombo(v) {
    try { wx.setStorageSync('tangram_combo', String(v)); } catch (e) {}
  },

  comboText(combo) {
    if (combo >= 7) return '🏆 全满星通关！你是七巧板大师！';
    if (combo >= 5) return '🔥 五连绝世！势不可挡！';
    if (combo >= 3) return '🎉 连过三关全三星！太棒了！';
    return '';
  },

  loadHintCount() {
    try { return parseInt(wx.getStorageSync('tangram_hints') || '0', 10); } catch (e) { return 0; }
  },

  saveHintCount(v) {
    try { wx.setStorageSync('tangram_hints', String(v)); } catch (e) {}
  },

  hintLine(t) {
    this.hintLineText = t;
  },

  doShake(id) {
    this.shake = { id, t0: Date.now() };
  },

  rr(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  drawPoly(poly, fill, stroke, sw) {
    const ctx = this.ctx;
    ctx.beginPath();
    poly.forEach((pt, i) => {
      const c = this.modelToCanvas(pt);
      if (i === 0) ctx.moveTo(c[0], c[1]);
      else ctx.lineTo(c[0], c[1]);
    });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.lineJoin = 'round'; ctx.stroke(); }
  },

  drawBtn(b) {
    const ctx = this.ctx;
    ctx.save();
    this.rr(b.x, b.y, b.w, b.h, 9);
    if (b.danger) {
      if (b.primary) {          // 红色实底（确认按钮）
        ctx.fillStyle = '#E23B2E';
        ctx.fill();
        ctx.strokeStyle = '#E23B2E';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fff';
      } else {                  // 红色描边白底（危险提示按钮）
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#E23B2E';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#E23B2E';
      }
    } else {
      ctx.fillStyle = b.primary ? '#327C99' : '#fff';
      ctx.fill();
      ctx.strokeStyle = b.primary ? '#327C99' : '#ccc';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = b.primary ? '#fff' : '#333';
    }
    ctx.font = b.danger ? 'bold 15px sans-serif' : '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.restore();
  },

  render(now) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    // 背景
    ctx.fillStyle = '#F5F3EE';
    ctx.fillRect(0, 0, W, H);

    // 标题与 HUD
    ctx.fillStyle = '#222';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('七巧板华容道', this.PAD, this.hudTop + 14);
    // 关卡名徽章（醒目）：蓝色渐变圆角底 + 白字加粗
    ctx.font = 'bold 15px sans-serif';
    const badgeText = this.LEVEL.name;
    const badgeW = ctx.measureText(badgeText).width + 24;
    const badgeH = 28;
    const badgeY = this.hudTop + 26;
    const grad = ctx.createLinearGradient(this.PAD, badgeY, this.PAD + badgeW, badgeY);
    grad.addColorStop(0, '#327C99');
    grad.addColorStop(1, '#0a84ff');
    ctx.save();
    this.rr(this.PAD, badgeY, badgeW, badgeH, 14);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, this.PAD + 12, badgeY + badgeH / 2 + 1);
    ctx.restore();
    // 进度：本关星级 + 总星
    const ls = this.levelStars(this.LEVEL.id);
    ctx.fillStyle = '#CAAC33';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('★'.repeat(ls) + '☆'.repeat(3 - ls) + ' ｜ ' + this.totalStars() + '/' + (LEVELS.length * 3) + ' 星', this.PAD, this.hudTop + 52);
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    const hudW = 96, hudGap = 10;
    // 三个 HUD box：提示次数 | 计时 | 步数
    const hintW = 72;
    const totalW = hintW + hudW * 2 + hudGap * 2;
    const x0 = W - this.PAD - totalW;
    this.rr(x0, this.hudTop, hintW, 28, 8);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('💡' + this.hintCount, x0 + hintW - 6, this.hudTop + 14);
    this.rr(x0 + hintW + hudGap, this.hudTop, hudW, 28, 8);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('⏱' + this.timeText, x0 + hintW + hudGap + hudW - 6, this.hudTop + 14);
    this.rr(x0 + hintW + hudGap * 2 + hudW, this.hudTop, hudW, 28, 8);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('步数 ' + this.moves + ' / ' + this.optimal, x0 + hintW + hudGap * 2 + hudW * 2 - 6, this.hudTop + 14);

    // 提示行
    ctx.fillStyle = '#777';
    ctx.font = this.hintLineText.length > 30 ? '11px sans-serif' : '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.hintLineText, W / 2, this.hintY + 11);

    // 棋盘底
    this.rr(this.bx - 6, this.by - 6, this.B + 12, this.B + 12, 10);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();

    // 棋盘
    this.drawPoly([[0,0],[3,0],[3,3],[0,3]], '#fff', '#222', Math.max(1, 0.01 * this.B));

    // 棋子
    const nowMs = now || Date.now();
    let shakeDx = 0;
    for (let idx = 0; idx < this.pieces.length; idx++) {
      const p = this.pieces[idx];
      shakeDx = 0;
      if (this.shake && this.shake.id === p.id) {
        const t = (nowMs - this.shake.t0) / 280;
        if (t < 1) shakeDx = 7 * Math.sin(t * Math.PI * 2) * (1 - t);
        else this.shake = null;
      }
      ctx.save();
      ctx.translate(shakeDx, 0);
      const poly = this.worldOf(p).map(([x, y]) => [x, y]);
      let sw = p.goal ? Math.max(1, 0.006 * this.B) : Math.max(1, 0.004 * this.B);
      let sc = '#3A3A3A';
      // 目标块闪烁：每关开始 3 秒内，目标块描边蓝色脉冲
      if (p.goal && nowMs < this.goalFlashUntil) {
        const t = (nowMs % 1000) / 1000;              // 0~1 秒循环
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2); // 0~1 脉冲
        sc = '#0a84ff';
        sw = Math.max(2, 0.018 * this.B) + pulse * 0.02 * this.B;
        ctx.shadowColor = '#0a84ff';
        ctx.shadowBlur = 4 + pulse * 14;
      }
      if (this.selected === p.id) { sc = '#0a84ff'; sw = Math.max(2, 0.018 * this.B); }
      if (this.hintUntil && nowMs < this.hintUntil && p.id === (this.hintPieceId || '')) { sc = '#ff8c00'; sw = Math.max(2, 0.018 * this.B); }
      this.drawPoly(poly, p.color, sc, sw);
      ctx.shadowBlur = 0;
      const [cx, cy] = this.centroid(p.poly);
      const [tx, ty] = this.modelToCanvas([cx + p.offset[0], cy + p.offset[1]]);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = Math.max(1, 0.005 * this.B);
      ctx.font = 'bold ' + Math.max(12, 0.065 * this.B) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(this.circled(idx + 1), tx, ty);
      ctx.fillText(this.circled(idx + 1), tx, ty);
      ctx.restore();
    }

    // 出口：按目标块形状在 GOAL 偏移处绘制虚线轮廓（支持任意位置/任意块）
    ctx.save();
    const gp = this.pieces.find(p => p.goal);
    if (gp) {
      const exitPoly = this.worldOf({ poly: gp.poly }, this.GOAL[0], this.GOAL[1]);
      ctx.beginPath();
      exitPoly.forEach((pt, i) => {
        const c = this.modelToCanvas(pt);
        if (i === 0) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]);
      });
      ctx.closePath();
      ctx.setLineDash([Math.max(4, 0.05 * this.B), Math.max(3, 0.03 * this.B)]);
      ctx.strokeStyle = '#0a84ff';
      ctx.lineWidth = Math.max(2, 0.018 * this.B);
      ctx.stroke();
    }
    ctx.restore();

    // 方向盘
    for (const b of this.dpadBtns) {
      ctx.save();
      this.rr(b.x, b.y, b.w, b.h, 10);
      ctx.fillStyle = (b.d === null) ? '#f0f0f0' : '#fff';
      ctx.fill();
      ctx.strokeStyle = b.d === null ? '#ddd' : '#ccc';
      ctx.lineWidth = 1;
      if (b.d === null) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = b.d === null ? '#999' : '#333';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      ctx.restore();
    }

    // 控制按钮
    for (const b of this.ctrlBtns) this.drawBtn(b);

    // 关卡切换按钮
    for (const b of this.navBtns) {
      ctx.save();
      this.rr(b.x, b.y, b.w, b.h, 9);
      const dis = !b.enabled;
      ctx.fillStyle = dis ? '#f0f0f0' : '#fff';
      ctx.fill();
      ctx.strokeStyle = dis ? '#ddd' : '#ccc';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = dis ? '#bbb' : '#333';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      ctx.restore();
    }

    // 重新闯关按钮（危险操作，红色，单独一行）
    if (this.restartBtn) this.drawBtn(this.restartBtn);

    // 胜利弹窗
    if (this.won) {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(0, 0, W, H);
      const cw = Math.min(W - 64, 320);
      const chh = this.comboBanner ? 290 : 240;
      const cx = (W - cw) / 2;
      const cy = (H - chh) / 2 - 30;
      this.rr(cx, cy, cw, chh, 16);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.fillStyle = '#327C99';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('过关！', W / 2, cy + 44);
      const stars = this.starsFor(this.moves);
      ctx.fillStyle = '#FFB800';
      ctx.font = '32px sans-serif';
      ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), W / 2, cy + 92);
      ctx.fillStyle = '#555';
      ctx.font = '14px sans-serif';
      ctx.fillText('步数 ' + this.moves + ' · 用时 ' + this.fmt(Date.now() - this.t0), W / 2, cy + 132);
      if (this.newRecord) {
        ctx.fillStyle = '#E23B2E';
        ctx.font = '13px sans-serif';
        ctx.fillText('🏆 新纪录！', W / 2, cy + 152);
      } else if (this.prevBestMoves != null) {
        ctx.fillStyle = '#888';
        ctx.font = '12px sans-serif';
        ctx.fillText('最佳 ' + this.prevBestMoves + ' 步', W / 2, cy + 152);
      }
      // 连击彩蛋横幅
      if (this.comboBanner) {
        const cb = this.comboBanner;
        const bw = Math.min(cw - 40, ctx.measureText(cb.text).width + 40);
        const bh = 34;
        const by = cy + 178;
        const bx = W / 2 - bw / 2;
        const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
        if (cb.tier >= 2) { grad.addColorStop(0, '#9C27B0'); grad.addColorStop(1, '#E23B2E'); }
        else if (cb.tier >= 1) { grad.addColorStop(0, '#E23B2E'); grad.addColorStop(1, '#FF6A00'); }
        else { grad.addColorStop(0, '#FF8C00'); grad.addColorStop(1, '#FFB800'); }
        ctx.save();
        this.rr(bx, by, bw, bh, 17);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cb.text, W / 2, by + bh / 2 + 1);
        ctx.restore();
      }
      const hasNext = this.levelIndex < LEVELS.length - 1 && this.isUnlocked(this.levelIndex + 1);
      if (hasNext) {
        this.nextBtn = { x: Math.floor((W - 150) / 2), y: cy + chh - 70, w: 150, h: 46, label: '下一关 ›', primary: true };
        this.againBtn.y = cy + chh - 122;
        this.againBtn.label = '重玩本关';
        this.againBtn.primary = false;
        this.drawBtn(this.nextBtn);
        this.drawBtn(this.againBtn);
      } else {
        this.nextBtn = null;
        this.againBtn.y = cy + chh - 70;
        this.againBtn.label = '再玩一次';
        this.againBtn.primary = true;
        this.drawBtn(this.againBtn);
      }
    }

    // 重新闯关二次确认弹窗
    if (this.confirmRestart) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      const cw = Math.min(W - 64, 320);
      const chh = 190;
      const cx = (W - cw) / 2;
      const cy = (H - chh) / 2 - 30;
      this.rr(cx, cy, cw, chh, 16);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.fillStyle = '#E23B2E';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠️ 重新闯关？', W / 2, cy + 44);
      ctx.fillStyle = '#555';
      ctx.font = '13px sans-serif';
      ctx.fillText('将清空所有关卡进度与星级，', W / 2, cy + 82);
      ctx.fillText('从第一关重新开始，不可撤销。', W / 2, cy + 102);
      const bw = Math.floor((cw - 60) / 2);
      const by = cy + chh - 58;
      this.confirmCancelBtn = { x: cx + 20, y: by, w: bw, h: 40, label: '取消', primary: false };
      this.confirmOkBtn = { x: cx + 40 + bw, y: by, w: bw, h: 40, label: '确认重置', primary: true, danger: true };
      this.drawBtn(this.confirmCancelBtn);
      this.drawBtn(this.confirmOkBtn);
    }
  },

  hitTest(p) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      if (this.pointIn([p.x, p.y], this.worldOf(this.pieces[i]))) return this.pieces[i];
    }
    return null;
  },

  snap8(x, y) {
    const a = Math.atan2(y, x);
    const idx = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return this.DIRS[idx];
  },

  onDragMove(p) {
    if (!this.drag) return;
    this.resX += p.x - this.drag.lx;
    this.resY += p.y - this.drag.ly;
    this.drag.lx = p.x;
    this.drag.ly = p.y;
    const dir = this.snap8(this.resX, this.resY);
    // 沿「识别出的移动方向」的位移（格）来计步。
    // 旧写法 n = floor(min(|resX|,|resY|))：斜向一步要求两个轴都拖满一整格，
    //   45° 要拖 1.41 格、30°/60° 要拖 2 格，且没到阈值时静默不动、毫无提示，
    //   玩家会误以为"这个方向被规则挡住了"（实际规则是允许的）。
    // 改成投影后：沿该方向拖 1 格 = 走 1 步，任何角度手感一致；正交方向行为不变。
    const dirLen = Math.hypot(dir[0], dir[1]);
    const proj = Math.max(0, (this.resX * dir[0] + this.resY * dir[1]) / dirLen);
    const n = Math.min(Math.floor(proj + 1e-9), 6);
    let done = 0;
    for (let k = 0; k < n; k++) {
      if (!this.tryMove(this.drag.id, dir[0], dir[1])) break;
      done++;
    }
    this.resX -= dir[0] * done;
    this.resY -= dir[1] * done;
    if (done < n) {
      this.resX = 0;
      this.resY = 0;
      if (this.drag && !this.drag.blockHint) {
        this.drag.blockHint = true;
        this.hintLine('往「' + (this.DIR_NAME[dir[0] + ',' + dir[1]] || '该') + '」走不了，换个方向试试');
      }
    }
  },

  endDrag() {
    this.drag = null;
    this.resX = 0;
    this.resY = 0;
  },

  ptInRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  },

  onTouchStart(e) {
    const t = e.touches[0];
    if (!t) return;
    const cx = t.x;
    const cy = t.y;

    // 二次确认弹窗优先处理
    if (this.confirmRestart) {
      if (this.confirmCancelBtn && this.ptInRect(cx, cy, this.confirmCancelBtn)) { this.confirmRestart = false; return; }
      if (this.confirmOkBtn && this.ptInRect(cx, cy, this.confirmOkBtn)) {
        this.confirmRestart = false;
        this.restartAdventure();
        return;
      }
      return;   // 点击弹窗其他区域不做任何事
    }

    if (this.won) {
      if (this.ptInRect(cx, cy, this.againBtn)) { this.reset(); return; }
      if (this.nextBtn && this.ptInRect(cx, cy, this.nextBtn)) { this.gotoLevel(this.levelIndex + 1); return; }
      return;
    }
    for (const b of this.ctrlBtns) {
      if (this.ptInRect(cx, cy, b)) {
        if (b.action === 'undo') this.undo();
        else if (b.action === 'reset') this.reset();
        else if (b.action === 'hint') this.hint();
        return;
      }
    }
    for (const b of this.navBtns) {
      if (b.enabled && this.ptInRect(cx, cy, b)) {
        this.gotoLevel(this.levelIndex + (b.action === 'next' ? 1 : -1));
        return;
      }
    }
    // 重新闯关按钮：先弹二次确认
    if (this.restartBtn && this.ptInRect(cx, cy, this.restartBtn)) {
      this.confirmRestart = true;
      return;
    }
    for (const b of this.dpadBtns) {
      if (b.d && this.ptInRect(cx, cy, b)) {
        if (!this.selected) { this.hintLine('先点击选中一块棋子'); return; }
        this.tryMove(this.selected, b.d[0], b.d[1]);
        return;
      }
    }
    const p = this.clientToModel(cx, cy);
    const pc = this.hitTest(p);
    this.selected = pc ? pc.id : null;
    if (!pc) return;
    this.drag = { id: pc.id, lx: p.x, ly: p.y, blockHint: false };
    this.resX = 0;
    this.resY = 0;
  },

  onTouchMove(e) {
    const t = e.touches[0];
    if (!t) return;
    const cx = t.x;
    const cy = t.y;
    this.onDragMove(this.clientToModel(cx, cy));
  },

  onTouchEnd() {
    this.endDrag();
  },

  onTouchCancel() {
    this.endDrag();
  },

  solve() {
    const start = this.offsets();
    if (this.isWinState(start)) return [];
    const g = this.pieces.findIndex(p => p.goal);
    const startKey = this.keyOf(start);
    const prev = new Map([[startKey, null]]);
    const mv = new Map();
    const q = [start];
    let limit = 200000;
    while (q.length && limit-- > 0) {
      const cur = q.shift();
      for (let i = 0; i < this.pieces.length; i++) {
        for (const [dx, dy] of this.DIRS) {
          const ns = cur.map(o => o.slice());
          ns[i][0] += dx;
          ns[i][1] += dy;
          if (!this.canPlace(cur, i, ns[i][0], ns[i][1])) continue;
          const k = this.keyOf(ns);
          if (prev.has(k)) continue;
          prev.set(k, cur);
          mv.set(k, [this.pieces[i].id, dx, dy]);
          if (this.isWinState(ns)) {
            const path = [];
            let s = k;
            while (s !== startKey) {
              path.push(mv.get(s));
              s = this.keyOf(prev.get(s));
            }
            return path.reverse();
          }
          q.push(ns);
        }
      }
    }
    return null;
  },

  hint() {
    if (this.won) return;
    const path = this.solve();
    if (path == null) { this.hintLine('当前局面无解'); return; }
    if (!path.length) { this.hintLine('已经完成了！'); return; }
    const [id, dx, dy] = path[0];
    this.selected = id;
    this.hintPieceId = id;
    this.hintUntil = Date.now() + 1800;
    if (this.hintId) clearTimeout(this.hintId);
    this.hintId = setTimeout(() => { this.hintUntil = 0; }, 1800);
    this.hintLine('提示：移动【' + this.piece(id).name + '】向' + this.DIR_NAME[dx + ',' + dy] + '（最优 ' + path.length + ' 步）');
    // 只有「上一次提示之后有过棋盘操作」才累加；连续点提示不重复计数
    if (this.hintConsumed) {
      this.hintCount += 1;
      this.saveHintCount(this.hintCount);
      this.hintConsumed = false;
    }
  },

  onHide() {
    if (!this.t0 || this.won) return;
    this.stopTimer();
    this.pauseAt = Date.now();
  },

  onShow() {
    if (this.pauseAt != null && this.t0 && !this.won) {
      this.t0 += Date.now() - this.pauseAt;
      this.pauseAt = null;
      this.startTimer();
    }
    if (this.canvas && this.canvas.width !== Math.round(this.W * this.DPR)) {
      this.canvas.width = Math.round(this.W * this.DPR);
      this.canvas.height = Math.round(this.H * this.DPR);
      this.ctx.scale(this.DPR, this.DPR);
      this.layout();
    }
  },

  onUnload() {
    if (this.raf) this.canvas.cancelAnimationFrame(this.raf);
    this.stopTimer();
  }
});
