import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing } from '../theme';
import type { ConnectionStatus, TvDevice } from '../types/remote';
import { sanitizeTvDisplayName } from '../utils/tvDisplayName';

type ConnectPanelProps = {
  status: ConnectionStatus;
  devices: TvDevice[];
  selectedDeviceId?: string;
  connectingHost: string | null;
  onScan: () => void;
  onSelectDevice: (device: TvDevice) => void;
  onRemoveDevice: (device: TvDevice) => void;
  pairingDevice: TvDevice | null;
  pairingPin: string;
  onChangePairingPin: (value: string) => void;
  onConfirmPairing: () => void;
  manualIp: string;
  onChangeManualIp: (value: string) => void;
  onConnectManualIp: () => void;
  isScanning?: boolean;
  /** When true, drop the outer card chrome (used inside the bottom drawer). */
  embedded?: boolean;
};

// Android TV pairing codes are alphanumeric (e.g. "2F05CN"), not strictly hex -
// letters like N, G, etc. can appear, so only strip non-alphanumeric characters.
const PIN_PATTERN = /[^0-9a-zA-Z]/g;
const WIFI_TIP = 'This device and the TV should be connected to the same Wi-Fi.';

export function ConnectPanel({
  status,
  devices,
  selectedDeviceId,
  connectingHost,
  onScan,
  onSelectDevice,
  onRemoveDevice,
  pairingDevice,
  pairingPin,
  onChangePairingPin,
  onConfirmPairing,
  manualIp,
  onChangeManualIp,
  onConnectManualIp,
  isScanning: isScanningProp,
  embedded = false,
}: ConnectPanelProps) {
  const isScanning = isScanningProp ?? status === 'scanning';
  const isVerifyingPin = status === 'verifying_pin';
  const [wifiTipVisible, setWifiTipVisible] = useState(false);
  const tipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    },
    [],
  );

  const showWifiTip = () => {
    if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    setWifiTipVisible(true);
    tipHideTimer.current = setTimeout(() => setWifiTipVisible(false), 3500);
  };

  const handlePinChange = (value: string) => {
    onChangePairingPin(value.replace(PIN_PATTERN, '').toUpperCase());
  };

  const handleRemove = (device: TvDevice) => {
    Alert.alert(
      'Remove this TV?',
      `${device.name} will be removed from your saved list. You can re-add it later by scanning again or entering its IP manually.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveDevice(device) },
      ],
    );
  };

  return (
    <View style={[styles.card, embedded && styles.cardEmbedded]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Connect a TV</Text>
            <Pressable
              onPress={showWifiTip}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={WIFI_TIP}
              style={styles.infoButton}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          {wifiTipVisible ? (
            <View style={styles.tipBubble}>
              <Text style={styles.tipText}>{WIFI_TIP}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={styles.scanButton} onPress={onScan} disabled={isScanning}>
          {isScanning ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Ionicons name="search" size={16} color={colors.onPrimary} />
          )}
          <Text style={styles.scanButtonText}>Scan</Text>
        </Pressable>
      </View>

      {devices.length > 0 && (
        <View style={styles.deviceList}>
          {devices.map((device) => {
            const isActive = device.id === selectedDeviceId;
            const isConnectingThis = device.host === connectingHost;
            return (
              <View key={device.id} style={[styles.deviceRow, isActive && styles.deviceRowActive]}>
                <Pressable
                  style={styles.deviceRowMain}
                  onPress={() => onSelectDevice(device)}
                  disabled={isConnectingThis}
                >
                  <View style={styles.deviceIconWrap}>
                    <Ionicons name="tv-outline" size={20} color={isActive ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{sanitizeTvDisplayName(device.name, device.host)}</Text>
                  </View>
                  <View style={styles.deviceActionWrap}>
                    {isConnectingThis ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : isActive ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : (
                      <Text style={styles.deviceActionText}>{device.isSaved ? 'Connect' : 'Pair'}</Text>
                    )}
                  </View>
                </Pressable>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => handleRemove(device)}
                  disabled={isConnectingThis}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {devices.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="wifi-outline" size={22} color={colors.textMuted} />
          <Text style={styles.emptyStateText}>No TVs found yet. Tap Scan to search your network.</Text>
        </View>
      )}

      {pairingDevice && (
        <View style={styles.pairingPanel}>
          <Text style={styles.pairingTitle}>
            Enter code for {sanitizeTvDisplayName(pairingDevice.name, pairingDevice.host)}
          </Text>
          <Text style={styles.helperText}>Type the 6-character code shown on your TV screen (numbers and letters).</Text>
          <View style={styles.inlineForm}>
            <TextInput
              value={pairingPin}
              onChangeText={handlePinChange}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="3F2A1B"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.pinInput]}
              maxLength={6}
              editable={!isVerifyingPin}
            />
            <Pressable
              style={[styles.inlineButton, isVerifyingPin && styles.inlineButtonDisabled]}
              onPress={onConfirmPairing}
              disabled={isVerifyingPin}
            >
              {isVerifyingPin ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.inlineButtonText}>Pair</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.divider} />

      <Text style={styles.manualLabel}>Manual IP fallback</Text>
      <View style={styles.inlineForm}>
        <TextInput
          value={manualIp}
          onChangeText={onChangeManualIp}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="192.168.1.25"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Pressable
          style={[styles.inlineButtonOutline, connectingHost !== null && styles.inlineButtonDisabled]}
          onPress={onConnectManualIp}
          disabled={connectingHost !== null}
        >
          <Text style={styles.inlineButtonOutlineText}>Add</Text>
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
  cardEmbedded: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  infoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  tipBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    elevation: 4,
    marginTop: 8,
    maxWidth: 260,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  tipText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 6,
    minWidth: 88,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scanButtonText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  deviceList: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  deviceRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    paddingRight: spacing.xs,
  },
  deviceRowActive: {
    borderColor: 'rgba(52, 225, 161, 0.4)',
  },
  deviceRowMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  deviceIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  deviceMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  deviceActionWrap: {
    paddingHorizontal: 4,
  },
  deviceActionText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  pairingPanel: {
    backgroundColor: 'rgba(91, 141, 239, 0.08)',
    borderColor: 'rgba(91, 141, 239, 0.3)',
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  pairingTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    backgroundColor: colors.borderSoft,
    height: 1,
    marginVertical: spacing.md,
  },
  manualLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineForm: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inlineButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inlineButtonDisabled: {
    opacity: 0.6,
  },
  inlineButtonText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  pinInput: {
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  inlineButtonOutline: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inlineButtonOutlineText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});
