import { Router } from "express";
import multer from "multer";
import { aiComplete } from "../services/aiProvider.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SYSTEM_EXTRACT_QUESTIONS = `You are an expert exam question extractor. Extract all MCQ and integer/numerical-answer questions from the given exam PDF text.

Rules:
- Extract ALL questions preserving their original question numbers exactly as they appear in the PDF
- MCQ questions must have exactly 4 options (A, B, C, D)
- Match-the-column/List-I List-II questions are MCQs. Preserve the List-I/List-II lines inside the question text and keep the four answer-combination options as A/B/C/D options.
- Integer/numerical answer questions may have NO options. For those, set questionType to "integer" and options to []
- Preserve meaningful line breaks for tables, lists, assertion-reason blocks, and match-column questions. Do not flatten List-I/List-II into unreadable text.
- If a question refers to a graph, diagram, image, or figure, keep the question and add a short note in the question text such as "[Figure/diagram referenced in PDF - verify manually]" because raw text may not include image details.
- Remove bilingual duplicates — keep English text only when both Hindi and English appear for the same content
- Clean up OCR artifacts, garbled characters, and formatting noise
- Ignore headers, footers, page numbers, watermarks, instructions
- Group questions by subject if subjects are labeled
- Return ONLY valid JSON, no explanation

Return JSON in exactly this format:
{
  "examTitle": "string (exam name/title if found, else 'Mock Test')",
  "questions": [
    {
      "number": number (ORIGINAL question number from the PDF, e.g. 1, 2, 3...),
      "subject": "string (Biology/Physics/Chemistry/Nursing Aptitude/English/General Knowledge/Mathematics/Other)",
      "questionType": "mcq or integer",
      "question": "string (clean question text in English only)",
      "options": ["string", "string", "string", "string"] OR [] for integer questions
    }
  ]
}`;

const SYSTEM_EXTRACT_ANSWERS = `You are an expert answer key extractor. Your ONLY job is to extract the answer key mapping (question number → correct answer letter) from a PDF that contains answer keys.

The PDF may contain answer keys for MULTIPLE sets (Set 1, Set 2, Set 3, etc.). You must:
1. If a specific set number is given, extract ONLY the answers for that set
2. If no set number is given, extract answers for the first/only set found
3. Answer formats you may encounter:
   - "1-B, 2-A, 3-C, 4-D" (dash separated)
   - "1. (b) 2. (a) 3. (c)" (dot + bracket)
   - "1 B  2 A  3 C" (space separated)
   - A table with question numbers and answer letters
   - "Ans. 1-b, 2-a..." (various prefix formats)
   - Numerical answers like "1. 42", "2 - 17", "Q3: -5", "4 = 2.5"
4. Convert letter to index: A or a = 0, B or b = 1, C or c = 2, D or d = 3
5. If the answer is a number/integer instead of A/B/C/D, put it in answerValue as a string and set answerIndex to -1
5. Return ONLY valid JSON, no explanation

