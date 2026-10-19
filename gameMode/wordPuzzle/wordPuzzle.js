// wordPuzzle/wordPuzzle.js — trang game Word Puzzle. Chỉ nói chuyện với `net` (wordPuzzleNet.js).
// Chơi thật: vào từ phòng (room.html) → chủ phòng chọn Word Puzzle → Bắt đầu.
// Thử một mình, không cần Firebase: wordPuzzle.html?solo=1&players=12&fast=1

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sfx = n => { try { if (typeof window[n] === "function") window[n](); } catch (e) { /* bỏ qua */ } };

const Core = WordPuzzleCore, WP = Core.WP;
const LOBBY = "../../room.html";
const CLOUD_SRC = ["../../pics/yellow%20a%20cloud.png", "../../pics/yellow%20clouds.png"];
const MASCOT = ["../../pics/mascotPics/mascotWukong_main.gif", "../../pics/mascotPics/mascotWukong_main.png"];
const PALETTE = ["#5AAA28", "#FFB703", "#219EBC", "#FFB380", "#C8F580", "#5BBAD8"];   // màu "viên thuốc" theo thứ tự tìm được

const params = new URLSearchParams(location.search);
const SOLO = params.has("solo");
const FAST = params.has("fast");
const PLAYERS = Math.min(WP.MAX_PLAYERS, Math.max(2, +params.get("players") || 12));
if (FAST) WP.LEVELS.forEach(L => (L.sec = Math.max(10, Math.round(L.sec / 4))));   // rút ngắn thời gian để thử nhanh

// Kho từ (meaning luôn là mảng)
const POOL = (typeof vocabData !== "undefined" ? vocabData : [])
  .map(w => ({ ...w, meaning: Array.isArray(w.meaning) ? w.meaning : [w.meaning] }))
  .filter(w => w.word && w.meaning[0]);

let net, ended = false, soundOn = true, waiting = false;
let seed = 0, score = 0, totalMs = 0, progress = { done: 0, total: 0 };
let cur = null;                       // level đang chơi: { level, L, words, board, found:Map, gain, total, t0, over, finish }


/* ================= NỀN: MÂY VÀNG TRÔI TỪ TRÁI SANG PHẢI ================= */
// Hai ảnh mây xen kẽ nhau; độ cao, kích thước, tốc độ và khoảng cách giữa các đám đều ngẫu nhiên.
let cloudNo = 0;
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function spawnCloud(initial) {
  const el = document.createElement("img");
  const s = 0.55 + Math.random() * 0.95, dur = 40 + Math.random() * 45;
  el.className = "wp-cloud";
  el.src = CLOUD_SRC[cloudNo++ % 2];
  el.alt = "";
  el.style.cssText = `top:${(Math.random() * 80).toFixed(1)}%;--s:${s.toFixed(2)};animation-duration:${dur.toFixed(1)}s;` +
    (initial ? `animation-delay:-${(Math.random() * dur * 0.8).toFixed(1)}s;` : "") +
    (reduceMotion ? `left:${(Math.random() * 70).toFixed(0)}%;` : "");
  el.addEventListener("animationend", () => el.remove());
  $("wpClouds").appendChild(el);
}
function startClouds() {
  for (let i = 0; i < (reduceMotion ? 3 : 4); i++) spawnCloud(true);     // đã có sẵn vài đám giữa màn hình lúc vào trang
  if (reduceMotion) return;
  const loop = () => { spawnCloud(false); setTimeout(loop, 5000 + Math.random() * 7000); };
  setTimeout(loop, 4000);
}


/* ================= ĐỔI MÀN VÀ LỚP PHỦ ================= */
let curView = "play";
async function view(v, draw) {                     // mờ dần màn cũ → đổi màn (draw vẽ nội dung) → hiện dần
  if (v === curView) { if (draw) draw(); return; }
  const el = $("wp");
  el.classList.add("wp-out");
  await sleep(180);
  el.dataset.view = v; curView = v;
  if (draw) draw();
  await sleep(30);
  el.classList.remove("wp-out");
}
const fadeHide = async (el, ms = 250) => { el.classList.add("leaving"); await sleep(ms); el.hidden = true; el.classList.remove("leaving"); };

