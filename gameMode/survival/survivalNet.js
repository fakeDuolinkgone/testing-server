// survival/survivalNet.js — BẢN GIẢ LẬP của lớp mạng Survival: host và bot chạy ngay trong trình duyệt.
//
// HỢP ĐỒNG mà bản Firebase thật phải giữ (game chỉ gọi đúng các hàm này, không biết gì về Firebase):
//   net.id, net.names[id], net.total
//   net.onRoundStart(cb)  cb(r): { round, phase, phaseRound, game, words[], max, durationSec,
//                                  startAt, endsAt, alive, total, board?, serverNow() }
//   net.sendResult(round, { correct, wrong, max, timeMs })   ← mỗi người GHI ĐÚNG 1 LẦN mỗi vòng
//   net.onRoundEnd(cb)    cb(p): { round, phase, nextPhase, kind: safe|danger|elim, elim[], danger[], line,
//                                  alive, total, board[], meAlive, myRank, finished }
//   net.onGameEnd(cb)     cb(g): { winnerId, ranking[], myRank }
//   net.start(), net.leave()
// Gợi ý cho bản thật (80 người, tiết kiệm băng thông): host là người duy nhất nghe kết quả của mọi người,
// rồi ghi MỘT nhánh công khai nhỏ mỗi vòng (vòng hiện tại, danh sách còn sống, kết quả); người chơi chỉ nghe nhánh đó.
(function (root) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function create(opts) {
    const Core = opts.core || root.SurvivalCore;
    const scale = opts.timeScale || 1;
    const T = ms => ms / scale;                      // timeScale > 1: chạy nhanh hơn để thử
    const now = () => Date.now();
    const n = clamp(opts.players || 12, 2, Core.SV.MAX_PLAYERS);

    const ids = ["me"], names = { me: opts.name || "Bạn" }, skill = {};
    for (let i = 1; i < n; i++) {
      ids.push("bot" + i); names["bot" + i] = "Bot " + i; skill["bot" + i] = 0.45 + Math.random() * 0.5;
    }

    let st = Core.newState(ids), cur = null, mine = null, timer = null, lastGame = null, dead = false;
    const used = {}, cb = {};
    const emit = (k, v) => cb[k] && cb[k](v);
    const info = id => ({ id, name: names[id], score: st.total[id] || 0 });
    const board = () => Core.ranking(st).map(r => ({ ...r, name: names[r.id] }));

    function startRound() {
      if (dead) return;
      const pick = Core.pickRound(opts.vocab, st.phase, lastGame, used, opts.games);
      lastGame = pick.game;
      pick.words.forEach(w => (used[w.word] = true));
      const startAt = now() + T(Core.SV.COUNTDOWN_MS);   // đếm ngược trước vòng
      cur = {
        round: st.round + 1, phase: st.phase, phaseRound: st.phaseRound + 1,
        game: pick.game, words: pick.words, max: pick.max, durationSec: pick.durationSec,
        startAt, endsAt: startAt + T(pick.durationSec * 1000),
        alive: st.alive.length, total: ids.length, board: board(), serverNow: now
      };
      mine = null;
      emit("roundStart", cur);
      timer = setTimeout(resolve, cur.endsAt - now() + T(600));
    }

    function sendResult(round, r) {
      if (!cur || round !== cur.round || mine) return;
      mine = { score: Core.roundScore(r.correct, r.wrong, r.max), wrong: r.wrong, timeMs: r.timeMs };
      if (st.alive.includes("me")) { clearTimeout(timer); timer = setTimeout(resolve, T(400)); }
    }

    function resolve() {
      clearTimeout(timer);
      if (dead) return;
      const bonus = { 1: 0.12, 2: 0, 3: -0.12 }[st.phase], results = {};
      st.alive.forEach(id => {
        if (id === "me") { if (mine) results.me = mine; return; }
        const acc = clamp(skill[id] + bonus + (Math.random() - 0.5) * 0.25, 0, 1);
        const correct = Math.round(cur.max * acc);
        const wrong = Math.round((cur.max - correct) * (0.3 + Math.random() * 0.5));
        results[id] = {
          score: Core.roundScore(correct, wrong, cur.max), wrong,
          timeMs: cur.durationSec * 1000 * (0.35 + Math.random() * 0.6)
        };
      });
      const r = Core.resolveRound(st, results);
      st = r.state;
      const b = board(), me = b.find(x => x.id === "me");
      emit("roundEnd", {
        round: r.report.round, phase: r.report.phase, nextPhase: st.phase, kind: r.report.kind,
        elim: r.report.elim.map(info), danger: r.report.danger.map(info), line: r.report.line,
        alive: st.alive.length, total: ids.length, board: b,
        meAlive: st.alive.includes("me"), myRank: me.rank, finished: st.finished
      });
      if (st.finished) setTimeout(() => !dead && emit("gameEnd", { winnerId: st.winner, ranking: b, myRank: me.rank }), T(Core.SV.RESULT_MS));
      else setTimeout(startRound, T(Core.SV.RESULT_MS));   // hiện kết quả vòng rồi sang vòng sau
    }

    return {
      id: "me", names, total: ids.length,
      onRoundStart: f => (cb.roundStart = f),
      onRoundEnd: f => (cb.roundEnd = f),
      onGameEnd: f => (cb.gameEnd = f),
      start() { setTimeout(startRound, T(1500)); },
      sendResult,
      leave() { dead = true; clearTimeout(timer); }
    };
  }

  // ===== BẢN THẬT: nối với phòng của BossNet (Firebase) — cùng hợp đồng như bản giả lập ở trên =====
  // engine = đối tượng BossNet.create() đã resume() vào phòng. Dữ liệu nằm ở rooms/{mã}/sv (xem survivalHost.js).
  // Máy này chỉ GHI 1 lần mỗi vòng (kết quả của mình); mọi thứ còn lại là đọc từ dữ liệu phòng đã có sẵn trên máy.
  function connect(engine) {
    const Core = root.SurvivalCore, cb = {};
    let lastRound = 0, lastEnd = 0, gaveFinal = false, boot = true, timer = null;
    const emit = (k, v) => cb[k] && cb[k](v);
    const sv = () => (engine.room && engine.room.sv) || null;
    const names = () => (sv() && sv().roster) || {};
    const parse = j => { try { return JSON.parse(j || "[]"); } catch (e) { return []; } };
    const board = j => parse(j).map((a, i) => ({ id: a[0], rank: i + 1, score: a[1], alive: !!a[2], rounds: a[3], name: names()[a[0]] || "?" }));
    const info = a => ({ id: a[0], name: names()[a[0]] || "?", score: a[1] });
    const mine = b => b.find(x => x.id === engine.id);

    function check() {
      const s = sv();
      if (!s) return;
      const rd = s.round, end = s.end;

      if (end && end.n > lastEnd) {
        lastEnd = end.n;
        const stale = boot && rd && end.n < rd.n;       // vào lại giữa vòng: bỏ qua kết quả của vòng cũ
        if (!stale) {
          const b = board(end.boardJson), me = mine(b);
          emit("roundEnd", {
            round: end.n, phase: end.phase, nextPhase: end.nextPhase, kind: end.kind,
            elim: parse(end.elimJson).map(info), danger: parse(end.dangerJson).map(info),
            line: end.line === undefined ? null : end.line, alive: end.alive, total: s.total || 0,
            board: b, meAlive: me ? me.alive : true, myRank: me ? me.rank : 0, finished: !!end.finished
          });
        }
      }

      if (rd && rd.n > lastRound) {
        lastRound = rd.n;
        if (!(end && end.n >= rd.n)) {                  // vòng này chưa kết thúc → bắt đầu chơi
          const b = end ? board(end.boardJson) : Object.keys(names()).map((id, i) => ({ id, rank: i + 1, score: 0, alive: true, rounds: 0, name: names()[id] }));
          const me = mine(b);
          emit("roundStart", {
            round: rd.n, phase: rd.phase, phaseRound: rd.phaseRound, game: rd.game, words: parse(rd.wordsJson), max: rd.max,
            durationSec: rd.durationSec, startAt: rd.startAt, endsAt: rd.startAt + rd.durationSec * 1000,
            alive: rd.alive, total: s.total || 0, board: b, meAlive: me ? me.alive : true,
            serverNow: () => engine.serverNow()
          });
        }
      }

      if (s.final && !gaveFinal) {
        gaveFinal = true;
        const b = board(s.final.boardJson), me = mine(b);
        emit("gameEnd", { winnerId: s.final.winner, ranking: b, myRank: me ? me.rank : 0 });
      }
      boot = false;
    }

    engine.onRoomClosed(() => emit("closed"));
    engine.onRemoved(() => emit("closed"));

    return {
      get id() { return engine.id; },
      get names() { return names(); },
      get total() { return (sv() && sv().total) || 0; },
      onRoundStart: f => (cb.roundStart = f),
      onRoundEnd: f => (cb.roundEnd = f),
      onGameEnd: f => (cb.gameEnd = f),
      onClosed: f => (cb.closed = f),
      start() { timer = setInterval(check, 250); check(); },   // đọc dữ liệu phòng có sẵn trên máy, không tốn mạng
      sendResult(round, r) {                                    // GHI ĐÚNG 1 LẦN mỗi vòng
        const s = sv();
        if (!s || !s.round || s.round.n !== round) return;
        return engine.db.set(engine._p("sv/res/r" + round + "/" + engine.id),
          { s: Core.roundScore(r.correct, r.wrong, r.max), w: r.wrong, t: Math.round(r.timeMs), at: engine.db.TS });
      },
      leave() { clearInterval(timer); return engine.leaveRoom(); }
    };
  }

  root.SurvivalNet = { create, connect };
})(typeof window !== "undefined" ? window : globalThis);
