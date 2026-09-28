import { askAi, isAiConfigured } from "../ai/ai.service.js";
import { AppError } from "../../utils/errors.js";
import {
  QuestionDifficulty,
  QuestionType,
  ICodeSnippet,
} from "./quiz.interface.js";

/**
 * Interface representing a raw question returned by the AI generator
 * before verification and database persistence.
 */
export interface IRawGeneratedQuestion {
  type: QuestionType;
  topic: string;
  difficulty: QuestionDifficulty;
  questionText: string;
  codeSnippet?: ICodeSnippet;
  options: string[];
  correctAnswer: number | string;
  explanation: string;
}

export interface IGenerateQuestionsOptions {
  topic: string;
  difficulty: QuestionDifficulty;
  count?: number;
  type?: QuestionType;
}

/**
 * System prompt forcing the LLM to output ONLY a valid JSON array of questions.
 * Includes explicit rules for options formatting, code snippet language, and index-based correct answers.
 */
const SYSTEM_PROMPT = `You are AlgoArena's AI Quiz Question Generator, an expert computer science teacher.
Your task is to generate high-quality conceptual and code-based multiple-choice quiz questions for programmers.

Strict Rules:
1. Respond with ONLY a valid JSON array of question objects. Do NOT include markdown text, intros, or outros.
2. Each question object in the JSON array MUST follow this exact schema:
   {
     "type": "MULTIPLE_CHOICE" | "OUTPUT_PREDICTION" | "COMPLEXITY" | "BUG_SPOTTING",
     "topic": string (e.g. "arrays", "time-complexity", "async-js"),
     "difficulty": "EASY" | "MEDIUM" | "HARD",
     "questionText": string (clear, unambiguous question),
     "codeSnippet": { "language": "javascript" | "python" | "cpp", "code": string } (OPTIONAL - mandatory for OUTPUT_PREDICTION, COMPLEXITY, and BUG_SPOTTING),
     "options": [string, string, string, string] (exactly 4 distinct option strings),
     "correctAnswer": number (0-based index of the correct option in the options array, e.g. 0, 1, 2, or 3),
     "explanation": string (concise explanation of why the correct answer is right)
   }
3. For OUTPUT_PREDICTION, COMPLEXITY, and BUG_SPOTTING types, you MUST supply a short, syntactically valid codeSnippet.
4. Ensure options are distinct and plausible (no obvious filler options).
5. The "correctAnswer" index MUST match the exact 0-based position of the correct choice in the "options" array.`;

/**
 * Helper function to safely strip markdown code blocks and parse raw LLM response.
 * Handles edge cases like ```json fences, trailing commas, or missing required keys.
 */
export const parseGeneratedQuestions = (
  rawText: string,
): IRawGeneratedQuestion[] | null => {
  try {
    // 1. Strip markdown code fences (e.g. ```json ... ```)
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // 2. Attempt JSON parsing
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const validTypes = new Set([
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.OUTPUT_PREDICTION,
      QuestionType.COMPLEXITY,
      QuestionType.BUG_SPOTTING,
    ]);

    const validDifficulties = new Set([
      QuestionDifficulty.EASY,
      QuestionDifficulty.MEDIUM,
      QuestionDifficulty.HARD,
    ]);

    // 3. Validate each question object against required fields
    const validatedQuestions: IRawGeneratedQuestion[] = [];

    for (const item of parsed) {
      if (
        !item ||
        typeof item !== "object" ||
        !validTypes.has(item.type) ||
        !validDifficulties.has(item.difficulty) ||
        typeof item.questionText !== "string" ||
        !item.questionText.trim() ||
        !Array.isArray(item.options) ||
        item.options.length < 2 ||
        typeof item.explanation !== "string" ||
        item.correctAnswer === undefined ||
        item.correctAnswer === null
      ) {
        continue;
      }

      // Ensure options array consists of valid strings
      const cleanOptions = item.options.map((opt: unknown) => String(opt).trim());

      // Validate codeSnippet if present
      let cleanCodeSnippet: ICodeSnippet | undefined = undefined;
      if (item.codeSnippet && typeof item.codeSnippet === "object") {
        if (
          typeof item.codeSnippet.code === "string" &&
          item.codeSnippet.code.trim()
        ) {
          cleanCodeSnippet = {
            language: String(item.codeSnippet.language || "javascript").toLowerCase(),
            code: String(item.codeSnippet.code),
          };
        }
      }

      validatedQuestions.push({
        type: item.type as QuestionType,
        topic: String(item.topic || "general").toLowerCase().trim(),
        difficulty: item.difficulty as QuestionDifficulty,
        questionText: item.questionText.trim(),
        codeSnippet: cleanCodeSnippet,
        options: cleanOptions,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation.trim(),
      });
    }

    return validatedQuestions.length > 0 ? validatedQuestions : null;
  } catch {
    return null;
  }
};

/**
 * Core AI Question Generator Function
 * Invokes shared AI gateway (aiService.askAi) with retries and structured validation.
 */
export const generateQuestionsBatch = async (
  options: IGenerateQuestionsOptions,
): Promise<{
  questions: IRawGeneratedQuestion[];
  requestedCount: number;
  source: "ai" | "unavailable";
}> => {
  const { topic, difficulty, count = 5, type } = options;
  const targetCount = Math.min(Math.max(Number(count) || 5, 1), 15);

  if (!isAiConfigured()) {
    throw new AppError(
      "AI generation requires GROQ_API_KEY or GEMINI_API_KEY configured on the backend.",
      503,
    );
  }

  // Construct user prompt with generation parameters
  const userPrompt = `Generate a batch of ${targetCount} quiz questions.
Topic: ${topic}
Difficulty: ${difficulty}
${type ? `Specific Type: ${type}` : "Mix of MULTIPLE_CHOICE, OUTPUT_PREDICTION, COMPLEXITY, and BUG_SPOTTING questions."}

Generate the JSON array now.`;

  let questions: IRawGeneratedQuestion[] | null = null;

  // Retry loop: Attempt up to 2 times in case LLM outputs malformed JSON on first try
  for (let attempt = 0; attempt < 2 && !questions; attempt++) {
    const rawResponse = await askAi({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 2500,
    });

    if (rawResponse) {
      questions = parseGeneratedQuestions(rawResponse);
    }
  }

  if (!questions || questions.length === 0) {
    throw new AppError(
      "AI model failed to generate valid structured questions. Please try again.",
      500,
    );
  }

  return {
    questions,
    requestedCount: targetCount,
    source: "ai",
  };
};

export const quizGenerator = {
  generateQuestionsBatch,
  parseGeneratedQuestions,
};
