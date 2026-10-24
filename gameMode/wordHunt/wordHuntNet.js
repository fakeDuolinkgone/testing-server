// wordHunt/wordHuntNet.js — nối mạng cho Word Hunt nhiều người.
//
// HỢP ĐỒNG mà trang game dùng (giống nhau ở bản giả lập và bản thật):
//   net.id, net.names[id], net.total
//   net.onStart(cb)     cb(info): { seed, startAt, finished, resume: {score, count, done} | null, serverNow() }
//   net.submit(score, count)                      ← ghi 1 lần lúc hết giờ
//   net.onProgress(cb)  cb({ done, total })       ← bao nhiêu người đã nộp bài
//   net.onFinal(cb)     cb({ ranking[{id,name,rank,score,count,left}], myRank })
//   net.onClosed(cb), net.start(), net.leave()
(function (root) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ================= BẢN GIẢ LẬP: bot chơi cùng, không cần Firebase =================
     Thử bằng wordHunt.html?bots=6 (số bot tùy chọn) */
  function create(opts) {
    opts = opts || {};
    const Core = root.WordHuntCore, WH = Core.WH;
    const n = clamp(opts.players || 6, 2, WH.MAX_PLAYERS);
    const names = { me: opts.name || "Bạn" }, ids = ["me"];
    for (let i = 1; i < n; i++) { ids.push("bot" + i); names["bot" + i] = "Bot " + i; }

    const seed = (Math.random() * 4294967295) >>> 0;
    const startAt = Date.now() + WH.COUNTDOWN_MS + 1500;
    const endAt = startAt + WH.SECONDS * 1000;
    const cb = {}, emit = (k, v) => cb[k] && cb[k](v);
    const res = { me: { score: 0, count: 0, done: false } };
    let gaveFinal = false, timer = null, dead = false;

    ids.slice(1).forEach(id => {
      const count = Math.round(6 + Math.random() * 22);
      res[id] = { score: Math.round(count * (4 + Math.random() * 2.5)), count, done: false };
    });

    function finish() {
      if (gaveFinal || dead) return;
      gaveFinal = true;
      clearInterval(timer);
      const ranking = Core.rank(ids.map(id => ({ id, name: names[id], score: res[id].score, count: res[id].count, left: false })));
      emit("final", { ranking, myRank: ranking.find(r => r.id === "me").rank });
    }

    return {
      id: "me", names, total: n,
      onStart: f => (cb.start = f),
      onProgress: f => (cb.progress = f),
      onFinal: f => (cb.final = f),
      onClosed: f => (cb.closed = f),
      start() {
        setTimeout(() => emit("start", { seed, startAt, finished: false, resume: null, serverNow: Date.now }), 100);
        timer = setInterval(() => {
          if (Date.now() >= endAt) ids.slice(1).forEach(id => (res[id].done = true));
          const done = ids.filter(id => res[id].done).length;
          emit("progress", { done, total: n });
          if (done === n) setTimeout(finish, 1200);
        }, 300);
      },
      submit(score, count) { res.me = { score, count, done: true }; },
      leave() { dead = true; clearInterval(timer); }
    };
  }

  /* ================= BẢN THẬT: nối với phòng của BossNet (Firebase) =================
     engine = BossNet.create() đã resume() vào phòng. Dữ liệu ở rooms/{mã}/wh (xem wordHuntHost.js).
     Máy này chỉ GHI 1 lần cả ván (lúc hết giờ); mọi thứ còn lại là đọc dữ liệu phòng đã có sẵn trên máy. */
  function connect(engine) {
    const cb = {};
    let started = false, gaveFinal = false, timer = null;
    const emit = (k, v) => cb[k] && cb[k](v);
    const wh = () => (engine.room && engine.room.wh) || null;
    const names = () => (wh() && wh().roster) || {};

    function check() {
      const s = wh();
      if (!s) return;
      if (s.cfg && !started) {
        started = true;
        const mine = s.res && s.res[engine.id];                  // vào lại giữa ván: biết mình đã nộp bài chưa
        emit("start", {
          seed: s.cfg.seed, startAt: s.cfg.startAt, finished: !!s.final,
          resume: mine ? { score: mine.s || 0, count: mine.n || 0, done: !!mine.d } : null,
          serverNow: () => engine.serverNow()
        });
      }
      if (started && !s.final) emit("progress", { done: Object.values(s.res || {}).filter(x => x && x.d).length, total: s.total || 0 });
      if (s.final && !gaveFinal) {
        gaveFinal = true;
        let rows = [];
        try { rows = JSON.parse(s.final.boardJson || "[]"); } catch (e) { /* để trống */ }
        const ranking = rows.map((a, i) => ({ id: a[0], rank: i + 1, score: a[1], count: a[2], left: !!a[3], name: names()[a[0]] || "?" }));
        const me = ranking.find(r => r.id === engine.id);
        emit("final", { ranking, myRank: me ? me.rank : 0 });
      }
    }

    engine.onRoomClosed(() => emit("closed"));
    engine.onRemoved(() => emit("closed"));

    return {
      get id() { return engine.id; },
      get names() { return names(); },
      get total() { return (wh() && wh().total) || 0; },
      onStart: f => (cb.start = f),
      onProgress: f => (cb.progress = f),
      onFinal: f => (cb.final = f),
      onClosed: f => (cb.closed = f),
      start() { timer = setInterval(check, 250); check(); },
      submit(score, count) {
        return engine.db.set(engine._p("wh/res/" + engine.id), { s: score, n: count, d: 1, at: engine.db.TS });
      },
      leave() { clearInterval(timer); return engine.leaveRoom(); }
    };
  }

  root.WordHuntNet = { create, connect };
})(typeof window !== "undefined" ? window : globalThis);
