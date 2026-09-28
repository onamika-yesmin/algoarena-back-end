import express from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.middleware.js";
import { quizController } from "./quiz.controller.js";
import {
  startQuizSessionSchema,
  submitQuizAnswersSchema,
  adminGenerateBatchSchema,
  getPendingQuestionsSchema,
  reviewQuestionSchema,
  generateBatchAsyncSchema,
} from "./quiz.validation.js";

const router = express.Router();

// POST /api/quiz/start -> Auth required -> Validate payload -> Initialize session
router.post(
  "/start",
  requireAuth,
  validateRequest(startQuizSessionSchema),
  quizController.startQuiz,
);

// POST /api/quiz/:sessionId/submit -> Auth required -> Validate payload -> Grade & calculate score
router.post(
  "/:sessionId/submit",
  requireAuth,
  validateRequest(submitQuizAnswersSchema),
  quizController.submitQuiz,
);

// GET /api/quiz/:sessionId/result -> Auth required -> Load full session with explanations
router.get("/:sessionId/result", requireAuth, quizController.getQuizResult);

// POST /api/quiz/admin/generate-bulk -> Require Admin -> Validate payload -> Synchronous Bulk Pipeline
router.post(
  "/admin/generate-bulk",
  requireAuth,
  requireAdmin,
  validateRequest(adminGenerateBatchSchema),
  quizController.generateBulk,
);

// GET /api/quiz/admin/pending -> Require Admin -> Validate query -> Paginated Review Queue
router.get(
  "/admin/pending",
  requireAuth,
  requireAdmin,
  validateRequest(getPendingQuestionsSchema),
  quizController.getPendingQuestions,
);

// PATCH /api/quiz/admin/:id/review -> Require Admin -> Validate payload -> Moderation Action (approve/reject/edit)
router.patch(
  "/admin/:id/review",
  requireAuth,
  requireAdmin,
  validateRequest(reviewQuestionSchema),
  quizController.reviewQuestion,
);

// POST /api/quiz/admin/generate-batch -> Require Admin -> Validate payload -> Non-blocking Async Background Pipeline (HTTP 202)
router.post(
  "/admin/generate-batch",
  requireAuth,
  requireAdmin,
  validateRequest(generateBatchAsyncSchema),
  quizController.generateBatchAsync,
);

export const quizRouter = router;
