export const STANDARD_IMPORT_COLUMNS = [
  '题库名称',
  '题型',
  '题目',
  '选项A',
  '选项B',
  '选项C',
  '选项D',
  '答案',
  '解析',
  '标签',
] as const;

export const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export const HEADER_ALIASES = {
  bankName: ['题库名称', '题库', 'bankname', 'bank'],
  type: ['题型', '类型', '题目类型', 'questiontype', 'type'],
  stem: ['题目', '题干', '标题', '问题', 'question', 'stem'],
  answer: ['答案', '正确答案', 'answer', 'correctanswer'],
  explanation: ['解析', '答案解析', '试题解析', '说明', 'analysis', 'explanation'],
  tags: ['标签', '知识点', 'tag', 'tags'],
  options: ['选项', '选项文本', 'options'],
  optionA: ['选项a', 'a', 'a选项', 'optiona'],
  optionB: ['选项b', 'b', 'b选项', 'optionb'],
  optionC: ['选项c', 'c', 'c选项', 'optionc'],
  optionD: ['选项d', 'd', 'd选项', 'optiond'],
  optionE: ['选项e', 'e', 'e选项', 'optione'],
  optionF: ['选项f', 'f', 'f选项', 'optionf'],
  optionG: ['选项g', 'g', 'g选项', 'optiong'],
  optionH: ['选项h', 'h', 'h选项', 'optionh'],
} as const;
