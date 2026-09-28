import { Types } from "mongoose";
import { QuizQuestionModel } from "../../models/QuizQuestion.model.js";
import { QuizSessionModel } from "../../models/QuizSession.model.js";
import { UserModel } from "../../models/User.model.js";
import { AppError } from "../../utils/errors.js";
import {
  IQuestionPublicResponse,
  IStartQuizRequest,
  ISubmitAnswerPayload,
  IQuizQuestion,
  ISessionQuestion,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  VerificationStatus,
  SessionMode,
  SessionStatus,
} from "./quiz.interface.js";
import { quizGenerator } from "./quiz.generator.js";
import { quizVerifier } from "./quiz.verifier.js";

// Seconds per question by difficulty for EXAM mode timers
const SECONDS_PER_QUESTION: Record<QuestionDifficulty, number> = {
  [QuestionDifficulty.EASY]: 60,
  [QuestionDifficulty.MEDIUM]: 75,
  [QuestionDifficulty.HARD]: 90,
};

// Points per correct answer by difficulty
const POINTS_PER_QUESTION: Record<QuestionDifficulty, number> = {
  [QuestionDifficulty.EASY]: 2,
  [QuestionDifficulty.MEDIUM]: 3,
  [QuestionDifficulty.HARD]: 5,
};

// Max Gems awarded for a 100% perfect exam score
const MAX_GEMS_BY_DIFFICULTY: Record<QuestionDifficulty, number> = {
  [QuestionDifficulty.EASY]: 3,
  [QuestionDifficulty.MEDIUM]: 5,
  [QuestionDifficulty.HARD]: 10,
};

/**
 * 1. Start a new quiz session (Practice or Exam)
 * - Queries approved questions using MongoDB $sample
 * - Strips secret fields (correctAnswer & explanation)
 * - Sets dynamic timer (expiresAt) for EXAM mode based on question difficulty
 */
export const startQuizSession = async (
  userId: string,
  payload: IStartQuizRequest,
) => {
  const { topic, difficulty, mode, count = 5 } = payload;
  const targetCount = Number(count) || 5;

  const samplePipeline = [
    {
      $match: {
        status: QuestionStatus.APPROVED,
        topic: topic.toLowerCase().trim(),
        difficulty: difficulty,
      },
    },
    { $sample: { size: targetCount } },
  ];

  const questions: IQuizQuestion[] =
    await QuizQuestionModel.aggregate(samplePipeline);

  if (!questions || questions.length === 0) {
    throw new AppError(
      `No approved quiz questions found for topic '${topic}' with difficulty '${difficulty}'`,
      404,
    );
  }

  // Dynamic timer calculation for EXAM mode based on question difficulty
  let expiresAt: Date | undefined = undefined;
  if (mode === SessionMode.EXAM) {
    const timePerQuestionSeconds = SECONDS_PER_QUESTION[difficulty] || 60;
    const totalDurationSeconds = questions.length * timePerQuestionSeconds;
    expiresAt = new Date(Date.now() + totalDurationSeconds * 1000);
  }

  const sessionQuestionRefs = questions.map((q) => ({
    questionId: q._id,
    timeTakenSeconds: 0,
  }));

  const session = await QuizSessionModel.create({
    userId: new Types.ObjectId(userId),
    mode,
    status: SessionStatus.IN_PROGRESS,
    questions: sessionQuestionRefs,
    score: 0,
    totalQuestions: questions.length,
    startedAt: new Date(),
    expiresAt,
  });

  const sanitizedQuestions: IQuestionPublicResponse[] = questions.map((q) => ({
    _id: String(q._id),
    type: q.type,
    topic: q.topic,
    difficulty: q.difficulty,
    questionText: q.questionText,
    codeSnippet: q.codeSnippet,
    options: q.options,
  }));

  return {
    sessionId: String(session._id),
    mode: session.mode,
    status: session.status,
    totalQuestions: session.totalQuestions,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    questions: sanitizedQuestions,
  };
};

