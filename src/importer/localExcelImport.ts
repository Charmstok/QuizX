import {
  EXCEL_MIME_TYPES,
  EXCEL_FILE_EXTENSIONS,
  OPTION_KEYS,
  STANDARD_IMPORT_COLUMNS,
  STANDARD_IMPORT_SHEETS,
} from './importTemplate';
import type {
  BankSource,
  ImportBatchResult,
  ImportDuplicateSummary,
  ImportPreview,
  ImportQuestionRow,
  QuestionOption,
  QuestionType,
} from '../types';
import { getDocumentAsync } from '../vendor/expoDocumentPicker';
import { File } from '../vendor/expoFileSystem';
import type { ResolvedSharePayload } from '../vendor/expoSharing';
import { read, utils } from '../vendor/xlsx';
import type { WorkBook } from '../vendor/xlsx';

type RawSheetRow = Record<string, unknown>;
type StandardField = (typeof STANDARD_IMPORT_COLUMNS)[number];
type ImportAsset = {
  name: string;
  uri: string;
  mimeType?: string | null;
};

const STANDARD_FIELD_SET = new Set(
  STANDARD_IMPORT_COLUMNS.map((value) => normalizeHeader(value)),
);

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

export async function pickAndParseLocalExcelBatch(): Promise<ImportBatchResult | null> {
  const result = await getDocumentAsync({
    type: EXCEL_MIME_TYPES as unknown as string[],
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  return await parseExcelAssetBatch({
    source: '本地 Excel',
    assets: result.assets.map((asset) => ({
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType,
    })),
  });
}

export async function parseSharedExcelBatch(
  payloads: ResolvedSharePayload[],
): Promise<ImportBatchResult> {
  const assets: ImportAsset[] = [];
  const failures: ImportBatchResult['failures'] = [];

  for (const payload of payloads) {
    const fileName = payload.originalName ?? deriveFileNameFromUri(payload.contentUri ?? payload.value);

    if (!payload.contentUri) {
      failures.push({
        fileName,
        message: '当前只支持通过系统分享导入 Excel / CSV 文件。',
      });
      continue;
    }

    if (
      !isSupportedExcelAsset({
        fileName,
        mimeType: payload.contentMimeType ?? payload.mimeType ?? null,
      })
    ) {
      failures.push({
        fileName,
        message: '不是支持的 Excel / CSV 文件，当前仅支持 .xlsx / .xls / .csv。',
      });
      continue;
    }

    assets.push({
      name: fileName,
      uri: payload.contentUri,
      mimeType: payload.contentMimeType ?? payload.mimeType ?? null,
    });
  }

  const parsedBatch = await parseExcelAssetBatch({
    source: '应用分享',
    assets,
  });

  return {
    previews: parsedBatch.previews,
    failures: [...failures, ...parsedBatch.failures],
  };
}

async function parseExcelAssetBatch({
  source,
  assets,
}: {
  source: BankSource;
  assets: ImportAsset[];
}): Promise<ImportBatchResult> {
  const previews: ImportPreview[] = [];
  const failures: ImportBatchResult['failures'] = [];

  for (const asset of assets) {
    try {
      const file = new File(asset.uri);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });

      previews.push(
        buildImportPreview({
          source,
          fileName: asset.name,
          workbook,
        }),
      );
    } catch (error) {
      failures.push({
        fileName: asset.name,
        message: error instanceof Error ? error.message : '文件解析失败。',
      });
    }
  }

  return {
    previews,
    failures,
  };
}

function isSupportedExcelAsset({
  fileName,
  mimeType,
}: {
  fileName: string;
  mimeType?: string | null;
}) {
  const lowerCaseName = fileName.toLowerCase();

  if (EXCEL_FILE_EXTENSIONS.some((extension) => lowerCaseName.endsWith(extension))) {
    return true;
  }

  if (!mimeType) {
    return false;
  }

  return EXCEL_MIME_TYPES.includes(mimeType);
}

