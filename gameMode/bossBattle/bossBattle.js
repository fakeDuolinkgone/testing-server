// bossBattle/bossBattle.js — trang game, nối với lớp mạng BossNet (JS/net/boss-net.js)
//
// Game chạy THEO SỰ KIỆN của `net`: host phát giai đoạn → mình chơi → gửi điểm 1 lần → nhận kết quả.
// Thử một mình (không cần Firebase):  bossBattle.html?solo=1&bots=3&fast=1

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const HOME = "../../index.html";   // trang đầu tiên (Trang chủ)
const LOBBY = "../../room.html";

// 5 boss, mỗi boss có 3 dạng (1 → 2 → 3) tăng dần theo độ khó của giai đoạn.
// Ảnh nằm trong pics/bosspics/. THỨ TỰ MẢNG = id boss mà boss-net.js bốc ngẫu nhiên (0..BOSS_COUNT-1),
// nên khi thêm boss mới: thêm vào CUỐI mảng và tăng BOSS_COUNT trong JS/net/boss-rules.js.
// foot = phần chiều cao ảnh còn trống dưới chân boss ở dạng 1/2/3, để chân boss luôn đứng giữa bục.
const BOSS_PIC_DIR = "../../pics/bosspics/";
const BOSSES = [
  { name: "Cậu bé' Burgur", foot: [0.109, 0.109, 0.05], pic: n => `${BOSS_PIC_DIR}bossBurgur_stage${n}.png` },
  { name: "Sú Shì Mắm Tôm", foot: [0.156, 0.141, 0.141], pic: n => `${BOSS_PIC_DIR}bossSushi_stage${n}.png` },
  { name: "Baguette Phép Lèm", foot: [0.016, 0.016, 0.016], pic: n => `${BOSS_PIC_DIR}bossBaguette_stage${n}.png` },
  { name: "Hoàng Kê Luộc", foot: [0.031, 0.016, 0.031], pic: n => `${BOSS_PIC_DIR}bossBoiledChicken_stage${n}.png` },
  { name: "Hỏa Quái Chili Pepper", foot: [0.016, 0.016, 0.016], pic: n => `${BOSS_PIC_DIR}bossChiliPepper_stage${n}.png` }
];
const BOSS_PHASES = 3;

// Giai đoạn → dạng boss: chia đều khoảng giai đoạn thành 3 phần (3 gđ: 1-2-3; 4 gđ: 1-1-2-3; 5 gđ: 1-1-2-2-3).
function bossPhase(stage, stageCount) {
  const n = Math.floor((stage - 1) / Math.max(1, stageCount) * BOSS_PHASES) + 1;
  return Math.min(BOSS_PHASES, Math.max(1, n));
}

function setBossArt(stage, stageCount) {
  const img = $("bbBossImg");
  const phase = bossPhase(stage, stageCount);
  const src = boss.pic(phase);
  $("bbBossArt").style.setProperty("--foot", boss.foot[phase - 1]);
  const had = img.getAttribute("src");
  if (had !== src) {
    img.src = src;
    if (had) {                                   // đổi sang dạng mạnh hơn: nháy sáng + phình ra
      const art = $("bbBossArt");
      art.classList.remove("evolve");
      void art.offsetWidth;
      art.classList.add("evolve");
      setTimeout(() => art.classList.remove("evolve"), 950);
    }
  }
  img.alt = `${boss.name} - dạng ${phase}`;
}

function preloadBoss() {                      // nạp sẵn cả 3 dạng để đổi ảnh không bị chớp
  for (let n = 1; n <= BOSS_PHASES; n++) new Image().src = boss.pic(n);
}
const TIER_NAME = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };

// Kho từ làm đáp án nhiễu (meaning luôn là mảng)
const POOL = (typeof vocabData !== "undefined" ? vocabData : [])
  .map(w => ({ ...w, meaning: Array.isArray(w.meaning) ? w.meaning : [w.meaning] }))
  .filter(w => w.word && w.meaning[0]);

