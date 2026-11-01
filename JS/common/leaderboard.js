/* ===========================================================
   leaderboard.js  (đặt ở JS/common/leaderboard.js)
   Bảng xếp hạng CỘNG DỒN: mỗi người có tổng điểm và tổng thời gian đã chơi
   ở từng trò chơi, cộng thêm "Bảng thi đua" gộp 4 trò (WORDHUNT, WORDPUZZLE,
   WORDCHAIN, HANGMAN). LEARN có bảng riêng, không tính vào thi đua.

   Dữ liệu ở Firebase: leaderboard/<bảng>/<uid> = { name, score, time, plays, at, best?, ids }
     score = tổng điểm · time = tổng giây đã chơi · plays = số ván
     best  = (chỉ WORDCHAIN) chuỗi đúng liên tiếp dài nhất, dùng để suy ra RANK cao nhất
     ids   = mã các ván gần nhất đã cộng, để gửi lại không bị cộng đôi

   XẾP HẠNG: tổng điểm cao hơn xếp trên. Thời gian chỉ để hiển thị, KHÔNG ảnh hưởng.
   Bằng điểm thì ai đạt mức điểm đó trước xếp trên.

   GỬI MỘT VÁN (gọi một lần khi hết ván):
       normaBoard.submit("wordhunt",   { score: 120, secs: 60 });
       normaBoard.submit("wordpuzzle", { score: 950, secs: 140 });
       normaBoard.submit("hangman",    { score: 7,   secs: 180 });
       normaBoard.submit("wordchain",  { score: 25,  secs: 300, streak: 12 });
       normaBoard.submit("learn",      { score: 32,  secs: 240 });

   HIỂN THỊ: đặt <div id="leaderboard"></div> ở trang, file này tự dựng bảng.
   Cần CSS/leaderboard.css. Điểm do trình duyệt gửi lên nên chỉ chặn được mức
   tăng quá lớn mỗi ván (xem firebase-rules.json), không chống gian lận hoàn toàn.
   =========================================================== */
