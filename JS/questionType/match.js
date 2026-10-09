let matchRound = 0;

let matchScore = 0;

let selectedEng = null;
let selectedVn = null;

let currentMatchWords = [];

let matchLocked = false;


const matchBox = document.getElementById("matchBox");
const matchLeft = document.getElementById("matchLeft");
const matchRight = document.getElementById("matchRight");







function startMatch() {
    document.querySelector(".learn-box").style.width = "850px"; 
    timerText.style.display = "block";
    matchRound = 0;
    matchScore = 0;
    matchRoundScore = 0;
    document.querySelector(".typing-word").style.display = "none";
    meaningText.style.display = "none";
    updateProgress(0, 10);
    input.style.display = "none";
    choiceBox.style.display = "none";
    matchBox.style.display = "grid";
    learnScreen.style.backgroundColor = "#8ECAE6";
    matchRound = 0;
    matchScore = 0;
    loadMatchRound();
}








function loadMatchRound() {
    matchRoundScore = 0;
    if (matchRound >= 2) {
        finishMatch();
        return;
    }

    clearInterval(timer);
    timeLeft = 20;
    timerText.innerText = timeLeft;
    countText.innerText =
        `${matchRound + 1} / 2`;
    currentMatchWords =
        currentWords.slice(matchRound * 5, matchRound * 5 + 5);
    renderMatch();
    startMatchTimer();

}










function renderMatch() {
    selectedEng = null;
    selectedVn = null;
    matchLeft.innerHTML = "";
    matchRight.innerHTML = "";
    let vnList = [...currentMatchWords]
        .sort(() => Math.random() - 0.5);

    currentMatchWords.forEach(word => {
        const div = document.createElement("div");
        div.className = "match-item";
        div.innerText = word.word;
        div.dataset.word = word.word;
        div.onclick = () => selectEnglish(div, word);
        matchLeft.appendChild(div);
    });

    vnList.forEach(word => {
        const div = document.createElement("div");
        div.className = "match-item";
        div.innerText = word.meaning[0];
        div.dataset.word = word.word;
        div.onclick = () => selectVietnamese(div, word);
        matchRight.appendChild(div);
    });

}












function selectEnglish(el, word) {
    if (el.classList.contains("fade")) return;
    document.querySelectorAll("#matchLeft .match-item")
        .forEach(x => x.classList.remove("selected"));
    el.classList.add("selected");
    selectedEng = {
        element: el,
        word: word
    };
    checkMatch();
}






function selectVietnamese(el, word) {
    if (el.classList.contains("fade")) return;
    document.querySelectorAll("#matchRight .match-item")
        .forEach(x => x.classList.remove("selected"));
    el.classList.add("selected");
    selectedVn = {
        element: el,
        word: word
    };
    checkMatch();

}

















function checkMatch() {
    if (!selectedEng || !selectedVn) return;
    document.querySelectorAll(".match-item").forEach(item => {
        item.style.pointerEvents = "none";
    });

    clearInterval(timer);
    if (selectedEng.word.word === selectedVn.word.word) {
        selectedEng.element.classList.add("correct");
        selectedVn.element.classList.add("correct");
        playCorrect();
        speak(selectedEng.word.word);
        matchScore++;
        matchRoundScore++;

        setTimeout(() => {
            selectedEng.element.classList.add("fade");
            selectedVn.element.classList.add("fade");
            selectedEng = null;
            selectedVn = null;

            document.querySelectorAll(".match-item:not(.fade)")
                .forEach(item => {
                    item.style.pointerEvents = "auto";
                });

            if (matchRoundScore === 5) {
                if (matchRound == 0) {
                    updateProgress(1, 2);   // 50%
                } else {
                    updateProgress(2, 2);   // 100%
                }

                clearInterval(timer);
                matchRound++;
                setTimeout(loadMatchRound, 500);
            } else {
                startMatchTimer();
            }
        }, 300);
    } else {
        selectedEng.element.classList.add("wrong");
        selectedVn.element.classList.add("wrong");
        playWrong();

        setTimeout(() => {
            selectedEng.element.classList.remove("selected", "wrong");
            selectedVn.element.classList.remove("selected", "wrong");
            selectedEng = null;
            selectedVn = null;

            document.querySelectorAll(".match-item")
                .forEach(item => {
                    item.style.pointerEvents = "auto";
                });
            startMatchTimer();
        }, 300);
    }
}













function startMatchTimer() {
    clearInterval(timer);
    timerText.innerText = timeLeft;
    timer = setInterval(() => {
        timeLeft--;
        timerText.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            loadMatchRound();
        }
    }, 1000);
}







function finishMatch() {
    clearInterval(timer);
    matchBox.style.display = "none";
    progressFill.style.width = "100%";
    gameResult.match = matchScore;
    playFinish();
    setTimeout(() => {
        nextMiniGame();
    }, 700);
}