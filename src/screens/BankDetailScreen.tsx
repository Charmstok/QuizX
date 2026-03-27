import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { SectionTitle } from '../components/SectionTitle';
import { listQuestionsByBank } from '../db/quizDb';
import { colors, radius, spacing } from '../theme';
import type { QuestionBank, QuestionType, QuizQuestion } from '../types';
import { useSQLiteContext } from '../vendor/expoSqlite';

type BankDetailScreenProps = {
  bank: QuestionBank;
  onBack: () => void;
};

type QuestionFilter = '全部' | QuestionType;

export function BankDetailScreen({ bank, onBack }: BankDetailScreenProps) {
  const db = useSQLiteContext();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<QuestionFilter>('全部');
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadQuestions();
  }, [bank.id]);

  const loadQuestions = async () => {
    setIsLoading(true);

    try {
      const nextQuestions = await listQuestionsByBank(db, bank.id);
      setQuestions(nextQuestions);
      setExpandedQuestionIds([]);
      setSelectedFilter('全部');
    } finally {
      setIsLoading(false);
    }
  };

  const typeCounts = questions.reduce<Record<QuestionType, number>>(
    (result, question) => {
      result[question.type] += 1;
      return result;
    },
    {
      判断: 0,
      单选: 0,
      多选: 0,
      填空: 0,
    },
  );

  const filterOptions: QuestionFilter[] = ['全部', ...bank.questionTypes];
  const visibleQuestions =
    selectedFilter === '全部'
      ? questions
      : questions.filter((question) => question.type === selectedFilter);

  const toggleExpanded = (questionId: string) => {
    setExpandedQuestionIds((previous) =>
      previous.includes(questionId)
        ? previous.filter((item) => item !== questionId)
        : [...previous, questionId],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle
        eyebrow="题库详情"
        title={bank.name}
        subtitle={`共 ${bank.questionCount} 题 · 最近更新 ${bank.updatedAt}`}
      />

      <View style={styles.heroCard}>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>题目总数</Text>
            <Text style={styles.metricValue}>{bank.questionCount}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardPrimary]}>
            <Text style={styles.metricLabel}>题型数量</Text>
            <Text style={styles.metricValue}>{bank.questionTypes.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>来源</Text>
            <Text style={styles.metricValueSmall}>{bank.source}</Text>
          </View>
        </View>

        {bank.fileName ? <Text style={styles.fileText}>来源文件 {bank.fileName}</Text> : null}

        <View style={styles.typeSummaryRow}>
          {bank.questionTypes.map((questionType) => (
            <View key={questionType} style={styles.summaryTag}>
              <Text style={styles.summaryTagText}>
                {questionType} {typeCounts[questionType]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>题目浏览</Text>

        <View style={styles.filterRow}>
          {filterOptions.map((option) => {
            const isActive = option === selectedFilter;

            return (
              <Pressable
                key={option}
                onPress={() => setSelectedFilter(option)}
                style={({ pressed }) => [
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>正在读取题目</Text>
          </View>
        ) : visibleQuestions.length > 0 ? (
          <View style={styles.questionList}>
            {visibleQuestions.map((question, index) => {
              const isExpanded = expandedQuestionIds.includes(question.id);

              return (
                <View key={question.id} style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <View style={styles.questionMetaRow}>
                      <Text style={styles.questionIndex}>#{index + 1}</Text>
                      <View style={styles.questionBadge}>
                        <Text style={styles.questionBadgeText}>{question.type}</Text>
                      </View>
                    </View>
                    <Text style={styles.questionSource}>{question.sourceSheet}</Text>
                  </View>

                  <Text style={styles.questionStem}>{question.stem}</Text>

                  {isExpanded ? (
                    <View style={styles.answerPanel}>
                      {question.type !== '填空' && question.options.length > 0 ? (
                        <View style={styles.optionList}>
                          {question.options.map((option) => {
                            const isCorrectOption = question.answers.includes(option.key);

                            return (
                              <View
                                key={option.key}
                                style={[
                                  styles.optionCard,
                                  isCorrectOption && styles.optionCardCorrect,
                                ]}
                              >
                                <Text style={styles.optionKey}>{option.key}</Text>
                                <Text style={styles.optionText}>{option.text}</Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      <View style={styles.answerBlock}>
                        <Text style={styles.answerLabel}>答案</Text>
                        <Text style={styles.answerText}>{formatAnswerText(question, question.answers)}</Text>
                      </View>

                      {question.explanation ? (
                        <View style={styles.answerBlock}>
                          <Text style={styles.answerLabel}>解析</Text>
                          <Text style={styles.answerText}>{question.explanation}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => toggleExpanded(question.id)}
                    style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.detailButtonText}>{isExpanded ? '收起' : '查看答案与解析'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>这个筛选下没有题目</Text>
            <Text style={styles.emptyText}>切换一个题型筛选试试。</Text>
          </View>
        )}
      </View>

      <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Text style={styles.backButtonText}>返回题库列表</Text>
      </Pressable>
    </ScrollView>
  );
}

function formatAnswerText(question: QuizQuestion, answers: string[]) {
  if (question.type === '填空') {
    return answers.join(' / ');
  }

  return answers
    .map((answer) => {
      const option = question.options.find((item) => item.key === answer);
      return option ? `${option.key}. ${option.text}` : answer;
    })
    .join(' / ');
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 92,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metricCardPrimary: {
    backgroundColor: colors.brandSoft,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  metricValueSmall: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  fileText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  typeSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryTag: {
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  summaryTagText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.brand,
  },
  questionList: {
    gap: spacing.md,
  },
  questionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  questionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  questionIndex: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
  },
  questionBadge: {
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  questionBadgeText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  questionSource: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  questionStem: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '700',
  },
  answerPanel: {
    gap: spacing.md,
  },
  optionList: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  optionCardCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  optionKey: {
    width: 22,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  optionText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  answerBlock: {
    gap: spacing.xs,
  },
  answerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  answerText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  detailButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  backButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  backButtonText: {
    color: colors.onBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
