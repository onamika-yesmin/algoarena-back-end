import express from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.middleware.js";
import { quizController } from "./quiz.controller.js";
import {
  startQuizSessionSchema,
  submitQuizAnswersSchema,
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

export const quizRouter = router;
