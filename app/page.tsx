"use client";

import React from "react";
import { AppProvider } from "./context/AppContext";
import Navbar from "./components/Navbar";
import HeroSearch from "./components/HeroSearch";
import CurriculumGrid from "./components/CurriculumGrid";
import AIChatWidget from "./components/AIChatWidget";
import UnitAIChatModal from "./components/UnitAIChatModal";
import QuizCanvas from "./components/QuizCanvas";
import StudyCanvas from "./components/StudyCanvas";
import BookViewer from "./components/BookViewer";
import LibraryDialog from "./components/LibraryDialog";

export default function Home() {
  return (
    <AppProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <HeroSearch />
          <CurriculumGrid />
        </main>



        {/* Overlays */}
        <AIChatWidget />
        <UnitAIChatModal />
        <QuizCanvas />
        <StudyCanvas />
        <BookViewer />
        <LibraryDialog />
      </div>
    </AppProvider>
  );
}
