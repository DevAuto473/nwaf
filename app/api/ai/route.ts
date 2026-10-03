import { NextRequest, NextResponse } from "next/server";
import { getUnitText, hasUnit, search, type Chunk } from "../../lib/bookSearch";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Fallback chain — tried in order until one succeeds
const MODELS = [
  "anthropic/claude-haiku-4.5",              // 💰 سريع ورخيص
  "anthropic/claude-sonnet-latest",           // 💰 أذكى — احتياط
  "google/gemma-4-31b-it:free",              // 🆓 مجاني — احتياط
  "nvidia/nemotron-3.5-lightning:free",       // 🆓 مجاني — احتياط أخير
];

// الوحدة كاملة في السياق إذا كانت أصغر من هذا (أدق إجابة، ومع الكاش رخيصة).
// أكبر من ذلك → بحث BM25 وإرسال أفضل المقاطع فقط.
const FULL_UNIT_MAX_CHARS = 150_000;

const PERSONA_INSTRUCTIONS = `أنت الذكاء الاصطناعي "يزيد"، مساعد شخصي تعليمي يجاوب على أسئلة الطلاب حصرياً من نص الكتاب المرفق في <book>.
تحدث بلغة بيضاء (سعودية مبسطة ومحترمة)، بطابع رسمي قليلاً ولكن بسيط وواضح، بدون استخدام كلمات عامية مبالغ فيها أو ميانة زائدة (مثل خوي، ربع، الخ).

القواعد:
1. أجب بوضوح واختصار، وخلك إيجابي وداعم.
2. اعتمد فقط على ما في <book>. لا تضف معلومات من خارجه ولا تخمّن.
3. انقل التعريفات والمصطلحات كما وردت في الكتاب، وتقدر تبسطها بأسلوبك.
4. اذكر رقم الصفحة بعد المعلومة بهذا الشكل: (ص 12). إذا ما كان متوفر، لا تذكره.
5. إذا لم تجد الإجابة في <book> قل بصراحة وبأسلوب محترم: "لم أجد هذه المعلومة في محتوى الوحدة" واقترح موضوعاً قريباً إن وجد.
6. لا تجاوب على أسئلة مالها علاقة بالمادة.
7. النص مستخرج آلياً وفيه بعض الأخطاء: صححها بفهمك للسياق ولا تنقل الرموز الغريبة.
8. اكتب نص عادي بدون رموز Markdown (لا ** ولا #) وبدون أي إيموجي (emojis). استخدم "-" للنقاط والأرقام للخطوات.`;

function formatChunks(chunks: Chunk[], multiUnit: boolean): string {
  return chunks
    .map((c) => {
      const where = [
        multiUnit ? `الوحدة ${c.unit}` : "",
        c.page != null ? `صفحة ${c.page}` : "",
        c.heading,
      ]
        .filter(Boolean)
        .join(" — ");
      return `[${where}]\n${c.text}`;
    })
    .join("\n\n---\n\n");
}

type HistoryMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "لم يتم تعيين مفتاح OPENROUTER_API_KEY في ملف .env.local" },
      { status: 500 }
    );
  }

  let body: { unit_id?: string; message?: string; history?: HistoryMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "خطأ في تنسيق الطلب" }, { status: 400 });
  }

  const message = body.message?.trim();
  const history = (body.history ?? []).slice(-12);
  if (!message) {
    return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });
  }

  // بدون unit_id (المساعد العام) → البحث في الكتاب كله
  const unit = body.unit_id ? Number(body.unit_id) : null;

  if (unit != null && !(await hasUnit(unit))) {
    return NextResponse.json(
      {
        error: `محتوى الوحدة ${unit} غير مُفهرس بعد. شغّل: node scripts/extract-units.mjs ${unit}`,
      },
      { status: 404 }
    );
  }

  // ── جمع نص الكتاب ──
  let bookText = "";
  let mode: "full" | "search" = "search";
  let sources: { unit: number; page: number | null }[] = [];

  if (unit != null) {
    const full = await getUnitText(unit);
    if (full.length <= FULL_UNIT_MAX_CHARS) {
      bookText = full;
      mode = "full";
    }
  }

  if (mode === "search") {
    // أسئلة المتابعة ("اشرح أكثر") تحتاج سياق السؤال السابق
    const prevUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    const query = message.length < 25 ? `${message} ${prevUser}` : message;
    const chunks = await search(query, unit, 12);
    if (!chunks.length) {
      return NextResponse.json({
        reply: "لم أجد هذا في الكتاب. جرّب صياغة السؤال بكلمات من الدرس.",
        sources: [],
      });
    }
    bookText = formatChunks(chunks, unit == null);
    sources = chunks.map((c) => ({ unit: c.unit, page: c.page }));
  }

  // ── رسالة النظام (مع كاش Anthropic لنص الوحدة الثابت) ──
  const scopeLine =
    unit != null ? `أنت مخصص للوحدة ${unit} فقط.` : "يمكنك الإجابة من أي وحدة في الكتاب واذكر رقم الوحدة.";

  const systemContent = [
    { type: "text", text: `${PERSONA_INSTRUCTIONS}\n${scopeLine}` },
    {
      type: "text",
      text: `<book>\n${bookText}\n</book>`,
      ...(mode === "full" ? { cache_control: { type: "ephemeral" } } : {}),
    },
  ];

  const messages = [
    { role: "system", content: systemContent },
    ...history,
    { role: "user", content: message },
  ];

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": "https://nwaf.app",
    "X-Title": "Nwaf Educational Platform",
  };

  let lastError = "";
  for (const model of MODELS) {
    try {
      // النماذج غير Anthropic: أرسل النظام كنص عادي
      const msgs = model.startsWith("anthropic/")
        ? messages
        : [
            { role: "system", content: systemContent.map((p) => p.text).join("\n\n") },
            ...messages.slice(1),
          ];

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, messages: msgs, temperature: 0.2, max_tokens: 1200 }),
      });
      const data = await response.json();

      const providerErr = (data as { error?: { message?: string } })?.error?.message ?? "";
      if (!response.ok || providerErr) {
        console.warn(`[AI] ${model} failed: ${providerErr || response.statusText}`);
        lastError = providerErr || response.statusText;
        continue;
      }

      const text: string = data?.choices?.[0]?.message?.content ?? "لا توجد استجابة.";
      console.log(`[AI] ${model} | unit ${unit ?? "all"} | mode ${mode} | ${bookText.length} chars`);
      return NextResponse.json({ reply: text, model, mode, sources });
    } catch (err) {
      console.warn(`[AI] ${model} threw:`, err);
      lastError = String(err);
    }
  }

  return NextResponse.json(
    { error: `فشلت جميع النماذج المتاحة. آخر خطأ: ${lastError}` },
    { status: 503 }
  );
}
