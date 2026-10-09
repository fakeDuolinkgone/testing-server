/* ===========================================================
   room.js - sảnh chờ nhiều người chơi (room.html)
   Tạo phòng / vào phòng bằng mã, xem ai đã vào, chủ phòng bấm bắt đầu.
   Khi ván bắt đầu thì cả phòng được chuyển sang trang game.
   =========================================================== */
(function () {
    "use strict";

    // Trang game sẽ mở khi bắt đầu. Đổi thành "gameMode/bossBattle/bossBattle.html"
    // khi trang game thật làm xong (nó cần gọi net.resume(), xem JS/net/README.md).
    var GAME_PAGE = "gameMode/bossBattle/netTest.html";

    var $ = function (id) { return document.getElementById(id); };
    var net = null;
    var wired = false;

    var ERRORS = {
        ROOM_NOT_FOUND: "Không tìm thấy phòng này. Kiểm tra lại mã phòng nhé.",
        ROOM_STARTED: "Phòng này đã bắt đầu chơi rồi.",
        ROOM_FULL: "Phòng đã đủ người.",
        NOT_ENOUGH_PLAYERS: "Cần ít nhất " + BossRules.MIN_PLAYERS + " người để bắt đầu.",
        NOT_HOST: "Chỉ chủ phòng mới bắt đầu được.",
        NO_CODE: "Không tạo được mã phòng, thử lại nhé."
    };
    function message(e) { return ERRORS[e && e.code] || "Có lỗi kết nối. Kiểm tra mạng rồi thử lại."; }

    function playerName() {
        return (window.normaPlayer && normaPlayer.getName()) || "Người chơi";
    }

    function show(view) {
        $("viewEntry").hidden = view !== "entry";
        $("viewLobby").hidden = view !== "lobby";
    }

    function busy(on) {
        ["createBtn"].forEach(function (id) { $(id).disabled = on; });
        $("joinForm").querySelector("button").disabled = on;
    }

    function goToGame() {
        location.href = GAME_PAGE + "?room=" + encodeURIComponent(net.code);
    }

    /* ---------- sảnh chờ ---------- */
    function renderPlayers(players) {
        var list = $("playerList");
        list.textContent = "";
        players.forEach(function (p) {
            var li = document.createElement("li");
            if (!p.online) li.className = "is-offline";

            var av = document.createElement("span");
            av.className = "room-avatar";
            av.textContent = (Array.from(p.name)[0] || "?").toUpperCase();

            var nm = document.createElement("span");
            nm.className = "room-pname";
            nm.textContent = p.name + (p.isMe ? " (bạn)" : "");

            li.appendChild(av);
            li.appendChild(nm);
            if (p.isHost) {
                var badge = document.createElement("span");
                badge.className = "room-badge";
                badge.textContent = "Chủ phòng";
                li.appendChild(badge);
            }
            list.appendChild(li);
        });

        var n = players.filter(function (p) { return p.online; }).length;
        var stages = BossRules.stageCount(n);
        $("roomInfo").textContent = n + " người chơi  •  " + stages + " giai đoạn  •  boss " + BossRules.maxHp(n, stages) + " máu";

        var host = net.isHost();
        var enough = n >= BossRules.MIN_PLAYERS;
        $("startBtn").hidden = !host;
        $("startBtn").disabled = !enough;
        $("startBtn").textContent = enough ? "Bắt đầu" : "Cần ít nhất " + BossRules.MIN_PLAYERS + " người";
        $("waitText").hidden = host;
    }

    function enterLobby() {
        $("roomCode").textContent = net.code;
        $("lobbyError").textContent = "";
        show("lobby");

        if (wired) return;
        wired = true;
        net.onPlayersChange(renderPlayers);
        net.onGameStart(goToGame);
        net.onRemoved(function () { backToEntry("Bạn đã bị mất kết nối với phòng."); });
        net.onRoomClosed(function () { backToEntry("Phòng đã đóng."); });
    }

    function backToEntry(text) {
        $("entryError").textContent = text || "";
        show("entry");
    }

    /* ---------- hành động ---------- */
    async function create() {
        $("entryError").textContent = "";
        busy(true);
        try { await net.createRoom(playerName()); enterLobby(); }
        catch (e) { $("entryError").textContent = message(e); }
        busy(false);
    }

    async function join(ev) {
        ev.preventDefault();
        var code = $("codeInput").value.trim();
        if (code.length < 6) { $("entryError").textContent = "Mã phòng gồm 6 ký tự."; return; }
        $("entryError").textContent = "";
        busy(true);
        try { await net.joinRoom(code, playerName()); enterLobby(); }
        catch (e) { $("entryError").textContent = message(e); }
        busy(false);
    }

    async function start() {
        $("lobbyError").textContent = "";
        $("startBtn").disabled = true;
        try { await net.startGame(); }
        catch (e) { $("lobbyError").textContent = message(e); $("startBtn").disabled = false; }
    }

    async function leave() {
        await net.leaveRoom();
        backToEntry("");
    }

    function copyCode() {
        var btn = $("copyBtn");
        var done = function () { btn.textContent = "Đã chép"; setTimeout(function () { btn.textContent = "Sao chép"; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(net.code).then(done, function () { });
    }

    /* ---------- khởi động ---------- */
    async function init() {
        $("codeInput").addEventListener("input", function () {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        });

        if (!BossNet.isConfigured()) {
            var n = $("setupNotice");
            n.hidden = false;
            n.innerHTML = "Chưa kết nối Firebase. Mở <b>JS/net/firebase-config.js</b>, dán cấu hình dự án của bạn vào rồi tải lại trang.";
            busy(true);
            return;
        }

        try { net = BossNet.create(); }
        catch (e) {
            var n2 = $("setupNotice");
            n2.hidden = false;
            n2.textContent = e.code === "NO_SDK"
                ? "Không tải được thư viện Firebase. Kiểm tra kết nối Internet rồi tải lại trang."
                : message(e);
            busy(true);
            return;
        }

        $("createBtn").addEventListener("click", create);
        $("joinForm").addEventListener("submit", join);
        $("startBtn").addEventListener("click", start);
        $("leaveBtn").addEventListener("click", leave);
        $("copyBtn").addEventListener("click", copyCode);

        // đã ở trong một phòng từ trước (tải lại trang, hoặc quay về từ trang game)
        try {
            var back = await net.resume();
            if (back) {
                if (back.state === "lobby") enterLobby();
                else { net.onGameStart(goToGame); }          // ván đang chạy: quay lại trang game
            }
        } catch (e) { /* không nối lại được thì ở màn hình nhập */ }
    }

    init();
})();
