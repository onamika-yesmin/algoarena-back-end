import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { QuizQuestionModel } from "../models/QuizQuestion.model.js";
import {
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  VerificationStatus,
} from "../modules/quiz/quiz.interface.js";

const generateHash = (text: string): string => {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
};

const quizQuestionsSeed = [
  // 1. Time Complexity - Easy - MCQ
  {
    type: QuestionType.MULTIPLE_CHOICE,
    topic: "time-complexity",
    difficulty: QuestionDifficulty.EASY,
    questionText: "What is the time complexity of looking up a value in a standard Hash Table on average?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
    correctAnswer: 0,
    explanation: "Average time complexity for hash table lookups is O(1) assuming a uniform hash distribution.",
  },
  // 2. Time Complexity - Medium - Complexity
  {
    type: QuestionType.COMPLEXITY,
    topic: "time-complexity",
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: "What is the worst-case time complexity of Quick Sort?",
    codeSnippet: {
      language: "javascript",
      code: "function quickSort(arr) {\n  if (arr.length <= 1) return arr;\n  const pivot = arr[0];\n  const left = arr.slice(1).filter(x => x < pivot);\n  const right = arr.slice(1).filter(x => x >= pivot);\n  return [...quickSort(left), pivot, ...quickSort(right)];\n}",
    },
    options: ["O(n log n)", "O(n^2)", "O(n)", "O(2^n)"],
    correctAnswer: 1,
    explanation: "In the worst case (e.g., already sorted array with poor pivot selection), Quick Sort degrades to O(n^2).",
  },
  // 3. Time Complexity - Hard - Complexity
  {
    type: QuestionType.COMPLEXITY,
    topic: "time-complexity",
    difficulty: QuestionDifficulty.HARD,
    questionText: "What is the time complexity of Matrix Multiplication using Strassen's Algorithm?",
    options: ["O(n^3)", "O(n^2.807)", "O(n log n)", "O(n^2)"],
    correctAnswer: 1,
    explanation: "Strassen's algorithm reduces 8 recursive matrix multiplications to 7, resulting in O(n^log2(7)) ≈ O(n^2.807).",
  },
  // 4. Arrays - Easy - Output Prediction
  {
    type: QuestionType.OUTPUT_PREDICTION,
    topic: "arrays",
    difficulty: QuestionDifficulty.EASY,
    questionText: "What will be printed to the console after executing this code?",
    codeSnippet: {
      language: "javascript",
      code: "const arr = [10, 20, 30];\narr[5] = 60;\nconsole.log(arr.length);",
    },
    options: ["3", "4", "6", "undefined"],
    correctAnswer: 2,
    explanation: "Assigning to index 5 creates empty slots between indices 2 and 5, setting length to 6.",
  },
  // 5. Arrays - Medium - Bug Spotting
  {
    type: QuestionType.BUG_SPOTTING,
    topic: "arrays",
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: "Where is the logical bug in this array search code?",
    codeSnippet: {
      language: "javascript",
      code: "function findElement(arr, target) {\n  for (let i = 0; i <= arr.length; i++) {\n    if (arr[i] === target) return i;\n  }\n  return -1;\n}",
    },
    options: [
      "Loop condition includes arr.length, causing index out-of-bounds check",
      "Function returns -1 when target is found",
      "Equality operator === should be ===",
      "Target is not converted to integer",
    ],
    correctAnswer: 0,
    explanation: "The loop condition i <= arr.length attempts to access arr[arr.length], which is undefined.",
  },
  // 6. Async JS - Easy - MCQ
  {
    type: QuestionType.MULTIPLE_CHOICE,
    topic: "async-js",
    difficulty: QuestionDifficulty.EASY,
    questionText: "Which method is called when a Promise is successfully resolved?",
    options: [".then()", ".catch()", ".finally()", ".resolve()"],
    correctAnswer: 0,
    explanation: "The `.then()` handler is registered to execute upon fulfillment (resolution) of a Promise.",
  },
  // 7. Async JS - Medium - Output Prediction
  {
    type: QuestionType.OUTPUT_PREDICTION,
    topic: "async-js",
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: "What is the order of logged numbers in the console?",
    codeSnippet: {
      language: "javascript",
      code: "console.log('1');\nsetTimeout(() => console.log('2'), 0);\nPromise.resolve().then(() => console.log('3'));\nconsole.log('4');",
    },
    options: ["1, 2, 3, 4", "1, 4, 3, 2", "1, 4, 2, 3", "4, 1, 3, 2"],
    correctAnswer: 1,
    explanation: "Synchronous code (1, 4) executes first. Microtasks (Promise 3) execute before Macrotasks (setTimeout 2).",
  },
  // 8. Dynamic Programming - Medium - MCQ
  {
    type: QuestionType.MULTIPLE_CHOICE,
    topic: "dynamic-programming",
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: "What two properties must a problem have for Dynamic Programming to be applicable?",
    options: [
      "Optimal Substructure & Overlapping Subproblems",
      "Sorted Input & Binary Searchability",
      "Greedy Choice Property & Divide and Conquer",
      "Linear Space & Constant Time",
    ],
    correctAnswer: 0,
    explanation: "DP requires optimal solution to be constructible from subproblems (optimal substructure) and repeated subproblems (overlapping).",
  },
  // 9. Dynamic Programming - Hard - Complexity
  {
    type: QuestionType.COMPLEXITY,
    topic: "dynamic-programming",
    difficulty: QuestionDifficulty.HARD,
    questionText: "What is the space complexity of 0/1 Knapsack with memoization table of size N x W?",
    options: ["O(N)", "O(W)", "O(N * W)", "O(2^N)"],
    correctAnswer: 2,
    explanation: "The 2D memoization table requires N rows and W columns, taking O(N * W) auxiliary space.",
  },
  // 10. Strings - Easy - Output Prediction
  {
    type: QuestionType.OUTPUT_PREDICTION,
    topic: "strings",
    difficulty: QuestionDifficulty.EASY,
    questionText: "What does this code output?",
    codeSnippet: {
      language: "javascript",
      code: "const str = 'AlgoArena';\nconsole.log(str.slice(-5));",
    },
    options: ["Algo", "Arena", "AlgoA", "undefined"],
    correctAnswer: 1,
    explanation: "A negative index in String.prototype.slice counts backwards from the end. Length 9 - 5 = index 4 ('Arena').",
  },
  // 11. Data Structures - Easy - MCQ
  {
    type: QuestionType.MULTIPLE_CHOICE,
    topic: "data-structures",
    difficulty: QuestionDifficulty.EASY,
    questionText: "Which data structure operates on a Last In, First Out (LIFO) order?",
    options: ["Queue", "Stack", "Linked List", "Tree"],
    correctAnswer: 1,
    explanation: "Stack is a LIFO structure where the last added element is the first one removed.",
  },
  // 12. Data Structures - Medium - MCQ
  {
    type: QuestionType.MULTIPLE_CHOICE,
    topic: "data-structures",
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: "Which binary tree traversal visits nodes in non-decreasing order for a Binary Search Tree (BST)?",
    options: ["Pre-order", "In-order", "Post-order", "Level-order"],
    correctAnswer: 1,
    explanation: "In-order traversal (Left, Root, Right) visits BST nodes in sorted ascending order.",
  },
  // 13. Data Structures - Hard - Complexity
  {
    type: QuestionType.COMPLEXITY,
    topic: "data-structures",
    difficulty: QuestionDifficulty.HARD,
    questionText: "What is the worst-case search time complexity in a Red-Black Tree?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctAnswer: 1,
    explanation: "Red-Black Trees guarantee O(log n) height balance, ensuring O(log n) worst-case search time.",
  },
  // 14. Bug Spotting - Easy - Bug Spotting
  {
    type: QuestionType.BUG_SPOTTING,
    topic: "arrays",
    difficulty: QuestionDifficulty.EASY,
    questionText: "Why does this array comparison evaluate to false?",
    codeSnippet: {
      language: "javascript",
      code: "const a = [1, 2];\nconst b = [1, 2];\nconsole.log(a === b);",
    },
    options: [
      "Arrays are objects and compared by reference, not value",
      "Triple equals is not supported for arrays",
      "The elements must be strings",
      "Array constructor mismatch",
    ],
    correctAnswer: 0,
    explanation: "In JS, arrays are reference types. 'a' and 'b' point to distinct memory addresses.",
  },
  // 15. Async JS - Hard - Output Prediction
  {
    type: QuestionType.OUTPUT_PREDICTION,
    topic: "async-js",
    difficulty: QuestionDifficulty.HARD,
    questionText: "What gets printed to the console?",
    codeSnippet: {
      language: "javascript",
      code: "async function test() {\n  return 42;\n}\nconsole.log(typeof test());",
    },
    options: ["number", "object", "undefined", "function"],
    correctAnswer: 1,
    explanation: "Async functions always return a Promise object (typeof Promise instance is 'object').",
  },
  // 16. Strings - Medium - Output Prediction
  {
    type: QuestionType.OUTPUT_PREDICTION,
    topic: "strings",
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: "What does this code output?",
    codeSnippet: {
      language: "javascript",
      code: "const word = 'racecar';\nconst reversed = word.split('').reverse().join('');\nconsole.log(word === reversed);",
    },
    options: ["true", "false", "TypeError", "undefined"],
    correctAnswer: 0,
    explanation: "'racecar' is a palindrome. Splitting, reversing, and joining yields 'racecar', which equals the original string.",
  },
  // 17. Time Complexity - Easy - MCQ
  {
    type: QuestionType.MULTIPLE_CHOICE,
    topic: "time-complexity",
    difficulty: QuestionDifficulty.EASY,
    questionText: "What is the space complexity of an algorithm that uses a single loop with 3 scalar variables?",
    options: ["O(1)", "O(n)", "O(3)", "O(n^2)"],
    correctAnswer: 0,
    explanation: "Constant auxiliary memory usage evaluates to O(1) space complexity.",
  },
  // 18. Dynamic Programming - Easy - MCQ
  {
    type: QuestionType.MULTIPLE_CHOICE,
    topic: "dynamic-programming",
    difficulty: QuestionDifficulty.EASY,
    questionText: "What technique stores previous subproblem results to avoid redundant calculations?",
    options: ["Memoization", "Recursion", "Backtracking", "Iteration"],
    correctAnswer: 0,
    explanation: "Memoization (top-down) caches subproblem answers to optimize recursive calls.",
  },
  // 19. Bug Spotting - Hard - Bug Spotting
  {
    type: QuestionType.BUG_SPOTTING,
    topic: "async-js",
    difficulty: QuestionDifficulty.HARD,
    questionText: "Identify the critical concurrency issue in this batch processor:",
    codeSnippet: {
      language: "javascript",
      code: "async function processItems(items) {\n  items.forEach(async (item) => {\n    await saveItem(item);\n  });\n  console.log('All saved');\n}",
    },
    options: [
      "forEach does not wait for async promises; 'All saved' logs before saves complete",
      "saveItem requires a callback function",
      "async functions cannot be passed to forEach",
      "items array is mutated during iteration",
    ],
    correctAnswer: 0,
    explanation: "Array.prototype.forEach ignores returned Promises. Use `for...of` or `Promise.all(items.map(...))` to await async completions.",
  },
  // 20. Arrays - Medium - Output Prediction
  {
    type: QuestionType.OUTPUT_PREDICTION,
    topic: "arrays",
    difficulty: QuestionDifficulty.MEDIUM,
    questionText: "What is the output of this array mapping code?",
    codeSnippet: {
      language: "javascript",
      code: "const nums = [1, 2, 3];\nconst res = nums.map(x => x * 2).filter(x => x > 4);\nconsole.log(res);",
    },
    options: ["[6]", "[4, 6]", "[2, 4, 6]", "[]"],
    correctAnswer: 0,
    explanation: "Mapping doubles nums to [2, 4, 6]. Filtering x > 4 leaves only [6].",
  },
];

async function seedQuizzes() {
  try {
    console.log("[Seed Quizzes] Connecting to database...");
    await connectDatabase();

    console.log(`[Seed Quizzes] Seeding ${quizQuestionsSeed.length} quiz questions...`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const qData of quizQuestionsSeed) {
      const dedupHash = generateHash(qData.questionText);

      const result = await QuizQuestionModel.findOneAndUpdate(
        { dedupHash },
        {
          ...qData,
          verificationStatus: VerificationStatus.VERIFIED,
          status: QuestionStatus.APPROVED,
          dedupHash,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      if (result) {
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      }
    }

    console.log(
      `[Seed Quizzes] Complete! ${insertedCount} inserted, ${updatedCount} updated. Total ready in DB: ${quizQuestionsSeed.length}`,
    );

    await mongoose.disconnect();
    console.log("[Seed Quizzes] Database disconnected.");
    process.exit(0);
  } catch (error) {
    console.error("[Seed Quizzes] Error during quiz seeding:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedQuizzes();
