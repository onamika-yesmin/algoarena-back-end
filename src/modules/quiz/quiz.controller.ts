import type { Response } from "express";
import httpStatus from "http-status";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";
import {
  startQuizSession,
  submitQuizAnswers,
  getQuizSessionResult,
  generateAndIngestQuizBatch,
} from "./quiz.service.js";
import { IStartQuizRequest, ISubmitQuizRequest } from "./quiz.interface.js";

/**
 * POST /api/quiz/start
 * - Initializes a new quiz session (Practice or Exam)
 * - Returns sanitized questions (without correctAnswer and explanation)
 */
const startQuiz = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = String(req.user?._id);
    if (!userId || userId === "undefined") {
      throw new AppError("Authentication required", 401);
    }

    const payload = req.body as IStartQuizRequest;
    const result = await startQuizSession(userId, payload);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Quiz session started successfully",
      data: result,
    });
  },
);

/**
 * POST /api/quiz/:sessionId/submit
 * - Submits user answers for an active session
 * - Grades responses, enforces timers, and calculates scores/gems
 */
const submitQuiz = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = String(req.user?._id);
    if (!userId || userId === "undefined") {
      throw new AppError("Authentication required", 401);
    }

    const sessionId = req.params.sessionId as string;
    const { answers } = req.body as ISubmitQuizRequest;

    const result = await submitQuizAnswers(userId, sessionId, answers);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Quiz answers submitted successfully",
      data: result,
    });
  },
);

/**
 * GET /api/quiz/:sessionId/result
 * - Fetches session breakdown including question explanations for review
 */
const getQuizResult = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = String(req.user?._id);
    if (!userId || userId === "undefined") {
      throw new AppError("Authentication required", 401);
    }

    const sessionId = req.params.sessionId as string;
    const result = await getQuizSessionResult(userId, sessionId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Quiz session result loaded successfully",
      data: result,
    });
  },
);

/**
 * POST /api/quiz/admin/generate-bulk
 * - Admin trigger for AI bulk question generation & verification pipeline
 */
const generateBulk = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { topic, difficulty, count, type } = req.body;
    const result = await generateAndIngestQuizBatch({
      topic,
      difficulty,
      count,
      type,
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: `AI Quiz generation complete. ${result.insertedCount} questions verified and stored.`,
      data: result,
    });
  },
);

export const quizController = {
  startQuiz,
  submitQuiz,
  getQuizResult,
  generateBulk,
};
