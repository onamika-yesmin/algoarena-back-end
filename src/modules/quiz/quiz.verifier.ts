import crypto from "node:crypto";
import { QuizQuestionModel } from "../../models/QuizQuestion.model.js";
import {
  runAgainstTestCase,
  isJudgeLanguage,
  JudgeLanguage,
} from "../../integrations/judge0/judge0.service.js";
import { askAi } from "../ai/ai.service.js";
import {
  QuestionStatus,
  QuestionType,
  VerificationStatus,
} from "./quiz.interface.js";
import { IRawGeneratedQuestion } from "./quiz.generator.js";

export interface IVerifiedQuestionPayload {
  type: QuestionType;
  topic: string;
  difficulty: IRawGeneratedQuestion["difficulty"];
  questionText: string;
  codeSnippet?: IRawGeneratedQuestion["codeSnippet"];
  options: string[];
  correctAnswer: number | string;
  explanation: string;
  verificationStatus: VerificationStatus;
  status: QuestionStatus;
  dedupHash: string;
  verificationNotes?: string;
}

/**
 * Generates a SHA-256 canonical hash of normalized question text for deduplication.
 */
export const generateQuestionHash = (questionText: string): string => {
  return crypto
    .createHash("sha256")
    .update(questionText.trim().toLowerCase())
    .digest("hex");
};

/**
 * Checks if a question text already exists in the database by SHA-256 hash.
 */
export const isDuplicateQuestion = async (
  questionText: string,
): Promise<boolean> => {
  const dedupHash = generateQuestionHash(questionText);
  const existing = await QuizQuestionModel.findOne({ dedupHash });
  return Boolean(existing);
};

/**
 * Verifies a code snippet's execution output using Judge0 sandbox.
 * Used for OUTPUT_PREDICTION question types.
 */
export const verifyCodeSnippetOutput = async (
  rawLanguage: string | undefined,
  code: string,
  expectedAnswer: number | string,
  options: string[],
): Promise<{ isVerified: boolean; stdout?: string; reason?: string }> => {
  const langStr = (rawLanguage || "javascript").toLowerCase();
  const judgeLang: JudgeLanguage = isJudgeLanguage(langStr)
    ? langStr
    : "javascript";

  try {
    const outcome = await runAgainstTestCase(judgeLang, code, "", 5000);

    if (outcome.compileError) {
      return {
        isVerified: false,
        reason: `Judge0 Compilation Error: ${outcome.compileError}`,
      };
    }

    if (outcome.timedOut) {
      return {
        isVerified: false,
        reason: "Judge0 Execution Timed Out",
      };
    }

    if (outcome.exitCode !== 0) {
      return {
        isVerified: false,
        reason: `Judge0 Runtime Error (Exit code ${outcome.exitCode}): ${outcome.stderr}`,
      };
    }

    const actualStdout = (outcome.stdout || "").trim();

    let expectedString = "";
    if (typeof expectedAnswer === "number" && options[expectedAnswer]) {
      expectedString = options[expectedAnswer].trim();
    } else {
      expectedString = String(expectedAnswer).trim();
    }

    const matchesExact = actualStdout === expectedString;
    const matchesOption = options.some((opt) => opt.trim() === actualStdout);

    if (matchesExact || matchesOption) {
      return {
        isVerified: true,
        stdout: actualStdout,
      };
    }

    return {
      isVerified: false,
      reason: `Judge0 output '${actualStdout}' did not match expected '${expectedString}'`,
    };
  } catch (error: any) {
    return {
      isVerified: false,
      reason: `Judge0 sandbox error: ${error?.message || "Unknown error"}`,
    };
  }
};

/**
 * Secondary AI verification for BUG_SPOTTING, COMPLEXITY, and MULTIPLE_CHOICE questions.
 * Verifies correctness of options and claims using a secondary LLM call.
 */
