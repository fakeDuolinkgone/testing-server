



let retryQueue = [];         // chứa các câu sai


let sentenceScore = 0;
let completedSentence = 0;



const sentenceBox = document.getElementById("sentenceBox");
const sentenceExample = document.getElementById("sentenceExample");
const sentenceHint = document.getElementById("sentenceHint");
const sentenceBtn1 = document.getElementById("sentenceBtn1");
const sentenceBtn2 = document.getElementById("sentenceBtn2");





function startSentenceFill() {
    retryQueue = [];
    updateProgress(0, 10);
    document.querySelector(".learn-box").style.width = "1000px";
    input.style.display = "none";
    choiceBox.style.display = "none";
    matchBox.style.display = "none";
    document.querySelector(".typing-word").style.display = "none";
    timerText.style.display = "none";

    meaningText.style.display = "none";

    sentenceBox.style.display = "flex";

    learnScreen.style.backgroundColor = "#90BE6D";

    sentenceScore = 0;

    completedSentence = 0;

    loadSentenceQuestion();

}









function loadSentenceQuestion() {
    if (currentWords.length === 0) {
        if (retryQueue.length > 0) {
            currentWords = [...retryQueue];
            retryQueue = [];

        }
        else {
            finishSentence();
            return;

        }

    }

    countText.innerText =
        `Remaining : ${currentWords.length + retryQueue.length} / ${currentWords.length}`;
    const current = currentWords[0];
    sentenceExample.innerText =
        current.example.replace(
            new RegExp(`\\b${current.word}(s|es|ed|ing)?\\b`, "i"),
            "______"
        );

    sentenceHint.innerText =
        `(${current.classword}) : ${current.meaning[0]}`;

    let wrong;

    do {

        wrong =
            vocabData[
            Math.floor(Math.random() * vocabData.length)
            ];

    } while (wrong.word === current.word);

    let answers = [
        current.word,
        wrong.word
    ];

    answers.sort(() => Math.random() - 0.5);

    sentenceBtn1.innerText = answers[0];
    sentenceBtn2.innerText = answers[1];

    sentenceBtn1.className = "sentence-btn";
    sentenceBtn2.className = "sentence-btn";

    sentenceBtn1.disabled = false;
    sentenceBtn2.disabled = false;

    sentenceBtn1.onclick = () => {
        checkSentence(
            answers[0],
            current,
            sentenceBtn1
        );
    };

    sentenceBtn2.onclick = () => {
        checkSentence(
            answers[1],
            current,
            sentenceBtn2
        );
    };

}






function checkSentence(answer, current, btn) {

    sentenceBtn1.disabled = true;
    sentenceBtn2.disabled = true;

    if (answer === current.word) {

        btn.classList.add("correct");

        playCorrect();

        speak(current.word);

        sentenceScore++;

        completedSentence++;

        updateProgress(
            completedSentence,
            vocabData.length
        );

    }
    else {

        btn.classList.add("wrong");

        playWrong();

        retryQueue.push(current);

    }

    currentWords.shift();

    setTimeout(() => {

        loadSentenceQuestion();

    }, 350);

}











function finishSentence() {

    sentenceBox.style.display = "none";

    progressFill.style.width = "100%";

    gameResult.sentence = sentenceScore;

    playFinish();

    showLoading(

        "Calculating Result...",

        showResult,

    );

}