(function () {
    "use strict";
    if (window.normaBoard) return;

    var SCRIPT_SRC = document.currentScript && document.currentScript.src;
    var PENDING_KEY = "normafix.boardPending2";
    var SHOW = 10;              // số dòng hiển thị
    var FETCH = 40;             // số dòng lấy về để xếp lại và tìm hạng của bạn
    var KEEP_IDS = 30;          // số mã ván gần nhất giữ lại để chống cộng đôi
    var MAX_SECS = 14400;       // một ván tối đa 4 giờ
    var COMPETE = ["wordhunt", "wordpuzzle", "wordchain", "hangman"];   // các trò tính vào Bảng thi đua

    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function round1(v) { return Math.round(v * 10) / 10; }

    /* ---------- cấu hình từng bảng ---------- */
    var GAMES = {
        all: {
            icon: "🏁", name: "Thi đua",
            metric: "Bảng thi đua: tổng điểm của WORDHUNT, WORDPUZZLE, WORDCHAIN và HANGMAN. Thời gian chỉ để xem, không ảnh hưởng thứ hạng.",
            play: "WORDHUNT, WORDPUZZLE, WORDCHAIN hoặc HANGMAN"
        },
        wordhunt: {
            icon: "🔍", name: "WORDHUNT", maxPlay: 5000,
            metric: "Tổng điểm đã chơi ở WORDHUNT. Thời gian chỉ để xem."
        },
        wordpuzzle: {
            icon: "🧩", name: "WORDPUZZLE", maxPlay: 20000,
            metric: "Tổng điểm đã chơi ở WORDPUZZLE. Thời gian chỉ để xem."
        },
        hangman: {
            icon: "❓", name: "HANGMAN", maxPlay: 10,
            metric: "Tổng điểm (số từ đoán đúng) ở HANGMAN. Thời gian chỉ để xem."
        },
        wordchain: {
            icon: "🔗", name: "WORDCHAIN", maxPlay: 5000, hasBest: true,
            metric: "Tổng điểm đã chơi ở WORDCHAIN, kèm RANK cao nhất đã đạt. Thời gian chỉ để xem."
        },
        learn: {
            icon: "🎓", name: "LEARN", maxPlay: 40,
            metric: "Tổng số câu đúng ở LEARN. Thời gian chỉ để xem (không tính vào Bảng thi đua)."
        }
    };
    var ORDER = ["all", "wordhunt", "wordpuzzle", "hangman", "wordchain", "learn"];


    /* ---------- định dạng ---------- */
    function scoreText(v) { return round1(v).toLocaleString("vi-VN") + " điểm"; }
    function timeText(s) {
        s = Math.round(s || 0);
        if (s < 60) return s + "s";
        if (s < 3600) return Math.floor(s / 60) + "p" + pad(s % 60) + "s";
        return Math.floor(s / 3600) + "g " + pad(Math.floor(s % 3600 / 60)) + "p";
    }

    // RANK của WORDCHAIN suy ra từ chuỗi đúng liên tiếp dài nhất (giống getStreakTitle trong wordChain.js)
    var TITLES = ["GOOD", "NICE", "GREAT", "CRAZY", "AMAZING", "INSANE", "MASTER", "UNSTOPPABLE", "PHENOMENAL",
        "ASCENDANT", "TRANSCENDENT", "SUPREME", "ULTIMATE", "UNKNOWN", "SUPER", "EPIC", "LEGENDARY", "MYTHICAL",
        "IMMORTAL", "GODLIKE", "ANCIENT", "DIVINE", "CELESTIAL", "ETHEREAL", "COSMIC", "INFINITE", "ETERNAL",
        "SIGMA", "MEME", "ULTRA", "OMEGA", "ALPHA", "BETA", "GAMMA", "GAMER", "PRO", "ELITE", "HERO", "AURA",
        "NOVA", "ZENITH", "NEXUS", "ELECTRON", "QUANTUM", "NEBULA", "GALAXY", "SUPERNOVA", "ASTRAL"];
    var LEVEL_SIZE = 15;
    function streakRank(streak) {
        if (!streak || streak < 3) return "chưa có rank";
        if (streak >= 10000) return "GOD";
        if (streak >= 1000) return "IMMORTAL";
        if (streak >= 500) return "LEGEND";
        var level = Math.floor(streak / LEVEL_SIZE) + 1;
        return "LEVEL " + level + " • " + (TITLES[level - 1] || "ULTIMATE");
    }

    function metaText(game, r) {
        var plays = r.plays + " ván";
        return game === "wordchain" ? "🏅 " + streakRank(r.best) + " · " + plays : plays;
    }


    /* ---------- tiện ích nạp file ---------- */
    function url(rel) { try { return new URL(rel, SCRIPT_SRC).href; } catch (e) { return ""; } }
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (!src) { reject(new Error("thiếu đường dẫn")); return; }
            var s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error("không tải được " + src)); };
            document.head.appendChild(s);
        });
    }
    function ensureStats() {
        if (window.normaStats) return Promise.resolve(window.normaStats);
        return loadScript(url("stats.js")).then(
            function () { return window.normaStats || null; },
            function () { return null; }
        );
    }

    var dbP = null;
    function getDb() {
        if (dbP) return dbP;
        dbP = ensureStats().then(function (st) {
            if (!st) return null;
            return st.ready().then(function () {
                return st.available() && window.firebase && window.firebase.database ? window.firebase.database() : null;
            });
        });
        dbP.then(function (d) { if (!d) dbP = null; });      // chưa có thì lần sau thử lại
        return dbP;
    }

    function myUid() { var st = window.normaStats; return st && st.uid ? st.uid() : ""; }
    // Tên người chơi: ưu tiên normaPlayer (user.js); trang game không nạp user.js thì đọc thẳng
    // từ localStorage, cùng khóa mà user.js dùng để lưu tên.
    function playerName() {
        var n = "";
        try { n = window.normaPlayer && window.normaPlayer.getName ? window.normaPlayer.getName() : ""; } catch (e) { /* bỏ qua */ }
        if (!n) { try { n = localStorage.getItem("normafix.playerName") || ""; } catch (e) { /* bỏ qua */ } }
        return (n || "Ẩn danh").slice(0, 30);
    }
    function asArr(x) {
        if (Array.isArray(x)) return x.filter(function (v) { return v != null; });
        if (x && typeof x === "object") return Object.keys(x).sort(function (a, b) { return a - b; }).map(function (k) { return x[k]; });
        return [];
    }


    /* ---------- gửi một ván (có hàng đợi để mất mạng không mất điểm) ---------- */
    var flushing = false;
    function loadPending() {
        try { var r = JSON.parse(localStorage.getItem(PENDING_KEY)); return Array.isArray(r) ? r : []; }
        catch (e) { return []; }
    }
    function savePending(list) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) { /* bỏ qua */ } }

    function submit(game, data) {
        var cfg = GAMES[game];
        if (!cfg || !cfg.maxPlay || !data) return Promise.resolve(false);
        var score = Number(data.score), secs = Number(data.secs), streak = Number(data.streak);
        if (!isFinite(score) || score < 0) score = 0;
        if (!isFinite(secs) || secs < 0) secs = 0;
        if (!isFinite(streak) || streak < 0) streak = 0;
        if (score <= 0 && secs <= 0) return Promise.resolve(false);

        var rec = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            game: game,
            score: round1(Math.min(score, cfg.maxPlay)),
            secs: Math.min(Math.round(secs), MAX_SECS),
            streak: Math.min(Math.round(streak), 1000000),
            at: Date.now(), fails: 0
        };
        var list = loadPending();
        list.push(rec);
        savePending(list);
        return flush().then(function () { return true; });
    }

    // Cộng ván vào một bảng; nếu mã ván đã được cộng rồi thì bỏ qua (gửi lại không bị cộng đôi)
    function apply(db, path, uid, name, rec, withBest) {
        return db.ref(path + "/" + uid).transaction(function (old) {
            var o = old && typeof old === "object" ? old : null;
            var ids = o ? asArr(o.ids) : [];
            if (ids.indexOf(rec.id) >= 0) return;
            var next = {
                name: name,
                score: round1((o && o.score || 0) + rec.score),
                time: Math.round((o && o.time || 0) + rec.secs),
                plays: (o && o.plays || 0) + 1,
                at: rec.at,
                ids: ids.concat(rec.id).slice(-KEEP_IDS)
            };
            if (withBest) next.best = Math.max(o && o.best || 0, rec.streak);
            return next;
        });
    }

    function pushOne(db, uid, name, rec) {
        var cfg = GAMES[rec.game];
        var jobs = [apply(db, "leaderboard/" + rec.game, uid, name, rec, !!cfg.hasBest)];
        if (COMPETE.indexOf(rec.game) >= 0) jobs.push(apply(db, "leaderboard/all", uid, name, rec, false));
        return Promise.all(jobs);
    }

    function flush() {
        if (flushing) return Promise.resolve();
        var list = loadPending();
        if (!list.length) return Promise.resolve();
        flushing = true;
        return getDb().then(function (db) {
            var uid = myUid();
            if (!db || !uid) return;               // chưa đăng nhập được: giữ lại, thử sau
            var name = playerName(), done = {}, failed = {};
            return list.reduce(function (chain, rec) {
                return chain.then(function () {
                    return pushOne(db, uid, name, rec).then(
                        function () { done[rec.id] = 1; },
                        function (e) { failed[rec.id] = 1; console.error("Bảng xếp hạng:", e); }
                    );
                });
            }, Promise.resolve()).then(function () {
                savePending(loadPending().filter(function (r) {
                    if (done[r.id]) return false;
                    if (failed[r.id]) { r.fails = (r.fails || 0) + 1; return r.fails < 5; }
                    return true;
                }));
                if (Object.keys(done).length) refreshMounted();
            });
        })["catch"](function (e) { console.error("Bảng xếp hạng:", e); })
          .then(function () { flushing = false; });
    }


    /* ---------- đọc bảng ---------- */
    function top(game) {
        if (!GAMES[game]) return Promise.resolve({ rows: [], error: "unknown" });
        return getDb().then(function (db) {
            if (!db) return { rows: [], error: "offline" };
            return db.ref("leaderboard/" + game).orderByChild("score").limitToLast(FETCH).once("value").then(function (snap) {
                var rows = [];
                snap.forEach(function (ch) {
                    var v = ch.val();
                    if (v && typeof v.score === "number" && v.score > 0) {
                        rows.push({
                            uid: ch.key, name: v.name || "Ẩn danh", score: v.score,
                            time: v.time || 0, plays: v.plays || 0, best: v.best || 0, at: v.at || 0
                        });
                    }
                });
                // điểm cao xếp trên; bằng điểm thì ai đạt trước xếp trên (thời gian chơi không ảnh hưởng)
                rows.sort(function (a, b) { return b.score - a.score || a.at - b.at; });
                return { rows: rows };
            });
        })["catch"](function (e) { console.error("Bảng xếp hạng:", e); return { rows: [], error: "fail" }; });
    }


    /* ---------- giao diện ---------- */
    var mounted = null;
    function refreshMounted() { if (mounted) mounted.refresh(); }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function mount(root) {
        if (!root || root.__lb) return;
        root.__lb = true;
        root.classList.add("lb");

        var head = el("div", "lb-head");
        head.appendChild(el("h3", null, "🏆 Bảng xếp hạng"));
        var rf = el("button", "lb-refresh", "↻");
        rf.type = "button";
        rf.title = "Làm mới";
        rf.setAttribute("aria-label", "Làm mới bảng xếp hạng");
        head.appendChild(rf);

        var tabs = el("div", "lb-tabs");
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "Chọn bảng xếp hạng");
        var metric = el("p", "lb-metric");
        var list = el("ol", "lb-list");
        list.setAttribute("aria-live", "polite");
        var me = el("p", "lb-me");

        [head, tabs, metric, list, me].forEach(function (n) { root.appendChild(n); });

        var current = "all", token = 0, lastUid = "";

        ORDER.forEach(function (g) {
            var b = el("button", "lb-tab", GAMES[g].icon + " " + GAMES[g].name);
            b.type = "button";
            b.setAttribute("role", "tab");
            b.setAttribute("data-game", g);
            b.addEventListener("click", function () { select(g); });
            tabs.appendChild(b);
        });

        function select(g) {
            current = g;
            Array.prototype.forEach.call(tabs.children, function (b) {
                b.setAttribute("aria-selected", b.getAttribute("data-game") === g ? "true" : "false");
            });
            load();
        }

        function skeleton() {
            list.innerHTML = "";
            for (var i = 0; i < 5; i++) list.appendChild(el("li", "lb-row skel"));
            me.textContent = "";
        }

        function row(r, rank, g, mine) {
            var li = el("li", "lb-row" + (rank <= 3 ? " top" + rank : "") + (mine ? " me" : ""));
            li.appendChild(el("span", "lb-rank", rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank)));
            var who = el("span", "lb-who");
            who.appendChild(el("b", "lb-name", r.name + (mine ? " (bạn)" : "")));
            who.appendChild(el("small", "lb-meta", metaText(g, r)));
            li.appendChild(who);
            var val = el("span", "lb-val");
            val.appendChild(el("b", "lb-score", scoreText(r.score)));
            val.appendChild(el("small", "lb-sub", "⏱ " + timeText(r.time)));
            li.appendChild(val);
            return li;
        }

        function render(g, res) {
            var cfg = GAMES[g], uid = myUid();
            list.innerHTML = "";
            me.textContent = "";

            if (res.error) {
                list.appendChild(el("li", "lb-empty", "Chưa kết nối được bảng xếp hạng. Bấm ↻ để thử lại nhé."));
                return;
            }
            if (!res.rows.length) {
                list.appendChild(el("li", "lb-empty", "Chưa có ai trên bảng này. Hãy là người đầu tiên! 🎯"));
                return;
            }

            var mineIdx = -1;
            res.rows.forEach(function (r, i) { if (uid && r.uid === uid) mineIdx = i; });

            res.rows.slice(0, SHOW).forEach(function (r, i) { list.appendChild(row(r, i + 1, g, i === mineIdx)); });
            if (mineIdx >= SHOW) {
                list.appendChild(el("li", "lb-dots", "···"));
                list.appendChild(row(res.rows[mineIdx], mineIdx + 1, g, true));
            }

            if (mineIdx >= 0) {
                var m = res.rows[mineIdx];
                me.textContent = "Bạn đang đứng hạng " + (mineIdx + 1) + " · " + scoreText(m.score) + " · " + timeText(m.time);
            } else {
                me.textContent = "Bạn chưa có điểm ở bảng này. Vào chơi " + (cfg.play || cfg.name) + " để lên bảng!";
            }
        }

        function load() {
            var g = current, mine = ++token;
            metric.textContent = GAMES[g].metric;
            skeleton();
            top(g).then(function (res) { if (mine === token) render(g, res); });
        }

        rf.addEventListener("click", load);

        mounted = { refresh: load };
        lastUid = myUid();
        select("all");

        // làm mới định kỳ khi tab đang mở; và khi vừa đăng nhập xong (để đánh dấu "bạn")
        setInterval(function () { if (!document.hidden) load(); }, 90000);
        ensureStats().then(function (st) {
            if (!st || !st.onChange) return;
            st.onChange(function () {
                if (loadPending().length) flush();
                var u = myUid();
                if (u !== lastUid) { lastUid = u; load(); }
            });
        });
    }


    /* ---------- khởi động ---------- */
    function init() {
        mount(document.getElementById("leaderboard"));
        if (loadPending().length) flush();           // gửi nốt điểm còn kẹt từ lần trước
    }

    window.normaBoard = { submit: submit, top: top, mount: mount, games: GAMES, streakRank: streakRank };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();