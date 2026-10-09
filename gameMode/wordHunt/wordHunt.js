/* global wordChainData, playCorrect, playWrong, playFinish, speak */

// ===== Settings (change these to tune the game) =====
const GAME_SECONDS = 60;
const MIN_LENGTH = 3;                       // letters, not counting hyphens
const LETTERS = "abcdefghijklmnopqrstuvwyz"; // "x" left out: the dictionary has only ~50 words for it
const BEST_KEY = "wordHuntBest";

// ===== Text shown to the player =====
const TEXT = {
    start: "Bắt đầu",
    wrongLetter: l => "Từ phải bắt đầu bằng chữ " + l.toUpperCase(),
    tooShort: "Từ cần ít nhất " + MIN_LENGTH + " chữ cái",
    unknown: "Từ này không tồn tại",
    used: "Bạn đã dùng từ này rồi",
    timeUp: "Hết giờ!",
    noWords: "Bạn chưa tìm được từ nào.",
    summary: (n, longest) => "Bạn tìm được " + n + " từ. Từ dài nhất: " + longest + ".",
    newBest: " Kỷ lục mới!",
    best: b => " Kỷ lục: " + b + " điểm."
};

const $ = id => document.getElementById(id);
const input = $("wordInput");

let letter = "";
let used = new Set();
let found = [];
let score = 0;
let running = false;
let endAt = 0;
let timerID = null;

// ===== Setup =====
makeBubbles();
$("submitBtn").addEventListener("click", submitWord);
$("startBtn").addEventListener("click", startRound);
$("restartBtn").addEventListener("click", newRound);
input.addEventListener("keydown", e => { if (e.key === "Enter") submitWord(); });

$("startBtn").disabled = false;
$("startBtn").textContent = TEXT.start;
newRound();

// ===== Round flow =====
function newRound() {
    let next;
    do { next = LETTERS[Math.floor(Math.random() * LETTERS.length)]; } while (next === letter);
    letter = next;

    used = new Set();
    found = [];
    score = 0;
    running = false;

    const up = letter.toUpperCase();
    $("readyLetter").textContent = up;
    $("letter").textContent = up;
    $("promptLetter").textContent = up;
    $("score").textContent = 0;
    $("count").textContent = 0;
    $("wordList").innerHTML = "";
    $("notice").textContent = "";
    $("seconds").textContent = GAME_SECONDS;
    $("timerFill").style.width = "100%";
    $("timerFill").classList.remove("urgent");
    input.value = "";
    input.disabled = true;

    $("resultScreen").classList.add("hidden");
    $("readyScreen").classList.remove("hidden");
    $("startBtn").focus();
}

function startRound() {
    $("readyScreen").classList.add("hidden");
    input.disabled = false;
    input.focus();
    running = true;
    endAt = Date.now() + GAME_SECONDS * 1000;
    tick();
    timerID = setInterval(tick, 250);
}

function tick() {
    const left = Math.max(0, endAt - Date.now());
    $("seconds").textContent = Math.ceil(left / 1000);
    $("timerFill").style.width = (left / (GAME_SECONDS * 1000) * 100) + "%";
    $("timerFill").classList.toggle("urgent", left <= 10000);
    if (left <= 0) endRound();
}

function endRound() {
    clearInterval(timerID);
    running = false;
    input.disabled = true;
    playFinish();

    let best = 0;
    try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* storage unavailable */ }
    const isBest = score > best;
    if (isBest) {
        best = score;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage unavailable */ }
    }

    $("resultTitle").textContent = TEXT.timeUp;
    $("resultScore").textContent = score;

    const longest = found.reduce((a, w) => (w.length > a.length ? w : a), "");
    $("resultInfo").textContent =
        (found.length ? TEXT.summary(found.length, longest) : TEXT.noWords) +
        (isBest && score > 0 ? TEXT.newBest : TEXT.best(best));

    fillList($("resultFound"), found);
    fillList($("resultMissed"), sampleMissed(6));

    $("resultScreen").classList.remove("hidden");
    $("restartBtn").focus();
}

// ===== Answering =====
function submitWord() {
    if (!running) return;
    const word = input.value.trim().toLowerCase();
    input.value = "";
    if (!word) return;

    const error = check(word);
    if (error) {
        $("notice").textContent = error;
        input.classList.remove("shake");
        void input.offsetWidth; // restart the animation
        input.classList.add("shake");
        playWrong();
        return;
    }

    used.add(word);
    found.push(word);
    score += points(word);
    $("score").textContent = score;
    $("count").textContent = found.length;
    $("notice").textContent = "";

    $("wordList").prepend(makeRow(word, true));
    playCorrect();
    speak(word);
}

function check(word) {
    if (word[0] !== letter) return TEXT.wrongLetter(letter);
    if (points(word) < MIN_LENGTH) return TEXT.tooShort;
    // hasOwnProperty so inputs like "constructor" don't count as words
    if (!Object.prototype.hasOwnProperty.call(wordChainData.lookup, word)) return TEXT.unknown;
    if (used.has(word)) return TEXT.used;
    return null;
}

function points(word) {
    return word.replace(/-/g, "").length; // 1 point per letter
}

// ===== Word rows =====
function meaningOf(word) {
    const data = wordChainData.lookup[word];
    const first = data && data.meanings && data.meanings[0];
    return first ? first.text : "";
}

function makeRow(word, animate) {
    const li = document.createElement("li");
    if (animate) li.className = "pop";

    const w = document.createElement("strong");
    w.textContent = word;
    const m = document.createElement("span");
    m.textContent = meaningOf(word);
    li.append(w, m);

    if (animate) {
        const p = document.createElement("em");
        p.textContent = "+" + points(word);
        li.append(p);
    }
    return li;
}

function fillList(ul, words) {
    ul.innerHTML = "";
    words.forEach(w => ul.append(makeRow(w, false)));
}

// A few real words the player didn't find: plain a-z, 4 to 8 letters
function sampleMissed(n) {
    const pool = (wordChainData.startsWith[letter] || [])
        .filter(w => /^[a-z]+$/.test(w) && w.length >= 4 && w.length <= 8 && !used.has(w));
    const picks = [];
    while (picks.length < n && pool.length) {
        picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picks;
}

// ===== Background =====
function makeBubbles() {
    const box = $("bubbles");
    for (let i = 0; i < 14; i++) {
        const b = document.createElement("span");
        const size = 18 + Math.random() * 26;
        b.style.width = b.style.height = size + "px";
        b.style.left = Math.random() * 98 + "%";
        b.style.animationDuration = 12 + Math.random() * 10 + "s";
        b.style.animationDelay = -Math.random() * 12 + "s";
        box.append(b);
    }
}
