import json
import re


INPUT_FILE = "data/cleanDictionary.txt"
OUTPUT_FILE = "data/normaFixWords.json"


words = []

current = None



with open(INPUT_FILE, "r", encoding="utf-8") as f:

    for line in f:

        line = line.strip()


        # bỏ dòng trống
        if not line:
            continue



        # =========================
        # Dòng từ mới
        # =========================

        if line.startswith("@"):


            # lưu từ trước
            if current:

                words.append(current)



            content = line[1:].strip()


            # lấy từ trước dấu /
            parts = content.split("/")


            word_part = parts[0].strip()


            word = word_part.lower()


            pronounce = ""


            if len(parts) >= 3:

                pronounce = "/" + parts[1] + "/"


            current = {

                "word": word,

                "pronounce": pronounce,

                "type": "",

                "meaning": ""

            }



        # =========================
        # Loại từ
        # =========================

        elif line.startswith("*"):

            if current:

                current["type"] = (
                    line[1:]
                    .strip()
                )



        # =========================
        # Nghĩa đầu tiên
        # =========================

        elif line.startswith("-"):

            if current and current["meaning"] == "":

                meaning = (
                    line[1:]
                    .strip()
                )

                current["meaning"] = meaning




# thêm từ cuối
if current:

    words.append(current)



# =========================
# lọc lần cuối
# =========================

clean = []


seen = set()



for item in words:


    word = item["word"]


    # bỏ từ lỗi
    if not re.fullmatch(
        r"[a-z-]+",
        word
    ):
        continue


    # bỏ chữ đơn
    if len(word) < 2:
        continue


    # bỏ trùng
    if word in seen:
        continue


    seen.add(word)



    clean.append(item)



# =========================
# xuất JSON
# =========================

with open(
    OUTPUT_FILE,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        clean,
        f,
        ensure_ascii=False,
        indent=2
    )



print("DONE!")
print("Words:", len(clean))