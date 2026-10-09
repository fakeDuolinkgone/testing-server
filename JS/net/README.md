# BossBattle – lớp kết nối nhiều người chơi (Firebase)

Phần này lo **mạng**: tạo/vào phòng, phát bộ từ chung, đồng bộ điểm và thanh máu, chốt giai đoạn, xét thắng/thua.
Phần **game** (các mini game, giao diện boss) gọi vào qua đối tượng `net` bên dưới.

| File | Việc |
|---|---|
| `JS/net/boss-rules.js` | Luật v2: HP = người × giai đoạn × 7, số giai đoạn, thời gian 40→60s, `TARGET_ACCURACY`, xáo riêng từng người |
| `JS/net/boss-net.js` | Kết nối Firebase + bản bot giả lập + toàn bộ logic phòng |
| `JS/net/firebase-config.js` | **Bạn dán cấu hình Firebase vào đây** |
| `firebase-rules.json` | Luật bảo mật dán vào Firebase |
| `room.html`, `JS/games/room.js`, `CSS/room.css` | Sảnh chờ: tạo phòng, nhập mã, danh sách người chơi, nút Bắt đầu |
| `JS/net/engine.test.js` | Bộ test logic, chạy bằng `node JS/net/engine.test.js` (sau khi chỉnh luật nên chạy lại) |
| `gameMode/bossBattle/netTest.html` | Trang "game giả" để thử mạng khi trang game thật chưa xong |

---

## 1. Tạo Firebase (làm một lần, khoảng 5 phút)

1. Vào https://console.firebase.google.com → **Add project** (tắt Google Analytics cũng được).
2. **Build → Realtime Database → Create database**. Chọn vị trí gần Việt Nam (Singapore), chọn *locked mode*.
3. Tab **Rules** → xóa nội dung cũ, dán nội dung file `firebase-rules.json` → **Publish**.
4. Biểu tượng bánh răng → **Project settings → Your apps → Web (`</>`)** → đặt tên, đăng ký app → copy khối `firebaseConfig`.
   Nếu thiếu `databaseURL`, lấy ở trang Realtime Database (dòng `https://….firebasedatabase.app`).
5. Dán vào `JS/net/firebase-config.js` (thay các chỗ `PASTE_…`).
6. Mở `room.html` (nên chạy bằng Live Server). Tạo phòng ở một tab, mở tab/máy khác nhập mã để vào.

> `apiKey` của Firebase web không phải bí mật; việc bảo vệ nằm ở Rules. Rules hiện tại chỉ chặn dữ liệu sai dạng
> và chặn việc liệt kê toàn bộ phòng, chưa chống được người cố tình sửa điểm bằng DevTools (xem mục 5).

## 2. Thử nhanh không cần Firebase

Mở `gameMode/bossBattle/netTest.html?solo=1&fast=1` → bạn là chủ phòng, 3 bot ngồi chơi cùng, thời gian rút ngắn.
Bấm **Bắt đầu ván**, rồi **+1 điểm** thay cho việc trả lời đúng. Đổi số bot bằng `&bots=5`.

## 3. Cách gắn vào trang game thật

Sảnh chờ (`room.html`) chuyển cả phòng sang `GAME_PAGE` khi chủ phòng bấm Bắt đầu (đặt ở đầu `JS/games/room.js`,
hiện đang trỏ tới `netTest.html`, đổi thành `gameMode/bossBattle/bossBattle.html` khi trang game xong).

Trang game cần nạp các script theo thứ tự này (chỉnh lại đường dẫn cho đúng thư mục):

```html
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>
<script src="../../JS/net/firebase-config.js"></script>
<script src="../../data/englishVocabularys.js"></script>   <!-- host chọn từ cho các giai đoạn sau -->
<script src="../../JS/net/boss-rules.js"></script>
<script src="../../JS/net/boss-net.js"></script>
```

```js
const net = BossNet.create();            // thử một mình: const net = await BossNet.createSolo({ bots: 3 });

// 1) Đăng ký callback TRƯỚC, 2) rồi mới resume() – callback sẽ nhận ngay trạng thái hiện tại.
net.onStageStart(st => {
    // st.stage, st.stageCount, st.words (10 từ dùng chung), st.durationSec, st.questions
    // st.startAt / st.endsAt: giờ server (ms). Đếm ngược bằng st.serverNow()
    const order = BossRules.shuffleFor(net.id, "q:" + st.stage, st.words);                  // thứ tự câu riêng của mình
    // đáp án riêng: BossRules.shuffleFor(net.id, "opt:" + st.stage + ":" + word.word, options)
});
net.onScoresUpdate(s => {
    // s.hp, s.effectiveMaxHp, s.totalDamage, s.ranking = [{id, name, total, rank, left}]
});
net.onPlayerLeave(p => { /* p.name, p.reduction (HP boss bớt đi) */ });
net.onStageEnd(e => { /* e.stage, e.damage, e.hp, e.ranking */ });
net.onGameEnd(e => { /* e.outcome "win"|"lose", e.mvp, e.ranking, e.hp */ });

net.resume().then(r => { if (!r) location.href = "../../room.html"; });   // không còn phòng thì về sảnh

// Trong game:
score++;                      net.sendScore(st.stage, score);   // sau mỗi câu đúng ngay lần đầu (điểm chỉ tăng)
/* làm xong 10 câu */         net.sendDone(st.stage);           // tùy chọn: mọi người xong sớm thì host chuyển giai đoạn sớm
```

