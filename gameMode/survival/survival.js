// survival/survival.js — trang game Survival. Chỉ nói chuyện với `net` (survivalNet.js hoặc bản Firebase thật).
// Chơi thật: vào từ phòng (room.html) → chủ phòng chọn chế độ Sinh tồn → Bắt đầu.
// Thử một mình, không cần Firebase: survival.html?solo=1&players=20&fast=1   (players: 2..80, fast: rút ngắn thời gian)

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const LOBBY = "../../room.html";
const MASCOT = ["../../pics/mascotPics/mascotEastDragon_main.gif", "../../pics/mascotPics/mascotEastDragon_main.png"];
const PHASE_TEXT = {
  1: "Khởi động: chưa ai bị loại",
  2: "Cứ 2 vòng, 5 người thấp điểm nhất bị loại",
  3: "Sinh tử: mỗi vòng loại 1 người"
};

const params = new URLSearchParams(location.search);
const SOLO = params.has("solo");
const PLAYERS = Math.min(80, Math.max(2, +params.get("players") || 20));
const SCALE = params.has("fast") ? 4 : 1;

// Kho từ làm đáp án nhiễu (meaning luôn là mảng)
const POOL = (typeof vocabData !== "undefined" ? vocabData : [])
  .map(w => ({ ...w, meaning: Array.isArray(w.meaning) ? w.meaning : [w.meaning] }))
  .filter(w => w.word && w.meaning[0]);

let net, alive = true, board = [], handle = null;
let tot = { correct: 0, wrong: 0 }, myTime = 0, ended = false;

// Các việc giao diện chạy lần lượt, không chồng lên nhau
let chain = Promise.resolve();
const queue = fn => (chain = chain.then(fn).catch(e => console.error(e)));


/* ================= TIỆN ÍCH GIAO DIỆN ================= */
// Đổi màn: mờ dần màn cũ → đổi khi đang mờ (draw vẽ nội dung mới lúc này) → hiện dần màn mới
let curView = "play";
async function view(v, draw) {
  if (v === curView) { if (draw) draw(); return; }
  const sv = $("sv");
  sv.classList.add("sv-out");
  await sleep(180);
  sv.dataset.view = v; curView = v;
  if (draw) draw();
  await sleep(30);
  sv.classList.remove("sv-out");
}
// Màu nền theo tình trạng: bị loại → đỏ, kết thúc → xanh ngọc (xem body.mood-* trong survival.css)
function setMood(m) {
  document.body.classList.remove("mood-dead", "mood-end");
  if (m) document.body.classList.add("mood-" + m);
}

// Popup "Bạn đã bị loại"
function showElimPopup(p) {
  const el = $("svPopup");
  $("svPopupSub").textContent = `Hạng #${p.myRank} · còn ${p.alive} người trong cuộc`;
  el.classList.remove("leaving");
  el.hidden = false;
  clearTimeout(showElimPopup.t);
  showElimPopup.t = setTimeout(() => fadeHide(el, 250), 3200);
}

// Hiệu ứng đổi hạng (FLIP): hàng nào đổi vị trí so với lần vẽ trước thì trượt từ chỗ cũ sang chỗ mới, kèm mũi tên ▲ ▼.
// Dùng cho mọi bảng xếp hạng; key phân biệt từng bảng. Hàng có data-id = id người chơi.
const lastTops = {};
function flipList(el, key) {
  const rows = [...el.querySelectorAll(".row[data-id]")];
  const prev = lastTops[key] || {}, now = {};
  rows.forEach(r => (now[r.dataset.id] = r.offsetTop));
  rows.forEach(r => {
    const old = prev[r.dataset.id];
    if (old === undefined) return;                       // hàng mới: giữ hiệu ứng trượt vào bình thường
    r.classList.add("keep");                             // hàng cũ: không chạy lại hiệu ứng trượt vào
    const dy = old - now[r.dataset.id];
    if (Math.abs(dy) < 4) return;
    if (r.animate) r.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
    r.insertAdjacentHTML("beforeend", `<i class="mv ${dy > 0 ? "up" : "down"}">${dy > 0 ? "▲" : "▼"}</i>`);
    setTimeout(() => { const m = r.querySelector(".mv"); if (m) m.remove(); }, 2600);
  });
  lastTops[key] = now;
}

const fadeHide = async (el, ms = 220) => { el.classList.add("leaving"); await sleep(ms); el.hidden = true; el.classList.remove("leaving"); };
const fmt = x => (Math.round(x * 10) / 10).toFixed(1);
const me = () => board.find(r => r.id === net.id);

function setBadge(end) {
  $("svDot").className = "dot " + (end ? "end" : alive ? "" : "dead");
  $("svBadge").textContent = end ? "END" : alive ? "Still Alive" : "Spectating";
}

