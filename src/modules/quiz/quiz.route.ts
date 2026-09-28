import express from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.middleware.js";
import { quizController } from "./quiz.controller.js";
import {
  startQuizSessionSchema,
  submitQuizAnswersSchema,
  adminGenerateBatchSchema,
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

// POST /api/quiz/admin/generate-bulk -> Require Admin -> Validate payload -> Run AI Generation & Verification Pipeline
router.post(
  "/admin/generate-bulk",
  requireAuth,
  requireAdmin,
  validateRequest(adminGenerateBatchSchema),
  quizController.generateBulk,
);

export const quizRouter = router;
