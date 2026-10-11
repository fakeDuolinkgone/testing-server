// bossBattle/bossCore.js
// Logic thuần của BossBattle: KHÔNG dùng DOM, KHÔNG dùng mạng.
// Mọi máy cho cùng (seed, playerCount, vocab) sẽ ra CÙNG một kế hoạch ván đấu,
// nên qua mạng chỉ cần gửi seed chứ không cần gửi danh sách từ → tiết kiệm đọc/ghi Firebase.
(function (root) {

  const CFG = {
    QUESTIONS_PER_STAGE: 10,
    TARGET_ACCURACY: 0.7,                              // mỗi người cần đúng ~70% để thắng (chỉnh sau khi thử với lớp)
    STAGE_TIME: { easy: 40, medium: 50, hard: 60 },    // giây
    // Độ khó từng giai đoạn theo số giai đoạn của ván (3 / 4 / 5)
    TIER_PLAN: {
      3: ["easy", "medium", "hard"],
      4: ["easy", "medium", "medium", "hard"],
      5: ["easy", "easy", "medium", "hard", "hard"]
    },
    BOSSES: ["boss1", "boss2", "boss3"]
  };

  // Từ nào phù hợp với mini game nào (ví dụ gõ 4 giây/từ thì chỉ lấy từ ngắn)
  const isAlpha = w => /^[a-z]+$/i.test(w.word);
  const hasMeaning = w => !!(w.meaning && w.meaning[0]);
  const hasExample = w => isAlpha(w) && !!w.example &&
    new RegExp(`\\b${w.word}(s|es|ed|ing)?\\b`, "i").test(w.example);

  const GAMES = [
    { id: "choiceEnVi", tier: "easy", ok: hasMeaning },
    { id: "trueFalse", tier: "easy", ok: hasMeaning },
    { id: "speedTyping", tier: "easy", ok: w => isAlpha(w) && w.word.length <= 8 },
    { id: "match", tier: "medium", ok: hasMeaning },
    { id: "choiceViEn", tier: "medium", ok: hasMeaning },
    { id: "unscramble", tier: "hard", ok: w => isAlpha(w) && w.word.length >= 4 && w.word.length <= 9 },
    { id: "sentenceFill", tier: "hard", ok: hasExample },
    { id: "hangman", tier: "hard", ok: w => isAlpha(w) && w.word.length <= 7 },
    { id: "missingLetters", tier: "medium", ok: w => isAlpha(w) && w.word.length >= 4 }
  ];

  // Bộ random có seed (mulberry32): cùng seed → cùng dãy số trên mọi máy
  const rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Dùng rand có seed cho kế hoạch chung; dùng Math.random cho phần xáo riêng từng người
  const shuffle = (arr, rand = Math.random) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const stageCount = n => (n <= 5 ? 3 : n <= 10 ? 4 : 5);

  // HP = số người × số giai đoạn × (10 câu × 70%) = người × giai đoạn × 7
  const hpPerPlayerStage = () => CFG.QUESTIONS_PER_STAGE * CFG.TARGET_ACCURACY;
  const hpFor = (players, stages = stageCount(players)) =>
    Math.round(players * stages * hpPerPlayerStage());

  // Người thoát: HP giảm theo phần họ chưa kịp đóng góp (tính cả giai đoạn đang vắng mặt)
  const hpLossOnLeave = stagesLeft => Math.round(stagesLeft * hpPerPlayerStage());

  const isBossDead = (hp, totalDamage) => totalDamage >= hp;

  // Kế hoạch cả ván, dựng hoàn toàn từ seed
  // enabled (tuỳ chọn): danh sách id mini game đã làm xong; bỏ trống = dùng tất cả
  function buildPlan(seed, playerCount, vocab, enabled) {
    const pool = enabled ? GAMES.filter(g => enabled.includes(g.id)) : GAMES;
    const rand = rng(seed);
    const stages = stageCount(playerCount);
    const boss = CFG.BOSSES[Math.floor(rand() * CFG.BOSSES.length)];
    const order = shuffle(vocab.map((_, i) => i), rand);
    const usedWords = new Set();
    const usedGames = new Set();

    const plan = CFG.TIER_PLAN[stages].map((tier, index) => {
      let options = pool.filter(g => g.tier === tier && !usedGames.has(g.id));
      if (!options.length) options = pool.filter(g => g.tier === tier);   // dự phòng
      const game = options[Math.floor(rand() * options.length)];
      usedGames.add(game.id);

      let ids = order
        .filter(i => !usedWords.has(i) && game.ok(vocab[i]))
        .slice(0, CFG.QUESTIONS_PER_STAGE);
      if (ids.length < CFG.QUESTIONS_PER_STAGE) {   // thiếu từ phù hợp → bù bằng từ chưa dùng
        ids = ids
          .concat(order.filter(i => !usedWords.has(i) && !ids.includes(i)))
          .slice(0, CFG.QUESTIONS_PER_STAGE);
      }
      ids.forEach(i => usedWords.add(i));

      return { index, tier, game: game.id, time: CFG.STAGE_TIME[tier], wordIds: ids };
    });

    return { seed, boss, stages, hp: hpFor(playerCount, stages), plan };
  }

  // players: [{ id, name, damage, timeMs }] → xếp hạng. Hòa điểm thì ai nhanh hơn xếp trên.
  function rank(players) {
    const total = players.reduce((s, p) => s + p.damage, 0);
    const sorted = [...players].sort((a, b) =>
      b.damage - a.damage || a.timeMs - b.timeMs || String(a.id).localeCompare(String(b.id)));
    return sorted.map((p, i) => ({
      ...p,
      place: i + 1,
      share: total ? p.damage / total : 0,     // % đóng góp vào tổng sát thương
      gap: sorted[0].damage - p.damage         // chênh lệch so với MVP
    }));
  }

  // Dùng khi nối với boss-net.js: host gọi cho TỪNG giai đoạn.
  // usedWords: { từ: true } các từ đã dùng; usedGames: id các mini game đã dùng ở giai đoạn trước.
  // Trả về { game, words } — words rút gọn còn 4 trường để ghi lên Firebase cho nhẹ.
  function pickStage(vocab, n, stageCount, usedWords, usedGames) {
    const tier = CFG.TIER_PLAN[stageCount][Math.min(n, stageCount) - 1];
    usedWords = usedWords || {};
    usedGames = usedGames || [];
    let options = GAMES.filter(g => g.tier === tier && !usedGames.includes(g.id));
    if (!options.length) options = GAMES.filter(g => g.tier === tier);
    const game = options[Math.floor(Math.random() * options.length)];

    const fresh = vocab.filter(w => w && w.word && hasMeaning(w) && !usedWords[w.word]);
    const Q = CFG.QUESTIONS_PER_STAGE;
    let words = shuffle(fresh.filter(game.ok)).slice(0, Q);
    if (words.length < Q) words = words.concat(shuffle(fresh.filter(w => !words.includes(w))).slice(0, Q - words.length));

    return {
      game: game.id,
      words: words.map(w => ({
        word: w.word,
        classword: w.classword || "",
        meaning: Array.isArray(w.meaning) ? w.meaning : [w.meaning],
        example: w.example || ""
      }))
    };
  }

  const api = { CFG, GAMES, rng, shuffle, stageCount, hpFor, hpLossOnLeave, isBossDead, buildPlan, pickStage, rank };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BossCore = api;

})(typeof window !== "undefined" ? window : globalThis);