/* ===========================================================
   boss-rules.js - luật cân bằng BossBattle (bản v2)
   Chỉ có hằng số và hàm thuần, không đụng tới mạng.
   Muốn chỉnh độ khó thì sửa TARGET_ACCURACY ở đây.
   =========================================================== */
(function (root) {
    "use strict";

    var R = {
        TARGET_ACCURACY: 0.7,        // mỗi người cần đúng khoảng 70% để thắng
        QUESTIONS_PER_STAGE: 10,
        BOSS_COUNT: 6,               // số boss ngẫu nhiên (id 0..4: Burger, Sushi, Baguette, Gà luộc, Khoai chiên)
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 30,

        MIN_SECONDS: 40,             // giai đoạn đầu (dễ)
        MAX_SECONDS: 60,             // giai đoạn cuối (khó)
        SECONDS_STEP: 5,             // làm tròn thời gian về bội số của số này

        FIRST_STAGE_DELAY_MS: 8000,  // chờ trước giai đoạn 1 (đủ để mọi người load trang game)
        BREAK_MS: 5000,              // nghỉ giữa các giai đoạn
        GRACE_MS: 3000,              // đợi điểm cuối cùng về sau khi hết giờ (mạng chậm, tab chạy nền)
        OFFLINE_GRACE_MS: 120000      // mất kết nối quá lâu thì coi như đã rời phòng
    };

    /* Số HP mỗi người "gánh" ở mỗi giai đoạn: 10 câu x 0,7 = 7 */
    R.hpShare = function () {
        return Math.round(R.QUESTIONS_PER_STAGE * R.TARGET_ACCURACY);
    };

    /* 2-5 người: 3 giai đoạn, 6-10: 4, trên 10: 5 */
    R.stageCount = function (players) {
        return players <= 5 ? 3 : players <= 10 ? 4 : 5;
    };

    /* HP = số người x số giai đoạn x 7 */
    R.maxHp = function (players, stages) {
        return players * stages * R.hpShare();
    };

    /* Thời gian mỗi giai đoạn tăng đều từ 40s lên 60s (3 giai đoạn: 40/50/60). stage tính từ 1. */
    R.stageSeconds = function (stage, stages) {
        if (stages <= 1) return R.MAX_SECONDS;
        var t = R.MIN_SECONDS + (R.MAX_SECONDS - R.MIN_SECONDS) * (stage - 1) / (stages - 1);
        return Math.round(t / R.SECONDS_STEP) * R.SECONDS_STEP;
    };

    /* Người rời giữa ván: boss bớt đúng phần HP mà người đó chưa kịp đóng góp.
       resolvedStages = số giai đoạn đã kết thúc; partialScore = điểm họ đã ghi ở giai đoạn đang chơi dở. */
    R.hpLostOnLeave = function (stages, resolvedStages, partialScore) {
        var share = R.hpShare();
        var unmet = share * (stages - resolvedStages) - Math.min(share, partialScore || 0);
        return Math.max(0, unmet);
    };


    /* ---------- xáo trộn ---------- */

    R.shuffle = function (arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    };

    function hashString(str) {                 // xmur3
        var h = 1779033703 ^ str.length;
        for (var i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^ (h >>> 16)) >>> 0;
    }

    function mulberry32(seed) {
        return function () {
            seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* Xáo trộn riêng cho từng người nhưng lặp lại được: cùng (playerId, salt) luôn ra cùng thứ tự.
       Ví dụ: thứ tự câu hỏi  -> R.shuffleFor(myId, "q:" + stage, words)
              thứ tự đáp án   -> R.shuffleFor(myId, "opt:" + stage + ":" + word, options) */
    R.shuffleFor = function (playerId, salt, arr) {
        var rnd = mulberry32(hashString(playerId + "|" + salt));
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rnd() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    };

    root.BossRules = R;
    if (typeof module !== "undefined" && module.exports) module.exports = R;
})(typeof window !== "undefined" ? window : globalThis);
