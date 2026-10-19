// wordPuzzle/wordPuzzleNet.js — nối mạng cho Word Puzzle.
//
// HỢP ĐỒNG mà trang game dùng (giống nhau ở bản giả lập và bản thật):
//   net.id, net.names[id], net.total
//   net.onStart(cb)     cb(info): { seed, startAt, resume: {levels, score, timeMs, done} | null, serverNow() }
//   net.submitLevel(levelsDone, score, timeMs, done)    ← ghi 1 lần sau mỗi level (3 lần cả ván)
//   net.onProgress(cb)  cb({ done, total })             ← bao nhiêu người đã chơi xong (để hiện lúc chờ)
//   net.onFinal(cb)     cb({ ranking[{id,name,rank,score,timeMs,left}], myRank })
//   net.onClosed(cb), net.start(), net.leave()
(function (root) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ================= BẢN GIẢ LẬP: bot chơi cùng, không cần Firebase ================= */
  function create(opts) {
    const Core = root.WordPuzzleCore, WP = Core.WP;
    const scale = opts.timeScale || 1, T = ms => ms / scale;       // timeScale > 1: chạy nhanh để thử
    const n = clamp(opts.players || 8, 2, WP.MAX_PLAYERS);
    const names = { me: opts.name || "Bạn" }, ids = ["me"];
    for (let i = 1; i < n; i++) { ids.push("bot" + i); names["bot" + i] = "Bot " + i; }

    const seed = (Math.random() * 4294967295) >>> 0;
    const startAt = Date.now() + T(WP.COUNTDOWN_MS + 1500);
    const endAt = startAt + T(Core.deadline(0));                  // mốc cuối (đã co theo timeScale)
    const cb = {}, emit = (k, v) => cb[k] && cb[k](v);
    const res = { me: { score: 0, timeMs: 0, done: false } };
    let gaveFinal = false, timer = null, dead = false;

    // Bot: tính sẵn điểm, thời gian, và lúc nào chơi xong
    ids.slice(1).forEach(id => {
      const skill = 0.4 + Math.random() * 0.55;
      let score = 0, used = 0, clock = 0;
      WP.LEVELS.forEach(L => {
        const found = Math.round(L.words * clamp(skill + (Math.random() - 0.5) * 0.3, 0, 1));
        const total = L.sec * 1000;
        const spent = found === L.words ? total * (0.25 + Math.random() * 0.6) : total;
        for (let k = 0; k < found; k++) score += Core.wordScore(total * (1 - (spent / total) * (k + 1) / Math.max(1, found)), total);
        if (found === L.words) score += WP.CLEAR_BONUS;
        used += spent; clock += spent + WP.BETWEEN_MS + WP.REVEAL_MS;
      });
      res[id] = { score, timeMs: used, done: false };
      setTimeout(() => { res[id].done = true; }, startAt - Date.now() + T(clock));
    });

    function finish() {
      if (gaveFinal || dead) return;
      gaveFinal = true;
      clearInterval(timer);
      const ranking = Core.rank(ids.map(id => ({ id, name: names[id], score: res[id].score, timeMs: res[id].timeMs, left: 0 })));
      emit("final", { ranking, myRank: ranking.find(r => r.id === "me").rank });
    }

    return {
      id: "me", names, total: n,
      onStart: f => (cb.start = f),
      onProgress: f => (cb.progress = f),
      onFinal: f => (cb.final = f),
      onClosed: f => (cb.closed = f),
      start() {
        setTimeout(() => emit("start", { seed, startAt, resume: null, serverNow: Date.now }), 100);
        timer = setInterval(() => {
          const done = ids.filter(id => res[id].done).length;
          emit("progress", { done, total: n });
          if (done === n || Date.now() >= endAt) setTimeout(finish, T(1200));
        }, 300);
      },
      submitLevel(levels, score, timeMs, done) { res.me = { score, timeMs, done: !!done }; },
      leave() { dead = true; clearInterval(timer); }
    };
  }

  /* ================= BẢN THẬT: nối với phòng của BossNet (Firebase) ================= */
  // engine = BossNet.create() đã resume() vào phòng. Dữ liệu ở rooms/{mã}/wp (xem wordPuzzleHost.js).
  // Máy này chỉ GHI 3 lần cả ván (sau mỗi level); mọi thứ còn lại là đọc dữ liệu phòng đã có sẵn trên máy.
  function connect(engine) {
    const cb = {};
    let started = false, gaveFinal = false, timer = null;
    const emit = (k, v) => cb[k] && cb[k](v);
    const wp = () => (engine.room && engine.room.wp) || null;
    const names = () => (wp() && wp().roster) || {};

    function check() {
      const s = wp();
      if (!s) return;
      if (s.cfg && !started) {
        started = true;
        const mine = s.res && s.res[engine.id];                  // vào lại giữa ván: làm tiếp từ level đang dở
        emit("start", {
          seed: s.cfg.seed, startAt: s.cfg.startAt,
          resume: mine ? { levels: mine.l || 0, score: mine.s || 0, timeMs: mine.t || 0, done: !!mine.d } : null,
          serverNow: () => engine.serverNow()
        });
      }
      if (started && !s.final) emit("progress", { done: Object.values(s.res || {}).filter(x => x && x.d).length, total: s.total || 0 });
      if (s.final && !gaveFinal) {
        gaveFinal = true;
        let rows = [];
        try { rows = JSON.parse(s.final.boardJson || "[]"); } catch (e) { /* để trống */ }
        const ranking = rows.map((a, i) => ({ id: a[0], rank: i + 1, score: a[1], timeMs: a[2], left: !!a[3], name: names()[a[0]] || "?" }));
        const me = ranking.find(r => r.id === engine.id);
        emit("final", { ranking, myRank: me ? me.rank : 0 });
      }
    }

    engine.onRoomClosed(() => emit("closed"));
    engine.onRemoved(() => emit("closed"));

    return {
      get id() { return engine.id; },
      get names() { return names(); },
      get total() { return (wp() && wp().total) || 0; },
      onStart: f => (cb.start = f),
      onProgress: f => (cb.progress = f),
      onFinal: f => (cb.final = f),
      onClosed: f => (cb.closed = f),
      start() { timer = setInterval(check, 250); check(); },
      submitLevel(levels, score, timeMs, done) {
        return engine.db.set(engine._p("wp/res/" + engine.id), { s: score, t: Math.round(timeMs), l: levels, d: done ? 1 : 0, at: engine.db.TS });
      },
      leave() { clearInterval(timer); return engine.leaveRoom(); }
    };
  }

  root.WordPuzzleNet = { create, connect };
})(typeof window !== "undefined" ? window : globalThis);
