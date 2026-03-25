import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionTitle } from '../components/SectionTitle';
import { colors, radius, spacing } from '../theme';

type PlaceholderScreenProps = {
  title: string;
  description: string;
  checklist: string[];
  onBackHome: () => void;
};

export function PlaceholderScreen({
  title,
  description,
  checklist,
  onBackHome,
}: PlaceholderScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle
        eyebrow="模块预览"
        title={title}
        subtitle={description}
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>这一页会在后续阶段补全</Text>
        <Text style={styles.panelDescription}>
          现在先用占位页确认导航和页面层次已经跑通，避免后面边做功能边返工结构。
        </Text>
        <View style={styles.checklist}>
          {checklist.map((item) => (
            <View key={item} style={styles.checklistRow}>
              <View style={styles.dot} />
              <Text style={styles.checklistText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>当前阶段的目标</Text>
        <Text style={styles.noteText}>先保证移动端最小界面稳定可运行，再接导入与数据库。</Text>
      </View>

      <Pressable onPress={onBackHome} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Text style={styles.backText}>回到首页</Text>
      </Pressable>
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
    fontSize: 21,
    fontWeight: '800',
  },
  panelDescription: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  checklist: {
    gap: spacing.sm,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  checklistText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  noteCard: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  noteTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  noteText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  backButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  backText: {
    color: colors.onBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});

