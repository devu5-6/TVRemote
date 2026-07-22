import { Ionicons } from '@expo/vector-icons';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInput as TextInputType } from 'react-native';

import { colors, radii, spacing } from '../theme';

type KeyboardPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  inputRef?: RefObject<TextInputType | null>;
};

export function KeyboardPanel({ value, onChange, onSubmit, inputRef }: KeyboardPanelProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Type to search</Text>
      <Text style={styles.helperText}>
        Focus the TV search box first, then send. Works with YouTube search.
      </Text>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.inputIcon} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder="Search movies, apps, videos..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={onSubmit}
        />
        <Pressable style={styles.sendButton} onPress={onSubmit}>
          <Ionicons name="arrow-up" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: 6,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});
