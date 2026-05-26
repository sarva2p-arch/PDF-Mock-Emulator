import { useState } from "react";
import type { ExamQuestion } from "./Exam";

interface ResultsProps {
  candidateName: string;
  rollNumber: string;
  examTitle: string;
  questions: ExamQuestion[];
  answers: (number | null)[];
  timeTaken: number;
  onRetake: () => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  "Nursing Aptitude": { bg: "bg-pink-50 dark:bg-pink-900/30", text: "text-pink-800 dark:text-pink-300", border: "border-pink-200 dark:border-pink-700", bar: "bg-pink-500" },
  Biology: { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", border: "border-green-200 dark:border-green-700", bar: "bg-green-500" },
  Physics: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", border: "border-blue-200 dark:border-blue-700", bar: "bg-blue-500" },
  Chemistry: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", border: "border-amber-200 dark:border-amber-700", bar: "bg-amber-500" },
  English: { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", border: "border-purple-200 dark:border-purple-700", bar: "bg-purple-500" },
  Mathematics: { bg: "bg-cyan-50 dark:bg-cyan-900/30", text: "text-cyan-800 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-700", bar: "bg-cyan-500" },
  "General Knowledge": { bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", border: "border-orange-200 dark:border-orange-700", bar: "bg-orange-500" },
};

function getSubjectColor(subj: string) {
  return SUBJECT_COLORS[subj] ?? { bg: "bg-gray-50 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-600", bar: "bg-gray-400" };
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function Results({ candidateName, rollNumber, examTitle, questions, answers, timeTaken, onRetake, isDark, onToggleDark }: ResultsProps) {
  const [showSolutions, setShowSolutions] = useState<string | null>(null);

  let correct = 0, wrong = 0, unattempted = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === null) unattempted++;
    else if (answers[i] === questions[i].correctAnswer) correct++;
    else wrong++;
  }

  const totalMarks = questions.length;
  const percentage = Math.round((correct / totalMarks) * 100);

  const subjectMap = new Map<string, { correct: number; wrong: number; unattempted: number; total: number }>();
  questions.forEach((q, i) => {
    if (!subjectMap.has(q.subject)) subjectMap.set(q.subject, { correct: 0, wrong: 0, unattempted: 0, total: 0 });
    const s = subjectMap.get(q.subject)!;
    s.total++;
    if (answers[i] === null) s.unattempted++;
    else if (answers[i] === q.correctAnswer) s.correct++;
    else s.wrong++;
  });
  const subjects = Array.from(subjectMap.entries());

  const circleRadius = 60;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const progressOffset = circleCircumference - (percentage / 100) * circleCircumference;

  const getGrade = () => {
    if (percentage >= 90) return { grade: "A+", label: "Outstanding", color: "text-green-600 dark:text-green-400" };
    if (percentage >= 80) return { grade: "A", label: "Excellent", color: "text-green-500 dark:text-green-400" };
    if (percentage >= 70) return { grade: "B+", label: "Very Good", color: "text-blue-600 dark:text-blue-400" };
    if (percentage >= 60) return { grade: "B", label: "Good", color: "text-blue-500 dark:text-blue-400" };
    if (percentage >= 50) return { grade: "C", label: "Average", color: "text-amber-600 dark:text-amber-400" };
    return { grade: "D", label: "Needs Improvement", color: "text-red-600 dark:text-red-400" };
  };
  const { grade, label, color } = getGrade();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-blue-800 text-white rounded-xl p-5 mb-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-blue-300 text-xs uppercase tracking-wide">Exam Completed</div>
              <h1 className="text-xl font-bold">{examTitle}</h1>
              <div className="text-blue-300 text-sm">{candidateName} | Roll: {rollNumber}</div>
            </div>
            <div className="flex items-center gap-3">
              {onToggleDark && (
                <button
                  onClick={onToggleDark}
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
              )}
              <button onClick={onRetake} className="bg-white text-blue-800 font-semibold px-5 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors shadow">
                New Test
              </button>
            </div>
          </div>
        </div>

        {/* Score overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center">
            <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
              <circle cx="80" cy="80" r={circleRadius} fill="none" stroke="#e5e7eb" strokeWidth="12" className="dark:stroke-gray-700" />
              <circle
                cx="80" cy="80" r={circleRadius} fill="none"
                stroke={percentage >= 60 ? "#16a34a" : percentage >= 40 ? "#d97706" : "#dc2626"}
                strokeWidth="12"
                strokeDasharray={circleCircumference}
                strokeDashoffset={progressOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center -mt-24 mb-12">
              <div className="text-3xl font-black text-gray-800 dark:text-gray-100">{correct}</div>
              <div className="text-gray-400 dark:text-gray-500 text-xs">out of {totalMarks}</div>
              <div className={`text-lg font-bold mt-1 ${color}`}>{percentage}%</div>
            </div>
            <div className={`text-center font-bold ${color}`}>
              <div className="text-2xl">{grade}</div>
              <div className="text-sm">{label}</div>
            </div>
          </div>

          <div className="sm:col-span-2 grid grid-cols-2 gap-3">
            {[
              { value: correct, label: "Correct Answers", color: "text-green-600 dark:text-green-400", bar: "bg-green-500" },
              { value: wrong, label: "Wrong Answers", color: "text-red-500 dark:text-red-400", bar: "bg-red-500" },
              { value: unattempted, label: "Unattempted", color: "text-gray-400 dark:text-gray-500", bar: "bg-gray-300" },
            ].map((item) => (
              <div key={item.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center justify-center">
                <div className={`text-3xl font-black ${item.color}`}>{item.value}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">{item.label}</div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                  <div className={`${item.bar} h-1.5 rounded-full`} style={{ width: `${(item.value / totalMarks) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center justify-center">
              <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{formatTime(timeTaken)}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">Time Taken</div>
            </div>
          </div>
        </div>

        {/* Subject-wise breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-bold text-gray-800 dark:text-gray-100">Subject-wise Performance</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {subjects.map(([subj, s]) => {
              const c = getSubjectColor(subj);
              const pct = Math.round((s.correct / s.total) * 100);
              return (
                <div key={subj} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>{subj}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-600 dark:text-green-400 font-semibold">{s.correct} correct</span>
                      <span className="text-red-500 dark:text-red-400 font-semibold">{s.wrong} wrong</span>
                      <span className="text-gray-400 dark:text-gray-500">{s.unattempted} skipped</span>
                      <span className="font-bold text-gray-700 dark:text-gray-200">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className={`${c.bar} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Solutions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-bold text-gray-800 dark:text-gray-100">Review Answers & Solutions</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Click a subject to see all questions with correct answers</p>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {subjects.map(([subj]) => {
              const c = getSubjectColor(subj);
              const isActive = showSolutions === subj;
              return (
                <button
                  key={subj}
                  onClick={() => setShowSolutions(isActive ? null : subj)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive ? `${c.bar} text-white border-transparent` : `${c.bg} ${c.text} ${c.border}`}`}
                >
                  {subj}
                </button>
              );
            })}
          </div>

          {showSolutions && (
            <div className="border-t border-gray-100 dark:border-gray-700">
              {questions
                .map((q, globalIdx) => ({ q, globalIdx }))
                .filter(({ q }) => q.subject === showSolutions)
                .map(({ q, globalIdx }) => {
                  const userAnswer = answers[globalIdx];
                  const isCorrect = userAnswer === q.correctAnswer;
                  const isSkipped = userAnswer === null;
                  const hasKey = q.correctAnswer >= 0;
                  return (
                    <div key={q.id} className={`p-4 border-b border-gray-50 dark:border-gray-700 ${isCorrect ? "bg-green-50/40 dark:bg-green-900/10" : isSkipped ? "bg-gray-50/60 dark:bg-gray-900/30" : "bg-red-50/40 dark:bg-red-900/10"}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${isCorrect ? "bg-green-500 text-white" : isSkipped ? "bg-gray-300 text-gray-600" : "bg-red-500 text-white"}`}>
                          {isCorrect ? "✓" : isSkipped ? "–" : "✗"}
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-800 dark:text-gray-100 text-sm font-medium mb-2">Q{globalIdx + 1}. {q.question}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                                  hasKey && oIdx === q.correctAnswer
                                    ? "bg-green-100 dark:bg-green-900/50 border-green-400 dark:border-green-700 text-green-800 dark:text-green-300 font-semibold"
                                    : oIdx === userAnswer && userAnswer !== q.correctAnswer
                                    ? "bg-red-100 dark:bg-red-900/50 border-red-400 dark:border-red-700 text-red-800 dark:text-red-300"
                                    : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}. {opt}
                                {hasKey && oIdx === q.correctAnswer && <span className="ml-1 text-green-600 dark:text-green-400">✓</span>}
                                {oIdx === userAnswer && userAnswer !== q.correctAnswer && <span className="ml-1 text-red-600 dark:text-red-400">✗</span>}
                              </div>
                            ))}
                          </div>
                          {!hasKey && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Answer key not found in PDF</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <button onClick={onRetake} className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm">
            Start New Test
          </button>
        </div>
      </div>
    </div>
  );
}
