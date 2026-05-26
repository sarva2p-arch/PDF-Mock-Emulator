import { useState, useEffect, useCallback } from "react";

type QuestionStatus = "not-visited" | "not-answered" | "answered" | "marked" | "marked-answered";

export interface ExamQuestion {
  id: number;
  subject: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface ExamProps {
  candidateName: string;
  rollNumber: string;
  duration: number;
  examTitle: string;
  questions: ExamQuestion[];
  onSubmit: (answers: (number | null)[], timeTaken: number) => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

const PALETTE_COLORS: Record<string, string> = {
  "Nursing Aptitude": "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-700",
  Biology: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  Physics: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
  Chemistry: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700",
  English: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700",
  Mathematics: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700",
  "General Knowledge": "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700",
};

const PALETTE_ACTIVE: Record<string, string> = {
  "Nursing Aptitude": "bg-pink-600 text-white",
  Biology: "bg-green-600 text-white",
  Physics: "bg-blue-600 text-white",
  Chemistry: "bg-amber-600 text-white",
  English: "bg-purple-600 text-white",
  Mathematics: "bg-cyan-600 text-white",
  "General Knowledge": "bg-orange-600 text-white",
};

function getColor(subject: string) {
  return PALETTE_COLORS[subject] ?? "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
}
function getActiveColor(subject: string) {
  return PALETTE_ACTIVE[subject] ?? "bg-gray-600 text-white";
}

function getQuestionStatus(
  qIndex: number,
  answers: (number | null)[],
  marked: boolean[],
  visited: boolean[]
): QuestionStatus {
  if (!visited[qIndex]) return "not-visited";
  if (marked[qIndex] && answers[qIndex] !== null) return "marked-answered";
  if (marked[qIndex]) return "marked";
  if (answers[qIndex] !== null) return "answered";
  return "not-answered";
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
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [marked, setMarked] = useState<boolean[]>(Array(questions.length).fill(false));
  const [visited, setVisited] = useState<boolean[]>(() => {
    const v = Array(questions.length).fill(false);
    v[0] = true;
    return v;
  });
  const [activeSubject, setActiveSubject] = useState<string>(questions[0]?.subject ?? "");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    setSelectedOption(answers[currentIndex]);
  }, [currentIndex, answers]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onSubmit(answers, totalSeconds);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSubmit(answers, totalSeconds);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    newAnswers[currentIndex] = selectedOption;
    setAnswers(newAnswers);
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleClearResponse = () => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = null;
    setAnswers(newAnswers);
    setSelectedOption(null);
  };

