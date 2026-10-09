/* ===========================================================
   user.js - "Đăng nhập" bằng tên
   - Chưa có tên  -> hiện màn hình nhập tên.
   - Đã có tên    -> hiện tên ở góc trái trên (bấm vào để đổi tên).
   Tên được lưu trong localStorage nên các trang khác và lần mở
   sau vẫn nhớ. Gắn file này vào <head> của trang cần dùng.
   =========================================================== */
(function () {
    "use strict";

    var KEY = "normafix.playerName";
    var MAX_LEN = 20;
    var root = document.documentElement;

    var memoryName = "";      // dự phòng khi trình duyệt chặn localStorage
    var player = null;        // ô tên ở góc trái trên
    var gate = null;          // màn hình nhập tên (đang mở thì khác null)


    /* ---------- lưu / đọc tên ---------- */
    function readName() {
        try { return localStorage.getItem(KEY) || memoryName; }
        catch (e) { return memoryName; }
    }

    function saveName(name) {
        memoryName = name;
        try { localStorage.setItem(KEY, name); } catch (e) { /* bỏ qua */ }
    }

    function cleanName(raw) {
        var text = String(raw).replace(/\s+/g, " ").trim();
        return Array.from(text).slice(0, MAX_LEN).join("");
    }

    function initialOf(name) {
        return (Array.from(name)[0] || "?").toUpperCase();
    }


    // Chưa có tên thì ẩn trang ngay từ đầu, để nội dung không nháy lên trước màn hình nhập tên
    if (!readName()) root.classList.add("login-pending");


    /* ---------- ô tên ở góc trái trên ---------- */
    function buildPlayer() {
        player = document.createElement("div");
        player.className = "player";
        player.innerHTML =
            '<button type="button" class="player-chip" aria-haspopup="true" aria-expanded="false" title="Tên của bạn">' +
                '<span class="player-avatar" aria-hidden="true"></span>' +
                '<span class="player-name"></span>' +
                '<span class="player-caret" aria-hidden="true">▾</span>' +
            '</button>' +
            '<div class="player-menu" hidden>' +
                '<button type="button" class="player-menu-item">Đổi tên</button>' +
            '</div>';

        // Có navbar (index.html) thì nằm trong navbar, bên trái logo.
        // Không có (game.html) thì nổi ở góc trái trên của trang.
        var nav = document.querySelector(".navbar");
        if (nav) {
            nav.insertBefore(player, nav.firstChild);
        } else {
            player.classList.add("floating");
            document.body.classList.add("has-player");
            document.body.appendChild(player);
        }

        var chip = player.querySelector(".player-chip");
        var menu = player.querySelector(".player-menu");

        function setMenu(open) {
            menu.hidden = !open;
            chip.setAttribute("aria-expanded", open ? "true" : "false");
        }

        chip.addEventListener("click", function () { setMenu(menu.hidden); });

        player.querySelector(".player-menu-item").addEventListener("click", function () {
            setMenu(false);
            openGate(true);
        });

        document.addEventListener("click", function (e) {
            if (!player.contains(e.target)) setMenu(false);
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !menu.hidden) { setMenu(false); chip.focus(); }
        });
    }

    function showName(name) {
        if (!player) buildPlayer();
        // dùng textContent: tên người dùng nhập vào không bao giờ được chèn thành HTML
        player.querySelector(".player-name").textContent = name;
        player.querySelector(".player-avatar").textContent = initialOf(name);
        player.querySelector(".player-chip").title = "Tên của bạn: " + name;
    }


    /* ---------- màn hình nhập tên ---------- */
    function openGate(isChange) {
        if (gate) return;

        gate = document.createElement("div");
        gate.className = "login-gate";
        gate.innerHTML =
            '<form class="login-card" role="dialog" aria-modal="true" aria-labelledby="loginTitle" novalidate>' +
                '<h2 id="loginTitle"></h2>' +
                '<p></p>' +
                '<input class="login-input" type="text" maxlength="' + MAX_LEN + '" autocomplete="off"' +
                    ' placeholder="Tên của bạn" aria-label="Tên của bạn">' +
                '<div class="login-error" aria-live="polite"></div>' +
                '<button type="submit" class="login-btn"></button>' +
                '<button type="button" class="login-cancel" hidden>Giữ tên cũ</button>' +
            '</form>';

        var form = gate.querySelector("form");
        var input = gate.querySelector(".login-input");
        var error = gate.querySelector(".login-error");
        var cancel = gate.querySelector(".login-cancel");

        gate.querySelector("h2").textContent = isChange ? "Đổi tên" : "Bạn tên là gì?";
        gate.querySelector("p").textContent = isChange
            ? "Tên mới sẽ hiện ở góc trên bên trái."
            : "Nhập tên để bắt đầu học cùng normaFix.";
        gate.querySelector(".login-btn").textContent = isChange ? "Lưu tên" : "Vào học";
        cancel.hidden = !isChange;

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var name = cleanName(input.value);

            if (!name) {
                error.textContent = "Hãy nhập tên của bạn.";
                input.setAttribute("aria-invalid", "true");
                input.focus();
                return;
            }

            saveName(name);
            showName(name);
            closeGate(isChange);
        });

        input.addEventListener("input", function () {
            error.textContent = "";
            input.removeAttribute("aria-invalid");
        });

        // Chỉ cho đóng mà không lưu khi đang đổi tên (đã có tên cũ)
        if (isChange) {
            cancel.addEventListener("click", function () { closeGate(true); });
            gate.addEventListener("keydown", function (e) {
                if (e.key === "Escape") closeGate(true);
            });
        }

        document.body.appendChild(gate);
        root.classList.add("login-pending");

        input.value = isChange ? readName() : "";
        input.focus();
        input.select();
    }

    // restoreFocus: chỉ trả focus về ô tên khi đang đổi tên (lần đăng nhập đầu thì không cần)
    function closeGate(restoreFocus) {
        if (!gate) return;

        var closing = gate;
        gate = null;

        closing.classList.add("closing");
        root.classList.remove("login-pending");
        setTimeout(function () { closing.remove(); }, 250);

        var chip = player && player.querySelector(".player-chip");
        if (restoreFocus && chip) chip.focus();
    }


    /* ---------- khởi động ---------- */
    function init() {
        var name = readName();
        if (name) showName(name);
        else openGate(false);
    }

    // Cho các trang khác dùng sau này (ví dụ ghi tên vào bảng kết quả)
    window.normaPlayer = {
        getName: readName,
        changeName: function () { openGate(true); }
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
