/* global wordChainData, playCorrect, playWrong, playFinish, speak, WordHuntCore, WordHuntNet, BossNet */

// ===== Chế độ chạy (lấy từ URL) =====
//   wordHunt.html             chơi đơn (như cũ)
//   wordHunt.html?room=XXXXXX chơi nhiều người trong phòng (room.html tự thêm ?room=)
//   wordHunt.html?bots=6      thử nhiều người với bot, không cần Firebase
const PARAMS = new URLSearchParams(location.search);
const MODE = PARAMS.has("room") ? "room" : PARAMS.has("bots") ? "bots" : "solo";
const MULTI = MODE !== "solo";
const ROOM_PAGE = "../../room.html";

// ===== Settings (luật nằm ở wordHuntCore.js) =====
const { WH, points, letterFor } = WordHuntCore;
const GAME_SECONDS = WH.SECONDS;
const MIN_LENGTH = WH.MIN_LENGTH;
const LETTERS = WH.LETTERS;
const BEST_KEY = "wordHuntBest";
const RANK_TOP = 10;                        // bảng xếp hạng hiện tối đa bấy nhiêu dòng đầu (+ dòng của bạn nếu ở dưới)

// ===== Text shown to the player =====
const TEXT = {
    start: "Bắt đầu",
    wrongLetter: l => "Từ phải bắt đầu bằng chữ " + l.toUpperCase(),
    tooShort: "Từ cần ít nhất " + MIN_LENGTH + " chữ cái",
    unknown: "Từ này không tồn tại",
    used: "Bạn đã dùng từ này rồi",
    timeUp: "Hết giờ!",
    noWords: "Bạn chưa tìm được từ nào.",
    listen: w => "Nghe phát âm từ " + w,
    connecting: "Đang kết nối…",
    connectFail: "Không kết nối được phòng. Đang quay về…",
    countdown: n => "Bắt đầu sau " + n + "…",
    waiting: (d, t) => "Đang chờ mọi người… (" + d + "/" + t + " đã xong)",
    rankHead: "Bảng xếp hạng",
    rankOf: (r, n) => "Hạng " + r + "/" + n,
    you: " (bạn)",
    toRoom: "Về phòng chờ",
    leaveConfirm: "Thoát phòng? Bạn sẽ không có điểm trong ván này."
};