// Màn giới thiệu level: level 1 đếm ngược tới giờ bắt đầu chung; các level sau nghỉ vài giây
async function intro(level, info) {
  const el = $("wpIntro"), L = WP.LEVELS[level];
  const sub = `${L.words} từ · bảng ${L.size}×${L.size} · ${L.sec} giây`;
  const paint = extra => (el.innerHTML = `<b>Level ${level + 1}</b><span>${sub}</span>${extra ? `<span>${extra}</span>` : ""}`);
  el.classList.remove("leaving");
  paint();
  el.hidden = false;
  if (info && info.serverNow() < info.startAt - 250) {
    while (info.serverNow() < info.startAt - 250) {
      paint(`Bắt đầu sau ${Math.max(0, Math.ceil((info.startAt - info.serverNow()) / 1000))}`);
      await sleep(150);
    }
  } else {
    await sleep(Math.max(0, WP.BETWEEN_MS - 300));
  }
  await fadeHide(el, 250);
}


/* ================= DỰNG BẢNG ================= */
const wordInner = (w, state) =>
  `<b>${w.classword ? `(${esc(w.classword)}) ` : ""}${state === "locked" ? "?" : esc(w.word)}</b><small>${esc(w.meaning)}</small>`;

function setWordState(i, state) {
  const li = $("wpWords").querySelector(`[data-i="${i}"]`);
  if (!li) return;
  li.className = "wp-word " + state;
  li.innerHTML = wordInner(cur.words[i], state);
  if (state === "found") li.style.setProperty("--c", cur.found.get(i));
}

function setupLevel(level) {
  const L = WP.LEVELS[level];
  const words = Core.pickWords(POOL, seed, level);
  const board = Core.makeBoard(words, level, `${seed}:${net.id}:${level}`);   // key có mã người chơi → mỗi người một bảng
  cur = { level, L, words, board, found: new Map(), gain: 0, total: L.sec * 1000, t0: 0, over: true };
  if (board) {
    $("wpGrid").style.setProperty("--n", board.n);
    $("wpGrid").innerHTML = board.grid.map((ch, i) => `<div class="wp-cell" data-i="${i}">${ch}</div>`).join("");
  } else {
    $("wpGrid").innerHTML = "";
    console.error("[WordPuzzle] không dựng được bảng cho level", level + 1);
  }
  $("wpCaps").innerHTML = "";
  $("wpLevel").textContent = `LEVEL ${level + 1}/${WP.LEVELS.length}`;
  $("wpWords").innerHTML = words.map((w, i) => `<li class="wp-word locked" data-i="${i}">${wordInner(w, "locked")}</li>`).join("");
  $("wpTime").textContent = L.sec;
  $("wpTime").parentElement.classList.remove("warn");
  $("wpBar").style.width = "100%";
  $("wpScore").textContent = score;
}

// "Viên thuốc" phủ lên các ô cells (vị trí tính theo % của bảng vuông)
function capsule(cells, cls, color) {
  const n = cur.board.n, pt = i => [((i % n) + 0.5) / n * 100, (Math.floor(i / n) + 0.5) / n * 100];
  const [x0, y0] = pt(cells[0]), [x1, y1] = pt(cells[cells.length - 1]), cell = 100 / n;
  const el = document.createElement("div");
  el.className = "wp-cap " + cls;
  el.style.cssText = `left:${(x0 + x1) / 2}%;top:${(y0 + y1) / 2}%;width:${Math.hypot(x1 - x0, y1 - y0) + cell * 0.92}%;` +
    `height:${cell * 0.88}%;--rot:${Math.atan2(y1 - y0, x1 - x0)}rad;` + (color ? `background:${color};` : "");
  $("wpCaps").appendChild(el);
  return el;
}


/* ================= CHỌN TỪ: KÉO, HOẶC CHẠM ĐIỂM ĐẦU RỒI ĐIỂM CUỐI ================= */
let drag = null, anchor = null, preEl = null;
const clearPre = () => { if (preEl) { preEl.remove(); preEl = null; } };
function showPre(a, b) {
  clearPre();
  preEl = capsule(Core.lineCells(cur.board.n, a, b) || [a], "pre");
}
function cellAt(x, y) {
  const el = document.elementFromPoint(x, y), c = el && el.closest && el.closest(".wp-cell");
  return c ? +c.dataset.i : -1;
}

