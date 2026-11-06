/** أنواع الاختبار + تحليله والتحقق منه (مشترك بين الخادم والواجهة). */

export interface QuizQuestion {
  q: string;
  options: string[];
  /** رقم الخيار الصحيح بدءاً من 0 */
  answer: number;
  explanation: string;
  /** رقم الصفحة في الكتاب كاملاً */
  page: number | null;
}

export interface Quiz {
  title: string;
  intro: string;
  questions: QuizQuestion[];
}

/** هل رسالة الطالب طلب اختبار؟ */
export function isQuizRequest(text: string): boolean {
  const t = text.replace(/[ًٌٍَُِّْـ]/g, "");
  if (/(اختبرني|اختبرنا|امتحني|امتحنا|كويز|quiz|اسألني|اسالني|سؤلني|سولف علي اسئلة)/i.test(t)) return true;
  if (/(اختبار|امتحان)/.test(t) && /(سو|سوي|اعمل|جهز|ابي|ابغى|ابغا|أبغى|اعطني|عطني|أعطني|اريد|أريد|ولد|اختبار قصير|اختبار سريع)/.test(t))
    return true;
  return /(اسئلة|أسئلة|سؤالين|سؤال)/.test(t) && /(اعطني|عطني|أعطني|ابي|ابغى|ابغا|أبغى|جهز|سو|سوي|اريد|أريد|حل)/.test(t);
}

/** يستخرج JSON من رد النموذج ويتحقق منه، ويخلط ترتيب الخيارات. يرجع null إذا كان غير صالح. */
export function parseQuiz(raw: string): Quiz | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const d = data as Partial<Quiz> & { questions?: unknown[] };
  if (!Array.isArray(d.questions)) return null;

  const questions: QuizQuestion[] = [];
  for (const item of d.questions.slice(0, 10)) {
    const x = item as Partial<QuizQuestion>;
    if (typeof x.q !== "string" || !Array.isArray(x.options)) continue;
    const options = x.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim());
    const answer = Number(x.answer);
    if (options.length < 2 || options.length > 4 || !Number.isInteger(answer) || answer < 0 || answer >= options.length)
      continue;
    const isTrueFalse = options.length === 2;
    // خلط الخيارات حتى لا تكون الإجابة الصحيحة دائماً في نفس المكان (عدا صح/خطأ)
    const order = options.map((_, i) => i);
    if (!isTrueFalse) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    const page = Number(x.page);
    questions.push({
      q: x.q.trim(),
      options: order.map((i) => options[i]),
      answer: order.indexOf(answer),
      explanation: typeof x.explanation === "string" ? x.explanation.trim() : "",
      page: Number.isInteger(page) && page > 0 && page <= 277 ? page : null,
    });
  }
  if (!questions.length) return null;
  return {
    title: typeof d.title === "string" && d.title.trim() ? d.title.trim() : "اختبار قصير",
    intro: typeof d.intro === "string" && d.intro.trim() ? d.intro.trim() : `جهّزت لك ${questions.length} أسئلة.`,
    questions,
  };
}