function deriveFileNameFromUri(uri: string | null) {
  if (!uri) {
    return '未命名文件';
  }

  const matched = uri.match(/[^/?#]+(?=$|[?#])/);

  if (!matched) {
    return '未命名文件';
  }

  try {
    return decodeURIComponent(matched[0]);
  } catch {
    return matched[0];
  }
}

export function buildImportPreview({
  source,
  fileName,
  workbook,
}: {
  source: BankSource;
  fileName: string;
  workbook: WorkBook;
}): ImportPreview {
  const rows: ImportQuestionRow[] = [];
  const nonEmptySheets: string[] = [];
  const workbookWarnings: string[] = [];
  const compatibleSheetTypes = new Set<QuestionType>();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const sheetRows = utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: true,
    });
    const normalizedSheetRows = sheetRows.map((row) => normalizeCellRow(row ?? []));
    const firstNonEmptyRowIndex = normalizedSheetRows.findIndex((row) => !isEmptyCellRow(row));

    if (firstNonEmptyRowIndex === -1) {
      continue;
    }

    nonEmptySheets.push(sheetName);
    const detectedSheetType = normalizeQuestionType(sheetName);

    if (detectedSheetType) {
      compatibleSheetTypes.add(detectedSheetType);
    }
    const headers = normalizedSheetRows[firstNonEmptyRowIndex] ?? [];
    const missingHeaders = getMissingHeaders(headers);

    if (missingHeaders.length === 0) {
      rows.push(
        ...buildRowsFromStandardSheet({
          sheetName,
          sheetRows: normalizedSheetRows,
          headerRowIndex: firstNonEmptyRowIndex,
        }),
      );
      continue;
    }

    const legacyRows = buildRowsFromLegacySheet({
      sheetName,
      sheetRows: normalizedSheetRows,
    });

    if (!legacyRows) {
      throw new Error(
        `工作表“${sheetName}”表头不符合标准导入格式，缺少列：${missingHeaders.join('、')}。`,
      );
    }

    workbookWarnings.push(
      `工作表“${sheetName}”未使用标准表头，已按兼容格式读取。建议下次优先使用标准模板。`,
    );
    rows.push(...legacyRows);
  }

  if (rows.length === 0) {
    throw new Error('没有读取到题目数据。请确认 Excel 中有题目内容；如果使用标准模板，请把表头放在第一行。');
  }

  const bankName = stripExtension(fileName);
  const missingSheets = STANDARD_IMPORT_SHEETS.filter(
    (sheetName) => {
      const normalizedType = normalizeQuestionType(sheetName);

      return (
        !workbook.SheetNames.includes(sheetName) &&
        !(normalizedType && compatibleSheetTypes.has(normalizedType))
      );
    },
  );

  if (missingSheets.length > 0) {
    workbookWarnings.push(`未检测到这些标准工作表：${missingSheets.join('、')}。`);
  }

  applyInFileDuplicateWarnings(rows);

  return {
    bankName,
    source,
    fileName,
    sheetNames: nonEmptySheets,
    standardColumns: [...STANDARD_IMPORT_COLUMNS],
    workbookWarnings,
    rows,
    duplicateSummary: createEmptyDuplicateSummary(),
  };
}

function buildRowsFromStandardSheet({
  sheetName,
  sheetRows,
  headerRowIndex,
}: {
  sheetName: string;
  sheetRows: string[][];
  headerRowIndex: number;
}) {
  const rows: ImportQuestionRow[] = [];
  const headers = sheetRows[headerRowIndex] ?? [];

  for (let index = headerRowIndex + 1; index < sheetRows.length; index += 1) {
    const rawRecord = Object.fromEntries(
      headers.map((header, columnIndex) => [header, sheetRows[index]?.[columnIndex] ?? '']),
    ) as RawSheetRow;
    const normalizedRecord = normalizeRecord(rawRecord);

    if (isEmptyRecord(normalizedRecord)) {
      continue;
    }

    rows.push(
      createImportRow({
        sheetName,
        rowNumber: index + 1,
        type:
          normalizeQuestionType(getField(normalizedRecord, '题型')) ??
          normalizeQuestionType(sheetName),
        stem: getField(normalizedRecord, '题干'),
        rawOptions: getField(normalizedRecord, '选项'),
        rawAnswer: getField(normalizedRecord, '答案'),
        explanation: getField(normalizedRecord, '试题解析'),
      }),
    );
  }

  return rows;
}

function buildRowsFromLegacySheet({
  sheetName,
  sheetRows,
}: {
  sheetName: string;
  sheetRows: string[][];
}) {
  const type = normalizeQuestionType(sheetName);

  if (!type) {
    return null;
  }

  const rows: ImportQuestionRow[] = [];

  for (const [index, row] of sheetRows.entries()) {
    if (isEmptyCellRow(row) || looksLikeLegacyHeaderRow(row)) {
      continue;
    }

    const cells = trimTrailingEmptyCells(row);
    const legacyFields = extractLegacyFields(type, cells);

    if (!legacyFields) {
      return null;
    }

    rows.push(
      createImportRow({
        sheetName,
        rowNumber: index + 1,
        type,
        stem: legacyFields.stem,
        rawOptions: legacyFields.rawOptions,
        rawAnswer: legacyFields.rawAnswer,
        explanation: '',
      }),
    );
  }

  return rows.length > 0 ? rows : null;
}

function extractLegacyFields(
  type: QuestionType,
  cells: string[],
): {
  stem: string;
  rawOptions: string;
  rawAnswer: string;
} | null {
  if (type === '判断' || type === '填空') {
    if (cells.length < 2) {
      return null;
    }

    return {
      stem: cells.at(-2) ?? '',
      rawOptions: '',
      rawAnswer: cells.at(-1) ?? '',
    };
  }

  if (cells.length < 3) {
    return null;
  }

  return {
    stem: cells.at(-3) ?? '',
    rawOptions: cells.at(-2) ?? '',
    rawAnswer: cells.at(-1) ?? '',
  };
}

