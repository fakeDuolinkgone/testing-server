

const MASCOTS = [
    { src: "pics/mascotPics/mascotFish_main.png", name: "Fishy The Fish", desc: "Người hỗ trợ dữ liệu từ vựng."},
    { src: "pics/mascotPics/iconWebsite_onlyRaccoon.png", name: "Racc_kun", desc: "Mình là Khôi, 1 trong 2 dev của game" },
    { src: "pics/mascotPics/mascotMrNam_main.gif", name: "Mr Nam", desc: "Học tiếng anh cùng Mr Nam"},
    { src: "pics/mascotPics/mascotEastDragon_main.gif", name: "Jn", desc: "Rồng họa sĩ biết nói."},
    { src: "pics/mascotPics/mascotCalicoCat_main.png", name: "Ether", desc: "Mèo méo meo mèo meo"},
    { src: "pics/mascotPics/mascotWukong_main.gif", name: "Tuấn", desc: "Cao thủ Liqi nè" },
    { src: "pics/mascotPics/mascotGrayCat_main.png", name: "anh Ba", desc: "Just a perennial learner striving to transcend the boundaries of mediocrity through intellectual rigour." },
    { src: "pics/mascotPics/iconWebsite_onlyBird.png", name: "Long Nhạn Bình", desc: "pmbylhkaopz,pdhuuhzhfptpzzoly" }
];

const desc = document.getElementById("mascotDesc");
const MASCOT_INTERVAL = 4500;   // đổi ảnh mỗi 3,5 giây
const MASCOT_FADE = 350;        // thời gian mờ dần (ms), khớp với transition trong CSS

(function () {
    const img = document.getElementById("mascotImage");
    const label = document.getElementById("mascotName");
    let index = 0;
    let timer = null;
    let busy = false;

    // tải trước để lúc đổi không bị chớp
    MASCOTS.forEach(m => { const p = new Image(); p.src = m.src; });

function showMascot(next) {
    if (busy) return;
    busy = true;
    index = next;

    img.classList.add("is-fading");
    label.classList.add("is-fading");
    desc.classList.add("is-fading");

    setTimeout(() => {
        img.src = MASCOTS[index].src;
        label.textContent = MASCOTS[index].name;
        desc.textContent = MASCOTS[index].desc;
        img.alt = MASCOTS[index].name;
        img.classList.remove("is-fading");
        label.classList.remove("is-fading");
        desc.classList.remove("is-fading");
        busy = false;
    }, MASCOT_FADE);
}




    function nextMascot() {
        showMascot((index + 1) % MASCOTS.length);
    }



    function start() {
        clearInterval(timer);
        timer = setInterval(nextMascot, MASCOT_INTERVAL);
    }

    // bấm vào ảnh để chuyển ngay, rồi tính lại thời gian chờ
    img.addEventListener("click", () => { nextMascot(); start(); });

    // tạm dừng khi rê chuột vào, chạy tiếp khi rời đi
    img.addEventListener("mouseenter", () => clearInterval(timer));
    img.addEventListener("mouseleave", start);

    // tab bị ẩn thì dừng, tránh chạy ngầm
    document.addEventListener("visibilitychange", () => {
        document.hidden ? clearInterval(timer) : start();
    });

    start();
})();
