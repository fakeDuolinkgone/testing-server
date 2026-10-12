// gameMode/hangman/hangman.js

const TOTAL = 10;       // số từ mỗi lượt
const TIME = 60;        // giây cho mỗi từ
const MAX_WRONG = 6;    // số lần sai tối đa
// 11 nét của stickman gom thành 6 giai đoạn (chỉ số trong #hmMan), vẽ từ dưới trái đến chân phải
const STAGES = [[0, 1, 2], [3, 4], [5, 6], [7, 8], [9], [10]];
const TILES = 21;       // số ô chữ cái (7 cột x 3 hàng)
const HOME = "../../game.html";

const $ = id => document.getElementById(id);
const man = $("hmMan");
const keysEl = $("hmKeys");
const slotsEl = $("hmSlots");

let pool = [], words = [], results = [];
let idx = 0, word = "", wrong = 0, left = TIME;
let timer = null, locked = true, paused = false;


/* ================= TIỆN ÍCH ================= */
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const play = id => {
  const a = $(id);
  if (a) { a.currentTime = 0; a.play().catch(() => { }); }
};

const say = w => {
  try {
    if (typeof speak === "function") return speak(w);   // từ JS/common/audio.js
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "en-US";
    speechSynthesis.speak(u);
  } catch (e) { }
};


/* ================= DỮ LIỆU ================= */
// Chấp nhận nhiều dạng: [{word, classword, meaning}], {words:[...]}, hoặc {"apple": {...}}
function normalize(raw) {
  let list;
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw.words)) list = raw.words;
  else if (Array.isArray(raw.data)) list = raw.data;
  else list = Object.entries(raw).map(([k, v]) => ({ word: k, ...(typeof v === "object" ? v : { meaning: v }) }));

  return list.map(it => {
    let m = it.meaning ?? it.meanings ?? it.vi ?? it.vietnamese ?? "";
    if (Array.isArray(m)) m = m.slice(0, 2).join(", ");
    return {
      word: String(it.word ?? it.en ?? it.english ?? "").trim(),
      cls: it.classword ?? it.class ?? it.type ?? it.pos ?? "",
      meaning: String(m)
    };
  });
}

async function loadWords() {
  let raw;
  if (typeof normaFixWords !== "undefined") {
    raw = normaFixWords;                       // từ data/normaFixWords.js
  } else {
    try {
      const res = await fetch("../../data/normaFixWords.json");
      raw = await res.json();
    } catch (e) {
      // file:// chặn fetch → dùng vocabData làm dự phòng
      if (typeof vocabData !== "undefined") raw = vocabData;
      else throw e;
    }
  }

  const seen = new Set();
  return normalize(raw).filter(w => {
    const k = w.word.toLowerCase();
    const ok = /^[a-z]+$/.test(k) && k.length <= 16 && new Set(k).size <= 13 && !seen.has(k);
    seen.add(k);
    return ok;
  });
}


/* ================= LUỒNG GAME ================= */
function startGame() {
  words = shuffle([...pool]).slice(0, TOTAL);
  results = [];
  idx = 0;
  $("hmResult").hidden = true;
  $("hmPlay").hidden = false;
  startRound();
}

function startRound() {
  const w = words[idx];
  word = w.word.toLowerCase();
  wrong = 0;
  left = TIME;
  locked = false;

  $("hmClass").textContent = w.cls ? `(${w.cls})` : "";
  $("hmMeaning").textContent = w.meaning;
  $("hmMeaning").classList.toggle("long", w.meaning.length > 45);

  [...man.children].forEach(p => p.classList.remove("on"));
  man.classList.remove("shake");

  slotsEl.style.setProperty("--n", word.length);
  slotsEl.innerHTML = [...word].map(() => '<span class="slot"></span>').join("");

  // 21 ô: đủ chữ của từ + chữ ngẫu nhiên cho đủ số lượng
  const letters = [...new Set(word)];
  const extra = shuffle("abcdefghijklmnopqrstuvwxyz".split("").filter(c => !letters.includes(c)))
    .slice(0, TILES - letters.length);
  keysEl.innerHTML = shuffle([...letters, ...extra]).map(c =>
    `<button class="key" data-k="${c}" style="--r:${(Math.random() * 8 - 4).toFixed(1)}deg">${c.toUpperCase()}</button>`
  ).join("");

  render();
  clearInterval(timer);
  timer = setInterval(() => {
    if (paused || locked) return;
    left--;
    render();
    if (left <= 0) endRound(false);
  }, 1000);
}

function render() {
  const s = $("hmStatus");
  s.textContent = `${results.length}/${words.length} - ${left}s`;
  s.classList.toggle("warn", left <= 10 && !locked);
  $("hmWrong").textContent = `✖ ${wrong}/${MAX_WRONG}`;
}