// Màu/nhãn loại từ lấy từ dữ liệu (n, v, adj, adv, prep, conj, pron, int, art, num, det)
const POS_LABEL = {
    n: "n", v: "v", adj: "adj", adv: "adv", prep: "prep",
    conj: "conj", pron: "pron", int: "int", art: "art", num: "num", det: "det"
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

// --- chỉ dùng khi chơi nhiều người ---
let net = null;
let clockOffset = 0;                        // lệch giữa đồng hồ máy chủ phòng và đồng hồ máy này
let carry = 0;                              // số từ đã nộp trước đó (khi vào lại giữa ván)
let finalData = null;                       // bảng xếp hạng cuối, có thể tới trước khi màn kết quả mở
let progress = { done: 0, total: 0 };
const now = () => Date.now() + clockOffset; // chơi đơn thì offset = 0

// ===== Setup =====
makeBubbles();
$("submitBtn").addEventListener("click", submitWord);
$("startBtn").addEventListener("click", () => beginPlaying(now() + GAME_SECONDS * 1000));
$("restartBtn").addEventListener("click", newRound);
input.addEventListener("keydown", e => { if (e.key === "Enter") submitWord(); });

if (MULTI) {
    $("startBtn").hidden = true;            // nhiều người: cả phòng bắt đầu cùng lúc, không có nút Bắt đầu
    $("restartBtn").hidden = true;          // chơi lại phải do chủ phòng bắt đầu ván mới ở phòng chờ
    $("homeBtn").textContent = TEXT.toRoom;
    $("homeBtn").href = ROOM_PAGE;
    $("homeBtn").addEventListener("click", e => { e.preventDefault(); leaveToRoom(); });
    $("backBtn").addEventListener("click", e => { e.preventDefault(); if (confirm(TEXT.leaveConfirm)) leaveToRoom(); });
    bootMulti();
} else {
    $("startBtn").disabled = false;
    $("startBtn").textContent = TEXT.start;
    newRound();
}

// ===== Round flow =====
function newRound() {                       // chơi đơn: chọn chữ ngẫu nhiên rồi chờ bấm Bắt đầu
    let next;
    do { next = LETTERS[Math.floor(Math.random() * LETTERS.length)]; } while (next === letter);
    resetRound(next);
    $("startBtn").focus();
}

function resetRound(next) {
    clearInterval(timerID);
    letter = next;

    used = new Set();
    found = [];
    score = 0;
    carry = 0;
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

    $("rankBox").classList.add("hidden");
    $("resultScreen").classList.add("hidden");
    $("readyScreen").classList.remove("hidden");
}

function beginPlaying(end) {                // end: mốc hết giờ (theo đồng hồ máy chủ khi chơi nhiều người)
    $("readyScreen").classList.add("hidden");
    input.disabled = false;
    input.focus();
    running = true;
    endAt = end;
    tick();
    timerID = setInterval(tick, 250);
}

function tick() {
    const left = Math.max(0, endAt - now());
    $("seconds").textContent = Math.ceil(left / 1000);
    $("timerFill").style.width = (left / (GAME_SECONDS * 1000) * 100) + "%";
    $("timerFill").classList.toggle("urgent", left <= 10000);
    if (left <= 0) endRound();
}

// resumed: { score, count } khi vào lại sau lúc đã nộp bài (không nộp lần nữa)
function endRound(resumed) {
    clearInterval(timerID);
    running = false;
    input.disabled = true;
    $("readyScreen").classList.add("hidden");
    playFinish();

    if (resumed) { score = resumed.score; carry = resumed.count; }
    const count = found.length || carry;

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
    $("resultCount").textContent = count;
    $("resultLongest").textContent = longest || "–";
    $("resultBest").textContent = best;
    $("resultBadge").classList.toggle("hidden", !(isBest && score > 0));

    renderChart(count);

    fillList($("resultFound"), found, true);
    fillList($("resultMissed"), sampleMissed(6), false);
    $("resultScreen").querySelector(".wh-result-body").scrollTop = 0;

    if (MULTI) {
        if (!resumed) submitResult(0);
        $("rankBox").classList.remove("hidden");
        $("rankList").innerHTML = "";
        $("rankTitle").textContent = TEXT.rankHead;
        $("rankWait").hidden = false;
        $("rankWait").textContent = TEXT.waiting(progress.done, progress.total);
        if (finalData) renderRank(finalData);
    }

    $("resultScreen").classList.remove("hidden");
    (MULTI ? $("homeBtn") : $("restartBtn")).focus();
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

// ===== Word rows =====
function meaningOf(word) {
    const data = wordChainData.lookup[word];
    const first = data && data.meanings && data.meanings[0];
    return first ? first.text : "";
}

// Loại từ: ưu tiên loại của nghĩa đầu tiên, nếu trống thì lấy loại chung của từ
function posOf(word) {
    const data = wordChainData.lookup[word];
    if (!data) return "";
    const first = data.meanings && data.meanings[0];
    const type = (first && first.type) || (data.type && data.type[0]) || "";
    return type;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function makeRow(word, animate) {
    const li = document.createElement("li");
    if (animate) li.className = "pop";

    const btn = el("button", "wh-word");
    btn.type = "button";
    btn.dataset.word = word;
    btn.setAttribute("aria-label", TEXT.listen(word));

    const main = el("span", "wh-word-main");
    main.append(el("strong", "", word));
    const pos = posOf(word);
    if (pos) {
        const tag = el("i", "wh-pos", POS_LABEL[pos] || pos);
        tag.dataset.pos = pos;
        main.append(tag);
    }

    const meaning = el("span", "wh-word-meaning", meaningOf(word));

    const side = el("span", "wh-word-side");
    if (animate) side.append(el("em", "", "+" + points(word)));
    side.append(el("span", "wh-speaker", "🔊"));
    side.lastChild.setAttribute("aria-hidden", "true");

    btn.append(main, meaning, side);
    li.append(btn);
    return li;
}

function fillList(ul, words, showEmpty) {
    ul.innerHTML = "";
    if (!words.length && showEmpty) {
        ul.append(el("li", "wh-empty", TEXT.noWords));
        return;
    }
    words.forEach(w => ul.append(makeRow(w, false)));
}

// Bấm vào bất kỳ từ nào (trong lúc chơi hoặc ở bảng tổng kết) để nghe phát âm
document.addEventListener("click", e => {
    const btn = e.target.closest(".wh-word");
    if (!btn) return;
    speak(btn.dataset.word);
    btn.classList.add("is-speaking");
    setTimeout(() => btn.classList.remove("is-speaking"), 900);
});

// ===== Biểu đồ tròn: từ đã tìm / chưa tìm =====
// Tổng = mọi từ trong từ điển bắt đầu bằng chữ cái này và đủ độ dài tối thiểu
function totalWordsForLetter(done) {
    const list = wordChainData.startsWith[letter] || [];
    const eligible = list.filter(w => points(w) >= MIN_LENGTH).length;
    return Math.max(eligible, done); // không bao giờ ít hơn số từ đã tìm
}

function formatPercent(p) {
    if (p === 0) return "0%";
    if (p < 1) return p.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "%";
    if (p < 10) return p.toFixed(1).replace(/\.0$/, "") + "%";
    return Math.round(p) + "%";
}

function renderChart(done) {
    const total = totalWordsForLetter(done);
    const percent = total > 0 ? done / total * 100 : 0;

    // Lát nhỏ quá thì vẫn vẽ tối thiểu 1.5% vòng tròn để người chơi thấy được
    const arc = done > 0 ? Math.max(percent, 1.5) : 0;

    const fill = $("donutFill");
    fill.style.strokeDasharray = "0 100"; // đặt lại để chạy lại hiệu ứng
    requestAnimationFrame(() => requestAnimationFrame(() => {
        fill.style.strokeDasharray = arc + " 100";
    }));

    $("donutPercent").textContent = formatPercent(percent);
    $("chartLetter").textContent = letter.toUpperCase();
    $("legendFound").textContent = done;
    $("legendMissed").textContent = Math.max(0, total - done);
    $("legendTotal").textContent = total;
    $("donutImg").setAttribute("aria-label",
        "Đã tìm " + done + " trên " + total + " từ, " + formatPercent(percent));
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

// ===== Nhiều người =====
async function bootMulti() {
    $("readyCount").hidden = false;
    $("readyCount").textContent = TEXT.connecting;
    $("readyLetter").textContent = "?";
    try {
        if (MODE === "bots") {
            net = WordHuntNet.create({ players: Number(PARAMS.get("bots")) || 6, name: "Bạn" });
        } else {
            const engine = BossNet.create();
            const back = await engine.resume();
            if (!back || back.state === "lobby") { location.href = ROOM_PAGE; return; }
            net = WordHuntNet.connect(engine);
        }
    } catch (e) {
        console.error("[WordHunt]", e);
        $("readyCount").textContent = TEXT.connectFail;
        setTimeout(() => { location.href = ROOM_PAGE; }, 1500);
        return;
    }
    net.onStart(onStart);
    net.onProgress(p => {
        progress = p;
        if (!$("rankWait").hidden) $("rankWait").textContent = TEXT.waiting(p.done, p.total);
    });
    net.onFinal(g => {
        finalData = g;
        if (!$("resultScreen").classList.contains("hidden")) renderRank(g);
    });
    net.onClosed(() => { location.href = ROOM_PAGE; });
    net.start();
}

// info: { seed, startAt, finished, resume, serverNow() } — xem wordHuntNet.js
function onStart(info) {
    clockOffset = info.serverNow() - Date.now();
    resetRound(letterFor(info.seed));

    const start = info.startAt, end = start + GAME_SECONDS * 1000, r = info.resume;
    if (info.finished || (r && r.done)) {   // vào lại sau khi đã nộp bài (hoặc ván đã chốt): chỉ xem kết quả
        endRound({ score: r ? r.score : 0, count: r ? r.count : 0 });
        return;
    }
    if (now() >= end) { endRound(); return; }   // vào quá muộn: ván đã hết giờ, nộp 0 điểm

    $("readyCount").hidden = false;
    const t = setInterval(() => {
        const left = start - now();
        if (left <= 0) {
            clearInterval(t);
            $("readyCount").hidden = true;
            beginPlaying(end);
        } else {
            $("readyCount").textContent = TEXT.countdown(Math.ceil(left / 1000));
        }
    }, 200);
    $("readyCount").textContent = TEXT.countdown(Math.max(0, Math.ceil((start - now()) / 1000)));
}

function submitResult(tries) {              // mất mạng thoáng qua thì thử lại vài lần
    Promise.resolve(net.submit(score, found.length)).catch(e => {
        console.error("[WordHunt] nộp kết quả lỗi:", e);
        if (tries < 4) setTimeout(() => submitResult(tries + 1), 2000);
    });
}

function rankRow(r, mine) {
    const li = el("li", "wh-rank-row" + (mine ? " me" : "") + (r.left ? " left" : ""));
    const medal = ["🥇", "🥈", "🥉"][r.rank - 1] || "#" + r.rank;
    li.append(
        el("span", "wh-rank-pos", medal),
        el("span", "wh-rank-name", r.name + (mine ? TEXT.you : "")),
        el("span", "wh-rank-score", r.score + " điểm"),
        el("small", "wh-rank-count", r.count + " từ")
    );
    return li;
}

function renderRank(g) {
    const ul = $("rankList");
    ul.innerHTML = "";
    $("rankWait").hidden = true;

    const me = g.ranking.find(r => r.id === net.id);
    if (me) {                               // số liệu chính thức từ host (đúng cả khi vào lại giữa ván)
        $("resultScore").textContent = me.score;
        $("resultCount").textContent = me.count;
        score = me.score;
    }
    $("rankTitle").textContent = TEXT.rankHead + (me ? " · " + TEXT.rankOf(me.rank, g.ranking.length) : "");

    g.ranking.slice(0, RANK_TOP).forEach(r => ul.append(rankRow(r, r.id === net.id)));
    if (me && me.rank > RANK_TOP) {
        ul.append(el("li", "wh-rank-gap", "…"));
        ul.append(rankRow(me, true));
    }
}

async function leaveToRoom() {
    try { if (net) await net.leave(); } catch (e) { /* vẫn quay về phòng */ }
    location.href = ROOM_PAGE;
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
