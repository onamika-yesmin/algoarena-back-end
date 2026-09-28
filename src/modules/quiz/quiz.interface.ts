import { Document, Types } from "mongoose";

export enum QuestionType {
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  OUTPUT_PREDICTION = "OUTPUT_PREDICTION",
  COMPLEXITY = "COMPLEXITY",
  BUG_SPOTTING = "BUG_SPOTTING",
}

export enum QuestionDifficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export enum QuestionStatus {
  PENDING_REVIEW = "pending_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  ARCHIVED = "archived",
}

export enum VerificationStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  FAILED = "failed",
}

export enum SessionMode {
  PRACTICE = "PRACTICE",
  EXAM = "EXAM",
}

export enum SessionStatus {
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  EXPIRED = "expired",
}

export interface ICodeSnippet {
  language: string;
  code: string;
}

export interface IQuestionMetrics {
  attemptsCount: number;
  correctCount: number;
  avgTimeSeconds: number;
  accuracyRate: number;
}

export interface IQuizQuestion extends Document {
  _id: Types.ObjectId;
  type: QuestionType;
  topic: string;
  difficulty: QuestionDifficulty;
  questionText: string;
  codeSnippet?: ICodeSnippet;
  options: string[];
  correctAnswer: number | string;
  explanation: string;
  verificationStatus: VerificationStatus;
  status: QuestionStatus;
  metrics: IQuestionMetrics;
  dedupHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISessionQuestion {
  questionId: Types.ObjectId;
  userAnswer?: number | string;
  isCorrect?: boolean;
  timeTakenSeconds?: number;
}

export interface IQuizSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  mode: SessionMode;
  status: SessionStatus;
  questions: ISessionQuestion[];
  score: number;
  totalQuestions: number;
  earnedGems?: number;
  startedAt: Date;
  expiresAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStartQuizRequest {
  topic: string;
  difficulty: QuestionDifficulty;
  mode: SessionMode;
  count?: number;
}

export interface IQuestionPublicResponse {
  _id: string;
  type: QuestionType;
  topic: string;
  difficulty: QuestionDifficulty;
  questionText: string;
  codeSnippet?: ICodeSnippet;
  options: string[];
}

export interface ISubmitAnswerPayload {
  questionId: string;
  userAnswer: number | string;
  timeTakenSeconds: number;
}

export interface ISubmitQuizRequest {
  answers: ISubmitAnswerPayload[];
}
