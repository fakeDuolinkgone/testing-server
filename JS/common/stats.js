/* ===========================================================
   stats.js - Thống kê, thành tựu và tài khoản (Firebase Auth + Realtime Database)

   Mọi người chơi đều có chỗ lưu trên Firebase (users/<uid>):
     - Đã đăng ký     -> tài khoản Email/Password
     - Chế độ khách   -> đăng nhập ẩn danh (Anonymous), cũng có uid riêng
   Khách đăng ký sau thì tài khoản ẩn danh được NÂNG CẤP lên email
   (giữ nguyên uid nên không mất dữ liệu).

   - Luôn lưu cục bộ (localStorage) nên chơi offline vẫn được, có mạng sẽ đồng bộ.
   - Tự nạp Firebase SDK và JS/net/firebase-config.js nếu trang chưa nạp.
   - Người đã có tên mà chưa có tài khoản sẽ tự vào chế độ khách để vẫn lưu được.
   - Người mới hoàn toàn: chờ chọn "Đăng ký / Khách" ở màn onboarding.js.

   Dùng: normaStats.recordGame({ total, max })  (gọi khi hết ván)
   =========================================================== */
(function () {
    "use strict";
    if (window.normaStats) return;      // đã nạp rồi (user.js / onboarding.js có thể nạp trước)

    var SCRIPT_SRC = document.currentScript && document.currentScript.src;   // để tìm ../net/firebase-config.js
    var KEY = "normafix.stats.v1";
    var NUM = ["games", "correct", "total", "perfect", "best", "seconds"];

    var ACH = [
        { id: "name",    icon: "👋", title: "Chào mừng!",         desc: "Đặt tên cho mình",               ok: function () { return !!playerName(); } },
        { id: "bio",     icon: "✍️", title: "Có điều để kể",    desc: "Viết phần giới thiệu trong hồ sơ", ok: function (s) { return s.bio.trim().length > 0; } },
        { id: "game1",   icon: "🎮", title: "Lần đầu tiên.. trái thanh long!?",     desc: "Hoàn thành 1 ván học",           ok: function (s) { return s.games >= 1; } },
        { id: "game10",  icon: "📚", title: "Hmm.. chưa hẳn là mê",         desc: "Hoàn thành 10 ván",              ok: function (s) { return s.games >= 10; } },
        { id: "perfect", icon: "🏆", title: "Hoàn hảo",         desc: "Trả lời đúng mọi câu trong một ván", ok: function (s) { return s.perfect >= 1; } },
        { id: "best90",  icon: "🧠", title: "Não to hơn vật",      desc: "Đạt từ 90% trở lên trong một ván", ok: function (s) { return s.best >= 90; } },
        { id: "ans100",  icon: "💯", title: "Tên này khá đấy chứ!",     desc: "Trả lời đúng tổng cộng 100 câu", ok: function (s) { return s.correct >= 100; } },
        { id: "streak3", icon: "🔥", title: "Lên chuỗi nè",     desc: "Học 3 ngày liên tiếp",           ok: function () { return streak() >= 3; } },
        { id: "time30",  icon: "⏱️", title: "Afk hay chăm chỉ?",           desc: "Ở lại học tổng cộng 30 phút",    ok: function (s) { return s.seconds >= 1800; } },
        { id: "account", icon: "🔐", title: "Có chỗ đứng",      desc: "Đăng ký tài khoản",              ok: function () { return isAccount(); } }
    ];

    var ERR = {
        "auth/invalid-email": "Email không hợp lệ.",
        "auth/email-already-in-use": "Email này đã có tài khoản. Hãy đăng nhập.",
        "auth/credential-already-in-use": "Email này đã có tài khoản. Hãy đăng nhập.",
        "auth/weak-password": "Mật khẩu cần ít nhất 6 ký tự.",
        "auth/invalid-credential": "Sai email hoặc mật khẩu.",
        "auth/user-not-found": "Sai email hoặc mật khẩu.",
        "auth/wrong-password": "Sai email hoặc mật khẩu.",
        "auth/too-many-requests": "Thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.",
        "auth/network-request-failed": "Không kết nối được mạng. Kiểm tra kết nối rồi thử lại.",
        "auth/operation-not-allowed": "Chưa bật đăng nhập trong Firebase Console (Email/Password hoặc Anonymous).",
        "auth/admin-restricted-operation": "Chưa bật đăng nhập Ẩn danh (Anonymous) trong Firebase Console.",
        "auth/requires-recent-login": "Hãy đăng xuất, đăng nhập lại rồi xóa tài khoản.",
        "PERMISSION_DENIED": "Firebase từ chối ghi dữ liệu. Kiểm tra lại Rules cho users/<uid>."
    };

    var S = load();
    var cur = null, auth = null, db = null, pushT = 0, ticks = 0;
    var guestTried = false;          // đã thử tự vào chế độ khách chưa
    var synced = {};                 // uid -> đã gộp xong dữ liệu với Firebase
    var firebaseStatus = "Đang kiểm tra kết nối Firebase...";
    var listeners = [];
    var readyResolve = null;
    var readyP = new Promise(function (r) { readyResolve = r; });


    /* ---------- lưu / đọc cục bộ ---------- */
    function blank() {
        return { bio: "", joined: Date.now(), games: 0, correct: 0, total: 0, perfect: 0, best: 0, seconds: 0, days: {}, unlocked: {}, placement: null };
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
    function isAccount() { return !!cur && !cur.isAnonymous; }      // tài khoản email thật (không phải khách)
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

    // Kết quả bài kiểm tra đầu vào (làm ở màn onboarding)
    function setPlacement(score, total) {
        score = Math.max(0, Math.round(+score || 0));
        total = Math.max(0, Math.round(+total || 0));
        if (!total) return;
        S.placement = { score: Math.min(score, total), total: total, at: Date.now() };
        persist();
    }

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
        if (S.placement) p.placement = S.placement;
        return p;
    }

    function push(now) {
        if (!cur || !db) return;
        clearTimeout(pushT);
        var go = function () {
            if (!cur) return;
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
        if (c.placement && (!S.placement || (c.placement.at || 0) > (S.placement.at || 0))) S.placement = c.placement;
        if (c.name && window.normaPlayer && window.normaPlayer.setName) window.normaPlayer.setName(c.name);
    }

    function settle() {
        if (readyResolve) { readyResolve(!!auth); readyResolve = null; }
    }

    function signInGuest() {
        return auth.signInAnonymously()["catch"](function (e) {
            console.error("Firebase (chế độ khách):", e);
            firebaseStatus = "Không vào được chế độ khách: " + (ERR[e && e.code] || (e && (e.code || e.message)) || "không rõ");
            settle(); emit();
        });
    }

    function onUser(u) {
        cur = u;
        if (!u) {
            // Người đã có tên nhưng chưa có tài khoản: tự vào chế độ khách để dữ liệu vẫn được lưu.
            // Người mới hoàn toàn thì chờ họ chọn ở màn onboarding.
            if (!guestTried && playerName()) { guestTried = true; signInGuest(); return; }
            settle(); emit();
            return;
        }
        guestTried = true;
        var uid = u.uid;
        db.ref("users/" + uid).once("value").then(function (snap) {
            merge(snap.val() || {});
            checkAch(); saveLocal(); push(true);
        })["catch"](function (e) { console.error("Firebase:", e); })
        .then(function () { synced[uid] = true; settle(); emit(); });
    }

    function loadFirebaseScript(src) {
        return new Promise(function (resolve, reject) {
            var existing = Array.from(document.scripts).find(function (s) {
                return s.src === src && s.dataset.loaded === "true";
            });
            if (existing) { resolve(); return; }
            // Tạo thẻ mới để thử tải lại nếu thẻ script trong HTML trước đó bị lỗi.
            var script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.onload = function () { script.dataset.loaded = "true"; resolve(); };
            script.onerror = function () { reject(new Error("Không tải được: " + src)); };
            document.head.appendChild(script);
        });
    }

    // Trang chưa nạp firebase-config.js thì tự nạp (JS/common/stats.js -> JS/net/firebase-config.js)
    function ensureConfig() {
        if (window.FIREBASE_CONFIG || !SCRIPT_SRC) return Promise.resolve();
        var url;
        try { url = new URL("../net/firebase-config.js", SCRIPT_SRC).href; } catch (e) { return Promise.resolve(); }
        return loadFirebaseScript(url)["catch"](function () { /* thiếu file cấu hình: báo ở bước sau */ });
    }

    function initFirebase() {
        ensureConfig().then(function () {
            var cfg = window.FIREBASE_CONFIG;
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                firebaseStatus = "Thiếu cấu hình Firebase. Kiểm tra JS/net/firebase-config.js.";
                settle(); emit();
                return;
            }

            var base = "https://www.gstatic.com/firebasejs/10.14.1/";
            firebaseStatus = "Đang tải thư viện Firebase...";
            return Promise.resolve().then(function () {
                if (!window.firebase || !window.firebase.initializeApp) {
                    return loadFirebaseScript(base + "firebase-app-compat.js");
                }
            }).then(function () {
                if (!window.firebase || !window.firebase.auth) {
                    return loadFirebaseScript(base + "firebase-auth-compat.js");
                }
            }).then(function () {
                if (!window.firebase || !window.firebase.database) {
                    return loadFirebaseScript(base + "firebase-database-compat.js");
                }
            }).then(function () {
                var fb = window.firebase;
                if (!fb || !fb.initializeApp || !fb.auth || !fb.database) {
                    throw new Error("Thiếu Firebase App, Authentication hoặc Realtime Database SDK.");
                }
                if (!fb.apps.length) fb.initializeApp(cfg);
                auth = fb.auth();
                db = fb.database();
                if (!auth || !db) throw new Error("Không khởi tạo được Firebase Auth/Database.");
                firebaseStatus = "Đã khởi tạo Firebase. Đang kiểm tra trạng thái tài khoản...";
                auth.onAuthStateChanged(onUser, function (e) {
                    firebaseStatus = "Lỗi xác thực Firebase: " + (e && (e.message || e.code) || "không rõ");
                    console.error("Firebase Auth:", e);
                    settle(); emit();
                });
                emit();
            });
        })["catch"](function (e) {
            auth = null; db = null;
            firebaseStatus = "Không tải/khởi tạo được Firebase SDK. Kiểm tra kết nối mạng hoặc chặn CDN (gstatic.com). Chi tiết: " + (e.message || e);
            console.error("Firebase khởi tạo thất bại:", e);
            settle(); emit();
        });
    }

    function resetLocal() { S = blank(); saveLocal(); emit(); }

    // Chờ Firebase khởi tạo xong (tối đa 10 giây); trả về true nếu dùng được
    function whenReady() {
        return Promise.race([readyP, new Promise(function (r) { setTimeout(function () { r(false); }, 10000); })]);
    }
    function withAuth(fn) {
        return whenReady().then(function () {
            return auth ? fn() : Promise.reject({ code: "NO_FIREBASE", message: "Chưa kết nối được Firebase." });
        });
    }

    // Sau khi đăng xuất / xóa tài khoản: nếu người chơi còn tên thì vào lại chế độ khách (tài khoản ẩn danh mới)
    function backToGuest() {
        resetLocal();
        guestTried = false;
        if (playerName() && auth) { guestTried = true; signInGuest(); }
    }

    // Chờ dữ liệu của uid được gộp xong từ Firebase (dùng sau khi đăng nhập)
    function whenSynced(uid, maxMs) {
        return new Promise(function (resolve) {
            var t0 = Date.now();
            (function wait() {
                if (!uid || synced[uid] || Date.now() - t0 > (maxMs || 6000)) resolve();
                else setTimeout(wait, 100);
            })();
        });
    }

    window.normaStats = {
        ACH: ACH,
        available: function () { return !!auth; },
        connectionStatus: function () { return firebaseStatus; },
        ready: whenReady,
        user: function () { return isAccount() ? cur : null; },        // chỉ trả về tài khoản email thật
        isGuest: function () { return !!cur && cur.isAnonymous; },
        uid: function () { return cur ? cur.uid : ""; },
        onChange: function (cb) { listeners.push(cb); },
        recordGame: recordGame,
        setBio: setBio,
        setPlacement: setPlacement,
        sync: persist,
        whenSynced: whenSynced,

        // Vào chế độ khách: đăng nhập ẩn danh để dữ liệu vẫn được lưu lên Firebase
        startGuest: function () {
            return withAuth(function () {
                if (cur) return cur;
                guestTried = true;
                return auth.signInAnonymously().then(function (r) { return r.user; });
            });
        },

        // Đăng ký: nếu đang là khách thì nâng cấp tài khoản ẩn danh (giữ nguyên uid và dữ liệu)
        signUp: function (e, p) {
            return withAuth(function () {
                if (cur && cur.isAnonymous) {
                    var cred = window.firebase.auth.EmailAuthProvider.credential(e, p);
                    return cur.linkWithCredential(cred).then(function (res) {
                        cur = res.user;
                        checkAch(); saveLocal(); push(true); emit();
                        return res;
                    });
                }
                return auth.createUserWithEmailAndPassword(e, p);
            });
        },
        signIn: function (e, p) {
            return withAuth(function () { return auth.signInWithEmailAndPassword(e, p); });
        },
        signOut: function () {
            return withAuth(function () { return auth.signOut(); }).then(backToGuest);
        },
        deleteAccount: function () {
            return withAuth(function () {
                var u = cur;
                if (!u) return Promise.reject({ code: "NO_FIREBASE", message: "Chưa đăng nhập." });
                return db.ref("users/" + u.uid).remove().then(function () { return u["delete"](); });
            }).then(backToGuest);
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
                level: Math.floor(S.correct / 50) + 1, levelProgress: (S.correct % 50) / 50,
                placement: S.placement
            };
        }
    };

    function init() { checkAch(); saveLocal(); initFirebase(); emit(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
