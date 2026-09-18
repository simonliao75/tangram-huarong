"use strict";
/* ================= 七巧板华容道 · 微信小游戏版（手机端适配） =================
   由 H5 版（index.html）移植：渲染改为 Canvas，输入改为 wx 触摸事件，
   本地存储改用 wx 接口。游戏规则、几何、BFS 求解器与原版完全一致。
   屏幕适配要点：
   1) 画布缓冲区 = 屏幕物理像素（windowWidth × pixelRatio），再用
      ctx.setTransform(DPR,…) 以逻辑坐标绘制——真机高分屏不再"只显示左上角"；
   2) 布局避开刘海/状态栏（safeArea.top）与底部 Home 指示条（safeArea.bottom）；
   3) 监听 wx.onWindowResize，旋转/窗口变化时重算缓冲区与布局。 */

/* ---------- 画布与屏幕 ---------- */
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
// 记录框架预置的画布尺寸（诊断用：用于判断该环境的显示模型）
let preBuf = '?', preClient = '?';
try { preBuf = (canvas.width || 0) + 'x' + (canvas.height || 0); } catch(e){}
try { preClient = (canvas.clientWidth || 0) + 'x' + (canvas.clientHeight || 0); } catch(e){}
// ---- 屏幕信息读取（jsbridge 冷启动竞态防护） ----
// 开发者工具冷启动时可能出现 “jsbridge not ready”：此时同步调用 getWindowInfo/
// getSystemInfoSync 会失败。这里失败就用默认尺寸先跑起来，桥就绪后自动重取并重排。
function readSys(){
  try { return (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()) || null; }
  catch(e){ return null; }
}
let sysPending = false;
const sysFallback = { windowWidth: 375, windowHeight: 667, pixelRatio: 1 };
let sys = readSys() || null;
if(!sys || !sys.windowWidth){ sys = sysFallback; sysPending = true; }
let W = sys.windowWidth, H = sys.windowHeight;
let DPR = sys.pixelRatio || 1;
// 安全区（逻辑像素）：刘海/状态栏顶部、底部 Home 指示条
let safeTop = 0, safeBottom = 0;
if(sys.safeArea){
  safeTop    = Math.max(0, sys.safeArea.top || 0);
  safeBottom = Math.max(0, H - (sys.safeArea.bottom || H));
}
// 运行平台（仅用于诊断显示）
let PLATFORM = 'unknown';
try { const s = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null; PLATFORM = (s && s.platform) || 'unknown'; } catch(e){}
// ---- 屏幕适配核心 ----
// 微信小游戏统一使用物理像素缓冲 + DPR 坐标变换：
//   canvas.width/height = 逻辑窗口 × DPR
//   ctx.setTransform(DPR, ...) 之后所有绘制按逻辑坐标（u、px 均与 H5 版一致）
// 不再探测框架预置比例；无论框架预置的是逻辑还是物理缓冲，都重写为物理缓冲。
let bufScale = DPR, bufFrom = 'DPR';
// 框架预置的缓冲尺寸——仅用于诊断输出
let fwW = 0, fwH = 0;
try { fwW = canvas.width | 0; fwH = canvas.height | 0; } catch(e){}
function probeBuffer(){
  // 诊断信息：保留预置比例描述，但实际始终采用 DPR
  if (!(W > 0 && H > 0 && fwW > 0 && fwH > 0)){ bufFrom = 'DPR(fallback)'; return; }
  const rw = fwW / W, rh = fwH / H;
  if (rw >= 1.35 && rh >= 1.35) bufFrom = 'DPR(was-physical)';
  else if (rw >= 0.6 && rw <= 1.35 && rh >= 0.6 && rh <= 1.35) bufFrom = 'DPR(was-logical)';
  else bufFrom = 'DPR';
}
probeBuffer();
function setupCanvas(){
  if(!sysPending){              // 桥未就绪时不要动画布尺寸，避免用兜底窗口尺寸污染框架的预置缓冲
    canvas.width = Math.round(W * bufScale);
    canvas.height = Math.round(H * bufScale);
  }
  try {                       // 部分基础库按 style 控制画布显示尺寸，一并设置（逻辑像素）
    if(canvas.style){ canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
  }catch(e){}
  ctx.setTransform(bufScale, 0, 0, bufScale, 0, 0);
}
setupCanvas();
function retryInfo(){
  if(!sysPending) return;
  const s2 = readSys();
  if(!s2 || !s2.windowWidth) return;             // 桥仍未就绪，保持兜底，下次 onShow/回调再试
  sysPending = false;
  W = s2.windowWidth; H = s2.windowHeight;
  DPR = s2.pixelRatio || 1;
  safeTop = 0; safeBottom = 0;
  if(s2.safeArea){
    safeTop    = Math.max(0, s2.safeArea.top || 0);
    safeBottom = Math.max(0, H - (s2.safeArea.bottom || H));
  }
  try { const s = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null; if(s && s.platform) PLATFORM = s.platform; } catch(e){}
  probeBuffer();
  setupCanvas();
  layout();
}
setTimeout(retryInfo, 0);
console.log('[tangram] buffer:', canvas.width + 'x' + canvas.height, 'window:', W + 'x' + H,
            'dpr:', DPR, 'platform:', PLATFORM, 'bufScale:', bufScale, bufFrom,
            'pending:', sysPending, 'pre:', preBuf, preClient);

/* ---------- 常量与关卡数据（与 H5 版一致） ---------- */
const BOX = 3, EPS = 1e-6;
const GOAL = [1, 0];
const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const DIR_NAME = {"1,0":"右","-1,0":"左","0,1":"上","0,-1":"下","1,1":"右上","1,-1":"右下","-1,1":"左上","-1,-1":"左下"};
const LEVEL = { pieces: [
  { id:'tri_large',   name:'绿·大三角',     color:'#6F9144', poly:[[0,0],[2,0],[0,2]],        offset:[0,0], goal:false },
  { id:'tri_small_a', name:'紫·小三角A',    color:'#35346C', poly:[[0,0],[0,1],[1,1]],        offset:[0,2], goal:false },
  { id:'square',      name:'蓝·正方形(目标)', color:'#327C99', poly:[[0,0],[1,0],[1,1],[0,1]], offset:[1,2], goal:true  },
  { id:'tri_medium',  name:'红·中三角',     color:'#AE4433', poly:[[0,1],[2,1],[1,0]],        offset:[1,1], goal:false },
  { id:'tri_small_b', name:'粉·小三角B',    color:'#CB7D89', poly:[[0,0],[1,0],[1,1]],        offset:[2,1], goal:false },
  { id:'para',        name:'黄·平行四边形',  color:'#CAAC33', poly:[[0,1],[1,0],[2,0],[1,1]],  offset:[1,0], goal:false },
]};

/* ---------- 状态 ---------- */
let pieces = null, moves = 0, won = false, selected = null, undoStack = [];
let t0 = null, timerHandle = null, timeText = '00:00';
let pauseAt = null;               // 切后台时记录暂停时刻，回前台后补偿
let hintUntil = 0, hintId = null, hintMsg = '';
let shake = null; // {id, t0}
let hintLineText = '把蓝色方块移到底部正中的红框（出口）｜按住棋子拖动，或点选后用方向盘';
let hintPieceId = null;
let bestCache = null;

/* ---------- 真机诊断角标（临时；发布前把 DIAG 设为 false 即可移除） ---------- */
const DIAG = true;
let diagUntil = Date.now() + 8000;   // 启动后前 8 秒显示，首次触摸后立即消失
function drawDiag(now){
  if(!DIAG || !diagUntil) return;
  if(now > diagUntil){ diagUntil = 0; return; }
  let cw = '-', ch = '-';
  try{ cw = canvas.clientWidth || '-'; }catch(e){}
  try{ ch = canvas.clientHeight || '-'; }catch(e){}
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(6, 6, 236, 124);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = [
    'w' + W + ' h' + H + ' dpr' + DPR + ' ' + PLATFORM,
    'buf ' + canvas.width + 'x' + canvas.height,
    'style ' + (canvas.style && canvas.style.width || '-') + 'x' + (canvas.style && canvas.style.height || '-'),
    'client ' + cw + 'x' + ch + ' safe ' + safeTop + '/' + safeBottom,
    'pre ' + preBuf + ' / ' + preClient,
    'scale ' + bufScale + ' ' + bufFrom,
  ];
  for(let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 12, 10 + i * 19);
  ctx.restore();
}

/* ---------- 布局 ---------- */
const PAD = 12;
let B = 300, bx = 0, by = 0;
let hudTop = 12, hintY = 52;
let dpadBtns = [], ctrlBtns = [], againBtn = null, dpadTop = 0, ctrlTop = 0;

function layout(){
  const cell = 46, gap = 5;
  const grid = 3*cell + 2*gap;              // 方向盘尺寸 148
  const hudH = 40, hintH = 22;              // 顶部标题/HUD 区 + 提示行
  const gapB = 14, gapC = 16, padT = 16, padB = 16;
  const padTop = Math.max(padT, safeTop + 8);        // 顶部避开状态栏/刘海
  const padBot = Math.max(padB, safeBottom + 12);    // 底部避开 Home 指示条
  B = Math.floor(Math.min(W - 2*PAD, H - (padTop + hudH + hintH + grid + 44 + gapB + gapC + padBot), 460));
  if (B < 140) B = 140;
  // 整体垂直居中，消除高屏手机底部空白
  let totalH = padTop + hudH + hintH + B + gapB + grid + gapC + 44 + padBot;
  let topPad = Math.max(padTop, Math.floor((H - totalH) / 2));
  // 极小屏兜底：优先压缩棋盘，保证底部控件不被安全区遮挡
  if (topPad + totalH > H - safeBottom){
    B = Math.max(120, B - (topPad + totalH - (H - safeBottom)));
    topPad = padTop;
  }
  hudTop = topPad + 10;
  hintY = hudTop + hudH - 6;
  by = hintY + hintH + 6;
  bx = Math.floor((W - B) / 2);
  dpadTop = by + B + gapB;
  ctrlTop = dpadTop + grid + gapC;

  const gx = Math.floor((W - grid)/2);
  dpadBtns = [];
  for (let r=0;r<3;r++) for (let c=0;c<3;c++){
    const x = gx + c*(cell+gap), y = dpadTop + r*(cell+gap);
    const label = r===1&&c===1 ? '·' : ['↖','↑','↗','←','·','→','↙','↓','↘'][r*3+c];
    const d = r===1&&c===1 ? null : [[-1,1],[0,1],[1,1],[-1,0],null,[1,0],[-1,-1],[0,-1],[1,-1]][r*3+c];
    dpadBtns.push({x, y, w:cell, h:cell, label, d});
  }
  const cw = Math.floor((W - 2*PAD - 16) / 3), ch = 44;
  ctrlBtns = [
    {x:PAD, y:ctrlTop, w:cw, h:ch, label:'撤销', primary:false, action:undo},
    {x:PAD+cw+8, y:ctrlTop, w:cw, h:ch, label:'重开', primary:false, action:reset},
    {x:PAD+2*(cw+8), y:ctrlTop, w:cw, h:ch, label:'提示', primary:true, action:hint},
  ];
  const aw = 150, ah = 46;
  againBtn = {x:Math.floor((W-aw)/2), y:0, w:aw, h:ah, label:'再玩一次', primary:true};
}

/* ---------- 坐标换算（模型坐标 y 向上；画布 y 向下） ---------- */
function modelToCanvas(p){
  return [bx + p[0]*B, by + (BOX - p[1])*B];
}
function clientToModel(cx, cy){
  return { x:(cx - bx)/B, y:BOX - (cy - by)/B };
}

/* ---------- 几何（与 H5 版一致） ---------- */
const translate = (poly, ox, oy) => poly.map(([x,y]) => [x+ox, y+oy]);
const worldOf = (p, ox=p.offset[0], oy=p.offset[1]) => translate(p.poly, ox, oy);
const centroid = (poly) => { let sx=0, sy=0; for(const [x,y] of poly){ sx+=x; sy+=y; } return [sx/poly.length, sy/poly.length]; };
const circled = (n) => String.fromCharCode(0x245F + n);
function inBox(poly){ return poly.every(([x,y]) => x >= -EPS && y >= -EPS && x <= BOX+EPS && y <= BOX+EPS); }
function project(poly, ax){ let mn=Infinity,mx=-Infinity; for(const [x,y] of poly){ const d=x*ax[0]+y*ax[1]; if(d<mn)mn=d; if(d>mx)mx=d;} return [mn,mx]; }
function overlaps(a, b){
  const ps=[a,b];
  for(const p of ps) for(let i=0;i<p.length;i++){
    const [x1,y1]=p[i], [x2,y2]=p[(i+1)%p.length];
    const ax=[-(y2-y1), x2-x1];
    const [a0,a1]=project(a,ax), [b0,b1]=project(b,ax);
    if(a1 <= b0+EPS || b1 <= a0+EPS) return false;
  }
  return true;
}
function pointIn(p, poly){
  let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if(((yi>p[1])!==(yj>p[1])) && (p[0] < (xj-xi)*(p[1]-yi)/(yj-yi)+xi)) c=!c;
  }
  return c;
}
function piece(id){ return pieces.find(p=>p.id===id); }
function cross(o, a, b){ return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]); }
function convexHull(pts){
  const p = pts.slice().sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  const n = p.length; if(n<=1) return p;
  const lower=[], upper=[];
  for(let i=0;i<n;i++){ while(lower.length>=2 && cross(lower[lower.length-2], lower[lower.length-1], p[i]) <= 0) lower.pop(); lower.push(p[i]); }
  for(let i=n-1;i>=0;i--){ while(upper.length>=2 && cross(upper[upper.length-2], upper[upper.length-1], p[i]) <= 0) upper.pop(); upper.push(p[i]); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
function sweptOf(p, ox, oy, nx, ny){ return convexHull(worldOf(p, ox, oy).concat(worldOf(p, nx, ny))); }
function canPlace(offs, i, ox, oy){
  const poly = translate(pieces[i].poly, ox, oy);
  if(!inBox(poly)) return false;
  const swept = sweptOf(pieces[i], offs[i][0], offs[i][1], ox, oy);
  for(let j=0;j<pieces.length;j++) if(j!==i && overlaps(swept, translate(pieces[j].poly, offs[j][0], offs[j][1]))) return false;
  return true;
}

/* ---------- 移动 / 胜负 ---------- */
function offsets(){ return pieces.map(p=>p.offset.slice()); }
function keyOf(offs){ return offs.map(o=>o[0]+','+o[1]).join('|'); }
function isWinState(offs){ const g=pieces.findIndex(p=>p.goal); return Math.abs(offs[g][0]-GOAL[0])<EPS && Math.abs(offs[g][1]-GOAL[1])<EPS; }

function tryMove(id, dx, dy){
  if(won) return false;
  const i = pieces.findIndex(p=>p.id===id); if(i<0) return false;
  const cur = offsets();
  if(!canPlace(cur, i, cur[i][0]+dx, cur[i][1]+dy)){ doShake(id); return false; }
  undoStack.push(cur);
  pieces[i].offset = [cur[i][0]+dx, cur[i][1]+dy];
  if(!t0){ t0 = Date.now(); startTimer(); }
  moves++;
  hintLine('');
  if(isWinState(offsets())) win();
  return true;
}

function undo(){
  if(won || !undoStack.length) return;
  const offs = undoStack.pop();
  pieces.forEach((p,i)=> p.offset = offs[i].slice());
  if(moves>0) moves--;
  hintLine('');
}

function reset(){
  pieces = LEVEL.pieces.map(p => ({ ...p, poly:p.poly.map(v=>v.slice()), offset:p.offset.slice() }));
  moves = 0; won = false; selected = null; undoStack = [];
  stopTimer(); t0 = null; timeText = '00:00'; pauseAt = null;
  hintLine('把蓝色方块移到底部正中的红框（出口）｜按住棋子拖动，或点选后用方向盘');
  if(hintId){ clearTimeout(hintId); hintId = null; }
  hintUntil = 0; shake = null;
}

/* ---------- 计时 / 胜利 ---------- */
function startTimer(){ if(timerHandle) return; timerHandle = setInterval(()=>{ timeText = fmt(Date.now()-t0); }, 250); }
function stopTimer(){ if(timerHandle){ clearInterval(timerHandle); timerHandle=null; } }
function fmt(ms){ const s=Math.floor(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }

function win(){
  won = true; stopTimer();
  const timeMs = Date.now()-t0, stars = moves<=11?3 : moves<=16?2 : 1;
  saveBest(moves, timeMs, stars);
}

/* ---------- 本地记录（wx 存储） ---------- */
function saveBest(moves, timeMs, stars){
  try{
    const prev = wx.getStorageSync('tangram_best') || {};
    const cur = prev['level-1'] || {moves:Infinity, timeMs:Infinity};
    const better = moves<cur.moves || (moves===cur.moves && timeMs<cur.timeMs);
    if(better){ prev['level-1'] = {moves, timeMs, stars, at:new Date().toISOString()}; wx.setStorageSync('tangram_best', prev); }
  }catch(e){}
}

/* ---------- 提示行 / 抖动 ---------- */
function hintLine(t){ hintLineText = t; }
function doShake(id){ shake = {id, t0: Date.now()}; }

/* ---------- 渲染 ---------- */
function rr(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function drawPoly(poly, fill, stroke, sw){
  ctx.beginPath();
  poly.forEach((pt,i)=>{
    const c = modelToCanvas(pt);
    if(i===0) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]);
  });
  ctx.closePath();
  if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function drawBtn(b){
  ctx.save();
  rr(b.x, b.y, b.w, b.h, 9);
  ctx.fillStyle = b.primary ? '#327C99' : '#fff';
  ctx.fill();
  ctx.strokeStyle = b.primary ? '#327C99' : '#ccc';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = b.primary ? '#fff' : '#333';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w/2, b.y + b.h/2 + 1);
  ctx.restore();
}
function render(now){
  // 背景（覆盖整个实际缓冲,避免框架缓冲比窗口宽时右侧出现空条）
  ctx.fillStyle = '#F5F3EE';
  ctx.fillRect(0, 0, Math.max(W, canvas.width), Math.max(H, canvas.height));

  // 标题与 HUD
  ctx.fillStyle = '#222';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('七巧板华容道', PAD, hudTop + 14);
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  const hudW = 96;
  rr(W - PAD - hudW*2 - 8, hudTop, hudW, 28, 8);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.fillText('步数 ' + moves + ' / 11', W - PAD - hudW - 4, hudTop + 14);
  rr(W - PAD - hudW, hudTop, hudW, 28, 8);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.fillText('⏱' + timeText, W - PAD - 4, hudTop + 14);

  // 提示行
  ctx.fillStyle = '#777';
  ctx.font = hintLineText.length > 30 ? '11px sans-serif' : '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hintLineText, W/2, hintY + 11);

  // 棋盘底
  rr(bx - 6, by - 6, B + 12, B + 12, 10);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();

  // 棋盘与出口
  drawPoly([[0,0],[3,0],[3,3],[0,3]], '#fff', '#222', Math.max(1, 0.03*B));
  // 出口（虚线红框，位于底部正中）
  ctx.save();
  const e0 = modelToCanvas([1,0]), e1 = modelToCanvas([2,1]);
  ctx.setLineDash([Math.max(4, 0.14*B), Math.max(3, 0.09*B)]);
  ctx.strokeStyle = '#E23B2E';
  ctx.lineWidth = Math.max(1, 0.04*B);
  ctx.strokeRect(e0[0], e0[1], e1[0]-e0[0], e1[1]-e0[1]);
  ctx.restore();

  // 棋子
  const nowMs = now || Date.now();
  let shakeDx = 0;
  for(let idx=0; idx<pieces.length; idx++){
    const p = pieces[idx];
    shakeDx = 0;
    if(shake && shake.id === p.id){
      const t = (nowMs - shake.t0) / 280;
      if(t < 1) shakeDx = 7 * Math.sin(t * Math.PI * 2) * (1 - t);
      else shake = null;
    }
    ctx.save();
    ctx.translate(shakeDx, 0);
    const poly = worldOf(p).map(([x,y]) => [x, y]);
    let sw = p.goal ? Math.max(1, 0.02*B) : Math.max(1, 0.012*B);
    let sc = '#3A3A3A';
    if(selected === p.id){ sc = '#0a84ff'; sw = Math.max(2, 0.06*B); }
    if(hintUntil && nowMs < hintUntil && p.id === (hintPieceId||'')){ sc = '#ff8c00'; sw = Math.max(2, 0.06*B); }
    drawPoly(poly, p.color, sc, sw);
    const [cx, cy] = centroid(p.poly);
    const [tx, ty] = modelToCanvas([cx + p.offset[0], cy + p.offset[1]]);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, 0.015*B);
    ctx.font = 'bold ' + Math.max(12, 0.20*B) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(circled(idx+1), tx, ty);
    ctx.fillText(circled(idx+1), tx, ty);
    ctx.restore();
  }

  // 方向盘
  for(const b of dpadBtns){
    ctx.save();
    rr(b.x, b.y, b.w, b.h, 10);
    ctx.fillStyle = (b.d === null) ? '#f0f0f0' : '#fff';
    ctx.fill();
    ctx.strokeStyle = b.d === null ? '#ddd' : '#ccc';
    ctx.lineWidth = 1;
    if(b.d === null) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = b.d === null ? '#999' : '#333';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w/2, b.y + b.h/2 + 1);
    ctx.restore();
  }

  // 控制按钮
  for(const b of ctrlBtns) drawBtn(b);

  // 胜利弹窗
  if(won){
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, Math.max(W, canvas.width), Math.max(H, canvas.height));
    const cw = Math.min(W - 64, 320), chh = 220;
    const cx = (W - cw)/2, cy = (H - chh)/2 - 30;
    rr(cx, cy, cw, chh, 16);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = '#327C99';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('过关！', W/2, cy + 44);
    const stars = moves<=11?3 : moves<=16?2 : 1;
    ctx.fillStyle = '#FFB800';
    ctx.font = '32px sans-serif';
    ctx.fillText('★'.repeat(stars) + '☆'.repeat(3-stars), W/2, cy + 92);
    ctx.fillStyle = '#555';
    ctx.font = '14px sans-serif';
    ctx.fillText('步数 ' + moves + ' · 用时 ' + fmt(Date.now()-t0), W/2, cy + 132);
    againBtn.y = cy + chh - 70;
    drawBtn(againBtn);
  }

  drawDiag(nowMs);
}

