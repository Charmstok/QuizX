import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ModeCard } from '../components/ModeCard';
import { SectionTitle } from '../components/SectionTitle';
import { StatCard } from '../components/StatCard';
import { colors, radius, spacing } from '../theme';
import type { QuestionBank, StudyTab } from '../types';

type HomeScreenProps = {
  banks: QuestionBank[];
  totalQuestions: number;
  onOpenTab: (tab: StudyTab) => void;
};

export function HomeScreen({ banks, totalQuestions, onOpenTab }: HomeScreenProps) {
  const handleImport = (source: 'local' | 'wechat') => {
    const label = source === 'local' ? '本地 Excel 导入' : '微信 Excel 导入';
    Alert.alert(label, '当前版本只做界面演示，下一步会接入系统文件选择器和 Excel 解析。');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle
        eyebrow="QuizX MVP"
        title="把题库装进口袋里"
        subtitle="当前版本先完成最小可运行界面，后续逐步接入 Excel 导入、SQLite 存储和真实答题流程。题目类型先固定为判断、单选、多选、填空。"
      />

      <View style={styles.heroCard}>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>先打通导入、浏览和模式入口</Text>
          <Text style={styles.heroDescription}>
            这一版专注于移动端主界面结构，先把题库总览、学习模式和后续入口摆稳。
          </Text>
        </View>
        <View style={styles.heroActions}>
          <Pressable
            onPress={() => handleImport('local')}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
          >
            <Text style={styles.primaryActionText}>导入本地 Excel</Text>
          </Pressable>
          <Pressable
            onPress={() => handleImport('wechat')}
            style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryActionText}>导入微信 Excel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="题库数量" value={String(banks.length)} hint="当前使用占位数据演示" />
        <StatCard
          label="题目总数"
          value={String(totalQuestions)}
          hint="后续将从 SQLite 实时读取"
        />
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle title="学习入口" subtitle="三个核心模块先打通页面跳转。" />
      </View>
      <View style={styles.modeList}>
        <ModeCard
          title="答题模式"
          description="进入刷题页面，后续会增加顺序练习、随机练习与成绩记录。"
          actionLabel="查看占位页"
          accent={colors.brand}
          onPress={() => onOpenTab('quiz')}
        />
        <ModeCard
          title="背诵模式"
          description="更适合快速记忆题干与答案，后续会增加掌握度标记。"
          actionLabel="查看占位页"
          accent={colors.success}
          onPress={() => onOpenTab('recite')}
        />
        <ModeCard
          title="错题本"
          description="集中回看做错的题目，后续会接入错题重做和移出逻辑。"
          actionLabel="查看占位页"
          accent={colors.warning}
          onPress={() => onOpenTab('wrong')}
        />
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle
          title="题库概览"
          subtitle="这部分后续会改成真实数据库内容，当前只展示题库来源、题量和支持题型。"
        />
      </View>
      <View style={styles.bankList}>
        {banks.map((bank) => (
          <View key={bank.id} style={styles.bankCard}>
            <View style={styles.bankHeader}>
              <Text style={styles.bankName}>{bank.name}</Text>
              <Text style={styles.bankSource}>{bank.source}</Text>
            </View>
            <Text style={styles.bankMeta}>
              {bank.questionCount} 题 · 最近更新 {bank.updatedAt}
            </Text>
            <View style={styles.tagRow}>
              {bank.questionTypes.map((questionType) => (
                <View key={questionType} style={styles.tag}>
                  <Text style={styles.tagText}>{questionType}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>下一阶段接入计划</Text>
        <Text style={styles.tipText}>1. SQLite 持久化题库与答题记录</Text>
        <Text style={styles.tipText}>2. 文件选择器读取本地 Excel</Text>
        <Text style={styles.tipText}>3. 导入预览页统一题目结构</Text>
        <Text style={styles.tipText}>4. 最小答题闭环与错题记录</Text>
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
  tipCard: {
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
