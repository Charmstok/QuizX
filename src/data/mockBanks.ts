import type { QuestionBank } from '../types';

export const mockBanks: QuestionBank[] = [
  {
    id: 'bank-1',
    name: '公共基础知识',
    source: '本地 Excel',
    questionCount: 120,
    updatedAt: '2026-03-25',
    questionTypes: ['判断', '单选', '多选'],
  },
  {
    id: 'bank-2',
    name: '法律法规速记',
    source: '微信 Excel',
    questionCount: 86,
    updatedAt: '2026-03-23',
    questionTypes: ['判断', '单选', '填空'],
  },
  {
    id: 'bank-3',
    name: '教师资格证专项',
    source: '本地 Excel',
    questionCount: 154,
    updatedAt: '2026-03-20',
    questionTypes: ['单选', '多选', '填空'],
  },
];
