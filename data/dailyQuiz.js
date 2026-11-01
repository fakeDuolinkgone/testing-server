/* ===========================================================
   dailyQuiz.js  (đặt ở data/dailyQuiz.js)
   BÀI KIỂM TRA MỖI NGÀY: 7 bộ đề, mỗi bộ 10 câu.

   Cách chọn bộ đề: theo THỨ trong tuần (giờ trên máy người chơi)
       id 1 = Thứ Hai ... id 6 = Thứ Bảy, id 7 = Chủ Nhật
   => Mọi người làm trong cùng một thứ đều gặp đúng cùng một bộ đề,
      cùng thứ tự câu, cùng thứ tự đáp án (không xáo trộn) để dễ thống kê.

   CẤU TRÚC ĐỘ KHÓ CỐ ĐỊNH (để các bộ đề so sánh được với nhau):
       câu 1-3  : dễ        (A1)
       câu 4-6  : cơ bản    (A2)
       câu 7-8  : trung bình (B1)
       câu 9-10 : khá       (B2)
   Khi sửa hoặc thêm câu, hãy GIỮ NGUYÊN vị trí và mức độ khó này.
   (File phân tích analyze-quiz.py dựa vào đúng quy ước này.)

   Mỗi câu hỏi:
     q        : câu hỏi (chữ thường, không dùng HTML)
     options  : các đáp án, từ 2 đến 6 mục
     answer   : vị trí đáp án đúng trong options, tính từ 0
     explain  : (tùy chọn) lời giải thích, hiện sau khi trả lời

   QUAN TRỌNG: mỗi lần SỬA NỘI DUNG câu hỏi thì tăng "ver" lên 1,
   để số liệu thống kê của bản cũ và bản mới không bị trộn lẫn.
   =========================================================== */
