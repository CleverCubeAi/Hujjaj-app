import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, space, tapTarget } from '../theme/tokens';

export function Screen({
  children,
  padded = true,
  scroll = false,
}: {
  children: React.ReactNode;
  padded?: boolean;
  scroll?: boolean;
}) {
  const body = (
    <View style={[styles.screenInner, padded && { padding: space.md }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'gold' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const palette = {
    primary: { bg: colors.tealDeep, fg: colors.ivory },
    gold: { bg: colors.gold, fg: colors.navy },
    ghost: { bg: colors.ivory, fg: colors.navy },
    danger: { bg: colors.danger, fg: colors.ivory },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.btnText, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={styles.input}
        accessibilityLabel={label || placeholder}
      />
    </View>
  );
}

export function KpiTile({
  title,
  value,
  hint,
  money,
}: {
  title: string;
  value: string;
  hint?: string;
  money?: boolean;
}) {
  return (
    <Card style={styles.kpi}>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={[styles.kpiValue, money && { color: colors.gold }]}>{value}</Text>
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
    </Card>
  );
}

export function Skeleton({ height = 88 }: { height?: number }) {
  return <View style={[styles.skel, { height }]} />;
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{title}</Text>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sand },
  screenInner: { flex: 1 },
  card: {
    backgroundColor: colors.ivory,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.navy, lineHeight: 32, fontFamily: 'Tajawal_700Bold' },
  section: { fontSize: 18, fontWeight: '700', color: colors.tealDeep, marginBottom: 8, fontFamily: 'Tajawal_700Bold' },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17, fontFamily: 'Tajawal_400Regular' },
  label: { fontSize: 13, fontWeight: '600', color: colors.navy, fontFamily: 'Tajawal_500Medium' },
  input: {
    minHeight: tapTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    color: colors.navy,
    fontSize: 16,
    fontFamily: 'Tajawal_400Regular',
  },
  btn: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnText: { fontSize: 16, fontWeight: '700', fontFamily: 'Tajawal_700Bold' },
  kpi: { flex: 1, minWidth: '46%', gap: 4 },
  kpiTitle: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  kpiValue: { fontSize: 28, fontWeight: '700', color: colors.navy, lineHeight: 32 },
  skel: { backgroundColor: colors.border, borderRadius: radius.lg, opacity: 0.55 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.navy, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.navy },
});
