import re
import json


INPUT_FILE = "data/english-vietnamese.txt"
OUTPUT_FILE = "data/wordChainData.js"


# ============================================================
# DATA
# ============================================================

data = {}

current_word = None
current_type = None

# Danh sách meanings trực tiếp của word
current_meanings = []

# Danh sách phrases của word
current_phrases = []

# Phrase hiện tại đang được đọc
current_phrase = None

# Meaning trực tiếp gần nhất
# Dùng để gắn "=" đúng vào meaning đó
last_meaning = None


# ============================================================
# CONVERT PART OF SPEECH
# ============================================================

def convert_type(text):
    text = text.lower()

    if "danh từ" in text:
        return "n"

    if "tính từ" in text:
        return "adj"

    if "trạng từ" in text:
        return "adv"

    if "ngoại động từ" in text:
        return "v"

    if "nội động từ" in text:
        return "v"

    if "động từ" in text:
        return "v"

    if "thán từ" in text:
        return "int"

    if "giới từ" in text:
        return "prep"

    if "liên từ" in text:
        return "conj"

    if "đại từ" in text:
        return "pron"

    if "mạo từ" in text:
        return "art"

    if "số từ" in text:
        return "num"

    if "từ hạn định" in text:
        return "det"

    return ""


# ============================================================
# PARSE EXAMPLE
# ============================================================

def parse_example(line):
    """
    Ví dụ:

        =how fares it?+ tình hình thế nào?

    Trả về:

        {
            "en": "how fares it?",
            "vi": "tình hình thế nào?"
        }
    """

    content = line[1:].strip()

    if "+" in content:

        english, vietnamese = content.split("+", 1)

        return {
            "en": english.strip(),
            "vi": vietnamese.strip()
        }

    return {
        "en": content,
        "vi": ""
    }


# ============================================================
# SAVE PHRASE
# ============================================================

def save_current_phrase():
    global current_phrase

    if current_phrase is None:
        return

    if not current_phrase["phrase"]:
        current_phrase = None
        return

    current_phrases.append(current_phrase)

    current_phrase = None


# ============================================================
# SAVE WORD
# ============================================================

def save_word():
    global current_word
    global current_type
    global current_meanings
    global current_phrases
    global current_phrase

    if not current_word:
        return

    # Phrase cuối cùng nếu đang mở
    save_current_phrase()

    # Không có dữ liệu
    if not current_meanings and not current_phrases:
        return

    # --------------------------------------------------------
    # TẠO ENTRY
    # --------------------------------------------------------

    if current_word not in data:

        data[current_word] = {
            "word": current_word,
            "type": [],
            "meanings": [],
            "phrases": []
        }

    entry = data[current_word]


    # ========================================================
    # MERGE MEANINGS
    # ========================================================

    for meaning in current_meanings:

        meaning_type = meaning["type"]
        meaning_text = meaning["text"]

        # --------------------------------------------
        # Collect top-level type
        # --------------------------------------------

        if (
            meaning_type
            and meaning_type not in entry["type"]
        ):
            entry["type"].append(meaning_type)


        # --------------------------------------------
        # Check duplicate meaning
        # --------------------------------------------

        exists = False

        for existing in entry["meanings"]:

            if (
                existing["type"] == meaning_type
                and existing["text"] == meaning_text
            ):
                exists = True

                # Merge examples
                for example in meaning["examples"]:

                    if example not in existing["examples"]:
                        existing["examples"].append(example)

                break


        # --------------------------------------------
        # New meaning
        # --------------------------------------------

        if not exists:
            entry["meanings"].append(meaning)


    # ========================================================
    # MERGE PHRASES
    # ========================================================

    for phrase in current_phrases:

        phrase_name = phrase["phrase"]

        existing_phrase = None

        for existing in entry["phrases"]:

            if existing["phrase"] == phrase_name:
                existing_phrase = existing
                break


        # --------------------------------------------
        # Phrase mới
        # --------------------------------------------

        if existing_phrase is None:

            entry["phrases"].append(phrase)

            continue


        # --------------------------------------------
        # Phrase đã tồn tại
        # --------------------------------------------

        # Gộp meanings
        for meaning in phrase["meanings"]:

            if meaning not in existing_phrase["meanings"]:
                existing_phrase["meanings"].append(meaning)


        # Gộp examples
        for example in phrase["examples"]:

            if example not in existing_phrase["examples"]:
                existing_phrase["examples"].append(example)


# ============================================================
# ADD MEANING
# ============================================================

def add_meaning(text):

    global current_type
    global current_meanings
    global current_phrase
    global last_meaning

    text = text.strip()

    if not text:
        return


    # ========================================================
    # MEANING CỦA PHRASE
    # ========================================================

    if current_phrase is not None:

        current_phrase["meanings"].append(text)

        return


    # ========================================================
    # MEANING CỦA WORD
    # ========================================================

    meaning = {
        "type": current_type,
        "text": text,
        "examples": []
    }

    current_meanings.append(meaning)

    last_meaning = meaning


