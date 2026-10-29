/* ===========================================================
   guide.js  (đặt ở JS/common/guide.js)
   Bảng nhỏ "Cách chơi" hiện ra ngay sau khi người chơi nhập tên thành công.

   - Hiện mỗi khi mở web (xem SHOW_MODE bên dưới).
   - Người mới: đợi nhập tên xong (màn .login-gate, con trực tiếp của <body>)
     đóng lại rồi mới hiện. Người đã có tên: hiện ngay khi trang tải xong.
   - Mở lại bằng tay bất cứ lúc nào:  window.normaGuide.open()
   - Xóa cờ "đã hiện":               window.normaGuide.reset()
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

    // Nội dung: sửa chữ ở đây
    const TITLE = "Chào mừng đến normaFix! 👋";
    const SUBTITLE = "Học từ vựng qua trò chơi. Chọn một chế độ trong mục Chơi:";
    const ITEMS = [
        { icon: "🎓", name: "LEARN", desc: "10 từ, 4 phần: gõ lại từ, trắc nghiệm, nối cột, điền vào chỗ trống." },
        { icon: "🔗", name: "WORDCHAIN", desc: "Nối từ bằng chữ cái cuối của từ trước, không lặp từ. Mỗi lượt 30 giây, sai 5 lần mất 1 mạng (có 2 mạng)." },
        { icon: "🔍", name: "WORDHUNT", desc: "Liệt kê các từ bắt đầu bằng chữ cái ngẫu nhiên." },
        { icon: "❓", name: "HANGMAN", desc: "Đoán từ bí ẩn từng chữ cái, đừng để sai quá nhiều lần." },
        { icon: "🧩", name: "WORDPUZZLE", desc: "Tìm các từ ẩn trong bảng chữ cái." }
    ];
    const TIP = "💡 Muốn chơi cùng bạn bè? Vào <b>Tạo phòng</b>. Muốn xem từ vựng? Vào <b>Tài liệu</b> rồi bấm vào từ để nghe đọc.";
    const BUTTON_TEXT = "Bắt đầu thôi!";

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

.ng-tip {
    margin: 0 0 14px; padding: 9px 12px;
    border-radius: 14px; background: #e2f4fb;
    font-size: 13px; line-height: 1.4;
}

.ng-start {
    display: block; width: 100%; height: 48px; margin: 0; padding: 0;
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
    .ng-tip { margin-bottom: 8px; padding: 6px 10px; font-size: 12px; }
    .ng-start { height: 40px; font-size: 17px; }
}

@media (prefers-reduced-motion: reduce) {
    .ng-overlay, .ng-card, .ng-start { transition: none; }
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

    function onKeydown(e) {
        if (e.key === "Escape") closeGuide();
    }

    function openGuide() {
        if (overlay) return;
        injectStyle();
        markSeen();
        lastFocus = document.activeElement;

        const items = ITEMS.map(it => `
            <li>
                <span class="ng-icon" aria-hidden="true">${it.icon}</span>
                <div class="ng-text"><b>${it.name}</b><span>${it.desc}</span></div>
            </li>`).join("");

        overlay = document.createElement("div");
        overlay.className = "ng-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "ngTitle");
        overlay.innerHTML = `
            <div class="ng-card">
                <button type="button" class="ng-close" aria-label="Đóng">✕</button>
                <h2 id="ngTitle">${TITLE}</h2>
                <p class="ng-sub">${SUBTITLE}</p>
                <ul class="ng-list">${items}</ul>
                <p class="ng-tip">${TIP}</p>
                <button type="button" class="ng-start">${BUTTON_TEXT}</button>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelector(".ng-close").addEventListener("click", closeGuide);
        overlay.querySelector(".ng-start").addEventListener("click", closeGuide);
        overlay.addEventListener("click", e => { if (e.target === overlay) closeGuide(); });
        document.addEventListener("keydown", onKeydown);

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