import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  onOpenBankDetail: (bank: QuestionBank) => void;
  onImportLocal: () => void;
};

export function HomeScreen({
  banks,
  totalQuestions,
  isImporting,
  onOpenTab,
  onOpenBankDetail,
  onImportLocal,
}: HomeScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle
        eyebrow="QuizX"
        title="把题库装进口袋里"
        subtitle="先导入题库，再开始答题、背诵和错题重做。你可以一次选择多个 Excel，也可以直接从微信把 Excel 分享给 QuizX。系统会先给你预览结果，确认无误后再导入。"
      />

      <View style={styles.heroCard}>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>3 步开始使用</Text>
          <Text style={styles.heroDescription}>
            1. 先选择一个或多个 Excel。2. 在预览页检查题型、答案和重复提示。3. 确认导入后，就可以在答题模式、背诵模式和错题本里直接使用。
          </Text>
        </View>
        <View style={styles.heroActions}>
          <Pressable
            onPress={onImportLocal}
            disabled={isImporting}
            style={({ pressed }) => [
              styles.primaryAction,
              (pressed || isImporting) && styles.pressed,
            ]}
          >
            <Text style={styles.primaryActionText}>
              {isImporting ? '正在准备文件...' : '导入本地 Excel'}
            </Text>
          </Pressable>
          <Text style={styles.heroHint}>
            如果文件在微信里，不用先下载到首页。直接在微信里把 Excel 分享给 QuizX，即可自动进入导入预览。
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="题库数量" value={String(banks.length)} hint="已经导入的题库总数" />
        <StatCard label="题目总数" value={String(totalQuestions)} hint="导入完成后会自动更新" />
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle title="学习入口" subtitle="导入完成后，可以从这里选择不同的学习方式。" />
      </View>
      <View style={styles.modeList}>
        <ModeCard
          title="答题模式"
          description="按顺序做题，提交后立即看到对错。做完一轮会自动保存结果，方便下次继续。"
          actionLabel="开始顺序练习"
          accent={colors.brand}
          onPress={() => onOpenTab('quiz')}
        />
        <ModeCard
          title="背诵模式"
          description="先看题目，再显示答案，并用“会 / 模糊 / 不会”标记掌握情况。"
          actionLabel="开始背诵"
          accent={colors.success}
          onPress={() => onOpenTab('recite')}
        />
        <ModeCard
          title="错题本"
          description="集中重做之前答错的题，答对后会自动移出，方便反复巩固。"
          actionLabel="开始重做"
          accent={colors.warning}
          onPress={() => onOpenTab('wrong')}
        />
      </View>

      <View style={styles.sectionGap}>
        <SectionTitle
          title="题库概览"
          subtitle="这里会显示已经导入的题库。点开任意题库，可以先浏览题目和答案。"
        />
      </View>
      <View style={styles.bankList}>
        {banks.length > 0 ? (
          banks.map((bank) => (
            <Pressable
              key={bank.id}
              onPress={() => onOpenBankDetail(bank)}
              style={({ pressed }) => [styles.bankCard, pressed && styles.pressed]}
            >
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
              <Text style={styles.bankAction}>查看题库详情</Text>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有题库</Text>
            <Text style={styles.emptyText}>
              先导入一个 Excel。进入预览页后检查题目是否正确，再确认导入。
            </Text>
          </View>
        )}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>导入前先看</Text>
        <Text style={styles.tipText}>1. 推荐使用 4 个工作表：判断题 / 单选题 / 多选题 / 填空</Text>
        <Text style={styles.tipText}>2. 推荐列名：题干 / 选项 / 答案 / 难度 / 题型 / 试题解析</Text>
        <Text style={styles.tipText}>3. 题库名称默认使用 Excel 文件名</Text>
        <Text style={styles.tipText}>4. 多个选项写在同一格时，用 # 分隔</Text>
        <Text style={styles.tipText}>5. 文件名相同只会提醒，不会直接判定为重复</Text>
        <Text style={styles.tipText}>6. 是否重复，以题目内容是否相同为准</Text>
        <Text style={styles.tipText}>7. 微信导入：在微信里把 Excel 直接分享给 QuizX</Text>
        <Text style={styles.tipText}>8. 旧格式表格也会尽量兼容读取</Text>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.tipTitle}>微信导入这样做</Text>
        <Text style={styles.tipText}>1. 在微信聊天、群文件或文件传输助手里找到 Excel</Text>
        <Text style={styles.tipText}>2. 点击分享或“用其他应用打开”，选择 QuizX</Text>
        <Text style={styles.tipText}>3. 回到 QuizX 后检查预览，确认无误再导入</Text>
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
  heroHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
  bankAction: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '700',
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
