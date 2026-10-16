/* global playCorrect, playWrong, playFinish, speak */

let gameHistory = [];

let gamePaused = false;
let aiTimeoutID = null;

let totalWrong = 0;
let typingBox = null;

let typingID;
let score = 0;
let currentWord = "";
let usedWords = new Set();

let life = 2;
let wrongCount = 0;
let rankStreak = "none";
let timer = 30;
let timerID;

let gameEnd = false;
let streak = 0;
const LEVEL_SIZE = 15;
let level = Math.floor(streak / LEVEL_SIZE);
let progress = streak % LEVEL_SIZE;

let maxStreak = 0;
let startTime = Date.now();

const colors = [

    "#ff4040", // đỏ

    "#ff8c00", // cam

    "#ffd400", // vàng

    "#33cc33", // xanh lá

    "#00bfff", // xanh dương

    "#4169e1", // chàm

    "#8a2be2"  // tím

];
const streakBox = document.getElementById("streakBox");
const streakFill = document.getElementById("streakFill");
const streakText = document.getElementById("streakText");

const input = document.getElementById("wordInput");
const submitBtn = document.querySelector(".submit-button");

const chatArea = document.getElementById("chatArea");
const timerBox = document.getElementById("timer");


const mistakeBox = document.getElementById("mistake");

const resultScreen = document.getElementById("resultScreen");
const resultTitle = document.getElementById("resultTitle");
const resultReason = document.getElementById("resultReason");
const resultScore = document.getElementById("resultScore");