Return JSON in exactly this format:
{
  "setFound": "string (which set was found/used, e.g. 'Set 1' or 'Single Set')",
  "answers": [
    {
      "questionNumber": number (original question number),
      "answerIndex": number (0=A, 1=B, 2=C, 3=D, or -1 for integer/numerical answer),
      "answerValue": "string numeric answer for integer/numerical questions, or empty string for MCQ"
    }
  ]
}`;

type QuestionDraft = {
  number?: number;
  subject?: string;
  questionType?: "mcq" | "integer";
  question?: string;
  options?: string[];
};

type AnswerDraft = {
  questionNumber?: number;
  answerIndex?: number;
  answerValue?: string;
};

type ParsedQuestions = {
  examTitle?: string;
  questions?: QuestionDraft[];
};

type ParsedAnswers = {
  setFound?: string;
  answers?: AnswerDraft[];
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function focusAnswerKeyText(text: string, setNumber: string, maxLength = 12000) {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!setNumber) return clean.slice(0, maxLength);

  const escapedSet = escapeRegExp(setNumber);
  const setHeading = new RegExp(`(?:practice\\s*)?(?:set|series|paper|test)\\s*[-:#.]*\\s*${escapedSet}\\b`, "i");
  const start = clean.search(setHeading);

  if (start === -1) {
    return clean.slice(0, maxLength);
  }

  const afterStart = clean.slice(start + 1);
  const nextSet = afterStart.search(/(?:practice\s*)?(?:set|series|paper|test)\s*[-:#.]*\s*\d+\b/i);
  const naturalEnd = nextSet === -1 ? start + maxLength : start + 1 + nextSet;
  const end = naturalEnd - start < 2000 ? start + maxLength : naturalEnd;

  return clean.slice(start, end).slice(0, maxLength);
}

function extractAnswersLocally(answerKeyText: string, setNumber: string): ParsedAnswers | null {
  const focused = focusAnswerKeyText(answerKeyText, setNumber, 14000);
  const answerMap = new Map<number, AnswerDraft>();
  const answerPattern =
    /(?:^|[\s,;|])(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*(?:[.)\]:=-]\s*|\s+)[(\[]?\s*([ABCDabcd]|[-+]?\d+(?:\.\d+)?)\s*[)\]]?(?=$|[\s,;|])/g;

  for (const match of focused.matchAll(answerPattern)) {
    const questionNumber = Number(match[1]);
    const rawAnswer = match[2]?.trim() ?? "";
    const answerLetter = rawAnswer.toUpperCase();
    const answerIndex = "ABCD".indexOf(answerLetter);

    if (questionNumber >= 1 && questionNumber <= 300) {
      answerMap.set(
        questionNumber,
        answerIndex >= 0
          ? { questionNumber, answerIndex, answerValue: "" }
          : { questionNumber, answerIndex: -1, answerValue: rawAnswer }
      );
    }
  }

  if (answerMap.size < 5) {
    return null;
  }

  return {
    setFound: setNumber ? `Set ${setNumber}` : "Auto-detected",
    answers: [...answerMap.values()].sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0)),
  };
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

