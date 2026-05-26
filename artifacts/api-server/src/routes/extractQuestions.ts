import { Router } from "express";
import multer from "multer";
import { aiComplete } from "../services/aiProvider.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SYSTEM_QUESTIONS_ONLY = `You are an expert exam question extractor. Your task is to extract EVERY single MCQ and integer/numerical-answer question from the raw PDF text and return them as clean, structured JSON.

CRITICAL RULES — follow exactly:
- Extract ALL questions — do not skip, truncate, or stop partway through. If there are 30 questions, return all 30.
- MCQ questions must have exactly 4 options (A, B, C, D).
- Integer/numerical answer questions may have NO options. For those, set questionType to "integer", options to [], correctAnswer to -1, and numericAnswer to the numeric answer if present.
- Count question numbers as you go to ensure none are missed. Questions are usually numbered 1, 2, 3... — follow the sequence.
- If an MCQ answer key is present, extract the correct answer for each question (A=0, B=1, C=2, D=3). Otherwise set correctAnswer to -1.
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
      "number": number (original question number if visible, else array position),
      "subject": "string (Biology/Physics/Chemistry/Nursing Aptitude/English/General Knowledge/Mathematics/Other)",
      "questionType": "mcq or integer",
      "question": "string (clean question text in English only)",
      "options": ["string", "string", "string", "string"] OR [] for integer questions,
      "correctAnswer": number (0-3 for MCQ if answer key present, or -1 if unknown/integer),
      "numericAnswer": "string numeric answer for integer questions, or empty string if unknown/not integer"
    }
  ]
}`;

const SYSTEM_WITH_ANSWERS = `You are an expert exam question and answer key extractor. This PDF contains MCQ/integer questions AND an answer key. Your task is to extract EVERY question AND match each one to its correct answer from the key.