const grid = $("wpGrid");
grid.addEventListener("pointerdown", e => {
  if (!cur || cur.over || !cur.board) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0) return;
  e.preventDefault();
  if (grid.setPointerCapture) { try { grid.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ } }
  drag = { a: i, b: i, moved: false };
  showPre(i, i);
});
grid.addEventListener("pointermove", e => {
  if (!drag || !cur || cur.over) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0) return;
  const b = Core.snapEnd(cur.board.n, drag.a, i);
  if (b !== drag.b) { drag.b = b; drag.moved = b !== drag.a; showPre(drag.a, b); }
});
const release = () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!cur || cur.over) { clearPre(); return; }
  if (d.moved) { anchor = null; commit(d.a, d.b); }
  else if (anchor === null) { anchor = d.a; showPre(d.a, d.a); }               // chạm lần 1: đánh dấu điểm đầu
  else if (anchor === d.a) { anchor = null; clearPre(); }                       // chạm lại cùng ô: bỏ chọn
  else { const a = anchor; anchor = null; commit(a, Core.snapEnd(cur.board.n, a, d.a)); }   // chạm lần 2: chọn điểm cuối
};
grid.addEventListener("pointerup", release);
grid.addEventListener("pointercancel", () => { drag = null; anchor = null; clearPre(); });

function commit(a, b) {
  clearPre();
  if (!cur || cur.over) return;
  const cells = Core.lineCells(cur.board.n, a, b);
  const w = Core.matchWord(cur.board, cells, cur.words, cur.found);
  if (w < 0) {                                                                  // chọn sai: nháy đỏ, không trừ điểm
    if (cells && cells.length > 1) { const bad = capsule(cells, "bad"); setTimeout(() => bad.remove(), 380); sfx("playWrong"); }
    return;
  }
  const color = PALETTE[cur.found.size % PALETTE.length];
  cur.found.set(w, color);
  capsule(cells, "ok", color);
  cur.gain += Core.wordScore(cur.total - (Date.now() - cur.t0), cur.total);     // càng tìm sớm càng nhiều điểm
  const pill = $("wpScore");
  pill.textContent = score + cur.gain;
  pill.parentElement.classList.remove("bump"); void pill.offsetWidth; pill.parentElement.classList.add("bump");
  setWordState(w, "found");
  sfx("playCorrect");
  if (soundOn && typeof window.speak === "function") window.speak(cur.words[w].word);
  if (cur.found.size === cur.words.length) setTimeout(() => cur.finish && cur.finish("all"), 500);
}


/* ================= MỘT LEVEL ================= */
function playLevel() {
  return new Promise(resolve => {
    cur.over = false;
    cur.t0 = Date.now();
    let tick;
    cur.finish = reason => {
      if (cur.over) return;
      cur.over = true;
      clearInterval(tick);
      clearPre(); anchor = null; drag = null;
      $("wpSkip").disabled = true;
      const all = cur.found.size === cur.words.length;
      resolve({ gain: cur.gain + (all ? WP.CLEAR_BONUS : 0), used: Math.min(Date.now() - cur.t0, cur.total), all, reason });
    };
    $("wpSkip").disabled = false;
    if (!cur.board) { cur.finish("error"); return; }
    tick = setInterval(() => {
      const left = cur.total - (Date.now() - cur.t0);
      $("wpTime").textContent = Math.max(0, Math.ceil(left / 1000));
      $("wpBar").style.width = `${Math.max(0, left / cur.total) * 100}%`;
      $("wpTime").parentElement.classList.toggle("warn", left <= 10000);
      if (left <= 0) cur.finish("time");
    }, 100);
  });
}

// Hết level mà còn từ chưa tìm: hiện luôn vị trí và từ đó để người chơi học
async function reveal() {
  const miss = cur.words.map((w, i) => i).filter(i => !cur.found.has(i));
  if (cur.board) miss.forEach(i => {
    const p = cur.board.placed.find(x => x.word === cur.words[i].word);
    if (p) capsule(p.cells, "miss");
    setWordState(i, "missed");
  });
  await sleep(miss.length ? WP.REVEAL_MS : 500);
}

async function runGame(info) {
  seed = info.seed;
  const r = info.resume, N = WP.LEVELS.length;
  let level = r ? r.levels : 0, first = true;
  if (r) { score = r.score; totalMs = r.timeMs; }
  if (r && (r.done || level >= N)) return showWaiting();

  for (; level < N; level++) {
    setupLevel(level);                                          // dựng bảng ngay trong lúc đếm ngược
    if (first) { await view("play"); await intro(level, r ? null : info); first = false; }
    else await intro(level);
    const res = await playLevel();
    score += res.gain;
    totalMs += res.used;
    $("wpScore").textContent = score;
    net.submitLevel(level + 1, score, totalMs, level === N - 1);   // ghi 1 lần sau mỗi level
    await reveal();
  }
  showWaiting();
}


