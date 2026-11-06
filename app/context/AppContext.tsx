"use client";

import React, { createContext, useCallback, useContext, useState, ReactNode } from "react";
import type { Quiz } from "../lib/quiz";
import type { AiMode, PageRange, StudyData } from "../lib/study";

interface LessonAttachment {
  id: string;
  name: string;
  type: "video" | "document" | "quiz";
  size?: string;
  url?: string;
}

interface Lesson {
  id: string;
  name: string;
  hasVideo: boolean;
  hasPdf: boolean;
  hasQuiz: boolean;
  videoTitle?: string;
  videoUrl?: string;
  documents?: LessonAttachment[];
}

interface Unit {
  id: string;
  /** رقم الفصل في الكتاب — غير موجود لبطاقة "الكتاب كاملاً" */
  chapter?: number;
  title: string;
  description: string;
  icon: string;
  pageCount: number;
  pdfUrl: string;
  lessons?: Lesson[];
}

type Point = { x: number; y: number };

type AskFn = (text: string, opts?: { mode?: AiMode; pages?: PageRange }) => void;

/** اختبار مفتوح في لوحة الـ Canvas */
interface QuizSession {
  id: string;
  quiz: Quiz;
  unitId: string | null;
  unitTitle: string;
  origin: Point | null;
  /** يرسل رسالة للمحادثة التي أنشأت الاختبار */
  ask: AskFn;
}

/** خريطة ذهنية أو بطاقات مفتوحة في لوحة الـ Canvas (تشغل نفس مكان الاختبار) */
interface StudySession {
  id: string;
  study: StudyData;
  unitTitle: string;
  origin: Point | null;
}

/** صفحة مفتوحة في عارض الكتاب الجانبي */
interface PageView {
  /** رقم الصفحة في الكتاب كاملاً */
  page: number;
  /** نصوص يُبحث عنها في الصفحة لتظليلها (الإجابة، الشرح…) */
  highlight: string[];
  /** مفتاح فريد حتى يعاد الفتح حتى لو نفس الصفحة */
  key: number;
}

/** طلب من عارض الكتاب ليزيد (اشرح/اختبرني/لخّص الجزء المحدد) */
interface PendingAsk {
  text: string;
  mode: AiMode;
  pages?: PageRange;
  /** وحدة الفصل الذي فيه النص (null = كل الكتاب) */
  unitId: string | null;
  key: number;
}

/** نوافذ مساحة العمل — تُرتَّب جنباً إلى جنب، أو فوق بعض حسب آخر نافذة استُخدمت */
type PanelId = "chat" | "quiz" | "book";

interface QuizResult {
  correct: number;
  total: number;
}