const params = new URLSearchParams(location.search);
const SOLO = params.has("solo");
if (params.has("fast")) {   // rút ngắn thời gian để thử nhanh
  Object.assign(BossRules, { FIRST_STAGE_DELAY_MS: 2500, BREAK_MS: 2500, MIN_SECONDS: 15, MAX_SECONDS: 25 });
}

let net, boss = BOSSES[0];
let hpMax = 1, summary = null;   // summary: bản tổng hợp điểm mới nhất từ net.onScoresUpdate
let stageNow = 0, myLive = 0;    // điểm đang có trong giai đoạn hiện tại (chưa chắc đã gửi lên mạng)
let finished = false;

// Các việc giao diện chạy lần lượt, không chồng lên nhau
let chain = Promise.resolve();
const queue = fn => (chain = chain.then(fn).catch(e => console.error(e)));


/* ================= GIAO DIỆN ================= */
const show = id => ["bbStart", "bbBattle", "bbResult"].forEach(s => ($(s).hidden = s !== id));

function toast(msg) {
  const el = document.createElement("div");
  el.className = "bb-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Chấm tiến độ giai đoạn trong bảng boss: xanh = đã qua, cam = đang đánh
function renderPips(stage, total) {
  $("bbPips").innerHTML = Array.from({ length: total }, (_, i) =>
    `<i class="${i < stage - 1 ? "done" : i === stage - 1 ? "now" : ""}"></i>`).join("");
}

// Số sát thương bay lên từ boss (tự xoá sau 1 giây)
function popDamage(n, team = false) {
  const el = document.createElement("span");
  el.className = "bb-pop" + (team ? " team" : "");
  el.textContent = `-${n}`;
  el.style.setProperty("--dx", `${Math.round((Math.random() - .5) * 120)}px`);
  $("bbPops").appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function mine() {
  return summary && summary.ranking.find(r => r.id === net.id);
}

// Thanh máu = số thật từ mạng, trừ phần điểm của mình chưa được tính (xem trước ở máy mình, không tốn mạng)
function renderHp() {
  if (!summary) return;
  const me = mine();
  const pending = Math.max(0, myLive - ((me && me.perStage[stageNow]) || 0));
  const v = Math.max(0, Math.ceil(summary.hp - pending));
  $("bbHpFill").style.width = `${v / hpMax * 100}%`;
  $("bbHpText").textContent = `HP: ${v}/${hpMax}`;
  $("bbMyDmg").textContent = `⚔️ Sát thương của bạn: ${((me && me.total) || 0) + pending}`;
  const low = v > 0 && v / hpMax <= 0.25;        // dưới 25% máu: thanh máu nhấp nháy, boss thở gấp
  document.querySelector(".bb-hp").classList.toggle("low", low);
  $("bbBattle").classList.toggle("low", low);
}

async function intro(title, sub, st) {
  const el = $("bbIntro");
  el.hidden = false;
  while (st.serverNow() < st.startAt) {
    const s = Math.ceil((st.startAt - st.serverNow()) / 1000);
    el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span><span>Bắt đầu sau ${s}...</span>`;
    await sleep(200);
  }
  el.hidden = true;
}


/* ================= MỘT GIAI ĐOẠN ================= */
function runStage(st, gameId) {
  return new Promise(resolve => {
    let score = 0, finished = false, handle, tick;
    const total = st.endsAt - st.startAt;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      score = handle.stop();
      $("bbArena").innerHTML = "";
      resolve(score);
    };

    handle = BossGames.run(gameId, st.words, {
      el: $("bbArena"),
      vocab: POOL.length >= 20 ? POOL : st.words,
      onScore: s => { const d = s - myLive; score = myLive = s; renderHp(); if (d > 0) popDamage(d); },
      onDone: finish
    });

    tick = setInterval(() => {
      const left = st.endsAt - st.serverNow();
      $("bbTime").textContent = `${Math.max(0, Math.ceil(left / 1000))}s`;
      $("bbTime").classList.toggle("warn", left <= 10000);
      $("bbTimeFill").style.width = `${Math.max(0, left / total) * 100}%`;
      if (left <= 0) finish();
    }, 200);
  });
}

async function playStage(st) {
  stageNow = st.stage;
  myLive = 0;
  setBossArt(st.stage, st.stageCount);
  const known = BossGames.ids.includes(st.game);
  if (!known) console.warn("[BossBattle] Host chưa gửi mini game cho giai đoạn này, dùng Trắc nghiệm thay thế.");
  const id = known ? st.game : "choiceEnVi";
  const info = BossCore.GAMES.find(g => g.id === id);
  const label = BossGames.names[id] + (info ? " · " + TIER_NAME[info.tier] : "");

  $("bbStageName").textContent = label;
  $("bbStageNo").textContent = `Giai đoạn ${st.stage}/${st.stageCount}`;
  renderPips(st.stage, st.stageCount);
  $("bbArena").innerHTML = "";
  show("bbBattle");
  renderHp();
  await intro(`Giai đoạn ${st.stage}`, `${label} · ${st.durationSec} giây`, st);
  if (st.serverNow() >= st.endsAt) return;        // vào muộn: giai đoạn đã hết giờ

  const score = await runStage(st, id);

  // Tiết kiệm Firebase: chỉ GHI 1 LẦN cho mỗi giai đoạn (điểm cuối), rồi báo đã xong
  $("bbArena").innerHTML = '<p class="wait">⏳ Đang chờ cả đội...</p>';
  await net.sendScore(st.stage, score);
  await net.sendDone(st.stage);
}

async function stageEnded(e) {
  $("bbBossArt").classList.remove("hit");
  void $("bbBossArt").offsetWidth;                // chạy lại hiệu ứng
  $("bbBossArt").classList.add("hit");
  $("bbArena").innerHTML = `<p class="wait">💥 Cả đội đã gây ${e.damage} sát thương!</p>`;
  if (e.damage > 0) popDamage(e.damage, true);
  await sleep(1800);
}


/* ================= KẾT QUẢ ================= */
function showResult(e) {
  finished = true;
  const total = e.ranking.reduce((s, r) => s + r.total, 0);
  const top = e.ranking.length ? e.ranking[0].total : 0;
  const win = e.outcome === "win";

  $("bbBanner").textContent = win ? "🏆 CHIẾN THẮNG!" : "💀 THẤT BẠI";
  $("bbBannerSub").textContent = win
    ? `${boss.name} đã gục ngã!`
    : `${boss.name} vẫn còn ${e.hp} HP. Lần sau cố lên!`;

  $("bbRank").innerHTML = e.ranking.map(r => `
    <li class="${r.id === net.id ? "me" : ""}">
      <span>${r.rank === 1 ? "👑" : "#" + r.rank}</span>
      <b>${esc(r.name)}${r.rank === 1 ? " (MVP)" : ""}${r.left ? " (đã rời)" : ""}</b>
      <span>${r.total} sát thương</span>
      <small>${total ? Math.round(r.total / total * 100) : 0}%${top - r.total ? ` · -${top - r.total}` : ""}</small>
    </li>`).join("");

  show("bbResult");
  if (typeof playFinish === "function") playFinish();
}

async function backTo(url) {
  try { await net.leaveRoom(); } catch (e) { /* bỏ qua */ }
  location.href = url;
}


/* ================= NỐI VỚI MẠNG ================= */
function wire() {
  // Đăng ký callback TRƯỚC khi resume()/startGame(): callback sẽ nhận ngay trạng thái hiện tại.
  net.onGameStart(g => {
    boss = BOSSES[g.boss % BOSSES.length];
    hpMax = g.maxHp;
    const s = net.getSummary();
    preloadBoss();
    setBossArt(1, g.stageCount);
    $("bbBossName").textContent = boss.name;
    $("bbTeam").textContent = `👥 ${s ? s.ranking.length : net.getPlayers().length} người chơi · ${g.stageCount} giai đoạn`;
    renderPips(1, g.stageCount);
    show("bbBattle");
  });

  net.onScoresUpdate(s => { summary = s; hpMax = s.effectiveMaxHp; renderHp(); });
  net.onStageStart(st => queue(() => playStage(st)));
  net.onStageEnd(e => queue(() => stageEnded(e)));
  net.onGameEnd(e => queue(() => showResult(e)));
  net.onPlayerLeave(p => toast(`${p.name} đã rời phòng, boss bớt ${p.reduction} HP`));
  net.onRoomClosed(() => { if (!finished) location.href = LOBBY; });
  net.onRemoved(() => { if (!finished) location.href = LOBBY; });
}

/* ================= NÚT CÔNG CỤ (rời trận / thoát / cài đặt) ================= */
function ask(title, text, yesLabel, onYes) {
  $("bbConfirmTitle").textContent = title;
  $("bbConfirmText").textContent = text;
  $("bbConfirmYes").textContent = yesLabel;
  $("bbConfirm").hidden = false;
  $("bbConfirmNo").focus();
  $("bbConfirmYes").onclick = () => { $("bbConfirm").hidden = true; onYes(); };
}
const closeAsk = () => ($("bbConfirm").hidden = true);

// Rời giữa trận: boss bớt máu theo phần của mình và cả đội được báo (do boss-net xử lý)
$("bbToolRun").addEventListener("click", () =>
  ask("Rời trận?", "Bạn sẽ rời phòng và về sảnh chờ, boss sẽ bớt máu theo phần của bạn.", "Về sảnh chờ", () => backTo(LOBBY)));
$("bbToolExit").addEventListener("click", () =>
  ask("Thoát game?", "Bạn sẽ rời phòng và về trang chủ.", "Về trang chủ", () => backTo(HOME)));
$("bbConfirmNo").addEventListener("click", closeAsk);
$("bbConfirm").addEventListener("click", e => { if (e.target === $("bbConfirm")) closeAsk(); });

// Cài đặt: âm thanh + toàn màn hình
let soundOn = true;
try { soundOn = localStorage.getItem("bb.sound") !== "0"; } catch (e) { /* bỏ qua */ }
function applySound() {
  document.querySelectorAll("audio").forEach(a => (a.muted = !soundOn));
  window.soundEnabled = soundOn;
  $("bbOptSound").setAttribute("aria-checked", String(soundOn));
  $("bbOptSound").querySelector("b").textContent = soundOn ? "Bật" : "Tắt";
}
const closeMenu = () => { $("bbSettings").hidden = true; $("bbToolSet").setAttribute("aria-expanded", "false"); };
$("bbToolSet").addEventListener("click", e => {
  e.stopPropagation();
  const open = $("bbSettings").hidden;
  $("bbSettings").hidden = !open;
  $("bbToolSet").setAttribute("aria-expanded", String(open));
});
$("bbSettings").addEventListener("click", e => e.stopPropagation());
$("bbOptSound").addEventListener("click", () => {
  soundOn = !soundOn;
  try { localStorage.setItem("bb.sound", soundOn ? "1" : "0"); } catch (e) { /* bỏ qua */ }
  applySound();
});
$("bbOptFull").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { });
  closeMenu();
});
document.addEventListener("click", closeMenu);
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeMenu(); closeAsk(); } });
applySound();

$("bbBack").addEventListener("click", () => backTo(LOBBY));
$("bbAgain").addEventListener("click", () => backTo(LOBBY));   // chơi lại = tạo phòng mới ở sảnh
$("bbHome").addEventListener("click", () => backTo(HOME));

(async () => {
  try {
    if (SOLO) {
      net = await BossNet.createSolo({ bots: params.has("bots") ? +params.get("bots") : 3 });
      wire();
      $("bbInfo").textContent = "Chế độ thử một mình, bot ngồi chơi cùng...";
      await net.startGame();
    } else {
      net = BossNet.create();
      wire();
      const r = await net.resume();                // không còn phòng thì về sảnh
      if (!r) location.href = LOBBY;
    }
  } catch (err) {
    console.error(err);
    $("bbInfo").textContent = "Không kết nối được: " + (err.message || err.code);
  }
})();