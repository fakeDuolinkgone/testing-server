// JS/games/result.js
// Dùng các biến có sẵn từ game.js: gameResult, gameGrid, learnScreen, startLearn()

// ⚠️ Sửa số câu tối đa của từng mini game cho đúng với game của bạn
const RESULT_MAX = {
  typing: 10,
  choice: 10,
  match: 10,
  sentence: 10
};

const RESULT_LABELS = {
  typing: "Gõ từ",
  choice: "Trắc nghiệm",
  match: "Nối cột",
  sentence: "Điền từ"
};

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

document.getElementById("resultRestartBtn").addEventListener("click", () => {
  hideResult();
  startLearn();
});

document.getElementById("resultHomeBtn").addEventListener("click", () => {
  hideResult();
  learnScreen.style.display = "none";
  gameGrid.style.display = "";
});


function hideResult() {
  resultScreen.classList.remove("show");
}


function showResult() {
  const keys = Object.keys(RESULT_MAX);

  // Giới hạn điểm trong khoảng 0..max để tránh hiển thị sai
  const scores = keys.map(key =>
    Math.max(0, Math.min(gameResult[key] || 0, RESULT_MAX[key]))
  );
  const total = scores.reduce((sum, s) => sum + s, 0);
  const max = keys.reduce((sum, key) => sum + RESULT_MAX[key], 0);
  const percent = max > 0 ? Math.round(total / max * 100) : 0;

  const rank = RESULT_RANKS.find(r => percent >= r.min);
  resultRank.textContent = rank.title;
  resultMessage.textContent = rank.message;
  resultTotal.textContent = `${total} / ${max} câu`;

  resultList.innerHTML = keys.map((key, i) => `
    <li class="result-row ${scores[i] === RESULT_MAX[key] ? "is-perfect" : ""}">
      <div class="result-row-head">
        <span>${RESULT_LABELS[key]}</span>
        <strong>${scores[i]} / ${RESULT_MAX[key]}</strong>
      </div>
      <div class="result-bar">
        <div class="result-bar-fill" data-width="${scores[i] / RESULT_MAX[key] * 100}"></div>
      </div>
    </li>
  `).join("");

  learnScreen.style.display = "none";
  resultScreen.classList.add("show");

  const finishSound = document.getElementById("sound-finish");
  if (finishSound) {
    finishSound.currentTime = 0;
    finishSound.play().catch(() => { });
  }

  animateResult(percent);
}


function animateResult(percent) {
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

  // Đặt lại trạng thái ban đầu rồi chạy hiệu ứng
  setPercent(0);
  requestAnimationFrame(() => {
    bars.forEach(bar => (bar.style.width = `${bar.dataset.width}%`));
  });

  const duration = 1200;
  const start = performance.now();

  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    setPercent(percent * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