/* ---------- 命中测试 / 拖拽（逻辑与 H5 版一致） ---------- */
function hitTest(p){
  for(let i=pieces.length-1;i>=0;i--) if(pointIn([p.x,p.y], worldOf(pieces[i]))) return pieces[i];
  return null;
}
function snap8(x,y){ const a=Math.atan2(y,x); const idx=((Math.round(a/(Math.PI/4))%8)+8)%8; return DIRS[idx]; }

let drag=null, resX=0, resY=0;
function onDragMove(p){
  if(!drag) return;
  resX += p.x-drag.lx; resY += p.y-drag.ly; drag.lx=p.x; drag.ly=p.y;
  const dir = snap8(resX, resY);
  const availX = dir[0] !== 0 ? Math.abs(resX) : Infinity;
  const availY = dir[1] !== 0 ? Math.abs(resY) : Infinity;
  const n = Math.min(Math.floor(Math.min(availX, availY)), 6);
  let done = 0;
  for(let k = 0; k < n; k++){
    if(!tryMove(drag.id, dir[0], dir[1])) break;
    done++;
  }
  resX -= dir[0]*done; resY -= dir[1]*done;
  if(done < n){
    resX = 0; resY = 0;
    if(drag && !drag.blockHint){ drag.blockHint = true; hintLine('这个方向走不了，换个方向试试'); }
  }
}
function endDrag(){ drag=null; resX=0; resY=0; }
function ptInRect(x, y, r){ return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h; }

