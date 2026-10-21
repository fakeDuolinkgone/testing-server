    (function () {
      "use strict";

      var NORMA_URL = "data/normaFixWords.js";   // file chỉ chứa một mảng JSON nên phải fetch, không nạp bằng <script>
      var CHUNK = 80;                            // số hàng vẽ mỗi lần (cuộn gần tới đáy thì vẽ tiếp)
      var HEADER_CELLS = 3;
      var AUTO_HIDE = true;                      // true: kéo xuống thì hàng tiêu đề ẩn đi, kéo lên thì hiện lại; false: luôn dính trên cùng

      var $ = function (id) { return document.getElementById(id); };
      var list = $("list"), q = $("q"), azBtn = $("az");

      var store = { global: null, norma: null };  // dữ liệu đã chuẩn hóa + sắp xếp a-z, nạp 1 lần
      var current = "global", asc = true;
      var view = [], shown = 0, token = 0, lastTop = 0;

      /* ---------- nạp và chuẩn hóa dữ liệu ---------- */
      function fromGlobal() {
        var src = (typeof vocabData !== "undefined" && Array.isArray(vocabData)) ? vocabData : [];
        return src.filter(function (w) { return w && w.word; }).map(function (w) {
          return {
            word: String(w.word), pron: "",
            cls: String(w.classword || ""),
            mean: Array.isArray(w.meaning) ? w.meaning.join("; ") : String(w.meaning || ""),
            note: w.example ? String(w.example) : ""
          };
        });
      }

      function fromNorma(arr) {
        return arr.filter(function (w) { return w && w.word; }).map(function (w) {
          return { word: String(w.word), pron: String(w.pronounce || ""), cls: String(w.type || ""), mean: String(w.meaning || ""), note: "" };
        });
      }

      // Lấy mảng JSON ra khỏi file .js, kể cả khi file có dạng "const x = [ ... ];"
      function parseArray(text) {
        var a = text.indexOf("["), b = text.lastIndexOf("]");
        if (a < 0 || b <= a) throw new Error("Không thấy mảng dữ liệu trong " + NORMA_URL);
        var body = text.slice(a, b + 1);
        try { return JSON.parse(body); }
        catch (e) { return (new Function("return " + body))(); }
      }

      function prepare(items) {
        items.forEach(function (e) { e.key = e.word.toLowerCase(); });
        items.sort(function (x, y) { return x.key < y.key ? -1 : x.key > y.key ? 1 : 0; });
        return items;
      }

      async function load(src) {
        if (store[src]) return store[src];
        if (src === "global") {
          store.global = prepare(fromGlobal());
        } else {
          var res = await fetch(NORMA_URL, { cache: "no-cache" });
          if (!res.ok) throw new Error("HTTP " + res.status);
          store.norma = prepare(fromNorma(parseArray(await res.text())));
        }
        return store[src];
      }

      /* ---------- vẽ ---------- */
      function el(cls, text) {
        var d = document.createElement("div");
        d.className = cls;
        if (text != null) d.textContent = text;
        return d;
      }

      function cell(kind, pillCls) {
        var c = el("c " + kind), p = el("pill" + (pillCls ? " " + pillCls : ""));
        c.appendChild(p);
        return { c: c, p: p };
      }

      function addRows() {
        var start = shown, end = Math.min(shown + CHUNK, view.length), frag = document.createDocumentFragment();
        for (var i = shown; i < end; i++) {
          var e = view[i];
          var w = cell("w"), k = cell("k", e.cls.length > 9 ? "long" : ""), m = cell("m");
          var b = document.createElement("span");
          b.textContent = e.word;
          w.p.appendChild(b);
          if (e.pron) { var pr = document.createElement("i"); pr.textContent = e.pron; w.p.appendChild(pr); }
          if (e.note) w.c.title = e.note;
          [w.c, k.c, m.c].forEach(function (c) { c.classList.add("row"); c.style.setProperty("--i", Math.min(i - start, 14)); });
          k.p.textContent = e.cls;
          m.p.textContent = e.mean;
          frag.appendChild(w.c); frag.appendChild(k.c); frag.appendChild(m.c);
        }
        shown = end;
        list.appendChild(frag);
      }

      function fill() {                           // vẽ tiếp cho tới khi lấp đầy khung (màn cao) hoặc hết dữ liệu
        while (shown < view.length && list.scrollHeight - list.scrollTop - list.clientHeight < 400) addRows();
      }

      function clearBody() {
        while (list.children.length > HEADER_CELLS) list.lastChild.remove();
        list.scrollTop = 0;
        list.classList.remove("hide", "scrolled");
        lastTop = 0;
      }

      function note(text) { clearBody(); var n = el("note", text); list.appendChild(n); }

      function render() {
        var items = store[current];
        if (!items) return;
        var s = q.value.trim().toLowerCase();
        view = s ? items.filter(function (e) { return e.key.indexOf(s) !== -1; }) : items;
        if (!asc) view = view.slice().reverse();
        shown = 0;
        clearBody();
        if (!view.length) { note("Không có từ nào khớp “" + q.value.trim() + "”."); return; }
        fill();
      }

      /* ---------- đổi tab ---------- */
      async function show(src) {
        current = src;
        var my = ++token;
        document.querySelectorAll(".tab").forEach(function (t) { t.setAttribute("aria-selected", String(t.dataset.src === src)); });
        if (!store[src]) note("Đang tải từ vựng…");
        try { await load(src); }
        catch (err) {
          if (my !== token) return;
          console.error(err);
          note(src === "norma"
            ? "Không đọc được " + NORMA_URL + ". Hãy mở trang qua máy chủ web (http://), không mở trực tiếp file."
            : "Không đọc được dữ liệu từ vựng.");
          return;
        }
        if (my === token) render();
      }

      /* ---------- sự kiện ---------- */
      document.querySelectorAll(".tab").forEach(function (t) {
        t.addEventListener("click", function () { if (t.dataset.src !== current) show(t.dataset.src); });
      });

      azBtn.addEventListener("click", function () {
        asc = !asc;
        azBtn.classList.remove("flip"); void azBtn.offsetWidth; azBtn.classList.add("flip");
        setTimeout(function () { azBtn.textContent = asc ? "a-z" : "z-a"; }, 200);   // đổi chữ đúng lúc nút lật ngang
        render();
      });

      var timer = 0;
      q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(render, 120); });

      list.addEventListener("scroll", function () {
        var top = list.scrollTop, d = top - lastTop;
        list.classList.toggle("scrolled", top > 4);
        if (AUTO_HIDE) {
          if (top <= 4 || d < -6 || document.activeElement === q) list.classList.remove("hide");
          else if (d > 6 && top > 90) list.classList.add("hide");
        }
        if (Math.abs(d) > 6 || top <= 4) lastTop = top;     // bước nhỏ thì cộng dồn, tránh nhấp nháy
        if (shown < view.length && list.scrollHeight - list.scrollTop - list.clientHeight < 400) addRows();
      }, { passive: true });
      window.addEventListener("resize", fill);

      show("global");
    })();
