// wordHunt/wordHuntCore.js — luật của Word Hunt (logic thuần, không DOM, không mạng).
// Dùng chung cho chơi đơn, chơi nhiều người, và chủ phòng.
(function (root) {

  const WH = {
    SECONDS: 60,                              // thời gian một ván
    MIN_LENGTH: 3,                            // số chữ cái tối thiểu của một từ (không tính dấu gạch ngang)
    LETTERS: "abcdefghijklmnopqrstuvwyz",     // bỏ "x": từ điển chỉ có khoảng 50 từ
    COUNTDOWN_MS: 4000,                       // đếm ngược trước khi bắt đầu
    GRACE_MS: 15000,                          // chờ thêm sau khi hết giờ rồi mới chốt kết quả
    MAX_PLAYERS: 80
  };

  // Điểm của một từ: 1 điểm cho mỗi chữ cái
  const points = word => word.replace(/-/g, "").length;

  // Cả phòng cùng seed nên cùng một chữ cái
  const letterFor = seed => WH.LETTERS[(seed >>> 0) % WH.LETTERS.length];

  // Mốc cuối cùng: tới đó host chốt kết quả dù còn ai chưa nộp bài
  const deadline = startAt => startAt + WH.SECONDS * 1000 + WH.GRACE_MS;

  // entries: [{ id, score, count, left }] → xếp hạng; hòa điểm thì ai nhiều từ hơn xếp trên
  const rank = entries => [...entries]
    .sort((a, b) => b.score - a.score || b.count - a.count || String(a.id).localeCompare(String(b.id)))
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const api = { WH, points, letterFor, deadline, rank };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WordHuntCore = api;

})(typeof window !== "undefined" ? window : globalThis);
