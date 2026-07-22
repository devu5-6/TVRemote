import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

type VoiceSearchOverlayProps = {
  visible: boolean;
  /** Live transcript (partial or final) of what the phone has heard so far. */
  transcript: string;
  onCancel: () => void;
  onDone: () => void;
};

/**
 * "Speak now" popup for phone-side voice commands. Speech is recognized on the
 * phone (Google recognizer) and the final text is executed on the TV.
 */
export function VoiceSearchOverlay({ visible, transcript, onCancel, onDone }: VoiceSearchOverlayProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.micRing}>
            <Animated.View style={[styles.micPulse, { transform: [{ scale: pulse }] }]} />
            <View style={styles.micCircle}>
              <Ionicons name="mic" size={30} color={colors.onPrimary} />
            </View>
          </View>

          <Text style={styles.title}>Speak now</Text>
          <Text style={styles.transcript} numberOfLines={3}>
            {transcript || 'Try: "play shubh new music on YouTube"'}
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onDone} style={({ pressed }) => [styles.button, styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneLabel}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(4, 10, 22, 0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
  },
  micRing: {
    alignItems: 'center',
    height: 96,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 96,
  },
  micPulse: {
    backgroundColor: 'rgba(52, 225, 161, 0.18)',
    borderRadius: 48,
    height: 96,
    position: 'absolute',
    width: 96,
  },
  micCircle: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  transcript: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
    minHeight: 40,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.md,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderColor: colors.borderSoft,
    borderWidth: 1,
  },
  doneButton: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  cancelLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  doneLabel: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
