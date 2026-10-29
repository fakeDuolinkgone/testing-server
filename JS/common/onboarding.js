/* ===========================================================
   onboarding.js  (đặt ở JS/common/onboarding.js)
   Màn chào cho người chơi MỚI TOANH (chưa có tên). user.js tự nạp file này.

   Bước 1  Chọn:  "Đăng ký"  hoặc  "Chơi chế độ khách"  (có thêm "Đã có tài khoản? Đăng nhập")
   Bước 2  Đăng ký (hoặc đăng nhập) - chỉ hiện khi chọn Đăng ký / Đăng nhập.
           Chọn khách thì bỏ qua bước này, kéo thẳng sang bước 3.
   Bước 3  Bài kiểm tra nhỏ (nội dung do người khác soạn trong data/placementQuiz.js).
           Không có file / không có câu hợp lệ thì bỏ qua bước này.

   - Khách: tự đặt tên "Khách 1234" (đổi được trong menu tên ở góc trái trên),
     được đăng nhập ẩn danh để dữ liệu vẫn lưu lên Firebase.
   - Kết quả kiểm tra lưu bằng normaStats.setPlacement(score, total).
   - Phần tử gốc mang class "login-gate" nên login.css và guide.js nhận ra như
     màn nhập tên cũ (guide.js sẽ hiện bảng hướng dẫn sau khi màn này đóng).
   - CSS nằm trong file này (biến STYLE).
   =========================================================== */
