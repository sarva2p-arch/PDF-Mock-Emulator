import { useState, useEffect, useRef } from "react";
import Registration from "@/pages/Registration";
import Exam, { type ExamAnswer, type ExamQuestion } from "@/pages/Exam";
import Results from "@/pages/Results";
import PdfUpload, { type ExtractedQuestion } from "@/pages/PdfUpload";
import PdfUploadSplit from "@/pages/PdfUploadSplit";
import ReviewExtractedTest from "@/pages/ReviewExtractedTest";
import { useDarkMode } from "@/hooks/useDarkMode";
import { readSavedTest } from "@/lib/savedTests";
import BetaBadge from "@/components/BetaBadge";

type Screen =
  | "home"
  | "pdf-upload"
  | "pdf-upload-with-answers"
  | "pdf-upload-split"
  | "review-extraction"
  | "pdf-registration"
  | "exam"
  | "results";

interface ExamState {
  candidateName: string;
  rollNumber: string;
  duration: number;
  examTitle: string;
  questions: ExamQuestion[];
  answers: ExamAnswer[];
  timeTaken: number;
}

interface TestHistorySubject {
  subject: string;
  total: number;
  correct: number;
  wrong: number;
  unattempted: number;
}

interface TestHistoryEntry {
  id: string;
  examTitle: string;
  candidateName: string;
  rollNumber: string;
  completedAt: string;
  totalQuestions: number;
  correct: number;
  wrong: number;
  unattempted: number;
  percentage: number;
  timeTaken: number;
  duration: number;
  subjects: TestHistorySubject[];
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

const HISTORY_KEY = "sarva_test_history_v1";

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

function isIntegerQuestion(question: ExamQuestion) {
  return question.questionType === "integer" || question.options.length === 0;
}

function normalizeNumeric(value: string) {
  return value.trim().replace(/,/g, "").toLowerCase();
}

function numericAnswersMatch(userAnswer: ExamAnswer, correctAnswer?: string) {
  if (typeof userAnswer !== "string" || !correctAnswer) return false;
  const user = normalizeNumeric(userAnswer);
  const correct = normalizeNumeric(correctAnswer);
  const userNum = Number(user);
  const correctNum = Number(correct);

  if (Number.isFinite(userNum) && Number.isFinite(correctNum)) {
    return Math.abs(userNum - correctNum) < 1e-9;
  }

  return user === correct;
}

function isAnswerCorrect(question: ExamQuestion, answer: ExamAnswer) {
  if (answer === null) return false;
  if (isIntegerQuestion(question)) {
    return numericAnswersMatch(answer, question.numericAnswer);
  }
  return typeof answer === "number" && answer === question.correctAnswer;
}

function loadTestHistory(): TestHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTestHistory(history: TestHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function buildHistoryEntry(state: ExamState, answers: ExamAnswer[], timeTaken: number): TestHistoryEntry {
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  const subjectMap = new Map<string, TestHistorySubject>();

  state.questions.forEach((question, index) => {
    const answer = answers[index] ?? null;
    if (!subjectMap.has(question.subject)) {
      subjectMap.set(question.subject, {
        subject: question.subject,
        total: 0,
        correct: 0,
        wrong: 0,
        unattempted: 0,
      });
    }

    const subject = subjectMap.get(question.subject)!;
    subject.total += 1;

    if (answer === null) {
      unattempted += 1;
      subject.unattempted += 1;
    } else if (isAnswerCorrect(question, answer)) {
      correct += 1;
      subject.correct += 1;
    } else {
      wrong += 1;
      subject.wrong += 1;
    }
  });

  const totalQuestions = state.questions.length;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    examTitle: state.examTitle || "Mock Test",
    candidateName: state.candidateName,
    rollNumber: state.rollNumber,
    completedAt: new Date().toISOString(),
    totalQuestions,
    correct,
    wrong,
    unattempted,
    percentage: totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0,
    timeTaken,
    duration: state.duration,
    subjects: [...subjectMap.values()],
  };
}

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function HistoryPanel({ history, onClear }: { history: TestHistoryEntry[]; onClear: () => void }) {
  const totalTests = history.length;
  const average = totalTests > 0 ? Math.round(history.reduce((sum, item) => sum + item.percentage, 0) / totalTests) : 0;
  const best = totalTests > 0 ? Math.max(...history.map((item) => item.percentage)) : 0;
  const recent = history.slice(0, 5);

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Previous Analytics</div>
          <div className="text-sm font-bold text-white">Test History</div>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/60 px-3 py-4 text-center text-sm text-zinc-500">
          Your completed tests will appear here with score, time, and subject-wise analytics.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Tests", value: totalTests },
              { label: "Average", value: `${average}%` },
              { label: "Best", value: `${best}%` },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-center">
                <div className="text-lg font-black text-white">{item.value}</div>
                <div className="text-xs text-zinc-500">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {recent.map((item) => {
              const topSubject = [...item.subjects].sort((a, b) => b.correct / b.total - a.correct / a.total)[0];
              return (
                <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-100">{item.examTitle}</div>
                      <div className="text-xs text-zinc-500">{formatHistoryDate(item.completedAt)} - {item.candidateName || "Candidate"}</div>
                    </div>
                    <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${item.percentage >= 60 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                      {item.percentage}%
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                    <div className="rounded bg-green-950/40 px-2 py-1 text-green-300">{item.correct} correct</div>
                    <div className="rounded bg-red-950/40 px-2 py-1 text-red-300">{item.wrong} wrong</div>
                    <div className="rounded bg-zinc-900 px-2 py-1 text-zinc-400">{item.unattempted} skip</div>
                    <div className="rounded bg-zinc-900 px-2 py-1 text-zinc-400">{formatDuration(item.timeTaken)}</div>
                  </div>
                  {topSubject && (
                    <div className="mt-2 text-xs text-zinc-500">
                      Best subject: <span className="text-zinc-300">{topSubject.subject}</span> ({topSubject.correct}/{topSubject.total})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const PREF_KEY = "dhanusha_preferred_ai_provider";
const AI_PREF_CHANGED_EVENT = "sarva-ai-provider-preference-changed";

function AiStatusBadge({ onOpen }: { onOpen: () => void }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [pinned, setPinned] = useState<string>(() => localStorage.getItem(PREF_KEY) ?? "auto");

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

  useEffect(() => {
    const refreshPreference = () => setPinned(localStorage.getItem(PREF_KEY) ?? "auto");
    window.addEventListener("storage", refreshPreference);
    window.addEventListener(AI_PREF_CHANGED_EVENT, refreshPreference);
    return () => {
      window.removeEventListener("storage", refreshPreference);
      window.removeEventListener(AI_PREF_CHANGED_EVENT, refreshPreference);
    };
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
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm bg-gray-50 border-gray-300 text-gray-600 dark:bg-black dark:border-zinc-800 dark:text-zinc-300"
      >
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        Checking AI...
      </button>
    );
  }

  const noProvider = !status.healthy;
  const isAuto = pinned === "auto";
  const selectedProvider = isAuto ? null : status.providers.find((p) => p.id === pinned);
  const badgeProvider = selectedProvider ?? status.activeProvider;
  const isFree = badgeProvider?.type === "free";
  const label = noProvider ? "No AI configured" : isAuto ? "AI: Auto" : `AI: ${badgeProvider?.name ?? "Auto"}`;

  return (
    <button
      onClick={onOpen}
      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm ${
        noProvider
          ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-400"
          : isAuto
          ? "bg-cyan-50 border-cyan-300 text-cyan-700 dark:bg-cyan-950 dark:border-cyan-700 dark:text-cyan-300"
          : isFree
          ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-400"
          : "bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-400"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${noProvider ? "bg-red-500" : isAuto ? "bg-cyan-500" : isFree ? "bg-amber-500" : "bg-green-500"} ${!noProvider ? "animate-pulse" : ""}`} />
      {label}
      <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}

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
    window.dispatchEvent(new Event(AI_PREF_CHANGED_EVENT));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-black text-white rounded-t-2xl p-5 sticky top-0 z-10">
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
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Selection Mode</p>
                <button
                  onClick={() => handleSelect("auto")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${pinned === "auto" ? "border-zinc-800 bg-zinc-50 dark:bg-zinc-950" : "border-gray-200 dark:border-zinc-800 hover:border-gray-300"}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${pinned === "auto" ? "border-zinc-800" : "border-gray-300 dark:border-zinc-700"}`}>
                    {pinned === "auto" && <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />}
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${pinned === "auto" ? "text-zinc-800 dark:text-zinc-300" : "text-gray-700 dark:text-zinc-200"}`}>Auto — try best available</div>
                    <div className="text-xs text-gray-400 mt-0.5">System picks automatically, falls back if one fails</div>
                  </div>
                  {pinned === "auto" && (
                    <span className="ml-auto text-xs bg-zinc-900 text-white px-2 py-0.5 rounded-full font-bold">Selected</span>
                  )}
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Or Pin a Specific Provider</p>
                <div className="space-y-2">
                  {status.providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => p.available && handleSelect(p.id)}
                      disabled={!p.available}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        !p.available
                          ? "border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-black opacity-60 cursor-not-allowed"
                          : pinned === p.id
                          ? "border-green-500 bg-green-50 dark:bg-green-950"
                          : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 cursor-pointer"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        !p.available ? "border-gray-300 dark:border-zinc-700" : pinned === p.id ? "border-green-500" : "border-gray-300 dark:border-zinc-700"
                      }`}>
                        {pinned === p.id && p.available && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.available ? "bg-green-500" : "bg-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${p.available ? "text-gray-800 dark:text-zinc-100" : "text-gray-400"}`}>{p.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type === "free" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-800"}`}>
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

              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-400 uppercase tracking-wide mb-2">API Key Status</p>
                <p className="text-xs text-zinc-800 dark:text-zinc-300 mb-3">These providers are checked from your <code className="bg-zinc-100 dark:bg-zinc-950 px-1 rounded">.env</code> file. Connected ones are ready to use.</p>
                <div className="space-y-2">
                  {status.providers.map((p) => (
                    <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-300">{p.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.available ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                          {p.available ? "Connected" : "Optional"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                        {p.available ? "API key detected and ready." : "Not needed now. Add later only if you want this backup provider."}
                      </p>
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
  const [history, setHistory] = useState<TestHistoryEntry[]>(() => loadTestHistory());
  const savedTestInputRef = useRef<HTMLInputElement>(null);

  const handlePdfReady = (questions: ExtractedQuestion[], examTitle: string) => {
    setPendingQuestions(questions);
    setPendingTitle(examTitle);
    setScreen("review-extraction");
  };

  const handleImportSavedTest = async (file?: File) => {
    if (!file) return;

    try {
      const saved = await readSavedTest(file);
      setPendingQuestions(saved.questions);
      setPendingTitle(saved.examTitle);
      setScreen("review-extraction");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not import this saved test file.");
    } finally {
      if (savedTestInputRef.current) savedTestInputRef.current.value = "";
    }
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

  const handleReviewConfirm = (questions: ExamQuestion[], examTitle: string) => {
    setPendingQuestions(questions);
    setPendingTitle(examTitle);
    setScreen("pdf-registration");
  };

  const handleSubmit = (answers: ExamAnswer[], timeTaken: number) => {
    const completedState = { ...examState, answers, timeTaken };
    setExamState(completedState);
    if (completedState.questions.length > 0) {
      const entry = buildHistoryEntry(completedState, answers, timeTaken);
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 30);
        saveTestHistory(next);
        return next;
      });
    }
    setScreen("results");
  };

  const handleClearHistory = () => {
    const confirmed = window.confirm("Clear all previous test analytics?");
    if (!confirmed) return;
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
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
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black">
            <div className="relative border-b border-zinc-800 bg-black px-6 py-6 text-center text-white">
              <div className="absolute top-4 right-4">
                <DarkToggle isDark={isDark} onToggle={toggleDark} />
              </div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Sarva Build</div>
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">PDF Mock Test</h1>
                <BetaBadge />
              </div>
              <p className="mt-1 text-sm text-zinc-400">Upload a question paper PDF to start a practice exam</p>
            </div>

            <div className="bg-zinc-950 p-5 space-y-3">

              {/* Option 1 — Questions only */}
              <button
                onClick={() => setScreen("pdf-upload")}
                className="group relative w-full overflow-hidden rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/90 via-emerald-950/35 to-zinc-950 p-5 pl-6 text-left shadow-lg shadow-emerald-950/10 transition-all hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-emerald-950/30 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl border border-emerald-200/60 bg-emerald-300 text-emerald-950 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-950/30">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">Upload Question Paper PDF</div>
                  <div className="text-sm text-emerald-50/75 mt-0.5">AI extracts all MCQ questions from any question paper</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["Any Exam PDF", "AI-Powered", "Bilingual Support", "Auto-Detection"].map((s) => (
                      <span key={s} className="text-xs bg-emerald-300/10 text-emerald-50 border border-emerald-200/20 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-emerald-100/70 group-hover:text-white shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Option 2 — Single PDF with answers inside */}
              <button
                onClick={() => setScreen("pdf-upload-with-answers")}
                className="group relative w-full overflow-hidden rounded-xl border border-violet-500/35 bg-gradient-to-br from-violet-950/90 via-fuchsia-950/25 to-zinc-950 p-5 pl-6 text-left shadow-lg shadow-violet-950/10 transition-all hover:-translate-y-0.5 hover:border-violet-300/70 hover:shadow-violet-950/30 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl border border-violet-200/60 bg-violet-300 text-violet-950 flex items-center justify-center shrink-0 shadow-sm shadow-violet-950/30">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">Upload PDF with Answer Key</div>
                  <div className="text-sm text-violet-50/75 mt-0.5">One PDF that has both questions &amp; answers - AI extracts both</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["Questions + Answers", "Full Scoring", "Instant Results", "Bilingual"].map((s) => (
                      <span key={s} className="text-xs bg-violet-300/10 text-violet-50 border border-violet-200/20 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-violet-100/70 group-hover:text-white shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Option 3 — Two separate PDFs */}
              <button
                onClick={() => setScreen("pdf-upload-split")}
                className="group relative w-full overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-950/85 via-orange-950/30 to-zinc-950 p-5 pl-6 text-left shadow-lg shadow-amber-950/10 transition-all hover:-translate-y-0.5 hover:border-amber-300/70 hover:shadow-amber-950/30 flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl border border-amber-100/70 bg-amber-300 text-amber-950 flex items-center justify-center shrink-0 shadow-sm shadow-amber-950/30">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">Upload Questions + Separate Answer Key</div>
                  <div className="text-sm text-amber-50/75 mt-0.5">Two PDFs - question set + combined answer key - AI matches them</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["2 PDFs", "Set Selection", "Auto-Match", "Full Scoring"].map((s) => (
                      <span key={s} className="text-xs bg-amber-300/10 text-amber-50 border border-amber-200/20 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-amber-100/70 group-hover:text-white shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => savedTestInputRef.current?.click()}
                className="group relative w-full overflow-hidden rounded-xl border border-cyan-500/35 bg-gradient-to-br from-cyan-950/80 via-sky-950/25 to-zinc-950 p-4 pl-5 text-left shadow-lg shadow-cyan-950/10 transition-all hover:-translate-y-0.5 hover:border-cyan-300/70 hover:shadow-cyan-950/30 flex items-start gap-4"
              >
                <div className="w-11 h-11 rounded-xl border border-cyan-100/70 bg-cyan-300 text-cyan-950 flex items-center justify-center shrink-0 shadow-sm shadow-cyan-950/30">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0-12l-4 4m4-4l4 4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">Import Saved Test File</div>
                  <div className="text-sm text-cyan-50/75 mt-0.5">Load an exported JSON test - no AI quota used</div>
                </div>
                <svg className="w-5 h-5 text-cyan-100/70 group-hover:text-white shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <input
                ref={savedTestInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => handleImportSavedTest(event.target.files?.[0])}
              />

              <div className="pt-1 flex items-center justify-center">
                <AiStatusBadge onOpen={() => setShowAiModal(true)} />
              </div>

              <HistoryPanel history={history} onClear={handleClearHistory} />
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

  if (screen === "review-extraction") {
    return (
      <ReviewExtractedTest
        examTitle={pendingTitle}
        questions={pendingQuestions}
        onBack={() => setScreen("home")}
        onConfirm={handleReviewConfirm}
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
