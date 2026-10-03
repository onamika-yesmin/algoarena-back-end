import mongoose, { model, Schema } from "mongoose";
import {
  IQuizSession,
  ISessionQuestion,
  SessionMode,
  SessionStatus,
} from "../modules/quiz/quiz.interface.js";

const sessionQuestionSchema = new Schema<ISessionQuestion>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "QuizQuestion",
      required: true,
    },
    userAnswer: {
      type: Schema.Types.Mixed,
    },
    isCorrect: {
      type: Boolean,
    },
    timeTakenSeconds: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const quizSessionSchema = new Schema<IQuizSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: Object.values(SessionMode),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.IN_PROGRESS,
      index: true,
    },
    questions: {
      type: [sessionQuestionSchema],
      required: true,
      default: [],
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    earnedGems: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

quizSessionSchema.index({ userId: 1, createdAt: -1 });

quizSessionSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const QuizSessionModel =
  mongoose.models.QuizSession ||
  model<IQuizSession>("QuizSession", quizSessionSchema);