/* ================= CHỜ VÀ KẾT QUẢ ================= */
const row = (e, cls, o = {}) => `
  <li class="wp-row ${cls || ""}" style="--i:${o.i || 0}">
    <span class="nm">${o.rank ? "#" + e.rank + " " : ""}${esc(e.name || "")}${e.left ? " (đã rời)" : ""}</span>
    <b>${e.score}</b>
  </li>`;
const myName = () => net.names[net.id] || "Bạn";

async function showWaiting() {
  waiting = true;
  $("wpSkip").disabled = true;
  await view("result", () => {
    $("wpResTitle").textContent = "ĐANG CHỜ MỌI NGƯỜI...";
    $("wpResSub").textContent = `${progress.done} / ${progress.total} người đã chơi xong`;
    $("wpList").innerHTML = "";
    $("wpMe").innerHTML = row({ name: myName(), score }, "me");
    $("wpCap").textContent = "Bạn đã xong 3 level!";
  });
}

async function showFinal(g) {
  ended = true;
  waiting = false;
  $("wpSkip").disabled = true;
  await view("result", () => {
    $("wpResTitle").textContent = "KẾT THÚC";
    $("wpResSub").textContent = "";
    $("wpList").innerHTML = g.ranking.map((r, i) => row(r, r.rank <= 5 ? "r" + r.rank : "", { rank: true, i })).join("");
    const me = g.ranking.find(r => r.id === net.id);
    $("wpMe").innerHTML = me ? row(me, "me", { rank: true }) : "";
    $("wpCap").textContent = g.myRank === 1 ? "Chiến thắng! 🏆" : "Hoàn thành!";
  });
  sfx("playFinish");
}


/* ================= NÚT VÀ KHỞI ĐỘNG ================= */
async function leave() { try { await net.leave(); } catch (e) { /* bỏ qua */ } location.href = LOBBY; }

$("wpSkip").onclick = () => { if (cur && !cur.over && cur.finish) cur.finish("skip"); };    // bỏ qua level: giữ điểm các từ đã tìm
$("wpExit").onclick = () => { if (confirm("Thoát khỏi phòng? Điểm của bạn sẽ giữ như hiện tại.")) leave(); };
$("wpSet").onclick = () => { $("wpSettings").classList.remove("leaving"); $("wpSettings").hidden = false; };
$("wpResume").onclick = () => fadeHide($("wpSettings"));
$("wpLeave2").onclick = leave;
$("wpSound").onclick = () => {
  soundOn = !soundOn;
  $("wpSound").setAttribute("aria-pressed", String(soundOn));
  $("wpSound").textContent = `🔊 Đọc từ khi tìm được: ${soundOn ? "Bật" : "Tắt"}`;
  if (!soundOn && window.speechSynthesis) speechSynthesis.cancel();
};

// Mascot: ưu tiên .gif, không có thì dùng .png
const mascot = $("wpMascot");
let triedPng = false;
mascot.onerror = () => { if (!triedPng) { triedPng = true; mascot.src = MASCOT[1]; } };
mascot.src = MASCOT[0];

startClouds();

function wire() {
  net.onStart(info => runGame(info).catch(e => console.error(e)));
  net.onProgress(p => { progress = p; if (waiting && !ended) $("wpResSub").textContent = `${p.done} / ${p.total} người đã chơi xong`; });
  net.onFinal(g => showFinal(g));
  if (net.onClosed) net.onClosed(() => { if (!ended) location.href = LOBBY; });
}

(async () => {
  try {
    if (SOLO) {
      net = WordPuzzleNet.create({ players: PLAYERS, timeScale: FAST ? 4 : 1, name: "Bạn" });
    } else {
      const engine = BossNet.create();                       // cần Firebase đã cấu hình (JS/net/firebase-config.js)
      if (!(await engine.resume())) { location.href = LOBBY; return; }
      net = WordPuzzleNet.connect(engine);
    }
  } catch (e) {
    console.error(e);
    $("wpWords").innerHTML = `<li class="wp-word">Không kết nối được: ${esc(e.message || e.code || "lỗi mạng")}</li>`;
    return;
  }
  wire();
  net.start();
})();

window.__wp = { cur: () => cur, commit };     // chỉ để kiểm thử tự động
