import { NextRequest, NextResponse } from "next/server";
import { getPagesText, getUnitText, hasUnit, sampleChunks, search, type Chunk } from "../../lib/bookSearch";
import { parseQuiz } from "../../lib/quiz";
import { normalizeRange, parseFlashcards, parseMindmap, type AiMode } from "../../lib/study";

// الاختبارات والخرائط قد تستغرق 15–25 ثانية — بدون هذا يقطعها Vercel عند 10 ثوانٍ
export const maxDuration = 60;

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

const QUIZ_INSTRUCTIONS = `أنت "يزيد"، مساعد تعليمي. أنشئ اختباراً قصيراً للطالب من نص الكتاب في <book> فقط.
أعد كائن JSON صالحاً فقط، بدون أي نص قبله أو بعده وبدون علامات \`\`\`، بهذا الشكل بالضبط:
{"title":"اختبار: ...","intro":"جملة قصيرة ودودة للطالب","questions":[{"q":"نص السؤال","options":["...","...","...","..."],"answer":0,"explanation":"...","page":12}]}

القواعد:
1. عدد الأسئلة كما طلب الطالب، وإن لم يحدد فخمسة. الحد الأقصى عشرة.
2. كل سؤال اختيار من متعدد بأربعة خيارات. إذا طلب الطالب صح وخطأ فاجعل الخيارات ["صح","خطأ"].
3. answer رقم الخيار الصحيح بدءاً من 0. خيار صحيح واحد فقط، والخيارات الخاطئة معقولة ومن نفس الموضوع وبطول مقارب.
4. explanation جملة أو جملتان من الكتاب توضح سبب صحة الإجابة.
5. page رقم الصفحة من أقرب وسم [صفحة N] للمعلومة، أو null إذا لم يتوفر.
6. إذا ذكر الطالب موضوعاً محدداً فاجعل كل الأسئلة عنه. نوّع بين التعريفات والمقارنات والأمثلة والتطبيق.
7. لا تسأل عن معلومة غير موجودة في <book>.
8. عربية فصحى مبسطة، بدون Markdown وبدون إيموجي. انتبه لصحة JSON (علامات التنصيص والفواصل).`;

const MINDMAP_INSTRUCTIONS = `أنت "يزيد"، مساعد تعليمي. أنشئ خريطة ذهنية للطالب من نص الكتاب في <book> فقط.
أعد كائن JSON صالحاً فقط، بدون أي نص قبله أو بعده وبدون علامات \`\`\`، بهذا الشكل بالضبط:
{"title":"خريطة ذهنية: ...","intro":"جملة قصيرة ودودة","root":{"label":"الموضوع الرئيسي","children":[{"label":"فرع","note":"جملة توضح الفرع من الكتاب","page":12,"children":[{"label":"فكرة","note":"...","page":12}]}]}}

القواعد:
1. الجذر هو الموضوع العام للنص. من 4 إلى 7 فروع رئيسية، ولكل فرع من 2 إلى 5 أفكار فرعية. العمق الأقصى مستويان تحت الجذر (وثالث عند الحاجة فقط).
2. label عبارة قصيرة جداً (حتى 5 كلمات) بالمصطلح العلمي كما ورد في الكتاب. note جملة واحدة موجزة من الكتاب.
3. page رقم الصفحة من أقرب وسم [صفحة N] أو null.
4. غطِّ أهم ما في النص ولا تكرر الأفكار. لا تضف معلومة غير موجودة في <book>.
5. إذا ذكر الطالب موضوعاً محدداً فاجعل الخريطة عنه.
6. عربية فصحى مبسطة، بدون Markdown وبدون إيموجي. انتبه لصحة JSON.`;

const CARDS_INSTRUCTIONS = `أنت "يزيد"، مساعد تعليمي. أنشئ بطاقات مراجعة (flashcards) للطالب من نص الكتاب في <book> فقط.
أعد كائن JSON صالحاً فقط، بدون أي نص قبله أو بعده وبدون علامات \`\`\`، بهذا الشكل بالضبط:
{"title":"بطاقات: ...","intro":"جملة قصيرة ودودة","cards":[{"front":"سؤال أو مصطلح","back":"الإجابة أو التعريف","page":12}]}

القواعد:
1. عدد البطاقات كما طلب الطالب، وإن لم يحدد فعشر بطاقات. الحد الأقصى عشرون.
2. الوجه الأمامي front قصير: مصطلح أو سؤال مباشر. الخلفي back إجابة موجزة (جملة إلى ثلاث) بصياغة الكتاب.
3. نوّع بين التعريفات والمقارنات والوظائف والأمثلة. بطاقة واحدة لكل فكرة، بدون تكرار.
4. page رقم الصفحة من أقرب وسم [صفحة N] أو null.
5. لا تضف معلومة غير موجودة في <book>. عربية فصحى مبسطة، بدون Markdown وبدون إيموجي. انتبه لصحة JSON.`;

