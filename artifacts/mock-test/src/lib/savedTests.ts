import type { ExamQuestion } from "@/pages/Exam";

const SAVED_TEST_APP_ID = "sarva-pdf-mock-test";

export interface SavedMockTestFile {
  app: typeof SAVED_TEST_APP_ID;
  version: 1;
  examTitle: string;
  exportedAt: string;
  questions: ExamQuestion[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeQuestion(raw: unknown, index: number): ExamQuestion | null {
  const record = asRecord(raw);
  if (!record) return null;

  const question = safeString(record.question);
  if (!question) return null;

  const rawOptions = Array.isArray(record.options)
    ? record.options.map((option) => String(option ?? "").trim()).filter(Boolean)
    : [];

  const questionType = record.questionType === "integer" || rawOptions.length === 0 ? "integer" : "mcq";
  if (questionType === "mcq" && rawOptions.length !== 4) return null;

  return {
    id: index + 1,
    subject: safeString(record.subject, "General"),
    questionType,
    question,
    options: questionType === "integer" ? [] : rawOptions,
    correctAnswer: questionType === "integer" ? -1 : safeNumber(record.correctAnswer, -1),
    numericAnswer: safeString(record.numericAnswer),
  };
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "mock-test"
  );
}

export function buildSavedTestFile(examTitle: string, questions: ExamQuestion[]): SavedMockTestFile {
  return {
    app: SAVED_TEST_APP_ID,
    version: 1,
    examTitle: examTitle.trim() || "Mock Test",
    exportedAt: new Date().toISOString(),
    questions: questions.map((question, index) => ({ ...question, id: index + 1 })),
  };
}

export function downloadSavedTest(examTitle: string, questions: ExamQuestion[]) {
  const saved = buildSavedTestFile(examTitle, questions);
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFileName(saved.examTitle)}-saved-test.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readSavedTest(file: File): Promise<{ examTitle: string; questions: ExamQuestion[] }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const record = asRecord(parsed);
  if (!record) throw new Error("This saved test file is not valid JSON.");

  const rawQuestions = Array.isArray(record.questions) ? record.questions : [];
  const questions = rawQuestions
    .map((question, index) => normalizeQuestion(question, index))
    .filter((question): question is ExamQuestion => question !== null);

  if (questions.length === 0) {
    throw new Error("No valid questions were found in this saved test file.");
  }

  return {
    examTitle: safeString(record.examTitle, file.name.replace(/\.json$/i, "") || "Imported Mock Test"),
    questions,
  };
}
