export const STANDARD_IMPORT_COLUMNS = [
  '题干',
  '选项',
  '答案',
  '难度',
  '题型',
  '试题解析',
] as const;

export const STANDARD_IMPORT_SHEETS = ['判断题', '单选题', '多选题', '填空'] as const;

export const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

export const EXCEL_SHARE_MIME_TYPES = [
  ...EXCEL_MIME_TYPES,
  'application/csv',
  'application/octet-stream',
];

export const EXCEL_FILE_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
