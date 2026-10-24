// wordChain/wordChainHost.js — phần việc của CHỦ PHÒNG trong Word Chain (nhiều người).
// Gắn vào boss-net.js qua BossNet.registerMode("wordChain", { start, tick }) — cùng cách với Word Puzzle / Survival.
//
// Host là "trọng tài": giữ trạng thái ván, nhận nước đi của người đang tới lượt, xử lý hết giờ / mất mạng / bị loại / chốt kết quả.
// Dữ liệu dưới rooms/{mã}/wc:
//   roster {id: tên}, total, cfg {seed, startAt, orderJson}
//   st   {n, p, w, dl, s}           ← trạng thái hiện tại (host ghi; xem wordChainCore.js)
//   mv/m{n} {p, w}                  ← từ đã nối (m0 là từ mở màn, p = "-")
//   act/{id} {n, w | lose}          ← người chơi ghi nước đi của mình (n = số thứ tự lượt)
//   final {boardJson}               ← [[id, điểm, mạng còn, rời?], ...] đã xếp hạng
// Lưu ý: tick cần wordChainData, mà room.html không nạp file đó, nên ở sảnh tick tự bỏ qua; ván thật chạy ở trang game.
(function (root) {
  const Core = () => root.WordChainCore;
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const grace = () => (root.BossRules && root.BossRules.OFFLINE_GRACE_MS) || 12000;
  const firstDelay = () => (root.BossRules && root.BossRules.FIRST_STAGE_DELAY_MS) || 8000;
  const H = { busy: false };
  // wordChainData thường khai báo bằng const/let ở file dữ liệu → KHÔNG nằm trên window, nên phải đọc bằng tên trần
  const getData = () => (typeof wordChainData !== "undefined" ? wordChainData : (root.wordChainData || null));

  async function start(engine, r) {
    if (r.hostId !== engine.id) throw err("NOT_HOST", "Chỉ chủ phòng mới bắt đầu được.");
    if (r.state !== "lobby") throw err("ALREADY_STARTED");
    const C = Core(), WC = C.WC;
    const all = engine.getPlayers(), live = all.filter(p => p.online);
    if (live.length < WC.MIN_PLAYERS) throw err("NOT_ENOUGH_PLAYERS", "Cần ít nhất " + WC.MIN_PLAYERS + " người.");
    if (live.length > WC.MAX_PLAYERS) throw err("ROOM_FULL", "Tối đa " + WC.MAX_PLAYERS + " người.");

    const seed = (Math.random() * 4294967295) >>> 0, roster = {};
    live.forEach(p => (roster[p.id] = p.name));
    const order = C.shuffle(live.map(p => p.id), C.rng(seed));                // thứ tự lượt ngẫu nhiên
    const up = {
      state: "playing", mode: "wordChain",
      "wc/roster": roster, "wc/total": live.length,
      "wc/cfg": { seed, startAt: engine.serverNow() + firstDelay() + WC.COUNTDOWN_MS, orderJson: JSON.stringify(order) }
    };
    all.forEach(p => { if (!p.online) up["players/" + p.id] = null; });
    H.busy = false;
    await engine.db.update(engine._p(), up);
  }

  // Xử lý một nhịp: trả về các thay đổi cần ghi (hoặc null nếu chưa có gì)
  function step(r, wc, data, now) {
    const C = Core(), WC = C.WC, up = {};

    if (!wc.st) {                                                          // chưa có trạng thái: dựng lượt đầu
      let order = [];
      try { order = JSON.parse(wc.cfg.orderJson || "[]"); } catch (e) { /* để trống */ }
      order = order.filter(id => wc.roster[id]);
      if (!order.length) return null;
      const w = C.pickStartWord(data, wc.cfg.seed);
      up["wc/mv/m0"] = { p: "-", w };
      up["wc/st"] = C.pack(C.newState(order, w, Math.max(now, wc.cfg.startAt) + WC.TURN_MS));
      return up;
    }

    const S = C.parse(wc.st), used = C.usedFrom(wc.mv);
    let changed = false, turnDone = false;

    C.aliveIds(S).forEach(id => {                                          // ai đã rời phòng thì bị loại luôn
      if (!r.players[id]) { C.leave(S, id); changed = true; if (id === S.p) turnDone = true; }
    });

    if (!turnDone && C.aliveIds(S).length > 1) {                           // việc của người đang tới lượt
      const act = wc.act && wc.act[S.p], mine = act && act.n === S.n ? act : null;
      if (mine && mine.w && C.checkWord(data, S.w, used, mine.w).ok) {
        up["wc/mv/m" + S.n] = { p: S.p, w: mine.w };
        used.add(mine.w);
        C.playWord(S, mine.w);
        changed = turnDone = true;
      } else if (mine && mine.lose) { C.loseLife(S, S.p); changed = turnDone = true; }
      else if (now >= S.dl) { C.loseLife(S, S.p); changed = turnDone = true; }   // hết giờ
    }
    if (!changed) return null;

    let over = C.aliveIds(S).length <= 1;
    if (!over && turnDone) over = C.advance(S, data, used, now, WC.TURN_MS).over;
    up["wc/st"] = C.pack(S);
    if (over) {
      up.state = "finished";
      up["wc/final"] = { boardJson: JSON.stringify(C.rank(S).map(e => [e.id, e.score, e.lives, e.left ? 1 : 0])) };
      up["wc/act"] = null;
    }
    return up;
  }

  // Chạy mỗi 0,4 giây trên máy chủ phòng
  function tick(engine, r, now) {
    if (H.busy) return;
    let up = {}, dirty = false;

    Object.keys(r.players).forEach(id => {                                 // dọn người mất kết nối quá lâu
      const p = r.players[id];
      if (id !== engine.id && p.online === false && typeof p.offlineAt === "number" && now - p.offlineAt > grace()) {
        up["players/" + id] = null; dirty = true;
      }
    });

    const wc = r.wc;
    const data = getData();
    if (r.state === "playing" && wc && wc.cfg && wc.roster && !wc.final && data) {
      const s = step(r, wc, data, now);
      if (s) { Object.assign(up, s); dirty = true; }
    }

    if (dirty) {
      H.busy = true;
      engine.db.update(engine._p(), up).catch(e => console.error("[WordChain] ghi lỗi:", e)).then(() => { H.busy = false; });
    }
  }

  root.WordChainHost = { start, tick, step };
  if (root.BossNet && root.BossNet.registerMode) root.BossNet.registerMode("wordChain", { start, tick });
  else console.warn("[WordChain] boss-net.js chưa có registerMode: hãy nạp boss-net.js trước wordChainHost.js");
})(typeof window !== "undefined" ? window : globalThis);
