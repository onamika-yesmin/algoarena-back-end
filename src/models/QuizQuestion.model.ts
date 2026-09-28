import mongoose, { model, Schema } from "mongoose";
import {
  IQuizQuestion,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  VerificationStatus,
} from "../modules/quiz/quiz.interface.js";

const codeSnippetSchema = new Schema(
  {
    language: { type: String, required: true },
    code: { type: String, required: true },
  },
  { _id: false },
);

const questionMetricsSchema = new Schema(
  {
    attemptsCount: { type: Number, default: 0, min: 0 },
    correctCount: { type: Number, default: 0, min: 0 },
    avgTimeSeconds: { type: Number, default: 0, min: 0 },
    accuracyRate: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const quizQuestionSchema = new Schema<IQuizQuestion>(
  {
    type: {
      type: String,
      enum: Object.values(QuestionType),
      required: true,
    },
    topic: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: Object.values(QuestionDifficulty),
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    codeSnippet: {
      type: codeSnippetSchema,
      required: false,
    },
    options: {
      type: [String],
      required: true,
      validate: [
        (val: string[]) => val.length >= 2,
        "A question must have at least 2 options",
      ],
    },
    correctAnswer: {
      type: Schema.Types.Mixed,
      required: true,
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING,
    },
    status: {
      type: String,
      enum: Object.values(QuestionStatus),
      default: QuestionStatus.PENDING_REVIEW,
      index: true,
    },
    metrics: {
      type: questionMetricsSchema,
      default: () => ({
        attemptsCount: 0,
        correctCount: 0,
        avgTimeSeconds: 0,
        accuracyRate: 0,
      }),
    },
    dedupHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// High-speed compound index for random question sampling ($sample)
quizQuestionSchema.index({ status: 1, topic: 1, difficulty: 1 });

quizQuestionSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const QuizQuestionModel =
  mongoose.models.QuizQuestion ||
  model<IQuizQuestion>("QuizQuestion", quizQuestionSchema);
