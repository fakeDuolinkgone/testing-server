// survival/survivalHost.js — phần việc của CHỦ PHÒNG (trọng tài) trong Survival.
// Gắn vào boss-net.js qua BossNet.registerMode("survival", { start, tick }) (xem hướng dẫn vá boss-net.js).
//
// Dữ liệu nằm dưới rooms/{mã}/sv (mọi trạng thái đều ở Firebase, nên host rớt mạng thì host mới chạy tiếp được):
//   sv/roster {id: tên}   sv/total        — danh sách người chơi lúc bắt đầu (ghi 1 lần)
//   sv/round              — vòng hiện tại: n, phase, phaseRound, game, wordsJson, max, durationSec, startAt, alive
//   sv/res/r{n}/{id}      — kết quả của từng người (MỖI NGƯỜI GHI 1 LẦN/VÒNG), host đọc rồi XÓA ngay sau khi chốt vòng
//   sv/end                — kết quả vòng vừa xong: n, kind, elimJson, dangerJson, boardJson, finished, nextAt …
//   sv/state              — trạng thái luật (chuỗi JSON) để host mới đọc lại được
//   sv/final              — {winner, boardJson} khi kết thúc ván
// Thời điểm sang vòng sau/kết thúc lưu bằng mốc giờ (sv/end.nextAt) chứ không dùng bộ đếm trong máy host.
(function (root) {
  const Core = () => root.SurvivalCore;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const grace = () => (root.BossRules && root.BossRules.OFFLINE_GRACE_MS) || 12000;
  const firstDelay = () => (root.BossRules && root.BossRules.FIRST_STAGE_DELAY_MS) || 8000;

  const H = { used: {}, raw: null, st: null, busy: false };   // riêng máy host; mất khi đổi host (chỉ có thể lặp từ)

  const pairs = (ids, st) => JSON.stringify(ids.map(id => [id, st.total[id] || 0]));
  const boardJson = st => JSON.stringify(Core().ranking(st).map(r => [r.id, r.score, r.alive ? 1 : 0, r.rounds]));

  function planRound(engine, st, delayMs) {
    const vocab = typeof vocabData !== "undefined" ? vocabData : [];
    const pick = Core().pickRound(vocab, st.phase, st.lastGame, H.used, root.BossGames && root.BossGames.ids);
    st.lastGame = pick.game;
    pick.words.forEach(w => (H.used[w.word] = true));
    return {
      "sv/round": {
        n: st.round + 1, phase: st.phase, phaseRound: st.phaseRound + 1, game: pick.game,
        wordsJson: JSON.stringify(pick.words), max: pick.max, durationSec: pick.durationSec,
        startAt: engine.serverNow() + delayMs, alive: st.alive.length
      },
      "sv/state": JSON.stringify(st)
    };
  }

  // Chủ phòng bấm Bắt đầu (được gọi từ BossNet.startGame khi chế độ là survival)
  async function start(engine, r) {
    if (r.hostId !== engine.id) throw err("NOT_HOST", "Chỉ chủ phòng mới bắt đầu được.");
    if (r.state !== "lobby") throw err("ALREADY_STARTED");
    const all = engine.getPlayers(), live = all.filter(p => p.online);
    if (live.length < 2) throw err("NOT_ENOUGH_PLAYERS", "Cần ít nhất 2 người.");
    if (live.length > Core().SV.MAX_PLAYERS) throw err("ROOM_FULL", "Tối đa " + Core().SV.MAX_PLAYERS + " người.");

    const st = Core().newState(live.map(p => p.id));
    H.used = {}; H.raw = null; H.busy = false;
    const roster = {};
    live.forEach(p => (roster[p.id] = p.name));
    const up = { state: "playing", mode: "survival", "sv/roster": roster, "sv/total": live.length };
    all.forEach(p => { if (!p.online) up["players/" + p.id] = null; });     // người đang offline bị bỏ
    Object.assign(up, planRound(engine, st, firstDelay()));
    await engine.db.update(engine._p(), up);
  }

  // Chạy mỗi 0,4 giây trên máy chủ phòng
  function tick(engine, r, now) {
    if (H.busy) return;
    const up = {};
    let dirty = false;

    // 0. dọn người mất kết nối quá lâu (giống BossBattle)
    Object.keys(r.players).forEach(id => {
      const p = r.players[id];
      if (id !== engine.id && p.online === false && typeof p.offlineAt === "number" && now - p.offlineAt > grace()) {
        up["players/" + id] = null; dirty = true;
      }
    });

    const sv = r.sv;
    if (r.state === "playing" && sv && sv.round && sv.state) {
      if (H.raw !== sv.state) { H.raw = sv.state; H.st = JSON.parse(sv.state); }
      let st = H.st;
      const rd = sv.round, end = sv.end;
      const SV = Core().SV;

      // 1. người đã rời phòng → bị loại ngay
      const gone = st.finished ? [] : st.alive.filter(id => !r.players[id]);
      if (gone.length) {
        st = Core().dropPlayers(st, gone).state;
        up["sv/state"] = JSON.stringify(st); dirty = true;
        if (st.finished) {                               // chỉ còn 1 người: kết thúc luôn
          up["sv/end"] = {
            n: rd.n, phase: st.phase, nextPhase: st.phase, kind: "elim", elimJson: pairs(gone, st), dangerJson: "[]",
            alive: st.alive.length, boardJson: boardJson(st), finished: true, nextAt: now + SV.RESULT_MS
          };
        }
      }

      const ended = (end && end.n >= rd.n) || (up["sv/end"] && up["sv/end"].n >= rd.n);
      const endsAt = rd.startAt + rd.durationSec * 1000, deadline = endsAt + 600;

      if (!ended) {
        // 2. chốt vòng: mọi người còn sống đã nộp, hoặc hết giờ
        const res = (sv.res && sv.res["r" + rd.n]) || {};
        if (now >= rd.startAt && (st.alive.every(id => res[id]) || now >= deadline)) {
          const results = {};
          st.alive.forEach(id => {
            const x = res[id];
            if (x && typeof x.at === "number" && x.at <= deadline + 500) {          // nộp trễ thì không tính
              results[id] = { score: clamp(+x.s || 0, 0, 1), wrong: clamp(Math.floor(+x.w || 0), 0, rd.max), timeMs: clamp(+x.t || 0, 0, rd.durationSec * 1000) };
            }
          });
          const out = Core().resolveRound(st, results), ns = out.state, rep = out.report;
          up["sv/state"] = JSON.stringify(ns);
          up["sv/end"] = {
            n: rd.n, phase: rep.phase, nextPhase: ns.phase, kind: rep.kind, elimJson: pairs(rep.elim, ns),
            dangerJson: pairs(rep.danger, ns), line: rep.line, alive: ns.alive.length, boardJson: boardJson(ns),
            finished: ns.finished, nextAt: now + SV.RESULT_MS
          };
          up["sv/res/r" + rd.n] = null;                  // xóa kết quả đã dùng để phòng không phình to
          dirty = true;
        }
      } else if (end && now >= end.nextAt) {
        if (end.finished) {
          if (!sv.final) { up.state = "finished"; up["sv/final"] = { winner: st.winner || "", boardJson: end.boardJson }; dirty = true; }
        } else if (rd.n === end.n) {                     // sang vòng sau
          Object.assign(up, planRound(engine, st, SV.COUNTDOWN_MS)); dirty = true;
        }
      }
    }

    if (dirty) {
      H.busy = true;
      engine.db.update(engine._p(), up).catch(e => console.error("[Survival] ghi lỗi:", e)).then(() => { H.busy = false; });
    }
  }

  root.SurvivalHost = { start, tick };
  if (root.BossNet && root.BossNet.registerMode) root.BossNet.registerMode("survival", { start, tick });
  else console.warn("[Survival] boss-net.js chưa có registerMode: hãy vá boss-net.js trước khi nạp survivalHost.js");
})(typeof window !== "undefined" ? window : globalThis);
