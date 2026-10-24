/* global playCorrect, playWrong, playFinish, speak, BossNet, WordChainNet, WordChainCore, wordChainData */
// wordChain/wordChainMulti.js — trang game Word Chain NHIỀU NGƯỜI. Chỉ nói chuyện với `net` (wordChainNet.js).
// Vào từ phòng: room.html → chủ phòng chọn Word Chain → Bắt đầu. (Bản chơi đơn với AI vẫn là wordChain.html.)

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sfx = n => { try { if (typeof window[n] === "function") window[n](); } catch (e) { /* bỏ qua */ } };

const Core = WordChainCore, WC = Core.WC, DATA = wordChainData;
const LOBBY = "../../room.html", HOME = "../../index.html";

const RESULT_RANKS = [
  { min: 90, title: "Xuất sắc! 🏆", message: "Gần như không sai chữ nào." },
  { min: 70, title: "Rất tốt! 🎉", message: "Vốn từ của bạn rất ổn." },
  { min: 50, title: "Khá ổn 👍", message: "Chơi thêm ván nữa để nối mượt hơn nhé." },
  { min: 0, title: "Cố lên! 💪", message: "Thử nghĩ từ có chữ cuối dễ nối, bạn sẽ tiến bộ ngay." }
];

const input = $("wordInput"), submitBtn = $("submitBtn"), chatArea = $("chatArea");
const timerBox = $("timer"), mistakeBox = $("mistake"), settingsOverlay = $("settingsOverlay");

let net = null, clock = Date.now, startAt = 0, intro = true;
let S = null;                                   // trạng thái ván mới nhất từ máy chủ
let seen = new Set();                           // các lượt đã vẽ vào chat
let wrong = 0, totalWrong = 0, myWords = 0;     // thống kê của riêng bạn
let sentTurn = -1;                              // lượt mà bạn đã gửi từ (chờ host xác nhận)
let ended = false, tickID = null;

const nm = id => (id === "-" ? "Từ khởi đầu" : (net.names[id] || "?"));
const initial = id => (id === "-" ? "🤖" : (Array.from(nm(id))[0] || "?").toUpperCase());

/* ================= NỀN ================= */
for (let i = 0; i < 20; i++) { const b = document.createElement("span"); b.className = "bubble"; $("bubbles").appendChild(b); }