async function extractQuestionsWithFallback(questionText: string, providerPreference?: string) {
  const fullPrompt = `Extract all questions from this question paper, including MCQ, match-the-column/List-I List-II, assertion-reason, and integer/numerical answer questions. Preserve original question numbers and meaningful line breaks. Clean up bilingual/OCR issues:\n\n${questionText.slice(0, 26000)}`;

  try {
    const result = await aiComplete(SYSTEM_EXTRACT_QUESTIONS, fullPrompt, 8192, providerPreference);
    return {
      parsed: parseAiJson<ParsedQuestions>(result.content, "questions"),
      providerName: result.providerName,
    };
  } catch (firstError) {
    const chunks = splitTextIntoChunks(questionText);
    if (chunks.length <= 1) {
      throw firstError;
    }

    const collected: QuestionDraft[] = [];
    const providerNames = new Set<string>();
    const chunkErrors: string[] = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunkPrompt = `Extract every complete question visible in chunk ${i + 1} of ${chunks.length}, including MCQ, match-the-column/List-I List-II, assertion-reason, and integer/numerical answer questions. Preserve original question numbers and meaningful line breaks. Ignore repeated overlap text if it creates duplicates.\n\n${chunks[i]}`;

      try {
        const result = await aiComplete(SYSTEM_EXTRACT_QUESTIONS, chunkPrompt, 3500, providerPreference);
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

async function extractAnswersWithFallback(answerKeyText: string, setNumber: string, providerPreference?: string) {
  const localAnswers = extractAnswersLocally(answerKeyText, setNumber);
  if (localAnswers) {
    return { parsed: localAnswers, providerName: "Local answer parser" };
  }

  const focusedAnswerText = focusAnswerKeyText(answerKeyText, setNumber, 12000);
  const setInstruction = setNumber
    ? `\n\nIMPORTANT: The user wants Set ${setNumber}. Extract ONLY the answers for Set ${setNumber}.`
    : "";

  const answerSystemPrompt = SYSTEM_EXTRACT_ANSWERS + setInstruction;
  const answerUserPrompt = `Extract the answer key mapping from this answer key PDF. For MCQ answers return answerIndex (A=0, B=1, C=2, D=3). For integer/numerical answers set answerIndex to -1 and return answerValue as the numeric string:${setNumber ? ` Focus on Set ${setNumber} answers only.` : ""}\n\n${focusedAnswerText}`;

  const result = await aiComplete(answerSystemPrompt, answerUserPrompt, 3000, providerPreference);
  return {
    parsed: parseAiJson<ParsedAnswers>(result.content, "answer key"),
    providerName: result.providerName,
  };
}

router.post("/extract-split", upload.none(), async (req, res) => {
  try {
    const questionText = req.body.questionText as string | undefined;
    const answerKeyText = req.body.answerKeyText as string | undefined;
    const setNumber = (req.body.setNumber as string | undefined)?.trim() || "";

    if (!questionText || questionText.trim().length < 20) {
      res.status(400).json({ error: "Question paper text is missing or too short." });
      return;
    }
    if (!answerKeyText || answerKeyText.trim().length < 10) {
      res.status(400).json({ error: "Answer key text is missing or too short." });
      return;
    }

    const preferredProvider = (req.body.preferredProvider as string | undefined) || undefined;
    const providerPreference =
      preferredProvider ||
      (questionText.length + answerKeyText.length > 12000 && process.env.GEMINI_API_KEY ? "gemini" : undefined);

    const [questionsResult, answersResult] = await Promise.all([
      extractQuestionsWithFallback(questionText, providerPreference),
      extractAnswersWithFallback(answerKeyText, setNumber, providerPreference),
    ]);

    const parsedQ = questionsResult.parsed;
    const parsedA = answersResult.parsed;

    // Build answer key lookup: questionNumber → answerIndex
    const answerMap = new Map<number, AnswerDraft>();
    for (const entry of parsedA.answers ?? []) {
      if (typeof entry.questionNumber === "number" && typeof entry.answerIndex === "number") {
        answerMap.set(entry.questionNumber, entry);
      }
    }

    // Build final questions with matched answers
    const rawQuestions = parsedQ.questions ?? [];
    const cleaned = rawQuestions
      .filter((q) => {
        const isInteger = q.questionType === "integer" || (Array.isArray(q.options) && q.options.length === 0);
        return q.question && Array.isArray(q.options) && (isInteger || q.options.length === 4);
      })
      .map((q, i) => {
        const qNum = typeof q.number === "number" ? q.number : i + 1;
        const isInteger = q.questionType === "integer" || (q.options ?? []).length === 0;
        const answer = answerMap.get(qNum);
        const correctAnswer = !isInteger && typeof answer?.answerIndex === "number" ? answer.answerIndex : -1;
        return {
          id: i + 1,
          number: qNum,
          subject: q.subject || "General",
          questionType: isInteger ? "integer" : "mcq",
          question: (q.question ?? "").trim(),
          options: (q.options ?? []).map((o) => String(o).trim()),
          correctAnswer,
          numericAnswer: isInteger && typeof answer?.answerValue === "string" ? answer.answerValue.trim() : "",
        };
      });

    const answersMatched = cleaned.filter((q) => q.correctAnswer !== -1 || q.numericAnswer).length;

    res.json({
      examTitle: parsedQ.examTitle || "Mock Test",
      setFound: parsedA.setFound || (setNumber ? `Set ${setNumber}` : "Auto-detected"),
      totalExtracted: cleaned.length,
      answersMatched,
      aiProvider:
        answersResult.providerName === "Local answer parser"
          ? questionsResult.providerName
          : `${questionsResult.providerName} + ${answersResult.providerName}`,
      questions: cleaned,
    });
  } catch (err) {
    req.log.error({ err }, "Error in split extract");
    const msg = err instanceof Error ? err.message : "Failed to process PDFs";
    res.status(500).json({ error: msg });
  }
});

export default router;
