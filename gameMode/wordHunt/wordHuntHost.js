// wordHunt/wordHuntHost.js — phần việc của CHỦ PHÒNG trong Word Hunt.
// Gắn vào boss-net.js qua BossNet.registerMode("wordHunt", { start, tick }) (cùng cách với Word Puzzle và Survival).
//
// Cả phòng chơi CÙNG LÚC, cùng chữ cái, cùng 60 giây. Host chỉ làm hai việc:
//   1) lúc bắt đầu: ghi seed + giờ bắt đầu + danh sách người chơi (ghi 1 lần)
//   2) khi mọi người đã nộp bài (hoặc rời phòng, hoặc quá mốc cuối): chốt bảng xếp hạng
// Dữ liệu dưới rooms/{mã}/wh:
//   roster {id: tên}, total, cfg {seed, startAt}
//   res/{id} {s: điểm, n: số từ, d: 1}   ← mỗi người ghi 1 lần lúc hết giờ
//   final {boardJson}                    ← [[id, điểm, số từ, rời?], ...] đã xếp hạng
(function (root) {
  const Core = () => root.WordHuntCore;
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const grace = () => (root.BossRules && root.BossRules.OFFLINE_GRACE_MS) || 12000;
  const firstDelay = () => (root.BossRules && root.BossRules.FIRST_STAGE_DELAY_MS) || 8000;
  const H = { busy: false };

  async function start(engine, r) {
    if (r.hostId !== engine.id) throw err("NOT_HOST", "Chỉ chủ phòng mới bắt đầu được.");
    if (r.state !== "lobby") throw err("ALREADY_STARTED");
    const WH = Core().WH;
    const all = engine.getPlayers(), live = all.filter(p => p.online);
    if (live.length < 2) throw err("NOT_ENOUGH_PLAYERS", "Cần ít nhất 2 người.");
    if (live.length > WH.MAX_PLAYERS) throw err("ROOM_FULL", "Tối đa " + WH.MAX_PLAYERS + " người.");

    const roster = {};
    live.forEach(p => (roster[p.id] = p.name));
    const up = {
      state: "playing", mode: "wordHunt",
      "wh/roster": roster, "wh/total": live.length,
      "wh/cfg": { seed: (Math.random() * 4294967295) >>> 0, startAt: engine.serverNow() + firstDelay() + WH.COUNTDOWN_MS }
    };
    all.forEach(p => { if (!p.online) up["players/" + p.id] = null; });     // người đang offline bị bỏ
    H.busy = false;
    await engine.db.update(engine._p(), up);
  }

  // Chạy mỗi 0,4 giây trên máy chủ phòng
  function tick(engine, r, now) {
    if (H.busy) return;
    const up = {};
    let dirty = false;

    // dọn người mất kết nối quá lâu
    Object.keys(r.players).forEach(id => {
      const p = r.players[id];
      if (id !== engine.id && p.online === false && typeof p.offlineAt === "number" && now - p.offlineAt > grace()) {
        up["players/" + id] = null; dirty = true;
      }
    });

    const wh = r.wh;
    if (r.state === "playing" && wh && wh.cfg && wh.roster && !wh.final) {
      const res = wh.res || {}, ids = Object.keys(wh.roster);
      const over = id => (res[id] && res[id].d) || !r.players[id];           // đã nộp bài, hoặc đã rời phòng
      if (ids.every(over) || now >= Core().deadline(wh.cfg.startAt)) {
        const ranked = Core().rank(ids.map(id => {
          const x = res[id] || {};
          return { id, score: x.s || 0, count: x.n || 0, left: r.players[id] ? 0 : 1 };
        }));
        up.state = "finished";
        up["wh/final"] = { boardJson: JSON.stringify(ranked.map(e => [e.id, e.score, e.count, e.left])) };
        up["wh/res"] = null;                                                  // xóa dữ liệu tạm cho phòng nhẹ
        dirty = true;
      }
    }

    if (dirty) {
      H.busy = true;
      engine.db.update(engine._p(), up).catch(e => console.error("[WordHunt] ghi lỗi:", e)).then(() => { H.busy = false; });
    }
  }

  root.WordHuntHost = { start, tick };
  if (root.BossNet && root.BossNet.registerMode) root.BossNet.registerMode("wordHunt", { start, tick });
  else console.warn("[WordHunt] boss-net.js chưa nạp hoặc chưa có registerMode: hãy nạp boss-net.js trước wordHuntHost.js");
})(typeof window !== "undefined" ? window : globalThis);