# ============================================================
# MAIN PARSER
# ============================================================

with open(INPUT_FILE, "r", encoding="utf-8") as f:

    for raw in f:

        line = raw.strip()

        if not line:
            continue


        # ====================================================
        # WORD
        # ====================================================

        if line.startswith("@"):

            # Lưu word trước
            save_word()

            # Reset
            current_word = None
            current_type = None

            current_meanings = []
            current_phrases = []

            current_phrase = None
            last_meaning = None


            content = line[1:].strip()

            if not content:
                continue


            # Lấy token đầu tiên
            word = content.split()[0].lower()


            # Cho phép:
            #
            # fare
            # well-known
            # x-ray
            # state-of-the-art
            #

            if re.fullmatch(
                r"[a-z]+(?:-[a-z]+)*",
                word
            ):
                current_word = word

            continue


        if not current_word:
            continue


        # ====================================================
        # PART OF SPEECH
        # ====================================================

        if line.startswith("*"):

            # Phrase trước đó kết thúc
            save_current_phrase()

            current_type = convert_type(
                line[1:].strip()
            )

            # Meaning cuối cùng không còn
            # thuộc context mới
            last_meaning = None

            continue


        # ====================================================
        # PHRASE / EXPRESSION
        # ====================================================

        if line.startswith("!"):

            # Lưu phrase trước
            save_current_phrase()

            phrase_text = line[1:].strip()

            if not phrase_text:
                continue


            current_phrase = {
                "phrase": phrase_text,
                "type": current_type,
                "meanings": [],
                "examples": []
            }

            # "=" sau ! phải thuộc phrase,
            # không được gắn vào meaning trước đó
            last_meaning = None

            continue


        # ====================================================
        # MEANING
        # ====================================================

        if line.startswith("-"):

            add_meaning(
                line[1:].strip()
            )

            continue


        # ====================================================
        # EXAMPLE
        # ====================================================

        if line.startswith("="):

            example = parse_example(line)


            # --------------------------------------------
            # Example của phrase
            # --------------------------------------------

            if current_phrase is not None:

                if example not in current_phrase["examples"]:
                    current_phrase["examples"].append(
                        example
                    )

                continue


            # --------------------------------------------
            # Example của meaning gần nhất
            # --------------------------------------------

            if last_meaning is not None:

                if example not in last_meaning["examples"]:
                    last_meaning["examples"].append(
                        example
                    )

            continue


# ============================================================
# SAVE LAST WORD
# ============================================================

save_word()


# ============================================================
# CLEAN DATA
# ============================================================

for word, entry in data.items():

    # --------------------------------------------------------
    # Remove empty meanings
    # --------------------------------------------------------

    entry["meanings"] = [
        meaning
        for meaning in entry["meanings"]
        if meaning.get("text")
    ]


    # --------------------------------------------------------
    # Remove empty phrases
    # --------------------------------------------------------

    entry["phrases"] = [
        phrase
        for phrase in entry["phrases"]
        if phrase.get("phrase")
    ]


    # --------------------------------------------------------
    # Remove duplicate top-level types
    # --------------------------------------------------------

    entry["type"] = list(
        dict.fromkeys(entry["type"])
    )


# ============================================================
# LOOKUP + STARTS WITH
# ============================================================

result = {
    "lookup": data,
    "startsWith": {}
}


for word in data:

    first = word[0]

    if first not in result["startsWith"]:
        result["startsWith"][first] = []

    result["startsWith"][first].append(word)


# ============================================================
# WRITE JS
# ============================================================

with open(
    OUTPUT_FILE,
    "w",
    encoding="utf-8"
) as f:

    f.write("const wordChainData = ")

    json.dump(
        result,
        f,
        ensure_ascii=False,
        indent=2
    )

    f.write(";")


# ============================================================
# STATISTICS
# ============================================================

total_words = len(data)

total_meanings = sum(
    len(entry["meanings"])
    for entry in data.values()
)

total_phrases = sum(
    len(entry["phrases"])
    for entry in data.values()
)

total_examples = 0

for entry in data.values():

    # Examples của meanings
    for meaning in entry["meanings"]:

        total_examples += len(
            meaning["examples"]
        )


    # Examples của phrases
    for phrase in entry["phrases"]:

        total_examples += len(
            phrase["examples"]
        )


# ============================================================
# REPORT
# ============================================================

print("DONE!")
print("Words:", total_words)
print("Meanings:", total_meanings)
print("Phrases:", total_phrases)
print("Examples:", total_examples)