  const handleMarkForReview = () => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = selectedOption;
    setAnswers(newAnswers);
    const newMarked = [...marked];
    newMarked[currentIndex] = !newMarked[currentIndex];
    setMarked(newMarked);
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleSubmit = () => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = selectedOption;
    onSubmit(newAnswers, totalSeconds - timeLeft);
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const markedCount = marked.filter(Boolean).length;
  const notAnsweredCount = visited.filter((v, i) => v && answers[i] === null && !marked[i]).length;
  const notVisitedCount = visited.filter((v) => !v).length;
  const currentQuestion = questions[currentIndex];
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col" style={{ fontSize: 14 }}>
      {/* Top bar */}
      <div className="bg-blue-800 text-white px-4 py-2 flex items-center justify-between shadow-md">
        <div>
          <div className="font-bold text-base">{examTitle}</div>
          <div className="text-blue-300 text-xs">{candidateName} | Roll: {rollNumber}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 font-mono font-bold text-lg bg-blue-900 px-4 py-1.5 rounded-lg ${isWarning ? "timer-warning" : ""}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
            </svg>
            {formatTime(timeLeft)}
          </div>
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors"
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
          <button onClick={() => setShowSubmitModal(true)} className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
            Submit Exam
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Subject tabs */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex gap-2 flex-wrap">
            {uniqueSubjects.map((subj) => {
              const group = subjectGroups.find((g) => g.subject === subj)!;
              const subjAnswered = group.indices.filter((i) => answers[i] !== null).length;
              return (
                <button
                  key={subj}
                  onClick={() => { setActiveSubject(subj); goToQuestion(group.indices[0]); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${activeSubject === subj ? getActiveColor(subj) : getColor(subj)}`}
                >
                  {subj} ({subjAnswered}/{group.indices.length})
                </button>
              );
            })}
          </div>

          {/* Question card */}
          <div className="flex-1 p-4 md:p-6 max-w-3xl mx-auto w-full">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-700 text-white text-xs font-bold px-2.5 py-1 rounded-md">
                    Q. {currentIndex + 1} of {questions.length}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getColor(currentQuestion.subject)}`}>
                    {currentQuestion.subject}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-medium">+1 Mark</span>
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-medium">No Negative</span>
                </div>
              </div>

              <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-700">
                <p className="text-gray-800 dark:text-gray-100 font-medium leading-relaxed text-base">{currentQuestion.question}</p>
              </div>

              <div className="px-5 py-4 space-y-3">
                {currentQuestion.options.map((option, optIdx) => (
                  <label
                    key={optIdx}
                    className={`flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedOption === optIdx
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentIndex}`}
                      checked={selectedOption === optIdx}
                      onChange={() => setSelectedOption(optIdx)}
                      className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
                    />
                    <span className="flex items-start gap-2 text-gray-800 dark:text-gray-200">
                      <span className={`font-bold shrink-0 ${selectedOption === optIdx ? "text-blue-600" : "text-gray-500 dark:text-gray-400"}`}>
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <span>{option}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMarkForReview}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      marked[currentIndex] ? "bg-purple-600 text-white border-purple-600" : "border-purple-400 text-purple-700 dark:text-purple-400 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    }`}
                  >
                    {marked[currentIndex] ? "Unmark Review" : "Mark for Review & Next"}
                  </button>
                  <button onClick={handleClearResponse} className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                    Clear Response
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button onClick={handleSaveAndNext} className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    Save & Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shrink-0">
          <div className="bg-blue-800 text-white p-3 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm mx-auto mb-1">
              {candidateName.charAt(0)}
            </div>
            <div className="font-semibold text-sm truncate">{candidateName}</div>
            <div className="text-blue-300 text-xs">{rollNumber}</div>
          </div>

          <div className="grid grid-cols-2 gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="text-center bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded p-1.5">
              <div className="font-bold text-green-700 dark:text-green-400 text-base">{answeredCount}</div>
              <div className="text-xs text-green-600 dark:text-green-500">Answered</div>
            </div>
            <div className="text-center bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-1.5">
              <div className="font-bold text-red-600 dark:text-red-400 text-base">{notAnsweredCount}</div>
              <div className="text-xs text-red-500 dark:text-red-400">Not Answered</div>
            </div>
            <div className="text-center bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1.5">
              <div className="font-bold text-gray-600 dark:text-gray-300 text-base">{notVisitedCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Not Visited</div>
            </div>
            <div className="text-center bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded p-1.5">
              <div className="font-bold text-purple-700 dark:text-purple-400 text-base">{markedCount}</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Marked</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {subjectGroups.map(({ subject, indices }) => (
              <div key={subject} className="mb-3">
                <div className={`text-xs font-bold px-2 py-1 rounded mb-1.5 border ${getColor(subject)}`}>
                  {subject}
                </div>
                <div className="grid grid-cols-6 gap-1">
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

          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setShowSubmitModal(true)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
              Submit Exam
            </button>
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Confirm Submission</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">Are you sure you want to submit? You cannot change answers after submission.</p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
              <div className="text-center">
                <div className="font-bold text-green-600 dark:text-green-400 text-xl">{answeredCount}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">Answered</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-red-500 dark:text-red-400 text-xl">{questions.length - answeredCount}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">Unanswered</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-600 dark:text-purple-400 text-xl">{markedCount}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">Marked for Review</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-600 dark:text-gray-300 text-xl">{formatTime(totalSeconds - timeLeft)}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">Time Taken</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
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
