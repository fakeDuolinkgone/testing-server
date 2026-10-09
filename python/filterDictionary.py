import re


INPUT_FILE = "data/english-vietnamese.txt"
OUTPUT_FILE = "data/cleanDictionary.txt"


clean_blocks = []

current_block = []


def get_word(line):

    if not line.startswith("@"):
        return None


    content = line[1:].strip()


    if not content:
        return None


    # lấy phần trước dấu /
    # vì sau đó là phiên âm
    word_part = content.split("/")[0].strip()


    word = word_part.lower()


    # có khoảng trắng -> loại
    if " " in word:
        return None


    # chỉ cho phép a-z và -
    if not re.fullmatch(r"[a-z-]+", word):
        return None


    if word.startswith("-") or word.endswith("-"):
        return None


    return word





with open(INPUT_FILE, "r", encoding="utf-8") as f:

    for line in f:

        line = line.rstrip("\n")


        # gặp entry mới
        if line.startswith("@"):


            # xử lý block trước
            if current_block:

                word = get_word(current_block[0])

                if word:

                    clean_blocks.append(current_block)


            # tạo block mới
            current_block = [line]


        else:

            # thêm các dòng:
            # * loại từ
            # - nghĩa
            # = ví dụ
            # ! chú thích

            if current_block:

                current_block.append(line)



# xử lý block cuối
if current_block:

    word = get_word(current_block[0])

    if word:

        clean_blocks.append(current_block)



with open(OUTPUT_FILE, "w", encoding="utf-8") as f:

    for block in clean_blocks:

        for line in block:

            f.write(line + "\n")

        f.write("\n")



print("Done!")
print("Kept entries:", len(clean_blocks))