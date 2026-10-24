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

  root.WordChainNet = { connect };
})(typeof window !== "undefined" ? window : globalThis);
