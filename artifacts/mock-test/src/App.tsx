import { useState, useEffect } from "react";
import Registration from "@/pages/Registration";
import Exam, { type ExamQuestion } from "@/pages/Exam";
import Results from "@/pages/Results";
import PdfUpload, { type ExtractedQuestion } from "@/pages/PdfUpload";
import PdfUploadSplit from "@/pages/PdfUploadSplit";
import { useDarkMode } from "@/hooks/useDarkMode";

type Screen =
  | "home"
  | "pdf-upload"
  | "pdf-upload-with-answers"
  | "pdf-upload-split"
  | "pdf-registration"
  | "exam"
  | "results";

interface ExamState {
  candidateName: string;
  rollNumber: string;
  duration: number;
  examTitle: string;
  questions: ExamQuestion[];
  answers: (number | null)[];
  timeTaken: number;
}

const DEFAULT_STATE: ExamState = {
  candidateName: "",
  rollNumber: "",
  duration: 140,
  examTitle: "Mock Test",
  questions: [],
  answers: [],
  timeTaken: 0,
};

interface ProviderStatus {
  id: string;
  name: string;
  available: boolean;
  model: string;
  type: "paid" | "free";
  note: string;
}

interface AiStatus {
  providers: ProviderStatus[];
  activeProvider: ProviderStatus | null;
  availableCount: number;
  healthy: boolean;
  setupInstructions: Record<string, string>;
}

function DarkToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors text-white"
    >
      {isDark ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="5" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function AiStatusBadge({ onOpen }: { onOpen: () => void }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => {
        if (!r.ok) throw new Error("AI status unavailable");
        return r.json();
      })
      .then((d) => {
        setStatus(d as AiStatus);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  if (!status && failed) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-400"
      >
        <span className="w-2 h-2 rounded-full bg-red-500" />
        AI server offline
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    );
  }

  if (!status) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm bg-gray-50 border-gray-300 text-gray-600 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300"
      >
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        Checking AI...
      </button>
    );
  }

  const active = status.activeProvider;
  const isFree = active?.type === "free";
  const noProvider = !status.healthy;

  return (
    <button
      onClick={onOpen}
      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm ${
        noProvider
          ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-400"
          : isFree
          ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-400"
          : "bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-400"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${noProvider ? "bg-red-500" : isFree ? "bg-amber-500" : "bg-green-500"} ${!noProvider ? "animate-pulse" : ""}`} />
      {noProvider ? "No AI configured" : `AI: ${active?.name}`}
      <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}

const PREF_KEY = "dhanusha_preferred_ai_provider";

function AiStatusModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinned, setPinned] = useState<string>(() => localStorage.getItem(PREF_KEY) ?? "auto");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((d) => { setStatus(d as AiStatus); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = (id: string) => {
    setPinned(id);
    if (id === "auto") {
      localStorage.removeItem(PREF_KEY);
    } else {
      localStorage.setItem(PREF_KEY, id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gray-800 text-white rounded-t-2xl p-5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">AI Provider Settings</h2>
              <p className="text-gray-400 text-xs mt-0.5">Choose which AI to use, or let the system decide automatically</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Checking providers...</div>
          ) : !status ? (
            <div className="py-8 text-center text-red-500 text-sm">Could not reach the server.</div>
          ) : (
            <>
              {saved && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Preference saved!
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Selection Mode</p>
                <button
                  onClick={() => handleSelect("auto")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${pinned === "auto" ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${pinned === "auto" ? "border-blue-500" : "border-gray-300 dark:border-gray-600"}`}>
                    {pinned === "auto" && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${pinned === "auto" ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-200"}`}>Auto — try best available</div>
                    <div className="text-xs text-gray-400 mt-0.5">System picks automatically, falls back if one fails</div>
                  </div>
                  {pinned === "auto" && (
                    <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Selected</span>
                  )}
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Or Pin a Specific Provider</p>
                <div className="space-y-2">
                  {status.providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => p.available && handleSelect(p.id)}
                      disabled={!p.available}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        !p.available
                          ? "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60 cursor-not-allowed"
                          : pinned === p.id
                          ? "border-green-500 bg-green-50 dark:bg-green-950"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 cursor-pointer"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        !p.available ? "border-gray-300 dark:border-gray-600" : pinned === p.id ? "border-green-500" : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {pinned === p.id && p.available && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.available ? "bg-green-500" : "bg-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${p.available ? "text-gray-800 dark:text-gray-100" : "text-gray-400"}`}>{p.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type === "free" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                            {p.type === "free" ? "Free" : "Paid"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{p.model}</p>
                        {!p.available && <p className="text-xs text-gray-400 mt-0.5 italic">{p.note}</p>}
                      </div>
                      {pinned === p.id && p.available && (
                        <span className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold shrink-0">Pinned</span>
                      )}
                      {!p.available && (
                        <span className="ml-auto text-xs text-gray-300 font-medium shrink-0">Not set up</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {pinned !== "auto" && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
                  <strong>Note:</strong> Even with a pinned provider, if it fails the system will automatically fall back to other available providers so your work never stops.
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-2">Add Your Own API Key</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">Set any of these in your <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">.env</code> file to unlock more providers:</p>
                <div className="space-y-2">
                  {Object.entries(status.setupInstructions).map(([key, desc]) => (
                    <div key={key} className="bg-white dark:bg-gray-700 rounded-lg p-2.5 border border-blue-100 dark:border-gray-600">
                      <code className="text-xs font-bold text-blue-800 dark:text-blue-300">{key}</code>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isDark, toggleDark] = useDarkMode();
  const [screen, setScreen] = useState<Screen>("home");
  const [examState, setExamState] = useState<ExamState>(DEFAULT_STATE);
  const [pendingQuestions, setPendingQuestions] = useState<ExamQuestion[]>([]);
  const [pendingTitle, setPendingTitle] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);

  const handlePdfReady = (questions: ExtractedQuestion[], examTitle: string) => {
    setPendingQuestions(questions);
    setPendingTitle(examTitle);
    setScreen("pdf-registration");
  };

  const handlePdfStart = (name: string, rollNumber: string, duration: number) => {
    setExamState({
      candidateName: name,
      rollNumber,
      duration,
      examTitle: pendingTitle,
      questions: pendingQuestions,
      answers: [],
      timeTaken: 0,
    });
    setScreen("exam");
  };

  const handleSubmit = (answers: (number | null)[], timeTaken: number) => {
    setExamState((prev) => ({ ...prev, answers, timeTaken }));
    setScreen("results");
  };

  const handleRetake = () => {
    setExamState(DEFAULT_STATE);
    setPendingQuestions([]);
    setPendingTitle("");
    setScreen("home");
  };

  if (screen === "home") {
    return (
      <>
        {showAiModal && <AiStatusModal onClose={() => setShowAiModal(false)} />}
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-slate-900 flex items-center justify-center p-4">
          <div className="w-full max-w-xl">
            <div className="bg-blue-700 text-white rounded-t-xl p-6 text-center shadow-lg relative">
              <div className="absolute top-4 right-4">
                <DarkToggle isDark={isDark} onToggle={toggleDark} />
              </div>
              <div className="text-blue-200 text-xs uppercase tracking-wider mb-1">Dhanusha Academy</div>
              <h1 className="text-2xl font-bold">UPCNET Mock Test</h1>
              <p className="text-blue-200 text-sm mt-1">Upload a question paper PDF to start a practice exam</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-b-xl shadow-lg p-6 space-y-4">

              {/* Option 1 — Questions only */}
              <button
                onClick={() => setScreen("pdf-upload")}
                className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-green-200 dark:border-green-800 hover:border-green-500 hover:bg-green-50/40 dark:hover:bg-green-900/20 transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <svg className="w-6 h-6 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-green-700 dark:group-hover:text-green-400">Upload Question Paper PDF</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">AI extracts all MCQ questions from any question paper</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["Any Exam PDF", "AI-Powered", "Bilingual Support", "Auto-Detection"].map((s) => (
                      <span key={s} className="text-xs bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-green-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Option 2 — Single PDF with answers inside */}
              <button
                onClick={() => setScreen("pdf-upload-with-answers")}
                className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-violet-200 dark:border-violet-800 hover:border-violet-500 hover:bg-violet-50/40 dark:hover:bg-violet-900/20 transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0 group-hover:bg-violet-200 dark:group-hover:bg-violet-800 transition-colors">
                  <svg className="w-6 h-6 text-violet-700 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-violet-700 dark:group-hover:text-violet-400">Upload PDF with Answer Key</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">One PDF that has both questions &amp; answers — AI extracts both</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["Questions + Answers", "Full Scoring", "Instant Results", "Bilingual"].map((s) => (
                      <span key={s} className="text-xs bg-violet-50 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-700 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-violet-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Option 3 — Two separate PDFs */}
              <button
                onClick={() => setScreen("pdf-upload-split")}
                className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-orange-200 dark:border-orange-800 hover:border-orange-500 hover:bg-orange-50/40 dark:hover:bg-orange-900/20 transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0 group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
                  <svg className="w-6 h-6 text-orange-700 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-orange-700 dark:group-hover:text-orange-400">Upload Questions + Separate Answer Key</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Two PDFs — question set + combined answer key — AI matches them</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["2 PDFs", "Set Selection", "Auto-Match", "Full Scoring"].map((s) => (
                      <span key={s} className="text-xs bg-orange-50 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-700 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-orange-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div className="pt-1 flex items-center justify-center">
                <AiStatusBadge onOpen={() => setShowAiModal(true)} />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (screen === "pdf-upload") {
    return (
      <PdfUpload
        mode="questions-only"
        onQuestionsReady={handlePdfReady}
        onBack={() => setScreen("home")}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
    );
  }

  if (screen === "pdf-upload-with-answers") {
    return (
      <PdfUpload
        mode="with-answers"
        onQuestionsReady={handlePdfReady}
        onBack={() => setScreen("home")}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
    );
  }

  if (screen === "pdf-upload-split") {
    return (
      <PdfUploadSplit
        onQuestionsReady={handlePdfReady}
        onBack={() => setScreen("home")}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
    );
  }

  if (screen === "pdf-registration") {
    return (
      <Registration
        onStart={handlePdfStart}
        onBack={() => setScreen("home")}
        customTitle={pendingTitle}
        customQuestionCount={pendingQuestions.length}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
    );
  }

  if (screen === "exam") {
    return (
      <Exam
        candidateName={examState.candidateName}
        rollNumber={examState.rollNumber}
        duration={examState.duration}
        examTitle={examState.examTitle}
        questions={examState.questions}
        onSubmit={handleSubmit}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
    );
  }

  return (
    <Results
      candidateName={examState.candidateName}
      rollNumber={examState.rollNumber}
      examTitle={examState.examTitle}
      questions={examState.questions}
      answers={examState.answers}
      timeTaken={examState.timeTaken}
      onRetake={handleRetake}
      isDark={isDark}
      onToggleDark={toggleDark}
    />
  );
}
