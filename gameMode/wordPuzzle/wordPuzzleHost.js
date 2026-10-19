// wordPuzzle/wordPuzzleHost.js — phần việc của CHỦ PHÒNG trong Word Puzzle.
// Gắn vào boss-net.js qua BossNet.registerMode("wordPuzzle", { start, tick }) (cùng cách với Survival).
//
// Mỗi người chơi theo nhịp riêng nên host KHÔNG phải điều phối từng level; host chỉ làm hai việc:
//   1) lúc bắt đầu: ghi seed + giờ bắt đầu + danh sách người chơi (ghi 1 lần)
//   2) khi mọi người đã xong (hoặc rời phòng, hoặc tới mốc cuối): chốt bảng xếp hạng
// Dữ liệu dưới rooms/{mã}/wp:
//   roster {id: tên}, total, cfg {seed, startAt}
//   res/{id} {s: điểm, t: thời gian ms, l: số level đã xong, d: 1 nếu đã xong cả 3 level}  ← mỗi người ghi 3 lần cả ván
//   final {boardJson}  ← host ghi khi kết thúc; [[id, điểm, thời gian, rời?], ...] đã xếp hạng
(function (root) {
  const Core = () => root.WordPuzzleCore;
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const grace = () => (root.BossRules && root.BossRules.OFFLINE_GRACE_MS) || 12000;
  const firstDelay = () => (root.BossRules && root.BossRules.FIRST_STAGE_DELAY_MS) || 8000;
  const H = { busy: false };

  async function start(engine, r) {
    if (r.hostId !== engine.id) throw err("NOT_HOST", "Chỉ chủ phòng mới bắt đầu được.");
    if (r.state !== "lobby") throw err("ALREADY_STARTED");
    const WP = Core().WP;
    const all = engine.getPlayers(), live = all.filter(p => p.online);
    if (live.length < 2) throw err("NOT_ENOUGH_PLAYERS", "Cần ít nhất 2 người.");
    if (live.length > WP.MAX_PLAYERS) throw err("ROOM_FULL", "Tối đa " + WP.MAX_PLAYERS + " người.");

    const roster = {};
    live.forEach(p => (roster[p.id] = p.name));
    const up = {
      state: "playing", mode: "wordPuzzle",
      "wp/roster": roster, "wp/total": live.length,
      "wp/cfg": { seed: (Math.random() * 4294967295) >>> 0, startAt: engine.serverNow() + firstDelay() + WP.COUNTDOWN_MS }
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

    // dọn người mất kết nối quá lâu (giống BossBattle và Survival)
    Object.keys(r.players).forEach(id => {
      const p = r.players[id];
      if (id !== engine.id && p.online === false && typeof p.offlineAt === "number" && now - p.offlineAt > grace()) {
        up["players/" + id] = null; dirty = true;
      }
    });

    const wp = r.wp;
    if (r.state === "playing" && wp && wp.cfg && wp.roster && !wp.final) {
      const res = wp.res || {}, ids = Object.keys(wp.roster);
      const over = id => (res[id] && res[id].d) || !r.players[id];           // đã xong, hoặc đã rời phòng
      if (ids.every(over) || now >= Core().deadline(wp.cfg.startAt)) {
        const ranked = Core().rank(ids.map(id => {
          const x = res[id] || {};
          return { id, score: x.s || 0, timeMs: x.t || 0, left: r.players[id] ? 0 : 1 };
        }));
        up.state = "finished";
        up["wp/final"] = { boardJson: JSON.stringify(ranked.map(e => [e.id, e.score, e.timeMs, e.left])) };
        up["wp/res"] = null;                                                  // xóa dữ liệu tạm cho phòng nhẹ
        dirty = true;
      }
    }

    if (dirty) {
      H.busy = true;
      engine.db.update(engine._p(), up).catch(e => console.error("[WordPuzzle] ghi lỗi:", e)).then(() => { H.busy = false; });
    }
  }

  root.WordPuzzleHost = { start, tick };
  if (root.BossNet && root.BossNet.registerMode) root.BossNet.registerMode("wordPuzzle", { start, tick });
  else console.warn("[WordPuzzle] boss-net.js chưa có registerMode: hãy vá boss-net.js trước khi nạp wordPuzzleHost.js");
})(typeof window !== "undefined" ? window : globalThis);