function onTouchStart(cx, cy){
  diagUntil = 0;                       // 首次触摸后隐藏诊断角标
  if(won){
    if(ptInRect(cx, cy, againBtn)) reset();
    return;
  }
  for(const b of ctrlBtns){
    if(ptInRect(cx, cy, b)){ b.action(); return; }
  }
  for(const b of dpadBtns){
    if(b.d && ptInRect(cx, cy, b)){
      if(!selected){ hintLine('先点击选中一块棋子'); return; }
      tryMove(selected, b.d[0], b.d[1]);
      return;
    }
  }
  const p = clientToModel(cx, cy), pc = hitTest(p);
  selected = pc ? pc.id : null;
  if(!pc) return;
  drag = {id:pc.id, lx:p.x, ly:p.y, blockHint:false};
  resX = 0; resY = 0;
}

wx.onTouchStart(e => { const t = e.touches[0] || e.changedTouches[0]; if(t) onTouchStart(t.clientX, t.clientY); });
wx.onTouchMove(e => { const t = e.touches[0]; if(t) onDragMove(clientToModel(t.clientX, t.clientY)); });
wx.onTouchEnd(endDrag);
wx.onTouchCancel(endDrag);

/* ---------- 提示（BFS 求解器，与 H5 版一致） ---------- */
function solve(){
  const start = offsets();
  if(isWinState(start)) return [];
  const g = pieces.findIndex(p=>p.goal);
  const startKey = keyOf(start);
  const prev = new Map([[startKey,null]]), mv = new Map();
  const q = [start]; let limit=200000;
  while(q.length && limit-- > 0){
    const cur = q.shift();
    for(let i=0;i<pieces.length;i++) for(const [dx,dy] of DIRS){
      const ns = cur.map(o=>o.slice()); ns[i][0]+=dx; ns[i][1]+=dy;
      if(!canPlace(cur, i, ns[i][0], ns[i][1])) continue;
      const k = keyOf(ns); if(prev.has(k)) continue;
      prev.set(k, cur); mv.set(k, [pieces[i].id, dx, dy]);
      if(isWinState(ns)){
        const path=[]; let s=k;
        while(s!==startKey){ path.push(mv.get(s)); s=keyOf(prev.get(s)); }
        return path.reverse();
      }
      q.push(ns);
    }
  }
  return null;
}
function hint(){
  if(won) return;
  const path = solve();
  if(path==null){ hintLine('当前局面无解'); return; }
  if(!path.length){ hintLine('已经完成了！'); return; }
  const [id,dx,dy] = path[0];
  selected = id;
  hintPieceId = id;
  hintUntil = Date.now() + 1800;
  if(hintId) clearTimeout(hintId);
  hintId = setTimeout(()=>{ hintUntil = 0; }, 1800);
  hintLine('提示：移动【'+piece(id).name+'】向'+DIR_NAME[dx+','+dy]+'（最优 '+path.length+' 步）');
}