/* ================= HIỆU ỨNG VÀ THÔNG BÁO ================= */
function showNotice(text) {
  const n = document.createElement("div");
  n.className = "notice";
  n.innerText = text;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1500);
}
function inputEffect(type) {
  input.classList.remove("correct-input", "wrong-input");
  void input.offsetWidth;
  input.classList.add(type);
  setTimeout(() => input.classList.remove(type), 400);
}
function sysLine(text) {
  const d = document.createElement("div");
  d.className = "mp-sys";
  d.textContent = text;
  chatArea.appendChild(d);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/* ================= DANH SÁCH NGƯỜI CHƠI ================= */
function renderPlayers() {
  if (!S) return;
  const strip = $("mpPlayers");
  strip.innerHTML = S.order.map(id => {
    const dead = !(S.lives[id] > 0);
    return `<div class="mp-chip ${id === S.p && !dead ? "active" : ""} ${dead ? "dead" : ""} ${id === net.id ? "me" : ""}" data-id="${esc(id)}">
      <span class="mp-av">${esc(initial(id))}</span>
      <span class="mp-nm">${esc(nm(id))}${id === net.id ? " (bạn)" : ""}</span>
      <span class="mp-hp">${dead ? "☠" : "♥".repeat(S.lives[id])}</span>
      <b class="mp-sc">${S.scores[id] || 0}</b>
    </div>`;
  }).join("");
  const a = strip.querySelector(".mp-chip.active");
  if (a) strip.scrollLeft = a.offsetLeft - strip.clientWidth / 2 + a.offsetWidth / 2;
}

function renderHearts() {
  const lives = S ? Math.max(0, S.lives[net.id] || 0) : WC.LIVES;
  document.querySelectorAll(".life").forEach((h, i) => { h.style.opacity = i < lives ? "" : "0.2"; });
}

const updateMistake = () => {
  mistakeBox.innerText = "❌ " + wrong + "/" + WC.MAX_WRONG;
  mistakeBox.classList.toggle("danger", wrong >= WC.MAX_WRONG - 1);
};

/* ================= CHAT ================= */
function addMessage(item) {
  const data = DATA.lookup[item.w];
  if (!data) return;
  const mine = item.p === net.id, side = mine ? "player" : "ai";
  const typeText = Array.isArray(data.type) ? data.type.join(", ") : (data.type || "");
  const meanings = Array.isArray(data.meanings) ? data.meanings : [];
  const first = meanings.length ? meanings[0].text : "";
  const list = meanings.map(m => `<div class="meaning-item"><span class="meaning-bullet">•</span><span class="meaning-text">${m.text}</span></div>`).join("");

  const avatar = mine
    ? '<div class="avatar player-avatar" style="text-align:center;align-content:center"><img src="../../pics/human avatar.png" alt="" width="35" height="35"></div>'
    : item.p === "-"
      ? '<div class="avatar ai-avatar" style="text-align:center;align-content:center"><img src="../../pics/robot icon.png" alt="" width="35" height="35"></div>'
      : `<div class="avatar ai-avatar"><span class="mp-letter">${esc(initial(item.p))}</span></div>`;

  const div = document.createElement("div");
  div.className = "message " + (mine ? "left" : "right");
  div.innerHTML = `
    ${mine ? avatar : ""}
    <div class="mp-col">
      <div class="mp-who">${mine ? "Bạn" : esc(nm(item.p))}</div>
      <div class="bubble-chat ${mine ? "" : "ai"}">
        <div class="word">${data.word}<span class="type">${typeText}</span></div>
        <div class="meaning-preview">${first}</div>
        ${meanings.length > 1 ? '<button class="meaning-toggle" type="button">[▼] Show Details</button>' : ""}
        ${meanings.length > 1 ? `<div class="meaning-list">${list}</div>` : ""}
      </div>
    </div>
    ${mine ? "" : avatar}`;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;

  const btn = div.querySelector(".meaning-toggle"), box = div.querySelector(".meaning-list"), pre = div.querySelector(".meaning-preview");
  if (btn && box) btn.addEventListener("click", () => {
    const open = box.classList.toggle("show");
    pre.style.display = open ? "none" : "block";
    btn.innerText = open ? "[▲] Hide Details" : "[▼] Show Details";
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

/* ================= LƯỢT CỦA BẠN ================= */
const myTurn = () => !!S && !ended && !intro && S.p === net.id && S.lives[net.id] > 0;
const canType = () => myTurn() && sentTurn !== S.n && !settingsOverlay.classList.contains("show");

function updateInput() {
  const can = canType();
  input.disabled = !can;
  submitBtn.disabled = !can;
  if (!S) { input.placeholder = "Đang chuẩn bị…"; return; }
  const L = S.w.slice(-1).toUpperCase();
  if (ended) input.placeholder = "";
  else if (!(S.lives[net.id] > 0)) input.placeholder = "Bạn đã bị loại — đang xem tiếp";
  else if (S.p === net.id) input.placeholder = sentTurn === S.n ? "Đang chờ xác nhận…" : `Đến lượt bạn! Nhập từ bắt đầu bằng chữ ${L}`;
  else input.placeholder = `Chờ ${nm(S.p)}… (chữ ${L})`;
  if (can && !settingsOverlay.classList.contains("show")) input.focus();
}

function submitWord() {
  if (!canType()) return;
  const word = input.value.trim().toLowerCase();
  input.value = "";
  if (!word) return;

  const used = new Set(S.history.map(h => h.w));
  const r = Core.checkWord(DATA, S.w, used, word);
  if (!r.ok) {
    wrong++; totalWrong++;
    inputEffect("wrong-input");
    sfx("playWrong");
    showNotice("❌ " + r.reason);
    if (wrong >= WC.MAX_WRONG) { wrong = 0; sentTurn = S.n; net.loseTurn(S.n); showNotice("💔 Sai quá nhiều lần: mất 1 mạng"); }
    updateMistake();
    updateInput();
    return;
  }
  inputEffect("correct-input");
  sentTurn = S.n;
  net.submitWord(S.n, word);                      // host xác nhận rồi mới chuyển lượt
  updateInput();
}
input.addEventListener("keydown", e => { if (e.key === "Enter") submitWord(); });
submitBtn.addEventListener("click", submitWord);

/* ================= ĐỒNG HỒ ================= */
function updateClock() {
  const now = clock();
  if (intro) {
    const left = Math.ceil((startAt - now) / 1000);
    if (S && left <= 0) { intro = false; $("mpIntro").classList.add("gone"); updateInput(); }
    else $("mpIntroSub").textContent = !startAt ? "Đang chờ chủ phòng bắt đầu…"
      : left > 0 ? `Bắt đầu sau ${left}` : "Đang dựng ván, chờ chủ phòng…";
    return;
  }
  if (!S || ended) return;
  const left = Math.max(0, Math.ceil((S.dl - now) / 1000));
  timerBox.innerText = left + "s";
  timerBox.classList.toggle("danger", left <= 10);
}

/* ================= NHẬN TRẠNG THÁI TỪ MÁY CHỦ ================= */
function onState(v) {
  const prev = S;
  S = v;

  let last = null;
  v.history.forEach(h => { if (!seen.has(h.n)) { seen.add(h.n); addMessage(h); last = h; if (h.p === net.id) myWords++; } });
  if (last && prev) { if (last.p === net.id) sfx("playCorrect"); if (typeof speak === "function") speak(last.w); }

  if (prev) v.order.forEach(id => {                                        // ai vừa mất mạng / bị loại
    if (v.lives[id] < prev.lives[id]) {
      const who = id === net.id ? "Bạn" : nm(id);
      if (v.lives[id] <= 0) sysLine(`☠ ${who} đã bị loại${v.left.includes(id) ? " (rời phòng)" : ""}`);
      else sysLine(`💔 ${who} mất 1 mạng`);
      if (id === net.id) sfx("playWrong");
    }
  });
  if (!prev || prev.n !== v.n) { wrong = 0; updateMistake(); }

  renderPlayers();
  renderHearts();
  updateInput();
  updateClock();
}

/* ================= KẾT QUẢ ================= */
function animateResult(percent) {
  const ring = $("resultRingFill"), label = $("resultPercent");
  const bars = $("resultScore").querySelectorAll(".result-bar-fill");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setPercent = v => { label.textContent = `${Math.round(v)}%`; ring.style.strokeDashoffset = 100 - v; };
  const growBars = () => bars.forEach(b => (b.style.width = `${b.dataset.width}%`));
  if (reduce) { setPercent(percent); growBars(); return; }
  setPercent(0);
  requestAnimationFrame(growBars);
  const t0 = performance.now();
  const tick = now => {
    const t = Math.min((now - t0) / 1200, 1);
    setPercent(percent * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function showHistory(history) {
  const box = $("resultWord");
  box.innerHTML = "";
  history.forEach((item, index) => {
    const data = DATA.lookup[item.w];
    if (!data) return;
    const typeText = Array.isArray(data.type) ? data.type.join(", ") : (data.type || "");
    const meanings = Array.isArray(data.meanings) ? data.meanings : [];
    const first = meanings.length ? meanings[0].text : "Không có nghĩa";
    const list = meanings.map(m => `<div class="meaning-item"><span class="meaning-bullet">•</span><span class="meaning-text">${m.text}</span></div>`).join("");
    const div = document.createElement("div");
    div.className = "history-item " + (item.p === net.id ? "player" : "ai");
    div.innerHTML = `
      <div class="history-number">${index + 1}</div>
      <div class="history-content">
        <div class="history-word history-speak" title="Bấm để nghe">🔊 <strong>${data.word}</strong>
          <span class="history-type">${typeText}</span>
          <span class="history-type">${item.p === net.id ? "Bạn" : esc(nm(item.p))}</span></div>
        <div class="history-meaning">→ ${first}</div>
        ${meanings.length > 1 ? `<button class="meaning-toggle history-toggle" type="button">[V] ▼</button>
          <div class="meaning-list history-meaning-list">${list}</div>` : ""}
      </div>`;
    box.appendChild(div);
    div.querySelector(".history-speak").addEventListener("click", () => { if (typeof speak === "function") speak(data.word); });
    const tg = div.querySelector(".history-toggle"), ml = div.querySelector(".history-meaning-list"), fm = div.querySelector(".history-meaning");
    if (tg) tg.addEventListener("click", e => {
      e.stopPropagation();
      const open = ml.classList.toggle("show");
      fm.style.display = open ? "none" : "block";
      tg.innerText = open ? "[V] ▲" : "[V] ▼";
    });
  });
}

function showFinal(g) {
  if (ended) return;
  ended = true;
  clearInterval(tickID);
  settingsOverlay.classList.remove("show");
  $("mpIntro").classList.add("gone");
  input.disabled = true; submitBtn.disabled = true;
  sfx("playFinish");

  const total = g.ranking.length, won = g.myRank === 1;
  const attempts = myWords + totalWrong;
  const percent = attempts > 0 ? Math.round(myWords / attempts * 100) : 0;
  const rk = RESULT_RANKS.find(r => percent >= r.min);
  const best = Math.max(1, ...g.ranking.map(r => r.score));

  $("resultTitle").innerText = won ? "CHIẾN THẮNG! 🏆" : "KẾT THÚC";
  $("resultReason").innerText = won ? "Bạn là người cuối cùng trụ lại" : `Bạn xếp hạng ${g.myRank}/${total}`;
  $("resultTotal").innerText = `${myWords} / ${attempts} lượt đúng`;
  $("resultRank").innerText = rk.title;
  $("resultMessage").innerText = rk.message;
  $("resultScore").innerHTML = g.ranking.map((r, i) => `
    <li class="result-row ${r.id === net.id ? "me" : ""}" style="--i:${i}">
      <div class="result-row-head"><span>#${r.rank} ${esc(r.name)}${r.id === net.id ? " (bạn)" : ""}${r.left ? " (đã rời)" : ""}</span><strong>${r.score} từ</strong></div>
      <div class="result-bar"><div class="result-bar-fill" data-width="${Math.round(r.score / best * 100)}"></div></div>
    </li>`).join("");

  $("resultScreen").style.display = "flex";
  animateResult(percent);
  showHistory(S ? S.history : []);
}

/* ================= CÀI ĐẶT VÀ THOÁT ================= */
async function leave(to) { try { await net.leave(); } catch (e) { /* bỏ qua */ } location.href = to; }

$("settingBtn").addEventListener("click", () => { if (ended) return; settingsOverlay.classList.add("show"); input.blur(); updateInput(); });
$("continueBtn").addEventListener("click", () => { settingsOverlay.classList.remove("show"); updateInput(); });
settingsOverlay.addEventListener("click", e => { if (e.target === settingsOverlay) { settingsOverlay.classList.remove("show"); updateInput(); } });
$("exitSettingsBtn").addEventListener("click", () => { if (confirm("Thoát khỏi phòng? Bạn sẽ bị loại khỏi ván này.")) leave(LOBBY); });
$("resultRoomBtn").addEventListener("click", () => leave(LOBBY));
$("resultHomeBtn").addEventListener("click", () => leave(HOME));

/* ================= KHỞI ĐỘNG ================= */
(async () => {
  try {
    const engine = BossNet.create();                         // cần Firebase đã cấu hình (JS/net/firebase-config.js)
    if (!(await engine.resume())) { location.href = LOBBY; return; }
    net = WordChainNet.connect(engine);
  } catch (e) {
    console.error(e);
    $("mpIntroSub").textContent = "Không kết nối được: " + (e.message || e.code || "lỗi mạng");
    return;
  }
  net.onStart(info => { startAt = info.startAt; clock = info.serverNow; $("mpIntroSub").textContent = "Đang chuẩn bị…"; });
  net.onState(onState);
  net.onFinal(showFinal);
  net.onClosed(() => { if (!ended) location.href = LOBBY; });
  updateMistake();
  net.start();
  tickID = setInterval(updateClock, 200);
})();
