import {
  EXCEL_MIME_TYPES,
  HEADER_ALIASES,
  OPTION_KEYS,
  STANDARD_IMPORT_COLUMNS,
} from './importTemplate';
import type {
  ImportPreview,
  ImportQuestionRow,
  QuestionOption,
  QuestionType,
} from '../types';
import { getDocumentAsync } from '../vendor/expoDocumentPicker';
import { File } from '../vendor/expoFileSystem';
import { read, utils } from '../vendor/xlsx';
import type { WorkBook } from '../vendor/xlsx';

type CanonicalField = keyof typeof HEADER_ALIASES;
type RawSheetRow = Record<string, unknown>;

const HEADER_ALIAS_SETS = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([key, values]) => [
    key,
    new Set(values.map((value) => normalizeHeader(value))),
  ]),
) as Record<CanonicalField, Set<string>>;

const QUESTION_TYPE_MAP: Record<string, QuestionType> = {
  判断: '判断',
  判断题: '判断',
  truefalse: '判断',
  boolean: '判断',
  单选: '单选',
  单选题: '单选',
  single: '单选',
  singlechoice: '单选',
  radio: '单选',
  多选: '多选',
  多选题: '多选',
  multiple: '多选',
  multiplechoice: '多选',
  checkbox: '多选',
  填空: '填空',
  填空题: '填空',
  blank: '填空',
  fillblank: '填空',
  fillintheblank: '填空',
};

const JUDGEMENT_TRUE_VALUES = new Set(['a', '对', '是', '正确', '√', 'true', '1', 'yes']);
const JUDGEMENT_FALSE_VALUES = new Set(['b', '错', '否', '错误', '×', 'false', '0', 'no']);

export async function pickAndParseLocalExcel(): Promise<ImportPreview | null> {
  const result = await getDocumentAsync({
    type: EXCEL_MIME_TYPES as unknown as string[],
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  const file = new File(asset);
  const arrayBuffer = await file.arrayBuffer();
  const workbook = read(arrayBuffer, { type: 'array' });

  return buildImportPreview({
    fileName: asset.name,
    workbook,
  });
}

export function buildImportPreview({
  fileName,
  workbook,
}: {
  fileName: string;
  workbook: WorkBook;
}): ImportPreview {
  const rows: ImportQuestionRow[] = [];
  const nonEmptySheets: string[] = [];
  const bankNames = new Set<string>();
  const workbookWarnings: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const sheetRows = utils.sheet_to_json<RawSheetRow>(worksheet, {
      defval: '',
      raw: false,
      blankrows: false,
    });

    if (sheetRows.length === 0) {
      continue;
    }

    nonEmptySheets.push(sheetName);

    for (const [index, rawRow] of sheetRows.entries()) {
      const normalizedRecord = normalizeRecord(rawRow);

      if (isEmptyRecord(normalizedRecord)) {
        continue;
      }

      const rowNumber = index + 2;
      const rowId = `${sheetName}-${rowNumber}`;
      const bankName = getField(normalizedRecord, 'bankName');

      if (bankName) {
        bankNames.add(bankName);
      }

      const type =
        normalizeQuestionType(getField(normalizedRecord, 'type')) ??
        normalizeQuestionType(sheetName);
      const stem = getField(normalizedRecord, 'stem');
      const explanation = getField(normalizedRecord, 'explanation');
      const tags = splitList(getField(normalizedRecord, 'tags'));
      const rawAnswer = getField(normalizedRecord, 'answer');
      const options = type === '判断' ? createJudgementOptions() : collectOptions(normalizedRecord);
      const answers = normalizeAnswers({
        type,
        rawAnswer,
        options,
      });

      rows.push({
        id: rowId,
        sheetName,
        rowNumber,
        type,
        stem,
        options,
        answers,
        explanation,
        tags,
        errors: validateRow({
          type,
          stem,
          options,
          answers,
        }),
        warnings: collectWarnings({
          type,
          answers,
          options,
        }),
      });
    }
  }

  if (rows.length === 0) {
    throw new Error('没有读取到题目数据。请确认 Excel 第一行是表头，并且后续行包含题目内容。');
  }

  const bankName = resolveBankName({
    bankNames,
    fileName,
  });

  if (bankNames.size > 1) {
    workbookWarnings.push(`文件中检测到多个题库名称，预览阶段统一使用“${bankName}”入库。`);
  }

  return {
    bankName,
    source: '本地 Excel',
    fileName,
    sheetNames: nonEmptySheets,
    standardColumns: [...STANDARD_IMPORT_COLUMNS],
    workbookWarnings,
    rows,
  };
}

export function isImportRowValid(row: ImportQuestionRow) {
  return row.errors.length === 0 && row.type !== null;
}

export function getImportPreviewStats(preview: ImportPreview) {
  const validRows = preview.rows.filter(isImportRowValid);
  const questionTypes = Array.from(
    new Set(
      validRows
        .map((row) => row.type)
        .filter((type): type is QuestionType => type !== null),
    ),
  );

  return {
    totalRows: preview.rows.length,
    validCount: validRows.length,
    invalidCount: preview.rows.length - validRows.length,
    questionTypes,
    sheetCount: preview.sheetNames.length,
  };
}

export function formatAnswerSummary(row: ImportQuestionRow) {
  if (row.answers.length === 0) {
    return '未识别到答案';
  }

  if (row.type === '填空') {
    return row.answers.join(' / ');
  }

  return row.answers
    .map((answer) => {
      const option = row.options.find((item) => item.key === answer);
      return option ? `${option.key}. ${option.text}` : answer;
    })
    .join(' / ');
}

function normalizeRecord(row: RawSheetRow) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = stringifyCell(value);
  }

  return normalized;
}

