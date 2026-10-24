/* ===========================================================
   stats.js - Thống kê, thành tựu và tài khoản (Firebase Auth + Realtime Database)
   - Luôn lưu cục bộ (localStorage) nên chơi không cần tài khoản.
   - Có đăng nhập thì gộp dữ liệu và đồng bộ lên users/<uid>.
   - Chỉ bật phần tài khoản khi trang có nạp firebase-app/auth/database (compat)
     và JS/net/firebase-config.js; trang khác vẫn đếm thống kê cục bộ.
   Dùng: normaStats.recordGame({ total, max })  (gọi khi hết ván)
   =========================================================== */
(function () {
    "use strict";

    var KEY = "normafix.stats.v1";
    var NUM = ["games", "correct", "total", "perfect", "best", "seconds"];

    var ACH = [
        { id: "name",    icon: "👋", title: "Làm quen",         desc: "Đặt tên cho mình",               ok: function () { return !!playerName(); } },
        { id: "bio",     icon: "✍️", title: "Có điều để kể",    desc: "Viết phần giới thiệu trong hồ sơ", ok: function (s) { return s.bio.trim().length > 0; } },
        { id: "game1",   icon: "🎮", title: "Ván đầu tiên",     desc: "Hoàn thành 1 ván học",           ok: function (s) { return s.games >= 1; } },
        { id: "game10",  icon: "📚", title: "Chăm chỉ",         desc: "Hoàn thành 10 ván",              ok: function (s) { return s.games >= 10; } },
        { id: "perfect", icon: "🏆", title: "Hoàn hảo",         desc: "Trả lời đúng mọi câu trong một ván", ok: function (s) { return s.perfect >= 1; } },
        { id: "best90",  icon: "🧠", title: "Trí nhớ tốt",      desc: "Đạt từ 90% trở lên trong một ván", ok: function (s) { return s.best >= 90; } },
        { id: "ans100",  icon: "💯", title: "100 câu đúng",     desc: "Trả lời đúng tổng cộng 100 câu", ok: function (s) { return s.correct >= 100; } },
        { id: "streak3", icon: "🔥", title: "Ba ngày liền",     desc: "Học 3 ngày liên tiếp",           ok: function () { return streak() >= 3; } },
        { id: "time30",  icon: "⏱️", title: "Bền bỉ",           desc: "Ở lại học tổng cộng 30 phút",    ok: function (s) { return s.seconds >= 1800; } },
        { id: "account", icon: "🔐", title: "Có chỗ đứng",      desc: "Đăng ký tài khoản",              ok: function () { return !!cur; } }
    ];

    var ERR = {
        "auth/invalid-email": "Email không hợp lệ.",
        "auth/email-already-in-use": "Email này đã có tài khoản. Hãy đăng nhập.",
        "auth/weak-password": "Mật khẩu cần ít nhất 6 ký tự.",
        "auth/invalid-credential": "Sai email hoặc mật khẩu.",
        "auth/user-not-found": "Sai email hoặc mật khẩu.",
        "auth/wrong-password": "Sai email hoặc mật khẩu.",
        "auth/too-many-requests": "Thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.",
        "auth/network-request-failed": "Không kết nối được mạng. Kiểm tra kết nối rồi thử lại.",
        "auth/operation-not-allowed": "Chưa bật đăng nhập Email/Password trong Firebase Console.",
        "auth/requires-recent-login": "Hãy đăng xuất, đăng nhập lại rồi xóa tài khoản.",
        "PERMISSION_DENIED": "Firebase từ chối ghi dữ liệu. Kiểm tra lại Rules cho users/<uid>."
    };

    var S = load();
    var cur = null, auth = null, db = null, pushT = 0, ticks = 0;
    var listeners = [];


    /* ---------- lưu / đọc cục bộ ---------- */
    function blank() {
        return { bio: "", joined: Date.now(), games: 0, correct: 0, total: 0, perfect: 0, best: 0, seconds: 0, days: {}, unlocked: {} };
    }
    function load() {
        try {
            var r = JSON.parse(localStorage.getItem(KEY));
            if (r && typeof r === "object") return Object.assign(blank(), r);
        } catch (e) { /* bỏ qua */ }
        return blank();
    }
    function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* bỏ qua */ } }
    function persist() { checkAch(); saveLocal(); push(false); emit(); }
    function emit() { listeners.forEach(function (cb) { try { cb(); } catch (e) { console.error(e); } }); }

    function playerName() { return window.normaPlayer ? window.normaPlayer.getName() : ""; }
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

    function streak() {
        var n = 0, d = new Date();
        if (!S.days[dayKey(d)]) d.setDate(d.getDate() - 1);
        while (S.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
        return n;
    }


    /* ---------- thành tựu ---------- */
    function toast(a) {
        var el = document.createElement("div");
        el.setAttribute("role", "status");
        el.textContent = a.icon + " Mở khóa thành tựu: " + a.title;
        el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10001;" +
            "padding:12px 22px;border-radius:999px;background:#0E3850;color:#fff;" +
            "font:700 17px 'Baloo 2','Trebuchet MS',Arial,sans-serif;box-shadow:0 8px 0 rgba(14,56,80,.28)";
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 3200);
    }
    function checkAch() {
        ACH.forEach(function (a) {
            if (!S.unlocked[a.id] && a.ok(S)) {
                S.unlocked[a.id] = Date.now();
                if (document.body) toast(a);
            }
        });
    }


    /* ---------- ghi nhận ---------- */
    function recordGame(r) {
        var total = Math.max(0, +r.total || 0), max = Math.max(0, +r.max || 0);
        if (!max) return;
        var pct = Math.round(total / max * 100);
        S.games++; S.correct += total; S.total += max;
        if (total === max) S.perfect++;
        S.best = Math.max(S.best, pct);
        var k = dayKey();
        S.days[k] = (S.days[k] || 0) + 1;
        persist();
    }

    function setBio(text) { S.bio = String(text || "").slice(0, 200); persist(); }

    // Đếm thời gian khi tab đang mở
    setInterval(function () {
        if (document.hidden) return;
        S.seconds += 10;
        if (++ticks % 6 === 0) persist(); else saveLocal();
    }, 10000);


    /* ---------- Firebase: đăng nhập + đồng bộ ---------- */
    function payload() {
        var p = { name: playerName(), bio: S.bio, joined: S.joined, days: S.days, unlocked: S.unlocked };
        NUM.forEach(function (k) { p[k] = S[k]; });
        return p;
    }

    function push(now) {
        if (!cur || !db) return;
        clearTimeout(pushT);
        var go = function () {
            db.ref("users/" + cur.uid).update(payload())["catch"](function (e) { console.error("Firebase:", e); });
        };
        if (now) go(); else pushT = setTimeout(go, 1200);
    }

    // Gộp dữ liệu máy này với dữ liệu trên tài khoản: lấy giá trị lớn hơn, giữ cả hai bên thành tựu
    function merge(c) {
        NUM.forEach(function (k) { S[k] = Math.max(S[k] || 0, +c[k] || 0); });
        Object.keys(c.days || {}).forEach(function (d) { S.days[d] = Math.max(S.days[d] || 0, c.days[d]); });
        Object.keys(c.unlocked || {}).forEach(function (id) {
            S.unlocked[id] = Math.min(S.unlocked[id] || Infinity, c.unlocked[id]);
        });
        if (!S.bio && c.bio) S.bio = c.bio;
        if (c.joined) S.joined = Math.min(S.joined, c.joined);
        if (c.name && window.normaPlayer && window.normaPlayer.setName) window.normaPlayer.setName(c.name);
    }

    function onUser(u) {
        cur = u;
        if (!u) { emit(); return; }
        db.ref("users/" + u.uid).once("value").then(function (snap) {
            merge(snap.val() || {});
            checkAch(); saveLocal(); push(true); emit();
        })["catch"](function (e) { console.error("Firebase:", e); emit(); });
    }

    function initFirebase() {
        var fb = window.firebase;
        if (!fb || !fb.auth || !fb.database || !window.FIREBASE_CONFIG) return;
        try {
            if (!fb.apps.length) fb.initializeApp(window.FIREBASE_CONFIG);
            auth = fb.auth(); db = fb.database();
            auth.onAuthStateChanged(onUser);
        } catch (e) { console.error("Firebase:", e); auth = null; db = null; }
    }

    function resetLocal() { S = blank(); saveLocal(); emit(); }

    function needAuth() { return auth ? null : Promise.reject({ code: "NO_FIREBASE", message: "Trang này chưa nạp Firebase." }); }

    window.normaStats = {
        ACH: ACH,
        available: function () { return !!auth; },
        user: function () { return cur; },
        onChange: function (cb) { listeners.push(cb); },
        recordGame: recordGame,
        setBio: setBio,
        sync: persist,
        signUp: function (e, p) { return needAuth() || auth.createUserWithEmailAndPassword(e, p); },
        signIn: function (e, p) { return needAuth() || auth.signInWithEmailAndPassword(e, p); },
        signOut: function () { return needAuth() || auth.signOut().then(resetLocal); },
        deleteAccount: function () {
            if (needAuth()) return needAuth();
            var u = cur;
            return db.ref("users/" + u.uid).remove().then(function () { return u["delete"](); }).then(resetLocal);
        },
        errorText: function (e) {
            return ERR[e && e.code] || (e && e.code === "NO_FIREBASE" ? e.message : "Có lỗi xảy ra (" + ((e && (e.code || e.message)) || "không rõ") + ").");
        },
        view: function () {
            var days7 = [];
            for (var i = 6; i >= 0; i--) {
                var d = new Date(); d.setDate(d.getDate() - i);
                days7.push({ label: d.getDate() + "/" + (d.getMonth() + 1), n: S.days[dayKey(d)] || 0 });
            }
            return {
                games: S.games, correct: S.correct, total: S.total, best: S.best, seconds: S.seconds,
                accuracy: S.total ? Math.round(S.correct / S.total * 100) : 0,
                streak: streak(), bio: S.bio, joined: S.joined, unlocked: S.unlocked, days7: days7,
                level: Math.floor(S.correct / 50) + 1, levelProgress: (S.correct % 50) / 50
            };
        }
    };

    function init() { checkAch(); saveLocal(); initFirebase(); emit(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
