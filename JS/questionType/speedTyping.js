


let currentIndex = 0;
let score = 0;
let timer = null;
let timeLeft = 10;
let timerStarted = false;


const classText = document.getElementById("typingClass");
const meaningText = document.getElementById("typingMeaning");





const wordText = document.getElementById("typingWord");
const input = document.getElementById("typingInput");
const timerText = document.getElementById("timer");
const countText = document.getElementById("questionCount");












function startSpeedTyping() {
    document.querySelector(".learn-box").style.width = "850px";
    timerText.style.display = "block";
    document.querySelector(".typing-word").style.display = "flex";
    meaningText.style.display = "block";
    updateProgress(0, 10);
    input.style.display = "block";
    currentIndex = 0;
    score = 0;
    loadQuestion();
}










function loadQuestion() {
    if (currentIndex >= currentWords.length) {
        finishTyping();
        return;
    }

    wordText.innerText = currentWords[currentIndex].word;

    const word = currentWords[currentIndex].word;

    setTimeout(() => {
        speak(word);
    }, 200);

    classText.innerText =
        `(${currentWords[currentIndex].classword})`;

    meaningText.innerText =
        currentWords[currentIndex].meaning.join(", ");

    input.value = "";

    timeLeft = 10;
    timerStarted = false;

    timerText.innerText = "--";
    countText.innerText =
        `${currentIndex + 1} / ${currentWords.length}`;

    progressFill.style.width =
        `${currentIndex / currentWords.length * 100}%`;

}







input.addEventListener("input", () => {
    if (!timerStarted) {
        timerStarted = true;
        startTimer();
    }

    if (
        input.value.trim().toLowerCase() ===
        currentWords[currentIndex].word.toLowerCase()
    ) {
        playCorrect();
        clearInterval(timer);
        score++;
        currentIndex++;

        loadQuestion();
    }
});









function startTimer() {
    clearInterval(timer);   // <- cực kỳ quan trọng
    timerText.innerText = timeLeft;
    timer = setInterval(() => {
        timeLeft--;
        timerText.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            currentIndex++;
            playWrong();
            updateProgress(currentIndex, currentWords.length);
            loadQuestion();
        }
    }, 1000);
}




function finishTyping() {
    playFinish();
    gameResult.typing = score;

    setTimeout(() => {
        nextMiniGame();
    }, 700);

}