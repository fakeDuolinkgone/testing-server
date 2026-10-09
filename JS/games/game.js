


const progressFill = document.getElementById("progressFill");
const progressMessage = document.getElementById("progressMessage");

const loadingScreen = document.getElementById("loadingScreen");
const loadingTitle = document.getElementById("loadingTitle");

const gameGrid = document.querySelector(".game-grid");
const learnScreen = document.getElementById("learnScreen");



let currentMiniGame = 0;
let currentWords = [];

let gameResult = {
  typing: 0,
  choice: 0,
  match: 0,
  sentence: 0
};





function startLearn() {
  currentWords = [...vocabData]
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);

  gameResult = {
    typing: 0,
    choice: 0,
    match: 0,
    sentence: 0
  };

  currentMiniGame = 0;
  gameGrid.style.display = "none";
  learnScreen.style.display = "flex";
  learnScreen.style.backgroundColor = "#219EBC"
  startSpeedTyping();
}








function nextMiniGame() {
  currentMiniGame++;
  switch (currentMiniGame) {

    case 1:

      showLoading(
        "✔ Speed Typing Completed!",
        "Preparing Choice...",
        startChoice
      );

      break;


    case 2:

      showLoading(
        "✔ Choice Completed!",
        "Preparing Match...",
        startMatch
      );

      break;


    case 3:

      showLoading(
        "✔ Match Completed!",
        "Preparing Sentence Fill...",
        startSentenceFill
      );

      break;


    default:
      showLoading(
        "Calculating Result...",
        showResult
      );
      break;
  }

}







function showLoading(title, subtitle, nextGame) {
  loadingTitle.innerHTML = `
        <div class="loading-success">${title}</div>
        <div class="loading-subtitle">${subtitle}</div>
    `;

  loadingScreen.classList.add("show");
  setTimeout(() => {
    nextGame()
  }, 500);

  setTimeout(() => {
    loadingScreen.classList.remove("show");
  }, 1100);

}




function updateProgress(current, total) {
  progressFill.style.width =
    `${current / total * 100}%`;
}