/**
 * 2. Submit user answers & complete quiz session
 * - Scores and Gems are calculated ONLY in EXAM mode
 * - In PRACTICE mode: score = 0, earnedGems = 0
 */
export const submitQuizAnswers = async (
  userId: string,
  sessionId: string,
  userAnswers: ISubmitAnswerPayload[],
) => {
  const session = await QuizSessionModel.findOne({
    _id: sessionId,
    userId: new Types.ObjectId(userId),
  });

  if (!session) {
    throw new AppError("Quiz session not found", 404);
  }

  if (session.status === SessionStatus.COMPLETED) {
    throw new AppError("This quiz session has already been completed", 400);
  }

  if (
    session.mode === SessionMode.EXAM &&
    session.expiresAt &&
    new Date() > new Date(session.expiresAt)
  ) {
    session.status = SessionStatus.EXPIRED;
    await session.save();
    throw new AppError("Quiz session time limit has expired", 400);
  }

  const questionIds = session.questions.map(
    (q: ISessionQuestion) => q.questionId,
  );
  const questionsDB = await QuizQuestionModel.find({
    _id: { $in: questionIds },
  });

  const questionMap = new Map<string, IQuizQuestion>();
  questionsDB.forEach((q) => questionMap.set(String(q._id), q));

  let totalScore = 0;
  let maxPossibleScore = 0;
  let correctCount = 0;
  const userAnswersMap = new Map<string, ISubmitAnswerPayload>();
  userAnswers.forEach((a) => userAnswersMap.set(String(a.questionId), a));

  const updatedSessionQuestions: ISessionQuestion[] = [];

  for (const item of session.questions) {
    const qIdStr = String(item.questionId);
    const dbQuestion = questionMap.get(qIdStr);
    const submitted = userAnswersMap.get(qIdStr);

    if (!dbQuestion) continue;

    const userAnswerVal = submitted?.userAnswer;
    const timeTaken = submitted?.timeTakenSeconds ?? 0;
    const qPoints = POINTS_PER_QUESTION[dbQuestion.difficulty] || 2;
    maxPossibleScore += qPoints;

    const isCorrect =
      userAnswerVal !== undefined &&
      userAnswerVal !== null &&
      String(userAnswerVal).trim() === String(dbQuestion.correctAnswer).trim();

    if (isCorrect) {
      correctCount++;
      if (session.mode === SessionMode.EXAM) {
        totalScore += qPoints;
      }
    }

    updatedSessionQuestions.push({
      questionId: item.questionId,
      userAnswer: userAnswerVal,
      isCorrect,
      timeTakenSeconds: timeTaken,
    });

    const newAttempts = (dbQuestion.metrics?.attemptsCount || 0) + 1;
    const newCorrect =
      (dbQuestion.metrics?.correctCount || 0) + (isCorrect ? 1 : 0);
    const newAccuracy = Math.round((newCorrect / newAttempts) * 100);

    await QuizQuestionModel.updateOne(
      { _id: dbQuestion._id },
      {
        $inc: {
          "metrics.attemptsCount": 1,
          "metrics.correctCount": isCorrect ? 1 : 0,
        },
        $set: {
          "metrics.accuracyRate": newAccuracy,
        },
      },
    );
  }

  // Calculate Gems ONLY for EXAM mode based on score percentage and 10 Gems/day cap
  let earnedGems = 0;
  if (session.mode === SessionMode.EXAM && maxPossibleScore > 0) {
    const primaryDifficulty =
      (questionsDB[0]?.difficulty as QuestionDifficulty) ||
      QuestionDifficulty.EASY;
    const maxGemsForExam = MAX_GEMS_BY_DIFFICULTY[primaryDifficulty] || 3;
    const percentage = totalScore / maxPossibleScore;
    const potentialGems = Math.floor(percentage * maxGemsForExam);

    if (potentialGems > 0) {
      // Check gems already earned today from exam sessions
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const todaysExamSessions = await QuizSessionModel.find({
        userId: new Types.ObjectId(userId),
        mode: SessionMode.EXAM,
        status: SessionStatus.COMPLETED,
        completedAt: { $gte: startOfToday },
      });

      const gemsEarnedToday = todaysExamSessions.reduce(
        (sum, s) => sum + (s.earnedGems || 0),
        0,
      );

      const DAILY_MAX_QUIZ_GEMS = 10;
      const remainingDailyGems = Math.max(
        0,
        DAILY_MAX_QUIZ_GEMS - gemsEarnedToday,
      );

      earnedGems = Math.min(potentialGems, remainingDailyGems);

      if (earnedGems > 0) {
        await UserModel.findByIdAndUpdate(userId, {
          $inc: { gems: earnedGems },
        });
      }
    }
  }

  session.questions = updatedSessionQuestions;
  session.score = session.mode === SessionMode.EXAM ? totalScore : 0;
  session.earnedGems = earnedGems;
  session.status = SessionStatus.COMPLETED;
  session.completedAt = new Date();
  await session.save();

  return {
    sessionId: String(session._id),
    status: session.status,
    mode: session.mode,
    score: session.score,
    maxPossibleScore: session.mode === SessionMode.EXAM ? maxPossibleScore : 0,
    correctCount,
    totalQuestions: session.totalQuestions,
    earnedGems,
    completedAt: session.completedAt,
  };
};

