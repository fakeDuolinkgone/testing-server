

let soundCorrect, soundWrong, soundFinish;

document.addEventListener("DOMContentLoaded", () => {
  soundCorrect = document.getElementById("sound-correct");
  soundWrong = document.getElementById("sound-wrong");
  soundFinish = document.getElementById("sound-finish");
});
window.soundEnabled = true;










let voices = [];
speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};




function speak(word) {
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);

  utterance.lang = "en-US";
  utterance.rate = 0.85;

  if (voices.length > 0) {
    const english = voices.find(v => v.lang.startsWith("en"));
    if (english) utterance.voice = english;
  }

  speechSynthesis.speak(utterance);
}









function playSound(sound) {
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => { });
}

window.playCorrect = function () {

  playSound(soundCorrect);

};


window.playWrong = function () {

  playSound(soundWrong);

};


window.playFinish = function () {

  playSound(soundFinish);

};


window.speak = function (word) {

  speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(word);

  utterance.lang = "en-US";
  utterance.rate = 0.85;

  speechSynthesis.speak(utterance);

};







