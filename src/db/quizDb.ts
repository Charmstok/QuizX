import {
  getImportPreviewStats,
  isImportRowValid,
} from '../importer/localExcelImport';
import type {
  ImportPreview,
  QuestionBank,
  QuestionType,
  QuizAnswerRecord,
  QuizQuestion,
  QuizSessionProgress,
  QuizSessionSummary,
} from '../types';
import type { SQLiteDatabase } from '../vendor/expoSqlite';

const DATABASE_VERSION = 3;
const IMPORT_TEMPLATE_VERSION = 1;

type QuestionBankRow = {
  id: string;
  name: string;
  source: QuestionBank['source'];
  file_name: string | null;
  question_count: number;
  question_types_json: string;
  updated_at: string;
};

type QuestionRow = {
  id: string;
  bank_id: string;
  type: QuestionType;
  stem: string;
  options_json: string;
  answers_json: string;
  explanation: string;
  source_sheet: string;
  sort_order: number;
};

type QuizSessionRow = {
  id: string;
  bank_id: string;
  bank_name_snapshot: string;
  total_questions: number;
  answered_questions: number;
  correct_questions: number;
  started_at: string;
  completed_at: string;
  status: 'in_progress' | 'completed';
  updated_at: string;
};

type QuizSessionAnswerRow = {
  question_id: string;
  question_type: QuestionType;
  question_stem_snapshot: string;
  selected_answers_json: string;
  correct_answers_json: string;
  is_correct: number;
};

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await createQuestionSchema(db);
  }

  if (currentVersion < 2) {
    await createQuizSessionSchema(db);
  }

  if (currentVersion >= 2 && currentVersion < 3) {
    await upgradeQuizSessionSchemaV3(db);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}

