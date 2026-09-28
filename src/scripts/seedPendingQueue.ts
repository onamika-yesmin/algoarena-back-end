import { connectDatabase } from "../config/database.js";
import { QuizQuestionModel } from "../models/QuizQuestion.model.js";
import { QuestionStatus, QuestionType, QuestionDifficulty, VerificationStatus } from "../modules/quiz/quiz.interface.js";
import mongoose from "mongoose";

async function seedPendingQueue() {
  await connectDatabase();

  const sampleQuestions = [
    {
      type: QuestionType.MULTIPLE_CHOICE,
      topic: "arrays",
      difficulty: QuestionDifficulty.MEDIUM,
      questionText: "What is the time complexity of searching for an element in an unsorted array of size n?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
      correctAnswer: 2,
      explanation: "Linear search requires scanning elements one by one up to n times in the worst case.",
      status: QuestionStatus.PENDING_REVIEW,
      verificationStatus: VerificationStatus.VERIFIED,
      verificationNotes: "Secondary AI Audit: Verified factual accuracy of linear search complexity.",
      dedupHash: "seed_pending_1",
    },
    {
      type: QuestionType.OUTPUT_PREDICTION,
      topic: "arrays",
      difficulty: QuestionDifficulty.EASY,
      questionText: "What will be printed by the following JavaScript code snippet?",
      codeSnippet: {
        language: "javascript",
        code: "const arr = [10, 20, 30];\nconsole.log(arr.reduce((acc, curr) => acc + curr, 0));",
      },
      options: ["60", "102030", "undefined", "0"],
      correctAnswer: 0,
      explanation: "Array.prototype.reduce computes the sum of elements: 10 + 20 + 30 = 60.",
      status: QuestionStatus.PENDING_REVIEW,
      verificationStatus: VerificationStatus.VERIFIED,
      verificationNotes: "Judge0 Sandbox Execution: Output '60' matched target choice A exactly.",
      dedupHash: "seed_pending_2",
    },
    {
      type: QuestionType.BUG_SPOTTING,
      topic: "dynamic_programming",
      difficulty: QuestionDifficulty.HARD,
      questionText: "Identify the critical flaw in this recursive Fibonacci implementation without memoization.",
      codeSnippet: {
        language: "python",
        code: "def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)",
      },
      options: [
        "Exponential time complexity O(2^n) causing stack overflow for larger n",
        "Incorrect base case returning negative numbers",
        "Syntax error in return statement",
        "Infinite loop on n=0",
      ],
      correctAnswer: 0,
      explanation: "Without memoization or dynamic programming, overlapping subproblems take O(2^n) exponential time.",
      status: QuestionStatus.PENDING_REVIEW,
      verificationStatus: VerificationStatus.VERIFIED,
      verificationNotes: "Secondary AI Audit: Factual explanation confirmed.",
      dedupHash: "seed_pending_3",
    },
    {
      type: QuestionType.COMPLEXITY,
      topic: "arrays",
      difficulty: QuestionDifficulty.MEDIUM,
      questionText: "What is the worst-case space complexity of QuickSort?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correctAnswer: 2,
      explanation: "Worst-case space complexity of QuickSort is O(n) due to unbalanced recursive call stack depth.",
      status: QuestionStatus.PENDING_REVIEW,
      verificationStatus: VerificationStatus.FAILED,
      verificationNotes: "Secondary AI Audit Warning: Note that average space is O(log n), but worst-case call stack is O(n). Needs admin review.",
      dedupHash: "seed_pending_4",
    },
  ];

  for (const q of sampleQuestions) {
    await QuizQuestionModel.findOneAndUpdate(
      { dedupHash: q.dedupHash },
      { $set: q },
      { upsert: true, new: true }
    );
  }

  const pendingCount = await QuizQuestionModel.countDocuments({ status: QuestionStatus.PENDING_REVIEW });
  console.log(`Successfully seeded sample review queue! Total pending questions awaiting review: ${pendingCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedPendingQueue().catch((err) => {
  console.error("Failed to seed pending queue:", err);
  process.exit(1);
});