/**
 * 3. Get full quiz session breakdown & explanations (Review/Practice Mode)
 * - Returns session detail with populated questions including explanations
 */
export const getQuizSessionResult = async (
  userId: string,
  sessionId: string,
) => {
  const session = await QuizSessionModel.findOne({
    _id: sessionId,
    userId: new Types.ObjectId(userId),
  });

  if (!session) {
    throw new AppError("Quiz session not found", 404);
  }

  const questionIds = session.questions.map(
    (q: ISessionQuestion) => q.questionId,
  );
  const questionsDB = await QuizQuestionModel.find({
    _id: { $in: questionIds },
  });

  const questionMap = new Map<string, IQuizQuestion>();
  questionsDB.forEach((q) => questionMap.set(String(q._id), q));

  const detailedQuestions = session.questions.map((item: ISessionQuestion) => {
    const qIdStr = String(item.questionId);
    const dbQuestion = questionMap.get(qIdStr);

    return {
      questionId: qIdStr,
      type: dbQuestion?.type,
      topic: dbQuestion?.topic,
      difficulty: dbQuestion?.difficulty,
      questionText: dbQuestion?.questionText,
      codeSnippet: dbQuestion?.codeSnippet,
      options: dbQuestion?.options ?? [],
      correctAnswer: dbQuestion?.correctAnswer,
      explanation: dbQuestion?.explanation,
      userAnswer: item.userAnswer,
      isCorrect: item.isCorrect,
      timeTakenSeconds: item.timeTakenSeconds,
    };
  });

  return {
    sessionId: String(session._id),
    mode: session.mode,
    status: session.status,
    score: session.score,
    totalQuestions: session.totalQuestions,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    completedAt: session.completedAt,
    questions: detailedQuestions,
  };
};

/**
 * 4. Bulk Question Generation & Ingestion Pipeline (Admin Workflow)
 * - Generates questions via quizGenerator
 * - Runs two-tier verification via quizVerifier (Judge0 sandbox & Secondary AI audit)
 * - Saves verified questions into MongoDB with status 'pending_review'
 */
export const generateAndIngestQuizBatch = async (options: {
  topic: string;
  difficulty: QuestionDifficulty;
  count?: number;
  type?: QuestionType;
}) => {
  // Step 1: Generate batch using AI generator
  const genResult = await quizGenerator.generateQuestionsBatch(options);

  // Step 2: Run verification pipeline (Deduplication + Judge0 + Secondary AI)
  const verifyResult = await quizVerifier.verifyQuestionsBatch(
    genResult.questions,
  );

  let insertedDocs: IQuizQuestion[] = [];
  if (verifyResult.verifiedQuestions.length > 0) {
    // Step 3: Insert verified questions into MongoDB
    insertedDocs = (await QuizQuestionModel.insertMany(
      verifyResult.verifiedQuestions,
    )) as unknown as IQuizQuestion[];
  }

  return {
    requestedCount: genResult.requestedCount,
    generatedCount: genResult.questions.length,
    insertedCount: insertedDocs.length,
    skippedDuplicatesCount: verifyResult.skippedDuplicatesCount,
    failedVerificationCount: verifyResult.failedVerificationCount,
    questions: insertedDocs,
  };
};