// rank = 0 thì không hiện số hạng; right = chữ ở cột phải (mặc định là điểm)
const row = (e, cls, o = {}) => `
  <li class="row ${cls || ""}" data-id="${esc(e.id)}">
    <i class="dot ${e.alive === false ? "dead" : ""}"></i>
    <span class="nm">${o.rank ? "#" + e.rank + " " : ""}${esc(e.name)}</span>
    <b class="sc">${o.right !== undefined ? o.right : fmt(e.score || 0)}</b>
  </li>`;

const meRow = (o, cls = "me") => {
  const m = me() || { id: net.id, name: net.names[net.id], score: 0, rank: 0 };
  return row({ ...m, alive }, cls, o);
};
const colorOf = r => (r.rank <= 3 ? "r" + r.rank : "");


/* ================= CÁC MÀN ================= */
function renderLeaderboard() {        // bảng xếp hạng rút gọn khi đang chơi: bạn + 7 người đứng đầu
  $("svLb").innerHTML = meRow() + board.filter(r => r.id !== net.id).slice(0, 7)
    .map(r => row(r, colorOf(r) || "white")).join("");
  flipList($("svLb"), "lb");
}

function renderEnd(p) {               // cuối vòng: hàng bạn + danh sách LOẠI / NGUY HIỂM / KHỞI ĐỘNG
  const list = $("svList");
  list.className = "sv-list";
  let head = "", rows = "";
  if (p.kind === "elim") {
    head = `<h3>LOẠI</h3>`;
    rows = p.elim.map(e => row({ ...e, alive: false }, "out")).join("");
  } else if (p.kind === "danger") {
    head = `<h3 class="warn">⚠ NGUY HIỂM</h3>`;
    rows = p.danger.map(e => row({ ...e, alive: true }, "danger")).join("");
  } else {
    head = `<h3>KHỞI ĐỘNG</h3>`;
    rows = board.slice(0, 5).map(r => row(r, colorOf(r) || "white")).join("");
  }
  list.innerHTML = meRow() + head + rows;
  if (p.kind === "safe") flipList(list, "end");
  $("enStage").textContent = `${p.nextPhase}/3`;
  $("enLeft").textContent = `${p.alive}/${p.total}`;
  $("svCap").textContent = "Đang chờ...";
}

function renderSpec() {               // khán giả: bảng xếp hạng đầy đủ, cập nhật mỗi cuối vòng
  const list = $("svList");
  list.className = "sv-list";
  list.innerHTML = meRow() + board.filter(r => r.id !== net.id).map(r => row(r, colorOf(r))).join("");
  flipList(list, "spec");
  const m = me();
  const s = Math.round(myTime / 1000);
  $("spTime").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  $("spScore").textContent = fmt(m ? m.score : 0);
  $("spRank").textContent = m ? `#${m.rank}` : "-";
  $("svCap").textContent = "Đang chờ...";
}

async function showResult(g) {
  ended = true;
  setMood("end");
  board = g.ranking;
  alive = false;
  $("svSkip").disabled = true;
  await view("result", () => {
    const m = me();
    const list = $("svList");
    list.className = "sv-list result";
    const opt = () => ({ rank: true });
    list.innerHTML =
      `<h3>KẾT THÚC</h3>` +
      board.slice(0, 5).map((r, i) => row(r, "r" + (i + 1), { ...opt(), right: `${r.rounds} vòng` })).join("") +
      `<li class="gap"></li>` +
      row({ ...m, alive: true }, "me", { ...opt(), right: `${m.rounds} vòng` });
    setBadge(true);
    $("svCap").textContent = g.myRank === 1 ? "Chiến thắng! 🏆" : "Yeah!";
  });
  if (typeof playFinish === "function") playFinish();
}


/* ================= MỘT VÒNG CHƠI ================= */
function renderPlayStats(r) {
  const raw = Math.max(0, tot.correct - 0.5 * tot.wrong);
  const m = me(), top = board[0] ? board[0].score : 0;
  $("stScore").textContent = `${fmt((m ? m.score : 0) + raw / r.max)} / ${fmt(top)}`;
  $("stQues").textContent = `${tot.correct + tot.wrong} / ${r.max}`;
}

async function intro(r) {
  const el = $("svIntro");
  const first = r.phaseRound === 1;
  const head = first ? `Giai đoạn ${r.phase}` : `Vòng ${r.round}`;
  const sub = first ? PHASE_TEXT[r.phase] : `Giai đoạn ${r.phase}`;
  const paint = () => {
    const s = Math.max(0, Math.ceil((r.startAt - r.serverNow()) / 1000));
    el.innerHTML = `<b>${esc(head)}</b><span>${esc(sub)}</span><span>${esc(BossGames.names[r.game])} · bắt đầu sau ${s}</span>`;
  };
  el.classList.remove("leaving");
  paint();
  el.hidden = false;
  while (r.serverNow() < r.startAt - 250) { paint(); await sleep(150); }
  await fadeHide(el, 250);                         // mờ dần đúng lúc bắt đầu vòng
}

