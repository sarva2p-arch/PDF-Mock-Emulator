import { useState, useRef, useCallback } from "react";
import { friendlyExtractionError } from "@/lib/extractionErrors";
import { downloadSavedTest } from "@/lib/savedTests";
import { extractStructuredTextFromPdf } from "@/lib/pdfText";
import BetaBadge from "@/components/BetaBadge";

export interface ExtractedQuestion {
  id: number;
  subject: string;
  questionType?: "mcq" | "integer";
  question: string;
  options: string[];
  correctAnswer: number;
  numericAnswer?: string;
}

export type PdfUploadMode = "questions-only" | "with-answers";

interface PdfUploadProps {
  mode: PdfUploadMode;
  onQuestionsReady: (questions: ExtractedQuestion[], examTitle: string) => void;
  onBack: () => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

type Stage = "idle" | "reading" | "extracting" | "preview" | "error";

export default function PdfUpload({ mode, onQuestionsReady, onBack, isDark, onToggleDark }: PdfUploadProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [fileName, setFileName] = useState("");
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [examTitle, setExamTitle] = useState("Mock Test");
  const [answersFound, setAnswersFound] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWithAnswers = mode === "with-answers";

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      setStage("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File is too large. Maximum size is 20MB.");
      setStage("error");
      return;
    }

    setFileName(file.name);
    setError("");

