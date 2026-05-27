import { useMemo, useState } from "react";
import type { ExamQuestion } from "@/pages/Exam";
import BetaBadge from "@/components/BetaBadge";
import { downloadSavedTest } from "@/lib/savedTests";

interface ReviewExtractedTestProps {
  examTitle: string;
  questions: ExamQuestion[];
  onBack: () => void;
  onConfirm: (questions: ExamQuestion[], examTitle: string) => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

interface QuestionIssue {
  severity: "warning" | "error";
  message: string;
}

const emptyQuestion = (id: number): ExamQuestion => ({
  id,
  subject: "General",
  questionType: "mcq",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: -1,
  numericAnswer: "",
});

function isIntegerQuestion(question: ExamQuestion) {
  return question.questionType === "integer" || question.options.length === 0;
}

function normalizeQuestion(question: ExamQuestion, index: number): ExamQuestion {
  const integer = isIntegerQuestion(question);
  return {
    id: index + 1,
    subject: question.subject.trim() || "General",
    questionType: integer ? "integer" : "mcq",
    question: question.question.trim(),
    options: integer ? [] : [...question.options, "", "", "", ""].slice(0, 4).map((option) => option.trim()),
    correctAnswer: integer ? -1 : question.correctAnswer >= 0 && question.correctAnswer < 4 ? question.correctAnswer : -1,
    numericAnswer: integer ? (question.numericAnswer ?? "").trim() : "",
  };
}

function getIssues(question: ExamQuestion): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  const integer = isIntegerQuestion(question);

  if (!question.question.trim()) {
    issues.push({ severity: "error", message: "Question text is empty" });
  }

  if (!question.subject.trim()) {
    issues.push({ severity: "warning", message: "Subject is empty" });
  }

  if (integer) {
    if (!(question.numericAnswer ?? "").trim()) {
      issues.push({ severity: "warning", message: "Numerical answer is missing" });
    }
    return issues;
  }

  if (question.options.length !== 4) {
    issues.push({ severity: "error", message: "MCQ must have exactly 4 options" });
  }

  [...question.options, "", "", "", ""].slice(0, 4).forEach((option, index) => {
    if (!option.trim()) {
      issues.push({ severity: "error", message: `Option ${String.fromCharCode(65 + index)} is empty` });
    }
  });

  if (question.correctAnswer < 0) {
    issues.push({ severity: "warning", message: "Correct answer is not set" });
  } else if (question.correctAnswer > 3) {
    issues.push({ severity: "error", message: "Correct answer is invalid" });
  }

  return issues;
}

function summarizeIssues(questions: ExamQuestion[], expectedCount: number) {
  const perQuestion = questions.map(getIssues);
  const errorCount = perQuestion.reduce((sum, issues) => sum + issues.filter((issue) => issue.severity === "error").length, 0);
  const warningCount = perQuestion.reduce((sum, issues) => sum + issues.filter((issue) => issue.severity === "warning").length, 0);
  const needsReview = perQuestion.filter((issues) => issues.length > 0).length;
  const missingCount = Math.max(0, expectedCount - questions.length);

  return { perQuestion, errorCount, warningCount, needsReview, missingCount };
}

