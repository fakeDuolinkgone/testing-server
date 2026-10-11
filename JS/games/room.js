/* ===========================================================
   room.js - sảnh chờ nhiều người chơi (room.html)
   Tạo phòng / vào phòng bằng mã, xem ai đã vào, chủ phòng chọn chế độ chơi rồi bấm bắt đầu.
   Khi ván bắt đầu thì cả phòng được chuyển sang trang game của chế độ đã chọn
   (danh sách chế độ nằm ở JS/games/gameModes.js, trang này không biết luật của từng game).
   =========================================================== */
(function () {
    "use strict";

    // Trang game mở ra khi chủ phòng bấm Bắt đầu lấy theo chế độ đã chọn (GameModes.pageOf);
    // trang đó tự gọi net.resume() để nối lại phòng.
    // Muốn thử riêng lớp mạng, mở thẳng "gameMode/bossBattle/netTest.html".

    var $ = function (id) { return document.getElementById(id); };
    var net = null;
    var wired = false;
    var selectedMode = null;      // id chế độ chủ phòng đang chọn (null = chưa chọn)

    var ERRORS = {
        ROOM_NOT_FOUND: "Không tìm thấy phòng này. Kiểm tra lại mã phòng nhé.",
        ROOM_STARTED: "Phòng này đã bắt đầu chơi rồi.",
        ROOM_FULL: "Phòng đã đủ người.",
        NOT_ENOUGH_PLAYERS: "Chưa đủ người để bắt đầu.",
        NOT_HOST: "Chỉ chủ phòng mới làm được việc này.",
        MODE_UNAVAILABLE: "Chế độ này sắp ra mắt, hãy chọn chế độ khác.",
        BAD_MODE: "Chế độ không hợp lệ.",
        ALREADY_STARTED: "Phòng này đã bắt đầu chơi rồi.",
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

    function goToGame(g) {
        var page = GameModes.pageOf(g && g.mode);
        location.href = page + "?room=" + encodeURIComponent(net.code);
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

        renderLobby();
    }

    function onlineCount() {
        return net.getPlayers().filter(function (p) { return p.online; }).length;
    }

    /* Lưới chế độ chơi + dòng thông tin + nút Bắt đầu. Gọi lại mỗi khi danh sách người hoặc chế độ đổi. */
    function renderLobby() {
        var host = net.isHost();
        var n = onlineCount();
        var mode = selectedMode ? GameModes.get(selectedMode) : null;
        if (mode && !mode.available) mode = null;          // phòng đang trỏ vào chế độ chưa có thì coi như chưa chọn

        renderModes(host);

        var enough = !!mode && n >= mode.minPlayers();
        $("roomInfo").textContent = mode
            ? n + " người chơi  •  " + mode.name + "  •  " + mode.summary(n)
            : n + " người chơi  •  chưa chọn chế độ chơi";
        $("modeHint").textContent = host
            ? "Bấm vào một chế độ để chọn. Các chế độ khác sẽ sớm có mặt."
            : "Chủ phòng đang chọn chế độ chơi.";

        $("startBtn").hidden = !host;
        $("startBtn").disabled = !enough;
        $("startBtn").textContent = !mode ? "Hãy chọn chế độ chơi"
            : enough ? "Bắt đầu " + mode.name
            : "Cần ít nhất " + mode.minPlayers() + " người";
        $("waitText").hidden = host;
        $("waitText").textContent = mode
            ? "Đang chờ chủ phòng bắt đầu " + mode.name + "…"
            : "Đang chờ chủ phòng chọn chế độ…";
    }

    function renderModes(isHost) {
        var grid = $("modeGrid");
        grid.textContent = "";
        GameModes.list().forEach(function (m) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "room-mode";
            btn.setAttribute("role", "radio");
            var picked = m.id === selectedMode && m.available;
            btn.setAttribute("aria-checked", picked ? "true" : "false");
            if (picked) btn.classList.add("is-selected");
            if (!m.available) { btn.classList.add("is-soon"); btn.disabled = true; }
            else if (!isHost) btn.disabled = true;          // khách chỉ xem, không bấm chọn được

            var ic;
            if (m.image) {
                ic = document.createElement("img");
                ic.className = "room-mode-img";
                ic.src = m.image;
                ic.alt = "";
            } else {
                ic = document.createElement("span");
                ic.className = "room-mode-icon";
                ic.textContent = m.icon;
            }
            var nm = document.createElement("span");
            nm.className = "room-mode-name";
            nm.textContent = m.name;
            var ds = document.createElement("span");
            ds.className = "room-mode-desc";
            ds.textContent = m.desc;
            btn.appendChild(ic); btn.appendChild(nm); btn.appendChild(ds);

            if (!m.available) {
                var tag = document.createElement("span");
                tag.className = "room-mode-tag";
                tag.textContent = "Sắp ra mắt";
                btn.appendChild(tag);
            }
            if (m.available) btn.addEventListener("click", function () { chooseMode(m.id); });
            grid.appendChild(btn);
        });
    }

    async function chooseMode(id) {
        if (!net.isHost() || id === selectedMode) return;
        $("lobbyError").textContent = "";
        var before = selectedMode;
        selectedMode = id;                                  // hiện ngay, mạng báo lỗi thì trả lại
        renderLobby();
        try { await net.setMode(id); }
        catch (e) { selectedMode = before; renderLobby(); $("lobbyError").textContent = message(e); }
    }

    function enterLobby() {
        $("roomCode").textContent = net.code;
        $("lobbyError").textContent = "";
        show("lobby");

        if (wired) return;
        wired = true;
        net.onPlayersChange(renderPlayers);
        net.onModeChange(function (m) { selectedMode = m; renderLobby(); });
        net.onGameStart(goToGame);
        net.onRemoved(function () { backToEntry("Bạn đã bị mất kết nối với phòng."); });
        net.onRoomClosed(function () { backToEntry("Phòng đã đóng."); });
    }

    function backToEntry(text) {
        selectedMode = null;
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
        if (!selectedMode) { $("lobbyError").textContent = "Hãy chọn chế độ chơi trước."; return; }
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
