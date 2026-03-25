import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  formatAnswerSummary,
  getImportPreviewStats,
  isImportRowValid,
} from '../importer/localExcelImport';
import { colors, radius, spacing } from '../theme';
import type { ImportPreview } from '../types';
import { SectionTitle } from '../components/SectionTitle';

type ImportPreviewScreenProps = {
  preview: ImportPreview;
  isSaving: boolean;
  onConfirm: () => void;
  onRepick: () => void;
  onCancel: () => void;
};

export function ImportPreviewScreen({
  preview,
  isSaving,
  onConfirm,
  onRepick,
  onCancel,
}: ImportPreviewScreenProps) {
  const stats = getImportPreviewStats(preview);
  const visibleRows = preview.rows.slice(0, 8);
  const invalidRows = preview.rows.filter((row) => !isImportRowValid(row));
  const canConfirm = stats.validCount > 0 && stats.invalidCount === 0 && !isSaving;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle
        eyebrow="导入预览"
        title={preview.bankName}
        subtitle={`文件 ${preview.fileName} 已完成解析。现在先确认标准化结果，再决定是否写入 SQLite。`}
      />

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroBlock}>
            <Text style={styles.heroLabel}>导入来源</Text>
            <Text style={styles.heroValue}>{preview.source}</Text>
          </View>
          <View style={styles.heroBlock}>
            <Text style={styles.heroLabel}>工作表</Text>
            <Text style={styles.heroValue}>{stats.sheetCount} 个</Text>
          </View>
          <View style={styles.heroBlock}>
            <Text style={styles.heroLabel}>题型</Text>
            <Text style={styles.heroValue}>
              {stats.questionTypes.length > 0 ? stats.questionTypes.join(' / ') : '待修正'}
            </Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={[styles.metricCard, styles.metricCardSuccess]}>
            <Text style={styles.metricLabel}>可导入</Text>
            <Text style={styles.metricValue}>{stats.validCount}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardDanger]}>
            <Text style={styles.metricLabel}>需修正</Text>
            <Text style={styles.metricValue}>{stats.invalidCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>总题数</Text>
            <Text style={styles.metricValue}>{stats.totalRows}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>统一导入格式</Text>
        <Text style={styles.panelDescription}>
          推荐优先使用这些标准列名。当前解析器也兼容常见别名，但最终都会统一映射到同一套题目结构。
        </Text>
        <View style={styles.tagRow}>
          {preview.standardColumns.map((column) => (
            <View key={column} style={styles.columnTag}>
              <Text style={styles.columnTagText}>{column}</Text>
            </View>
          ))}
        </View>
      </View>

      {preview.workbookWarnings.length > 0 ? (
        <View style={[styles.panel, styles.warningPanel]}>
          <Text style={styles.warningTitle}>文件级提示</Text>
          {preview.workbookWarnings.map((warning) => (
            <Text key={warning} style={styles.warningText}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}

      {invalidRows.length > 0 ? (
        <View style={[styles.panel, styles.errorPanel]}>
          <Text style={styles.errorTitle}>未通过校验的行</Text>
          {invalidRows.slice(0, 6).map((row) => (
            <View key={row.id} style={styles.issueRow}>
              <Text style={styles.issueLabel}>
                {row.sheetName} · 第 {row.rowNumber} 行
              </Text>
              {row.errors.map((error) => (
                <Text key={error} style={styles.issueText}>
                  {error}
                </Text>
              ))}
            </View>
          ))}
          {invalidRows.length > 6 ? (
            <Text style={styles.issueMore}>其余 {invalidRows.length - 6} 行请继续向下检查。</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>题目预览</Text>
        <Text style={styles.panelDescription}>
          这里只展开前 {visibleRows.length} 行，重点确认题型识别、选项拆分和答案映射是否正确。
        </Text>

        <View style={styles.previewList}>
          {visibleRows.map((row) => {
            const isValid = isImportRowValid(row);

            return (
              <View
                key={row.id}
                style={[styles.questionCard, !isValid && styles.questionCardDanger]}
              >
                <View style={styles.questionHeader}>
                  <Text style={styles.questionMeta}>
                    {row.sheetName} · 第 {row.rowNumber} 行
                  </Text>
                  <Text style={[styles.questionType, !isValid && styles.questionTypeDanger]}>
                    {row.type ?? '未识别'}
                  </Text>
                </View>

                <Text style={styles.questionStem}>{row.stem || '题目内容为空'}</Text>

                {row.options.length > 0 ? (
                  <View style={styles.optionList}>
                    {row.options.map((option) => (
                      <Text key={`${row.id}-${option.key}`} style={styles.optionText}>
                        {option.key}. {option.text}
                      </Text>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.answerText}>答案：{formatAnswerSummary(row)}</Text>

                {row.explanation ? (
                  <Text style={styles.explanationText}>解析：{row.explanation}</Text>
                ) : null}

                {row.tags.length > 0 ? (
                  <Text style={styles.tagText}>标签：{row.tags.join(' / ')}</Text>
                ) : null}

                {row.errors.map((error) => (
                  <Text key={`${row.id}-${error}`} style={styles.rowErrorText}>
                    {error}
                  </Text>
                ))}
                {row.warnings.map((warning) => (
                  <Text key={`${row.id}-${warning}`} style={styles.rowWarningText}>
                    {warning}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.actionGroup}>
        <Pressable
          onPress={onConfirm}
          disabled={!canConfirm}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || !canConfirm) && styles.buttonPressed,
            !canConfirm && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? '写入 SQLite 中...' : '确认导入到 SQLite'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onRepick}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isSaving) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>重新选择文件</Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={isSaving}
          style={({ pressed }) => [styles.ghostButton, (pressed || isSaving) && styles.buttonPressed]}
        >
          <Text style={styles.ghostButtonText}>先返回首页</Text>
        </Pressable>
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
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroHeader: {
    gap: spacing.md,
  },
  heroBlock: {
    gap: spacing.xs,
  },
  heroLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  metricCardSuccess: {
    backgroundColor: colors.successSoft,
  },
  metricCardDanger: {
    backgroundColor: colors.dangerSoft,
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
    fontSize: 20,
    fontWeight: '800',
  },
  panelDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  columnTag: {
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  columnTagText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  warningPanel: {
    backgroundColor: colors.warningSoft,
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: '800',
  },
  warningText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
  },
  errorPanel: {
    backgroundColor: colors.dangerSoft,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
  },
  issueRow: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  issueLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  issueText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  issueMore: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  previewList: {
    gap: spacing.md,
  },
  questionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  questionCardDanger: {
    borderColor: colors.danger,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  questionMeta: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  questionType: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
  },
  questionTypeDanger: {
    color: colors.danger,
  },
  questionStem: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  optionList: {
    gap: 6,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  answerText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  explanationText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  tagText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rowErrorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
  },
  rowWarningText: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 20,
  },
  actionGroup: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.onBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  ghostButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  ghostButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    backgroundColor: colors.textMuted,
  },
});
