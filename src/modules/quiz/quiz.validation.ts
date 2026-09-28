import { Types } from "mongoose";
import { z } from "zod";
import {
  QuestionDifficulty,
  QuestionType,
  SessionMode,
} from "./quiz.interface.js";

const isValidObjectId = (val: string) => Types.ObjectId.isValid(val);

export const startQuizSessionSchema = z.object({
  body: z
    .object({
      topic: z
        .string({ required_error: "Topic is required" })
        .min(1, "Topic cannot be empty")
        .trim()
        .toLowerCase(),
      difficulty: z.nativeEnum(QuestionDifficulty, {
        errorMap: () => ({
          message: "Difficulty must be EASY, MEDIUM, or HARD",
        }),
      }),
      mode: z.nativeEnum(SessionMode, {
        errorMap: () => ({
          message: "Mode must be PRACTICE or EXAM",
        }),
      }),
      count: z
        .number()
        .int("Count must be an integer")
        .min(1, "Count must be at least 1")
        .optional()
        .default(5),
    })
    .superRefine((data, ctx) => {
      const maxAllowed = data.mode === SessionMode.EXAM ? 50 : 100;
      if (data.count > maxAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${data.mode} mode count cannot exceed ${maxAllowed} questions`,
          path: ["count"],
        });
      }
    }),
});

export const submitQuizAnswersSchema = z.object({
  params: z.object({
    sessionId: z
      .string({ required_error: "Session ID is required" })
      .refine(isValidObjectId, { message: "Invalid session ID format" }),
  }),
  body: z.object({
    answers: z
      .array(
        z.object({
          questionId: z
            .string({ required_error: "Question ID is required" })
            .refine(isValidObjectId, { message: "Invalid question ID format" }),
          userAnswer: z.union([z.number(), z.string()], {
            errorMap: () => ({
              message: "User answer must be a number or string",
            }),
          }),
          timeTakenSeconds: z
            .number()
            .min(0, "Time taken cannot be negative")
            .default(0),
        }),
      )
      .min(1, "At least one answer must be submitted"),
  }),
});

export const adminGenerateBatchSchema = z.object({
  body: z.object({
    topic: z
      .string({ required_error: "Topic is required" })
      .min(1, "Topic cannot be empty")
      .trim()
      .toLowerCase(),
    difficulty: z.nativeEnum(QuestionDifficulty, {
      errorMap: () => ({
        message: "Difficulty must be EASY, MEDIUM, or HARD",
      }),
    }),
    count: z
      .number()
      .int("Count must be an integer")
      .min(1, "Count must be at least 1")
      .max(20, "Count cannot exceed 20 questions")
      .optional()
      .default(10),
  }),
});

export const getPendingQuestionsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : 10)),
    topic: z.string().optional(),
    difficulty: z.nativeEnum(QuestionDifficulty).optional(),
  }),
});

export const reviewQuestionSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: "Question ID is required" })
      .refine(isValidObjectId, { message: "Invalid question ID format" }),
  }),
  body: z.object({
    action: z.enum(["approve", "reject", "edit"], {
      errorMap: () => ({
        message: "Action must be approve, reject, or edit",
      }),
    }),
    updateData: z
      .object({
        questionText: z.string().optional(),
        options: z.array(z.string()).min(2).optional(),
        correctAnswer: z.union([z.number(), z.string()]).optional(),
        explanation: z.string().optional(),
        codeSnippet: z
          .object({
            language: z.string(),
            code: z.string(),
          })
          .optional(),
        topic: z.string().optional(),
        difficulty: z.nativeEnum(QuestionDifficulty).optional(),
      })
      .optional(),
  }),
});

export const generateBatchAsyncSchema = z.object({
  body: z.object({
    topic: z
      .string({ required_error: "Topic is required" })
      .min(1, "Topic cannot be empty")
      .trim()
      .toLowerCase(),
    difficulty: z.nativeEnum(QuestionDifficulty, {
      errorMap: () => ({
        message: "Difficulty must be EASY, MEDIUM, or HARD",
      }),
    }),
    count: z
      .number()
      .int("Count must be an integer")
      .min(1, "Count must be at least 1")
      .max(20, "Count cannot exceed 20 questions")
      .optional()
      .default(10),
    type: z.nativeEnum(QuestionType).optional(),
  }),
});
