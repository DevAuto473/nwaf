"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

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
  title: string;
  description: string;
  icon: string;
  lessonCount: number;
  fileCount: number;
  lessons: Lesson[];
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
  // Long-press unit AI chat
  unitChatUnit: Unit | null;
  setUnitChatUnit: (unit: Unit | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mockUnits: Unit[] = [
  {
    id: "1",
    title: "الوحدة الأولى",
    description: "محتوى الوحدة الأولى وملفها الخاص",
    icon: "Calculator",
    lessonCount: 4,
    fileCount: 1,
    lessons: [
      { id: "1a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d1", name: "ملف الوحدة", type: "document", url: "/units/unit1.pdf" }] },
    ],
  },
  {
    id: "2",
    title: "الوحدة الثانية",
    description: "محتوى الوحدة الثانية وملفها الخاص",
    icon: "Shapes",
    lessonCount: 4,
    fileCount: 1,
    lessons: [
      { id: "2a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d2", name: "ملف الوحدة", type: "document", url: "/units/unit2.pdf" }] },
    ],
  },
  {
    id: "3",
    title: "الوحدة الثالثة",
    description: "محتوى الوحدة الثالثة وملفها الخاص",
    icon: "Atom",
    lessonCount: 4,
    fileCount: 1,
    lessons: [
      { id: "3a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d3", name: "ملف الوحدة", type: "document", url: "/units/unit3.pdf" }] },
    ],
  },
  {
    id: "4",
    title: "الوحدة الرابعة",
    description: "محتوى الوحدة الرابعة وملفها الخاص",
    icon: "FlaskConical",
    lessonCount: 4,
    fileCount: 1,
    lessons: [
      { id: "4a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d4", name: "ملف الوحدة", type: "document", url: "/units/unit4.pdf" }] },
    ],
  },
  {
    id: "5",
    title: "الوحدة الخامسة",
    description: "محتوى الوحدة الخامسة وملفها الخاص",
    icon: "Microscope",
    lessonCount: 4,
    fileCount: 1,
    lessons: [
      { id: "5a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d5", name: "ملف الوحدة", type: "document", url: "/units/unit5.pdf" }] },
    ],
  },
  {
    id: "6",
    title: "الوحدة السادسة",
    description: "محتوى الوحدة السادسة وملفها الخاص",
    icon: "Code",
    lessonCount: 4,
    fileCount: 1,
    lessons: [
      { id: "6a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: false, documents: [{ id: "d6", name: "ملف الوحدة", type: "document", url: "/units/unit6.pdf" }] },
    ],
  },
  {
    id: "7",
    title: "الوحدة السابعة",
    description: "محتوى الوحدة السابعة وملفها الخاص",
    icon: "Telescope",
    lessonCount: 3,
    fileCount: 1,
    lessons: [
      { id: "7a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d7", name: "ملف الوحدة", type: "document", url: "/units/unit7.pdf" }] },
    ],
  },
  {
    id: "8",
    title: "الوحدة الثامنة",
    description: "محتوى الوحدة الثامنة وملفها الخاص",
    icon: "Dna",
    lessonCount: 3,
    fileCount: 1,
    lessons: [
      { id: "8a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d8", name: "ملف الوحدة", type: "document", url: "/units/unit8.pdf" }] },
    ],
  },
  {
    id: "9",
    title: "الوحدة التاسعة",
    description: "محتوى الوحدة التاسعة وملفها الخاص",
    icon: "Brain",
    lessonCount: 3,
    fileCount: 1,
    lessons: [
      { id: "9a", name: "الدرس الأول", hasVideo: true, hasPdf: true, hasQuiz: true, documents: [{ id: "d9", name: "ملف الوحدة", type: "document", url: "/units/unit9.pdf" }] },
    ],
  },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [units, setUnits] = useState<Unit[]>(mockUnits);
  const [unitChatUnit, setUnitChatUnit] = useState<Unit | null>(null);

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
        setIsChatOpen,
        searchQuery,
        setSearchQuery,
        units,
        updateUnit,
        addUnit,
        unitChatUnit,
        setUnitChatUnit,
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

export type { Unit, Lesson, LessonAttachment };
