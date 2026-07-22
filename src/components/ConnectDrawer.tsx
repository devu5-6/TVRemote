import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../theme';
import type { ConnectionStatus, TvDevice } from '../types/remote';
import { ConnectPanel } from './ConnectPanel';

type ConnectDrawerProps = {
  visible: boolean;
  onClose: () => void;
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
};

export function ConnectDrawer({
  visible,
  onClose,
  ...panelProps
}: ConnectDrawerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close connect drawer"
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <ConnectPanel {...panelProps} embedded />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  dismissArea: {
    // Nearly invisible fill so Android still receives outside taps.
    backgroundColor: 'rgba(0,0,0,0.001)',
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    height: '60%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    minHeight: 28,
  },
  handle: {
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 4,
    width: 40,
  },
  closeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: -4,
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.sm,
  },
});