window.NORMA_DAILY_QUIZ = {
    ver: 1,
    sets: [

        /* ---------------- 1 · THỨ HAI ---------------- */
        {
            id: 1, day: "Thứ Hai",
            questions: [
                { q: "Từ “water” có nghĩa là gì?", options: ["Lửa", "Nước", "Gió", "Đất"], answer: 1 },
                { q: "This is ___ apple.", options: ["an", "a", "some", "many"], answer: 0,
                  explain: "“apple” bắt đầu bằng nguyên âm nên dùng “an”." },
                { q: "Từ nào trái nghĩa với “happy”?", options: ["excited", "kind", "young", "sad"], answer: 3 },

                { q: "He ___ football every Sunday.", options: ["plays", "play", "playing", "played"], answer: 0 },
                { q: "Từ “expensive” có nghĩa là gì?", options: ["Rẻ", "Đắt", "Cũ", "Mới"], answer: 1 },
                { q: "There ___ two books on the table.", options: ["is", "am", "are", "be"], answer: 2 },

                { q: "I have lived here ___ 2015.", options: ["for", "since", "from", "in"], answer: 1,
                  explain: "“since” đi với một mốc thời gian (2015), “for” đi với một khoảng thời gian." },
                { q: "Từ “reduce” có nghĩa là gì?", options: ["Tăng", "Giữ nguyên", "Đổi", "Giảm"], answer: 3 },

                { q: "Chọn từ gần nghĩa nhất với “rarely”.", options: ["often", "always", "seldom", "usually"], answer: 2 },
                { q: "By the time we arrived, the film ___.",
                  options: ["already started", "was already starting", "has already started", "had already started"], answer: 3,
                  explain: "Việc xảy ra trước một mốc trong quá khứ dùng quá khứ hoàn thành: had + V3." }
            ]
        },

        /* ---------------- 2 · THỨ BA ---------------- */
        {
            id: 2, day: "Thứ Ba",
            questions: [
                { q: "Từ “house” có nghĩa là gì?", options: ["Ngôi nhà", "Trường học", "Cửa hàng", "Bệnh viện"], answer: 0 },
                { q: "I ___ a student.", options: ["is", "are", "am", "be"], answer: 2 },
                { q: "Từ nào trái nghĩa với “young”?", options: ["old", "new", "small", "fresh"], answer: 0 },

                { q: "She ___ TV at the moment.", options: ["watch", "watches", "is watching", "watched"], answer: 2,
                  explain: "“at the moment” (ngay lúc này) dùng thì hiện tại tiếp diễn: is/are + V-ing." },
                { q: "Từ “empty” có nghĩa là gì?", options: ["Đầy", "Trống rỗng", "Nặng", "Sạch"], answer: 1 },
                { q: "How ___ water do you drink every day?", options: ["many", "much", "few", "a lot"], answer: 1,
                  explain: "“water” là danh từ không đếm được nên dùng “much”." },

                { q: "If she ___ harder, she will pass the exam.", options: ["study", "studies", "studied", "studying"], answer: 1 },
                { q: "Từ “increase” có nghĩa là gì?", options: ["Tăng", "Giảm", "Dừng", "Tránh"], answer: 0 },

                { q: "Chọn từ gần nghĩa nhất với “purchase”.", options: ["sell", "buy", "borrow", "lose"], answer: 1 },
                { q: "He suggested ___ to the beach at the weekend.", options: ["to go", "go", "going", "went"], answer: 2,
                  explain: "Sau “suggest” ta dùng V-ing." }
            ]
        },

        /* ---------------- 3 · THỨ TƯ ---------------- */
        {
            id: 3, day: "Thứ Tư",
            questions: [
                { q: "Từ “school” có nghĩa là gì?", options: ["Bệnh viện", "Nhà hàng", "Công viên", "Trường học"], answer: 3 },
                { q: "My brother ___ two sisters.", options: ["have", "has", "having", "haves"], answer: 1 },
                { q: "Từ nào trái nghĩa với “fast”?", options: ["slow", "quick", "early", "loud"], answer: 0 },

                { q: "Từ “breakfast” là bữa ăn nào trong ngày?", options: ["Bữa sáng", "Bữa trưa", "Bữa tối", "Bữa phụ"], answer: 0 },
                { q: "We ___ to the cinema yesterday.", options: ["go", "goes", "went", "going"], answer: 2 },
                { q: "This bag is ___ than that one.", options: ["heavy", "heavier", "heaviest", "more heavy"], answer: 1,
                  explain: "Tính từ ngắn kết thúc bằng -y: đổi y thành i rồi thêm -er (heavier)." },

                { q: "The book ___ by millions of people.", options: ["read", "is reading", "reads", "is read"], answer: 3,
                  explain: "Câu bị động: is/are + V3." },
                { q: "Từ “avoid” có nghĩa là gì?", options: ["Tránh", "Đuổi theo", "Chờ", "Chọn"], answer: 0 },

                { q: "Chọn từ gần nghĩa nhất với “tiny”.", options: ["enormous", "narrow", "little", "wide"], answer: 2 },
                { q: "I wish I ___ more time to study.", options: ["have", "had", "will have", "having"], answer: 1,
                  explain: "“wish” diễn tả điều ước ở hiện tại thì động từ lùi về quá khứ đơn: had." }
            ]
        },

        /* ---------------- 4 · THỨ NĂM ---------------- */
        {
            id: 4, day: "Thứ Năm",
            questions: [
                { q: "Từ “friend” có nghĩa là gì?", options: ["Kẻ thù", "Hàng xóm", "Bạn bè", "Họ hàng"], answer: 2 },
                { q: "They ___ playing in the garden.", options: ["is", "am", "are", "be"], answer: 2 },
                { q: "Từ nào trái nghĩa với “open”?", options: ["close", "break", "start", "clean"], answer: 0 },

                { q: "I ___ my homework every evening.", options: ["do", "does", "doing", "done"], answer: 0 },
                { q: "Từ “dangerous” có nghĩa là gì?", options: ["An toàn", "Nguy hiểm", "Thú vị", "Yên tĩnh"], answer: 1 },
                { q: "There isn't ___ milk in the fridge.", options: ["some", "many", "any", "few"], answer: 2,
                  explain: "Câu phủ định dùng “any”." },

                { q: "He has worked here ___ five years.", options: ["since", "for", "from", "during"], answer: 1 },
                { q: "Từ “describe” có nghĩa là gì?", options: ["Mô tả", "Quên", "Xóa", "Gửi"], answer: 0 },

                { q: "Chọn từ gần nghĩa nhất với “difficult”.", options: ["easy", "simple", "hard", "clear"], answer: 2 },
                { q: "The teacher made the students ___ the text again.", options: ["read", "to read", "reading", "reads"], answer: 0,
                  explain: "“make + O + động từ nguyên mẫu không to”." }
            ]
        },

        /* ---------------- 5 · THỨ SÁU ---------------- */
        {
            id: 5, day: "Thứ Sáu",
            questions: [
                { q: "Từ “window” có nghĩa là gì?", options: ["Cửa ra vào", "Cửa sổ", "Tường", "Mái nhà"], answer: 1 },
                { q: "My mother is ___ teacher.", options: ["an", "some", "a", "many"], answer: 2 },
                { q: "Từ nào trái nghĩa với “easy”?", options: ["difficult", "soft", "short", "near"], answer: 0 },

                { q: "She can ___ very well.", options: ["sings", "sing", "singing", "sang"], answer: 1,
                  explain: "Sau động từ khuyết thiếu “can” là động từ nguyên mẫu." },
                { q: "Từ “crowded” có nghĩa là gì?", options: ["Vắng vẻ", "Đông đúc", "Sạch sẽ", "Tối tăm"], answer: 1 },
                { q: "I'm going to ___ my grandmother this weekend.", options: ["visit", "visiting", "visited", "visits"], answer: 0 },

                { q: "He didn't go out ___ it was raining.", options: ["because", "so", "but", "although"], answer: 0 },
                { q: "Từ “achieve” có nghĩa là gì?", options: ["Bỏ cuộc", "Đạt được", "Từ chối", "Trì hoãn"], answer: 1 },

                { q: "Chọn từ gần nghĩa nhất với “ancient”.", options: ["modern", "recent", "fresh", "very old"], answer: 3 },
                { q: "Hardly had he sat down ___ the phone rang.", options: ["when", "than", "then", "while"], answer: 0,
                  explain: "Cấu trúc đảo ngữ: Hardly + had + S + V3 + when ... (vừa mới ... thì ...)." }
            ]
        },

        /* ---------------- 6 · THỨ BẢY ---------------- */
        {
            id: 6, day: "Thứ Bảy",
            questions: [
                { q: "Từ “moon” có nghĩa là gì?", options: ["Mặt trời", "Mặt trăng", "Ngôi sao", "Đám mây"], answer: 1 },
                { q: "___ is your name?", options: ["Who", "Where", "What", "When"], answer: 2 },
                { q: "Từ nào trái nghĩa với “tall”?", options: ["short", "small", "thin", "low"], answer: 0 },

                { q: "We usually ___ dinner at 6 p.m.", options: ["eat", "eats", "eating", "ate"], answer: 0 },
                { q: "Từ “neighbour” có nghĩa là gì?", options: ["Người lạ", "Đồng nghiệp", "Hàng xóm", "Bạn học"], answer: 2 },
                { q: "The park is ___ the library and the bank.", options: ["on", "between", "in", "at"], answer: 1 },

                { q: "I'll call you as soon as I ___ home.", options: ["get", "will get", "got", "getting"], answer: 0,
                  explain: "Mệnh đề thời gian (as soon as, when, after...) không dùng “will”, dùng hiện tại đơn." },
                { q: "Từ “support” (động từ) có nghĩa là gì?", options: ["Ủng hộ", "Phản đối", "Giấu", "Đánh giá"], answer: 0 },

                { q: "Chọn từ gần nghĩa nhất với “brave”.", options: ["scared", "courageous", "weak", "careless"], answer: 1 },
                { q: "She is the woman ___ car was stolen.", options: ["who", "which", "whose", "whom"], answer: 2,
                  explain: "“whose” chỉ sở hữu: the woman whose car = người phụ nữ có chiếc xe ..." }
            ]
        },

        /* ---------------- 7 · CHỦ NHẬT ---------------- */
        {
            id: 7, day: "Chủ Nhật",
            questions: [
                { q: "Từ “mother” có nghĩa là gì?", options: ["Chị gái", "Bà", "Cô giáo", "Mẹ"], answer: 3 },
                { q: "They ___ not at home now.", options: ["is", "are", "am", "do"], answer: 1 },
                { q: "Từ nào trái nghĩa với “night”?", options: ["evening", "dark", "moon", "day"], answer: 3 },

                { q: "I ___ a cup of coffee every morning.", options: ["drinks", "drinking", "drank", "drink"], answer: 3 },
                { q: "Từ “lonely” có nghĩa là gì?", options: ["Cô đơn", "Vui vẻ", "Bận rộn", "Giận dữ"], answer: 0 },
                { q: "This is the ___ film I have ever seen.", options: ["good", "better", "best", "well"], answer: 2,
                  explain: "So sánh nhất của “good” là “the best”." },

                { q: "You ___ wear a seat belt when driving. It's the law.", options: ["can", "might", "must", "may"], answer: 2 },
                { q: "Từ “prevent” có nghĩa là gì?", options: ["Ngăn chặn", "Cho phép", "Bắt đầu", "Giúp đỡ"], answer: 0 },

                { q: "Chọn từ gần nghĩa nhất với “reluctant”.", options: ["eager", "unwilling", "certain", "grateful"], answer: 1 },
                { q: "Not only ___ the exam, but she also got the highest score.",
                  options: ["she passed", "did she pass", "she did pass", "passed she"], answer: 1,
                  explain: "Đảo ngữ sau “Not only”: Not only + trợ động từ + S + V ..." }
            ]
        }
    ]
};
