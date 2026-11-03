/* ===========================================================
   music.js - nhạc nền cho các trang game (đặt ở JS/common/music.js)
   Cách dùng: thêm 1 thẻ script vào trang game (đặt cuối <body>):
     <script src="../../JS/common/music.js" data-track="smooth"></script>   → "smooth jazz music.mp3"
     <script src="../../JS/common/music.js"></script>                      → ngẫu nhiên chill / funny jazz
   Tùy chọn: data-volume="0.3" (0.1 → 1). Âm lượng không bao giờ thấp hơn MIN_VOL (10%).
   Thư mục nhạc "music/" nằm cùng cấp với pics/, JS/...; đường dẫn tính từ vị trí file này nên trang ở thư mục sâu bao nhiêu cũng được.
   =========================================================== */
(function () {
    "use strict";
    if (window.normaMusic) return;                      // nạp 2 lần thì chỉ chạy 1 lần

    var MIN_VOL = 0.1;                                  // âm lượng tối thiểu 10%
    var DEFAULT_VOL = 0.1;
    var TRACKS = {
        smooth: ["smooth jazz music.mp3"],              // BossBattle, Word Chain nhiều người, WordHunt nhiều người
        other: ["chill jazz music.mp3", "funny jazz music.mp3"]   // các trò còn lại: chọn ngẫu nhiên 1 bài
    };

    var script = document.currentScript;
    var base = new URL("../../music/", script ? script.src : location.href);
    var group = script && script.getAttribute("data-track") === "smooth" ? "smooth" : "other";
    var list = TRACKS[group];
    var file = list[Math.floor(Math.random() * list.length)];

    function clamp(v) { v = +v; if (!isFinite(v)) v = DEFAULT_VOL; return Math.min(1, Math.max(MIN_VOL, v)); }

    var audio = new Audio(new URL(encodeURIComponent(file), base).href);   // tên file có dấu cách nên phải mã hóa
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = clamp(script && script.getAttribute("data-volume") || DEFAULT_VOL);
    audio.addEventListener("error", function () { console.warn("[music] Không tải được nhạc:", audio.src); });

    var wanted = true;                                  // người dùng chưa tắt nhạc

    function play() {
        wanted = true;
        var p = audio.play();
        if (p && p.catch) p.catch(waitForGesture);      // trình duyệt chặn tự phát → đợi lần bấm đầu tiên
    }
    function waitForGesture() {
        var evs = ["pointerdown", "keydown", "touchstart"];
        var go = function () {
            evs.forEach(function (e) { document.removeEventListener(e, go, true); });
            if (wanted) audio.play().catch(function () { /* bỏ qua */ });
        };
        evs.forEach(function (e) { document.addEventListener(e, go, true); });
    }

    // Tạm dừng khi chuyển sang tab khác, quay lại thì phát tiếp
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) audio.pause();
        else if (wanted) audio.play().catch(function () { /* bỏ qua */ });
    });

    window.normaMusic = {
        audio: audio,
        track: file,
        play: play,
        pause: function () { wanted = false; audio.pause(); },
        toggle: function () { if (audio.paused) play(); else this.pause(); return !audio.paused; },
        setVolume: function (v) { audio.volume = clamp(v); return audio.volume; }
    };

    play();
})();