const settingBtn = document.getElementById("settingBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const continueBtn = document.getElementById("continueBtn");
const restartSettingsBtn = document.getElementById("restartSettingsBtn");
const exitSettingsBtn = document.getElementById("exitSettingsBtn");


// ==========================================
// SETTINGS
// ==========================================

settingBtn.addEventListener("click", () => {

    if (gameEnd) {
        return;
    }

    settingsOverlay.classList.add("show");
    input.blur();

});


continueBtn.addEventListener("click", () => {

    settingsOverlay.classList.remove("show");

});


restartSettingsBtn.addEventListener("click", () => {

    restartGame();

});


exitSettingsBtn.addEventListener("click", () => {

    location.href = "../../game.html";

});

settingsOverlay.addEventListener("click", e => {
    settingsOverlay.classList.remove("show");
});







input.addEventListener(
    "keydown",
    e => {
        if (e.key === "Enter") {
            submitWord();
        }
    }
);


if (submitBtn) {
    submitBtn.addEventListener(
        "click",
        submitWord
    );
}

startGame();







function startGame() {
    let startWords = Object.keys(wordChainData.lookup);
    let word =
        startWords[
        Math.floor(Math.random() * startWords.length)
        ];

    let data = wordChainData.lookup[word];
    currentWord = word;
    usedWords.add(word);
    addHistory(word, data, "ai");
    addMessage(
        data.word,
        null,
        data.type,
        "ai",
        data.meanings
    );
    speak(data.word);
    startTimer();
}









function checkPlayerWord(word) {
    let data = wordChainData.lookup[word];
    if (!data) {
        return {
            correct: false,
            reason: "Từ này không tồn tại"
        };
    }


    if (usedWords.has(word)) {
        return {
            correct: false,
            reason: "Từ này đã được dùng rồi"
        };
    }

    let lastLetter =
        currentWord[currentWord.length - 1];

    if (word[0] !== lastLetter) {
        return {
            correct: false,
            reason:
                "Cần bắt đầu bằng chữ " + lastLetter.toUpperCase()
        };
    }
    return {
        correct: true,
        data: data
    };
}










function loseLife() {
    streak = 0;
    updateStreak();
    life--;
    wrongCount = 0;
    updateMistake();
    let hearts =
        document.querySelectorAll(".life");

    if (hearts[life]) {
        hearts[life].style.opacity = "0.2";
    }

    if (life <= 0) {
        endGame(
            "Kết Quả!"
        );
        return;
    }

    // AI đi tiếp một nước
    setTimeout(
        AIPlay,
        500
    );
}






function resumeTimer() {

    clearInterval(timerID);

    timerBox.innerText =
        timer + "s";

    timerID = setInterval(() => {

        if (gamePaused) {
            return;
        }

        timer--;

        timerBox.innerText =
            timer + "s";

        if (timer <= 0) {

            clearInterval(timerID);

            loseLife();

        }

    }, 1000);
}












function resetTimer() {
    clearInterval(timerID);
    startTimer();
}








function addMessage(word, meaning, type, side, meanings = []) {

    let div = document.createElement("div");

    div.className =
        "message " +
        (side === "player" ? "left" : "right");


    // =====================================================
    // TYPE
    // =====================================================

    let typeText = Array.isArray(type)
        ? type.join(", ")
        : type;


    // =====================================================
    // MEANINGS
    // =====================================================


    let allMeanings = Array.isArray(meanings)
        ? meanings
        : [];


    // -----------------------------------------------------
    // Nếu chưa có meanings thì dùng meaning cũ
    // -----------------------------------------------------

    if (allMeanings.length === 0 && meaning) {

        allMeanings = [
            {
                type: typeText,
                text: meaning,
                examples: []
            }
        ];
    }


    // =====================================================
    // NGHĨA ĐẦU TIÊN
    // =====================================================

    let firstMeaning =
        allMeanings.length > 0
            ? allMeanings[0].text
            : "";


    // =====================================================
    // TẠO DANH SÁCH NGHĨA
    // =====================================================

    let meaningsHTML = allMeanings
        .map(item => {

            return `
                <div class="meaning-item">
                    <span class="meaning-bullet">•</span>
                    <span class="meaning-text">
                        ${item.text}
                    </span>
                </div>
            `;

        })
        .join("");


    // =====================================================
    // HTML
    // =====================================================

    div.innerHTML = `

        ${side === "player"
            ?
            '<div class="avatar player-avatar" style="text-align: center; align-content: center;"><img src="../../pics/human avatar.png" alt="Player Avatar" width="35" height="35"></div>'
            :
            ''
        }

        <div class="bubble-chat ${side === "ai" ? "ai" : ""}">

            <div class="word">

                ${word}

                <span class="type">
                    ${typeText}
                </span>

            </div>


            <!-- Nghĩa đầu tiên -->
            <div class="meaning-preview">
                ${firstMeaning}
            </div>


            <!-- Nút V -->
            ${allMeanings.length > 1
            ?
            `
                        <button
                            class="meaning-toggle"
                            type="button"
                        >
                            [▼] Show Details
                        </button>
                    `
            :
            ''
        }


            <!-- Toàn bộ nghĩa -->
            ${allMeanings.length > 1
            ?
            `
                        <div class="meaning-list">

                            ${meaningsHTML}

                        </div>
                    `
            :
            ''
        }

        </div>


        ${side === "ai"
            ?
            '<div class="avatar ai-avatar" style="text-align: center; align-content: center;"><img src="../../pics/robot icon.png" alt="AI Avatar" width="35" height="35"></div>'
            :
            ''
        }
    `;


    // =====================================================
    // ADD TO CHAT
    // =====================================================

    chatArea.appendChild(div);

    chatArea.scrollTop =
        chatArea.scrollHeight;


    // =====================================================
    // TOGGLE [V]
    // =====================================================

    let toggleBtn =
        div.querySelector(".meaning-toggle");

    let meaningList =
        div.querySelector(".meaning-list");

    let meaningPreview =
        div.querySelector(".meaning-preview");


    if (toggleBtn && meaningList) {

        toggleBtn.addEventListener("click", () => {

            let isOpen =
                meaningList.classList.contains("show");


            if (isOpen) {

                // Đóng
                meaningList.classList.remove("show");

                meaningPreview.style.display = "block";

                toggleBtn.innerText = "[▼] Show Details";

            }
            else {

                // Mở
                meaningList.classList.add("show");

                meaningPreview.style.display = "none";

                toggleBtn.innerText = "[▲] Hide Details";

            }


            // Giữ vị trí chat hợp lý
            chatArea.scrollTop =
                chatArea.scrollHeight;

        });

    }

}
















function showNotice(text) {
    let notice =
        document.createElement("div");
    notice.className =
        "notice";
    notice.innerText =
        text;
    document.body.appendChild(notice);

    setTimeout(() => {
        notice.remove();
    }, 1500);
}







function inputEffect(type) {
    input.classList.remove(
        "correct-input",
        "wrong-input"
    );


    // ép browser nhận animation lại
    void input.offsetWidth;
    input.classList.add(type);
    setTimeout(() => {
        input.classList.remove(type);
    }, 400);
}







function startTyping() {
    let dots = 0;
    typingID = setInterval(() => {
        dots++;

        if (dots > 3) {
            dots = 1;
        }
        typingBox.querySelector(".typing")
            .innerText =
            "typing" + ".".repeat(dots);
    }, 400);
}





function updateStreak() {

    if (streak < 3) {
        streakBox.style.display = "none";
        return;
    }

    streakBox.style.display = "block";


    // ==========================================
    // LEVEL
    // ==========================================

    let level =
        Math.floor(streak / LEVEL_SIZE) + 1;

    let progress =
        streak % LEVEL_SIZE;

    let percent =
        progress / LEVEL_SIZE * 100;


    // ==========================================
    // MÀU
    // LẶP THEO CHU KỲ 7 LEVEL
    // ==========================================

    let colorIndex =
        (level - 1) % colors.length;

    streakFill.classList.remove("rainbow");

    streakFill.style.background =
        colors[colorIndex];

    streakFill.style.width =
        percent + "%";


    // ==========================================
    // DANH HIỆU
    // ==========================================

    streakText.innerText =
        getStreakTitle();


    // ==========================================
    // ANIMATION
    // ==========================================

    streakBox.animate(
        [
            { transform: "scale(1.08)" },
            { transform: "scale(1)" }
        ],
        {
            duration: 180
        }
    );
}












function getStreakTitle() {

    // ==========================================
    // RANK ĐẶC BIỆT
    // ==========================================

    if (streak >= 10000) {
        rankStreak = "GOD";
        return "GOD";
    }

    if (streak >= 1000) {
        rankStreak = "IMMORTAL";
        return "IMMORTAL";
    }

    if (streak >= 500) {
        rankStreak = "LEGEND";
        return "LEGEND";
    }


    // ==========================================
    // LEVEL
    // ==========================================

    let level =
        Math.floor(streak / LEVEL_SIZE) + 1;


    // ==========================================
    // DANH HIỆU
    // ==========================================

    const titles = [
        "GOOD",          // LV1
        "NICE",          // LV2
        "GREAT",         // LV3
        "CRAZY",         // LV4
        "AMAZING",       // LV5
        "INSANE",        // LV6
        "MASTER",        // LV7

        "UNSTOPPABLE",   // LV8
        "PHENOMENAL",    // LV9
        "ASCENDANT",     // LV10
        "TRANSCENDENT",  // LV11
        "SUPREME",       // LV12
        "ULTIMATE",      // LV13
        "UNKNOWN",       // LV14
        "SUPER",
        "EPIC",
        "LEGENDARY",
        "MYTHICAL",
        "IMMORTAL",
        "GODLIKE",
        "ANCIENT",
        "DIVINE",
        "CELESTIAL",
        "ETHEREAL",
        "COSMIC",
        "INFINITE",
        "ETERNAL",
        "SIGMA",
        "MEME",
        "ULTRA",
        "OMEGA",
        "ALPHA",
        "BETA",
        "GAMMA",
        "GAMER",
        "PRO",
        "ELITE",
        "HERO",
        "AURA",
        "NOVA",
        "ZENITH",
        "NEXUS",
        "ELECTRON",
        "QUANTUM",
        "NEBULA",
        "GALAXY",
        "SUPERNOVA",
        "ASTRAL",

    ];


    // ==========================================
    // LẤY DANH HIỆU
    // ==========================================

    let title =
        titles[level - 1] || "ULTIMATE";


    rankStreak = title;

    return `LEVEL ${level} • ${title}`;
}












function saveScore() {
    let result = {
        score: score,
        words: usedWords.size,
        time: new Date().toLocaleString()
    };

    let rank =
        JSON.parse(
            localStorage.getItem("wordChainRank")
        ) || [];


    rank.push(result);
    rank.sort(
        (a, b) => b.score - a.score
    );

    rank = rank.slice(0, 10);

    localStorage.setItem(
        "wordChainRank",
        JSON.stringify(rank)
    );

}



function restartGame() {
    location.reload();
}





function addHistory(word, data, side) {

    gameHistory.push({
        word: word,
        type: data.type,
        meanings: data.meanings || [],
        side: side
    });

}



function showHistory() {

    const historyBox =
        document.getElementById("resultWord");

    if (!historyBox) {
        return;
    }

    historyBox.innerHTML = "";


    gameHistory.forEach((item, index) => {

        const div =
            document.createElement("div");

        div.className =
            "history-item " + item.side;


        // ==========================================
        // TYPE
        // ==========================================

        const typeText =
            Array.isArray(item.type)
                ? item.type.join(", ")
                : item.type;


        // ==========================================
        // MEANINGS
        // ==========================================

        const meanings =
            Array.isArray(item.meanings)
                ? item.meanings
                : [];


        // Không có nghĩa
        let meaningsHTML = `
            <div class="meaning-item">
                <span class="meaning-bullet">•</span>
                <span class="meaning-text">
                    Không có nghĩa
                </span>
            </div>
        `;


        // Có nghĩa
        if (meanings.length > 0) {

            meaningsHTML =
                meanings
                    .map(meaning => {

                        return `
                            <div class="meaning-item">

                                <span class="meaning-bullet">
                                    •
                                </span>

                                <span class="meaning-text">
                                    ${meaning.text}
                                </span>

                            </div>
                        `;

                    })
                    .join("");
        }


        // ==========================================
        // NGHĨA ĐẦU TIÊN
        // ==========================================

        const firstMeaning =
            meanings.length > 0
                ? meanings[0].text
                : "Không có nghĩa";


        // ==========================================
        // HTML
        // ==========================================

        div.innerHTML = `

            <div class="history-number">
                ${index + 1}
            </div>


            <div class="history-content">

                <div
                    class="history-word history-speak"
                    title="Bấm để nghe"
                >

                    🔊

                    <strong>
                        ${item.word}
                    </strong>

                    <span class="history-type">
                        ${typeText}
                    </span>

                </div>


                <div class="history-meaning">

                    → ${firstMeaning}

                </div>


                ${meanings.length > 1
                ?
                `
                            <button
                                class="meaning-toggle history-toggle"
                                type="button"
                            >
                                [V] ▼
                            </button>

                            <div class="meaning-list history-meaning-list">

                                ${meaningsHTML}

                            </div>
                        `
                :
                ''
            }

            </div>
        `;


        historyBox.appendChild(div);


        // ==========================================
        // ĐỌC TỪ
        // ==========================================

        const speakButton =
            div.querySelector(".history-speak");

        if (speakButton) {

            speakButton.addEventListener(
                "click",
                () => {

                    speak(item.word);

                }
            );

        }


        // ==========================================
        // NÚT [V]
        // ==========================================

        const toggleButton =
            div.querySelector(".history-toggle");

        const meaningList =
            div.querySelector(".history-meaning-list");

        const firstMeaningElement =
            div.querySelector(".history-meaning");


        if (toggleButton && meaningList) {

            toggleButton.addEventListener(
                "click",
                (event) => {

                    // Không cho click [V]
                    // kích hoạt chức năng đọc từ
                    event.stopPropagation();


                    const isOpen =
                        meaningList.classList.contains("show");


                    if (isOpen) {

                        // --------------------------
                        // ĐÓNG
                        // --------------------------

                        meaningList.classList.remove(
                            "show"
                        );

                        firstMeaningElement.style.display =
                            "block";

                        toggleButton.innerText =
                            "[V] ▼";

                    }
                    else {

                        // --------------------------
                        // MỞ
                        // --------------------------

                        meaningList.classList.add(
                            "show"
                        );

                        firstMeaningElement.style.display =
                            "none";

                        toggleButton.innerText =
                            "[V] ▲";

                    }

                }
            );

        }

    });

}




function openSettings() {

    if (gameEnd) {
        return;
    }

    settingsOverlay.classList.add("show");

    input.blur();
}





// wordChain.fix.js — nạp SAU wordChain.js (không cần sửa wordChain.js).
// Các hàm bên dưới có CÙNG TÊN với hàm trong wordChain.js nên sẽ thay thế chúng; các biến (score, life, ...)
// dùng chung với wordChain.js. Muốn gộp vào wordChain.js sau này: chép các hàm vào và xóa file này.
//
// Gồm: (1) bảng kết quả vòng tròn % giống chế độ PLAY, (2) tạm dừng thật sự khi mở cài đặt,
//      (3) khóa ô nhập khi đang tới lượt AI, (4) số lần sai tối đa khớp với chữ "❌ x/5" trên màn hình,
//      (5) timer đỏ khi còn ≤ 10 giây, (6) hiện lý do kết thúc, (7) dọn dẹp khi hết ván.

const MAX_WRONG = 5;          // số lần sai liên tiếp thì mất 1 mạng (trước đây code là 6 nhưng màn hình ghi /5)
let aiTurn = false;           // true khi đang tới lượt AI: người chơi chưa được gõ

const RESULT_RANKS = [
  { min: 90, title: "Xuất sắc! 🏆", message: "Gần như không sai chữ nào." },
  { min: 70, title: "Rất tốt! 🎉", message: "Vốn từ của bạn rất ổn." },
  { min: 50, title: "Khá ổn 👍", message: "Chơi thêm một ván để nối mượt hơn nhé." },
  { min: 0, title: "Cố lên! 💪", message: "Thử nghĩ từ có chữ cuối dễ nối, bạn sẽ tiến bộ ngay." }
];


/* ================= SỐ LẦN SAI ================= */
function updateMistake() {
  mistakeBox.innerText = "❌ " + wrongCount + "/" + MAX_WRONG;
  mistakeBox.classList.toggle("danger", wrongCount >= MAX_WRONG - 1);
}

function wrongAnswer(reason) {
  wrongCount++;
  totalWrong++;
  inputEffect("wrong-input");
  playWrong();
  updateMistake();
  showNotice("❌ " + reason);

  if (wrongCount >= MAX_WRONG) {
    wrongCount = 0;
    updateMistake();
    loseLife();
  }
}


/* ================= ĐỒNG HỒ ================= */
function startTimer() {
  clearInterval(timerID);
  timer = 30;
  timerBox.innerText = timer + "s";
  timerBox.classList.remove("danger");
  timerID = setInterval(() => {
    if (gamePaused) return;
    timer--;
    timerBox.innerText = timer + "s";
    timerBox.classList.toggle("danger", timer <= 10);     // còn ≤ 10 giây: số đỏ và đập
    if (timer <= 0) {
      clearInterval(timerID);
      loseLife();
    }
  }, 1000);
}


/* ================= LƯỢT NGƯỜI CHƠI ================= */
function submitWord() {
  if (gameEnd || aiTurn || gamePaused) return;     // đang tới lượt AI hoặc đang tạm dừng: bỏ qua, giữ nguyên chữ đã gõ

  const word = input.value.trim().toLowerCase();
  input.value = "";
  if (!word) return;

  const result = checkPlayerWord(word);
  if (!result.correct) {
    wrongAnswer(result.reason);
    return;
  }

  inputEffect("correct-input");
  playCorrect();
  score++;
  streak++;
  if (streak > maxStreak) maxStreak = streak;
  updateStreak();
  wrongCount = 0;
  updateMistake();

  const data = wordChainData.lookup[word];
  currentWord = word;
  usedWords.add(word);
  addHistory(word, data, "player");
  addMessage(data.word, null, data.type, "player", data.meanings);
  speak(data.word);
  resetTimer();

  aiTurn = true;                                    // khóa ô nhập cho tới khi AI đi xong
  setTimeout(AIPlay, 1000);
}


/* ================= LƯỢT AI ================= */
function createTypingBox() {
  typingBox = document.createElement("div");
  typingBox.className = "message right";
  typingBox.innerHTML = `
    <div class="bubble-chat ai typing">typing...</div>
    <div class="avatar ai-avatar"><img src="../../pics/robot icon.png" alt="AI" width="35" height="35"></div>`;
  chatArea.appendChild(typingBox);
  chatArea.scrollTop = chatArea.scrollHeight;
  startTyping();
}

function AIPlay() {
  if (gameEnd) return;
  aiTurn = true;
  createTypingBox();

  const think = () => {
    aiTimeoutID = null;
    if (gameEnd) return;
    if (gamePaused) { aiTimeoutID = setTimeout(think, 300); return; }   // đang tạm dừng: đợi rồi mới đi (trước đây AI bị kẹt luôn)

    if (typingBox) { typingBox.remove(); typingBox = null; }
    clearInterval(typingID);

    const lastLetter = currentWord[currentWord.length - 1];
    const list = wordChainData.startsWith[lastLetter] || [];
    const available = list.filter(w => !usedWords.has(w));

    if (available.length === 0) {
      endGame("Bạn thắng!", "AI hết từ");
      return;
    }

    const aiWord = available[Math.floor(Math.random() * available.length)];
    const data = wordChainData.lookup[aiWord];
    currentWord = aiWord;
    usedWords.add(aiWord);
    addHistory(aiWord, data, "ai");
    addMessage(data.word, null, data.type, "ai", data.meanings);
    speak(data.word);
    resetTimer();

    aiTurn = false;                                 // trả lượt cho người chơi
    input.focus();
  };

  aiTimeoutID = setTimeout(think, 1200);
}


/* ================= KẾT THÚC VÀ BẢNG KẾT QUẢ ================= */
function endGame(title, reason) {
  playFinish();
  gameEnd = true;
  aiTurn = false;
  clearInterval(timerID);
  clearTimeout(aiTimeoutID);
  clearInterval(typingID);
  if (typingBox) { typingBox.remove(); typingBox = null; }   // không để "typing..." treo lại sau khi hết ván
  settingsOverlay.classList.remove("show");
  input.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  showResult(title, reason);
}

function showResult(title, reason) {
  const $ = id => document.getElementById(id);
  const attempts = score + totalWrong;                                  // số lần nộp từ (đúng + sai)
  const percent = attempts > 0 ? Math.round(score / attempts * 100) : 0;
  const rank = RESULT_RANKS.find(r => percent >= r.min);

  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const mm = Math.floor(seconds / 60), ss = String(seconds % 60).padStart(2, "0");

  resultTitle.innerText = title;
  resultReason.innerText = reason || "";
  $("resultTotal").innerText = `${score} / ${attempts} lượt đúng`;
  $("resultRank").innerText = rank.title;
  $("resultMessage").innerText = rank.message;

  // mỗi dòng: nhãn, giá trị, và (nếu có) phần trăm để vẽ thanh
  const rows = [
    ["🏆 Từ nối đúng", score, percent],
    ["🔥 Streak tối đa", maxStreak, Math.min(100, maxStreak / LEVEL_SIZE * 100)],
    ["❤️ Mạng còn lại", `${Math.max(0, life)} / 2`, Math.max(0, life) / 2 * 100],
    ["🧠 Từ đã dùng", usedWords.size, null],
    ["⏱ Thời gian", `${mm}:${ss}`, null],
    ["⭐ Rank streak", rankStreak === "none" ? "—" : rankStreak, null]
  ];
  resultScore.innerHTML = rows.map(([label, value, pct], i) => `
    <li class="result-row ${pct === 100 ? "is-perfect" : ""}" style="--i:${i}">
      <div class="result-row-head"><span>${label}</span><strong>${value}</strong></div>
      ${pct === null ? "" : `<div class="result-bar"><div class="result-bar-fill" data-width="${pct}"></div></div>`}
    </li>`).join("");

  resultScreen.style.display = "flex";
  animateResult(percent);
  showHistory();
}

function animateResult(percent) {
  const ring = document.getElementById("resultRingFill");
  const label = document.getElementById("resultPercent");
  const bars = resultScore.querySelectorAll(".result-bar-fill");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setPercent = v => {
    label.textContent = `${Math.round(v)}%`;
    ring.style.strokeDashoffset = 100 - v;
  };
  const growBars = () => bars.forEach(b => (b.style.width = `${b.dataset.width}%`));

  if (reduce) { setPercent(percent); growBars(); return; }

  setPercent(0);
  requestAnimationFrame(growBars);
  const t0 = performance.now();
  const tick = now => {
    const t = Math.min((now - t0) / 1200, 1);
    setPercent(percent * (1 - Math.pow(1 - t, 3)));          // easeOutCubic
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


/* ================= TẠM DỪNG KHI MỞ CÀI ĐẶT ================= */
// wordChain.js chỉ hiện/ẩn bảng cài đặt; ở đây thêm việc dừng/chạy lại đồng hồ và lượt AI.
settingBtn.addEventListener("click", () => { if (!gameEnd) gamePaused = true; });
continueBtn.addEventListener("click", () => { gamePaused = false; });
settingsOverlay.addEventListener("click", () => { gamePaused = false; });

resetTimer();   // khởi động lại đồng hồ bằng bản startTimer mới (vài mili-giây sau khi vào ván nên không ảnh hưởng)
