/* ===========================================================
   guide.js  (đặt ở JS/common/guide.js)
   Bảng nhỏ "Cách chơi" gồm 3 trang, hiện ra ngay sau khi người chơi nhập tên thành công:
     1) Các trò chơi một mình (Learn, WordChain, WordHunt, Hangman, WordPuzzle)
     2) Tạo phòng: chơi nhiều người bằng mã phòng, chơi đơn với bot, các trò trong phòng
     3) Tài liệu

   - Hiện mỗi khi mở web (xem SHOW_MODE bên dưới).
   - Người mới: đợi nhập tên xong (màn .login-gate, con trực tiếp của <body>)
     đóng lại rồi mới hiện. Người đã có tên: hiện ngay khi trang tải xong.
   - Mở lại bằng tay bất cứ lúc nào:  window.normaGuide.open()   (open(1) mở thẳng trang 2)
   - Xóa cờ "đã hiện":               window.normaGuide.reset()
   - Phím tắt: ← → chuyển trang, Esc đóng.
   - CSS nằm ngay trong file này (biến STYLE), muốn tách ra file riêng
     thì cắt phần đó sang CSS/guide.css.
   =========================================================== */
(function () {
    "use strict";

    // Khi nào hiện bảng:
    //   "session": mỗi lần mở web (mở tab mới / mở lại trình duyệt) hiện 1 lần,
    //              chuyển trang hay tải lại trong lúc đang dùng thì không hiện lại
    //   "always" : hiện ở MỖI lần tải trang (kể cả khi chuyển giữa các trang)
    //   "once"   : chỉ hiện đúng một lần trên mỗi trình duyệt
    const SHOW_MODE = "session";

    const STORAGE_KEY = "normafix.guideSeen";
    const STYLE_ID = "ng-style";
    const START_URL = "game.html";          // nút ở trang cuối dẫn tới đây

    // ---------- NỘI DUNG: sửa chữ ở đây ----------
    // items: các mục lớn (icon, tên, mô tả). modes: danh sách gọn các trò (tùy chọn). tip: dòng gợi ý (HTML được).
    const PAGES = [
        {
            title: "Chào mừng đến normaFix!",
            sub: "Học từ vựng qua trò chơi. Chọn một chế độ trong mục Chơi:",
            items: [
                { icon: "🎓", name: "LEARN - HỌC", desc: "10 từ, 4 phần: gõ lại từ, trắc nghiệm, nối cột, điền vào chỗ trống." },
                { icon: "🔗", name: "WORDCHAIN - NỐI TỪ", desc: "Nối từ bằng chữ cái cuối của từ trước, không lặp từ. Mỗi lượt 30 giây, sai 5 lần mất 1 mạng (có 2 mạng)." },
                { icon: "🔍", name: "WORDHUNT - LIỆT KÊ TỪ", desc: "Liệt kê các từ bắt đầu bằng chữ cái ngẫu nhiên." },
                { icon: "❓", name: "HANGMAN - ĐOÁN TỪ", desc: "Đoán từ bí ẩn từng chữ cái, đừng để sai quá nhiều lần." },
                { icon: "🧩", name: "WORDPUZZLE - DÒ Ô CHỮ", desc: "Tìm các từ ẩn trong bảng chữ cái." }
            ],
            tip: "💡 Các trò này chơi một mình được ngay. Muốn chơi cùng bạn bè thì sang trang sau nhé!"
        },
        {
            title: "Chơi cùng bạn bè",
            sub: "Vào mục <b>Tạo phòng</b> để chơi nhiều người:",
            items: [
                { icon: "🔑", name: "MÃ PHÒNG", desc: "Tạo phòng để nhận mã riêng gồm 6 ký tự. Gửi mã cho bạn bè, họ nhập mã vào ô Vào phòng là cùng chơi." },
                { icon: "🤖", name: "CHƠI ĐƠN VỚI MÁY", desc: "Chưa có ai chơi cùng? Chọn một trò rồi bấm Chơi đơn với máy để chơi một mình, có bot ngồi chơi cùng." }
            ],
            modesTitle: "Các trò trong phòng",
            modes: [
                { icon: "⚔️", name: "BossBattle", desc: "Cả phòng cùng đánh bại boss bằng điểm từ vựng." },
                { icon: "💀", name: "Sinh tồn", desc: "Mỗi vòng loại người điểm thấp, ai sống sót cuối cùng thắng." },
                { icon: "🔗", name: "WordChain", desc: "Nối từ theo lượt, mất hết 2 mạng là bị loại." },
                { icon: "🔍", name: "WordHunt", desc: "Ai săn được nhiều từ nhất thắng." },
                { icon: "🧩", name: "WordPuzzle", desc: "Cả phòng cùng dò ô chữ, ai nhiều điểm và nhanh nhất thắng." }
            ],
            tip: "💡 Chủ phòng chọn trò rồi bấm Bắt đầu. Cần ít nhất 2 người."
        },
        {
            title: "Tài liệu",
            sub: "Kho từ vựng để ôn trước khi chơi:",
            items: [
                { icon: "📖", name: "XEM TỪ VỰNG", desc: "Vào mục Tài liệu để xem danh sách từ vựng." },
                { icon: "🔊", name: "NGHE ĐỌC", desc: "Bấm vào một từ để nghe phát âm." }
            ],
            tip: "💡 Ôn trước vài từ sẽ giúp bạn đạt điểm cao hơn trong các trò chơi!"
        }
    ];
    const BUTTON_NEXT = "Tiếp theo →";
    const BUTTON_BACK = "← Quay lại";
    const BUTTON_START = "Bắt đầu thôi!";

    const STYLE = `
.ng-overlay {
    position: fixed; inset: 0; z-index: 10001;
    display: grid; place-items: center; padding: 16px;
    background: rgba(6, 40, 58, .55);
    -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    opacity: 0; transition: opacity .25s ease;
}
.ng-overlay.show { opacity: 1; }

.ng-card {
    position: relative;
    width: min(400px, 100%);
    max-height: calc(100vh - 32px);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 22px 20px 20px;
    border-radius: 26px;
    background: #fff;
    color: var(--deep, #0E3850);
    font-family: var(--display, "Baloo 2", "Trebuchet MS", Arial, sans-serif);
    box-shadow: 0 8px 0 rgba(14, 56, 80, .25), 0 24px 48px rgba(6, 40, 58, .35);
    transform: translateY(18px) scale(.95);
    transition: transform .35s cubic-bezier(.2, 1.3, .4, 1);
}
.ng-overlay.show .ng-card { transform: none; }

.ng-card h2 { margin: 0 34px 4px 0; font-size: 24px; font-weight: 800; line-height: 1.15; }
.ng-card .ng-sub { margin: 0 0 12px; font-size: 14px; line-height: 1.4; color: #4d6b7c; }

.ng-close {
    position: absolute; top: 10px; right: 10px;
    width: 34px; height: 34px; margin: 0; padding: 0;
    display: grid; place-items: center;
    border: 0; border-radius: 50%;
    background: #eaf6fb; color: var(--deep, #0E3850);
    font: 800 16px/1 var(--display, "Baloo 2", Arial, sans-serif);
    cursor: pointer;
}
.ng-close:hover { background: #d6eef5; }

/* nội dung một trang: mờ vào mỗi lần đổi trang */
.ng-body.in { animation: ngIn .28s ease both; }
@keyframes ngIn { from { opacity: 0; transform: translateX(14px); } }

.ng-list { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 8px; }
.ng-list li { display: flex; align-items: flex-start; gap: 10px; }
.ng-icon {
    flex: none; width: 34px; height: 34px;
    display: grid; place-items: center;
    border-radius: 12px; background: #fff4d6; font-size: 19px; line-height: 1;
}
.ng-text { min-width: 0; font-size: 14px; line-height: 1.35; }
.ng-text b { display: block; font-size: 16px; font-weight: 800; line-height: 1.15; }
.ng-text span { color: #4d6b7c; }

/* danh sách gọn các trò trong phòng */
.ng-modes-title { margin: 4px 0 6px; font-size: 14px; font-weight: 800; color: #4d6b7c; text-transform: uppercase; letter-spacing: .04em; }
.ng-modes { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 5px; }
.ng-modes li {
    display: flex; align-items: center; gap: 9px;
    padding: 6px 10px; border-radius: 14px; background: #f1f9fc;
    font-size: 13px; line-height: 1.3;
}
.ng-micon { flex: none; font-size: 18px; line-height: 1; }
.ng-modes b { font-weight: 800; }
.ng-modes span { color: #4d6b7c; }

.ng-tip {
    margin: 0 0 12px; padding: 9px 12px;
    border-radius: 14px; background: #e2f4fb;
    font-size: 13px; line-height: 1.4;
}

/* chấm báo trang */
.ng-dots { display: flex; justify-content: center; gap: 8px; margin: 0 0 12px; }
.ng-dot {
    width: 10px; height: 10px; margin: 0; padding: 0;
    border: 0; border-radius: 50%; background: #cfe3ec; cursor: pointer;
    transition: background .2s, transform .2s, width .2s;
}
.ng-dot.on { width: 26px; border-radius: 6px; background: var(--sun, #ff8b00); }
.ng-dot:focus-visible { outline: 3px solid var(--deep, #0E3850); outline-offset: 2px; }

.ng-actions { display: flex; gap: 10px; }
.ng-back {
    flex: none; height: 48px; margin: 0; padding: 0 16px;
    border: 0; border-radius: 40px;
    background: #eaf6fb; color: var(--deep, #0E3850);
    font: 800 16px var(--display, "Baloo 2", Arial, sans-serif);
    cursor: pointer;
}
.ng-back:hover { background: #d6eef5; }
.ng-back[hidden] { display: none; }

.ng-start {
    display: block; flex: 1; height: 48px; margin: 0; padding: 0;
    border: 0; border-radius: 40px;
    background: var(--sun, #ff8b00); color: #fff;
    font: 800 20px var(--display, "Baloo 2", Arial, sans-serif);
    box-shadow: 0 6px 0 rgba(14, 56, 80, .28);
    cursor: pointer;
    transition: transform .2s, box-shadow .2s;
}
.ng-start:hover { transform: translateY(-2px); box-shadow: 0 8px 0 rgba(14, 56, 80, .28); }
.ng-start:active { transform: translateY(3px); box-shadow: 0 3px 0 rgba(14, 56, 80, .28); }
.ng-start:focus-visible,
.ng-back:focus-visible,
.ng-close:focus-visible { outline: 3px solid var(--deep, #0E3850); outline-offset: 3px; }

/* điện thoại ngang: chia hai cột cho vừa chiều cao */
@media (orientation: landscape) and (max-height: 500px) {
    .ng-overlay { padding: 8px; }
    .ng-card { width: min(680px, 100%); padding: 12px 18px 14px; border-radius: 22px; }
    .ng-card h2 { font-size: 20px; margin-bottom: 2px; }
    .ng-card .ng-sub { margin-bottom: 8px; font-size: 13px; }
    .ng-list { grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-bottom: 8px; }
    .ng-icon { width: 28px; height: 28px; font-size: 16px; border-radius: 10px; }
    .ng-text { font-size: 12px; }
    .ng-text b { font-size: 14px; }
    .ng-modes { grid-template-columns: 1fr 1fr; gap: 4px 10px; margin-bottom: 8px; }
    .ng-modes li { padding: 4px 8px; font-size: 12px; }
    .ng-tip { margin-bottom: 8px; padding: 6px 10px; font-size: 12px; }
    .ng-dots { margin-bottom: 8px; }
    .ng-start, .ng-back { height: 40px; }
    .ng-start { font-size: 17px; }
}

@media (prefers-reduced-motion: reduce) {
    .ng-overlay, .ng-card, .ng-start, .ng-dot { transition: none; }
    .ng-body.in { animation: none; }
}
`;

    // ---------- lưu trạng thái ----------
    function store() {
        return SHOW_MODE === "once" ? localStorage : sessionStorage;
    }
    function wasSeen() {
        if (SHOW_MODE === "always") return false;
        try { return store().getItem(STORAGE_KEY) === "1"; } catch (e) { return false; }
    }
    function markSeen() {
        if (SHOW_MODE === "always") return;
        try { store().setItem(STORAGE_KEY, "1"); } catch (e) { /* bỏ qua */ }
    }
    function resetSeen() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* bỏ qua */ }
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* bỏ qua */ }
    }

    // ---------- dựng và hiện bảng ----------
    let overlay = null;
    let lastFocus = null;
    let page = 0;

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = STYLE;
        document.head.appendChild(style);
    }

    function closeGuide() {
        if (!overlay) return;
        const node = overlay;
        overlay = null;
        document.removeEventListener("keydown", onKeydown);
        node.classList.remove("show");
        setTimeout(() => node.remove(), 260);
        if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }

    const last = () => PAGES.length - 1;

    function onKeydown(e) {
        if (e.key === "Escape") closeGuide();
        else if (e.key === "ArrowRight" && page < last()) render(page + 1);
        else if (e.key === "ArrowLeft" && page > 0) render(page - 1);
    }

    // nội dung HTML của một trang
    function bodyHtml(p) {
        const items = p.items.map(it => `
            <li>
                <span class="ng-icon" aria-hidden="true">${it.icon}</span>
                <div class="ng-text"><b>${it.name}</b><span>${it.desc}</span></div>
            </li>`).join("");
        const modes = p.modes ? `
            <p class="ng-modes-title">${p.modesTitle || ""}</p>
            <ul class="ng-modes">${p.modes.map(m => `
                <li><span class="ng-micon" aria-hidden="true">${m.icon}</span>
                    <div><b>${m.name}</b> <span>${m.desc}</span></div></li>`).join("")}
            </ul>` : "";
        return `<ul class="ng-list">${items}</ul>${modes}<p class="ng-tip">${p.tip}</p>`;
    }

    // vẽ trang i (0..PAGES.length-1)
    function render(i) {
        if (!overlay) return;
        page = Math.max(0, Math.min(last(), i));
        const p = PAGES[page], isLast = page === last();

        overlay.querySelector("#ngTitle").textContent = p.title;
        overlay.querySelector(".ng-sub").innerHTML = p.sub;

        const body = overlay.querySelector(".ng-body");
        body.innerHTML = bodyHtml(p);
        body.classList.remove("in");
        void body.offsetWidth;                         // chạy lại hiệu ứng mờ vào
        body.classList.add("in");

        overlay.querySelectorAll(".ng-dot").forEach((d, k) => {
            d.classList.toggle("on", k === page);
            d.setAttribute("aria-current", k === page ? "true" : "false");
        });
        overlay.querySelector(".ng-back").hidden = page === 0;
        overlay.querySelector(".ng-start").textContent = isLast ? BUTTON_START : BUTTON_NEXT;
        overlay.querySelector(".ng-card").scrollTop = 0;
    }

    function openGuide(startPage) {
        if (overlay) return;
        injectStyle();
        markSeen();
        lastFocus = document.activeElement;

        const dots = PAGES.map((p, k) =>
            `<button type="button" class="ng-dot" aria-label="Trang ${k + 1}: ${p.title.replace(/"/g, "")}"></button>`).join("");

        overlay = document.createElement("div");
        overlay.className = "ng-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "ngTitle");
        overlay.innerHTML = `
            <div class="ng-card">
                <button type="button" class="ng-close" aria-label="Đóng">✕</button>
                <h2 id="ngTitle"></h2>
                <p class="ng-sub"></p>
                <div class="ng-body"></div>
                <div class="ng-dots">${dots}</div>
                <div class="ng-actions">
                    <button type="button" class="ng-back" hidden>${BUTTON_BACK}</button>
                    <button type="button" class="ng-start"></button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector(".ng-close").addEventListener("click", closeGuide);
        overlay.querySelector(".ng-back").addEventListener("click", () => render(page - 1));
        overlay.querySelector(".ng-start").addEventListener("click", () => {
            if (page < last()) { render(page + 1); return; }
            closeGuide();
            location.href = START_URL;
        });
        overlay.querySelectorAll(".ng-dot").forEach((d, k) => d.addEventListener("click", () => render(k)));
        overlay.addEventListener("click", e => { if (e.target === overlay) closeGuide(); });
        document.addEventListener("keydown", onKeydown);

        render(typeof startPage === "number" ? startPage : 0);
        requestAnimationFrame(() => {
            overlay.classList.add("show");
            overlay.querySelector(".ng-start").focus();
        });
    }

    // ---------- tự hiện khi mở web ----------
    function isGate(node) {
        return node && node.nodeType === 1 && node.classList.contains("login-gate");
    }

    // màn nhập tên đang mở (hoặc sắp mở)?
    function gateOpen(includePendingClass) {
        if (document.querySelector(".login-gate")) return true;
        return !!includePendingClass && document.documentElement.classList.contains("login-pending");
    }

    function watchLogin() {
        if (wasSeen()) return;

        let shown = false;
        let timer = null;

        function trigger(delay, afterGate) {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (shown || gateOpen(!afterGate)) return;
                shown = true;
                openGuide();
            }, delay);
        }

        // người mới: màn nhập tên đóng lại thì hiện bảng (chờ trang hiện lại hẳn)
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(n => {
                    if (!isGate(n)) return;
                    clearTimeout(timer);
                    if (shown) { shown = false; closeGuide(); }   // màn nhập tên luôn nằm trên cùng
                });
                m.removedNodes.forEach(n => { if (isGate(n)) trigger(350, true); });
            }
        });
        observer.observe(document.body, { childList: true });

        // người đã có tên: không có màn nhập tên, hiện sau khi trang tải xong
        const start = () => trigger(700, false);
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", start);
        } else {
            start();
        }
    }

    window.normaGuide = { open: openGuide, close: closeGuide, reset: resetSeen };

    if (document.body) {
        watchLogin();
    } else {
        document.addEventListener("DOMContentLoaded", watchLogin);
    }
})();