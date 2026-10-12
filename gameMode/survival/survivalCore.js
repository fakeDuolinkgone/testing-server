// survival/survivalCore.js — luật Survival (logic thuần, không DOM, không mạng).
// Cần BossCore (bossCore.js) nạp trước để dùng danh sách mini game theo mức độ.
(function (root) {

  const SV = {
    MAX_PLAYERS: 80,
    QUESTIONS: 6,                // số câu mỗi vòng
    MATCH_PAIRS: 5,              // Nối cột: 5 cặp
    WRONG_PENALTY: 0.5,          // điểm vòng = (đúng - 0.5 × sai) / tối đa
    PLAY_SEC: { 1: 35, 2: 40, 3: 45 },   // giây chơi mỗi vòng (giai đoạn 1, 2, 3)
    COUNTDOWN_MS: 4000,          // đếm ngược trước mỗi vòng
    RESULT_MS: 8000,             // thời gian hiện kết quả sau mỗi vòng
    FEEDBACK_MS: 600,            // dừng sau mỗi câu để người chơi kịp thấy đúng/sai
    TIER: { 1: "easy", 2: "medium", 3: "hard" },
    P1_ROUNDS: 2,                // giai đoạn 1: 2 vòng, không ai bị loại (trừ người bỏ trống cả 2 vòng)
    ELIM_EVERY: 2,               // giai đoạn 2: cứ 2 vòng loại một lần
    ELIM_COUNT: 5,               // mỗi lần loại 5 người điểm thấp nhất
    P3_AT: 5,                    // còn ≤ 5 người thì sang giai đoạn 3
    P3_MAX_ROUNDS: 30            // giai đoạn 3: mỗi vòng loại 1 người, trần 30 vòng
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const round3 = x => Math.round(x * 1000) / 1000;
  const roundScore = (correct, wrong, max) =>
    max ? round3(Math.max(0, correct - SV.WRONG_PENALTY * wrong) / max) : 0;   // thang 0..1
  const trim = w => ({
    word: w.word, classword: w.classword || "",
    meaning: Array.isArray(w.meaning) ? w.meaning : [w.meaning], example: w.example || ""
  });

  // Chọn mini game + bộ từ cho một vòng: đúng mức độ của giai đoạn, không lặp game vòng trước
  function pickRound(vocab, phase, lastGame, used, enabled) {
    const B = root.BossCore;
    let opts = B.GAMES.filter(g => g.tier === SV.TIER[phase] && (!enabled || enabled.includes(g.id)));
    const other = opts.filter(g => g.id !== lastGame);
    if (other.length) opts = other;
    const g = opts[Math.floor(Math.random() * opts.length)];
    const n = g.id === "match" ? SV.MATCH_PAIRS : SV.QUESTIONS;

    const okWord = w => w && w.word && w.meaning && w.meaning[0];
    let fresh = vocab.filter(w => okWord(w) && !(used || {})[w.word]);
    if (fresh.length < n * 3) fresh = vocab.filter(okWord);          // hết từ mới thì dùng lại
    let words = B.shuffle(fresh.filter(g.ok)).slice(0, n);
    if (words.length < n) words = words.concat(B.shuffle(fresh.filter(w => !words.includes(w))).slice(0, n - words.length));
    return { game: g.id, words: words.map(trim), max: n, durationSec: SV.PLAY_SEC[phase] };
  }

  const newState = ids => ({
    phase: 1, round: 0, phaseRound: 0, alive: [...ids],
    events: [],            // mỗi lần loại: [id…] xếp từ tệ nhất đến ít tệ nhất
    outRound: {},          // vòng bị loại của từng người
    total: {}, pair: {}, p3: {}, seen: {}, p3Rounds: 0,
    finished: false, winner: null
  });

  // results: { id: { score(0..1), wrong, timeMs } }  — người không nộp thì không có mục
  function resolveRound(st, results) {
    const s = clone(st);
    s.round++; s.phaseRound++;
    const phase = s.phase;
    const cur = {};
    s.alive.forEach(id => {
      cur[id] = results[id] || { score: 0, wrong: 0, timeMs: SV.PLAY_SEC[phase] * 1000, none: true };
    });
    s.alive.forEach(id => {
      const r = cur[id];
      s.total[id] = round3((s.total[id] || 0) + r.score);
      if (!r.none) s.seen[id] = true;
      const p = s.pair[id] || (s.pair[id] = { score: 0, wrong: 0, timeMs: 0 });
      p.score = round3(p.score + r.score); p.wrong += r.wrong; p.timeMs += r.timeMs;
      if (phase === 3) s.p3[id] = round3((s.p3[id] || 0) + r.score);
    });

    const rep = { round: s.round, phase, kind: "safe", elim: [], danger: [], line: null, finished: false };
    // thấp điểm → nhiều sai → chậm hơn thì xếp tệ hơn
    const worst = (ids, m) => [...ids].sort((a, b) =>
      m[a].score - m[b].score || m[b].wrong - m[a].wrong || m[b].timeMs - m[a].timeMs || (a < b ? -1 : 1));
    const out = ids => {
      if (!ids.length) return;
      s.events.push(ids);
      ids.forEach(id => (s.outRound[id] = s.round));
      s.alive = s.alive.filter(id => !ids.includes(id));
      rep.elim = ids; rep.kind = "elim";
    };

    if (phase === 1) {
      if (s.phaseRound >= SV.P1_ROUNDS) {
        const afk = s.alive.filter(id => !s.seen[id]);
        if (afk.length < s.alive.length) out(afk);                      // luôn giữ lại ít nhất 1 người
        s.phase = s.alive.length > SV.P3_AT ? 2 : 3; s.phaseRound = 0; s.pair = {};
      }
    } else if (phase === 2) {
      const k = Math.min(SV.ELIM_COUNT, s.alive.length - SV.P3_AT);
      const order = worst(s.alive, s.pair);
      rep.line = order[k] ? s.pair[order[k]].score : null;              // điểm của người thấp nhất trong nhóm an toàn
      if (s.phaseRound % SV.ELIM_EVERY === 0) {
        out(order.slice(0, k)); s.pair = {};
        if (s.alive.length <= SV.P3_AT) { s.phase = 3; s.phaseRound = 0; }
      } else { rep.kind = "danger"; rep.danger = order.slice(0, k); }   // vòng lẻ: báo "nguy hiểm", chưa loại
    } else {
      s.p3Rounds++;
      if (s.alive.length > 1) {                                         // nhiều lỗi nhất → thấp điểm → chậm hơn
        const order = [...s.alive].sort((a, b) =>
          cur[b].wrong - cur[a].wrong || cur[a].score - cur[b].score || cur[b].timeMs - cur[a].timeMs || (a < b ? -1 : 1));
        out([order[0]]);
      }
      s.pair = {};
    }

    if (s.alive.length <= 1) s.finished = true;
    else if (s.phase === 3 && s.p3Rounds >= SV.P3_MAX_ROUNDS) {         // chạm trần: xếp theo tổng điểm giai đoạn 3
      const order = [...s.alive].sort((a, b) =>
        (s.p3[b] || 0) - (s.p3[a] || 0) || (s.total[b] || 0) - (s.total[a] || 0) || (a < b ? -1 : 1));
      out(order.slice(1).reverse());
      s.finished = true;
    }
    if (s.finished) { s.winner = s.alive[0]; rep.finished = true; }
    return { state: s, report: rep };
  }

  // Bảng xếp hạng: người còn sống theo tổng điểm, rồi người bị loại sau xếp trên người bị loại trước
  function ranking(st) {
    const alive = [...st.alive].sort((a, b) =>
      (st.finished ? (b === st.winner) - (a === st.winner) : 0) ||
      (st.total[b] || 0) - (st.total[a] || 0) || (a < b ? -1 : 1));
    const dead = [];
    [...st.events].reverse().forEach(e => dead.push(...[...e].reverse()));
    return [...alive, ...dead].map((id, i) => ({
      id, rank: i + 1, alive: st.alive.includes(id),
      score: st.total[id] || 0, rounds: st.outRound[id] || st.round
    }));
  }

  // Người rời phòng giữa ván: bị loại ngay (xếp dưới những người bị loại trước đó trong cùng đợt)
  function dropPlayers(st, ids) {
    const gone = ids.filter(id => st.alive.includes(id));
    if (!gone.length) return { state: st, changed: false };
    const s = clone(st);
    s.events.push(gone);
    gone.forEach(id => (s.outRound[id] = s.round));
    s.alive = s.alive.filter(id => !gone.includes(id));
    if (s.alive.length <= 1) { s.finished = true; s.winner = s.alive[0] || null; }
    else if (s.phase === 2 && s.alive.length <= SV.P3_AT) { s.phase = 3; s.phaseRound = 0; s.pair = {}; }
    return { state: s, changed: true, gone };
  }

  const api = { SV, roundScore, pickRound, newState, resolveRound, dropPlayers, ranking };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SurvivalCore = api;

})(typeof window !== "undefined" ? window : globalThis);
