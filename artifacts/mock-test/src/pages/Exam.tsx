import { useState, useEffect, useCallback, useRef } from "react";

type QuestionStatus = "not-visited" | "not-answered" | "answered" | "marked" | "marked-answered";
export type ExamAnswer = number | string | null;

export interface ExamQuestion {
  id: number;
  subject: string;
  questionType?: "mcq" | "integer";
  question: string;
  options: string[];
  correctAnswer: number;
  numericAnswer?: string;
}

interface ExamProps {
  candidateName: string;
  rollNumber: string;
  duration: number;
  examTitle: string;
  questions: ExamQuestion[];
  onSubmit: (answers: ExamAnswer[], timeTaken: number) => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

const PALETTE_COLORS: Record<string, string> = {
  "Nursing Aptitude": "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-700",
  Biology: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  Physics: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-950/50 dark:text-zinc-400 dark:border-zinc-700",
  Chemistry: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700",
  English: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700",
  Mathematics: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700",
  "General Knowledge": "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900/50 dark:text-zinc-300 dark:border-zinc-700",
};

const PALETTE_ACTIVE: Record<string, string> = {
  "Nursing Aptitude": "bg-pink-600 text-white",
  Biology: "bg-green-600 text-white",
  Physics: "bg-zinc-900 text-white",
  Chemistry: "bg-amber-600 text-white",
  English: "bg-purple-600 text-white",
  Mathematics: "bg-cyan-600 text-white",
  "General Knowledge": "bg-zinc-900 text-white",
};

function getColor(subject: string) {
  return PALETTE_COLORS[subject] ?? "bg-gray-100 text-gray-700 border-gray-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700";
}
function getActiveColor(subject: string) {
  return PALETTE_ACTIVE[subject] ?? "bg-gray-600 text-white";
}

function getQuestionStatus(
  qIndex: number,
  answers: ExamAnswer[],
  marked: boolean[],
  visited: boolean[]
): QuestionStatus {
  if (!visited[qIndex]) return "not-visited";
  if (marked[qIndex] && answers[qIndex] !== null) return "marked-answered";
  if (marked[qIndex]) return "marked";
  if (answers[qIndex] !== null) return "answered";
  return "not-answered";
}

function isIntegerQuestion(question: ExamQuestion) {
  return question.questionType === "integer" || question.options.length === 0;
}

function statusClass(status: QuestionStatus): string {
  switch (status) {
    case "not-visited": return "q-not-visited";
    case "not-answered": return "q-not-answered";
    case "answered": return "q-answered";
    case "marked": return "q-marked";
    case "marked-answered": return "q-marked-answered";
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Exam({ candidateName, rollNumber, duration, examTitle, questions, onSubmit, isDark, onToggleDark }: ExamProps) {
  const totalSeconds = duration * 60;
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswer[]>(Array(questions.length).fill(null));
  const [marked, setMarked] = useState<boolean[]>(Array(questions.length).fill(false));
  const [visited, setVisited] = useState<boolean[]>(() => {
    const v = Array(questions.length).fill(false);
    v[0] = true;
    return v;
  });
  const [activeSubject, setActiveSubject] = useState<string>(questions[0]?.subject ?? "");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedNumeric, setSelectedNumeric] = useState("");
  const submittedRef = useRef(false);
  const latestAnswersRef = useRef(answers);

  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  const buildAnswersWithCurrent = useCallback(() => {
    const nextAnswers = [...latestAnswersRef.current];
    const question = questions[currentIndex];
    if (!question) return nextAnswers;
    nextAnswers[currentIndex] = isIntegerQuestion(question)
      ? selectedNumeric.trim() || null
      : selectedOption;
    return nextAnswers;
  }, [currentIndex, questions, selectedNumeric, selectedOption]);

  const submitOnce = useCallback((finalAnswers: ExamAnswer[], timeTaken: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(finalAnswers, timeTaken);
  }, [onSubmit]);

  useEffect(() => {
    const answer = answers[currentIndex];
    if (typeof answer === "number") {
      setSelectedOption(answer);
      setSelectedNumeric("");
    } else {
      setSelectedOption(null);
      setSelectedNumeric(typeof answer === "string" ? answer : "");
    }
  }, [currentIndex, answers]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeLeft === 0) {
      submitOnce(buildAnswersWithCurrent(), totalSeconds);
    }
  }, [timeLeft, buildAnswersWithCurrent, submitOnce, totalSeconds]);

