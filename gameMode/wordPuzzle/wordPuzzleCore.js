// wordPuzzle/wordPuzzleCore.js — luật và thuật toán của Word Puzzle (logic thuần, không DOM, không mạng).
// Cần BossCore (bossCore.js) nạp trước: dùng bộ random có seed rng() và shuffle().
(function (root) {

  const WP = {
    // 3 level: kích thước bảng, số từ, số giây, các hướng đặt từ (E ngang, S dọc, SE chéo xuống, NE chéo lên), độ dài từ
    LEVELS: [
      { size: 6, words: 3, sec: 75, dirs: ["E", "S"], len: [3, 5] },
      { size: 8, words: 4, sec: 100, dirs: ["E", "S"], len: [4, 6] },
      { size: 9, words: 5, sec: 120, dirs: ["E", "S", "SE", "NE"], len: [5, 8] }
    ],
    WORD_BASE: 10,        // điểm cơ bản mỗi từ
    SPEED_BONUS: 10,      // thưởng thêm tối đa, tỉ lệ với thời gian còn lại lúc tìm được từ
    CLEAR_BONUS: 10,      // thưởng khi tìm đủ mọi từ của level
    COUNTDOWN_MS: 4000,   // đếm ngược trước level 1
    BETWEEN_MS: 3000,     // nghỉ giữa các level
    REVEAL_MS: 2200,      // thời gian hiện các từ chưa tìm được khi hết level
    GRACE_MS: 20000,      // chờ thêm sau mốc cuối cùng rồi mới chốt kết quả
    MAX_PLAYERS: 80
  };
  const DIRS = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1] };   // [d hàng, d cột]

  const hash = str => {                                           // chuỗi → số nguyên 32 bit (để làm seed)
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };

  // Mốc cuối cùng mà một người chơi còn có thể đang chơi (tới đó host chốt kết quả dù còn ai chưa xong)
  const deadline = startAt =>
    startAt + WP.LEVELS.reduce((s, L) => s + L.sec * 1000 + WP.BETWEEN_MS + WP.REVEAL_MS, 0) + WP.GRACE_MS;

  // Bộ từ của một level: CHUNG cho mọi người (cùng seed → cùng từ). Không từ nào nằm lọt trong từ khác (kể cả viết ngược).
  function pickWords(vocab, seed, level) {
    const B = root.BossCore, L = WP.LEVELS[level], out = [];
    const rand = B.rng(hash(`${seed}:words:${level}`));
    const inside = (a, b) => a.includes(b) || b.includes(a);
    const rev = s => [...s].reverse().join("");
    for (let widen = 0; widen <= 3 && out.length < L.words; widen++) {      // thiếu từ thì nới dần khoảng độ dài
      const lo = Math.max(3, L.len[0] - widen), hi = Math.min(L.size, L.len[1] + widen);
      const pool = B.shuffle(vocab.filter(w => w && w.word && /^[a-z]+$/i.test(w.word) &&
        w.word.length >= lo && w.word.length <= hi && w.meaning && w.meaning[0]), rand);
      for (const w of pool) {
        const x = w.word.toLowerCase();
        if (out.some(o => o.word === x || inside(o.word, x) || inside(o.word, rev(x)))) continue;
        out.push({ word: x, classword: w.classword || "", meaning: Array.isArray(w.meaning) ? w.meaning[0] : String(w.meaning) });
        if (out.length === L.words) break;
      }
    }
    return out;
  }

  // Sinh bảng: key riêng từng người nên mỗi người một bảng khác nhau (không chép được) dù cùng bộ từ.
  function makeBoard(words, level, key) {
    const L = WP.LEVELS[level], n = L.size, dirs = L.dirs.map(d => DIRS[d]);
    for (let attempt = 0; attempt < 30; attempt++) {
      const rand = root.BossCore.rng(hash(`${key}:${attempt}`));
      const grid = Array(n * n).fill(""), placed = [];
      let ok = true;
      for (const w of [...words].sort((a, b) => b.word.length - a.word.length)) {
        let done = false;
        for (let t = 0; t < 400 && !done; t++) {
          const [dr, dc] = dirs[Math.floor(rand() * dirs.length)], len = w.word.length;
          const r0 = Math.floor(rand() * n), c0 = Math.floor(rand() * n);
          const r1 = r0 + dr * (len - 1), c1 = c0 + dc * (len - 1);
          if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
          const cells = [...w.word].map((ch, i) => ({ idx: (r0 + dr * i) * n + c0 + dc * i, ch: ch.toUpperCase() }));
          if (cells.some(c => grid[c.idx] && grid[c.idx] !== c.ch)) continue;      // chỉ được giao nhau ở chữ giống nhau
          cells.forEach(c => (grid[c.idx] = c.ch));
          placed.push({ word: w.word, cells: cells.map(c => c.idx) });
          done = true;
        }
        if (!done) { ok = false; break; }
      }
      if (!ok) continue;
      for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = String.fromCharCode(65 + Math.floor(rand() * 26));
      return { n, grid, placed };
    }
    return null;
  }

  // Các ô nằm trên đường thẳng (8 hướng) từ ô a tới ô b; null nếu a, b không thẳng hàng
  function lineCells(n, a, b) {
    const r0 = Math.floor(a / n), c0 = a % n, dr = Math.floor(b / n) - r0, dc = (b % n) - c0;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    const steps = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc = Math.sign(dc);
    return Array.from({ length: steps + 1 }, (_, i) => (r0 + sr * i) * n + c0 + sc * i);
  }

  // Khi kéo chuột/ngón tay lệch: ép điểm cuối về đường thẳng gần nhất trong 8 hướng, giữ trong bảng
  function snapEnd(n, a, b) {
    const r0 = Math.floor(a / n), c0 = a % n, dr = Math.floor(b / n) - r0, dc = (b % n) - c0;
    if (!dr && !dc) return a;
    const ang = Math.atan2(dr, dc), snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    const sr = Math.round(Math.sin(snap)), sc = Math.round(Math.cos(snap));
    let steps = Math.round(Math.hypot(dr, dc) * Math.cos(ang - snap) / Math.hypot(sr, sc));
    while (steps > 0) {
      const r = r0 + sr * steps, c = c0 + sc * steps;
      if (r >= 0 && r < n && c >= 0 && c < n) break;
      steps--;
    }
    return (r0 + sr * steps) * n + c0 + sc * steps;
  }

  // Các ô đã chọn có tạo thành một từ CHƯA tìm không (đọc xuôi hay ngược đều được)? Trả về chỉ số từ, hoặc -1.
  function matchWord(board, cells, words, found) {
    if (!cells || cells.length < 2) return -1;
    const s = cells.map(i => board.grid[i]).join("").toLowerCase(), r = [...s].reverse().join("");
    return words.findIndex((w, i) => !found.has(i) && (w.word === s || w.word === r));
  }

  // Điểm một từ: cơ bản + thưởng tốc độ (còn nhiều thời gian thì thưởng nhiều)
  const wordScore = (remainingMs, totalMs) =>
    WP.WORD_BASE + Math.round(WP.SPEED_BONUS * Math.max(0, Math.min(1, remainingMs / totalMs)));

  // entries: [{ id, name, score, timeMs, left }] → xếp hạng; hòa điểm thì ai chơi hết nhanh hơn xếp trên
  const rank = entries => [...entries]
    .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs || String(a.id).localeCompare(String(b.id)))
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const api = { WP, DIRS, hash, deadline, pickWords, makeBoard, lineCells, snapEnd, matchWord, wordScore, rank };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WordPuzzleCore = api;

})(typeof window !== "undefined" ? window : globalThis);
