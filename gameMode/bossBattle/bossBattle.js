// bossBattle/bossBattle.js — luồng chính của BossBattle
// Mạng được tách thành đối tượng `Net`. Bản dưới đây là GIẢ LẬP (bot ngồi chơi cùng).
// Bạn kia chỉ cần viết firebaseAdapter.js có CÙNG tên hàm rồi thay `Net`; code game không phải sửa.

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const HOME = "../../game.html";

const BOSSES = {
  boss1: { icon: "🐲", name: "Rồng Lexi" },
  boss2: { icon: "🦑", name: "Kraken Verb" },
  boss3: { icon: "🗿", name: "Golem Noun" }
};
const TIER_NAME = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };

// Kho từ: dùng vocabData của LEARN (có classword, meaning[], example)
const vocab = vocabData
  .map(w => ({ ...w, meaning: Array.isArray(w.meaning) ? w.meaning : [w.meaning] }))
  .filter(w => w.word && w.meaning[0]);


/* ================= MẠNG GIẢ LẬP ================= */
const Net = {
  me: { id: "me", name: "Bạn" },
  players: [], totals: {}, times: {}, skill: {},

  init(n) {   // thật: danh sách người chơi lấy từ phòng
    this.players = [this.me, ...Array.from({ length: n - 1 }, (_, i) => ({ id: "bot" + i, name: "Bot " + (i + 1) }))];
    this.players.forEach(p => {
      this.totals[p.id] = 0;
      this.times[p.id] = 0;
      this.skill[p.id] = 0.45 + Math.random() * 0.5;
    });
  },

  now: () => Date.now(),   // thật: giờ đã hiệu chỉnh theo máy chủ

  // Thật: ghi ĐÚNG 1 LẦN cho mỗi giai đoạn
  submitScore(stage, score, timeMs) {
    this.totals.me += score;
    this.times.me += timeMs;
  },

  // Thật: chờ tài liệu trạng thái do host ghi (1 lần/giai đoạn), không tự tính
  async stageResult(stage, tier) {
    const tierBonus = { easy: 0.15, medium: 0, hard: -0.15 }[tier];
    this.players.slice(1).forEach(p => {
      const acc = Math.min(1, Math.max(0, this.skill[p.id] + tierBonus + (Math.random() - 0.5) * 0.2));
      this.totals[p.id] += Math.round(10 * acc);
      this.times[p.id] += 20000 + Math.random() * 20000;
    });
    await sleep(900);
    const totalDamage = Object.values(this.totals).reduce((s, x) => s + x, 0);
    return { stage, totalDamage };
  }
};


/* ================= GIAO DIỆN ================= */
const show = id => ["bbStart", "bbBattle", "bbResult"].forEach(s => ($(s).hidden = s !== id));

let hpMax = 1;
function setHp(value) {
  const v = Math.max(0, Math.ceil(value));
  $("bbHpFill").style.width = `${v / hpMax * 100}%`;
  $("bbHpText").textContent = `${v} / ${hpMax} HP`;
}