export async function listQuestionBanks(db: SQLiteDatabase): Promise<QuestionBank[]> {
  const rows = await db.getAllAsync<QuestionBankRow>(`
    SELECT
      id,
      name,
      source,
      file_name,
      question_count,
      question_types_json,
      updated_at
    FROM question_banks
    ORDER BY datetime(updated_at) DESC, name ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    fileName: row.file_name,
    questionCount: row.question_count,
    questionTypes: safeParseQuestionTypes(row.question_types_json),
    updatedAt: row.updated_at.slice(0, 10),
  }));
}

export async function saveImportPreview(
  db: SQLiteDatabase,
  preview: ImportPreview,
): Promise<QuestionBank> {
  const validRows = preview.rows.filter(isImportRowValid);

  if (validRows.length === 0) {
    throw new Error('当前预览中没有可导入的题目。');
  }

  const stats = getImportPreviewStats(preview);
  const now = new Date().toISOString();
  const bankId = createId('bank');
  const questionTypesJson = JSON.stringify(stats.questionTypes);

  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync(
      `
        INSERT INTO question_banks (
          id,
          name,
          source,
          file_name,
          question_count,
          question_types_json,
          import_template_version,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      bankId,
      preview.bankName,
      preview.source,
      preview.fileName,
      validRows.length,
      questionTypesJson,
      IMPORT_TEMPLATE_VERSION,
      now,
      now,
    );

    const statement = await db.prepareAsync(`
      INSERT INTO questions (
        id,
        bank_id,
        type,
        stem,
        options_json,
        answers_json,
        explanation,
        tags_json,
        source_sheet,
        source_row,
        sort_order,
        created_at,
        updated_at
      ) VALUES (
        $id,
        $bankId,
        $type,
        $stem,
        $optionsJson,
        $answersJson,
        $explanation,
        $tagsJson,
        $sourceSheet,
        $sourceRow,
        $sortOrder,
        $createdAt,
        $updatedAt
      )
    `);

    try {
      for (const [index, row] of validRows.entries()) {
        await statement.executeAsync({
          $id: createId('question'),
          $bankId: bankId,
          $type: row.type,
          $stem: row.stem,
          $optionsJson: JSON.stringify(row.options),
          $answersJson: JSON.stringify(row.answers),
          $explanation: row.explanation,
          $tagsJson: JSON.stringify(row.tags),
          $sourceSheet: row.sheetName,
          $sourceRow: row.rowNumber,
          $sortOrder: index + 1,
          $createdAt: now,
          $updatedAt: now,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });

  return {
    id: bankId,
    name: preview.bankName,
    source: preview.source,
    fileName: preview.fileName,
    questionCount: validRows.length,
    questionTypes: stats.questionTypes,
    updatedAt: now.slice(0, 10),
  };
}

export async function listQuestionsByBank(
  db: SQLiteDatabase,
  bankId: string,
): Promise<QuizQuestion[]> {
  const rows = await db.getAllAsync<QuestionRow>(
    `
      SELECT
        id,
        bank_id,
        type,
        stem,
        options_json,
        answers_json,
        explanation,
        source_sheet,
        sort_order
      FROM questions
      WHERE bank_id = ?
      ORDER BY sort_order ASC, source_row ASC
    `,
    bankId,
  );

  return rows.map((row) => ({
    id: row.id,
    bankId: row.bank_id,
    type: row.type,
    stem: row.stem,
    options: safeParseJson(row.options_json, []),
    answers: safeParseJson(row.answers_json, []),
    explanation: row.explanation,
    sourceSheet: row.source_sheet,
    sortOrder: row.sort_order,
  }));
}

export async function saveQuizSession(
  db: SQLiteDatabase,
  input: {
    sessionId: string;
    bank: QuestionBank;
    startedAt: string;
    answers: QuizAnswerRecord[];
    totalQuestions: number;
  },
): Promise<QuizSessionSummary> {
  const now = new Date().toISOString();
  const correctQuestions = input.answers.filter((item) => item.isCorrect).length;

  await persistQuizSessionState(db, {
    sessionId: input.sessionId,
    bank: input.bank,
    startedAt: input.startedAt,
    answers: input.answers,
    totalQuestions: input.totalQuestions,
    status: 'completed',
    completedAt: now,
  });

  return {
    id: input.sessionId,
    bankId: input.bank.id,
    bankName: input.bank.name,
    totalQuestions: input.totalQuestions,
    answeredQuestions: input.answers.length,
    correctQuestions,
    accuracy: input.totalQuestions > 0 ? correctQuestions / input.totalQuestions : 0,
    startedAt: input.startedAt,
    completedAt: now,
  };
}

export async function createQuizSession(
  db: SQLiteDatabase,
  input: {
    bank: QuestionBank;
    totalQuestions: number;
  },
): Promise<QuizSessionProgress> {
  const now = new Date().toISOString();
  const sessionId = createId('session');

  await db.runAsync(
    `
      INSERT INTO quiz_sessions (
        id,
        bank_id,
        bank_name_snapshot,
        total_questions,
        answered_questions,
        correct_questions,
        started_at,
        completed_at,
        status,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    sessionId,
    input.bank.id,
    input.bank.name,
    input.totalQuestions,
    0,
    0,
    now,
    '',
    'in_progress',
    now,
  );

  return {
    id: sessionId,
    bankId: input.bank.id,
    bankName: input.bank.name,
    totalQuestions: input.totalQuestions,
    answeredQuestions: 0,
    correctQuestions: 0,
    startedAt: now,
    updatedAt: now,
    answers: [],
  };
}

export async function saveQuizSessionProgress(
  db: SQLiteDatabase,
  input: {
    sessionId: string;
    bank: QuestionBank;
    startedAt: string;
    answers: QuizAnswerRecord[];
    totalQuestions: number;
  },
) {
  await persistQuizSessionState(db, {
    ...input,
    status: 'in_progress',
    completedAt: '',
  });
}

export async function getInProgressQuizSession(
  db: SQLiteDatabase,
  bankId: string,
): Promise<QuizSessionProgress | null> {
  const session = await db.getFirstAsync<QuizSessionRow>(
    `
      SELECT
        id,
        bank_id,
        bank_name_snapshot,
        total_questions,
        answered_questions,
        correct_questions,
        started_at,
        completed_at,
        status,
        updated_at
      FROM quiz_sessions
      WHERE bank_id = ? AND status = 'in_progress'
      ORDER BY datetime(updated_at) DESC
      LIMIT 1
    `,
    bankId,
  );

  if (!session) {
    return null;
  }

  const answerRows = await db.getAllAsync<QuizSessionAnswerRow>(
    `
      SELECT
        question_id,
        question_type,
        question_stem_snapshot,
        selected_answers_json,
        correct_answers_json,
        is_correct
      FROM quiz_session_answers
      WHERE session_id = ?
      ORDER BY created_at ASC
    `,
    session.id,
  );

  return {
    id: session.id,
    bankId: session.bank_id,
    bankName: session.bank_name_snapshot,
    totalQuestions: session.total_questions,
    answeredQuestions: session.answered_questions,
    correctQuestions: session.correct_questions,
    startedAt: session.started_at,
    updatedAt: session.updated_at,
    answers: answerRows.map((row) => ({
      questionId: row.question_id,
      questionType: row.question_type,
      questionStem: row.question_stem_snapshot,
      selectedAnswers: safeParseJson(row.selected_answers_json, []),
      correctAnswers: safeParseJson(row.correct_answers_json, []),
      isCorrect: Boolean(row.is_correct),
    })),
  };
}

export async function discardQuizSession(db: SQLiteDatabase, sessionId: string) {
  await db.runAsync(`DELETE FROM quiz_sessions WHERE id = ?`, sessionId);
}

function safeParseQuestionTypes(value: string): QuestionType[] {
  try {
    const parsed = JSON.parse(value) as QuestionType[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createQuestionSchema(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS question_banks (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      file_name TEXT,
      question_count INTEGER NOT NULL DEFAULT 0,
      question_types_json TEXT NOT NULL DEFAULT '[]',
      import_template_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY NOT NULL,
      bank_id TEXT NOT NULL,
      type TEXT NOT NULL,
      stem TEXT NOT NULL,
      options_json TEXT NOT NULL DEFAULT '[]',
      answers_json TEXT NOT NULL DEFAULT '[]',
      explanation TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      source_sheet TEXT NOT NULL DEFAULT '',
      source_row INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_question_banks_updated_at
      ON question_banks(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_questions_bank_id
      ON questions(bank_id);

    CREATE INDEX IF NOT EXISTS idx_questions_bank_sort
      ON questions(bank_id, sort_order);
  `);
}

async function createQuizSessionSchema(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      bank_id TEXT NOT NULL,
      bank_name_snapshot TEXT NOT NULL,
      total_questions INTEGER NOT NULL,
      answered_questions INTEGER NOT NULL,
      correct_questions INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_session_answers (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      question_stem_snapshot TEXT NOT NULL,
      selected_answers_json TEXT NOT NULL DEFAULT '[]',
      correct_answers_json TEXT NOT NULL DEFAULT '[]',
      is_correct INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_bank_completed
      ON quiz_sessions(bank_id, completed_at DESC);

    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_bank_status_updated
      ON quiz_sessions(bank_id, status, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_quiz_session_answers_session
      ON quiz_session_answers(session_id);
  `);
}

async function upgradeQuizSessionSchemaV3(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE quiz_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
    ALTER TABLE quiz_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

    UPDATE quiz_sessions
    SET
      status = 'completed',
      updated_at = CASE
        WHEN completed_at <> '' THEN completed_at
        ELSE started_at
      END
    WHERE status IS NULL OR status = '' OR updated_at = '';

    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_bank_status_updated
      ON quiz_sessions(bank_id, status, updated_at DESC);
  `);
}

async function persistQuizSessionState(
  db: SQLiteDatabase,
  input: {
    sessionId: string;
    bank: QuestionBank;
    startedAt: string;
    answers: QuizAnswerRecord[];
    totalQuestions: number;
    status: 'in_progress' | 'completed';
    completedAt: string;
  },
) {
  const now = new Date().toISOString();
  const correctQuestions = input.answers.filter((item) => item.isCorrect).length;

  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync(
      `
        UPDATE quiz_sessions
        SET
          bank_name_snapshot = ?,
          total_questions = ?,
          answered_questions = ?,
          correct_questions = ?,
          started_at = ?,
          completed_at = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
      `,
      input.bank.name,
      input.totalQuestions,
      input.answers.length,
      correctQuestions,
      input.startedAt,
      input.completedAt,
      input.status,
      now,
      input.sessionId,
    );

    await db.runAsync(`DELETE FROM quiz_session_answers WHERE session_id = ?`, input.sessionId);

    const statement = await db.prepareAsync(`
      INSERT INTO quiz_session_answers (
        id,
        session_id,
        question_id,
        question_type,
        question_stem_snapshot,
        selected_answers_json,
        correct_answers_json,
        is_correct,
        created_at
      ) VALUES (
        $id,
        $sessionId,
        $questionId,
        $questionType,
        $questionStemSnapshot,
        $selectedAnswersJson,
        $correctAnswersJson,
        $isCorrect,
        $createdAt
      )
    `);

    try {
      for (const answer of input.answers) {
        await statement.executeAsync({
          $id: createId('session-answer'),
          $sessionId: input.sessionId,
          $questionId: answer.questionId,
          $questionType: answer.questionType,
          $questionStemSnapshot: answer.questionStem,
          $selectedAnswersJson: JSON.stringify(answer.selectedAnswers),
          $correctAnswersJson: JSON.stringify(answer.correctAnswers),
          $isCorrect: answer.isCorrect ? 1 : 0,
          $createdAt: now,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}