function getField(record: Record<string, string>, field: CanonicalField) {
  for (const [key, value] of Object.entries(record)) {
    if (HEADER_ALIAS_SETS[field].has(key)) {
      return value;
    }
  }

  return '';
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/[_-]+/g, '').toLowerCase();
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function isEmptyRecord(record: Record<string, string>) {
  return Object.values(record).every((value) => value === '');
}

function normalizeQuestionType(value: string): QuestionType | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, '').toLowerCase();

  return QUESTION_TYPE_MAP[normalized] ?? null;
}

function collectOptions(record: Record<string, string>) {
  const columnOptions = OPTION_KEYS.map((key) => ({
    key,
    text: getField(record, `option${key}` as CanonicalField),
  })).filter((option) => option.text);

  if (columnOptions.length > 0) {
    return columnOptions;
  }

  const rawOptions = getField(record, 'options');

  if (!rawOptions) {
    return [];
  }

  return rawOptions
    .split(/\r?\n|[#;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map<QuestionOption>((item, index) => {
      const matched = item.match(/^([A-Ha-h])[\.、:：\s-]*(.+)$/);

      if (matched) {
        return {
          key: matched[1].toUpperCase(),
          text: matched[2].trim(),
        };
      }

      return {
        key: OPTION_KEYS[index] ?? String(index + 1),
        text: item,
      };
    });
}

function normalizeAnswers({
  type,
  rawAnswer,
  options,
}: {
  type: QuestionType | null;
  rawAnswer: string;
  options: QuestionOption[];
}) {
  if (!rawAnswer) {
    return [];
  }

  if (type === '判断') {
    const normalized = rawAnswer.replace(/\s+/g, '').toLowerCase();

    if (JUDGEMENT_TRUE_VALUES.has(normalized)) {
      return ['A'];
    }

    if (JUDGEMENT_FALSE_VALUES.has(normalized)) {
      return ['B'];
    }

    return [];
  }

  if (type === '填空') {
    return splitList(rawAnswer);
  }

  const tokens = normalizeChoiceTokens(rawAnswer);

  return tokens
    .map((token) => matchAnswerToOption(token, options))
    .filter((value): value is string => Boolean(value));
}

function normalizeChoiceTokens(rawAnswer: string) {
  const compactAnswer = rawAnswer.replace(/\s+/g, '');
  const compactLetters = compactAnswer.replace(/[^A-Za-z]/g, '').toUpperCase();

  if (/^[A-Ha-h]{2,8}$/.test(compactAnswer) && compactLetters.length <= OPTION_KEYS.length) {
    return compactLetters.split('');
  }

  return rawAnswer
    .split(/[\s,，、;；|｜/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchAnswerToOption(answer: string, options: QuestionOption[]) {
  const normalized = answer.trim();
  const upper = normalized.toUpperCase();
  const byKey = options.find((option) => option.key === upper);

  if (byKey) {
    return byKey.key;
  }

  const byText = options.find((option) => option.text === normalized);

  return byText?.key ?? null;
}

function validateRow({
  type,
  stem,
  options,
  answers,
}: {
  type: QuestionType | null;
  stem: string;
  options: QuestionOption[];
  answers: string[];
}) {
  const errors: string[] = [];

  if (!type) {
    errors.push('题型未识别，只支持 判断 / 单选 / 多选 / 填空。');
  }

  if (!stem) {
    errors.push('缺少题目内容。');
  }

  if (type === '单选' || type === '多选') {
    if (options.length < 2) {
      errors.push('选择题至少需要两个选项。');
    }

    if (answers.length === 0) {
      errors.push('答案未匹配到选项，请检查答案列是否使用选项字母或选项文本。');
    }
  }

  if (type === '单选' && answers.length !== 1) {
    errors.push('单选题必须且只能有一个答案。');
  }

  if (type === '判断' && answers.length !== 1) {
    errors.push('判断题答案必须填写“正确/错误”或 A/B。');
  }

  if (type === '填空' && answers.length === 0) {
    errors.push('填空题至少需要一个答案。');
  }

  return errors;
}

function collectWarnings({
  type,
  answers,
  options,
}: {
  type: QuestionType | null;
  answers: string[];
  options: QuestionOption[];
}) {
  const warnings: string[] = [];

  if (type === '多选' && answers.length === 1) {
    warnings.push('多选题当前只识别到一个答案，请确认是否需要多个答案。');
  }

  if ((type === '单选' || type === '多选') && options.length > 6) {
    warnings.push('当前题目选项较多，移动端展示时会更占空间。');
  }

  return warnings;
}

function splitList(value: string) {
  return value
    .split(/\r?\n|[|｜;；/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveBankName({
  bankNames,
  fileName,
}: {
  bankNames: Set<string>;
  fileName: string;
}) {
  const firstBankName = bankNames.values().next().value;

  if (firstBankName) {
    return firstBankName;
  }

  return stripExtension(fileName);
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

function createJudgementOptions(): QuestionOption[] {
  return [
    { key: 'A', text: '正确' },
    { key: 'B', text: '错误' },
  ];
}