function runRound(r) {
  return new Promise(resolve => {
    let done = false, tick;
    const t0 = Date.now();
    tot = { correct: 0, wrong: 0 };
    $("svA").innerHTML = "";

    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(tick);
      const max = handle.max || r.max;
      handle.stop();
      handle = null;
      $("svSkip").disabled = true;
      $("svQ").innerHTML = "";
      $("svA").innerHTML = "";
      resolve({ correct: tot.correct, wrong: tot.wrong, max, timeMs: Math.min(Date.now() - t0, (r.endsAt - r.startAt) * SCALE) });
    };

    handle = BossGames.run(r.game, r.words, {
      el: $("svQ"),
      aEl: $("svA"),
      vocab: POOL.length >= 20 ? POOL : r.words,
      feedbackMs: SurvivalCore.SV.FEEDBACK_MS,
      onScore: s => { tot.correct = s; renderPlayStats(r); },
      onWrong: () => { tot.wrong++; renderPlayStats(r); },
      onDone: finish
    });
    $("svSkip").disabled = handle.canSkip === false;
    renderPlayStats(r);

    tick = setInterval(() => {
      const left = r.endsAt - r.serverNow();
      $("stTime").textContent = Math.max(0, Math.ceil(left / 1000)) + "s";
      if (left <= 0) finish();
    }, 200);
  });
}

async function playRound(r) {
  if (r.board) board = r.board;
  if (r.meAlive === false && alive) { alive = false; setMood("dead"); }   // vào lại phòng sau khi đã bị loại
  if (!alive) {                                   // đã bị loại: chỉ xem bảng xếp hạng
    $("svSkip").disabled = true;
    await view("spec", () => { setBadge(); renderSpec(); });
    await intro(r);                               // khán giả vẫn thấy màn giai đoạn / vòng
    return;
  }
  await view("play", () => { setBadge(); $("svQ").innerHTML = ""; renderLeaderboard(); });
  await intro(r);
  if (r.serverNow() >= r.endsAt) return;          // vào muộn: vòng đã hết giờ

  const res = await runRound(r);
  myTime += res.timeMs;
  net.sendResult(r.round, res);                   // ghi đúng 1 lần cho mỗi vòng
  $("svQ").innerHTML = '<p class="wait">⏳ Đang chờ cả phòng...</p>';
}

async function roundEnded(p) {
  const wasAlive = alive;
  board = p.board;
  alive = p.meAlive;
  if (wasAlive && !alive) { setMood("dead"); showElimPopup(p); }
  if (!wasAlive) { await view("spec", renderSpec); return; }   // khán giả: chỉ cập nhật bảng
  $("svSkip").disabled = true;
  await view("end", () => { setBadge(); renderEnd(p); });
}


/* ================= NÚT VÀ KHỞI ĐỘNG ================= */
async function leave() { try { await net.leave(); } catch (e) { /* bỏ qua */ } location.href = LOBBY; }

$("svSkip").onclick = () => { if (handle && handle.skip && handle.canSkip !== false) handle.skip(); };
$("svExit").onclick = () => { if (confirm("Thoát khỏi phòng? Bạn sẽ bị tính là bị loại.")) leave(); };
$("svSet").onclick = () => ($("svSettings").hidden = false);
$("svPopup").onclick = () => fadeHide($("svPopup"), 250);
$("svResume").onclick = () => fadeHide($("svSettings"));
$("svLeave2").onclick = leave;
$("svAgain").onclick = SOLO ? () => location.reload() : leave;   // bản thật: rời phòng cũ, về sảnh để tạo/vào phòng mới

// Mascot: ưu tiên .gif, không có thì dùng .png
const img = $("svMascot");
let tried = 0;
img.onerror = () => { if (tried++ === 0) img.src = MASCOT[1]; };
img.src = MASCOT[0];

function wire() {
  net.onRoundStart(r => queue(() => playRound(r)));
  net.onRoundEnd(p => queue(() => roundEnded(p)));
  net.onGameEnd(g => queue(() => showResult(g)));
  if (net.onClosed) net.onClosed(() => { if (!ended) location.href = LOBBY; });   // phòng đóng / bị mời ra
}

setBadge();
view("play");
$("svQ").innerHTML = '<p class="wait">⏳ Đang vào phòng...</p>';
$("svSkip").disabled = true;

(async () => {
  try {
    if (SOLO) {
      net = SurvivalNet.create({ players: PLAYERS, timeScale: SCALE, vocab: POOL, games: BossGames.ids, name: "Bạn" });
    } else {
      const engine = BossNet.create();             // cần Firebase đã cấu hình (JS/net/firebase-config.js)
      if (!(await engine.resume())) { location.href = LOBBY; return; }   // không còn phòng thì về sảnh
      net = SurvivalNet.connect(engine);
    }
  } catch (e) {
    console.error(e);
    $("svQ").innerHTML = `<p class="wait">Không kết nối được: ${esc(e.message || e.code || "lỗi mạng")}</p>`;
    return;
  }
  wire();
  net.start();
})();