interface AppContextType {
  selectedUnit: Unit | null;
  setSelectedUnit: (unit: Unit | null) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  units: Unit[];
  updateUnit: (unit: Unit) => void;
  addUnit: (unit: Unit) => void;
  // نافذة يزيد الخاصة بالوحدة
  unitChatUnit: Unit | null;
  /** origin: النقطة التي تخرج منها النافذة (البطاقة/الزر) */
  setUnitChatUnit: (unit: Unit | null, origin?: Point) => void;
  unitChatOrigin: Point | null;
  // لوحة الاختبار (Canvas)
  activeQuiz: QuizSession | null;
  openQuiz: (session: QuizSession) => void;
  activeStudy: StudySession | null;
  openStudy: (session: StudySession) => void;
  closeStudy: () => void;
  closeQuiz: () => void;
  quizResults: Record<string, QuizResult>;
  setQuizResult: (id: string, result: QuizResult) => void;
  // عارض صفحات الكتاب
  pageView: PageView | null;
  openPage: (page: number, highlight?: string[]) => void;
  closePage: () => void;
  // إرسال سؤال ليزيد من خارج المحادثة
  pendingAsk: PendingAsk | null;
  askYazid: (text: string, mode: AiMode, unitId: string | null, pages?: PageRange) => void;
  clearPendingAsk: () => void;
  // ترتيب النوافذ: الأحدث استخداماً في الأعلى
  panelWidth: Partial<Record<PanelId, number>>;
  setPanelWidth: (id: PanelId, w: number | null) => void;
  libraryOpen: boolean;
  setLibraryOpen: (v: boolean) => void;
  studyFocus: boolean;
  setStudyFocus: (v: boolean) => void;
  front: PanelId;
  bringToFront: (id: PanelId) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const bookUnits: Unit[] = [
  {
    id: "1",
    title: "الكتاب كاملاً",
    description: "كل فصول أحياء ١ في ملف واحد. اسأل يزيد عن أي موضوع في الكتاب.",
    icon: "BookOpenText",
    pageCount: 277,
    pdfUrl: "/units/unit1.pdf",
  },
  {
    id: "2",
    chapter: 1,
    title: "مدخل إلى علم الأحياء",
    description: "خصائص الحياة، وطبيعة العلم، والطرائق العلمية التي يستخدمها علماء الأحياء.",
    icon: "Microscope",
    pageCount: 26,
    pdfUrl: "/units/unit2.pdf",
  },
  {
    id: "3",
    chapter: 2,
    title: "تصنيف المخلوقات الحية",
    description: "تاريخ التصنيف، ونظام التصنيف الحديث بممالكه الست.",
    icon: "Network",
    pageCount: 24,
    pdfUrl: "/units/unit3.pdf",
  },
  {
    id: "4",
    chapter: 3,
    title: "البكتيريا والفيروسات",
    description: "الفيروسات والبريونات والبكتيريا: تراكيبها وكيف تهاجم الخلايا.",
    icon: "Biohazard",
    pageCount: 28,
    pdfUrl: "/units/unit4.pdf",
  },
  {
    id: "5",
    chapter: 4,
    title: "الطلائعيات",
    description: "مخلوقات حقيقية النوى وحيدة الخلية أو متعددة الخلايا، وطرائق تغذيها وتكاثرها.",
    icon: "Droplets",
    pageCount: 32,
    pdfUrl: "/units/unit5.pdf",
  },
  {
    id: "6",
    chapter: 5,
    title: "الفطريات",
    description: "خصائص الفطريات، وشعبها الأربع، وطرائق تغذيها وتكاثرها.",
    icon: "Sprout",
    pageCount: 26,
    pdfUrl: "/units/unit6.pdf",
  },
  {
    id: "7",
    chapter: 6,
    title: "مدخل إلى الحيوانات",
    description: "خصائص الحيوانات، ومستويات بناء أجسامها، وتصنيفها.",
    icon: "PawPrint",
    pageCount: 34,
    pdfUrl: "/units/unit7.pdf",
  },
  {
    id: "8",
    chapter: 7,
    title: "الديدان والرخويات",
    description: "الديدان المفلطحة والأسطوانية والرخويات، وتكيفاتها للعيش في بيئات مختلفة.",
    icon: "Snail",
    pageCount: 34,
    pdfUrl: "/units/unit8.pdf",
  },
  {
    id: "9",
    chapter: 8,
    title: "المفصليات",
    description: "خصائص المفصليات وتنوعها، والحشرات وتكيفاتها.",
    icon: "Bug",
    pageCount: 31,
    pdfUrl: "/units/unit9.pdf",
  },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [units, setUnits] = useState<Unit[]>(bookUnits);
  const [unitChatUnit, setUnitChatUnitState] = useState<Unit | null>(null);
  const [unitChatOrigin, setUnitChatOrigin] = useState<Point | null>(null);
  const [front, setFront] = useState<PanelId>("chat");
  const [studyFocus, setStudyFocus] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [panelWidth, setPanelWidthState] = useState<Partial<Record<PanelId, number>>>({});
  const setPanelWidth = useCallback((id: PanelId, w: number | null) => {
    setPanelWidthState((prev) => {
      const next = { ...prev };
      if (w == null) delete next[id];
      else next[id] = Math.round(w);
      return next;
    });
  }, []);
  const [activeQuiz, setActiveQuiz] = useState<QuizSession | null>(null);
  const [quizResults, setQuizResults] = useState<Record<string, QuizResult>>({});

  const [pageView, setPageView] = useState<PageView | null>(null);
  const openPage = useCallback(
    (page: number, highlight: string[] = []) => {
      setPageView({ page, highlight, key: Date.now() });
      setFront("book");
    },
    []
  );
  const closePage = useCallback(() => setPageView(null), []);
  const [pendingAsk, setPendingAsk] = useState<PendingAsk | null>(null);
  const askYazid = useCallback(
    (text: string, mode: AiMode, unitId: string | null, pages?: PageRange) => {
      setPendingAsk({ text, mode, unitId, pages, key: Date.now() });
      setFront("chat");
    },
    []
  );
  const clearPendingAsk = useCallback(() => setPendingAsk(null), []);
  const bringToFront = useCallback((id: PanelId) => setFront(id), []);
  const [activeStudy, setActiveStudy] = useState<StudySession | null>(null);
  const openQuiz = useCallback((session: QuizSession) => {
    setActiveStudy(null);
    setActiveQuiz(session);
    setFront("quiz");
  }, []);
  const openStudy = useCallback((session: StudySession) => {
    setActiveQuiz(null);
    setActiveStudy(session);
    setFront("quiz");
  }, []);
  const closeStudy = useCallback(() => {
    setActiveStudy(null);
    setStudyFocus(false);
  }, []);
  const closeQuiz = useCallback(() => {
    setActiveQuiz(null);
    setStudyFocus(false);
  }, []);
  const setQuizResult = useCallback(
    (id: string, result: QuizResult) => setQuizResults((prev) => ({ ...prev, [id]: result })),
    []
  );

  const setUnitChatUnit = useCallback((unit: Unit | null, origin?: Point) => {
    if (unit) {
      setUnitChatOrigin(origin ?? null);
      setFront("chat");
    }
    setUnitChatUnitState(unit);
  }, []);
  const openChat = useCallback((open: boolean) => {
    setIsChatOpen(open);
    if (open) setFront("chat");
  }, []);

  const updateUnit = (updated: Unit) => {
    setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setSelectedUnit(updated);
  };

  const addUnit = (newUnit: Unit) => {
    setUnits((prev) => [...prev, newUnit]);
  };

  return (
    <AppContext.Provider
      value={{
        selectedUnit,
        setSelectedUnit,
        isChatOpen,
        setIsChatOpen: openChat,
        searchQuery,
        setSearchQuery,
        units,
        updateUnit,
        addUnit,
        unitChatUnit,
        setUnitChatUnit,
        unitChatOrigin,
        activeQuiz,
        openQuiz,
        activeStudy,
        openStudy,
        closeStudy,
        closeQuiz,
        quizResults,
        setQuizResult,
        pageView,
        openPage,
        closePage,
        pendingAsk,
        askYazid,
        clearPendingAsk,
        front,
        panelWidth,
        setPanelWidth,
        studyFocus,
        setStudyFocus,
        libraryOpen,
        setLibraryOpen,
        bringToFront,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}

export type { Unit, Lesson, LessonAttachment, Point, QuizSession, StudySession, QuizResult, AskFn, PageView, PanelId };
