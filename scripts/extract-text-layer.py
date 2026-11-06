"""
استخراج نص كتاب الأحياء من طبقة النص في ملف PDF الأصلي (بدون ذكاء اصطناعي ومجاناً).

الاستخدام:
    pip install pypdf
    python scripts/extract-text-layer.py "مسار/الكتاب الأصلي.pdf"
    node scripts/extract-units.mjs --index

ملاحظة: استخدم ملف الكتاب الأصلي (غير المضغوط) لأن طبقة النص فيه أدق.
يكتب units/pages/unitN/page-NNN.md لكل وحدة حسب units/page-offsets.json.
"""
import json, re, sys, unicodedata
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
# الوحدة: (أول صفحة، آخر صفحة) في الكتاب الكامل — unit1 هو الكتاب كاملاً
RANGES = {1: (1, 277), 2: (10, 35), 3: (36, 59), 4: (60, 87), 5: (88, 119),
          6: (120, 145), 7: (146, 179), 8: (180, 213), 9: (214, 244)}


def clean(text: str) -> str:
    t = unicodedata.normalize("NFKC", text)          # أشكال العرض العربية → حروف عادية
    t = t.replace("\u0640", "")                     # التطويل ـ
    t = re.sub(r"[ \t]+", " ", t)
    lines = []
    for line in t.splitlines():
        words = []
        for w in line.split(" "):
            if not w or "\ufffd" in w:               # كلمات عناوين الخط الزخرفي المكسورة
                continue
            w = re.sub(r"^(\S{3,})\1$", r"\1", w)    # «تجربةتجربة» → «تجربة»
            w = w.replace("أأ", "أ").replace("إإ", "إ")
            w = re.sub(r"^ا([أإ])", r"\1", w)        # «اإلى» → «إلى»
            words.append(w)
        s = " ".join(words).strip()
        if len(s) >= 2 and not re.fullmatch(r"[\d\s.\-–]+", s):
            lines.append(s)
    return "\n".join(lines).strip()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    reader = PdfReader(sys.argv[1])
    cache = {}
    for unit, (a, b) in RANGES.items():
        out = ROOT / "units" / "pages" / f"unit{unit}"
        out.mkdir(parents=True, exist_ok=True)
        for i, p in enumerate(range(a, b + 1), start=1):
            if p not in cache:
                cache[p] = clean(reader.pages[p - 1].extract_text() or "")
            text = cache[p] or "(صفحة بدون نص)"
            (out / f"page-{i:03d}.md").write_text(text + "\n", encoding="utf-8")
        print(f"unit{unit}: {b - a + 1} صفحة")


if __name__ == "__main__":
    main()
