/* ===========================================================
   boss-net.js - kết nối nhiều người chơi cho BossBattle

   Cách dùng (xem thêm JS/net/README.md):
     var net = BossNet.create();                       // dùng Firebase
     var net = await BossNet.createSolo({bots: 3});    // thử một mình với bot

   Bộ chuyển đổi (adapter) theo tài liệu luật v2:
     net.getPlayers()            net.onStageStart(cb)
     net.sendScore(stage, n)     net.onScoresUpdate(cb)
     net.onPlayerLeave(cb)
   Thêm vào để nối phòng và kết thúc ván:
     createRoom / joinRoom / resume / leaveRoom / startGame / sendDone
     onPlayersChange / onGameStart / onStageEnd / onGameEnd / onRoomClosed / onRemoved

   Cách chia việc: máy của chủ phòng (host) làm "trọng tài" - phát từ,
   chốt giai đoạn, tính thắng/thua. Host rớt mạng thì người vào sớm nhất
   còn lại tự nhận làm host.
   =========================================================== */
(function (root) {
    "use strict";

    var R = root.BossRules;
    if (!R) throw new Error("Hãy nạp boss-rules.js trước boss-net.js");

    var PID_KEY = "normafix.boss.pid";
    var SESSION_KEY = "normafix.boss.session";
    var DEFAULT_MODE = "bossBattle";   // phòng không chọn chế độ (test, bản thử một mình) thì chơi BossBattle
    var MODES = {};   // chế độ chơi đăng ký thêm: MODES[id] = { start(engine, room), tick(engine, room, now) }
    var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // bỏ chữ dễ nhầm: I, O, 0, 1


    /* ---------- tiện ích ---------- */
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    function fail(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
    function randomId() { return "p_" + Math.random().toString(36).slice(2, 10); }
    function randomCode() {
        var s = "";
        for (var i = 0; i < 6; i++) s += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
        return s;
    }
    function cleanName(raw) {
        var t = String(raw || "").replace(/\s+/g, " ").trim();
        return Array.from(t).slice(0, 20).join("") || "Người chơi";
    }
    function memoryStore() {
        var m = {};
        return {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
            setItem: function (k, v) { m[k] = String(v); },
            removeItem: function (k) { delete m[k]; }
        };
    }
    function sessionStore() {
        try { var s = root.sessionStorage; s.setItem("_t", "1"); s.removeItem("_t"); return s; }
        catch (e) { return memoryStore(); }
    }


    /* ===========================================================
       1. TRANSPORT: MemoryServer (chạy trong bộ nhớ, dùng cho bot và test)
       Cùng giao diện với FirebaseDB bên dưới nên engine không phân biệt.
       =========================================================== */
    function MemoryServer() {
        var tree = {}, listeners = [], pending = false;

        function parts(p) { return String(p).split("/").filter(Boolean); }

        function norm(v) {   // thay dấu thời gian của server, bỏ null và object rỗng (giống Firebase)
            if (v && typeof v === "object") {
                if (v[".sv"] === "timestamp") return Date.now();
                var out = {}, any = false;
                Object.keys(v).forEach(function (k) {
                    var x = norm(v[k]);
                    if (x !== null && x !== undefined) { out[k] = x; any = true; }
                });
                return any ? out : null;
            }
            return v === undefined ? null : v;
        }

        function getAt(p) {
            var n = tree, ps = parts(p);
            for (var i = 0; i < ps.length; i++) {
                if (n === null || typeof n !== "object") return null;
                n = n[ps[i]];
                if (n === undefined) return null;
            }
            return n;
        }

        function setAt(p, v) {
            var ps = parts(p);
            v = norm(v);
            if (!ps.length) { tree = v === null ? {} : v; return; }
            var chain = [tree], n = tree;
            for (var i = 0; i < ps.length - 1; i++) {
                var next = n[ps[i]];
                if (next === undefined || next === null || typeof next !== "object") {
                    if (v === null) return;
                    n[ps[i]] = {};
                }
                n = n[ps[i]];
                chain.push(n);
            }
            var last = ps[ps.length - 1];
            if (v === null) delete n[last]; else n[last] = v;
            for (var j = chain.length - 1; j > 0; j--) {          // dọn các nhánh rỗng
                if (Object.keys(chain[j]).length === 0) delete chain[j - 1][ps[j - 1]]; else break;
            }
        }

        function copy(v) { return v === null ? null : JSON.parse(JSON.stringify(v)); }

        function flush() {
            pending = false;
            listeners.slice().forEach(function (l) {
                if (l.dead) return;
                var json = JSON.stringify(getAt(l.path));
                if (json !== l.last) { l.last = json; l.cb(JSON.parse(json)); }
            });
        }
        function notify() { if (!pending) { pending = true; Promise.resolve().then(flush); } }

        this.connect = function () {
            var ops = {}, online = true;
            var c = {
                TS: { ".sv": "timestamp" },
                serverNow: function () { return Date.now(); },
                get: function (p) { return Promise.resolve(copy(getAt(p))); },
                set: function (p, v) { if (online) { setAt(p, v); notify(); } return Promise.resolve(); },
                update: function (p, o) {
                    if (online) {
                        Object.keys(o).forEach(function (k) { setAt(p + "/" + k, o[k]); });
                        notify();
                    }
                    return Promise.resolve();
                },
                remove: function (p) { return c.set(p, null); },
                transaction: function (p, fn) {
                    var cur = copy(getAt(p));
                    var next = fn(cur);
                    if (next === undefined || !online) return Promise.resolve({ committed: false, value: cur });
                    setAt(p, next); notify();
                    return Promise.resolve({ committed: true, value: copy(getAt(p)) });
                },
                listen: function (p, cb) {
                    if (p === ".info/connected") {
                        var live = true;
                        setTimeout(function () { if (live) cb(true); }, 0);
                        return function () { live = false; };
                    }
                    var l = { path: p, cb: cb, last: undefined, dead: false };
                    listeners.push(l); notify();
                    return function () { l.dead = true; var i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
                },
                onDisconnect: function (p, op) { ops[p] = op; return Promise.resolve(); },
                cancelDisconnect: function (p) { delete ops[p]; return Promise.resolve(); },
                disconnect: function () {      // giả lập đóng tab / mất mạng
                    if (!online) return;
                    online = false;
                    Object.keys(ops).forEach(function (p) {
                        var op = ops[p];
                        if (op.remove) setAt(p, null);
                        else if (op.update) Object.keys(op.update).forEach(function (k) { setAt(p + "/" + k, op.update[k]); });
                        else if ("set" in op) setAt(p, op.set);
                    });
                    ops = {};
                    notify();
                }
            };
            return c;
        };
        this.dump = function () { return copy(tree); };
    }


    /* ===========================================================
       2. TRANSPORT: Firebase Realtime Database (SDK bản compat)
       =========================================================== */
    function FirebaseDB(cfg) {
        var fb = root.firebase;
        if (!fb) throw fail("NO_SDK", "Chưa nạp Firebase SDK (firebase-app-compat.js và firebase-database-compat.js).");
        if (!isConfigured(cfg)) throw fail("NOT_CONFIGURED", "Chưa dán cấu hình Firebase vào JS/net/firebase-config.js.");

        if (!(fb.apps && fb.apps.length)) fb.initializeApp(cfg);
        var db = fb.database();
        var offset = 0;
        db.ref(".info/serverTimeOffset").on("value", function (s) { offset = s.val() || 0; });

        return {
            TS: fb.database.ServerValue.TIMESTAMP,
            serverNow: function () { return Date.now() + offset; },
            get: function (p) { return db.ref(p).once("value").then(function (s) { return s.val(); }); },
            set: function (p, v) { return db.ref(p).set(v); },
            update: function (p, o) { return db.ref(p).update(o); },
            remove: function (p) { return db.ref(p).remove(); },
            transaction: function (p, fn) {
                return db.ref(p).transaction(fn).then(function (r) { return { committed: r.committed, value: r.snapshot.val() }; });
            },
            listen: function (p, cb) {
                var ref = db.ref(p);
                var h = ref.on("value", function (s) { cb(s.val()); });
                return function () { ref.off("value", h); };
            },
            onDisconnect: function (p, op) {
                var d = db.ref(p).onDisconnect();
                return op.remove ? d.remove() : op.update ? d.update(op.update) : d.set(op.set);
            },
            cancelDisconnect: function (p) { return db.ref(p).onDisconnect().cancel(); }
        };
    }

    function isConfigured(cfg) {
        cfg = cfg || root.FIREBASE_CONFIG;
        return !!(cfg && cfg.databaseURL && !/PASTE|YOUR_/i.test(JSON.stringify(cfg)));
    }


    /* ===========================================================
       3. TÍNH TOÁN TỪ DỮ LIỆU PHÒNG (hàm thuần)
       =========================================================== */
    function normalize(r) {
        var o = Object.assign({}, r);
        ["players", "stages", "scores", "done", "left", "results", "roster"].forEach(function (k) {
            o[k] = r[k] && typeof r[k] === "object" ? r[k] : {};
        });
        o.state = r.state || "lobby";
        o.mode = typeof r.mode === "string" && r.mode ? r.mode : null;      // chế độ chơi chủ phòng đã chọn
        o.current = r.current || 0;
        o.stageCount = r.stageCount || 0;
        o.maxHp = r.maxHp || 0;
        return o;
    }

    function listPlayers(room, meId) {
        var ids = Object.keys(room.players).sort(function (a, b) {
            return (room.players[a].joinedAt || 0) - (room.players[b].joinedAt || 0) || (a < b ? -1 : 1);
        });
        var seen = {};
        return ids.map(function (id) {
            var p = room.players[id], base = String(p.name || "?"), key = base.toLowerCase();
            seen[key] = (seen[key] || 0) + 1;      // trùng tên thì thêm (2), (3)...
            return {
                id: id,
                name: seen[key] > 1 ? base + " (" + seen[key] + ")" : base,
                isHost: id === room.hostId,
                isMe: id === meId,
                online: p.online !== false,
                joinedAt: p.joinedAt || 0
            };
        });
    }

    function byRank(a, b) {      // nhiều sát thương hơn thắng, hòa thì ai nhanh hơn
        return b.total - a.total || a.timeMs - b.timeMs || String(a.name).localeCompare(String(b.name));
    }

    function summarize(room) {
        var q = R.QUESTIONS_PER_STAGE;
        var entries = Object.keys(room.roster).map(function (id) {
            var sc = room.scores[id] || {}, total = 0, timeMs = 0, per = {};
            for (var n = 1; n <= room.stageCount; n++) {
                var st = room.stages["s" + n], e = sc["s" + n];
                if (!st) continue;
                var deadline = st.startAt + st.durationSec * 1000 + R.GRACE_MS + 500;
                var ok = e && typeof e.score === "number" && typeof e.at === "number" && e.at <= deadline;   // điểm gửi trễ không tính
                var s = ok ? clamp(Math.floor(e.score), 0, q) : 0;
                per[n] = s;
                total += s;
                timeMs += ok ? Math.max(0, e.at - st.startAt) : st.durationSec * 1000;
            }
            return { id: id, name: room.roster[id], total: total, perStage: per, timeMs: timeMs, left: !!room.left[id] };
        }).sort(byRank);

        var damage = 0, cut = 0;
        entries.forEach(function (e, i) { e.rank = i + 1; damage += e.total; });
        Object.keys(room.left).forEach(function (id) { cut += room.left[id].reduction || 0; });

        var effective = room.maxHp - cut;
        return {
            stageCount: room.stageCount,
            maxHp: room.maxHp,
            effectiveMaxHp: effective,         // HP tối đa sau khi trừ phần của người đã rời
            totalDamage: damage,
            hp: Math.max(0, effective - damage),
            ranking: entries
        };
    }

    /* Chọn từ (và mini game) cho một giai đoạn. Có BossCore thì dùng bộ chọn theo mức độ,
       không thì chọn ngẫu nhiên như cũ. */
    function defaultPick(n, count, used, stageCount, room) {
        var pool = typeof vocabData !== "undefined" ? vocabData : [];
        if (root.BossCore && pool.length) {
            var games = Object.keys((room && room.stages) || {}).map(function (k) { return room.stages[k].game; }).filter(Boolean);
            return root.BossCore.pickStage(pool, n, stageCount, used, games);
        }
        var fresh = pool.filter(function (w) { return w && w.word && !used[w.word]; });
        return R.shuffle(fresh.length >= count ? fresh : pool).slice(0, count);
    }


    /* ===========================================================
       4. ENGINE: một người chơi trong một phòng
       =========================================================== */
    function Engine(db, opts) {
        this.db = db;
        this.opts = opts || {};
        this.opts.storage = this.opts.storage || memoryStore();
        this.id = null;
        this.name = "";
        this.code = null;
        this._cbs = {};
        this._unsub = [];
        this._reset();
    }
    var P = Engine.prototype;

    P._reset = function () {
        this.room = null;
        this._sticky = {};
        this._waiters = [];
        this._playersJson = null;
        this._modeSeen = undefined;
        this._scoresJson = null;
        this._startedEmitted = false;
        this._endedEmitted = false;
        this._stageSeen = 0;
        this._ends = {};
        this._leftSeen = {};
        this._joined = false;
        this._seenMe = false;
        this._resolving = null;
        this._claiming = false;
    };

    /* ----- sự kiện ----- */
    P.on = function (ev, cb) {
        var self = this;
        (this._cbs[ev] = this._cbs[ev] || []).push(cb);
        if (this._sticky[ev] !== undefined) {           // đăng ký muộn vẫn nhận trạng thái hiện tại
            var v = this._sticky[ev];
            Promise.resolve().then(function () { cb(v); });
        }
        return function () { var l = self._cbs[ev], i = l.indexOf(cb); if (i >= 0) l.splice(i, 1); };
    };
    P._emit = function (ev, payload, sticky) {
        if (sticky) this._sticky[ev] = payload;
        (this._cbs[ev] || []).slice().forEach(function (cb) {
            try { cb(payload); } catch (e) { console.error("[BossNet] lỗi trong callback " + ev + ":", e); }
        });
    };
    [
        ["onPlayersChange", "players"], ["onGameStart", "gameStart"], ["onStageStart", "stageStart"],
        ["onScoresUpdate", "scores"], ["onPlayerLeave", "playerLeave"], ["onStageEnd", "stageEnd"],
        ["onGameEnd", "gameEnd"], ["onRoomClosed", "roomClosed"], ["onRemoved", "removed"],
        ["onModeChange", "modeChange"]
    ].forEach(function (x) { P[x[0]] = function (cb) { return this.on(x[1], cb); }; });

    /* ----- thông tin nhanh ----- */
    P.serverNow = function () { return this.db.serverNow(); };
    P.me = function () { return { id: this.id, name: this.name }; };
    P.isHost = function () { return !!(this.room && this.room.hostId === this.id); };
    P.getPlayers = function () { return this.room ? listPlayers(this.room, this.id) : []; };
    P.getSummary = function () { return this.room && this.room.state !== "lobby" ? summarize(this.room) : null; };
    P._p = function (sub) { return "rooms/" + this.code + (sub ? "/" + sub : ""); };
    P._ready = function () {
        var self = this;
        return this.room ? Promise.resolve() : new Promise(function (res) { self._waiters.push(res); });
    };

    /* ----- danh tính và phiên (giữ khi chuyển trang) ----- */
    P._identity = function (name) {
        var s = this.opts.storage, id = s.getItem(PID_KEY);
        if (!id) { id = randomId(); s.setItem(PID_KEY, id); }
        this.id = id;
        this.name = cleanName(name);
    };
    P._saveSession = function () {
        this.opts.storage.setItem(SESSION_KEY, JSON.stringify({ code: this.code, pid: this.id, name: this.name }));
    };

    /* ----- vào / ra phòng ----- */
    P.createRoom = async function (name) {
        this._reset();
        this._identity(name);
        var me = this.id;
        for (var i = 0; i < 6; i++) {
            var code = randomCode();
            var tx = await this.db.transaction("rooms/" + code + "/hostId", function (v) { return v === null ? me : undefined; });
            if (!tx.committed) continue;                   // trùng mã, thử mã khác
            this.code = code;
            var up = { createdAt: this.db.TS, state: "lobby" };
            up["players/" + me] = { name: this.name, joinedAt: this.db.TS, online: true };
            await this.db.update("rooms/" + code, up);
            this._joined = true;
            await this._attach();
            return code;
        }
        throw fail("NO_CODE", "Không tạo được mã phòng, thử lại nhé.");
    };

    P.joinRoom = async function (code, name) {
        this._reset();
        this._identity(name);
        code = String(code || "").trim().toUpperCase();
        var room = await this.db.get("rooms/" + code);
        if (!room || !room.hostId) throw fail("ROOM_NOT_FOUND");
        if (room.state && room.state !== "lobby") throw fail("ROOM_STARTED");

        var gm = root.GameModes && root.GameModes.get(room.mode);
        var cap = gm && gm.maxPlayers ? gm.maxPlayers() : R.MAX_PLAYERS;
        if (Object.keys(room.players || {}).length >= cap) throw fail("ROOM_FULL");

        this.code = code;
        await this.db.set(this._p("players/" + this.id), { name: this.name, joinedAt: this.db.TS, online: true });
        this._joined = true;
        await this._attach();
        return code;
    };

    /* Gọi ở đầu trang game để nối lại phòng sau khi chuyển trang. Trả về null nếu không còn phòng. */
    P.resume = async function () {
        var raw = this.opts.storage.getItem(SESSION_KEY), s = null;
        try { s = raw && JSON.parse(raw); } catch (e) { /* bỏ qua */ }
        if (!s || !s.code || !s.pid) return null;
        this._reset();
        this.id = s.pid; this.name = s.name; this.code = s.code;
        var room = await this.db.get("rooms/" + s.code);
        if (!room || !room.players || !room.players[s.pid]) {
            this.opts.storage.removeItem(SESSION_KEY);
            this.code = null;
            return null;
        }
        this._joined = true;
        await this._attach();
        return { code: this.code, state: this.room.state };
    };

    P.leaveRoom = async function () {
        if (!this.code) return;
        var code = this.code, id = this.id, r = this.room;
        this.opts.storage.removeItem(SESSION_KEY);
        this._teardown();
        this.code = null;
        try {
            await this.db.cancelDisconnect("rooms/" + code + "/players/" + id);
            var others = r ? Object.keys(r.players).filter(function (x) { return x !== id; }) : [];
            if (others.length) await this.db.remove("rooms/" + code + "/players/" + id);
            else await this.db.remove("rooms/" + code);       // người cuối cùng ra thì xóa phòng
        } catch (e) { /* bỏ qua */ }
    };

    P._attach = function () {
        var self = this;
        this._saveSession();
        this._unsub.push(this.db.listen(".info/connected", function (on) { if (on) self._presence(); }));
        this._unsub.push(this.db.listen("rooms/" + this.code, function (room) { self._apply(room); }));
        this._tick = setInterval(function () { self._tickLoop(); }, 400);
        return this._ready();
    };

    P._teardown = function () {
        this._unsub.forEach(function (f) { f(); });
        this._unsub = [];
        clearInterval(this._tick);
        this._joined = false;
    };

    /* Đánh dấu đang online; mất kết nối thì server tự ghi "offline" (không xóa ngay,
       vì chuyển từ trang phòng sang trang game cũng ngắt kết nối một lúc). */
    P._presence = function () {
        if (!this._joined || !this.room || !this.room.players[this.id]) return;
        var path = this._p("players/" + this.id);
        this.db.onDisconnect(path, { update: { online: false, offlineAt: this.db.TS } });
        this.db.update(path, { online: true, offlineAt: null });
    };

    P._wake = function () {
        var w = this._waiters; this._waiters = [];
        w.forEach(function (f) { f(); });
    };


    /* ----- nhận dữ liệu phòng và phát sự kiện ----- */
    P._apply = function (raw) {
        var self = this;
        if (!raw) {
            if (this._joined) { this._emit("roomClosed", {}); this._teardown(); }
            this._wake();
            return;
        }
        var room = normalize(raw), first = this.room === null;
        this.room = room;

        if (room.players[this.id]) this._seenMe = true;
        else if (this._joined && this._seenMe) {          // bị host xóa khỏi phòng
            this._emit("removed", {});
            this._teardown();
            this._wake();
            return;
        }
        if (first) this._presence();

        var list = listPlayers(room, this.id), pj = JSON.stringify(list);
        if (pj !== this._playersJson) { this._playersJson = pj; this._emit("players", list, true); }

        if (room.mode !== this._modeSeen) { this._modeSeen = room.mode; this._emit("modeChange", room.mode, true); }

        if (room.state !== "lobby") {
            if (!this._startedEmitted) {
                this._startedEmitted = true;
                this._emit("gameStart", { code: this.code, mode: room.mode || DEFAULT_MODE, boss: room.boss, stageCount: room.stageCount, maxHp: room.maxHp }, true);
            }

            var sum = summarize(room);

            Object.keys(room.results).map(function (k) { return +k.slice(1); }).sort(function (a, b) { return a - b; })
                .forEach(function (n) {
                    if (self._ends[n]) return;
                    self._ends[n] = true;
                    if (first) return;                    // vào lại giữa chừng: không phát lại giai đoạn cũ
                    self._emit("stageEnd", { stage: n, damage: room.results["s" + n].damage, hp: room.results["s" + n].hp, ranking: sum.ranking }, true);
                });

            if (room.state === "playing" && room.current && room.current !== this._stageSeen && room.stages["s" + room.current]) {
                this._stageSeen = room.current;
                this._emit("stageStart", this._stagePayload(room, room.current), true);
            }

            var sj = JSON.stringify(sum);
            if (sj !== this._scoresJson) { this._scoresJson = sj; this._emit("scores", sum, true); }

            Object.keys(room.left).forEach(function (id) {
                if (self._leftSeen[id]) return;
                self._leftSeen[id] = true;
                if (!first) self._emit("playerLeave", { id: id, name: room.left[id].name, reduction: room.left[id].reduction });
            });

            if (room.state === "finished" && room.result && !this._endedEmitted) {
                this._endedEmitted = true;
                var mvp = sum.ranking.filter(function (e) { return e.id === room.result.mvpId; })[0] || sum.ranking[0] || null;
                this._emit("gameEnd", {
                    outcome: room.result.outcome, hp: sum.hp, maxHp: sum.effectiveMaxHp,
                    boss: room.boss, stageCount: room.stageCount, mvp: mvp, ranking: sum.ranking
                }, true);
            }
        }

        this._wake();
    };

    P._stagePayload = function (room, n) {
        var st = room.stages["s" + n], words = [], self = this;
        try { words = JSON.parse(st.wordsJson || "[]"); } catch (e) { /* để trống */ }
        return {
            game: st.game || null,                         // mini game của giai đoạn này (do host chọn)
            stage: n,
            stageCount: room.stageCount,
            boss: room.boss,
            maxHp: room.maxHp,
            durationSec: st.durationSec,
            questions: st.questions,
            words: words,                                  // cả phòng dùng chung; tự xáo riêng bằng BossRules.shuffleFor
            startAt: st.startAt,                           // giờ server (ms)
            endsAt: st.startAt + st.durationSec * 1000,
            msUntilStart: st.startAt - this.db.serverNow(),
            serverNow: function () { return self.db.serverNow(); }
        };
    };


    /* ----- gửi điểm ----- */
    /* score = số câu đúng tính tới giờ trong giai đoạn này (gọi sau mỗi câu đúng để thanh máu chạy trực tiếp). */
    P.sendScore = function (stage, score) {
        var r = this.room;
        if (!r || r.state !== "playing" || r.current !== stage || r.results["s" + stage]) return Promise.resolve(false);
        score = clamp(Math.floor(score) || 0, 0, R.QUESTIONS_PER_STAGE);
        var prev = (r.scores[this.id] || {})["s" + stage];
        if (prev && prev.score >= score) return Promise.resolve(false);      // điểm chỉ tăng, không trừ
        return this.db.set(this._p("scores/" + this.id + "/s" + stage), { score: score, at: this.db.TS }).then(function () { return true; });
    };

    /* Tùy chọn: báo đã làm xong hết 10 câu. Khi mọi người đều xong, host chuyển giai đoạn sớm. */
    P.sendDone = function (stage) {
        var r = this.room;
        if (!r || r.state !== "playing" || r.current !== stage) return Promise.resolve(false);
        return this.db.set(this._p("done/s" + stage + "/" + this.id), true).then(function () { return true; });
    };


    /* ----- chế độ chơi: chủ phòng chọn ở sảnh chờ, cả phòng thấy qua onModeChange ----- */
    P.getMode = function () { return this.room ? this.room.mode : null; };

    P.setMode = async function (mode) {
        await this._ready();
        var r = this.room;
        if (r.hostId !== this.id) throw fail("NOT_HOST", "Chỉ chủ phòng mới chọn được chế độ.");
        if (r.state !== "lobby") throw fail("ALREADY_STARTED");
        if (!/^[A-Za-z0-9_]{1,20}$/.test(String(mode))) throw fail("BAD_MODE", "Tên chế độ không hợp lệ.");
        await this.db.update(this._p(), { mode: String(mode) });
    };

    /* ----- host: bắt đầu ván ----- */
    P.startGame = async function () {
        await this._ready();
        var r = this.room;
        if (r.hostId !== this.id) throw fail("NOT_HOST", "Chỉ chủ phòng mới bắt đầu được.");
        if (r.state !== "lobby") throw fail("ALREADY_STARTED");

        var mode = r.mode || DEFAULT_MODE;
        if (MODES[mode]) return MODES[mode].start(this, r);
        if (mode !== "bossBattle") throw fail("MODE_UNAVAILABLE", "Chế độ này chưa có, hãy chọn BossBattle.");

        var all = listPlayers(r, this.id), live = all.filter(function (p) { return p.online; });
        var min = this.opts.minPlayers != null ? this.opts.minPlayers : R.MIN_PLAYERS;
        if (live.length < min) throw fail("NOT_ENOUGH_PLAYERS", "Cần ít nhất " + min + " người.");

        var stages = R.stageCount(live.length);
        var up = {
            state: "playing",
            mode: mode,
            boss: Math.floor(Math.random() * R.BOSS_COUNT),
            stageCount: stages,
            maxHp: R.maxHp(live.length, stages),
            current: 1
        };
        live.forEach(function (p) { up["roster/" + p.id] = p.name; });              // danh sách người chơi lúc bắt đầu
        all.forEach(function (p) { if (!p.online) up["players/" + p.id] = null; }); // người đang offline bị bỏ
        up["stages/s1"] = this._makeStage(1, stages, r);
        await this.db.update(this._p(), up);
    };

    P._makeStage = function (n, stageCount, r) {
        var used = {};
        Object.keys(r.stages).forEach(function (k) {
            try { JSON.parse(r.stages[k].wordsJson).forEach(function (w) { used[w.word || w] = true; }); } catch (e) { /* bỏ qua */ }
        });

        // pickWords/defaultPick trả về mảng từ, hoặc { game, words } khi có chọn mini game
        var picked = null, words = [];
        try {
            picked = (this.opts.pickWords || defaultPick)(n, R.QUESTIONS_PER_STAGE, used, stageCount, r);
            words = (picked && picked.words) || picked || [];
        } catch (e) { console.error("[BossNet] pickWords lỗi:", e); }

        return {
            startAt: this.db.serverNow() + (n === 1 ? R.FIRST_STAGE_DELAY_MS : R.BREAK_MS),
            durationSec: R.stageSeconds(n, stageCount),
            questions: R.QUESTIONS_PER_STAGE,
            game: (picked && picked.game) || null,
            wordsJson: JSON.stringify(words)
        };
    };


    /* ----- vòng lặp 0,4 giây: nhận host + việc của host ----- */
    P._tickLoop = function () {
        var r = this.room;
        if (!r || !this._joined) return;
        var now = this.db.serverNow();
        this._maybeClaimHost(r, now);
        
        if (r.hostId === this.id) {
            var h = MODES[r.mode];
            if (h && h.tick) h.tick(this, r, now); else this._hostDuties(r, now);
        }
    };

    P._maybeClaimHost = function (r, now) {
        if (this._claiming || !r.players[this.id]) return;
        var host = r.players[r.hostId];
        var gone = !host || (host.online === false && typeof host.offlineAt === "number" && now - host.offlineAt > R.OFFLINE_GRACE_MS);
        if (!gone) return;
        var cands = listPlayers(r, this.id).filter(function (p) { return p.online && p.id !== r.hostId; });
        if (!cands.length || cands[0].id !== this.id) return;      // chỉ người vào sớm nhất được thử
        var self = this, me = this.id, old = r.hostId;
        this._claiming = true;
        this.db.transaction(this._p("hostId"), function (v) { return v === old ? me : undefined; })
            .then(function () { self._claiming = false; }, function () { self._claiming = false; });
    };

    P._hostDuties = function (r, now) {
        var self = this, db = this.db, up = {}, dirty = false;

        // 1. dọn người mất kết nối quá lâu
        Object.keys(r.players).forEach(function (id) {
            var p = r.players[id];
            if (id !== self.id && p.online === false && typeof p.offlineAt === "number" && now - p.offlineAt > R.OFFLINE_GRACE_MS) {
                up["players/" + id] = null; dirty = true;
            }
        });

        // 2. người đã rời giữa ván -> boss bớt đúng phần HP họ chưa đóng góp
        if (r.state === "playing") {
            var resolved = Object.keys(r.results).length;
            Object.keys(r.roster).forEach(function (id) {
                if (r.players[id] || r.left[id]) return;
                var partial = 0;
                if (r.stages["s" + r.current] && !r.results["s" + r.current]) {
                    var e = (r.scores[id] || {})["s" + r.current];
                    partial = e && typeof e.score === "number" ? e.score : 0;
                }
                up["left/" + id] = { name: r.roster[id], reduction: R.hpLostOnLeave(r.stageCount, resolved, partial), at: db.TS };
                dirty = true;
            });
        }
        if (dirty) { db.update(this._p(), up); return; }      // để tick sau xử lý tiếp với dữ liệu mới

        // 3. chốt giai đoạn: hết giờ, hoặc mọi người còn lại đều đã xong
        if (r.state !== "playing") return;
        var n = r.current, st = r.stages["s" + n];
        if (!st || r.results["s" + n] || this._resolving === n || now < st.startAt) return;

        var live = Object.keys(r.players).filter(function (id) { return r.players[id].online !== false && r.roster[id]; });
        var doneMap = r.done["s" + n] || {};
        var allDone = live.length > 0 && live.every(function (id) { return doneMap[id]; });
        if (!allDone && now < st.startAt + st.durationSec * 1000 + R.GRACE_MS) return;

        this._resolving = n;
        var sum = summarize(r);
        var damage = sum.ranking.reduce(function (s, e) { return s + (e.perStage[n] || 0); }, 0);
        var win = sum.hp <= 0, last = n >= r.stageCount;
        var res = {};
        res["results/s" + n] = { damage: damage, hp: sum.hp, at: db.TS };
        if (win || last) {                                        // boss về 0 thì thắng ngay; hết giai đoạn cuối mà còn máu thì thua
            res.state = "finished";
            res.result = {
                outcome: win ? "win" : "lose", hp: sum.hp, maxHp: sum.effectiveMaxHp,
                mvpId: sum.ranking.length ? sum.ranking[0].id : null, finishedAt: db.TS
            };
        } else {
            res.current = n + 1;
            res["stages/s" + (n + 1)] = this._makeStage(n + 1, r.stageCount, r);
        }
        db.update(this._p(), res).catch(function (e) { console.error("[BossNet] chốt giai đoạn lỗi:", e); self._resolving = null; });
    };


    /* ===========================================================
       5. BOT (để thử một mình, không cần mạng)
       =========================================================== */
    function attachBotBrain(bot, cfg) {
        var timers = [];
        bot.onStageStart(function (st) {
            timers.forEach(clearTimeout); timers = [];
            var wait = Math.max(0, st.startAt - bot.db.serverNow());
            var per = st.durationSec * 1000 * cfg.pace / st.questions;
            var score = 0;
            for (var i = 1; i <= st.questions; i++) {
                (function (i) {
                    timers.push(setTimeout(function () {
                        if (Math.random() < cfg.accuracy) { score++; bot.sendScore(st.stage, score); }
                        if (i === st.questions) bot.sendDone(st.stage);
                    }, wait + per * i * (0.85 + Math.random() * 0.3)));
                })(i);
            }
        });
        bot.stopBrain = function () { timers.forEach(clearTimeout); timers = []; };
    }


    /* ===========================================================
       6. CỔNG VÀO
       =========================================================== */
    root.BossNet = {
        registerMode: function (id, handler) { MODES[id] = handler; },
        isConfigured: function () { return isConfigured(); },

        /* Bản thật: nhiều máy chơi chung qua Firebase */
        create: function (opts) {
            opts = Object.assign({ storage: sessionStore() }, opts || {});
            return new Engine(FirebaseDB(opts.config || root.FIREBASE_CONFIG), opts);
        },

        /* Bản giả lập: bạn là chủ phòng, bot ngồi chơi cùng. Mọi thứ nằm trong trang này,
           không cần Firebase. Trả về engine đã ở trong phòng (chưa bắt đầu). */
        createSolo: async function (opts) {
            opts = opts || {};
            var count = opts.bots == null ? 3 : opts.bots;
            var server = new MemoryServer();
            var net = new Engine(server.connect(), Object.assign({}, opts, { storage: memoryStore(), minPlayers: Math.min(R.MIN_PLAYERS, count + 1) }));
            var code = await net.createRoom(opts.playerName || "Bạn");
            var names = opts.botNames || ["Bot An", "Bot Bình", "Bot Chi", "Bot Dũng", "Bot Em"];
            net.bots = [];
            for (var i = 0; i < count; i++) {
                var bot = new Engine(server.connect(), { storage: memoryStore() });
                await bot.joinRoom(code, names[i % names.length] + (i >= names.length ? " " + (i + 1) : ""));
                attachBotBrain(bot, {
                    accuracy: clamp(R.TARGET_ACCURACY + (Math.random() - 0.5) * 0.3, 0.3, 0.95),
                    pace: 0.55 + Math.random() * 0.4
                });
                net.bots.push(bot);
            }
            net.server = server;
            return net;
        },

        /* Dành cho test */
        Engine: Engine,
        MemoryServer: MemoryServer,
        memoryStore: memoryStore,
        summarize: summarize
    };
})(typeof window !== "undefined" ? window : globalThis);