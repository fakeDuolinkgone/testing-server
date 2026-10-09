


let choiceIndex = 0;

const choiceBox = document.getElementById("choiceBox");
const choiceButtons = document.querySelectorAll(".choice-btn");









function startChoice() {
    document.querySelector(".learn-box").style.width = "850px";
    timerText.style.display = "block";
    document.querySelector(".typing-word").style.display = "flex";
    meaningText.style.display = "block";
    updateProgress(0, 10);

    choiceIndex = 0;
    input.style.display = "none";
    choiceBox.style.display = "grid";
    learnScreen.style.backgroundColor = "#FDB515"
    loadChoiceQuestion();

}



function loadChoiceQuestion() {
    if (choiceIndex >= currentWords.length) {
        finishChoice();
        return;
    }

    choiceButtons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove("correct", "wrong");
    });

    clearInterval(timer);
    timeLeft = 10;
    timerText.innerText = timeLeft;
    countText.innerText =
        `${choiceIndex + 1} / ${currentWords.length}`;

    const correct = currentWords[choiceIndex];

    wordText.innerText = correct.word;
    speak(correct.word);
    classText.innerText = `(${correct.classword})`;
    meaningText.innerText = "";

    let answers = [correct.meaning[0]];

    while (answers.length < 4) {
        const randomWord =
            currentWords[Math.floor(Math.random() * currentWords.length)];
        const wrong = randomWord.meaning[0];
        if (!answers.includes(wrong))
            answers.push(wrong);
    }

    answers.sort(() => Math.random() - 0.5);
    choiceButtons.forEach((btn, index) => {
        btn.innerText = answers[index];

        btn.onclick = () => {
            if (answers[index] === correct.meaning[0]) {
                btn.classList.add("correct");
            } else {
                btn.classList.add("wrong");
            }

            checkChoice(
                answers[index],
                correct.meaning[0],
                btn
            );
        };
    });
    startChoiceTimer();
}









function startChoiceTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        timerText.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            choiceIndex++;
            updateProgress(choiceIndex, currentWords.length);
            loadChoiceQuestion();
        }
    }, 1000);
}








function checkChoice(user, correct, btn) {

    choiceButtons.forEach(button => {
        button.disabled = true;
    });

    clearInterval(timer);
    if (user === correct) {
        playCorrect();
        gameResult.choice++;
    } else {
        playWrong();
    }

    setTimeout(() => {
        btn.classList.remove("correct", "wrong");
        choiceIndex++;
        updateProgress(choiceIndex, currentWords.length);
        loadChoiceQuestion();
    }, 300);

}







function finishChoice() {
    playFinish();
    clearInterval(timer);
    nextMiniGame();
}