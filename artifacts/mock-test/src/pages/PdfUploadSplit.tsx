import { useState, useRef } from "react";
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

interface PdfUploadSplitProps {
  onQuestionsReady: (questions: ExtractedQuestion[], examTitle: string) => void;
  onBack: () => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

type Stage = "idle" | "reading" | "extracting" | "preview" | "error";

interface FileState {
  file: File | null;
  name: string;
  text: string;
  ready: boolean;
}

const emptyFile = (): FileState => ({ file: null, name: "", text: "", ready: false });

export default function PdfUploadSplit({ onQuestionsReady, onBack, isDark, onToggleDark }: PdfUploadSplitProps) {
  const [questionPdf, setQuestionPdf] = useState<FileState>(emptyFile());
  const [answerPdf, setAnswerPdf] = useState<FileState>(emptyFile());
  const [setNumber, setSetNumber] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [answersMatched, setAnswersMatched] = useState(0);
  const [setFound, setSetFound] = useState("");

  const [qDragging, setQDragging] = useState(false);
  const [aDragging, setADragging] = useState(false);

  const qInputRef = useRef<HTMLInputElement>(null);
  const aInputRef = useRef<HTMLInputElement>(null);

  const handleQuestionFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Question paper must be a PDF."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Question paper PDF too large (max 20MB)."); return; }
    setError("");
    setStage("reading");
    setProgress("Reading question paper...");
    try {
      const text = await extractStructuredTextFromPdf(file, (p, t) => setProgress(`Reading question paper: page ${p} of ${t}...`));
      if (text.trim().length < 50) { setError("Could not extract text from question paper PDF. It may be image-based."); setStage("error"); return; }
      setQuestionPdf({ file, name: file.name, text, ready: true });
      setStage("idle");
      setProgress("");
    } catch {
      setError("Failed to read question paper PDF."); setStage("error");
    }
  };

  const handleAnswerFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Answer key must be a PDF."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Answer key PDF too large (max 20MB)."); return; }
    setError("");
    setStage("reading");
    setProgress("Reading answer key...");
    try {
      const text = await extractStructuredTextFromPdf(file, (p, t) => setProgress(`Reading answer key: page ${p} of ${t}...`));
      if (text.trim().length < 10) { setError("Could not extract text from answer key PDF. It may be image-based."); setStage("error"); return; }
      setAnswerPdf({ file, name: file.name, text, ready: true });
      setStage("idle");
      setProgress("");
    } catch {
      setError("Failed to read answer key PDF."); setStage("error");
    }
  };

  const handleProcess = async () => {
    if (!questionPdf.ready || !answerPdf.ready) return;
    setError("");
    setStage("extracting");
    setProgress("AI is extracting questions and matching answers simultaneously...");

    try {
      const formData = new FormData();
      formData.append("questionText", questionPdf.text);
      formData.append("answerKeyText", answerPdf.text);
      if (setNumber.trim()) formData.append("setNumber", setNumber.trim());
      const preferred = localStorage.getItem("dhanusha_preferred_ai_provider");
      if (preferred) formData.append("preferredProvider", preferred);

      const response = await fetch("/api/extract-split", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error || "Server error");
      }

      const data = await response.json() as {
        examTitle: string;
        setFound: string;
        totalExtracted: number;
        answersMatched: number;
        questions: ExtractedQuestion[];
      };

      if (!data.questions || data.questions.length === 0) {
        setError("No questions found in the question paper PDF. Make sure it contains MCQ questions."); setStage("error"); return;
      }

      setQuestions(data.questions);
      setExamTitle(data.examTitle || "Mock Test");
      setAnswersMatched(data.answersMatched);
      setSetFound(data.setFound || "");
      setStage("preview");
    } catch (err) {
      setError(friendlyExtractionError(err instanceof Error ? err.message : "Something went wrong.")); setStage("error");
    }
  };

  const reset = () => {
    setQuestionPdf(emptyFile()); setAnswerPdf(emptyFile());
    setSetNumber(""); setStage("idle"); setProgress(""); setError("");
    setQuestions([]); setExamTitle(""); setAnswersMatched(0); setSetFound("");
  };

  const subjectCounts = questions.reduce<Record<string, number>>((acc, q) => { acc[q.subject] = (acc[q.subject] || 0) + 1; return acc; }, {});
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
  const getColor = (s: string) => subjectColors[s] ?? "bg-gray-100 text-gray-700 border-gray-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700";

  const bothReady = questionPdf.ready && answerPdf.ready;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-zinc-950 text-white rounded-t-xl p-5 text-center shadow-lg relative">
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
          <div className="text-zinc-300 text-xs uppercase tracking-wider mb-1">Sarva Build</div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold">Upload Questions + Separate Answer Key</h1>
            <BetaBadge />
          </div>
          <p className="text-zinc-300 text-sm mt-1">Upload your question set PDF and the combined answer key PDF — AI matches them perfectly</p>
        </div>

        <div className="bg-white dark:bg-zinc-950 rounded-b-xl shadow-lg p-6 space-y-5">

          {(stage === "reading" || stage === "extracting") && (
            <div className="py-8 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-zinc-200 dark:border-zinc-900" />
                <div className="w-20 h-20 rounded-full border-4 border-zinc-800 border-t-transparent animate-spin absolute inset-0" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {stage === "reading" ? (
                    <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700 dark:text-zinc-200">
                  {stage === "reading" ? "Reading PDF..." : "AI Processing Both PDFs..."}
                </p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{progress}</p>
              </div>
              {stage === "extracting" && (
                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-800 dark:text-zinc-300 text-center max-w-sm">
                  AI is extracting questions from your question paper AND reading the answer key — then matching each question to its correct answer. This takes 20–30 seconds.
                </div>
              )}
            </div>
          )}

          {stage !== "reading" && stage !== "extracting" && (
            <>
              {(stage === "error" || error) && error && (
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Extraction Failed</p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-0.5">{error}</p>
                    <p className="text-red-500 dark:text-red-500 text-xs mt-1">Tip: export a successful test once, then import it from the homepage next time with zero AI quota.</p>
                  </div>
                </div>
              )}

              {stage === "preview" ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-zinc-100 text-lg">{questions.length} questions extracted!</p>
                      <p className="text-gray-500 dark:text-zinc-400 text-sm">from: {questionPdf.name}</p>
                      {setFound && <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium mt-0.5">Answer key used: {setFound}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 items-end">
                      <div className="bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1.5 rounded-full">
                        ✓ Ready to use
                      </div>
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${answersMatched === questions.length ? "bg-zinc-100 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300" : answersMatched > 0 ? "bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400" : "bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"}`}>
                        {answersMatched}/{questions.length} answers matched
                      </div>
                    </div>
                  </div>

                  {answersMatched < questions.length && (
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
                      <span className="font-semibold">Note:</span> {questions.length - answersMatched} question{questions.length - answersMatched > 1 ? "s" : ""} could not be matched to the answer key. Check that you selected the correct set number, or try again.
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
                        <span key={subj} className={`px-3 py-1 rounded-full text-xs font-semibold border ${getColor(subj)}`}>
                          {subj}: {count}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Preview (first 3 questions)</p>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {questions.slice(0, 3).map((q) => (
                        <div key={q.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 text-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="whitespace-pre-line font-medium text-gray-800 dark:text-zinc-100">Q{q.id}. {q.question}</p>
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${q.correctAnswer >= 0 || q.numericAnswer ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-zinc-800 text-gray-400"}`}>
                              {q.correctAnswer >= 0 ? `Ans: ${String.fromCharCode(65 + q.correctAnswer)}` : q.numericAnswer ? `Ans: ${q.numericAnswer}` : "No key"}
                            </span>
                          </div>
                          {q.questionType === "integer" && (
                            <div className="mb-2 text-xs px-2 py-1 rounded bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
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

                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button onClick={reset} className="flex-1 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      Upload Different PDFs
                    </button>
                    <button
                      onClick={() => downloadSavedTest(examTitle, questions)}
                      className="flex-1 border border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 font-semibold py-2.5 rounded-lg text-sm hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"
                    >
                      Download Test File
                    </button>
                    <button
                      onClick={() => onQuestionsReady(questions, examTitle)}
                      className="flex-1 bg-zinc-950 hover:bg-black text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-sm"
                    >
                      Review &amp; Start
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-sm text-gray-600 dark:text-zinc-300 space-y-1.5">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-300 text-xs uppercase tracking-wide mb-2">How this works</p>
                    <p>• Upload your <strong>question set PDF</strong> (one of your 6 sets) and the <strong>combined answer key PDF</strong></p>
                    <p>• Optionally enter the <strong>set number</strong> so AI picks the right answers from the combined key</p>
                    <p>• AI extracts questions and matches them with the correct set answers from the key PDF</p>
                    <p>• Attempt the test and see your full score, correct vs wrong — just like a real result</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-zinc-950 text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
                        Question Paper PDF
                      </p>
                      {questionPdf.ready ? (
                        <div className="border-2 border-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-xs font-semibold text-green-700 dark:text-green-400 truncate max-w-full px-2">{questionPdf.name}</p>
                          <button onClick={() => setQuestionPdf(emptyFile())} className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors">
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setQDragging(true); }}
                          onDragLeave={() => setQDragging(false)}
                          onDrop={(e) => { e.preventDefault(); setQDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleQuestionFile(f); }}
                          onClick={() => qInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${qDragging ? "border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20" : "border-gray-300 dark:border-zinc-700 hover:border-zinc-500 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10"}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-xs font-medium text-gray-600 dark:text-zinc-300">Drop question paper here</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">or click to browse</p>
                          <span className="mt-2 inline-block bg-zinc-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Choose PDF</span>
                          <input ref={qInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQuestionFile(f); }} />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-zinc-950 text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
                        Answer Key PDF
                      </p>
                      {answerPdf.ready ? (
                        <div className="border-2 border-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-xs font-semibold text-green-700 dark:text-green-400 truncate max-w-full px-2">{answerPdf.name}</p>
                          <button onClick={() => setAnswerPdf(emptyFile())} className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors">
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setADragging(true); }}
                          onDragLeave={() => setADragging(false)}
                          onDrop={(e) => { e.preventDefault(); setADragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleAnswerFile(f); }}
                          onClick={() => aInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${aDragging ? "border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20" : "border-gray-300 dark:border-zinc-700 hover:border-zinc-500 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10"}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-xs font-medium text-gray-600 dark:text-zinc-300">Drop answer key here</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">or click to browse</p>
                          <span className="mt-2 inline-block bg-zinc-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Choose PDF</span>
                          <input ref={aInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAnswerFile(f); }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1">
                      Set Number <span className="text-gray-400 font-normal">(optional — which set are these questions?)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={setNumber}
                        onChange={(e) => setSetNumber(e.target.value)}
                        placeholder="e.g. 1, 2, 3, Set 1..."
                        className="w-44 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
                      />
                      <span className="text-xs text-gray-500 dark:text-zinc-400">If your answer key has answers for all 6 sets, enter the set number so AI picks the right ones</span>
                    </div>
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={!bothReady}
                    className={`w-full font-semibold py-3 rounded-lg text-sm transition-all shadow-sm ${bothReady ? "bg-zinc-950 hover:bg-black text-white cursor-pointer" : "bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-500 cursor-not-allowed"}`}
                  >
                    {bothReady
                      ? "Extract Questions & Match Answers →"
                      : `Waiting for ${!questionPdf.ready && !answerPdf.ready ? "both PDFs" : !questionPdf.ready ? "question paper PDF" : "answer key PDF"}`}
                  </button>

                  <div className="bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-3 text-xs text-gray-500 dark:text-zinc-400 space-y-1">
                    <p>• Both PDFs must have selectable text (not scanned images)</p>
                    <p>• Works with any format: "1-B 2-A 3-C", "1.(b) 2.(a)", answer tables, etc.</p>
                    <p>• Bilingual (Hindi + English) papers are fully supported</p>
                  </div>
                </div>
              )}

              <button onClick={onBack} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1">
                ← Back to home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