    try {
      setStage("reading");
      setProgress("Opening PDF...");
      const text = await extractStructuredTextFromPdf(file, (pageNum, totalPages) => {
        setProgress(`Reading page ${pageNum} of ${totalPages}...`);
      });

      if (text.trim().length < 50) {
        setError("Could not extract text from this PDF. It may be a scanned/image-only PDF.");
        setStage("error");
        return;
      }

      setStage("extracting");
      setProgress(
        isWithAnswers
          ? "AI is reading questions and matching answer key..."
          : "AI is reading and extracting questions..."
      );

      const formData = new FormData();
      formData.append("text", text);
      formData.append("mode", mode);
      const preferred = localStorage.getItem("dhanusha_preferred_ai_provider");
      if (preferred) formData.append("preferredProvider", preferred);

      const response = await fetch("/api/extract-questions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error || "Failed to extract questions");
      }

      const data = await response.json() as {
        examTitle: string;
        totalExtracted: number;
        answersFound?: number;
        questions: ExtractedQuestion[];
      };

      if (!data.questions || data.questions.length === 0) {
        setError("No questions could be found in this PDF. Make sure it contains MCQ questions.");
        setStage("error");
        return;
      }

      setQuestions(data.questions);
      setExamTitle(data.examTitle || "Mock Test");
      setAnswersFound(data.answersFound ?? data.questions.filter((q) => q.correctAnswer !== -1 || q.numericAnswer).length);
      setStage("preview");
    } catch (err) {
      setError(friendlyExtractionError(err instanceof Error ? err.message : "Something went wrong"));
      setStage("error");
    }
  }, [mode, isWithAnswers]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const subjectCounts = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.subject] = (acc[q.subject] || 0) + 1;
    return acc;
  }, {});

  const subjectColors: Record<string, string> = {
    "Nursing Aptitude": "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/40 dark:text-pink-300 dark:border-pink-700",
    Biology: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
    Physics: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-950/40 dark:text-zinc-400 dark:border-zinc-700",
    Chemistry: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
    English: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700",
    Mathematics: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700",
    "General Knowledge": "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-900/40 dark:text-zinc-300 dark:border-zinc-700",
    Other: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
  };
  const getSubjectColor = (subj: string) =>
    subjectColors[subj] ?? "bg-gray-100 text-gray-700 border-gray-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700";

  const headerBg = isWithAnswers ? "bg-zinc-950" : "bg-zinc-950";
  const headerText = isWithAnswers ? "text-zinc-300" : "text-zinc-300";
  const btnBg = isWithAnswers
    ? "bg-zinc-950 hover:bg-black"
    : "bg-zinc-950 hover:bg-black";
  const accentBorder = isWithAnswers ? "border-zinc-800" : "border-zinc-800";
  const accentHoverBorder = isWithAnswers ? "hover:border-zinc-500" : "hover:border-zinc-500";
  const accentHoverBg = isWithAnswers ? "hover:bg-zinc-50/40 dark:hover:bg-zinc-900/20" : "hover:bg-zinc-50/40 dark:hover:bg-zinc-950/20";
  const spinColor = isWithAnswers ? "border-zinc-700" : "border-zinc-700";
  const spinBg = isWithAnswers ? "border-zinc-200 dark:border-zinc-900" : "border-zinc-200 dark:border-zinc-900";
  const iconColor = isWithAnswers ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-700 dark:text-zinc-300";
  const tipBg = isWithAnswers
    ? "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
    : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800";
  const tipTitle = isWithAnswers ? "text-zinc-900 dark:text-zinc-300" : "text-zinc-900 dark:text-zinc-400";
  const tipText = "text-gray-600 dark:text-zinc-300";

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className={`${headerBg} text-white rounded-t-xl p-5 text-center shadow-lg relative`}>
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors text-white"
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
          <div className={`${headerText} text-xs uppercase tracking-wider mb-1`}>Sarva Build</div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold">
              {isWithAnswers ? "Upload PDF with Answer Key" : "Upload Question Paper PDF"}
            </h1>
            <BetaBadge />
          </div>
          <p className={`${headerText} text-sm mt-1`}>
            {isWithAnswers
              ? "AI will extract questions and match the answer key for accurate results"
              : "AI will extract all MCQ questions automatically"}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 rounded-b-xl shadow-lg p-6 space-y-5">

          {(stage === "idle" || stage === "error") && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  isDragging
                    ? `${accentBorder} bg-zinc-50 dark:bg-zinc-950/20`
                    : `border-gray-300 dark:border-zinc-700 ${accentHoverBorder} ${accentHoverBg}`
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isDragging ? "bg-zinc-100 dark:bg-zinc-950" : "bg-gray-100 dark:bg-zinc-900"}`}>
                    {isWithAnswers ? (
                      <svg className={`w-7 h-7 ${isDragging ? iconColor : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className={`w-7 h-7 ${isDragging ? "text-zinc-700 dark:text-zinc-300" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 dark:text-zinc-200">Drag & drop your PDF here</p>
                    <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">or click to browse — max 20MB</p>
                  </div>
                  <span className={`${btnBg} text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors`}>
                    Choose PDF File
                  </span>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </div>

              {stage === "error" && (
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Extraction Failed</p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-0.5">{error}</p>
                    <p className="text-red-500 dark:text-red-500 text-xs mt-1">Tip: after one successful extraction, download the saved test file so you can reuse it without AI quota.</p>
                  </div>
                </div>
              )}

              <div className={`${tipBg} border rounded-lg p-4 text-sm ${tipText} space-y-1.5`}>
                <p className={`font-semibold ${tipTitle} text-xs uppercase tracking-wide mb-2`}>
                  Tips for best results
                </p>
                <p>• PDF must have selectable text (not a scanned image)</p>
                <p>• Works best with standard MCQ format (A, B, C, D options)</p>
                {isWithAnswers ? (
                  <>
                    <p>• Answer key can be anywhere — end of PDF, separate section, or inline</p>
                    <p>• Formats like "1-B, 2-A", "1.(b)", or answer tables are all supported</p>
                    <p>• AI carefully matches each question number to its answer letter</p>
                    <p>• Bilingual (Hindi + English) papers are fully supported</p>
                  </>
                ) : (
                  <>
                    <p>• Bilingual (Hindi + English) papers are supported</p>
                    <p>• Supports exam, practice set, nursing, medical, and entrance papers</p>
                    <p>• Answer keys embedded in the PDF will also be detected if present</p>
                  </>
                )}
              </div>
            </>
          )}

          {(stage === "reading" || stage === "extracting") && (
            <div className="py-8 flex flex-col items-center gap-5">
              <div className="relative">
                <div className={`w-20 h-20 rounded-full border-4 ${spinBg}`} />
                <div className={`w-20 h-20 rounded-full border-4 ${spinColor} border-t-transparent animate-spin absolute inset-0`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  {stage === "reading" ? (
                    <svg className={`w-8 h-8 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className={`w-8 h-8 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700 dark:text-zinc-200">
                  {stage === "reading"
                    ? "Reading PDF..."
                    : isWithAnswers
                    ? "AI Extracting Questions & Answer Key..."
                    : "AI Extracting Questions..."}
                </p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{progress}</p>
                {fileName && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{fileName}</p>}
              </div>
              {stage === "extracting" && (
                <div className={`${isWithAnswers ? "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300" : "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"} border rounded-lg px-4 py-2 text-xs text-center max-w-xs`}>
                  {isWithAnswers
                    ? "AI is reading questions and carefully matching each one with the answer key — this takes 15–25 seconds"
                    : "AI is carefully reading every question — this takes 10–20 seconds for accuracy"}
                </div>
              )}
            </div>
          )}

          {stage === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-bold text-gray-800 dark:text-zinc-100 text-lg">{questions.length} questions extracted!</p>
                  <p className="text-gray-500 dark:text-zinc-400 text-sm">from: {fileName}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1.5 rounded-full">
                    ✓ Ready to use
                  </div>
                  {isWithAnswers && (
                    <div className={`${answersFound === questions.length ? "bg-zinc-100 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300" : "bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"} text-xs font-bold px-3 py-1.5 rounded-full border`}>
                      {answersFound}/{questions.length} answers matched
                    </div>
                  )}
                </div>
              </div>

              {isWithAnswers && answersFound < questions.length && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
                  <span className="font-semibold">Note:</span> {questions.length - answersFound} question{questions.length - answersFound > 1 ? "s" : ""} could not be matched to the answer key. Those will show as unanswered in your results, but you can still attempt them.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1">Exam Title</label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
                />
              </div>

              <div className="bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Subject Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(subjectCounts).map(([subj, count]) => (
                    <span key={subj} className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSubjectColor(subj)}`}>
                      {subj}: {count}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Preview (first 3 questions)</p>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {questions.slice(0, 3).map((q) => (
                    <div key={q.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="whitespace-pre-line font-medium text-gray-800 dark:text-zinc-100">Q{q.id}. {q.question}</p>
                        {isWithAnswers && (
                          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${q.correctAnswer >= 0 || q.numericAnswer ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-zinc-800 text-gray-400"}`}>
                            {q.correctAnswer >= 0 ? `Ans: ${String.fromCharCode(65 + q.correctAnswer)}` : q.numericAnswer ? `Ans: ${q.numericAnswer}` : "No key"}
                          </span>
                        )}
                      </div>
                      {q.questionType === "integer" && (
                        <div className="text-xs px-2 py-1 rounded bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
                          Numerical answer question
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-1">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`text-xs px-2 py-1 rounded ${q.correctAnswer === i ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 font-semibold ring-1 ring-green-400 dark:ring-green-700" : "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300"}`}>
                            <span className="whitespace-pre-line">{String.fromCharCode(65 + i)}. {opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => { setStage("idle"); setQuestions([]); setAnswersFound(0); }}
                  className="flex-1 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Upload Different PDF
                </button>
                <button
                  onClick={() => downloadSavedTest(examTitle, questions)}
                  className="flex-1 border border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 font-semibold py-2.5 rounded-lg text-sm hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"
                >
                  Download Test File
                </button>
                <button
                  onClick={() => onQuestionsReady(questions, examTitle)}
                  className={`flex-1 ${btnBg} text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-sm`}
                >
                  Review &amp; Start
                </button>
              </div>
            </div>
          )}

          {stage !== "reading" && stage !== "extracting" && (
            <button
              onClick={onBack}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
            >
              ← Back to home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