function guess(btn) {
  if (locked || paused || btn.disabled) return;
  const c = btn.dataset.k;
  btn.disabled = true;

  if (word.includes(c)) {
    btn.classList.add("good");
    play("sound-correct");
    [...word].forEach((ch, i) => {
      if (ch === c) {
        slotsEl.children[i].textContent = ch.toUpperCase();
        slotsEl.children[i].classList.add("pop");
      }
    });
    if ([...slotsEl.children].every(s => s.textContent)) endRound(true);
  } else {
    btn.classList.add("bad");
    play("sound-wrong");
    STAGES[wrong].forEach(i => man.children[i].classList.add("on"));   // vẽ giai đoạn tiếp theo
    wrong++;
    render();
    if (wrong >= MAX_WRONG) endRound(false);
  }
}

function endRound(win) {
  locked = true;
  clearInterval(timer);
  results.push({ word, ok: win, wrong, cls: words[idx].cls, meaning: words[idx].meaning });

  if (win) {
    say(word);
  } else {
    [...word].forEach((ch, i) => {
      const s = slotsEl.children[i];
      if (!s.textContent) { s.textContent = ch.toUpperCase(); s.classList.add("miss"); }
    });
    man.classList.add("shake");
  }
  render();

  setTimeout(() => {
    idx++;
    idx < words.length ? startRound() : showResult();
  }, win ? 1300 : 2400);
}


/* ================= BẢNG KẾT QUẢ ================= */
function showResult() {
  const score = results.filter(r => r.ok).length;
  const pct = Math.round(score / results.length * 100);
  const rank = pct >= 90 ? "Xuất sắc! 🏆" : pct >= 70 ? "Rất tốt! 🎉" : pct >= 50 ? "Khá ổn 👍" : "Cố lên! 💪";

  $("hmScore").textContent = `${score} / ${results.length} từ`;
  $("hmRank").textContent = rank;
  $("hmList").innerHTML = results.map(r => `
    <li class="${r.ok ? "ok" : "no"}" data-word="${esc(r.word)}" tabindex="0" role="button" title="Bấm để nghe phát âm">
      <span>${r.ok ? "✓" : "✗"}</span>
      <div><b>${esc(r.word)}</b> <i>${r.cls ? `(${esc(r.cls)})` : ""}</i> 🔊</div>
      <em>${esc(r.meaning)}</em>
      <small>sai ${r.wrong}</small>
    </li>`).join("");

  $("hmPlay").hidden = true;
  $("hmResult").hidden = false;
  play("sound-finish");

  // Hiệu ứng đếm lên
  const setPct = v => {
    $("hmPct").textContent = `${Math.round(v)}%`;
    $("hmRing").style.strokeDashoffset = 100 - v;
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setPct(pct);

  setPct(0);
  const t0 = performance.now();
  const tick = now => {
    const t = Math.min((now - t0) / 1200, 1);
    setPct(pct * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


/* ================= SỰ KIỆN ================= */
keysEl.addEventListener("click", e => {
  const b = e.target.closest(".key");
  if (b) guess(b);
});

document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || !/^[a-z]$/i.test(e.key)) return;
  const b = keysEl.querySelector(`[data-k="${e.key.toLowerCase()}"]`);
  if (b) guess(b);
});

const overlay = $("hmOverlay");
const closeSettings = () => { overlay.classList.remove("show"); paused = false; };

$("hmGear").addEventListener("click", () => { paused = true; overlay.classList.add("show"); });
$("hmContinue").addEventListener("click", closeSettings);
$("hmRestart").addEventListener("click", () => location.reload());
$("hmExit").addEventListener("click", () => (location.href = HOME));
overlay.addEventListener("click", e => { if (e.target === overlay) closeSettings(); });

// Bấm (hoặc Enter) vào một từ trong bảng kết quả để nghe phát âm
const speakItem = li => {
  if (!li) return;
  say(li.dataset.word);
  li.classList.add("speaking");
  setTimeout(() => li.classList.remove("speaking"), 700);
};
$("hmList").addEventListener("click", e => speakItem(e.target.closest("li")));
$("hmList").addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    speakItem(e.target.closest("li"));
  }
});

$("hmAgain").addEventListener("click", startGame);
$("hmHome").addEventListener("click", () => (location.href = HOME));


/* ================= KHỞI ĐỘNG ================= */
loadWords()
  .then(list => {
    if (!list.length) throw new Error("Không có từ phù hợp");
    pool = list;
    startGame();
  })
  .catch(err => {
    console.error(err);
    $("hmMeaning").textContent =
      "Không đọc được normaFixWords.json. Hãy mở trang bằng Live Server thay vì mở trực tiếp file.";
  });