export default function ReviewExtractedTest({
  examTitle,
  questions,
  onBack,
  onConfirm,
  isDark,
  onToggleDark,
}: ReviewExtractedTestProps) {
  const [title, setTitle] = useState(examTitle || "Mock Test");
  const [items, setItems] = useState<ExamQuestion[]>(() => questions.map(normalizeQuestion));
  const [expectedCount, setExpectedCount] = useState(String(questions.length));
  const [expanded, setExpanded] = useState<number | null>(0);

  const normalized = useMemo(() => items.map(normalizeQuestion), [items]);
  const expected = Math.max(0, Number(expectedCount) || 0);
  const summary = useMemo(() => summarizeIssues(normalized, expected), [normalized, expected]);

  const updateQuestion = (index: number, updater: (question: ExamQuestion) => ExamQuestion) => {
    setItems((prev) => prev.map((question, i) => (i === index ? normalizeQuestion(updater(question), i) : question)));
  };

  const removeQuestion = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map(normalizeQuestion));
    setExpanded((current) => {
      if (current === index) return null;
      if (current !== null && current > index) return current - 1;
      return current;
    });
  };

  const addQuestion = () => {
    setItems((prev) => [...prev, emptyQuestion(prev.length + 1)].map(normalizeQuestion));
    setExpanded(items.length);
  };

  const confirmReview = () => {
    if (normalized.length === 0) {
      window.alert("Please keep at least one question before starting the test.");
      return;
    }

    const problemCount = summary.errorCount + summary.warningCount + summary.missingCount;
    if (problemCount > 0) {
      const ok = window.confirm(
        "Some questions still need review. You can continue, but results may be less accurate. Continue anyway?"
      );
      if (!ok) return;
    }

    onConfirm(normalized, title.trim() || "Mock Test");
  };

  const qualityColor =
    summary.errorCount > 0 || summary.missingCount > 0
      ? "border-red-500/40 bg-red-950/30 text-red-200"
      : summary.warningCount > 0
      ? "border-amber-500/40 bg-amber-950/30 text-amber-200"
      : "border-emerald-500/40 bg-emerald-950/30 text-emerald-200";

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-black p-4">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-white shadow-2xl dark:bg-zinc-950">
        <div className="relative border-b border-zinc-800 bg-black px-5 py-5 text-center text-white">
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="5" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          )}
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Sarva Build</div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">Review Extracted Test</h1>
            <BetaBadge />
          </div>
          <p className="mt-1 text-sm text-zinc-400">Check and fix questions before students attempt the exam</p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Exam Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Expected Count</label>
              <input
                type="number"
                min={0}
                value={expectedCount}
                onChange={(event) => setExpectedCount(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${qualityColor}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black">Extraction Quality Check</div>
                <div className="mt-1 text-xs opacity-80">
                  {normalized.length} extracted, {summary.needsReview} need review
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-black/25 px-3 py-1">{summary.errorCount} errors</span>
                <span className="rounded-full bg-black/25 px-3 py-1">{summary.warningCount} warnings</span>
                <span className="rounded-full bg-black/25 px-3 py-1">{summary.missingCount} possibly missing</span>
              </div>
            </div>
            {summary.missingCount > 0 && (
              <p className="mt-3 text-sm">
                Expected count is higher than extracted count. Check the PDF around the missing question numbers, then add them manually if needed.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={addQuestion}
              className="rounded-lg border border-cyan-500/50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
            >
              Add Question
            </button>
            <button
              onClick={() => downloadSavedTest(title, normalized)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Download Reviewed Test
            </button>
          </div>

          <div className="space-y-3">
            {normalized.map((question, index) => {
              const issues = summary.perQuestion[index] ?? [];
              const integer = isIntegerQuestion(question);
              const open = expanded === index;
              const hasError = issues.some((issue) => issue.severity === "error");
              const statusClass =
                issues.length === 0
                  ? "border-emerald-500/40"
                  : hasError
                  ? "border-red-500/50"
                  : "border-amber-500/50";

              return (
                <div key={`${question.id}-${index}`} className={`overflow-hidden rounded-xl border bg-white dark:bg-black ${statusClass}`}>
                  <button
                    onClick={() => setExpanded(open ? null : index)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-zinc-950 px-2 py-1 text-xs font-bold text-white">Q{index + 1}</span>
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{question.subject || "General"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${integer ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
                          {integer ? "Numerical" : "MCQ"}
                        </span>
                        {issues.length === 0 ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-300">Good</span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                            {issues.length} issue{issues.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm text-zinc-600 dark:text-zinc-400">{question.question || "Empty question text"}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-zinc-400">{open ? "Close" : "Edit"}</span>
                  </button>

                  {open && (
                    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                      {issues.length > 0 && (
                        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {issues.map((issue) => (
                            <div key={issue.message}>- {issue.message}</div>
                          ))}
                        </div>
                      )}

                      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Subject</label>
                          <input
                            value={question.subject}
                            onChange={(event) => updateQuestion(index, (q) => ({ ...q, subject: event.target.value }))}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Type</label>
                          <select
                            value={integer ? "integer" : "mcq"}
                            onChange={(event) => {
                              const nextType = event.target.value as "mcq" | "integer";
                              updateQuestion(index, (q) => ({
                                ...q,
                                questionType: nextType,
                                options: nextType === "integer" ? [] : [...q.options, "", "", "", ""].slice(0, 4),
                                correctAnswer: nextType === "integer" ? -1 : q.correctAnswer,
                              }));
                            }}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            <option value="mcq">MCQ</option>
                            <option value="integer">Numerical</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Question Text</label>
                        <textarea
                          value={question.question}
                          onChange={(event) => updateQuestion(index, (q) => ({ ...q, question: event.target.value }))}
                          rows={3}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>

                      {integer ? (
                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Correct Numerical Answer</label>
                          <input
                            value={question.numericAnswer ?? ""}
                            onChange={(event) => updateQuestion(index, (q) => ({ ...q, numericAnswer: event.target.value }))}
                            placeholder="Example: 42 or -3.5"
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          <div className="grid gap-2 md:grid-cols-2">
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex}>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                                  Option {String.fromCharCode(65 + optionIndex)}
                                </label>
                                <input
                                  value={option}
                                  onChange={(event) => updateQuestion(index, (q) => {
                                    const options = [...q.options, "", "", "", ""].slice(0, 4);
                                    options[optionIndex] = event.target.value;
                                    return { ...q, options };
                                  })}
                                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                              </div>
                            ))}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">Correct Answer</label>
                            <select
                              value={question.correctAnswer}
                              onChange={(event) => updateQuestion(index, (q) => ({ ...q, correctAnswer: Number(event.target.value) }))}
                              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              <option value={-1}>Unknown / not set</option>
                              <option value={0}>A</option>
                              <option value={1}>B</option>
                              <option value={2}>C</option>
                              <option value={3}>D</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => removeQuestion(index)}
                          className="rounded-lg border border-red-400/50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          Delete Question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-3 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black p-3 shadow-2xl sm:flex-row">
            <button
              onClick={onBack}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
            >
              Back to Home
            </button>
            <button
              onClick={confirmReview}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
            >
              Continue to Registration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
