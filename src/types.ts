export type StudyTab = 'home' | 'quiz' | 'recite' | 'wrong';

export type QuestionType = '判断' | '单选' | '多选' | '填空';

export type BankSource = '本地 Excel' | '微信 Excel' | '应用分享';

export type QuestionOption = {
  key: string;
  text: string;
};

export type QuestionBank = {
  id: string;
  name: string;
  source: BankSource;
  questionCount: number;
  updatedAt: string;
  questionTypes: QuestionType[];
  fileName?: string | null;
};

export type ImportDuplicateBankMatch = {
  bankId: string;
  bankName: string;
  questionCount: number;
  matchedQuestionCount: number;
  sameName: boolean;
  sameFileName: boolean;
  isExactMatch: boolean;
};

export type ImportDuplicateSummary = {
  sameNameBankCount: number;
  sameFileNameBankCount: number;
  duplicateRowsInFile: number;
  matchedExistingQuestionCount: number;
  importableQuestionCount: number;
  exactMatchedBank: ImportDuplicateBankMatch | null;
  matchedBanks: ImportDuplicateBankMatch[];
};

export type ImportQuestionRow = {
  id: string;
  sheetName: string;
  rowNumber: number;
  type: QuestionType | null;
  stem: string;
  options: QuestionOption[];
  answers: string[];
  explanation: string;
  tags: string[];
  errors: string[];
  warnings: string[];
  fingerprint: string | null;
};

export type ImportPreview = {
  bankName: string;
  source: BankSource;
  fileName: string;
  sheetNames: string[];
  standardColumns: string[];
  workbookWarnings: string[];
  rows: ImportQuestionRow[];
  duplicateSummary: ImportDuplicateSummary;
};

export type ImportBatchFailure = {
  fileName: string;
  message: string;
};

export type ImportBatchResult = {
  previews: ImportPreview[];
  failures: ImportBatchFailure[];
};

export type QuizQuestion = {
  id: string;
  bankId: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  answers: string[];
  explanation: string;
  sourceSheet: string;
  sortOrder: number;
};

export type QuizAnswerRecord = {
  questionId: string;
  questionType: QuestionType;
  questionStem: string;
  selectedAnswers: string[];
  correctAnswers: string[];
  isCorrect: boolean;
};

export type QuizSessionSummary = {
  id: string;
  bankId: string;
  bankName: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctQuestions: number;
  accuracy: number;
  startedAt: string;
  completedAt: string;
};

export type WrongBankSummary = {
  id: string;
  name: string;
  source: BankSource;
  wrongCount: number;
  updatedAt: string;
  questionTypes: QuestionType[];
  fileName?: string | null;
};

export type WrongQuestionRecord = QuizQuestion & {
  wrongCount: number;
  lastWrongAt: string;
  lastSelectedAnswers: string[];
};

export type WrongPracticeSummary = {
  bankId: string;
  bankName: string;
  totalQuestions: number;
  correctedQuestions: number;
  remainingQuestions: number;
  completedAt: string;
};

export type QuizSessionProgress = {
  id: string;
  bankId: string;
  bankName: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctQuestions: number;
  questionIds: string[];
  startedAt: string;
  updatedAt: string;
  answers: QuizAnswerRecord[];
};

export type ReciteFeedback = 'known' | 'fuzzy' | 'unknown';

export type ReciteProgressRecord = {
  questionId: string;
  bankId: string;
  masteryLevel: number;
  reviewCount: number;
  lastResult: ReciteFeedback | null;
  updatedAt: string;
};

export type ReciteSessionProgress = {
  id: string;
  bankId: string;
  bankName: string;
  totalQuestions: number;
  reviewedQuestions: number;
  currentIndex: number;
  questionIds: string[];
  knownCount: number;
  fuzzyCount: number;
  unknownCount: number;
  startedAt: string;
  updatedAt: string;
};

export type ReciteSessionSummary = {
  id: string;
  bankId: string;
  bankName: string;
  totalQuestions: number;
  reviewedQuestions: number;
  knownCount: number;
  fuzzyCount: number;
  unknownCount: number;
  startedAt: string;
  completedAt: string;
};