/**
 * 5. Get Paginated Pending Quiz Questions (Admin Queue)
 * - Returns questions filtered by status 'pending_review'
 */
export const getPendingQuizQuestions = async (query: {
  page?: number;
  limit?: number;
  topic?: string;
  difficulty?: QuestionDifficulty;
}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    status: QuestionStatus.PENDING_REVIEW,
  };

  if (query.topic) {
    filter.topic = query.topic.trim().toLowerCase();
  }
  if (query.difficulty) {
    filter.difficulty = query.difficulty;
  }

  const [total, questions] = await Promise.all([
    QuizQuestionModel.countDocuments(filter),
    QuizQuestionModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    questions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export type ReviewAction = "approve" | "reject" | "edit";

export interface IEditQuizQuestionPayload {
  questionText?: string;
  options?: string[];
  correctAnswer?: number | string;
  explanation?: string;
  codeSnippet?: { language: string; code: string };
  topic?: string;
  difficulty?: QuestionDifficulty;
}

/**
 * 6. Review Quiz Question (Admin Moderation Action)
 * - Action 'approve': Sets status to 'approved'
 * - Action 'reject': Sets status to 'rejected'
 * - Action 'edit': Updates question fields and sets status to 'approved'
 */
export const reviewQuizQuestion = async (
  questionId: string,
  action: ReviewAction,
  updateData?: IEditQuizQuestionPayload,
) => {
  if (!Types.ObjectId.isValid(questionId)) {
    throw new AppError("Invalid question ID format", 400);
  }

  const question = await QuizQuestionModel.findById(questionId);
  if (!question) {
    throw new AppError("Quiz question not found", 404);
  }

  if (action === "approve") {
    question.status = QuestionStatus.APPROVED;
    question.verificationStatus = VerificationStatus.VERIFIED;
  } else if (action === "reject") {
    question.status = QuestionStatus.REJECTED;
  } else if (action === "edit") {
    if (updateData?.questionText) question.questionText = updateData.questionText.trim();
    if (updateData?.options && Array.isArray(updateData.options)) {
      question.options = updateData.options.map((o) => String(o).trim());
    }
    if (updateData?.correctAnswer !== undefined) {
      question.correctAnswer = updateData.correctAnswer;
    }
    if (updateData?.explanation) question.explanation = updateData.explanation.trim();
    if (updateData?.codeSnippet) question.codeSnippet = updateData.codeSnippet;
    if (updateData?.topic) question.topic = updateData.topic.trim().toLowerCase();
    if (updateData?.difficulty) question.difficulty = updateData.difficulty;

    question.status = QuestionStatus.APPROVED;
    question.verificationStatus = VerificationStatus.VERIFIED;
  } else {
    throw new AppError("Invalid review action", 400);
  }

  await question.save();
  return question;
};

/**
 * 7. Non-blocking Async Quiz Generation Trigger (Background Worker)
 * - Returns immediately to HTTP caller, runs pipeline in background setImmediate task
 */
export const triggerAsyncQuizGeneration = (options: {
  topic: string;
  difficulty: QuestionDifficulty;
  count?: number;
  type?: QuestionType;
}) => {
  setImmediate(async () => {
    try {
      console.log(
        `[Quiz Background Worker] Starting batch generation: topic=${options.topic}, difficulty=${options.difficulty}...`,
      );
      const result = await generateAndIngestQuizBatch(options);
      console.log(
        `[Quiz Background Worker] Success: ${result.insertedCount} questions verified & added to review queue.`,
      );
    } catch (err: any) {
      console.error(
        `[Quiz Background Worker Error]: ${err?.message || err}`,
      );
    }
  });
};
