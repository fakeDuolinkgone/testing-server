/* ===========================================================
   profile.js - giao diện trang profile.html (Hồ sơ / Thành tựu / Thống kê / Tài khoản)
   Dữ liệu và đăng nhập nằm ở JS/common/stats.js (normaStats).
   =========================================================== */
(function () {
    "use strict";

    var $ = function (id) { return document.getElementById(id); };
    var stats = window.normaStats;
    var mode = "reg";
    var TABS = ["profile", "ach", "stats", "acc"];

    function player() { return window.normaPlayer; }
    function fmtDate(ts) { return new Date(ts).toLocaleDateString("vi-VN"); }
    function fmtTime(sec) {
        var m = Math.floor(sec / 60);
        return m >= 60 ? Math.floor(m / 60) + " giờ " + (m % 60) + " phút" : m + " phút";
    }
    function say(id, text, ok) {
        var el = $(id);
        el.textContent = text;
        el.classList.toggle("ok", !!ok);
    }


    /* ---------- tab ---------- */
    function openTab(name) {
        TABS.forEach(function (t) {
            var on = t === name;
            $("tab-" + t).hidden = !on;
            $("tabBtn-" + t).setAttribute("aria-selected", on ? "true" : "false");
        });
        if (history.replaceState) history.replaceState(null, "", "#" + name);
    }
    TABS.forEach(function (t) { $("tabBtn-" + t).addEventListener("click", function () { openTab(t); }); });


    /* ---------- vẽ lại ---------- */
    function render() {
        var v = stats.view();
        var name = (player() && player().getName()) || "";

        $("pfAva").textContent = (Array.from(name)[0] || "?").toUpperCase();
        $("pfName").textContent = name || "Chưa có tên";
        $("pfJoined").textContent = "Tham gia từ " + fmtDate(v.joined) + (v.bio ? " · " + v.bio : "");
        $("pfLevel").textContent = "Cấp " + v.level;
        $("pfLevelTxt").textContent = " · " + Math.round(v.levelProgress * 50) + "/50 câu đúng để lên cấp";
        $("pfXp").style.width = Math.round(v.levelProgress * 100) + "%";

        if (document.activeElement !== $("pfNameIn")) $("pfNameIn").value = name;
        if (document.activeElement !== $("pfBioIn")) $("pfBioIn").value = v.bio;

        var done = 0;
        $("achList").innerHTML = stats.ACH.map(function (a) {
            var t = v.unlocked[a.id];
            if (t) done++;
            return '<div class="pf-ach-row' + (t ? "" : " locked") + '">' +
                '<div class="pf-badge" aria-hidden="true">' + (t ? a.icon : "🔒") + '</div>' +
                '<div><b>' + a.title + '</b><small>' + a.desc + (t ? " · " + fmtDate(t) : "") + '</small></div></div>';
        }).join("");
        $("achSum").textContent = "Đã mở khóa " + done + "/" + stats.ACH.length + " thành tựu.";

        var cards = [
            [v.games, "Ván đã học"],
            [v.correct + "/" + v.total, "Câu đúng"],
            [v.accuracy + "%", "Độ chính xác"],
            [v.best + "%", "Ván điểm cao nhất"],
            [v.streak, "Ngày học liên tiếp"],
            [fmtTime(v.seconds), "Thời gian học"]
        ];
        $("statCards").innerHTML = cards.map(function (c) {
            return '<div class="pf-stat"><span>' + c[0] + '</span><small>' + c[1] + '</small></div>';
        }).join("");

        var max = Math.max.apply(null, v.days7.map(function (d) { return d.n; }).concat(1));
        $("bars").innerHTML = v.days7.map(function (d) {
            return '<div><em>' + d.n + '</em><i style="height:' + Math.round(d.n / max * 100) + '%"></i><span>' + d.label + '</span></div>';
        }).join("");

        var u = stats.user();
        $("accOut").hidden = !u;
        $("accIn").hidden = !!u;
        if (u) $("accEmail").textContent = u.email;
        if (!stats.available()) {
            say("accMsg", "Trang này chưa kết nối được Firebase. Kiểm tra JS/net/firebase-config.js.", false);
            $("accGo").disabled = true;
        }
    }
    stats.onChange(render);


    /* ---------- hồ sơ ---------- */
    $("pfSave").addEventListener("click", function () {
        var n = player() && player().setName($("pfNameIn").value);
        if (!n) { say("pfSaveMsg", "Tên không được để trống.", false); return; }
        stats.setBio($("pfBioIn").value);
        stats.sync();
        render();
        say("pfSaveMsg", "Đã lưu hồ sơ.", true);
    });


    /* ---------- tài khoản ---------- */
    function setMode(m) {
        mode = m;
        $("modeReg").setAttribute("aria-pressed", m === "reg");
        $("modeLog").setAttribute("aria-pressed", m === "log");
        $("accGo").textContent = m === "reg" ? "Tạo tài khoản" : "Đăng nhập";
        $("accPass").autocomplete = m === "reg" ? "new-password" : "current-password";
        $("accNote").hidden = m !== "reg";
        say("accMsg", "", false);
    }
    $("modeReg").addEventListener("click", function () { setMode("reg"); });
    $("modeLog").addEventListener("click", function () { setMode("log"); });

    $("accGo").addEventListener("click", function () {
        var mail = $("accMail").value.trim(), pass = $("accPass").value;
        if (!mail || !pass) { say("accMsg", "Nhập đủ email và mật khẩu.", false); return; }
        $("accGo").disabled = true;
        say("accMsg", "Đang xử lý...", true);
        (mode === "reg" ? stats.signUp(mail, pass) : stats.signIn(mail, pass))
            .then(function () { $("accPass").value = ""; say("accMsg", "", false); })
            ["catch"](function (e) { say("accMsg", stats.errorText(e), false); })
            .then(function () { $("accGo").disabled = !stats.available(); });
    });
    [$("accMail"), $("accPass")].forEach(function (el) {
        el.addEventListener("keydown", function (e) { if (e.key === "Enter") $("accGo").click(); });
    });

    $("accLogout").addEventListener("click", function () {
        stats.signOut()["catch"](function (e) { say("accOutMsg", stats.errorText(e), false); });
    });
    $("accDelete").addEventListener("click", function () {
        if (!confirm("Xóa tài khoản " + stats.user().email + " và toàn bộ dữ liệu đã đồng bộ? Việc này không thể hoàn tác.")) return;
        stats.deleteAccount()["catch"](function (e) { say("accOutMsg", stats.errorText(e), false); });
    });


    /* ---------- khởi động ---------- */
    var start = location.hash.replace("#", "");
    openTab(TABS.indexOf(start) >= 0 ? start : "profile");
    setMode("reg");
    render();
})();
