import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { VolumeInfo } from '../services/androidTvConnection';
import { colors, radii, spacing } from '../theme';
import type { AppShortcut, RemoteKey, VoiceSessionState } from '../types/remote';
import { AppShortcutRow } from './AppShortcutRow';
import { DPad } from './DPad';
import { IconButton } from './IconButton';
import { TipPressable } from './TipPressable';
import { VolumeRocker } from './VolumeRocker';

type RemoteCardProps = {
  connectedDeviceName: string | null;
  onKeyPress: (key: RemoteKey) => void;
  onLaunchApp: (app: AppShortcut) => void;
  onOpenSettings: () => void;
  onOpenKeyboard: () => void;
  onSendDigit: (digit: string) => void;
  voiceState: VoiceSessionState;
  onVoicePress: () => void;
  volume?: VolumeInfo | null;
};

type CircleAction = {
  key: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
  renderIcon: (color: string) => ReactNode;
};

export function RemoteCard({
  connectedDeviceName,
  onKeyPress,
  onLaunchApp,
  onOpenSettings,
  onOpenKeyboard,
  onSendDigit,
  voiceState,
  onVoicePress,
  volume = null,
}: RemoteCardProps) {
  const isListening = voiceState === 'listening';
  const isSending = voiceState === 'sending';
  const [numPadOpen, setNumPadOpen] = useState(false);

  const gridActions: CircleAction[] = [
    {
      key: 'keyboard',
      label: 'Keyboard',
      onPress: onOpenKeyboard,
      renderIcon: (color) => <MaterialCommunityIcons name="keyboard-outline" size={26} color={color} />,
    },
    {
      key: 'home',
      label: 'Home',
      onPress: () => onKeyPress('HOME'),
      renderIcon: (color) => <Ionicons name="home-outline" size={24} color={color} />,
    },
    {
      key: 'numpad',
      label: 'Number pad',
      onPress: () => setNumPadOpen(true),
      renderIcon: (color) => <Ionicons name="keypad-outline" size={24} color={color} />,
    },
    {
      key: 'mute',
      label: 'Mute',
      onPress: () => onKeyPress('MUTE'),
      renderIcon: (color) => <Ionicons name="volume-high-outline" size={26} color={color} />,
    },
    {
      key: 'mic',
      label: 'Voice',
      onPress: onVoicePress,
      disabled: isSending,
      loading: isSending,
      active: isListening,
      renderIcon: (color) => <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={26} color={color} />,
    },
    {
      key: 'back',
      label: 'Back',
      onPress: () => onKeyPress('BACK'),
      renderIcon: (color) => <Ionicons name="return-down-back" size={26} color={color} />,
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Remote</Text>
          <Text style={styles.subtitle}>{connectedDeviceName ?? 'Connect a TV to start'}</Text>
        </View>
        <IconButton tip="Power" icon="power" onPress={() => onKeyPress('POWER')} size={44} variant="danger" />
      </View>

      <AppShortcutRow onLaunch={onLaunchApp} />

      <View style={styles.dpadRow}>
        <DPad onKeyPress={onKeyPress} />
      </View>

      <View style={styles.controlsRow}>
        <VolumeRocker
          onVolumeUp={() => onKeyPress('VOLUME_UP')}
          onVolumeDown={() => onKeyPress('VOLUME_DOWN')}
          level={volume?.level ?? null}
          fillRatio={volume && volume.maximum > 0 ? volume.level / volume.maximum : 0}
          muted={volume?.muted ?? false}
        />

        <View style={styles.actionGrid}>
          {gridActions.map((action) => (
            <TipPressable
              key={action.key}
              tip={action.label}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.circleButton,
                action.active && styles.circleButtonActive,
                pressed && styles.circleButtonPressed,
                action.disabled && styles.circleButtonDisabled,
              ]}
            >
              {action.loading ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                action.renderIcon(colors.textPrimary)
              )}
            </TipPressable>
          ))}
        </View>

        <TipPressable
          tip="HDMI 1"
          onPress={() => onKeyPress('HDMI_1')}
          accessibilityRole="button"
          accessibilityLabel="HDMI 1"
          style={({ pressed }) => [styles.hdmiButton, pressed && styles.circleButtonPressed]}
        >
          <MaterialCommunityIcons name="video-input-hdmi" size={28} color={colors.textPrimary} />
          <Text style={styles.hdmiLabel}>HDMI 1</Text>
        </TipPressable>
      </View>

      <TipPressable tip="TV Settings" onPress={onOpenSettings} style={styles.settingsLink}>
        <Ionicons name="settings-outline" size={14} color={colors.textMuted} />
        <Text style={styles.settingsText}>TV Settings</Text>
      </TipPressable>

      <Modal visible={numPadOpen} transparent animationType="fade" onRequestClose={() => setNumPadOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setNumPadOpen(false)}>
          <Pressable style={styles.numPadCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.numPadTitle}>Number pad</Text>
            <View style={styles.numPadGrid}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((digit) => {
                if (digit === '') {
                  return <View key="empty" style={styles.numPadKey} />;
                }
                if (digit === '⌫') {
                  return (
                    <TipPressable
                      key="backspace"
                      tip="Backspace"
                      style={({ pressed }) => [styles.numPadKey, pressed && styles.circleButtonPressed]}
                      onPress={() => onKeyPress('BACK')}
                    >
                      <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
                    </TipPressable>
                  );
                }
                return (
                  <TipPressable
                    key={digit}
                    tip={`Digit ${digit}`}
                    style={({ pressed }) => [styles.numPadKey, pressed && styles.circleButtonPressed]}
                    onPress={() => onSendDigit(digit)}
                  >
                    <Text style={styles.numPadDigit}>{digit}</Text>
                  </TipPressable>
                );
              })}
            </View>
            <Pressable style={styles.numPadClose} onPress={() => setNumPadOpen(false)}>
              <Text style={styles.numPadCloseText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const CIRCLE = 58;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    overflow: 'visible',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    zIndex: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  dpadRow: {
    alignItems: 'center',
    marginVertical: spacing.md,
    zIndex: 2,
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.sm,
    overflow: 'visible',
    zIndex: 3,
  },
  actionGrid: {
    columnGap: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: CIRCLE * 2 + spacing.md,
    justifyContent: 'center',
    overflow: 'visible',
    rowGap: spacing.md,
    width: CIRCLE * 3 + spacing.md * 2,
    zIndex: 3,
  },
  circleButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: CIRCLE / 2,
    borderWidth: 1,
    height: CIRCLE,
    justifyContent: 'center',
    width: CIRCLE,
  },
  circleButtonActive: {
    backgroundColor: 'rgba(135, 206, 235, 0.22)',
    borderColor: '#87CEEB',
  },
  circleButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  circleButtonDisabled: {
    opacity: 0.55,
  },
  hdmiButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    height: 200,
    justifyContent: 'center',
    width: 56,
  },
  hdmiLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  settingsLink: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 4,
  },
  settingsText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  numPadCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    maxWidth: 320,
    padding: spacing.lg,
    width: '100%',
  },
  numPadTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  numPadGrid: {
    columnGap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: spacing.sm,
  },
  numPadKey: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 72,
  },
  numPadDigit: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
  },
  numPadClose: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  numPadCloseText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