// كلمات طلب الاختبار لا تفيد البحث (تُحذف ككلمات كاملة فقط)
const QUIZ_WORDS = new Set(
  "خريطة ذهنية الذهنية خريطه بطاقات بطاقة تعليمية فلاش كارد flashcards جهز لي صفحة صفحات من الى إلى ص اختبرني اختبرنا اختبار اختبارا امتحني امتحان كويز quiz اسألني اسالني أسئلة اسئلة سؤالين سؤال خمسة خمس ثلاثة ثلاث اربعة أربعة عشرة عشر صح خطأ وخطأ اعطني عطني أعطني ابي ابغى ابغا أبغى جهز سوي سو في عن من على لي قصير سريع مرة ثانية بأسئلة مختلفة".split(" ")
);

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

  let body: { unit_id?: string; message?: string; history?: HistoryMsg[]; mode?: AiMode; pages?: [number, number] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "خطأ في تنسيق الطلب" }, { status: 400 });
  }

  const message = body.message?.trim();
  const isQuiz = body.mode === "quiz";
  const genMode: AiMode = body.mode ?? "chat";
  const isGen = genMode !== "chat"; // اختبار أو خريطة أو بطاقات
  const range = Array.isArray(body.pages) ? normalizeRange(Number(body.pages[0]), Number(body.pages[1])) : null;
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

  if (range) {
    // صفحات محددة من الكتاب كاملاً → هذا هو السياق الوحيد
    bookText = (await getPagesText(range[0], range[1])).slice(0, 90_000);
    if (!bookText) {
      return NextResponse.json({ error: "ما لقيت نصاً في الصفحات المحددة." }, { status: 404 });
    }
    mode = "full";
  } else if (unit != null) {
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
    let chunks: Chunk[];
    if (isGen) {
      // اختبار/خريطة/بطاقات: ابحث بالموضوع فقط، وإن لم يوجد موضوع خذ عينة موزعة على الوحدة/الكتاب
      const topic = message
        .split(/\s+/)
        .filter((w) => !QUIZ_WORDS.has(w) && !QUIZ_WORDS.has(w.replace(/^[وب]/, "")) && !/^\d+$/.test(w))
        .join(" ")
        .trim();
      chunks = topic.length >= 3 ? await search(topic, unit, 12) : [];
      if (chunks.length < 4) chunks = await sampleChunks(unit, 14);
    } else {
      chunks = await search(query, unit, 12);
    }
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
  const scopeLine = range
    ? `النص المرفق من صفحات ${range[0]} إلى ${range[1]} من الكتاب، وهو المصدر الوحيد.`
    : unit != null ? `أنت مخصص للوحدة ${unit} فقط.` : "يمكنك الإجابة من أي وحدة في الكتاب واذكر رقم الوحدة.";

  const systemContent = [
    { type: "text", text: `${genMode === "quiz" ? QUIZ_INSTRUCTIONS : genMode === "mindmap" ? MINDMAP_INSTRUCTIONS : genMode === "flashcards" ? CARDS_INSTRUCTIONS : PERSONA_INSTRUCTIONS}\n${scopeLine}` },
    {
      type: "text",
      text: `<book>\n${bookText}\n</book>`,
      ...(mode === "full" ? { cache_control: { type: "ephemeral" } } : {}),
    },
  ];

  const messages = [
    { role: "system", content: systemContent },
    ...(isGen ? history.slice(-4) : history),
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
        body: JSON.stringify({
          model,
          messages: msgs,
          temperature: isGen ? 0.5 : 0.2,
          max_tokens: isGen ? 4000 : 1200,
        }),
      });
      const data = await response.json();

      const providerErr = (data as { error?: { message?: string } })?.error?.message ?? "";
      if (!response.ok || providerErr) {
        console.warn(`[AI] ${model} failed: ${providerErr || response.statusText}`);
        lastError = providerErr || response.statusText;
        continue;
      }

      const text: string = data?.choices?.[0]?.message?.content ?? "لا توجد استجابة.";

      if (isQuiz) {
        const quiz = parseQuiz(text);
        if (!quiz) {
          // JSON غير صالح → جرّب النموذج التالي
          console.warn(`[AI] ${model} returned invalid quiz JSON`);
          lastError = "تعذّر تجهيز الاختبار";
          continue;
        }
        console.log(`[AI] ${model} | quiz ${quiz.questions.length}q | unit ${unit ?? "all"}`);
        return NextResponse.json({ reply: quiz.intro, quiz, model, mode, sources });
      }
      if (genMode === "mindmap" || genMode === "flashcards") {
        const mm = genMode === "mindmap" ? parseMindmap(text) : null;
        const fc = genMode === "flashcards" ? parseFlashcards(text) : null;
        if (!mm && !fc) {
          console.warn(`[AI] ${model} returned invalid ${genMode} JSON`);
          lastError = "تعذّر تجهيز المحتوى";
          continue;
        }
        console.log(`[AI] ${model} | ${genMode} | pages ${range ? range.join("-") : "-"}`);
        return NextResponse.json({
          reply: (mm ?? fc)!.intro,
          study: mm ? { kind: "mindmap", data: mm } : { kind: "flashcards", data: fc },
          model,
          mode,
          sources,
        });
      }
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