function createImportRow({
  sheetName,
  rowNumber,
  type,
  stem,
  rawOptions,
  rawAnswer,
  explanation,
}: {
  sheetName: string;
  rowNumber: number;
  type: QuestionType | null;
  stem: string;
  rawOptions: string;
  rawAnswer: string;
  explanation: string;
}): ImportQuestionRow {
  const options = type === '判断' ? createJudgementOptions() : collectOptionsFromText(rawOptions);
  const answers = normalizeAnswers({
    type,
    rawAnswer,
    options,
  });

  return {
    id: `${sheetName}-${rowNumber}`,
    sheetName,
    rowNumber,
    type,
    stem,
    options,
    answers,
    explanation,
    tags: [],
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
    fingerprint: createQuestionFingerprint({
      type,
      stem,
      options,
      answers,
      explanation,
    }),
  };
}

export function isImportRowValid(row: ImportQuestionRow) {
  return row.errors.length === 0 && row.type !== null && row.fingerprint !== null;
}

export function getImportableRows(preview: ImportPreview) {
  const seenFingerprints = new Set<string>();

  return preview.rows.filter((row) => {
    if (!isImportRowValid(row) || !row.fingerprint) {
      return false;
    }

    if (seenFingerprints.has(row.fingerprint)) {
      return false;
    }

    seenFingerprints.add(row.fingerprint);
    return true;
  });
}

export function getImportPreviewStats(preview: ImportPreview) {
  const validRows = preview.rows.filter(isImportRowValid);
  const importableRows = getImportableRows(preview);
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
    duplicateRowsInFile: validRows.length - importableRows.length,
    importableCount: importableRows.length,
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

export function createQuestionFingerprint({
  type,
  stem,
  options,
  answers,
  explanation,
}: {
  type: QuestionType | null;
  stem: string;
  options: QuestionOption[];
  answers: string[];
  explanation?: string;
}) {
  if (!type) {
    return null;
  }

  const normalizedStem = normalizeFingerprintText(stem);

  if (!normalizedStem) {
    return null;
  }

  const optionTextMap = new Map(
    options.map((option) => [option.key, normalizeFingerprintText(option.text)]),
  );

  const normalizedOptions = options
    .map((option) => normalizeFingerprintText(option.text))
    .filter(Boolean)
    .sort();

  const normalizedAnswers =
    type === '判断'
      ? answers.map((answer) => (answer === 'A' ? '正确' : answer === 'B' ? '错误' : answer))
      : type === '填空'
        ? answers
        : answers.map((answer) => optionTextMap.get(answer) ?? answer);

  const stableAnswers = normalizedAnswers
    .map((answer) => normalizeFingerprintText(answer))
    .filter(Boolean)
    .sort();

  return JSON.stringify({
    type,
    stem: normalizedStem,
    options: normalizedOptions,
    answers: stableAnswers,
    explanation: normalizeFingerprintText(explanation ?? ''),
  });
}

function normalizeRecord(row: RawSheetRow) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);

    if (!STANDARD_FIELD_SET.has(normalizedKey)) {
      continue;
    }

    normalized[normalizedKey] = stringifyCell(value);
  }

  return normalized;
}

function getField(record: Record<string, string>, field: StandardField) {
  return record[normalizeHeader(field)] ?? '';
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/[_-]+/g, '').toLowerCase();
}

function normalizeCellRow(row: unknown[]) {
  return row.map((value) => stringifyCell(value));
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function normalizeFingerprintText(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function isEmptyCellRow(row: string[]) {
  return row.every((value) => value === '');
}

function trimTrailingEmptyCells(row: string[]) {
  const trimmed = [...row];

  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }

  return trimmed;
}

function looksLikeLegacyHeaderRow(row: string[]) {
  const compactRow = trimTrailingEmptyCells(row);

  return compactRow.some((cell) => /题干|题目/.test(cell)) && compactRow.some((cell) => cell === '答案');
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
  return collectOptionsFromText(getField(record, '选项'));
}

function collectOptionsFromText(rawOptions: string) {
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

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

function createJudgementOptions(): QuestionOption[] {
  return [
    { key: 'A', text: '正确' },
    { key: 'B', text: '错误' },
  ];
}

function getMissingHeaders(headers: string[]) {
  const normalizedHeaders = new Set(headers.map((header) => normalizeHeader(header)));

  return STANDARD_IMPORT_COLUMNS.filter(
    (header) => !normalizedHeaders.has(normalizeHeader(header)),
  );
}

function createEmptyDuplicateSummary(): ImportDuplicateSummary {
  return {
    sameNameBankCount: 0,
    sameFileNameBankCount: 0,
    duplicateRowsInFile: 0,
    matchedExistingQuestionCount: 0,
    importableQuestionCount: 0,
    exactMatchedBank: null,
    matchedBanks: [],
  };
}

function applyInFileDuplicateWarnings(rows: ImportQuestionRow[]) {
  const firstRowByFingerprint = new Map<string, ImportQuestionRow>();

  for (const row of rows) {
    if (!isImportRowValid(row) || !row.fingerprint) {
      continue;
    }

    const firstRow = firstRowByFingerprint.get(row.fingerprint);

    if (!firstRow) {
      firstRowByFingerprint.set(row.fingerprint, row);
      continue;
    }

    row.warnings.push(
      `与 ${firstRow.sheetName} 第 ${firstRow.rowNumber} 行题目重复，导入时只保留第一道。`,
    );
  }
}
