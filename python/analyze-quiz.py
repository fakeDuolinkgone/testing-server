#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
analyze-quiz.py - thống kê bài kiểm tra mỗi ngày của normaFix.

Cách lấy dữ liệu:
  Firebase Console -> Realtime Database -> nhánh "quizAttempts" -> menu ⋮ -> Export JSON
Cách chạy:
  python analyze-quiz.py quizAttempts.json            # in báo cáo
  python analyze-quiz.py quizAttempts.json --csv ra.csv   # xuất mỗi lượt làm 1 dòng (mở bằng Excel)

Quy ước độ khó theo vị trí câu (khớp data/dailyQuiz.js):
  câu 1-3 = A1, 4-6 = A2, 7-8 = B1, 9-10 = B2
Chỉ dùng thư viện có sẵn của Python 3.
"""
import csv
import json
import sys
from collections import defaultdict
from statistics import mean

LEVELS = ["A1"] * 3 + ["A2"] * 3 + ["B1"] * 2 + ["B2"] * 2
DAY_NAMES = {1: "Thứ Hai", 2: "Thứ Ba", 3: "Thứ Tư", 4: "Thứ Năm", 5: "Thứ Sáu", 6: "Thứ Bảy", 7: "Chủ Nhật"}


def as_list(x):
    """Firebase xuất mảng thành list hoặc dict khóa số; đưa về list."""
    if isinstance(x, list):
        return [v for v in x if v is not None]
    if isinstance(x, dict):
        return [x[k] for k in sorted(x, key=lambda k: int(k) if str(k).isdigit() else 0)]
    return []


def load(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    rows = list(data.values()) if isinstance(data, dict) else data
    out = []
    for r in rows:
        if not isinstance(r, dict) or "score" not in r or not r.get("total"):
            continue
        r = dict(r)
        r["pct"] = r["score"] / r["total"] * 100
        r["ok"] = as_list(r.get("ok"))
        r["answers"] = as_list(r.get("answers"))
        r["times"] = as_list(r.get("times"))
        r["ctx"] = r.get("ctx") or {}
        out.append(r)
    return out


def avg(xs):
    xs = list(xs)
    return mean(xs) if xs else 0.0


def table(title, header, rows):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)
    if not rows:
        print("(chưa có dữ liệu)")
        return
    widths = [max(len(str(x)) for x in col) for col in zip(header, *rows)]
    line = lambda r: "  ".join(str(c).ljust(w) for c, w in zip(r, widths))
    print(line(header))
    print("  ".join("-" * w for w in widths))
    for r in rows:
        print(line(r))


def report(rows):
    users = {r["uid"] for r in rows}
    guests = {r["uid"] for r in rows if r.get("guest")}
    table("1. TỔNG QUAN", ["Chỉ số", "Giá trị"], [
        ["Số lượt làm bài", len(rows)],
        ["Số người làm (uid)", len(users)],
        ["  trong đó khách", len(guests)],
        ["Điểm trung bình", f"{avg(r['pct'] for r in rows):.1f}%"],
        ["Thời gian trung bình / lượt", f"{avg(r.get('secs', 0) for r in rows):.0f} giây"],
        ["Số lượt / người", f"{len(rows) / max(1, len(users)):.2f}"],
    ])

    by_date = defaultdict(list)
    for r in rows:
        by_date[r["date"]].append(r)
    table("2. THEO NGÀY", ["Ngày", "Bộ đề", "Lượt", "Người", "Điểm TB", "Lần 1 TB"],
          [[d, DAY_NAMES.get(v[0]["set"], v[0]["set"]), len(v), len({x["uid"] for x in v}),
            f"{avg(x['pct'] for x in v):.1f}%",
            f"{avg(x['pct'] for x in v if x.get('n') == 1):.1f}%"]
           for d, v in sorted(by_date.items())])

    by_set = defaultdict(list)
    for r in rows:
        by_set[r["set"]].append(r)
    rows_set = []
    for sid, v in sorted(by_set.items()):
        lv = defaultdict(list)
        for r in v:
            for i, ok in enumerate(r["ok"][:10]):
                lv[LEVELS[i]].append(ok)
        rows_set.append([DAY_NAMES.get(sid, sid), len(v), f"{avg(x['pct'] for x in v):.1f}%",
                         f"{avg(x.get('secs', 0) for x in v):.0f}s"] +
                        [f"{avg(lv[l]) * 100:.0f}%" if lv[l] else "-" for l in ("A1", "A2", "B1", "B2")])
    table("3. THEO BỘ ĐỀ (tỉ lệ đúng theo mức độ)", ["Bộ đề", "Lượt", "Điểm TB", "Thời gian", "A1", "A2", "B1", "B2"], rows_set)

    by_n = defaultdict(list)
    for r in rows:
        by_n[min(int(r.get("n", 1)), 4)].append(r)
    table("4. THEO LẦN LÀM TRONG NGÀY (lần 1, 2, 3, 4+)", ["Lần", "Số lượt", "Điểm TB"],
          [[("4+" if n == 4 else n), len(v), f"{avg(x['pct'] for x in v):.1f}%"] for n, v in sorted(by_n.items())])

    # tiến bộ khi làm lại trong cùng ngày (có thể do nhớ đề, đọc kèm mục 6)
    per_day = defaultdict(list)
    for r in rows:
        per_day[(r["uid"], r["date"])].append(r)
    diffs = []
    for v in per_day.values():
        if len(v) >= 2:
            v = sorted(v, key=lambda x: x.get("n", 0))
            diffs.append(v[-1]["pct"] - v[0]["pct"])
    print(f"\n  Làm lại trong cùng ngày: {len(diffs)} trường hợp, "
          f"điểm lần cuối so với lần đầu thay đổi trung bình {avg(diffs):+.1f} điểm %.")

    # theo số ván đã học trước đó (ctx.games), chỉ tính lần làm đầu tiên trong ngày
    buckets = [("0 ván", 0, 0), ("1-4 ván", 1, 4), ("5-9 ván", 5, 9), ("10+ ván", 10, 10 ** 9)]
    rb = []
    for name, lo, hi in buckets:
        v = [r for r in rows if r.get("n", 1) == 1 and lo <= r["ctx"].get("games", 0) <= hi]
        rb.append([name, len(v), f"{avg(x['pct'] for x in v):.1f}%" if v else "-"])
    table("5. ĐIỂM LẦN ĐẦU THEO SỐ VÁN ĐÃ HỌC TRƯỚC ĐÓ", ["Đã học", "Số lượt", "Điểm TB"], rb)

    # tiến bộ dài hạn của từng người: lần đầu của ngày đầu tiên so với ngày gần nhất
    by_user = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by_user[r["uid"]][r["date"]].append(r)
    gains = []
    for days in by_user.values():
        if len(days) >= 2:
            ds = sorted(days)
            first = min(days[ds[0]], key=lambda x: x.get("n", 0))["pct"]
            last = min(days[ds[-1]], key=lambda x: x.get("n", 0))["pct"]
            gains.append(last - first)
    print("\n" + "=" * 70)
    print("6. TIẾN BỘ DÀI HẠN (lần làm đầu của ngày đầu tiên -> ngày gần nhất)")
    print("=" * 70)
    if gains:
        print(f"  {len(gains)} người có từ 2 ngày làm bài trở lên; thay đổi trung bình {avg(gains):+.1f} điểm %.")
        print(f"  Tăng: {sum(g > 0 for g in gains)} · giữ nguyên: {sum(g == 0 for g in gains)} · giảm: {sum(g < 0 for g in gains)}")
        print("  Lưu ý: mỗi thứ là một bộ đề khác nhau nên cần đủ người/ngày mới kết luận chắc chắn.")
    else:
        print("(chưa có người nào làm từ 2 ngày khác nhau)")

    # câu khó nhất
    q_stat = defaultdict(list)
    for r in rows:
        for i, ok in enumerate(r["ok"][:10]):
            q_stat[(r["set"], r.get("ver", 1), i + 1)].append(ok)
    hard = sorted(q_stat.items(), key=lambda kv: avg(kv[1]))[:10]
    table("7. 10 CÂU KHÓ NHẤT (tỉ lệ đúng thấp nhất, cần ít nhất 5 lượt)", ["Bộ đề", "Phiên bản", "Câu", "Mức", "Lượt", "Tỉ lệ đúng"],
          [[DAY_NAMES.get(k[0], k[0]), k[1], k[2], LEVELS[k[2] - 1], len(v), f"{avg(v) * 100:.0f}%"]
           for k, v in hard if len(v) >= 5])


def export_csv(rows, path):
    cols = ["date", "set", "ver", "n", "uid", "guest", "score", "total", "pct", "secs", "at",
            "games_before", "placement_pct"] + [f"ok{i}" for i in range(1, 11)] + [f"ans{i}" for i in range(1, 11)] + [f"t{i}" for i in range(1, 11)]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            row = [r.get("date"), r.get("set"), r.get("ver", 1), r.get("n"), r.get("uid"), r.get("guest", 0),
                   r["score"], r["total"], round(r["pct"], 1), r.get("secs"), r.get("at"),
                   r["ctx"].get("games"), r["ctx"].get("pl")]
            for key in ("ok", "answers", "times"):
                vals = r[key]
                row += [vals[i] if i < len(vals) else "" for i in range(10)]
            w.writerow(row)
    print(f"Đã xuất {len(rows)} dòng ra {path}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    rows = load(sys.argv[1])
    if not rows:
        print("Không có lượt làm bài nào trong file.")
        return
    if "--csv" in sys.argv:
        export_csv(rows, sys.argv[sys.argv.index("--csv") + 1])
    else:
        report(rows)


if __name__ == "__main__":
    main()
