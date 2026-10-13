// bossBattle/bossGames.js
// Mini game cho boss mode. Mỗi game chỉ cần một hàm tạo câu hỏi; khung run() lo phần còn lại.
// Khác chế độ LEARN: mỗi câu chỉ làm MỘT lần (không làm lại câu sai), đồng hồ do bossBattle.js giữ.
(function (root) {
  const { shuffle } = BossCore;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const M = w => w.meaning[0];
  const cls = w => (w.classword ? `(${w.classword})` : "");
  const sfx = name => { try { if (typeof window[name] === "function") window[name](); } catch (e) { } };

  // Bố cục BossBattle: câu hỏi nằm trong thẻ .q-card (kèm thanh tiến độ .q-prog), đáp án nằm trong .q-panel (xem bossBattle.css).
  // Khi trang tự cung cấp hai khung riêng (ctx.aEl, như Survival) thì KHÔNG bọc.
  const card = (inner, pct) => `<div class="q-card">${inner}<div class="q-prog"><i style="width:${pct}%"></i></div></div>`;
  const panel = inner => `<div class="q-panel">${inner}</div>`;

  // Lấy n từ khác nhau (theo key) để làm đáp án nhiễu — random riêng cho từng người
  const others = (vocab, w, key, n) => {
    const seen = new Set([key(w)]), out = [];
    let guard = 300;
    while (out.length < n && guard--) {
      const x = vocab[Math.floor(Math.random() * vocab.length)];
      const k = key(x);
      if (k && !seen.has(k)) { seen.add(k); out.push(x); }
    }
    return out;
  };
  const byWord = x => x.word;
  const blank = w => (w.example || "______").replace(new RegExp(`\\b${w.word}(s|es|ed|ing)?\\b`, "i"), "______");

  // Mỗi game: (từ, kho từ) → { prompt, sub, answer, options? | type? }
  const GAMES = {
    choiceEnVi: (w, v) => ({
      prompt: w.word, sub: cls(w), answer: M(w),
      options: shuffle([M(w), ...others(v, w, M, 3).map(M)])
    }),
    choiceViEn: (w, v) => ({
      prompt: M(w), sub: cls(w), answer: w.word,
      options: shuffle([w.word, ...others(v, w, byWord, 3).map(byWord)])
    }),
    trueFalse: (w, v) => {
      const real = Math.random() < 0.5;
      return {
        prompt: w.word, sub: "= " + (real ? M(w) : M(others(v, w, M, 1)[0])),
        answer: real ? "Đúng" : "Sai", options: ["Đúng", "Sai"]
      };
    },
    sentenceFill: (w, v) => ({
      prompt: blank(w), sub: `${cls(w)} : ${M(w)}`, answer: w.word,
      options: shuffle([w.word, ...others(v, w, byWord, 3).map(byWord)])
    }),
    speedTyping: w => ({
      prompt: w.word, sub: `${cls(w)} ${w.meaning.join(", ")}`, answer: w.word,
      type: true, ph: "Hãy viết lại từ trên"
    }),
    unscramble: w => {
      let s;
      do s = shuffle([...w.word]).join(""); while (s === w.word);
      return { prompt: s.toUpperCase(), sub: `${cls(w)} ${M(w)} · ${w.word.length} chữ`, answer: w.word, type: true, ph: "Sắp xếp thành từ đúng" };
    },
    missingLetters: w => {
      const a = [...w.word];
      const hide = new Set(shuffle(a.map((_, i) => i)).slice(0, Math.max(1, Math.floor(a.length * 0.4))));
      return {
        prompt: a.map((c, i) => (hide.has(i) ? "_" : c)).join(" "),
        sub: `${cls(w)} ${M(w)}`, answer: w.word, type: true, ph: "Điền cả từ hoàn chỉnh"
      };
    }
  };

  // ===== Game có giao diện riêng: (words, ctx) → { stop() } =====

  // NỐI CỘT: 10 từ = 2 vòng × 5 cặp, 1 điểm mỗi cặp đúng, nối sai không bị trừ điểm
  function runMatch(words, ctx) {
    const items = shuffle(words);
    const rounds = Math.ceil(items.length / 5);
    let round = 0, score = 0, matched = 0, size = 5, stopped = false, busy = false, sel = {};

    const btn = (w, side, text) =>
      `<button class="q-opt mt-item" data-s="${side}" data-i="${items.indexOf(w)}">${esc(text)}</button>`;

    function draw() {
      const part = items.slice(round * 5, round * 5 + 5);
      matched = 0; sel = {}; busy = false; size = part.length;
      const count = `<div class="q-count">Vòng ${round + 1} / ${rounds}</div>`;
      const grid = `
        <div class="mt-grid">
          <div class="mt-col">${shuffle(part).map(w => btn(w, "L", w.word)).join("")}</div>
          <div class="mt-col">${shuffle(part).map(w => btn(w, "R", M(w))).join("")}</div>
        </div>`;
      ctx.el.innerHTML = ctx.aEl ? count + grid
        : card(count + '<div class="q-prompt q-prompt-sm">Nối từ với nghĩa đúng</div>', Math.round(round * 5 / items.length * 100)) + panel(grid);
      ctx.el.querySelectorAll(".mt-item").forEach(b => (b.onclick = () => pick(b)));
    }

    function pick(b) {
      if (stopped || busy || b.classList.contains("done")) return;
      const side = b.dataset.s;
      ctx.el.querySelectorAll(`.mt-item[data-s="${side}"]`).forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      sel[side] = b;
      if (!(sel.L && sel.R)) return;

      const pair = [sel.L, sel.R];
      const same = sel.L.dataset.i === sel.R.dataset.i;
      sel = {};
      if (same) {
        pair.forEach(x => { x.classList.remove("sel"); x.classList.add("good", "done"); });
        score++; ctx.onScore(score); sfx("playCorrect");
        const bar = ctx.el.querySelector(".q-prog i");
        if (bar) bar.style.width = Math.round(score / items.length * 100) + "%";
        if (++matched === size) {
          busy = true;
          setTimeout(() => {
            if (stopped) return;
            if (++round < rounds) draw();
            else { stopped = true; ctx.onDone(); }
          }, 400);
        }
      } else {
        busy = true;
        pair.forEach(x => x.classList.add("bad"));
        sfx("playWrong");
        if (ctx.onWrong) ctx.onWrong();
        setTimeout(() => { pair.forEach(x => x.classList.remove("sel", "bad")); busy = false; }, 350);
      }
    }

    draw();
    return { stop() { stopped = true; return score; }, canSkip: false, max: items.length };
  }

  // HANGMAN RÚT GỌN: lộ sẵn khoảng nửa số chữ, chọn chữ còn thiếu, sai 3 lần là mất câu
  const HG_LIVES = 3, HG_TILES = 8;
  function runHangman(words, ctx) {
    const items = shuffle(words);
    let i = 0, score = 0, stopped = false, locked = false;

    const next = delay => {
      if (locked || stopped) return;
      locked = true;
      setTimeout(() => {
        if (stopped) return;
        if (++i < items.length) show();
        else { stopped = true; ctx.onDone(); }
      }, delay);
    };

    function show() {
      locked = false;
      const w = items[i], a = [...w.word.toLowerCase()];
      const hidden = new Set(shuffle(a.map((_, k) => k)).slice(0, Math.min(a.length, Math.max(2, Math.ceil(a.length / 2)))));
      const need = [...new Set([...hidden].map(k => a[k]))];
      const extra = shuffle("abcdefghijklmnopqrstuvwxyz".split("").filter(c => !a.includes(c))).slice(0, Math.max(0, HG_TILES - need.length));
      const tiles = shuffle([...need, ...extra]);
      let wrong = 0;

      const top = `
        <div class="q-count">${i + 1} / ${items.length} <span class="hg-lives">${"❤️".repeat(HG_LIVES)}</span></div>
        <div class="q-sub">${esc(cls(w) + " " + M(w))}</div>
        <div class="hg-word">${a.map((c, k) => `<span class="hg-slot">${hidden.has(k) ? "" : esc(c.toUpperCase())}</span>`).join("")}</div>`;
      const keys = `<div class="q-opts hg-keys">${tiles.map(c => `<button class="q-opt">${c.toUpperCase()}</button>`).join("")}</div>`;
      ctx.el.innerHTML = ctx.aEl ? top + keys : card(top, Math.round(i / items.length * 100)) + panel(keys);

      const slots = ctx.el.querySelectorAll(".hg-slot");
      ctx.el.querySelectorAll(".hg-keys .q-opt").forEach(b => (b.onclick = () => {
        if (locked || stopped || b.disabled) return;
        b.disabled = true;
        const c = b.textContent.toLowerCase();
        if (a.includes(c)) {
          b.classList.add("good");
          [...hidden].forEach(k => { if (a[k] === c) { slots[k].textContent = c.toUpperCase(); hidden.delete(k); } });
          if (!hidden.size) { score++; ctx.onScore(score); sfx("playCorrect"); next(300); }
        } else {
          b.classList.add("bad");
          sfx("playWrong");
          wrong++;
          ctx.el.querySelector(".hg-lives").textContent = "❤️".repeat(HG_LIVES - wrong) + "🖤".repeat(wrong);
          if (wrong >= HG_LIVES) {
            if (ctx.onWrong) ctx.onWrong();   // hết lượt: hiện đáp án rồi sang câu sau
            [...hidden].forEach(k => { slots[k].textContent = a[k].toUpperCase(); slots[k].classList.add("miss"); });
            next(900);
          }
        }
      }));
    }

    show();
    return { stop() { stopped = true; return score; }, canSkip: false, max: items.length };
  }

  const CUSTOM = { match: runMatch, hangman: runHangman };

  const NAMES = {
    choiceEnVi: "Trắc nghiệm", choiceViEn: "Chọn từ tiếng Anh", trueFalse: "Đúng / Sai",
    speedTyping: "Gõ nhanh", unscramble: "Xếp chữ", missingLetters: "Điền chữ cái thiếu",
    sentenceFill: "Điền vào câu", match: "Nối cột", hangman: "Hangman rút gọn"
  };

  // ctx: { el, vocab, onScore(score), onDone() } → trả về { stop() } (stop trả về điểm hiện có)
  function run(id, words, ctx) {
    if (CUSTOM[id]) return CUSTOM[id](words, ctx);
    const qs = shuffle(words).map(w => GAMES[id](w, ctx.vocab));   // xáo thứ tự câu riêng từng người
    let i = 0, score = 0, stopped = false, locked = false;

    const advance = delay => {
      if (locked || stopped) return;
      locked = true;
      setTimeout(() => {
        if (stopped) return;
        if (++i < qs.length) show();
        else { stopped = true; ctx.onDone(); }
      }, delay);
    };
    const gain = () => { score++; ctx.onScore(score); sfx("playCorrect"); };
    const wrong = () => { sfx("playWrong"); if (ctx.onWrong) ctx.onWrong(); };

    function show() {
      locked = false;
      const q = qs[i];
      const head = `
        <div class="q-count">${i + 1} / ${qs.length}</div>
        <div class="q-prompt${String(q.prompt).length > 40 ? " q-prompt-sm" : ""}">${esc(q.prompt)}</div>
        <div class="q-sub">${esc(q.sub || "")}</div>`;
      const tail = q.options
        ? `<div class="q-opts ${q.options.length === 2 ? "two" : ""}">${q.options.map(o => `<button class="q-opt">${esc(o)}</button>`).join("")}</div>`
        : `<input class="q-input" autocomplete="off" placeholder="${esc(q.ph)}"><button class="q-skip">Bỏ qua →</button>`;
      const ans = ctx.aEl || ctx.el;     // aEl (tuỳ chọn): hàng đáp án nằm riêng bên dưới bảng câu hỏi
      if (ctx.aEl) { ctx.el.innerHTML = head; ctx.aEl.innerHTML = tail; } else ctx.el.innerHTML = card(head, Math.round(i / qs.length * 100)) + panel(tail);

      if (q.options) {
        const btns = [...ans.querySelectorAll(".q-opt")];
        btns.forEach(b => b.onclick = () => {
          if (locked || stopped) return;
          btns.forEach(x => (x.disabled = true));
          const right = b.textContent === q.answer;
          b.classList.add(right ? "good" : "bad");
          if (right) gain(); else wrong();
          advance(ctx.feedbackMs || 350);
        });
      } else {
        const inp = ans.querySelector(".q-input");
        inp.focus();
        inp.oninput = () => {
          if (locked || stopped) return;
          if (inp.value.trim().toLowerCase() === q.answer.toLowerCase()) {
            inp.disabled = true; gain(); advance(ctx.feedbackMs || 200);
          }
        };
        ans.querySelector(".q-skip").onclick = () => { if (!locked && !stopped) { wrong(); advance(0); } };
      }
    }

    show();
    return { stop() { stopped = true; return score; }, skip() { if (!locked && !stopped) { wrong(); advance(0); } }, canSkip: true, max: qs.length };
  }

  root.BossGames = { ids: [...Object.keys(GAMES), ...Object.keys(CUSTOM)], names: NAMES, run };
})(typeof window !== "undefined" ? window : globalThis);