  const goToQuestion = useCallback((index: number) => {
    setVisited((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    setCurrentIndex(index);
    setActiveSubject(questions[index]?.subject ?? "");
  }, [questions]);

  const handleSaveAndNext = () => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = isIntegerQuestion(questions[currentIndex])
      ? selectedNumeric.trim() || null
      : selectedOption;
    setAnswers(newAnswers);
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleClearResponse = () => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = null;
    setAnswers(newAnswers);
    setSelectedOption(null);
    setSelectedNumeric("");
  };

  const handleMarkForReview = () => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = isIntegerQuestion(questions[currentIndex])
      ? selectedNumeric.trim() || null
      : selectedOption;
    setAnswers(newAnswers);
    const newMarked = [...marked];
    newMarked[currentIndex] = !newMarked[currentIndex];
    setMarked(newMarked);
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleSubmit = () => {
    submitOnce(buildAnswersWithCurrent(), totalSeconds - timeLeft);
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const markedCount = marked.filter(Boolean).length;
  const notAnsweredCount = visited.filter((v, i) => v && answers[i] === null && !marked[i]).length;
  const notVisitedCount = visited.filter((v) => !v).length;
  const currentQuestion = questions[currentIndex];
  const currentIsInteger = isIntegerQuestion(currentQuestion);
  const isWarning = timeLeft <= 300;

  const subjectGroups: { subject: string; indices: number[] }[] = [];
  const seenSubjects = new Map<string, number>();
  questions.forEach((q, i) => {
    if (!seenSubjects.has(q.subject)) {
      seenSubjects.set(q.subject, subjectGroups.length);
      subjectGroups.push({ subject: q.subject, indices: [] });
    }
    subjectGroups[seenSubjects.get(q.subject)!].indices.push(i);
  });

  const uniqueSubjects = subjectGroups.map((g) => g.subject);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black flex flex-col" style={{ fontSize: 14 }}>
      {/* Top bar */}
      <div className="bg-black text-white px-3 py-3 sm:px-4 sm:py-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-md">
        <div className="min-w-0">
          <div className="font-bold text-base truncate">{examTitle}</div>
          <div className="text-zinc-400 text-xs">{candidateName} | Roll: {rollNumber}</div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
          <div className={`flex flex-1 items-center justify-center gap-2 font-mono font-bold text-base sm:flex-none sm:text-lg bg-zinc-950 px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg ${isWarning ? "timer-warning" : ""}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
            </svg>
            {formatTime(timeLeft)}
          </div>
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors shrink-0"
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
          )}
          <button onClick={() => setShowSubmitModal(true)} className="bg-green-500 hover:bg-green-600 text-white font-semibold px-3 sm:px-4 py-2 rounded-lg text-sm transition-colors shrink-0">
            Submit Exam
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 lg:overflow-y-auto">
          {/* Subject tabs */}
          <div className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto lg:flex-wrap">
            {uniqueSubjects.map((subj) => {
              const group = subjectGroups.find((g) => g.subject === subj)!;
              const subjAnswered = group.indices.filter((i) => answers[i] !== null).length;
              return (
                <button
                  key={subj}
                  onClick={() => { setActiveSubject(subj); goToQuestion(group.indices[0]); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${activeSubject === subj ? getActiveColor(subj) : getColor(subj)}`}
                >
                  {subj} ({subjAnswered}/{group.indices.length})
                </button>
              );
            })}
          </div>

          {/* Question card */}
          <div className="flex-1 p-3 sm:p-4 md:p-6 max-w-3xl mx-auto w-full">
            <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
              <div className="bg-gray-50 dark:bg-black border-b border-gray-200 dark:border-zinc-800 px-4 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                  <span className="bg-zinc-950 text-white text-xs font-bold px-2.5 py-1 rounded-md">
                    Q. {currentIndex + 1} of {questions.length}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getColor(currentQuestion.subject)}`}>
                    {currentQuestion.subject}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-medium">+1 Mark</span>
                  <span className="bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 px-2 py-0.5 rounded font-medium">No Negative</span>
                </div>
              </div>

              <div className="px-4 sm:px-5 py-4 sm:py-5 border-b border-gray-100 dark:border-zinc-800">
                <p className="whitespace-pre-line text-gray-800 dark:text-zinc-100 font-medium leading-relaxed text-base">{currentQuestion.question}</p>
              </div>

              <div className="px-4 sm:px-5 py-4 space-y-3">
                {currentIsInteger ? (
                  <div className="rounded-lg border-2 border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-black p-4">
                    <label htmlFor={`integer-answer-${currentIndex}`} className="block text-sm font-semibold text-gray-700 dark:text-zinc-200 mb-2">
                      Enter your numerical answer
                    </label>
                    <input
                      id={`integer-answer-${currentIndex}`}
                      type="text"
                      inputMode="decimal"
                      value={selectedNumeric}
                      onChange={(e) => setSelectedNumeric(e.target.value)}
                      placeholder="Example: 42 or -3.5"
                      className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm font-mono text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                      Type only the final numeric value. Decimals and negative values are supported.
                    </p>
                  </div>
                ) : (
                  currentQuestion.options.map((option, optIdx) => (
                    <label
                      key={optIdx}
                      className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedOption === optIdx
                          ? "border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30"
                          : "border-gray-200 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/30 dark:hover:bg-zinc-950/10"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${currentIndex}`}
                        checked={selectedOption === optIdx}
                        onChange={() => setSelectedOption(optIdx)}
                        className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
                      />
                      <span className="flex items-start gap-2 text-gray-800 dark:text-zinc-200">
                        <span className={`font-bold shrink-0 ${selectedOption === optIdx ? "text-zinc-700" : "text-gray-500 dark:text-zinc-400"}`}>
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <span className="whitespace-pre-line">{option}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>

              <div className="px-4 sm:px-5 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-black flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                  <button
                    onClick={handleMarkForReview}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      marked[currentIndex] ? "bg-purple-600 text-white border-purple-600" : "border-purple-400 text-purple-700 dark:text-purple-400 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    }`}
                  >
                    {marked[currentIndex] ? "Unmark Review" : "Mark for Review & Next"}
                  </button>
                  <button onClick={handleClearResponse} className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                    Clear Response
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <button
                    onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button onClick={handleSaveAndNext} className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-950 text-white shadow-sm">
                    Save & Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 flex shrink-0 flex-col overflow-hidden lg:w-64 lg:border-l lg:border-t-0">
          <div className="bg-black text-white p-3 text-center sm:flex sm:items-center sm:justify-center sm:gap-3 lg:block">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center font-bold text-sm mx-auto mb-1 sm:mx-0 sm:mb-0 lg:mx-auto lg:mb-1">
              {candidateName.charAt(0)}
            </div>
            <div className="font-semibold text-sm truncate">{candidateName}</div>
            <div className="text-zinc-400 text-xs">{rollNumber}</div>
          </div>

          <div className="grid grid-cols-2 gap-1 p-2 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-black sm:grid-cols-4 lg:grid-cols-2">
            <div className="text-center bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded p-1.5">
              <div className="font-bold text-green-700 dark:text-green-400 text-base">{answeredCount}</div>
              <div className="text-xs text-green-600 dark:text-green-500">Answered</div>
            </div>
            <div className="text-center bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-1.5">
              <div className="font-bold text-red-600 dark:text-red-400 text-base">{notAnsweredCount}</div>
              <div className="text-xs text-red-500 dark:text-red-400">Not Answered</div>
            </div>
            <div className="text-center bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded p-1.5">
              <div className="font-bold text-gray-600 dark:text-zinc-300 text-base">{notVisitedCount}</div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">Not Visited</div>
            </div>
            <div className="text-center bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded p-1.5">
              <div className="font-bold text-purple-700 dark:text-purple-400 text-base">{markedCount}</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Marked</div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
            {subjectGroups.map(({ subject, indices }) => (
              <div key={subject} className="mb-3">
                <div className={`text-xs font-bold px-2 py-1 rounded mb-1.5 border ${getColor(subject)}`}>
                  {subject}
                </div>
                <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-6">
                  {indices.map((globalIdx, i) => {
                    const status = getQuestionStatus(globalIdx, answers, marked, visited);
                    return (
                      <button
                        key={globalIdx}
                        onClick={() => goToQuestion(globalIdx)}
                        className={`w-full aspect-square rounded text-xs font-bold transition-all relative ${statusClass(status)} ${currentIndex === globalIdx ? "ring-2 ring-offset-1 ring-blue-500" : ""}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-gray-200 dark:border-zinc-800">
            <button onClick={() => setShowSubmitModal(true)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
              Submit Exam
            </button>
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-zinc-100 mb-2">Confirm Submission</h2>
            <p className="text-gray-600 dark:text-zinc-300 text-sm mb-4">Are you sure you want to submit? You cannot change answers after submission.</p>
            <div className="bg-gray-50 dark:bg-black rounded-lg p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
              <div className="text-center">
                <div className="font-bold text-green-600 dark:text-green-400 text-xl">{answeredCount}</div>
                <div className="text-gray-500 dark:text-zinc-400 text-xs">Answered</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-red-500 dark:text-red-400 text-xl">{questions.length - answeredCount}</div>
                <div className="text-gray-500 dark:text-zinc-400 text-xs">Unanswered</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-600 dark:text-purple-400 text-xl">{markedCount}</div>
                <div className="text-gray-500 dark:text-zinc-400 text-xs">Marked for Review</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-600 dark:text-zinc-300 text-xl">{formatTime(totalSeconds - timeLeft)}</div>
                <div className="text-gray-500 dark:text-zinc-400 text-xs">Time Taken</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="flex-1 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                Continue Exam
              </button>
              <button onClick={handleSubmit} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg text-sm">
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
