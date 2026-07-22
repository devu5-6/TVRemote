import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { VolumeInfo } from '../services/androidTvConnection';
import { colors, radii, spacing } from '../theme';
import type { AppShortcut, RemoteKey, VoiceSessionState } from '../types/remote';
import { AppShortcutRow } from './AppShortcutRow';
import { ChannelRocker } from './ChannelRocker';
import { DPad } from './DPad';
import { IconButton } from './IconButton';
import { TipPressable, pressedIconColor } from './TipPressable';
import { VolumeRocker } from './VolumeRocker';

type RemoteCardProps = {
  connectedDeviceName: string | null;
  onKeyPress: (key: RemoteKey) => void;
  onLaunchApp: (app: AppShortcut) => void;
  onOpenSettings: () => void;
  onOpenFileManager: () => void;
  onRestartTv: () => void;
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
  onOpenFileManager,
  onRestartTv,
  onOpenKeyboard,
  onSendDigit,
  voiceState,
  onVoicePress,
  volume = null,
}: RemoteCardProps) {
  const isListening = voiceState === 'listening';
  const isSending = voiceState === 'sending';
  const isMuted = volume?.muted ?? false;
  const [numPadOpen, setNumPadOpen] = useState(false);

  const leftColumn: CircleAction[] = [
    {
      key: 'keyboard',
      label: 'Keyboard',
      onPress: onOpenKeyboard,
      renderIcon: (color) => <MaterialCommunityIcons name="keyboard-outline" size={26} color={color} />,
    },
    {
      key: 'files',
      label: 'Files / USB',
      onPress: onOpenFileManager,
      renderIcon: (color) => <MaterialCommunityIcons name="usb" size={26} color={color} />,
    },
    {
      key: 'mute',
      label: isMuted ? 'Unmute' : 'Mute',
      onPress: () => onKeyPress('MUTE'),
      active: isMuted,
      renderIcon: (color) => (
        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high-outline'} size={26} color={color} />
      ),
    },
  ];

  const middleColumn: CircleAction[] = [
    {
      key: 'home',
      label: 'Home',
      onPress: () => onKeyPress('HOME'),
      renderIcon: (color) => <Ionicons name="home-outline" size={24} color={color} />,
    },
    {
      key: 'hdmi',
      label: 'HDMI 1',
      onPress: () => onKeyPress('HDMI_1'),
      renderIcon: (color) => <MaterialCommunityIcons name="video-input-hdmi" size={26} color={color} />,
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
  ];

  const rightColumn: CircleAction[] = [
    {
      key: 'numpad',
      label: 'Number pad',
      onPress: () => setNumPadOpen(true),
      renderIcon: (color) => <Ionicons name="keypad-outline" size={24} color={color} />,
    },
    {
      key: 'restart',
      label: 'Restart TV',
      onPress: onRestartTv,
      renderIcon: (color) => <MaterialCommunityIcons name="restart" size={26} color={color} />,
    },
    {
      key: 'back',
      label: 'Back',
      onPress: () => onKeyPress('BACK'),
      renderIcon: (color) => <Ionicons name="return-down-back" size={26} color={color} />,
    },
  ];

  const renderCircle = (action: CircleAction) => (
    <TipPressable
      key={action.key}
      tip={action.label}
      onPress={action.onPress}
      disabled={action.disabled}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={[
        styles.circleButton,
        action.active && styles.circleButtonActive,
        action.disabled && styles.circleButtonDisabled,
      ]}
    >
      {({ pressed }) =>
        action.loading ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          action.renderIcon(pressed ? pressedIconColor : colors.textPrimary)
        )
      }
    </TipPressable>
  );

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
          <View style={styles.gridColumn}>{leftColumn.map(renderCircle)}</View>
          <View style={styles.gridColumn}>{middleColumn.map(renderCircle)}</View>
          <View style={styles.gridColumn}>{rightColumn.map(renderCircle)}</View>
        </View>

        <ChannelRocker
          onChannelUp={() => onKeyPress('CHANNEL_UP')}
          onChannelDown={() => onKeyPress('CHANNEL_DOWN')}
        />
      </View>

      <TipPressable tip="TV Settings" onPress={onOpenSettings} style={styles.settingsLink} showPressedOverlay={false}>
        {({ pressed }) => (
          <>
            <Ionicons
              name="settings-outline"
              size={14}
              color={pressed ? '#3A4254' : colors.textMuted}
            />
            <Text style={[styles.settingsText, pressed && styles.settingsTextPressed]}>TV Settings</Text>
          </>
        )}
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
                      style={styles.numPadKey}
                      onPress={() => onKeyPress('BACK')}
                    >
                      {({ pressed }) => (
                        <Ionicons
                          name="backspace-outline"
                          size={22}
                          color={pressed ? pressedIconColor : colors.textPrimary}
                        />
                      )}
                    </TipPressable>
                  );
                }
                return (
                  <TipPressable
                    key={digit}
                    tip={`Digit ${digit}`}
                    style={styles.numPadKey}
                    onPress={() => onSendDigit(digit)}
                  >
                    {({ pressed }) => (
                      <Text style={[styles.numPadDigit, pressed && styles.numPadDigitPressed]}>{digit}</Text>
                    )}
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
    overflow: 'visible',
    padding: spacing.lg,
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
    flexDirection: 'row',
    gap: spacing.md,
    overflow: 'visible',
    zIndex: 3,
  },
  gridColumn: {
    gap: spacing.md,
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
  circleButtonDisabled: {
    opacity: 0.55,
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
  settingsTextPressed: {
    color: colors.textSecondary,
    opacity: 0.55,
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
  numPadDigitPressed: {
    color: pressedIconColor,
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
