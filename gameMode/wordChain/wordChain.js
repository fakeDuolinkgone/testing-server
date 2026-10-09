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












function submitWord() {


    if (gameEnd) return;
    let word = input.value.trim().toLowerCase();
    input.value = "";

    if (!word) return;
    let result = checkPlayerWord(word);

    if (!result.correct) {
        wrongAnswer(result.reason);
        return;
    }
    inputEffect("correct-input");
    playCorrect();
    score++;
    streak++;
    if (streak > maxStreak) {
        maxStreak = streak;
    }
    updateStreak();
    wrongCount = 0;
    updateMistake();

    let data = wordChainData.lookup[word];
    currentWord = word;
    usedWords.add(word);
    addHistory(word, data, "player");
    addMessage(
        data.word,
        null,
        data.type,
        "player",
        data.meanings
    );

    speak(data.word);
    resetTimer();
    setTimeout(
        AIPlay,
        1000
    );
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












function AIPlay() {
    if (gameEnd) return;
    createTypingBox();

    aiTimeoutID = setTimeout(() => {

        aiTimeoutID = null;

        if (gameEnd || gamePaused) {
            return;
        }

        typingBox.remove();

        typingBox = null;

        clearInterval(typingID);

        let lastLetter =
            currentWord[currentWord.length - 1];

        let list =
            wordChainData.startsWith[lastLetter] || [];

        let available =
            list.filter(
                w => !usedWords.has(w)
            );

        if (available.length === 0) {

            endGame(
                "Bạn thắng!",
                "AI hết từ"
            );

            return;
        }

        let aiWord =
            available[
            Math.floor(
                Math.random() * available.length
            )
            ];

        let data =
            wordChainData.lookup[aiWord];

        currentWord = aiWord;

        usedWords.add(aiWord);

        addHistory(
            aiWord,
            data,
            "ai"
        );

        addMessage(
            data.word,
            null,
            data.type,
            "ai",
            data.meanings
        );

        speak(data.word);

        resetTimer();

    }, 1200);
}











function wrongAnswer(reason) {
    wrongCount++;
    totalWrong++;
    inputEffect("wrong-input");
    playWrong();
    updateMistake();
    showNotice(
        "❌ " + reason
    );

    if (wrongCount >= 6) {
        wrongCount = 0;
        updateMistake();
        loseLife();
    }
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












function startTimer() {

    clearInterval(timerID);

    timer = 30;

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





function updateMistake() {
    mistakeBox.innerText =
        "❌ " + wrongCount + "/5";
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






function createTypingBox() {

    typingBox =
        document.createElement("div");


    typingBox.className =
        "message right";


    typingBox.innerHTML = `

    <div class="bubble-chat ai typing">
        typing...
    </div>

    <div class="avatar ai-avatar"></div>

    `;


    chatArea.appendChild(typingBox);

    startTyping();

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




















function showResult(title, reason) {
    let accuracy = 100;
    if (score + totalWrong > 0) {
        accuracy =
            Math.round(
                score / (score + totalWrong) * 100
            );
    }

    let seconds = Math.floor((Date.now() - startTime) / 1000);
    let minute = Math.floor(seconds / 60);
    let second = String(seconds % 60).padStart(2, "0");

    resultScreen.style.display = "flex";
    resultTitle.innerText = title;

    resultScore.innerHTML =
        `
🏆 Điểm : ${score}<br><br>
🔥 Streak Tối Đa : ${maxStreak}<br>
🎯 Độ Chính Xác : ${accuracy}%<br>
🧠 Từ Đã Dùng : ${usedWords.size}<br>
⏱ Thời Gian : ${minute}:${second}<br><br>
⭐ Rank: ${rankStreak}
`;

    showHistory();

}




function endGame(title, reason) {
    playFinish();
    gameEnd = true;
    clearInterval(timerID);

    input.disabled = true;
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    showResult(
        title,
        reason
    );
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