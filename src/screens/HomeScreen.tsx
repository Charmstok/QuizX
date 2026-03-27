import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ModeCard } from '../components/ModeCard';
import { SectionTitle } from '../components/SectionTitle';
import { StatCard } from '../components/StatCard';
import { colors, radius, spacing } from '../theme';
import type { QuestionBank, StudyTab } from '../types';

type HomeScreenProps = {
  banks: QuestionBank[];
  totalQuestions: number;
  isImporting: boolean;
  onOpenTab: (tab: StudyTab) => void;
  onImportLocal: () => void;
};

export function HomeScreen({
  banks,
  totalQuestions,
  isImporting,
  onOpenTab,
  onImportLocal,
}: HomeScreenProps) {
  const handleImport = (source: 'local' | 'wechat') => {
    if (source === 'local') {
      onImportLocal();
      return;
    }

    Alert.alert(
      '微信 Excel 导入',
      '这一轮先完成本地 Excel -> 预览 -> SQLite 的完整链路，微信导入后续再接。',
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle
        eyebrow="QuizX MVP"
        title="把题库装进口袋里"
        subtitle="当前版本已经开始接真实数据流：本地 Excel 走系统文件选择器，先标准化预览，再写入 SQLite。题型先固定为判断、单选、多选、填空。"
      />

      <View style={styles.heroCard}>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>先导入，再落 SQLite</Text>
          <Text style={styles.heroDescription}>
            系统会把 Excel 行数据统一映射成标准题目结构，先做导入预览，再确认写入本地数据库。
          </Text>
        </View>
        <View style={styles.heroActions}>
          <Pressable
            onPress={() => handleImport('local')}
            disabled={isImporting}
            style={({ pressed }) => [
              styles.primaryAction,
              (pressed || isImporting) && styles.pressed,
            ]}
          >
            <Text style={styles.primaryActionText}>
              {isImporting ? '解析文件中...' : '导入本地 Excel'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleImport('wechat')}
            disabled={isImporting}
            style={({ pressed }) => [
              styles.secondaryAction,
              (pressed || isImporting) && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>导入微信 Excel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="题库数量" value={String(banks.length)} hint="题库摘要从 SQLite 读取" />
        <StatCard label="题目总数" value={String(totalQuestions)} hint="导入成功后会实时更新" />
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle title="学习入口" subtitle="答题模式、背诵模式和错题本都已经可用。" />
      </View>
      <View style={styles.modeList}>
        <ModeCard
          title="答题模式"
          description="现在可以选择题库、逐题作答、即时判分，并在完成一轮后把结果写入 SQLite。"
          actionLabel="开始顺序练习"
          accent={colors.brand}
          onPress={() => onOpenTab('quiz')}
        />
        <ModeCard
          title="背诵模式"
          description="现在会优先安排薄弱题，支持显示答案、掌握度标记和未完成进度恢复。"
          actionLabel="开始背诵"
          accent={colors.success}
          onPress={() => onOpenTab('recite')}
        />
        <ModeCard
          title="错题本"
          description="按题库集中重做错题，答对后会从错题本移出，答错则继续保留。"
          actionLabel="开始重做"
          accent={colors.warning}
          onPress={() => onOpenTab('wrong')}
        />
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle
          title="题库概览"
          subtitle="这里已经从 SQLite 读取题库摘要。如果数据库还是空的，先通过上面的本地导入走一遍。"
        />
      </View>
      <View style={styles.bankList}>
        {banks.length > 0 ? (
          banks.map((bank) => (
            <View key={bank.id} style={styles.bankCard}>
              <View style={styles.bankHeader}>
                <Text style={styles.bankName}>{bank.name}</Text>
                <Text style={styles.bankSource}>{bank.source}</Text>
              </View>
              <Text style={styles.bankMeta}>
                {bank.questionCount} 题 · 最近更新 {bank.updatedAt}
              </Text>
              {bank.fileName ? <Text style={styles.bankFile}>来源文件 {bank.fileName}</Text> : null}
              <View style={styles.tagRow}>
                {bank.questionTypes.map((questionType) => (
                  <View key={questionType} style={styles.tag}>
                    <Text style={styles.tagText}>{questionType}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>SQLite 已初始化，但还没有题库</Text>
            <Text style={styles.emptyText}>
              先从系统文件选择器选一个 Excel，进入预览页确认格式后再导入。
            </Text>
          </View>
        )}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>当前标准导入列</Text>
        <Text style={styles.tipText}>1. 标准工作表：判断题 / 单选题 / 多选题 / 填空</Text>
        <Text style={styles.tipText}>2. 标准表头：题干 / 选项 / 答案 / 难度 / 题型 / 试题解析</Text>
        <Text style={styles.tipText}>3. 题库名默认取 Excel 文件名</Text>
        <Text style={styles.tipText}>4. 选项列使用 # 分隔多个选项</Text>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.tipTitle}>下一阶段接入计划</Text>
        <Text style={styles.tipText}>1. 完善题库详情页和题目浏览</Text>
        <Text style={styles.tipText}>2. 增加重复导入处理与批量导入体验</Text>
        <Text style={styles.tipText}>3. 后续再补微信来源和复习算法</Text>
      </View>
    </ScrollView>
  );
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
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroText: {
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  heroDescription: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  heroActions: {
    gap: spacing.sm,
  },
  primaryAction: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryActionText: {
    color: colors.onBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sectionGap: {
    marginTop: spacing.sm,
  },
  modeList: {
    gap: spacing.md,
  },
  bankList: {
    gap: spacing.md,
  },
  bankCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bankName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  bankSource: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  bankMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  bankFile: {
    color: colors.textMuted,
    fontSize: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  tagText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  tipCard: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  planCard: {
    backgroundColor: colors.tip,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tipTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  tipText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});