Danh sách đầy đủ:

| Hàm | Ý nghĩa |
|---|---|
| `getPlayers()` | `[{id, name, isHost, isMe, online}]` |
| `onStageStart(cb)` | Báo bắt đầu giai đoạn (kèm bộ từ chung do host chọn) |
| `sendScore(stage, score)` / `onScoresUpdate(cb)` | Gửi điểm của mình / nhận điểm mọi người để chạy thanh máu |
| `onPlayerLeave(cb)` | Có người thoát giữa ván |
| `sendDone(stage)` | (thêm) Báo đã xong giai đoạn |
| `onStageEnd(cb)`, `onGameEnd(cb)` | (thêm) Kết quả từng giai đoạn / cả ván |
| `onPlayersChange`, `onGameStart`, `onRemoved`, `onRoomClosed` | (thêm) Cho sảnh chờ |
| `createRoom`, `joinRoom`, `resume`, `leaveRoom`, `startGame`, `isHost`, `me`, `serverNow` | Quản lý phòng |

Muốn host chọn từ theo cách riêng (ví dụ chỉ lấy từ ≤ 8 chữ cho Speed Typing):
`BossNet.create({ pickWords: (stage, count, used) => [...] })` – `used` là các từ đã dùng ở giai đoạn trước.

## 4. Cách hoạt động (để biết khi cần sửa)

- **Máy chủ phòng (host) là trọng tài.** Host phát từ, chốt giai đoạn khi hết giờ (hoặc khi mọi người đã `sendDone`), tính
  thắng/thua và ghi kết quả. Các máy khác chỉ gửi điểm của mình.
- **Host rớt mạng** quá `OFFLINE_GRACE_MS` (12 giây) thì người vào phòng sớm nhất còn lại tự nhận làm host, ván không bị kẹt.
- **Chuyển trang không bị tính là thoát.** Mất kết nối chỉ đánh dấu offline; quá 12 giây mới coi là rời phòng.
  `resume()` ở trang game nối lại đúng người chơi cũ nhờ `sessionStorage`.
- **Người rời giữa ván:** boss bớt `7 × (số giai đoạn chưa xong) − điểm họ đã ghi ở giai đoạn đang dở` máu (không âm).
  Điểm đã ghi vẫn tính.
- **Điểm gửi trễ** (quá hết giờ + `GRACE_MS`) không được tính.
- **MVP:** nhiều sát thương nhất; hòa thì người ghi điểm sớm hơn.
- Muốn chỉnh độ khó: `TARGET_ACCURACY` trong `boss-rules.js`. Thời gian giai đoạn: `MIN_SECONDS`, `MAX_SECONDS`.
  Với 4–5 giai đoạn, thời gian tăng đều từ 40 lên 60 giây (tài liệu luật chỉ nêu trường hợp 3 giai đoạn).

## 5. Giới hạn cần biết

- Chưa thử với Firebase thật, kể cả file `firebase-rules.json` (môi trường làm bài không có Internet). Nếu Firebase báo lỗi cú pháp khi Publish Rules, hãy dán thông báo lỗi lại để sửa. Logic đã được kiểm tra bằng bản giả lập trong bộ nhớ
  dùng chung giao diện với lớp Firebase, nên nếu có lỗi thì nhiều khả năng nằm ở cấu hình hoặc Rules. Hãy thử 2 tab trước khi mang đi lớp.
- Không có đăng nhập Firebase, nên ai nắm mã phòng và biết dùng DevTools đều có thể sửa dữ liệu phòng. Chơi với bạn bè/lớp học thì
  ổn; muốn xếp hạng công khai cần thêm Firebase Authentication và Rules chặt hơn, hoặc server riêng.
- Phòng cũ không tự xóa nếu mọi người tắt trình duyệt đột ngột; thỉnh thoảng vào Realtime Database xóa nhánh `rooms` cũ.
- Các giới hạn của gói miễn phí Firebase có thể thay đổi, hãy xem trang giá của Firebase trước khi dùng cho lớp đông.