async function intro(title, sub) {
  const el = $("bbIntro");
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span>`;
  el.hidden = false;
  await sleep(1700);
  el.hidden = true;
}


/* ================= MỘT GIAI ĐOẠN ================= */
let committed = 0;   // sát thương cả đội đã được xác nhận ở các giai đoạn trước

function runStage(st) {
  return new Promise(resolve => {
    const words = st.wordIds.map(i => vocab[i]);
    const t0 = Net.now();
    const end = t0 + st.time * 1000;
    let score = 0, finished = false, handle, tick;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      score = handle.stop();
      $("bbArena").innerHTML = "";
      resolve({ score, timeMs: Math.min(Net.now(), end) - t0 });
    };

    $("bbMyDmg").textContent = `Sát thương của bạn: ${Net.totals.me}`;
    handle = BossGames.run(st.game, words, {
      el: $("bbArena"),
      vocab,
      onScore: s => {
        score = s;
        $("bbMyDmg").textContent = `Sát thương của bạn: ${Net.totals.me + s}`;
        setHp(S.hp - committed - s);   // xem trước ở máy mình, chưa cần đồng bộ mạng
      },
      onDone: finish
    });

    tick = setInterval(() => {
      const left = end - Net.now();
      $("bbTime").textContent = `${Math.max(0, Math.ceil(left / 1000))}s`;
      $("bbTime").classList.toggle("warn", left <= 10000);
      $("bbTimeFill").style.width = `${Math.max(0, left / (st.time * 1000)) * 100}%`;
      if (left <= 0) finish();
    }, 200);
  });
}


/* ================= CẢ VÁN ================= */
const S = { hp: 0 };

async function play(n) {
  const seed = (Math.random() * 4294967296) >>> 0;   // thật: host tạo và ghi 1 lần
  const game = BossCore.buildPlan(seed, n, vocab, BossGames.ids);
  Net.init(n);
  S.hp = hpMax = game.hp;
  committed = 0;

  const boss = BOSSES[game.boss];
  $("bbBossArt").textContent = boss.icon;
  $("bbBossName").textContent = boss.name;
  $("bbTeam").textContent = `${n} người chơi · ${game.stages} giai đoạn`;
  setHp(game.hp);
  show("bbBattle");

  let win = false;
  for (const st of game.plan) {
    const label = `${BossGames.names[st.game]} · ${TIER_NAME[st.tier]}`;
    $("bbStageName").textContent = `Giai đoạn ${st.index + 1}/${game.stages} · ${label}`;
    await intro(`Giai đoạn ${st.index + 1}`, `${label} · ${st.time} giây`);

    const mine = await runStage(st);
    Net.submitScore(st.index, mine.score, mine.timeMs);

    $("bbArena").innerHTML = '<p class="wait">⏳ Đang tổng hợp sát thương của cả đội...</p>';
    const res = await Net.stageResult(st.index, st.tier);
    committed = res.totalDamage;
    setHp(game.hp - committed);                       // số thật, đồng bộ cuối giai đoạn
    $("bbBossArt").classList.remove("hit");
    void $("bbBossArt").offsetWidth;                  // chạy lại hiệu ứng
    $("bbBossArt").classList.add("hit");
    $("bbArena").innerHTML = `<p class="wait">💥 Cả đội đã gây ${committed} sát thương!</p>`;
    await sleep(1800);

    if (BossCore.isBossDead(game.hp, committed)) { win = true; break; }
  }

  showResult(win, game);
}


/* ================= KẾT QUẢ ================= */
function showResult(win, game) {
  const ranked = BossCore.rank(Net.players.map(p => ({
    id: p.id, name: p.name, damage: Net.totals[p.id], timeMs: Net.times[p.id]
  })));
  const left = Math.max(0, game.hp - committed);

  $("bbBanner").textContent = win ? "🏆 CHIẾN THẮNG!" : "💀 THẤT BẠI";
  $("bbBannerSub").textContent = win
    ? `${BOSSES[game.boss].name} đã gục ngã!`
    : `${BOSSES[game.boss].name} vẫn còn ${left} HP. Lần sau cố lên!`;

  $("bbRank").innerHTML = ranked.map(r => `
    <li class="${r.id === "me" ? "me" : ""}">
      <span>${r.place === 1 ? "👑" : "#" + r.place}</span>
      <b>${esc(r.name)}${r.place === 1 ? " (MVP)" : ""}</b>
      <span>${r.damage} sát thương</span>
      <small>${Math.round(r.share * 100)}%${r.gap ? ` · -${r.gap}` : ""}</small>
    </li>`).join("");

  show("bbResult");
  if (typeof playFinish === "function") playFinish();
}


/* ================= KHỞI ĐỘNG ================= */
const readN = () => Math.min(40, Math.max(1, parseInt($("bbN").value, 10) || 1));
const updateInfo = () => {
  const n = readN();
  $("bbInfo").textContent = `${n} người → ${BossCore.stageCount(n)} giai đoạn · Boss ${BossCore.hpFor(n)} HP`;
};

$("bbN").addEventListener("input", updateInfo);
$("bbGo").addEventListener("click", () => play(readN()));
$("bbBack").addEventListener("click", () => (location.href = HOME));
$("bbAgain").addEventListener("click", () => { show("bbStart"); updateInfo(); });
$("bbHome").addEventListener("click", () => (location.href = HOME));
updateInfo();
