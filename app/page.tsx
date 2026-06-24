"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Flag, Clock, CheckCircle2, XCircle, RotateCcw,
  History, ChevronRight, ChevronLeft, Loader2, Download
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Types ---
type Question = {
  id: number;
  text: string;
  options: string[];
  correct_answer: number;
};

type QuizHistory = {
  date: string;
  score: number;
  total: number;
};

// --- Utils ---
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export default function QuizApp() {
  // --- Global State ---
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [quizState, setQuizState] = useState<'menu' | 'playing' | 'review'>('menu');

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // --- Session State ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [useTimer, setUseTimer] = useState(false);
  const [history, setHistory] = useState<QuizHistory[]>([]);

  // --- Add Question Form ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQText, setNewQText] = useState("");
  const [newQOptions, setNewQOptions] = useState(["", ""]);
  const [newQCorrect, setNewQCorrect] = useState(0);
  const [submitStatus, setSubmitStatus] = useState("");

  // --- Initial Load ---
  useEffect(() => {
    const storedHistory = localStorage.getItem('quizHistory');
    if (storedHistory) setHistory(JSON.parse(storedHistory));

    // Logic: Mobile = Closed by default, Desktop = Open by default
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, []);

  // --- PDF ---
  const handleDownloadPDF = async () => {
    setDownloading(true);
    const { data: allQuestions, error } = await supabase
      .from('questions')
      .select('*')
      .order('id', { ascending: true });

    if (error || !allQuestions) {
      alert("Error fetching questions: " + error?.message);
      setDownloading(false);
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Intelligent Quiz - Full Question Database", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Total Questions: ${allQuestions.length}`, 14, 33);

    const tableRows = allQuestions.map((q, index) => {
      const formattedOptions = q.options.map((opt: string, i: number) =>
        i === q.correct_answer ? `[x] ${opt} (CORRECT)` : `[ ] ${opt}`
      ).join('\n');
      return [index + 1, q.text, formattedOptions];
    });

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Question', 'Options & Answer']],
      body: tableRows,
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 80 }, 2: { cellWidth: 'auto' } },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save("Quiz_Database_Questions.pdf");
    setDownloading(false);
  };

  // --- START ---
  const startQuiz = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('questions').select('*');

    if (error || !data || data.length === 0) {
      alert("Error fetching questions or database empty.");
      setLoading(false);
      return;
    }

    const shuffled = data.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 40);

    setActiveQuestions(selected);
    setCurrentIndex(0);
    setUserAnswers({});
    setFlagged(new Set());
    setQuizState('playing');
    setTimeLeft(useTimer ? 30 * 60 : null);
    setLoading(false);

    if (window.innerWidth >= 768) setSidebarOpen(true);
    else setSidebarOpen(false);
  };

  // --- TIMER ---
  useEffect(() => {
    if (quizState !== 'playing' || timeLeft === null) return;
    if (timeLeft === 0) { finishQuiz(); return; }
    const timerId = setInterval(() => setTimeLeft(p => (p !== null ? p - 1 : null)), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, quizState]);

  // --- ADD Q ---
  const handleAddQuestion = async () => {
    if (!newQText || newQOptions.some(o => !o)) return;
    setSubmitStatus("Submitting...");
    const { error } = await supabase.from('questions').insert([{ text: newQText, options: newQOptions, correct_answer: newQCorrect }]);
    if (error) {
      setSubmitStatus("Error: " + error.message);
    } else {
      setSubmitStatus("Question Added!");
      setNewQText(""); setNewQOptions(["", ""]); setNewQCorrect(0);
      setTimeout(() => { setShowAddForm(false); setSubmitStatus(""); }, 1500);
    }
  };

  // --- FINISH ---
  const finishQuiz = () => {
    setQuizState('review');
    let correct = 0;
    activeQuestions.forEach(q => { if (userAnswers[q.id] === q.correct_answer) correct++; });
    const newEntry = { date: new Date().toLocaleDateString(), score: correct, total: activeQuestions.length };
    const updatedHistory = [newEntry, ...history].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('quizHistory', JSON.stringify(updatedHistory));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- VIEW: MENU ---
  if (quizState === 'menu') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Intelligent Quiz</h1>
          <p className="text-slate-500 mb-8">Community Driven Exam Prep</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-blue-600" /> Start New Quiz
                </h2>
                <div className="flex items-center gap-3 mb-6">
                  <input type="checkbox" id="timer" checked={useTimer} onChange={(e) => setUseTimer(e.target.checked)} className="w-5 h-5 rounded" />
                  <label htmlFor="timer" className="text-slate-700 cursor-pointer">Enable 30 min Timer</label>
                </div>
                <button onClick={startQuiz} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md flex justify-center items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : "Start Exam (40 Random)"}
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => setShowAddForm(!showAddForm)} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 rounded-lg font-medium">
                  + Contribute Question
                </button>
                <button onClick={handleDownloadPDF} disabled={downloading} className="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-medium flex items-center justify-center gap-2">
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download Full Database (PDF)
                </button>
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-700"><History className="w-5 h-5" /> Recent Results</h2>
              {history.length === 0 ? <p className="text-slate-400 italic text-sm">No history yet.</p> : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="flex justify-between text-sm bg-white p-2 rounded shadow-sm">
                      <span>{h.date}</span>
                      <span className={h.score / h.total >= 0.6 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>{h.score}/{h.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {showAddForm && (
            <div className="mt-8 pt-8 border-t animate-in fade-in">
              <h3 className="font-bold text-lg mb-4">Contribute to the Database</h3>
              <textarea placeholder="Question Text..." className="w-full p-3 border rounded mb-3" value={newQText} onChange={e => setNewQText(e.target.value)} />
              {newQOptions.map((opt, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="radio" name="correct" checked={newQCorrect === i} onChange={() => setNewQCorrect(i)} className="mt-3" />
                  <input className="flex-1 p-2 border rounded" placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const n = [...newQOptions]; n[i] = e.target.value; setNewQOptions(n); }} />
                </div>
              ))}
              <button onClick={() => setNewQOptions([...newQOptions, ""])} className="text-sm text-blue-600 mb-4">+ Option</button>
              <div className="flex justify-between items-center">
                <span className={cn("font-medium", submitStatus.startsWith("Error") ? "text-red-600" : "text-green-600")}>{submitStatus}</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                  <button onClick={handleAddQuestion} className="px-4 py-2 bg-green-600 text-white rounded">Submit</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VIEW: QUIZ & REVIEW ---
  const currentQ = activeQuestions[currentIndex];
  const isReview = quizState === 'review';

  return (
    // FIX 1: Change h-screen to min-h-screen for mobile so the whole page scrolls naturally. 
    // Only use h-screen on md (desktop) to get that app-like feel.
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen bg-slate-100 font-sans text-slate-800 overflow-visible md:overflow-hidden relative">

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          "bg-white border-r flex flex-col transition-transform duration-300 ease-in-out z-50",
          "fixed inset-y-0 left-0 w-72 shadow-2xl md:shadow-none h-full",
          "md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:overflow-hidden"
        )}
      >
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-700">Questions</h2>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-5 gap-2">
            {activeQuestions.map((q, idx) => {
              const status = isReview
                ? (userAnswers[q.id] === q.correct_answer ? 'correct' : 'wrong')
                : (currentIndex === idx ? 'current' : flagged.has(q.id) ? 'flagged' : userAnswers[q.id] !== undefined ? 'answered' : 'none');
              const colors = {
                current: "bg-blue-600 text-white scale-105 shadow-md",
                flagged: "bg-yellow-100 border-yellow-400 text-yellow-700",
                answered: "bg-blue-50 border-blue-200 text-blue-700",
                correct: "bg-green-100 border-green-300 text-green-700",
                wrong: "bg-red-100 border-red-300 text-red-700",
                none: "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              };
              return (
                <button key={q.id} onClick={() => setCurrentIndex(idx)} className={cn("h-10 w-full rounded flex items-center justify-center text-sm font-medium border relative transition-all", colors[status])}>
                  {idx + 1}
                  {flagged.has(q.id) && !isReview && <Flag className="w-2.5 h-2.5 absolute top-0.5 right-0.5 fill-yellow-500 text-yellow-500" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t bg-slate-50">
          <button onClick={isReview ? () => setQuizState('menu') : finishQuiz} className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-900 transition flex items-center justify-center gap-2">
            {isReview ? <><RotateCcw className="w-4 h-4" /> Menu</> : "Submit Quiz"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      {/* FIX 2: Remove overflow-hidden on mobile main so it can grow. Desktop keeps overflow-y-auto. */}
      <main className="flex-1 w-full md:h-screen md:overflow-y-auto flex flex-col relative">

        {/* Mobile Header for "Show Questions" Button */}
        {!sidebarOpen && (
          <div className="sticky top-0 z-10 p-4 w-full bg-slate-100/95 backdrop-blur-sm md:bg-transparent md:static">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 bg-white border border-slate-200 shadow-sm rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <ChevronRight className="w-5 h-5" />
              <span className="text-sm font-medium md:hidden">Show Questions</span>
            </button>
          </div>
        )}

        <div className={cn("flex-1 p-4 md:p-8 lg:p-12", !sidebarOpen && "pt-0 md:pt-4")}>
          <div className="max-w-3xl mx-auto">
            {/* Question Card */}
            {/* FIX 3: Remove min-h constraints that trap scroll, let it be auto. */}
            <div className="bg-white rounded-2xl shadow-xl flex flex-col h-auto">
              <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-start rounded-t-2xl">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Question {currentIndex + 1} of {activeQuestions.length}
                  </span>
                  {timeLeft !== null && !isReview && (
                    <div className={cn("mt-1 flex items-center gap-2 font-mono text-sm font-bold", timeLeft < 60 ? "text-red-600 animate-pulse" : "text-blue-600")}>
                      <Clock className="w-3 h-3" />
                      {formatTime(timeLeft)}
                    </div>
                  )}
                  <p className="mt-4 text-xl font-medium text-slate-800 leading-relaxed">
                    {currentQ?.text}
                  </p>
                </div>
                {!isReview && (
                  <button
                    onClick={() => setFlagged(prev => { const n = new Set(prev); n.has(currentQ.id) ? n.delete(currentQ.id) : n.add(currentQ.id); return n; })}
                    className={cn("p-2 rounded-full transition-colors", flagged.has(currentQ.id) ? "bg-yellow-100 text-yellow-600" : "text-slate-300 hover:bg-slate-100")}
                  >
                    <Flag className={cn("w-6 h-6", flagged.has(currentQ.id) && "fill-current")} />
                  </button>
                )}
              </div>

              {/* Options */}
              <div className="p-6 space-y-3 flex-1">
                {currentQ?.options.map((opt, i) => {
                  const selected = userAnswers[currentQ.id] === i;
                  const isCorrect = currentQ.correct_answer === i;
                  let style = "border-slate-200 hover:bg-slate-50";
                  if (isReview) {
                    if (isCorrect) style = "border-green-500 bg-green-50 text-green-800";
                    else if (selected) style = "border-red-300 bg-red-50 text-red-800";
                    else style = "border-slate-100 text-slate-400";
                  } else if (selected) {
                    style = "border-blue-600 bg-blue-50 text-blue-800";
                  }
                  return (
                    <button key={i} disabled={isReview} onClick={() => setUserAnswers(prev => ({ ...prev, [currentQ.id]: i }))}
                      className={cn("w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 transition-all", style)}>
                      <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] shrink-0", (selected || (isReview && isCorrect)) ? "border-current" : "border-slate-300")}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="flex-1">{opt}</span>
                      {isReview && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600 absolute right-4" />}
                      {isReview && selected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 absolute right-4" />}
                    </button>
                  );
                })}
              </div>

              {/* Footer Buttons - Inside the card now so they scroll WITH the content */}
              <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50 rounded-b-2xl">
                <button disabled={currentIndex === 0} onClick={() => { setCurrentIndex(i => i - 1); window.scrollTo(0, 0); }} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-50 flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button disabled={currentIndex === activeQuestions.length - 1} onClick={() => { setCurrentIndex(i => i + 1); window.scrollTo(0, 0); }} className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* End Question Card */}
          </div>
        </div>
      </main>
    </div>
  );
}