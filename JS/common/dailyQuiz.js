/* ===========================================================
   dailyQuiz.js  (đặt ở JS/common/dailyQuiz.js)
   Bài kiểm tra mỗi ngày: 10 câu, bộ đề chọn theo THỨ trong tuần
   (7 bộ ở data/dailyQuiz.js). Ai làm trong cùng một thứ đều gặp đúng cùng
   một bộ đề, cùng thứ tự câu và đáp án, để dễ thống kê.

   - Nút: <button id="dailyQuizBtn"> (kèm <small id="dailyQuizHint">) ở hero index.html
   - Làm bao nhiêu lần cũng được; mỗi lượt HOÀN THÀNH được lưu bằng
     normaStats.recordQuiz() (xem stats.js): điểm, thời gian, từng đáp án.
     Thoát giữa chừng thì lượt đó không được tính.
   - Cần CSS/dailyQuiz.css.
   =========================================================== */
(function () {
    "use strict";
    if (window.normaDailyQuiz) return;

    var SCRIPT_SRC = document.currentScript && document.currentScript.src;
    var DAY_NAMES = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

    var btn = null, hint = null;
    var overlay = null, body = null, lastFocus = null;
    var inerted = [], prevOverflow = "";
    var run = null;          // lượt làm hiện tại


    /* ---------- tiện ích ---------- */
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    // 1 = Thứ Hai ... 7 = Chủ Nhật
    function setIdFor(d) { return (d.getDay() + 6) % 7 + 1; }

    function url(rel) {
        try { return new URL(rel, SCRIPT_SRC).href; } catch (e) { return ""; }
    }
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (!src) { reject(new Error("thiếu đường dẫn")); return; }
            var s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error("không tải được " + src)); };
            document.head.appendChild(s);
        });
    }
    function ensureStats() {
        if (window.normaStats) return Promise.resolve(window.normaStats);
        return loadScript(url("stats.js")).then(
            function () { return window.normaStats || null; },
            function () { return null; }
        );
    }
    function loadData() {
        if (window.NORMA_DAILY_QUIZ) return Promise.resolve();
        return loadScript(url("../../data/dailyQuiz.js"))["catch"](function () { /* báo ở bước đọc */ });
    }

    function validItem(it) {
        return it && typeof it.q === "string" && Array.isArray(it.options) && it.options.length >= 2 &&
            Number.isInteger(it.answer) && it.answer >= 0 && it.answer < it.options.length;
    }

    // Lấy bộ đề theo id (1..7); null nếu thiếu dữ liệu
    function readSet(id) {
        var data = window.NORMA_DAILY_QUIZ;
        if (!data || !Array.isArray(data.sets)) return null;
        var s = data.sets.filter(function (x) { return x && x.id === id; })[0];
        if (!s || !Array.isArray(s.questions)) return null;
        var list = s.questions.filter(validItem);
        if (list.length !== s.questions.length) console.warn("dailyQuiz: bộ đề " + id + " có câu không hợp lệ, đã bỏ qua.");
        if (!list.length) return null;
        return { id: id, day: s.day || DAY_NAMES[id % 7], ver: Math.max(1, +data.ver || 1), questions: list };
    }

    function todayInfo() {
        var d = new Date();
        return { key: dateKey(d), id: setIdFor(d) };
    }

    // Số liệu hôm nay của chính người chơi (từ normaStats)
    function myToday(key) {
        var st = window.normaStats;
        try { return (st && st.view().quiz && st.view().quiz[key]) || null; } catch (e) { return null; }
    }


    /* ---------- dòng gợi ý trên nút ---------- */
    function updateHint() {
        if (!hint || !btn) return;
        var t = todayInfo();
        var set = readSet(t.id);
        if (!set) { btn.hidden = true; return; }
        btn.hidden = false;
        var mine = myToday(t.key);
        hint.textContent = mine
            ? "Hôm nay: " + mine.tries + " lần · cao nhất " + mine.best + "/" + set.questions.length
            : set.questions.length + " câu · bộ đề " + set.day;
    }


    /* ---------- cửa sổ ---------- */
    function buildOverlay() {
        overlay = document.createElement("div");
        overlay.className = "dq-overlay";
        overlay.innerHTML =
            '<div class="dq-card" role="dialog" aria-modal="true" aria-labelledby="dqTitle">' +
            '<button type="button" class="dq-x" aria-label="Đóng">✕</button>' +
            '<div class="dq-body"></div>' +
            '</div>';
        body = overlay.querySelector(".dq-body");

        overlay.querySelector(".dq-x").addEventListener("click", requestClose);
        overlay.addEventListener("click", function (e) {
            // bấm ra ngoài chỉ đóng khi chưa làm dở
            if (e.target === overlay && !(run && run.inProgress)) requestClose();
        });
        document.addEventListener("keydown", onKey);

        // khóa phần còn lại của trang
        lastFocus = document.activeElement;
        Array.prototype.forEach.call(document.body.children, function (el) {
            if (!el.hasAttribute("inert")) { el.setAttribute("inert", ""); inerted.push(el); }
        });
        prevOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";

        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add("show"); });
    }

    function onKey(e) { if (e.key === "Escape") requestClose(); }

    function requestClose() {
        if (run && run.inProgress && run.answers.length > 0) {
            if (!confirm("Thoát bài kiểm tra? Kết quả lượt này sẽ không được lưu.")) return;
        }
        closeOverlay();
    }

    function closeOverlay() {
        if (!overlay) return;
        var node = overlay;
        overlay = null; body = null; run = null;
        document.removeEventListener("keydown", onKey);
        node.classList.remove("show");
        setTimeout(function () { node.remove(); }, 260);
        inerted.forEach(function (el) { el.removeAttribute("inert"); });
        inerted = [];
        document.documentElement.style.overflow = prevOverflow;
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        updateHint();
    }

    function focusFirst(sel) {
        setTimeout(function () {
            var f = body && body.querySelector(sel);
            if (f) f.focus({ preventScroll: true });
        }, 60);
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }


    /* ---------- mở bài ---------- */
    function open() {
        if (overlay) return;
        loadData().then(function () {
            var t = todayInfo();
            var set = readSet(t.id);
            if (!set) { alert("Chưa có bộ đề cho hôm nay. Bạn thử lại sau nhé!"); return; }
            run = { set: set, date: t.key, qi: 0, score: 0, answers: [], ok: [], times: [], inProgress: false };
            buildOverlay();
            showIntro();
        });
    }

    function showIntro() {
        var set = run.set, mine = myToday(run.date);
        body.innerHTML = "";

        var h = el("h2", null, "Kiểm tra hôm nay");
        h.id = "dqTitle";
        body.appendChild(h);
        body.appendChild(el("p", "dq-sub", "Bộ đề " + set.day + " · " + set.questions.length + " câu"));

        var ul = el("ul", "dq-chips");
        ul.appendChild(el("li", null, "Hôm nay ai cũng làm cùng một bộ đề này."));
        ul.appendChild(el("li", null, "Làm lại bao nhiêu lần cũng được, kết quả mỗi lần đều được ghi nhận."));
        if (mine) {
            ul.appendChild(el("li", "hot", "Bạn đã làm " + mine.tries + " lần hôm nay · cao nhất " + mine.best + "/" + set.questions.length + "."));
        }
        body.appendChild(ul);

        var go = el("button", "dq-btn", mine ? "Làm lại" : "Bắt đầu");
        go.type = "button";
        go.setAttribute("data-focus", "");
        go.addEventListener("click", startQuiz);
        body.appendChild(go);
        focusFirst("[data-focus]");
    }

    function startQuiz() {
        run.qi = 0; run.score = 0;
        run.answers = []; run.ok = []; run.times = [];
        run.inProgress = true;
        run.t0 = Date.now();
        showQuestion();
    }


    /* ---------- câu hỏi ---------- */
    function showQuestion() {
        var set = run.set, it = set.questions[run.qi], total = set.questions.length;
        body.innerHTML = "";

        var head = el("div", "dq-qhead");
        head.appendChild(el("span", null, "Câu " + (run.qi + 1) + "/" + total));
        var bar = el("div", "dq-qbar");
        var fill = el("i");
        fill.style.width = (run.qi / total * 100) + "%";
        bar.appendChild(fill);
        head.appendChild(bar);
        body.appendChild(head);

        var q = el("h2", "dq-q", it.q);
        q.id = "dqTitle";
        body.appendChild(q);

        var opts = el("div", "dq-opts");
        var explain = el("p", "dq-explain");
        explain.hidden = true;
        var next = el("button", "dq-btn dq-next");
        next.type = "button";
        next.hidden = true;
        next.addEventListener("click", nextQuestion);

        run.qStart = Date.now();
        var locked = false;

        it.options.forEach(function (text, i) {
            var b = el("button", "dq-opt", String(text));
            b.type = "button";
            b.addEventListener("click", function () {
                if (locked) return;
                locked = true;
                answer(i, it, opts, explain, next);
            });
            opts.appendChild(b);
        });

        body.appendChild(opts);
        body.appendChild(explain);
        body.appendChild(next);
    }

    function answer(i, it, opts, explain, next) {
        var right = i === it.answer;
        run.times[run.qi] = Math.round((Date.now() - run.qStart) / 100) / 10;   // giây, 1 chữ số thập phân
        run.answers[run.qi] = i;
        run.ok[run.qi] = right ? 1 : 0;
        if (right) run.score++;

        var btns = opts.children;
        for (var k = 0; k < btns.length; k++) {
            btns[k].disabled = true;
            if (k === it.answer) btns[k].classList.add("is-right");
            else if (k === i) btns[k].classList.add("is-wrong");
        }

        if (it.explain) {
            explain.textContent = String(it.explain);
            explain.hidden = false;
            next.textContent = run.qi + 1 < run.set.questions.length ? "Tiếp tục" : "Xem kết quả";
            next.hidden = false;
            next.focus({ preventScroll: true });
        } else {
            setTimeout(function () { if (overlay && run && run.inProgress) nextQuestion(); }, 900);
        }
    }

    function nextQuestion() {
        if (!overlay || !run || !run.inProgress) return;
        run.qi++;
        if (run.qi < run.set.questions.length) showQuestion(); else finish();
    }


    /* ---------- kết quả ---------- */
    function finish() {
        run.inProgress = false;
        var set = run.set, total = set.questions.length;
        var secs = Math.max(1, Math.round((Date.now() - run.t0) / 1000));
        var prev = myToday(run.date);          // lấy TRƯỚC khi ghi lượt này
        var tries = prev ? prev.tries + 1 : 1;

        var payload = {
            date: run.date, set: set.id, ver: set.ver,
            score: run.score, total: total, secs: secs,
            answers: run.answers.slice(), ok: run.ok.slice(), times: run.times.slice()
        };
        ensureStats().then(function (st) {
            if (st && st.recordQuiz) st.recordQuiz(payload);
            else console.warn("dailyQuiz: không có normaStats nên chưa ghi được số liệu.");
        });

        showResult(prev, tries, secs);
    }

    function showResult(prev, tries, secs) {
        var set = run.set, total = set.questions.length, score = run.score;
        var pct = Math.round(score / total * 100);
        body.innerHTML = "";

        var wrap = el("div", "dq-result");
        wrap.appendChild(el("div", "dq-emoji", pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"));
        var h = el("h2", null, "Hoàn thành!");
        h.id = "dqTitle";
        h.style.margin = "0";
        wrap.appendChild(h);

        var sc = el("div", "dq-score", String(score));
        sc.appendChild(el("small", null, "/" + total));
        wrap.appendChild(sc);

        // so với lần trước hôm nay
        var delta;
        if (!prev) {
            delta = el("p", "dq-delta", "Lần đầu tiên hôm nay!");
        } else {
            var diff = score - prev.last;
            var text = diff > 0 ? "📈 Tăng " + diff + " điểm so với lần trước"
                : diff < 0 ? "📉 Giảm " + (-diff) + " điểm so với lần trước"
                    : "➡️ Bằng lần trước";
            delta = el("p", "dq-delta " + (diff > 0 ? "up" : diff < 0 ? "down" : ""), text);
            if (score > prev.best) delta.textContent += " · Kỷ lục hôm nay! 🏅";
        }
        wrap.appendChild(delta);
        wrap.appendChild(el("p", "dq-time", "Lần thứ " + tries + " hôm nay · " + secs + " giây"));

        // các câu sai
        var wrongIdx = [];
        for (var i = 0; i < total; i++) if (!run.ok[i]) wrongIdx.push(i);
        if (!wrongIdx.length) {
            wrap.appendChild(el("p", "dq-perfect", "Đúng hết cả " + total + " câu, quá đỉnh! 🏆"));
        } else {
            wrap.appendChild(el("p", "dq-review-title", "Xem lại " + wrongIdx.length + " câu sai"));
            var ul = el("ul", "dq-review");
            wrongIdx.forEach(function (i) {
                var it = set.questions[i];
                var li = el("li");
                li.appendChild(el("b", null, "Câu " + (i + 1) + ": " + it.q));
                var mine = run.answers[i];
                if (mine != null && mine >= 0) li.appendChild(el("span", "yours", "Bạn chọn: " + it.options[mine]));
                li.appendChild(document.createElement("br"));
                li.appendChild(el("span", "right", "Đáp án đúng: " + it.options[it.answer]));
                if (it.explain) {
                    li.appendChild(document.createElement("br"));
                    li.appendChild(el("span", null, it.explain));
                }
                ul.appendChild(li);
            });
            wrap.appendChild(ul);
        }

        var again = el("button", "dq-btn", "Làm lại");
        again.type = "button";
        again.addEventListener("click", startQuiz);
        var done = el("button", "dq-btn ghost", "Đóng");
        done.type = "button";
        done.setAttribute("data-focus", "");
        done.addEventListener("click", closeOverlay);
        wrap.appendChild(again);
        wrap.appendChild(done);

        body.appendChild(wrap);
        focusFirst("[data-focus]");
        overlay.querySelector(".dq-card").scrollTop = 0;
    }


    /* ---------- khởi động ---------- */
    function init() {
        btn = document.getElementById("dailyQuizBtn");
        hint = document.getElementById("dailyQuizHint");
        if (!btn) return;
        btn.addEventListener("click", open);
        btn.hidden = true;                       // chỉ hiện khi đã có bộ đề cho hôm nay

        loadData().then(updateHint);
        ensureStats().then(function (st) { if (st && st.onChange) st.onChange(updateHint); });
    }

    window.normaDailyQuiz = { open: open };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();