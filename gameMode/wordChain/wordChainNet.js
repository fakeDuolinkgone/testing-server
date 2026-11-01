// wordChain/wordChainNet.js — nối mạng cho Word Chain nhiều người.
//
// HỢP ĐỒNG mà trang game dùng:
//   net.id, net.names[id]
//   net.onStart(cb)   cb({ startAt, serverNow() })            ← có cấu hình ván (đếm ngược tới startAt)
//   net.onState(cb)   cb({ n, p, w, dl, order, lives, scores, out, left, history:[{n,p,w}] })   ← mỗi khi trạng thái đổi
//   net.submitWord(n, word)   ← gửi từ ở lượt n (chỉ người đang tới lượt)
//   net.loseTurn(n)           ← báo sai quá số lần cho phép: mất 1 mạng, qua lượt
//   net.onFinal(cb)   cb({ ranking[{id,name,rank,score,lives,left}], myRank })
//   net.onClosed(cb), net.start(), net.leave()
// engine = BossNet.create() đã resume() vào phòng. Máy này chỉ đọc dữ liệu phòng có sẵn và ghi nước đi của chính mình.
(function (root) {
  function connect(engine) {
    const Core = root.WordChainCore, cb = {};
    let started = false, gaveFinal = false, timer = null, lastSig = "";
    const emit = (k, v) => cb[k] && cb[k](v);
    const wc = () => (engine.room && engine.room.wc) || null;
    const names = () => (wc() && wc().roster) || {};

    function view(s) {
      const S = Core.parse(s.st);
      S.history = Object.keys(s.mv || {}).map(k => ({ n: +k.slice(1), p: s.mv[k].p, w: s.mv[k].w })).sort((a, b) => a.n - b.n);
      return S;
    }

    function check() {
      const s = wc();
      if (!s) return;
      if (s.cfg && !started) {
        started = true;
        emit("start", { startAt: s.cfg.startAt, serverNow: () => engine.serverNow() });
      }
      if (started && s.st) {
        const sig = s.st.n + "|" + s.st.s + "|" + Object.keys(s.mv || {}).length;
        if (sig !== lastSig) { lastSig = sig; emit("state", view(s)); }
      }
      if (s.final && !gaveFinal) {
        gaveFinal = true;
        let rows = [];
        try { rows = JSON.parse(s.final.boardJson || "[]"); } catch (e) { /* để trống */ }
        const ranking = rows.map((a, i) => ({ id: a[0], rank: i + 1, score: a[1], lives: a[2], left: !!a[3], name: names()[a[0]] || "?" }));
        const me = ranking.find(r => r.id === engine.id);
        emit("final", { ranking, myRank: me ? me.rank : 0 });
      }
    }

    engine.onRoomClosed(() => emit("closed"));
    engine.onRemoved(() => emit("closed"));

    const act = o => engine.db.set(engine._p("wc/act/" + engine.id), Object.assign(o, { at: engine.db.TS }));
    return {
      get id() { return engine.id; },
      get names() { return names(); },
      onStart: f => (cb.start = f),
      onState: f => (cb.state = f),
      onFinal: f => (cb.final = f),
      onClosed: f => (cb.closed = f),
      start() { timer = setInterval(check, 250); check(); },
      submitWord: (n, word) => act({ n, w: word }),
      loseTurn: n => act({ n, lose: 1 }),
      leave() { clearInterval(timer); return engine.leaveRoom(); }
    };
  }

  /* ================= CHƠI ĐƠN: bot chơi cùng, không cần Firebase ================= */
  // Dùng lại NGUYÊN host thật (WordChainHost.tick) trên một "phòng giả" nằm trong trình duyệt, nên luật y hệt ván nhiều người.
  // Bot chỉ làm một việc: tới lượt thì chờ một lúc rồi ghi nước đi (hoặc hụt) vào wc/act như người thật.
  function createSolo(opts) {
    opts = opts || {};
    const Core = root.WordChainCore, WC = Core.WC, Host = root.WordChainHost;
    const data = typeof wordChainData !== "undefined" ? wordChainData : root.wordChainData;
    const speed = opts.speed || 1;                                       // > 1: bot nghĩ nhanh hơn (để thử)
    const nb = Math.max(1, Math.min(WC.MAX_PLAYERS - 1, Math.round(+opts.bots || 3)));

    const ids = ["me"], roster = { me: opts.name || "Bạn" }, skill = {};
    for (let i = 1; i <= nb; i++) { ids.push("bot" + i); roster["bot" + i] = "Bot " + i; skill["bot" + i] = 0.55 + Math.random() * 0.4; }

    const seed = (Math.random() * 4294967295) >>> 0, startAt = Date.now() + WC.COUNTDOWN_MS + 1000;
    const room = {
      hostId: "me", state: "playing", mode: "wordChain", players: {},
      wc: { roster, total: ids.length, cfg: { seed, startAt, orderJson: JSON.stringify(Core.shuffle(ids, Core.rng(seed))) } }
    };
    ids.forEach(id => (room.players[id] = { name: roster[id], online: true }));

    const setPath = (path, v) => {                                       // ghi như Firebase: đường dẫn "a/b/c", null = xóa
      const k = path.split("/").filter(Boolean);
      if (!k.length) return;
      let c = room;
      k.slice(0, -1).forEach(x => { if (typeof c[x] !== "object" || c[x] === null) c[x] = {}; c = c[x]; });
      if (v === null || v === undefined) delete c[k[k.length - 1]];
      else c[k[k.length - 1]] = JSON.parse(JSON.stringify(v));
    };
    const engine = {
      id: "me", room, serverNow: Date.now, _p: s => s || "",
      getPlayers: () => ids.map(id => ({ id, name: roster[id], online: true })),
      db: {
        TS: 0,
        set: async (p, v) => setPath(p, v),
        update: async (p, up) => { Object.keys(up).forEach(k => setPath(k, up[k])); }
      },
      onRoomClosed() { }, onRemoved() { }, leaveRoom: async () => { }
    };

    const planned = {};
    const botLoop = () => {
      const s = room.wc;
      if (!s.st || s.final) return;
      const S = Core.parse(s.st);
      if (S.p === "me" || !(S.lives[S.p] > 0) || planned[S.n]) return;
      planned[S.n] = true;
      const bot = S.p, n = S.n;
      const wait = (Math.max(0, startAt - Date.now()) + 1500 + Math.random() * 3500) / speed;
      setTimeout(() => {
        if (!room.wc.st || room.wc.final || room.wc.st.n !== n) return;
        const list = Core.available(data, room.wc.st.w, Core.usedFrom(room.wc.mv));
        const act = list.length && Math.random() < skill[bot]
          ? { n, w: list[Math.floor(Math.random() * list.length)] }
          : { n, lose: 1 };                                              // bot nghĩ không ra: mất 1 mạng
        setPath("wc/act/" + bot, act);
      }, wait);
    };

    const net = connect(engine), leaveReal = net.leave;
    const hostTimer = setInterval(() => Host.tick(engine, room, Date.now()), 400);
    const botTimer = setInterval(botLoop, 300);
    net.leave = () => { clearInterval(hostTimer); clearInterval(botTimer); return leaveReal.call(net); };
    return net;
  }

  root.WordChainNet = { connect, createSolo };
})(typeof window !== "undefined" ? window : globalThis);