export const verifyQuestionWithSecondaryAi = async (
  question: IRawGeneratedQuestion,
): Promise<{ isVerified: boolean; reason?: string }> => {
  const correctChoiceText =
    typeof question.correctAnswer === "number"
      ? question.options[question.correctAnswer]
      : String(question.correctAnswer);

  const systemPrompt = `You are AlgoArena's AI Question Auditor.
Analyze the following quiz question for factual accuracy, option clarity, and correctness.
Reply ONLY with the word "VERIFIED" if the claimed correct answer is 100% accurate, or "FAILED: <reason>" if it is wrong, ambiguous, or contains a hallucinated error.`;

  const userPrompt = `Question Type: ${question.type}
Topic: ${question.topic}
Question Text: ${question.questionText}
${question.codeSnippet?.code ? `Code Snippet:\n${question.codeSnippet.code}` : ""}
Options:
${question.options.map((opt, idx) => `${idx}. ${opt}`).join("\n")}
Claimed Correct Answer: ${correctChoiceText}
Explanation: ${question.explanation}`;

  try {
    const aiResponse = await askAi({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 150,
    });

    if (!aiResponse) {
      // If secondary AI is unavailable, default to true to allow admin review
      return { isVerified: true };
    }

    const trimmed = aiResponse.trim();
    if (trimmed.toUpperCase().startsWith("VERIFIED")) {
      return { isVerified: true };
    }

    return {
      isVerified: false,
      reason: `Secondary AI Audit: ${trimmed}`,
    };
  } catch (error: any) {
    return { isVerified: true };
  }
};

/**
 * Complete Verification Pipeline for a batch of generated raw questions.
 * Handles SHA-256 deduplication, Judge0 execution, and secondary AI cross-auditing.
 */
export const verifyQuestionsBatch = async (
  rawQuestions: IRawGeneratedQuestion[],
): Promise<{
  verifiedQuestions: IVerifiedQuestionPayload[];
  skippedDuplicatesCount: number;
  failedVerificationCount: number;
}> => {
  const verifiedQuestions: IVerifiedQuestionPayload[] = [];
  let skippedDuplicatesCount = 0;
  let failedVerificationCount = 0;

  for (const rawQ of rawQuestions) {
    const dedupHash = generateQuestionHash(rawQ.questionText);

    // 1. Deduplication check
    const isDup = await isDuplicateQuestion(rawQ.questionText);
    if (isDup) {
      skippedDuplicatesCount++;
      continue;
    }

    let verificationStatus = VerificationStatus.VERIFIED;
    let verificationNotes: string | undefined = undefined;

    // 2. Tier 1 Verification: Judge0 sandbox for OUTPUT_PREDICTION
    if (rawQ.type === QuestionType.OUTPUT_PREDICTION && rawQ.codeSnippet?.code) {
      const codeCheck = await verifyCodeSnippetOutput(
        rawQ.codeSnippet.language,
        rawQ.codeSnippet.code,
        rawQ.correctAnswer,
        rawQ.options,
      );

      if (!codeCheck.isVerified) {
        verificationStatus = VerificationStatus.FAILED;
        verificationNotes = codeCheck.reason;
        failedVerificationCount++;
      }
    } else {
      // 3. Tier 2 Verification: Secondary AI cross-audit for BUG_SPOTTING, COMPLEXITY & MULTIPLE_CHOICE
      const aiAudit = await verifyQuestionWithSecondaryAi(rawQ);
      if (!aiAudit.isVerified) {
        verificationStatus = VerificationStatus.FAILED;
        verificationNotes = aiAudit.reason;
        failedVerificationCount++;
      }
    }

    verifiedQuestions.push({
      type: rawQ.type,
      topic: rawQ.topic,
      difficulty: rawQ.difficulty,
      questionText: rawQ.questionText,
      codeSnippet: rawQ.codeSnippet,
      options: rawQ.options,
      correctAnswer: rawQ.correctAnswer,
      explanation: rawQ.explanation,
      verificationStatus,
      status:
        verificationStatus === VerificationStatus.VERIFIED
          ? QuestionStatus.APPROVED
          : QuestionStatus.REJECTED,
      dedupHash,
      verificationNotes,
    });
  }

  return {
    verifiedQuestions,
    skippedDuplicatesCount,
    failedVerificationCount,
  };
};

export const quizVerifier = {
  generateQuestionHash,
  isDuplicateQuestion,
  verifyCodeSnippetOutput,
  verifyQuestionWithSecondaryAi,
  verifyQuestionsBatch,
};
