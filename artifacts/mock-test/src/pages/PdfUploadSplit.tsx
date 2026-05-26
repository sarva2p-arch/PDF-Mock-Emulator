import { useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export interface ExtractedQuestion {
  id: number;
  subject: string;
  question: string;
  options: string[];
  correctAnswer: number;
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

  const extractText = async (file: File, onPage: (n: number, total: number) => void): Promise<string> => {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      onPage(p, pdf.numPages);
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((i: unknown) => ((i as { str?: string }).str ?? "")).join(" ") + "\n";
    }
    return text;
  };

  const handleQuestionFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Question paper must be a PDF."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Question paper PDF too large (max 20MB)."); return; }
    setError("");
    setStage("reading");
    setProgress("Reading question paper...");
    try {
      const text = await extractText(file, (p, t) => setProgress(`Reading question paper: page ${p} of ${t}...`));
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
      const text = await extractText(file, (p, t) => setProgress(`Reading answer key: page ${p} of ${t}...`));
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
      setError(err instanceof Error ? err.message : "Something went wrong."); setStage("error");
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
    Physics: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
    Chemistry: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
    English: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700",
    Mathematics: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700",
    "General Knowledge": "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700",
    Other: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
  };
  const getColor = (s: string) => subjectColors[s] ?? "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";

  const bothReady = questionPdf.ready && answerPdf.ready;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-orange-600 text-white rounded-t-xl p-5 text-center shadow-lg relative">
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
          <div className="text-orange-200 text-xs uppercase tracking-wider mb-1">Dhanusha Academy</div>
          <h1 className="text-xl font-bold">Upload Questions + Separate Answer Key</h1>
          <p className="text-orange-100 text-sm mt-1">Upload your question set PDF and the combined answer key PDF — AI matches them perfectly</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-b-xl shadow-lg p-6 space-y-5">

          {(stage === "reading" || stage === "extracting") && (
            <div className="py-8 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-orange-100 dark:border-orange-900" />
                <div className="w-20 h-20 rounded-full border-4 border-orange-500 border-t-transparent animate-spin absolute inset-0" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {stage === "reading" ? (
                    <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700 dark:text-gray-200">
                  {stage === "reading" ? "Reading PDF..." : "AI Processing Both PDFs..."}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{progress}</p>
              </div>
              {stage === "extracting" && (
                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-2 text-xs text-orange-700 dark:text-orange-400 text-center max-w-sm">
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
                    <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Error</p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {stage === "preview" ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-100 text-lg">{questions.length} questions extracted!</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">from: {questionPdf.name}</p>
                      {setFound && <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-0.5">Answer key used: {setFound}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 items-end">
                      <div className="bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1.5 rounded-full">
                        ✓ Ready to use
                      </div>
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${answersMatched === questions.length ? "bg-orange-100 dark:bg-orange-900/50 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400" : answersMatched > 0 ? "bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400" : "bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"}`}>
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Exam Title</label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Subject Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(subjectCounts).map(([subj, count]) => (
                        <span key={subj} className={`px-3 py-1 rounded-full text-xs font-semibold border ${getColor(subj)}`}>
                          {subj}: {count}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Preview (first 3 questions)</p>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {questions.slice(0, 3).map((q) => (
                        <div key={q.id} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-gray-800 dark:text-gray-100">Q{q.id}. {q.question}</p>
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${q.correctAnswer >= 0 ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-600 text-gray-400"}`}>
                              {q.correctAnswer >= 0 ? `Ans: ${String.fromCharCode(65 + q.correctAnswer)}` : "No key"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {q.options.map((opt, i) => (
                              <div key={i} className={`text-xs px-2 py-1 rounded ${q.correctAnswer === i ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 font-semibold ring-1 ring-green-400 dark:ring-green-700" : "bg-gray-50 dark:bg-gray-600 text-gray-600 dark:text-gray-300"}`}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={reset} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      Upload Different PDFs
                    </button>
                    <button
                      onClick={() => onQuestionsReady(questions, examTitle)}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-sm"
                    >
                      Start Mock Test →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 space-y-1.5">
                    <p className="font-semibold text-orange-800 dark:text-orange-300 text-xs uppercase tracking-wide mb-2">How this works</p>
                    <p>• Upload your <strong>question set PDF</strong> (one of your 6 sets) and the <strong>combined answer key PDF</strong></p>
                    <p>• Optionally enter the <strong>set number</strong> so AI picks the right answers from the combined key</p>
                    <p>• AI extracts questions and matches them with the correct set answers from the key PDF</p>
                    <p>• Attempt the test and see your full score, correct vs wrong — just like a real result</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-orange-600 text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
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
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${qDragging ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20" : "border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-orange-900/10"}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Drop question paper here</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">or click to browse</p>
                          <span className="mt-2 inline-block bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Choose PDF</span>
                          <input ref={qInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQuestionFile(f); }} />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-orange-600 text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
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
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${aDragging ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20" : "border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-orange-900/10"}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Drop answer key here</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">or click to browse</p>
                          <span className="mt-2 inline-block bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Choose PDF</span>
                          <input ref={aInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAnswerFile(f); }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Set Number <span className="text-gray-400 font-normal">(optional — which set are these questions?)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={setNumber}
                        onChange={(e) => setSetNumber(e.target.value)}
                        placeholder="e.g. 1, 2, 3, Set 1..."
                        className="w-44 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">If your answer key has answers for all 6 sets, enter the set number so AI picks the right ones</span>
                    </div>
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={!bothReady}
                    className={`w-full font-semibold py-3 rounded-lg text-sm transition-all shadow-sm ${bothReady ? "bg-orange-600 hover:bg-orange-700 text-white cursor-pointer" : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"}`}
                  >
                    {bothReady
                      ? "Extract Questions & Match Answers →"
                      : `Waiting for ${!questionPdf.ready && !answerPdf.ready ? "both PDFs" : !questionPdf.ready ? "question paper PDF" : "answer key PDF"}`}
                  </button>

                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
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
