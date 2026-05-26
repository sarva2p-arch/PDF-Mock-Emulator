import { Router } from "express";
import multer from "multer";
import { aiComplete } from "../services/aiProvider.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SYSTEM_QUESTIONS_ONLY = `You are an expert exam question extractor. Your task is to extract EVERY single MCQ question from the raw PDF text and return them as clean, structured JSON.

CRITICAL RULES — follow exactly:
- Extract ALL questions — do not skip, truncate, or stop partway through. If there are 30 questions, return all 30.
- Every question must have exactly 4 options (A, B, C, D).
- Count question numbers as you go to ensure none are missed. Questions are usually numbered 1, 2, 3... — follow the sequence.
- If an answer key is also present in the text, extract the correct answer for each question (A=0, B=1, C=2, D=3). Otherwise set correctAnswer to -1.
- Remove bilingual duplicates — if the same content appears in both Hindi and English, keep only the English version.
- Clean up garbled characters, OCR artifacts, and formatting noise from PDF extraction.
- Ignore page headers, footers, instructions, roll number boxes, page numbers, and watermarks.
- Group questions by subject if subjects are labeled (Biology, Physics, Chemistry, etc.).
- Return ONLY valid JSON with no explanation text outside the JSON.

Return JSON in exactly this format:
{
  "examTitle": "string (exam name or title if found, else 'Mock Test')",
  "questions": [
    {
      "subject": "string (Biology/Physics/Chemistry/Nursing Aptitude/English/General Knowledge/Mathematics/Other)",
      "question": "string (clean question text in English only)",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": number (0-3 if answer key present, or -1 if unknown)
    }
  ]
}`;

const SYSTEM_WITH_ANSWERS = `You are an expert exam question and answer key extractor. This PDF contains MCQ questions AND an answer key. Your task is to extract EVERY question AND match each one to its correct answer from the key.

CRITICAL RULES — follow exactly:
- Extract ALL MCQ questions without exception. If there are 30 questions numbered 1-30, return all 30.
- Each question must have exactly 4 options (A, B, C, D).
- Find the answer key section — it often appears as: "1-B 2-A 3-C..." or "1.(b) 2.(a)..." or a table. It may be at the end or in a separate section.
- Match EVERY question number to its answer letter. This is the most important step.
- Convert answer letters to index: A=0, B=1, C=2, D=3.
- Only use -1 for correctAnswer if a question's number genuinely has no matching entry in the key.
- Remove bilingual duplicates — keep only English versions of questions and options.
- Clean up garbled characters, OCR artifacts, and formatting noise.
- Ignore page headers, footers, instructions, roll number boxes, page numbers, and watermarks.
- Group questions by subject if labeled.
- Return ONLY valid JSON with no explanation outside the JSON.

Return JSON in exactly this format:
{
  "examTitle": "string (exam name or title if found, else 'Mock Test')",
  "questions": [
    {
      "subject": "string (Biology/Physics/Chemistry/Nursing Aptitude/English/General Knowledge/Mathematics/Other)",
      "question": "string (clean question text in English only)",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": number (0=A, 1=B, 2=C, 3=D, or -1 if truly not found)
    }
  ]
}`;

router.post("/extract-questions", upload.none(), async (req, res) => {
  try {
    const pdfText = req.body.text as string | undefined;
    const mode = (req.body.mode as string | undefined) ?? "questions-only";

    if (!pdfText || pdfText.trim().length < 20) {
      res.status(400).json({ error: "No PDF text provided" });
      return;
    }

    const systemPrompt = mode === "with-answers" ? SYSTEM_WITH_ANSWERS : SYSTEM_QUESTIONS_ONLY;

    // Use more context for with-answers mode since it needs to hold both questions and answer key
    const textLimit = mode === "with-answers" ? 36000 : 30000;

    const userPromptPrefix =
      mode === "with-answers"
        ? "Extract ALL MCQ questions AND match every one to its answer from the key in this PDF. Find the answer key section carefully — check the end of the document and any answer tables. Make sure you return every single question. The PDF text may contain OCR artifacts or bilingual content:"
        : "Extract ALL MCQ questions from this exam PDF. Do not stop early — find and return every question from start to finish. The text may contain OCR artifacts or bilingual content (Hindi/English):";

    const userPrompt = `${userPromptPrefix}\n\n${pdfText.slice(0, textLimit)}`;

    const preferredProvider = (req.body.preferredProvider as string | undefined) || undefined;
    const { content: raw, providerName } = await aiComplete(systemPrompt, userPrompt, 8192, preferredProvider);

    let parsed: { examTitle?: string; questions?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: `AI (${providerName}) returned invalid JSON. Please try again.` });
      return;
    }

    const questions = (parsed.questions ?? []) as Array<{
      subject: string;
      question: string;
      options: string[];
      correctAnswer: number;
    }>;

    const cleaned = questions
      .filter((q) => q.question && Array.isArray(q.options) && q.options.length === 4)
      .map((q, i) => ({
        id: i + 1,
        subject: q.subject || "General",
        question: q.question.trim(),
        options: q.options.map((o: string) => String(o).trim()),
        correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : -1,
      }));

    const answersFound = cleaned.filter((q) => q.correctAnswer !== -1).length;

    res.json({
      examTitle: parsed.examTitle || "Mock Test",
      totalExtracted: cleaned.length,
      answersFound,
      aiProvider: providerName,
      questions: cleaned,
    });
  } catch (err) {
    req.log.error({ err }, "Error extracting questions");
    const msg = err instanceof Error ? err.message : "Failed to extract questions";
    res.status(500).json({ error: msg });
  }
});

export default router;
