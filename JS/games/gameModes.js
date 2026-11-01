/* ===========================================================
   gameModes.js - danh sách chế độ chơi của phòng (dùng ở room.html)
   Chỉ là dữ liệu mô tả, không đụng tới mạng hay luật của từng game.

   Thêm chế độ mới:
     1) Làm trang game trong gameMode/<tên>/ rồi đổi  available: true  và điền  page.
     2) Cho BossNet.startGame biết chế độ đó (hiện chỉ "bossBattle" chạy được).
   =========================================================== */
(function (root) {
    "use strict";

    var MODES = [
        {
            id: "bossBattle",
            icon: "⚔️",
            name: "BossBattle",
            desc: "Cả phòng cùng đánh bại boss bằng điểm từ vựng.",
            page: "gameMode/bossBattle/bossBattle.html",
            solo: "gameMode/bossBattle/bossBattle.html?solo=1&bots=3",       // chơi đơn: bot ngồi chơi cùng
            available: true,
            // dòng thông tin ở sảnh chờ, phụ thuộc số người
            summary: function (n) {
                var stages = root.BossRules.stageCount(n);
                return stages + " giai đoạn  •  boss " + root.BossRules.maxHp(n, stages) + " máu";
            },
            minPlayers: function () { return root.BossRules.MIN_PLAYERS; },
            maxPlayers: function () { return root.BossRules.MAX_PLAYERS; }
        },


        {
            id: "wordHunt",
            icon: "🔍",
            image: "pics/wordhunt.svg",          // ảnh hiện trên thẻ chế độ (không có thì dùng icon)
            name: "WordHunt",
            desc: "Người nào tìm được nhiều từ nhất trong 60 giây sẽ thắng.",
            solo: "gameMode/wordHunt/wordHunt.html",
            soloOnly: true,                       // chưa có bản nhiều người: chọn được nhưng chỉ để chơi đơn
            available: false
        },



        { id: "race", icon: "🏁", name: "Đua tốc độ", desc: "Ai trả lời nhanh và đúng nhất sẽ về nhất.", available: false },



        {
            id: "survival", icon: "💀", name: "Sinh tồn",
            desc: "Cả phòng cùng chơi, cứ vài vòng loại những người điểm thấp nhất, người cuối cùng sống sót thắng.",
            page: "gameMode/survival/survival.html",
            solo: "gameMode/survival/survival.html?solo=1&players=10",       // players = bạn + bot
            available: true,
            summary: function (n) { return n + " người  •  loại dần cho tới khi còn 1 người"; },
            minPlayers: function () { return 2; },
            maxPlayers: function () { return 80; }
        },


        {
            id: "wordPuzzle", icon: "🎯", name: "Word Puzzle",
            desc: "Cả phòng cùng giải 3 level tìm từ trong bảng chữ, ai nhiều điểm nhất (và nhanh nhất) thắng.",
            page: "gameMode/wordPuzzle/wordPuzzle.html",
            solo: "gameMode/wordPuzzle/wordPuzzle.html?single=1",                   // bản chơi đơn có sẵn (giống thẻ ở game.html)
            available: true,
            summary: function (n) { return n + " người  •  3 level tìm từ, tự chơi theo nhịp riêng"; },
            minPlayers: function () { return 2; },
            maxPlayers: function () { return 80; }
        },

        
        {
            id: "wordChain", icon: "🔗", name: "Nối từ đối kháng",
            desc: "Thi nối từ với bạn bè theo từng lượt, hết mạng thì bị loại, người cuối cùng thắng.",
            page: "gameMode/wordChain/wordChainMulti.html",
            solo: "gameMode/wordChain/wordChain.html",                          // bản chơi đơn đấu với AI
            available: true,
            summary: function (n) { return n + " người  •  nối từ theo lượt, 2 mạng mỗi người"; },
            minPlayers: function () { return 2; },
            maxPlayers: function () { return 12; }
        }
    ];

    root.GameModes = {
        list: function () { return MODES.slice(); },
        get: function (id) {
            for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
            return null;
        },
        // địa chỉ chơi đơn (với bot) của một chế độ; null nếu chế độ đó chưa có chơi đơn
        soloOf: function (id) {
            var m = root.GameModes.get(id);
            return (m && (m.available || m.soloOnly) && m.solo) || null;
        },
        // trang game của một chế độ; không có thì về BossBattle (phòng cũ chưa lưu chế độ)
        pageOf: function (id) {
            var m = root.GameModes.get(id);
            return (m && m.available && m.page) || MODES[0].page;
        }
    };
})(typeof window !== "undefined" ? window : globalThis);