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
        eyebrow="使用提示"
        title={title}
        subtitle={description}
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>这个页面暂时还没开放</Text>
        <Text style={styles.panelDescription}>
          你可以先回到首页导入题库，或使用已经开放的答题模式、背诵模式和错题本。
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
        <Text style={styles.noteTitle}>现在可以怎么用</Text>
        <Text style={styles.noteText}>建议先从首页导入 Excel，确认题目无误后，再开始学习。</Text>
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