(function () {
    "use strict";
    if (window.normaOnboarding) return;

    var SCRIPT_SRC = document.currentScript && document.currentScript.src;
    var root = document.documentElement;
    var STYLE_ID = "ob-style";
    var STEP = { choice: 0, account: 1, quiz: 2 };

    var STYLE = `
.ob-card {
    width: min(440px, 100%);
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
    overflow-y: auto;
    padding: 18px 22px 22px;
    border-radius: 32px;
    background: #fff;
    color: var(--deep, #0E3850);
    font-family: var(--display, "Baloo 2", "Trebuchet MS", Arial, sans-serif);
    box-shadow: 0 12px 0 rgba(14, 56, 80, .25), 0 30px 60px rgba(6, 40, 58, .35);
    animation: obPop .45s cubic-bezier(.2, 1.3, .4, 1) both;
}
@keyframes obPop { from { transform: translateY(24px) scale(.94); opacity: 0; } }
.ob-card [hidden] { display: none !important; }

/* chấm tiến trình */
.ob-steps { display: flex; justify-content: center; gap: 6px; margin: 0 0 12px; }
.ob-steps i { width: 8px; height: 8px; border-radius: 999px; background: #cfe5ee; transition: width .3s, background .3s; }
.ob-steps i.on { width: 24px; background: var(--sun, #ff8b00); }
.ob-steps i.done { background: var(--deep, #0E3850); }

/* ba bảng trượt ngang */
.ob-viewport { overflow: hidden; transition: height .35s ease; }
.ob-track { display: flex; align-items: flex-start; transition: transform .45s cubic-bezier(.3, .8, .3, 1); }
.ob-panel { flex: 0 0 100%; min-width: 0; padding: 4px; box-sizing: border-box; }
.ob-panel[inert] { visibility: hidden; transition: visibility 0s .45s; }

.ob-card h2 { margin: 0 0 6px; font-size: clamp(26px, 6vw, 32px); font-weight: 800; line-height: 1.1; text-align: center; }
.ob-sub { margin: 0 0 16px; font-size: 16px; line-height: 1.4; color: #4d6b7c; text-align: center; }

/* nút lớn ở bước chọn */
.ob-choice {
    display: flex; align-items: center; gap: 14px;
    width: 100%; margin: 0 0 12px; padding: 14px 16px;
    border: 3px solid #cfe5ee; border-radius: 22px;
    background: #f7fcfe; color: inherit; text-align: left;
    font: inherit; cursor: pointer;
    transition: transform .2s, border-color .2s, box-shadow .2s;
}
.ob-choice:hover { transform: translateY(-2px); border-color: var(--sun, #ff8b00); box-shadow: 0 6px 0 rgba(14, 56, 80, .12); }
.ob-choice:active { transform: translateY(2px); box-shadow: none; }
.ob-choice.ob-primary { background: #fff4d6; border-color: var(--sun, #ff8b00); }
.ob-ico { flex: none; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 16px; background: #fff; font-size: 26px; }
.ob-choice b { display: block; font-size: 20px; font-weight: 800; line-height: 1.15; }
.ob-choice small { display: block; margin-top: 2px; font-size: 14px; line-height: 1.3; color: #4d6b7c; }

.ob-link, .ob-back {
    display: block; margin: 4px auto 0; padding: 8px 14px;
    border: 0; border-radius: 12px; background: none; box-shadow: none;
    color: #4d6b7c; font: 700 16px var(--display, "Baloo 2", Arial, sans-serif);
    cursor: pointer;
}
.ob-link:hover, .ob-back:hover { background: #eaf6fb; color: var(--deep, #0E3850); }
.ob-back { margin: 0 0 6px; padding: 6px 10px; text-align: left; }

/* form */
.ob-card form label { display: block; margin: 0 0 4px; font-size: 15px; font-weight: 700; }
.ob-card input {
    display: block; width: 100%; margin: 0 0 12px; padding: 11px 14px;
    border: 3px solid #cfe5ee; border-radius: 16px;
    background: #f7fcfe; color: var(--deep, #0E3850);
    font: 700 18px var(--display, "Baloo 2", Arial, sans-serif);
    box-sizing: border-box; outline: none;
    transition: border-color .2s, background .2s;
}
.ob-card input:focus { border-color: var(--sun, #ff8b00); background: #fff; }
.ob-card input[aria-invalid="true"] { border-color: #c93636; }
.ob-error { min-height: 20px; margin: -2px 0 8px; font-size: 14px; font-weight: 700; color: #c93636; text-align: center; }

.ob-btn {
    display: block; width: 100%; height: 56px; margin: 0; padding: 0;
    border: 0; border-radius: 40px;
    background: var(--sun, #ff8b00); color: #fff;
    font: 800 22px var(--display, "Baloo 2", Arial, sans-serif);
    box-shadow: 0 7px 0 rgba(14, 56, 80, .28);
    cursor: pointer; transition: transform .2s, box-shadow .2s, opacity .2s;
}
.ob-btn:hover { transform: translateY(-2px); box-shadow: 0 9px 0 rgba(14, 56, 80, .28); }
.ob-btn:active { transform: translateY(3px); box-shadow: 0 3px 0 rgba(14, 56, 80, .28); }
.ob-btn:disabled { opacity: .6; cursor: wait; transform: none; }
.ob-card button:focus-visible, .ob-choice:focus-visible { outline: 4px solid var(--deep, #0E3850); outline-offset: 3px; }

/* bài kiểm tra */
.ob-qhead { display: flex; align-items: center; gap: 12px; margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #4d6b7c; }
.ob-qbar { flex: 1; height: 10px; border-radius: 999px; background: #dcebf1; overflow: hidden; }
.ob-qbar i { display: block; height: 100%; border-radius: 999px; background: var(--gold, #FDB515); transition: width .35s; }
.ob-q { margin: 0 0 14px !important; font-size: clamp(21px, 5vw, 26px) !important; text-align: left !important; overflow-wrap: anywhere; }
.ob-opts { display: grid; gap: 10px; }
.ob-opt {
    width: 100%; min-height: 54px; margin: 0; padding: 10px 16px;
    border: 3px solid transparent; border-radius: 18px;
    background: #eef6f9; color: inherit; text-align: left;
    font: 700 18px/1.25 var(--display, "Baloo 2", Arial, sans-serif);
    overflow-wrap: anywhere; cursor: pointer;
    transition: background .2s, border-color .2s, transform .15s;
}
.ob-opt:hover:not(:disabled) { background: #fff4d6; border-color: var(--sun, #ff8b00); }
.ob-opt:active:not(:disabled) { transform: scale(.98); }
.ob-opt:disabled { cursor: default; }
.ob-opt.is-right { background: #4caf50; border-color: #4caf50; color: #fff; }
.ob-opt.is-wrong { background: #f44336; border-color: #f44336; color: #fff; }
.ob-explain { margin: 12px 0; padding: 10px 14px; border-radius: 14px; background: #e2f4fb; font-size: 15px; line-height: 1.4; }

.ob-result { text-align: center; }
.ob-score { margin: 4px 0; font-size: 64px; font-weight: 800; line-height: 1; color: var(--sun, #ff8b00); }
.ob-emoji { font-size: 40px; line-height: 1.2; }
.ob-loading { padding: 28px 0; text-align: center; font-weight: 700; color: #4d6b7c; }

@media (max-width: 480px) {
    .ob-card { padding: 14px 16px 18px; border-radius: 26px; }
    .ob-choice b { font-size: 18px; }
}
@media (orientation: landscape) and (max-height: 500px) {
    .ob-card { max-height: calc(100vh - 12px); max-height: calc(100dvh - 12px); width: min(520px, 100%); padding: 10px 18px 14px; border-radius: 24px; }
    .ob-steps { margin-bottom: 6px; }
    .ob-card h2 { font-size: 22px; }
    .ob-sub { margin-bottom: 8px; font-size: 14px; }
    .ob-choice { margin-bottom: 8px; padding: 8px 12px; }
    .ob-ico { width: 38px; height: 38px; font-size: 22px; }
    .ob-card input { padding: 7px 12px; margin-bottom: 8px; font-size: 16px; }
    .ob-btn { height: 44px; font-size: 19px; }
    .ob-opt { min-height: 42px; padding: 6px 14px; font-size: 16px; }
    .ob-opts { gap: 6px; }
    .ob-score { font-size: 44px; }
}
@media (prefers-reduced-motion: reduce) {
    .ob-card { animation: none; }
    .ob-track, .ob-viewport, .ob-steps i, .ob-qbar i { transition: none; }
}
`;

    var gate = null, viewport, track, panels, dots, quizBox;
    var form, nameIn, emailIn, passIn, errBox, submitBtn, switchBtn, accTitle, accSub, nameField;
    var mode = "reg";                  // "reg" | "log"
    var quiz = null, qi = 0, score = 0;
    var current = "choice";
    var resizeObs = null;


    /* ---------- tiện ích ---------- */
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

    // normaStats có thể chưa được nạp trên trang này: tự nạp JS/common/stats.js
    function ensureStats() {
        if (window.normaStats) return Promise.resolve(window.normaStats);
        return loadScript(url("stats.js")).then(
            function () { return window.normaStats || null; },
            function () { return null; }
        );
    }

    function player() { return window.normaPlayer; }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var st = document.createElement("style");
        st.id = STYLE_ID;
        st.textContent = STYLE;
        document.head.appendChild(st);
    }


    /* ---------- dữ liệu bài kiểm tra ---------- */
    function validItem(it) {
        return it && typeof it.q === "string" && Array.isArray(it.options) && it.options.length >= 2 &&
            Number.isInteger(it.answer) && it.answer >= 0 && it.answer < it.options.length;
    }

    function readQuiz() {
        var data = window.NORMA_PLACEMENT_QUIZ;
        if (!data || !Array.isArray(data.questions)) return null;
        var list = data.questions.filter(validItem);
        return list.length ? { title: data.title, intro: data.intro, questions: list } : null;
    }

    function loadQuiz() {
        var ready = readQuiz();
        if (ready) return Promise.resolve(ready);
        return loadScript(url("../../data/placementQuiz.js")).then(readQuiz, function () { return null; });
    }


    /* ---------- dựng giao diện ---------- */
    function build() {
        gate = document.createElement("div");
        gate.className = "login-gate ob-gate";
        gate.innerHTML =
            '<div class="ob-card" role="dialog" aria-modal="true" aria-labelledby="obTitle">' +
              '<div class="ob-steps" aria-hidden="true"><i></i><i></i><i></i></div>' +
              '<div class="ob-viewport"><div class="ob-track">' +

                '<section class="ob-panel" data-panel="choice">' +
                  '<h2 id="obTitle">Chào mừng đến normaFix! 👋</h2>' +
                  '<p class="ob-sub">Bạn muốn đăng ký hay chơi ở chế độ khách?</p>' +
                  '<button type="button" class="ob-choice ob-primary" data-act="register" data-focus>' +
                    '<span class="ob-ico" aria-hidden="true">✨</span>' +
                    '<span><b>Đăng ký</b><small>Lưu tiến trình, dùng được trên mọi thiết bị</small></span></button>' +
                  '<button type="button" class="ob-choice" data-act="guest">' +
                    '<span class="ob-ico" aria-hidden="true">🎮</span>' +
                    '<span><b>Chơi chế độ khách</b><small>Vào học ngay, đăng ký sau cũng được</small></span></button>' +
                  '<button type="button" class="ob-link" data-act="login">Đã có tài khoản? Đăng nhập</button>' +
                '</section>' +

                '<section class="ob-panel" data-panel="account">' +
                  '<button type="button" class="ob-back" data-act="back">← Quay lại</button>' +
                  '<h2 data-role="acc-title"></h2>' +
                  '<p class="ob-sub" data-role="acc-sub"></p>' +
                  '<form novalidate>' +
                    '<div data-role="name-field"><label for="obName">Tên hiển thị</label>' +
                      '<input id="obName" type="text" maxlength="20" autocomplete="nickname" placeholder="Tên của bạn"></div>' +
                    '<label for="obEmail">Email</label>' +
                    '<input id="obEmail" type="email" autocomplete="email" placeholder="ban@email.com">' +
                    '<label for="obPass">Mật khẩu</label>' +
                    '<input id="obPass" type="password" autocomplete="new-password" placeholder="Ít nhất 6 ký tự">' +
                    '<div class="ob-error" aria-live="polite"></div>' +
                    '<button type="submit" class="ob-btn"></button>' +
                  '</form>' +
                  '<button type="button" class="ob-link" data-act="switch"></button>' +
                '</section>' +

                '<section class="ob-panel" data-panel="quiz"><div data-role="quiz"></div></section>' +

              '</div></div>' +
            '</div>';

        var q = function (sel) { return gate.querySelector(sel); };
        viewport = q(".ob-viewport");
        track = q(".ob-track");
        panels = Array.prototype.slice.call(gate.querySelectorAll(".ob-panel"));
        dots = Array.prototype.slice.call(gate.querySelectorAll(".ob-steps i"));
        quizBox = q('[data-role="quiz"]');
        form = q("form");
        nameIn = q("#obName"); emailIn = q("#obEmail"); passIn = q("#obPass");
        errBox = q(".ob-error"); submitBtn = q(".ob-btn");
        switchBtn = q('[data-act="switch"]');
        accTitle = q('[data-role="acc-title"]'); accSub = q('[data-role="acc-sub"]');
        nameField = q('[data-role="name-field"]');

        gate.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]");
            if (b && gate.contains(b)) act(b.getAttribute("data-act"));
        });
        form.addEventListener("submit", onSubmit);
        [nameIn, emailIn, passIn].forEach(function (el) {
            el.addEventListener("input", function () { clearError(); el.removeAttribute("aria-invalid"); });
        });

        if (typeof ResizeObserver !== "undefined") {
            resizeObs = new ResizeObserver(fit);
            panels.forEach(function (p) { resizeObs.observe(p); });
        }

        document.body.appendChild(gate);
        root.classList.add("login-pending");
    }

    function fit() {
        if (!gate) return;
        var p = panels[STEP[current]];
        if (p) viewport.style.height = p.offsetHeight + "px";
    }

    // "kéo" sang bảng khác bằng cách trượt ngang
    function go(name) {
        current = name;
        var idx = STEP[name];
        track.style.transform = "translateX(" + (-idx * 100) + "%)";
        panels.forEach(function (p, i) {
            p.toggleAttribute("inert", i !== idx);
            p.setAttribute("aria-hidden", i === idx ? "false" : "true");
        });
        dots.forEach(function (d, i) {
            d.className = i === idx ? "on" : (i < idx ? "done" : "");
        });
        fit();
        setTimeout(function () {
            if (!gate || current !== name) return;
            var f = panels[idx].querySelector("[data-focus]");
            if (f) f.focus({ preventScroll: true });
        }, 400);
    }


    /* ---------- các thao tác ---------- */
    function act(name) {
        if (name === "register") { setMode("reg"); go("account"); focusLater(nameIn); }
        else if (name === "login") { setMode("log"); go("account"); focusLater(emailIn); }
        else if (name === "switch") { setMode(mode === "reg" ? "log" : "reg"); }
        else if (name === "back") { go("choice"); }
        else if (name === "guest") { chooseGuest(); }
        else if (name === "quizStart") { qi = 0; score = 0; renderQuestion(); }
        else if (name === "quizNext") { nextQuestion(); }
        else if (name === "quizDone") { saveQuiz(); finish(); }
        else if (name === "skipQuiz") { finish(); }
    }

    function focusLater(el) {
        setTimeout(function () { if (gate && el && !el.closest("[inert]")) el.focus({ preventScroll: true }); }, 420);
    }

    function setMode(m) {
        mode = m;
        var reg = m === "reg";
        accTitle.textContent = reg ? "Tạo tài khoản" : "Đăng nhập";
        accSub.textContent = reg ? "Tiến trình học sẽ được lưu lại cho bạn." : "Chào mừng bạn quay lại!";
        nameField.hidden = !reg;
        passIn.autocomplete = reg ? "new-password" : "current-password";
        submitBtn.textContent = reg ? "Tạo tài khoản" : "Đăng nhập";
        switchBtn.textContent = reg ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký";
        clearError();
        fit();
    }

    function clearError() { if (errBox) errBox.textContent = ""; }

    function fail(msg, field) {
        errBox.textContent = msg;
        if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
    }

    function busy(on) {
        submitBtn.disabled = on;
        submitBtn.textContent = on ? "Đang xử lý..." : (mode === "reg" ? "Tạo tài khoản" : "Đăng nhập");
    }

    // Khách: tên tự đặt, kéo thẳng sang bài kiểm tra
    function chooseGuest() {
        if (!player().getName()) player().setName("Khách " + (1000 + Math.floor(Math.random() * 9000)));
        // đăng nhập ẩn danh để dữ liệu vẫn lưu lên Firebase (lỗi cũng không sao: vẫn lưu cục bộ)
        ensureStats().then(function (st) {
            if (st && st.startGuest) st.startGuest()["catch"](function (e) { console.warn("Chế độ khách chưa lưu được lên Firebase:", e); });
        });
        goQuiz();
    }

    function onSubmit(e) {
        e.preventDefault();
        var reg = mode === "reg";
        var name = (nameIn.value || "").replace(/\s+/g, " ").trim();
        var email = emailIn.value.trim();
        var pass = passIn.value;

        if (reg && !name) return fail("Hãy nhập tên hiển thị.", nameIn);
        if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Email chưa đúng.", emailIn);
        if (!pass) return fail("Hãy nhập mật khẩu.", passIn);
        if (reg && pass.length < 6) return fail("Mật khẩu cần ít nhất 6 ký tự.", passIn);

        clearError();
        busy(true);

        ensureStats().then(function (st) {
            if (!st) throw { code: "NO_FIREBASE", message: "Không tải được phần tài khoản. Bạn vẫn có thể chơi ở chế độ khách." };
            return st.ready().then(function () {
                if (!st.available()) throw { code: "NO_FIREBASE", message: "Chưa kết nối được máy chủ. Bạn vẫn có thể chơi ở chế độ khách." };
                if (reg) {
                    return st.signUp(email, pass).then(function () {
                        player().setName(name);      // đặt tên sau khi tạo xong để chắc chắn lưu cùng hồ sơ
                        st.sync();
                        goQuiz();
                    });
                }
                return st.signIn(email, pass).then(function (res) {
                    return st.whenSynced(res.user.uid).then(function () {
                        if (!player().getName()) {
                            player().setName(email.split("@")[0]) || player().setName("Người chơi");
                        }
                        // đã làm bài kiểm tra ở lần trước thì không bắt làm lại
                        if (st.view().placement) finish(); else goQuiz();
                    });
                });
            });
        })["catch"](function (err) {
            var msg = window.normaStats ? window.normaStats.errorText(err) : (err && err.message) || "Có lỗi xảy ra.";
            fail(msg);
        }).then(function () { if (gate) busy(false); });
    }


    /* ---------- bài kiểm tra ---------- */
    function goQuiz() {
        quizBox.innerHTML = '<p class="ob-loading">Đang chuẩn bị bài kiểm tra...</p>';
        go("quiz");
        loadQuiz().then(function (data) {
            if (!gate) return;
            if (!data) { finish(); return; }        // không có bài kiểm tra thì vào học luôn
            quiz = data;
            renderIntro();
        });
    }

    function renderIntro() {
        quizBox.innerHTML =
            '<h2 data-role="t"></h2><p class="ob-sub" data-role="i"></p>' +
            '<button type="button" class="ob-btn" data-act="quizStart" data-focus>Bắt đầu</button>' +
            '<button type="button" class="ob-link" data-act="skipQuiz">Bỏ qua, vào học luôn</button>';
        quizBox.querySelector('[data-role="t"]').textContent = quiz.title || "Bài kiểm tra nhỏ";
        quizBox.querySelector('[data-role="i"]').textContent =
            quiz.intro || ("Chỉ " + quiz.questions.length + " câu thôi, giúp mình biết trình độ của bạn nhé.");
        fit();
        setTimeout(function () { var f = quizBox.querySelector("[data-focus]"); if (f && gate) f.focus({ preventScroll: true }); }, 60);
    }

    function renderQuestion() {
        var it = quiz.questions[qi], total = quiz.questions.length;
        quizBox.innerHTML =
            '<div class="ob-qhead"><span data-role="c"></span><div class="ob-qbar"><i></i></div></div>' +
            '<h2 class="ob-q"></h2><div class="ob-opts"></div>' +
            '<p class="ob-explain" hidden></p>' +
            '<button type="button" class="ob-btn" data-act="quizNext" hidden></button>';
        quizBox.querySelector('[data-role="c"]').textContent = "Câu " + (qi + 1) + "/" + total;
        quizBox.querySelector(".ob-qbar i").style.width = (qi / total * 100) + "%";
        quizBox.querySelector(".ob-q").textContent = it.q;

        var opts = quizBox.querySelector(".ob-opts");
        var locked = false;
        it.options.forEach(function (text, i) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "ob-opt";
            b.textContent = String(text);
            b.addEventListener("click", function () {
                if (locked) return;
                locked = true;
                answer(i, opts, it);
            });
            opts.appendChild(b);
        });
        fit();
    }

    function answer(i, opts, it) {
        if (i === it.answer) score++;
        var btns = opts.children;
        for (var k = 0; k < btns.length; k++) {
            btns[k].disabled = true;
            if (k === it.answer) btns[k].classList.add("is-right");
            else if (k === i) btns[k].classList.add("is-wrong");
        }
        if (it.explain) {
            var ex = quizBox.querySelector(".ob-explain");
            ex.textContent = String(it.explain);
            ex.hidden = false;
            var nb = quizBox.querySelector('[data-act="quizNext"]');
            nb.textContent = qi + 1 < quiz.questions.length ? "Tiếp tục" : "Xem kết quả";
            nb.hidden = false;
            nb.focus({ preventScroll: true });
            fit();
        } else {
            setTimeout(nextQuestion, 900);
        }
    }

    function nextQuestion() {
        if (!gate) return;
        qi++;
        if (qi < quiz.questions.length) renderQuestion(); else renderResult();
    }

    function renderResult() {
        var total = quiz.questions.length;
        var pct = Math.round(score / total * 100);
        var emoji = pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪";
        var msg = pct >= 80 ? "Tuyệt vời, vốn từ của bạn rất tốt!"
            : pct >= 50 ? "Khá ổn! Học thêm một chút là giỏi ngay."
            : "Không sao cả, cùng học từ đầu nào!";
        quizBox.innerHTML =
            '<div class="ob-result"><div class="ob-emoji" aria-hidden="true"></div>' +
            '<h2>Hoàn thành!</h2><div class="ob-score"></div><p class="ob-sub"></p>' +
            '<button type="button" class="ob-btn" data-act="quizDone" data-focus>Bắt đầu học 🚀</button></div>';
        quizBox.querySelector(".ob-emoji").textContent = emoji;
        quizBox.querySelector(".ob-score").textContent = score + "/" + total;
        quizBox.querySelector(".ob-sub").textContent = msg;
        fit();
        setTimeout(function () { var f = quizBox.querySelector("[data-focus]"); if (f && gate) f.focus({ preventScroll: true }); }, 60);
    }

    function saveQuiz() {
        if (!quiz) return;
        var s = score, t = quiz.questions.length;
        ensureStats().then(function (st) { if (st && st.setPlacement) st.setPlacement(s, t); });
    }


    /* ---------- đóng màn ---------- */
    function finish() {
        if (!gate) return;
        var closing = gate;
        gate = null;
        if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
        closing.classList.add("closing");
        root.classList.remove("login-pending");
        setTimeout(function () { closing.remove(); }, 250);
    }

    function start() {
        if (gate) return;
        injectStyle();
        build();
        setMode("reg");
        go("choice");
    }

    window.normaOnboarding = { start: start };
})();
