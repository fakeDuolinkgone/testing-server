let currentMiniGame = 0;
let currentWords = [];

let gameResult = {
  typing: 0,
  choice: 0,
  match: 0,
  sentence: 0
};

const progressFill = document.getElementById("progressFill");
const progressMessage = document.getElementById("progressMessage");
const loadingScreen = document.getElementById("loadingScreen");
const loadingTitle = document.getElementById("loadingTitle");
const gameGrid = document.querySelector(".game-grid");
const learnScreen = document.getElementById("learnScreen");

// ==========================================
// THÊM DẤU ?. (OPTIONAL CHAINING) ĐỂ TRÁNH LỖI NULL
// ==========================================
const menuBack = document.querySelector(".menu-item-back");
menuBack?.addEventListener("click", () => {
  window.location.href = "index.html";
});

const menuRoom = document.querySelector(".menu-item-room");
menuRoom?.addEventListener("click", () => {
  window.location.href = "room.html";
});

const menuDocument = document.querySelector(".menu-item-document");
menuDocument?.addEventListener("click", () => {
  window.location.href = "document.html";
});

const menuSetting = document.querySelector(".menu-item-setting");
menuSetting?.addEventListener("click", () => {
  if (settingsOverlay) settingsOverlay.classList.add("show");
  // input?.blur(); // Bỏ comment nếu bạn có biến 'input' ở chỗ khác
  openSettings();
});

const settingBtn = document.getElementById("settingBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const continueBtn = document.getElementById("continueBtn");
const restartSettingsBtn = document.getElementById("restartSettingsBtn");
const exitSettingsBtn = document.getElementById("exitSettingsBtn");

// ==========================================
// SETTINGS (Kiểm tra phần tử tồn tại trước khi addEventListener)
// ==========================================
continueBtn?.addEventListener("click", () => {
  settingsOverlay?.classList.remove("show");
});

restartSettingsBtn?.addEventListener("click", () => {
  location.reload();
});

exitSettingsBtn?.addEventListener("click", () => {
  location.href = "index.html";
});

settingsOverlay?.addEventListener("click", e => {
  // Chỉ đóng khi bấm vào vùng nền overlay chứ không phải cửa sổ con bên trong
  if (e.target === settingsOverlay) {
    settingsOverlay.classList.remove("show");
  }
});

function startLearn() {
  if (typeof vocabData === 'undefined') return; // Tránh lỗi nếu chưa nạp vocabData
  currentWords = [...vocabData]
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);

  gameResult = { typing: 0, choice: 0, match: 0, sentence: 0 };
  currentMiniGame = 0;
  
  if (gameGrid) gameGrid.style.display = "none";
  if (learnScreen) {
    learnScreen.style.display = "flex";
    learnScreen.style.backgroundColor = "#219EBC";
  }
  if (typeof startSpeedTyping === 'function') startSpeedTyping();
}

function nextMiniGame() {
  currentMiniGame++;
  switch (currentMiniGame) {
    case 1:
      showLoading("✔ Speed Typing Completed!", "Preparing Choice...", typeof startChoice === 'function' ? startChoice : () => {});
      break;
    case 2:
      showLoading("✔ Choice Completed!", "Preparing Match...", typeof startMatch === 'function' ? startMatch : () => {});
      break;
    case 3:
      showLoading("✔ Match Completed!", "Preparing Sentence Fill...", typeof startSentenceFill === 'function' ? startSentenceFill : () => {});
      break;
    default:
      showLoading("✔ Sentence Fill Completed!", "Calculating Result...", showResult);
      break;
  }
}

function showLoading(title, subtitle, nextGame) {
  if (!loadingScreen || !loadingTitle) {
    nextGame();
    return;
  }
  loadingTitle.innerHTML = `
        <div class="loading-success">${title}</div>
        <div class="loading-subtitle">${subtitle}</div>
    `;

  loadingScreen.classList.add("show");
  setTimeout(() => { nextGame(); }, 500);
  setTimeout(() => { loadingScreen.classList.remove("show"); }, 1100);
}

function updateProgress(current, total) {
  if (progressFill) progressFill.style.width = `${(current / total) * 100}%`;
}

function openSettings() {
  if (settingsOverlay) settingsOverlay.classList.add("show");
  // input?.blur();
}