CRITICAL RULES — follow exactly:
- Extract ALL MCQ questions without exception. If there are 30 questions numbered 1-30, return all 30.
- MCQ questions must have exactly 4 options (A, B, C, D).
- Integer/numerical answer questions may have NO options. For those, set questionType to "integer", options to [], correctAnswer to -1, and numericAnswer to the numeric answer.
- Find the answer key section — it often appears as: "1-B 2-A 3-C..." or "1.(b) 2.(a)..." or a table. It may be at the end or in a separate section.
- Match EVERY question number to its answer letter. This is the most important step.
- Convert answer letters to index: A=0, B=1, C=2, D=3.
- For numerical answer keys, preserve the numeric answer exactly as numericAnswer, e.g. "17", "-4", "2.5".
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
      "number": number (original question number if visible, else array position),
      "subject": "string (Biology/Physics/Chemistry/Nursing Aptitude/English/General Knowledge/Mathematics/Other)",
      "questionType": "mcq or integer",
      "question": "string (clean question text in English only)",
      "options": ["string", "string", "string", "string"] OR [] for integer questions,
      "correctAnswer": number (0=A, 1=B, 2=C, 3=D, or -1 if truly not found/integer),
      "numericAnswer": "string numeric answer for integer questions, or empty string if unknown/not integer"
    }
  ]
}`;

type QuestionDraft = {
  number?: number;
  subject?: string;
  questionType?: "mcq" | "integer";
  question?: string;
  options?: string[];
  correctAnswer?: number;
  numericAnswer?: string;
};

type ParsedQuestions = {
  examTitle?: string;
  questions?: QuestionDraft[];
};

type AnswerEntry = {
  correctAnswer: number;
  numericAnswer: string;
};

function parseAiJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`AI returned invalid JSON for ${label}. Please try again.`);
  }
}

function splitTextIntoChunks(text: string, maxLength = 6500, overlap = 700) {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + maxLength, clean.length);

    if (end < clean.length) {
      const searchStart = start + Math.floor(maxLength * 0.55);
      const window = clean.slice(searchStart, end);
      const matches = [...window.matchAll(/\n\s*(?:Q\.?\s*)?\d{1,3}\s*[\).:-]\s+/g)];
      const lastMatch = matches[matches.length - 1];
      if (lastMatch?.index !== undefined) {
        end = searchStart + lastMatch.index;
      }
    }

    if (end <= start) {
      end = Math.min(start + maxLength, clean.length);
    }

    chunks.push(clean.slice(start, end).trim());

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks.filter(Boolean);
}

function focusAnswerKeyText(text: string, maxLength = 15000) {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const lower = clean.toLowerCase();
  const markers = ["answer key", "answers", "answer", "solution", "key"];
  const markerIndex = Math.max(...markers.map((marker) => lower.lastIndexOf(marker)));

  if (markerIndex > -1) {
    return clean.slice(Math.max(0, markerIndex - 1200), markerIndex + maxLength);
  }

  return clean.slice(Math.max(0, clean.length - maxLength));
}

function extractAnswersLocally(text: string) {
  const focused = focusAnswerKeyText(text);
  const answerMap = new Map<number, AnswerEntry>();
  const answerPattern =
    /(?:^|[\s,;|])(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*(?:[.)\]:=-]\s*|\s+)[(\[]?\s*([ABCDabcd]|[-+]?\d+(?:\.\d+)?)\s*[)\]]?(?=$|[\s,;|])/g;

  for (const match of focused.matchAll(answerPattern)) {
    const questionNumber = Number(match[1]);
    const rawAnswer = match[2]?.trim() ?? "";
    const answerIndex = "ABCD".indexOf(rawAnswer.toUpperCase());

    if (questionNumber >= 1 && questionNumber <= 300) {
      answerMap.set(
        questionNumber,
        answerIndex >= 0
          ? { correctAnswer: answerIndex, numericAnswer: "" }
          : { correctAnswer: -1, numericAnswer: rawAnswer }
      );
    }
  }

  return answerMap;
}

function dedupeQuestions(questions: QuestionDraft[]) {
  const byKey = new Map<string, QuestionDraft>();

  for (const question of questions) {
    const normalizedText = (question.question ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const key =
      typeof question.number === "number"
        ? `number:${question.number}`
        : `text:${normalizedText.slice(0, 120)}`;

    const existing = byKey.get(key);
    if (!existing || (question.question?.length ?? 0) > (existing.question?.length ?? 0)) {
      byKey.set(key, question);
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (typeof a.number === "number" && typeof b.number === "number") {
      return a.number - b.number;
    }
    return 0;
  });
}

function cleanQuestions(questions: QuestionDraft[], answerMap = new Map<number, AnswerEntry>()) {
  return questions
    .filter((q) => {
      const options = Array.isArray(q.options) ? q.options : [];
      const isInteger = q.questionType === "integer" || options.length === 0;
      return q.question && (isInteger || options.length === 4);
    })
    .map((q, i) => {
      const qNum = typeof q.number === "number" ? q.number : i + 1;
      const options = Array.isArray(q.options) ? q.options : [];
      const mappedAnswer = answerMap.get(qNum);
      const isInteger = q.questionType === "integer" || options.length === 0 || Boolean(mappedAnswer?.numericAnswer);

      return {
        id: i + 1,
        subject: q.subject || "General",
        questionType: isInteger ? "integer" : "mcq",
        question: (q.question ?? "").trim(),
        options: isInteger ? [] : options.map((o: string) => String(o).trim()),
        correctAnswer: isInteger
          ? -1
          : typeof mappedAnswer?.correctAnswer === "number"
          ? mappedAnswer.correctAnswer
          : typeof q.correctAnswer === "number"
          ? q.correctAnswer
          : -1,
        numericAnswer: isInteger
          ? mappedAnswer?.numericAnswer || (typeof q.numericAnswer === "string" ? q.numericAnswer.trim() : "")
          : "",
      };
    });
}

async function extractQuestionsResilient(
  systemPrompt: string,
  userPrompt: string,
  pdfText: string,
  providerPreference?: string
) {
  try {
    const result = await aiComplete(systemPrompt, userPrompt, 8192, providerPreference);
    return {
      parsed: parseAiJson<ParsedQuestions>(result.content, "questions"),
      providerName: result.providerName,
    };
  } catch (firstError) {
    const chunks = splitTextIntoChunks(pdfText);
    if (chunks.length <= 1) {
      throw firstError;
    }

    const chunkProvider = process.env.GROQ_API_KEY ? "groq" : providerPreference;
    const collected: QuestionDraft[] = [];
    const providerNames = new Set<string>();
    const chunkErrors: string[] = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunkPrompt = `Extract every complete question visible in chunk ${i + 1} of ${chunks.length}, including MCQ and integer/numerical answer questions. Preserve original question numbers. Ignore repeated overlap text if it creates duplicates.\n\n${chunks[i]}`;

      try {
        const result = await aiComplete(SYSTEM_QUESTIONS_ONLY, chunkPrompt, 3500, chunkProvider);
        providerNames.add(result.providerName);
        const parsedChunk = parseAiJson<ParsedQuestions>(result.content, `questions chunk ${i + 1}`);
        collected.push(...(parsedChunk.questions ?? []));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        chunkErrors.push(`Chunk ${i + 1}: ${msg}`);
      }
    }

    const questions = dedupeQuestions(collected);
    if (questions.length === 0) {
      const originalMessage = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(`${originalMessage}\n\nChunk fallback also failed:\n${chunkErrors.join("\n")}`);
    }

    return {
      parsed: { examTitle: "Mock Test", questions },
      providerName: `Chunked fallback (${[...providerNames].join(", ") || "AI"})`,
    };
  }
}

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
        ? "Extract ALL MCQ and integer/numerical questions AND match every one to its answer from the key in this PDF. Find the answer key section carefully — check the end of the document and any answer tables. Make sure you return every single question. The PDF text may contain OCR artifacts or bilingual content:"
        : "Extract ALL MCQ and integer/numerical questions from this exam PDF. Do not stop early — find and return every question from start to finish. The text may contain OCR artifacts or bilingual content (Hindi/English):";

    const userPrompt = `${userPromptPrefix}\n\n${pdfText.slice(0, textLimit)}`;

    const preferredProvider = (req.body.preferredProvider as string | undefined) || undefined;
    const providerPreference =
      preferredProvider || (pdfText.length > 12000 && process.env.GEMINI_API_KEY ? "gemini" : undefined);
    const { parsed, providerName } = await extractQuestionsResilient(
      systemPrompt,
      userPrompt,
      pdfText,
      providerPreference
    );

    const answerMap = mode === "with-answers" ? extractAnswersLocally(pdfText) : new Map<number, AnswerEntry>();
    const cleaned = cleanQuestions(parsed.questions ?? [], answerMap);

    const answersFound = cleaned.filter((q) => q.correctAnswer !== -1 || q.numericAnswer).length;

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
