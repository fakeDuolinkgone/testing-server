/* ===========================================================
   placementQuiz.js  (đặt ở data/placementQuiz.js)
   BÀI KIỂM TRA NHỎ cho người chơi mới, hiện sau bước Đăng ký / Chơi khách.
   10 câu tăng dần độ khó (khoảng A1 -> B2), thiên về từ vựng và ngữ pháp cơ bản.
   Ai muốn chỉnh bài kiểm tra CHỈ CẦN SỬA FILE NÀY, không phải đụng tới code khác.

   Mỗi câu hỏi:
     q        : câu hỏi (chữ thường, không dùng HTML)
     options  : các đáp án, từ 2 đến 6 mục
     answer   : vị trí đáp án đúng trong options, tính từ 0 (0 = mục đầu tiên)
     explain  : (tùy chọn) lời giải thích hiện ra sau khi trả lời.
                Có explain thì người chơi bấm "Tiếp tục" mới sang câu sau,
                không có thì tự sang câu sau sau chưa đầy 1 giây.

   Câu nào thiếu q/options hoặc answer không hợp lệ sẽ bị bỏ qua.
   Để trống mảng questions (hoặc xóa file) thì bỏ luôn bước kiểm tra.
   Mẹo: nên xếp đáp án đúng ở các vị trí khác nhau để người chơi không đoán mò theo thứ tự.
   =========================================================== */
window.NORMA_PLACEMENT_QUIZ = {
    title: "Bài kiểm tra nhỏ",
    intro: "10 câu từ dễ đến khó, giúp normaFix biết trình độ của bạn. Không bị trừ điểm đâu nhé!",
    questions: [
        // ---------- Dễ (A1) ----------
        {
            q: "Từ “book” có nghĩa là gì?",
            options: ["Quyển sách", "Cái bàn", "Con mèo", "Cái bút"],
            answer: 0
        },
        {
            q: "Từ nào trái nghĩa với “big” (to, lớn)?",
            options: ["tall", "small", "long", "fast"],
            answer: 1
        },
        {
            q: "Chọn từ đúng điền vào chỗ trống: She ___ a teacher.",
            options: ["am", "are", "is", "be"],
            answer: 2,
            explain: "Với chủ ngữ “she” (ngôi thứ ba số ít) ta dùng “is”."
        },

        // ---------- Cơ bản (A2) ----------
        {
            q: "Từ nào là một loại trái cây?",
            options: ["carrot", "potato", "onion", "banana"],
            answer: 3
        },
        {
            q: "I usually ___ breakfast at 7 a.m.",
            options: ["have", "has", "having", "to have"],
            answer: 0
        },
        {
            q: "Từ “borrow” có nghĩa là gì?",
            options: ["Cho mượn", "Mượn", "Mua", "Bán"],
            answer: 1,
            explain: "“borrow” là mượn đồ của người khác, còn “lend” mới là cho người khác mượn."
        },

        // ---------- Trung bình (B1) ----------
        {
            q: "If it rains tomorrow, we ___ at home.",
            options: ["stay", "stayed", "will stay", "would stay"],
            answer: 2,
            explain: "Câu điều kiện loại 1: If + hiện tại đơn, S + will + động từ nguyên mẫu."
        },
        {
            q: "Từ “improve” có nghĩa là gì?",
            options: ["Làm hỏng", "Quên", "Lặp lại", "Cải thiện"],
            answer: 3
        },

        // ---------- Khá (B2) ----------
        {
            q: "Chọn từ gần nghĩa nhất với “enormous”.",
            options: ["tiny", "quiet", "huge", "ordinary"],
            answer: 2
        },
        {
            q: "She was ___ tired that she fell asleep during the movie.",
            options: ["so", "such", "very", "too"],
            answer: 0,
            explain: "Cấu trúc “so + tính từ + that” (quá... đến nỗi...). “such” đi với danh từ, ví dụ: such a tiring day."
        }
    ]
};