// ==========================================
// RESULT SCREEN
// ==========================================
const RESULT_MAX = { typing: 10, choice: 10, match: 10, sentence: 10 };
const RESULT_LABELS = { typing: "Gõ từ", choice: "Trắc nghiệm", match: "Nối cột", sentence: "Điền từ" };
const RESULT_RANKS = [
  { min: 90, title: "Xuất sắc! 🏆", message: "Bạn nhớ gần như toàn bộ từ vựng." },
  { min: 70, title: "Rất tốt! 🎉", message: "Chỉ còn vài từ nữa là hoàn hảo." },
  { min: 50, title: "Khá ổn 👍", message: "Chơi lại một lượt để nhớ chắc hơn nhé." },
  { min: 0, title: "Cố lên! 💪", message: "Luyện thêm một lượt, bạn sẽ tiến bộ ngay." }
];

const resultScreen = document.getElementById("resultScreen");
const resultRingFill = document.getElementById("resultRingFill");
const resultPercent = document.getElementById("resultPercent");
const resultTotal = document.getElementById("resultTotal");
const resultRank = document.getElementById("resultRank");
const resultMessage = document.getElementById("resultMessage");
const resultList = document.getElementById("resultList");

// Sử dụng toán tử ?. phòng trường hợp không có các nút này trên DOM
document.getElementById("resultRestartBtn")?.addEventListener("click", () => {
  hideResult();
  startLearn();
});

document.getElementById("resultHomeBtn")?.addEventListener("click", () => {
  hideResult();
  if (learnScreen) learnScreen.style.display = "none";
  if (gameGrid) gameGrid.style.display = "";
});

function hideResult() {
  if (resultScreen) resultScreen.style.display = "none";
}

function showResult() {
  if (!resultScreen) return;
  resultScreen.style.display = "flex";   
  const keys = Object.keys(RESULT_MAX);

  const scores = keys.map(key => Math.max(0, Math.min(gameResult[key] || 0, RESULT_MAX[key])));
  const total = scores.reduce((sum, s) => sum + s, 0);
  const max = keys.reduce((sum, key) => sum + RESULT_MAX[key], 0);
  const percent = max > 0 ? Math.round((total / max) * 100) : 0;

  // Ghi vào hồ sơ (thống kê + thành tựu); bỏ qua nếu trang không nạp stats.js
  if (window.normaStats) window.normaStats.recordGame({ total, max });

  const rank = RESULT_RANKS.find(r => percent >= r.min);
  if (resultRank) resultRank.textContent = rank.title;
  if (resultMessage) resultMessage.textContent = rank.message;
  if (resultTotal) resultTotal.textContent = `${total} / ${max} câu`;

  if (resultList) {
    resultList.innerHTML = keys.map((key, i) => `
      <li class="result-row ${scores[i] === RESULT_MAX[key] ? "is-perfect" : ""}">
        <div class="result-row-head">
          <span>${RESULT_LABELS[key]}</span>
          <strong>${scores[i]} / ${RESULT_MAX[key]}</strong>
        </div>
        <div class="result-bar">
          <div class="result-bar-fill" data-width="${(scores[i] / RESULT_MAX[key]) * 100}"></div>
        </div>
      </li>
    `).join("");
  }

  if (learnScreen) learnScreen.style.display = "none";

  const finishSound = document.getElementById("sound-finish");
  if (finishSound) {
    finishSound.currentTime = 0;
    finishSound.play().catch(() => { });
  }

  animateResult(percent);
}

function animateResult(percent) {
  if (!resultList || !resultPercent || !resultRingFill) return;
  const bars = resultList.querySelectorAll(".result-bar-fill");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setPercent = value => {
    resultPercent.textContent = `${Math.round(value)}%`;
    resultRingFill.style.strokeDashoffset = 100 - value;
  };

  if (reduceMotion) {
    setPercent(percent);
    bars.forEach(bar => (bar.style.width = `${bar.dataset.width}%`));
    return;
  }

  setPercent(0);
  requestAnimationFrame(() => {
    bars.forEach(bar => (bar.style.width = `${bar.dataset.width}%`));
  });

  const duration = 1200;
  const start = performance.now();

  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); 
    setPercent(percent * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Đã loại bỏ phần hàm bọc trùng lặp bị lỗi ở cuối file cũ của bạn.