/* ---------- 启动 ---------- */
function onWindowResize(res){
  const w = res && res.windowWidth, h = res && res.windowHeight;
  if(!w || !h || (w === W && h === H)) return;   // 方向/窗口变化时重新适配
  W = w; H = h;
  if(res.pixelRatio) DPR = res.pixelRatio;
  if(wx.getWindowInfo){
    const wi = wx.getWindowInfo();
    if(wi.safeArea){
      safeTop = Math.max(0, wi.safeArea.top || 0);
      safeBottom = Math.max(0, H - (wi.safeArea.bottom || H));
    }
  }
  setupCanvas();
  layout();
}
if(wx.onWindowResize) wx.onWindowResize(onWindowResize);
// 切后台暂停计时、回前台恢复（手机切走再回来，计时不虚高）
if(wx.onHide) wx.onHide(()=>{ if(!t0 || won) return; stopTimer(); pauseAt = Date.now(); });
if(wx.onShow) wx.onShow(()=>{
  retryInfo();                // 兜底：jsbridge 若在启动后才就绪，趁 onShow 补取真实窗口信息
  if(pauseAt != null && t0 && !won){ t0 += Date.now() - pauseAt; pauseAt = null; startTimer(); }
  // 兜底：个别基础库在回前台时会重置主画布，检测到缓冲不符则重设
  if(canvas.width !== Math.round(W * bufScale) || canvas.height !== Math.round(H * bufScale)){
    setupCanvas();
    layout();
  }
});
layout();
reset();
function loop(now){
  render(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
