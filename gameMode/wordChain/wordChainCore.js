// wordChain/wordChainCore.js — luật Word Chain nhiều người (logic thuần, không DOM, không mạng).
// Dữ liệu từ (wordChainData) được TRUYỀN VÀO từng hàm, không đọc trực tiếp, nên file này nạp được cả ở room.html.
//
// Luật: các người chơi lần lượt nối từ (chữ đầu từ mới = chữ cuối từ trước, không dùng lại từ đã có).
//   - Mỗi lượt TURN_MS; hết giờ hoặc sai MAX_WRONG lần liên tiếp thì mất 1 mạng (mỗi người LIVES mạng).
//   - Hết mạng thì bị loại; tới lượt mà không còn từ nào để nối cũng bị loại.
//   - Còn đúng 1 người thì người đó thắng. Hạng của người bị loại: loại càng muộn hạng càng cao.
(function (root) {

  const WC = {
    TURN_MS: 30000,        // thời gian mỗi lượt
    LIVES: 2,              // số mạng mỗi người
    MAX_WRONG: 5,          // sai liên tiếp bao nhiêu lần thì mất 1 mạng
    COUNTDOWN_MS: 4000,    // đếm ngược trước lượt đầu
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 12
  };

  const hash = str => {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const rng = seed => {                                   // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const shuffle = (arr, rand) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const lastLetter = w => w[w.length - 1];

  // Các từ chưa dùng có thể nối tiếp sau từ `word`
  const available = (data, word, used) => ((data.startsWith && data.startsWith[lastLetter(word)]) || []).filter(w => !used.has(w));

  // Từ mở màn: chọn theo seed (mọi máy chọn giống nhau), và phải còn từ để nối tiếp
  function pickStartWord(data, seed) {
    const keys = Object.keys(data.lookup).sort(), rand = rng(hash("wc:" + seed));
    for (let i = 0; i < 80; i++) {
      const w = keys[Math.floor(rand() * keys.length)];
      if (available(data, w, new Set([w])).length > 0) return w;
    }
    return keys[0];
  }

  // Kiểm tra từ người chơi gõ
  function checkWord(data, cur, used, word) {
    if (!word || !has(data.lookup, word)) return { ok: false, reason: "Từ này không tồn tại" };
    if (used.has(word)) return { ok: false, reason: "Từ này đã được dùng rồi" };
    if (word[0] !== lastLetter(cur)) return { ok: false, reason: "Cần bắt đầu bằng chữ " + lastLetter(cur).toUpperCase() };
    return { ok: true };
  }

  /* ----- Trạng thái ván: lưu ở rooms/{mã}/wc/st = { n, p, w, dl, s: "JSON" } -----
     n: số thứ tự lượt, p: người đang tới lượt, w: từ hiện tại, dl: hạn của lượt (giờ máy chủ),
     s: { order, lives, scores, out (thứ tự bị loại), left (những người đã rời phòng) } */
  function newState(order, startWord, dl) {
    const lives = {}, scores = {};
    order.forEach(id => { lives[id] = WC.LIVES; scores[id] = 0; });
    return { n: 1, p: order[0], w: startWord, dl, order: [...order], lives, scores, out: [], left: [] };
  }
  const pack = S => ({ n: S.n, p: S.p, w: S.w, dl: S.dl, s: JSON.stringify({ order: S.order, lives: S.lives, scores: S.scores, out: S.out, left: S.left }) });
  function parse(st) {
    let x = {};
    try { x = JSON.parse(st.s || "{}"); } catch (e) { /* để trống */ }
    return { n: st.n, p: st.p, w: st.w, dl: st.dl, order: x.order || [], lives: x.lives || {}, scores: x.scores || {}, out: x.out || [], left: x.left || [] };
  }
  const aliveIds = S => S.order.filter(id => S.lives[id] > 0);
  const usedFrom = mv => new Set(Object.values(mv || {}).map(m => m && m.w).filter(Boolean));

  const playWord = (S, word) => { S.scores[S.p] = (S.scores[S.p] || 0) + 1; S.w = word; };
  function loseLife(S, id) {
    if (!(S.lives[id] > 0)) return;
    S.lives[id]--;
    if (S.lives[id] <= 0 && !S.out.includes(id)) S.out.push(id);
  }
  function leave(S, id) {
    if (S.lives[id] > 0 || !S.out.includes(id)) { S.lives[id] = 0; if (!S.out.includes(id)) S.out.push(id); }
    if (!S.left.includes(id)) S.left.push(id);
  }
  function nextAlive(S, from) {
    const o = S.order, i = o.indexOf(from);
    for (let k = 1; k <= o.length; k++) { const id = o[(i + k) % o.length]; if (S.lives[id] > 0) return id; }
    return null;
  }

  // Chuyển sang lượt kế. Ai tới lượt mà hết từ để nối thì bị loại ngay (người nước đi trước đó thắng nếu mọi người sau đều hết từ).
  // Trả về { over: true } khi chỉ còn ≤ 1 người.
  function advance(S, data, used, now, turnMs) {
    for (let guard = 0; guard <= S.order.length; guard++) {
      if (aliveIds(S).length <= 1) return { over: true };
      const nx = nextAlive(S, S.p);
      S.p = nx; S.n++; S.dl = now + turnMs;
      if (available(data, S.w, used).length > 0) return { over: false };
      S.lives[nx] = 0; if (!S.out.includes(nx)) S.out.push(nx);       // hết từ để nối: loại ngay
    }
    return { over: true };
  }

  // Xếp hạng: người còn sống (điểm cao hơn trên), rồi người bị loại muộn hơn đứng trên.
  function rank(S) {
    const alive = aliveIds(S).sort((a, b) => (S.scores[b] || 0) - (S.scores[a] || 0) || (S.lives[b] || 0) - (S.lives[a] || 0) || S.order.indexOf(a) - S.order.indexOf(b));
    const dead = [...S.out].reverse().filter((id, i, a) => a.indexOf(id) === i);
    return [...alive, ...dead].map((id, i) => ({ id, rank: i + 1, score: S.scores[id] || 0, lives: Math.max(0, S.lives[id] || 0), left: S.left.includes(id) }));
  }

  const api = { WC, hash, rng, shuffle, available, pickStartWord, checkWord, newState, pack, parse, aliveIds, usedFrom, playWord, loseLife, leave, advance, rank };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WordChainCore = api;

})(typeof window !== "undefined" ? window : globalThis);
