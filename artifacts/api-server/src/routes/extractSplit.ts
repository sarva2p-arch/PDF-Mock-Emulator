import { Router } from "express";
import multer from "multer";
import { aiComplete } from "../services/aiProvider.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SYSTEM_EXTRACT_QUESTIONS = `You are an expert MCQ question extractor. Extract all multiple-choice questions from the given exam PDF text.

Rules:
- Extract ALL questions preserving their original question numbers exactly as they appear in the PDF
- Each question must have exactly 4 options (A, B, C, D)
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
      "question": "string (clean question text in English only)",
      "options": ["string", "string", "string", "string"]
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
4. Convert letter to index: A or a = 0, B or b = 1, C or c = 2, D or d = 3
5. Return ONLY valid JSON, no explanation

Return JSON in exactly this format:
{
  "setFound": "string (which set was found/used, e.g. 'Set 1' or 'Single Set')",
  "answers": [
    {
      "questionNumber": number (original question number),
      "answerIndex": number (0=A, 1=B, 2=C, 3=D)
    }
  ]
}`;

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

    const setInstruction = setNumber
      ? `\n\nIMPORTANT: The user wants Set ${setNumber}. Extract ONLY the answers for Set ${setNumber}.`
      : "";

    const answerSystemPrompt = SYSTEM_EXTRACT_ANSWERS + setInstruction;
    const answerUserPrompt = `Extract the answer key mapping from this answer key PDF. Return every question number with its correct answer as an index (A=0, B=1, C=2, D=3):${setNumber ? ` Focus on Set ${setNumber} answers only.` : ""}\n\n${answerKeyText.slice(0, 20000)}`;

    const questionUserPrompt = `Extract all MCQ questions from this question paper. Preserve original question numbers. Clean up bilingual/OCR issues:\n\n${questionText.slice(0, 26000)}`;

    // Run both AI calls in parallel for speed
    const [questionsResult, answersResult] = await Promise.all([
      aiComplete(SYSTEM_EXTRACT_QUESTIONS, questionUserPrompt, 8192, preferredProvider),
      aiComplete(answerSystemPrompt, answerUserPrompt, 4096, preferredProvider),
    ]);

    // Parse questions
    let parsedQ: {
      examTitle?: string;
      questions?: Array<{ number?: number; subject?: string; question?: string; options?: string[] }>;
    };
    try {
      parsedQ = JSON.parse(questionsResult.content);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON for questions. Please try again." });
      return;
    }

    // Parse answer key
    let parsedA: {
      setFound?: string;
      answers?: Array<{ questionNumber?: number; answerIndex?: number }>;
    };
    try {
      parsedA = JSON.parse(answersResult.content);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON for answer key. Please try again." });
      return;
    }

    // Build answer key lookup: questionNumber → answerIndex
    const answerMap = new Map<number, number>();
    for (const entry of parsedA.answers ?? []) {
      if (typeof entry.questionNumber === "number" && typeof entry.answerIndex === "number") {
        answerMap.set(entry.questionNumber, entry.answerIndex);
      }
    }

    // Build final questions with matched answers
    const rawQuestions = parsedQ.questions ?? [];
    const cleaned = rawQuestions
      .filter((q) => q.question && Array.isArray(q.options) && q.options.length === 4)
      .map((q, i) => {
        const qNum = typeof q.number === "number" ? q.number : i + 1;
        const correctAnswer = answerMap.has(qNum) ? answerMap.get(qNum)! : -1;
        return {
          id: i + 1,
          number: qNum,
          subject: q.subject || "General",
          question: (q.question ?? "").trim(),
          options: (q.options ?? []).map((o) => String(o).trim()),
          correctAnswer,
        };
      });

    const answersMatched = cleaned.filter((q) => q.correctAnswer !== -1).length;

    res.json({
      examTitle: parsedQ.examTitle || "Mock Test",
      setFound: parsedA.setFound || (setNumber ? `Set ${setNumber}` : "Auto-detected"),
      totalExtracted: cleaned.length,
      answersMatched,
      aiProvider: questionsResult.providerName,
      questions: cleaned,
    });
  } catch (err) {
    req.log.error({ err }, "Error in split extract");
    const msg = err instanceof Error ? err.message : "Failed to process PDFs";
    res.status(500).json({ error: msg });
  }
});

export default router;
