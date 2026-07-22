import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ActivityBar } from './src/components/ActivityBar';
import { ConnectDrawer } from './src/components/ConnectDrawer';
import { KeyboardPanel } from './src/components/KeyboardPanel';
import { RemoteCard } from './src/components/RemoteCard';
import { ToastBanner } from './src/components/ToastBanner';
import { VoiceSearchOverlay } from './src/components/VoiceSearchOverlay';
import { useAndroidTvRemote } from './src/hooks/useAndroidTvRemote';
import { colors, spacing } from './src/theme';
import { sanitizeTvDisplayName } from './src/utils/tvDisplayName';

export default function App() {
  const {
    status,
    isBusy,
    isScanning,
    devices,
    selectedDevice,
    connectingHost,
    pairingDevice,
    pairingPin,
    setPairingPin,
    manualIp,
    setManualIp,
    lastAction,
    scanForDevices,
    selectDevice,
    removeDevice,
    confirmPairing,
    connectManualIp,
    sendKey,
    sendText,
    launchApp,
    openTvSettings,
    openFileManager,
    restartTv,
    voiceState,
    voiceOverlayVisible,
    voiceTranscript,
    startVoiceSearch,
    cancelVoiceSearch,
    finishVoiceSearch,
    volume,
  } = useAndroidTvRemote();

  const [keyboardText, setKeyboardText] = useState('');
  const [connectDrawerOpen, setConnectDrawerOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const keyboardInputRef = useRef<TextInput>(null);

  // Keep the connect drawer open when the TV asks for a pairing PIN.
  useEffect(() => {
    if (status === 'awaiting_pin' || pairingDevice) {
      setConnectDrawerOpen(true);
    }
  }, [status, pairingDevice]);

  // Close after a successful connect so the remote is front and center.
  useEffect(() => {
    if (status === 'connected') {
      setConnectDrawerOpen(false);
    }
  }, [status]);

  // Always scan when the drawer opens (connected or not).
  useEffect(() => {
    if (connectDrawerOpen) {
      scanForDevices();
    }
  }, [connectDrawerOpen, scanForDevices]);

  const handleKeyboardSubmit = () => {
    sendText(keyboardText);
    setKeyboardText('');
    Keyboard.dismiss();
  };

  const openKeyboard = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => keyboardInputRef.current?.focus(), 280);
  };

  const isConnected = status === 'connected';

  return (
    <SafeAreaProvider>
      <ToastBanner />
      <VoiceSearchOverlay
        visible={voiceOverlayVisible}
        transcript={voiceTranscript}
        onCancel={cancelVoiceSearch}
        onDone={finishVoiceSearch}
      />
      <ConnectDrawer
        visible={connectDrawerOpen}
        onClose={() => setConnectDrawerOpen(false)}
        status={status}
        devices={devices}
        selectedDeviceId={selectedDevice?.id}
        connectingHost={connectingHost}
        onScan={scanForDevices}
        onSelectDevice={selectDevice}
        onRemoveDevice={removeDevice}
        pairingDevice={pairingDevice}
        pairingPin={pairingPin}
        onChangePairingPin={setPairingPin}
        onConfirmPairing={confirmPairing}
        manualIp={manualIp}
        onChangeManualIp={setManualIp}
        onConnectManualIp={connectManualIp}
        isScanning={isScanning}
      />
      <LinearGradient colors={[colors.backgroundEnd, colors.background]} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar style="light" />
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.logo}>
                <Ionicons name="tv" size={20} color={colors.primary} />
              </View>
              <Pressable
                onPress={() => setConnectDrawerOpen((open) => !open)}
                style={styles.titleRow}
                accessibilityRole="button"
                accessibilityLabel="Open connect TV"
              >
                <View
                  style={[
                    styles.statusDot,
                    status === 'connected' ? styles.statusDotConnected : styles.statusDotOffline,
                  ]}
                />
                <Text style={styles.title}>Connect TV</Text>
                <Ionicons
                  name={connectDrawerOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <View
              style={[styles.stack, !isConnected && styles.stackDisconnected]}
              pointerEvents={isConnected ? 'auto' : 'none'}
            >
              <RemoteCard
                connectedDeviceName={
                  isConnected && selectedDevice
                    ? sanitizeTvDisplayName(selectedDevice.name, selectedDevice.host)
                    : null
                }
                onKeyPress={sendKey}
                onLaunchApp={launchApp}
                onOpenSettings={openTvSettings}
                onOpenFileManager={openFileManager}
                onRestartTv={restartTv}
                onOpenKeyboard={openKeyboard}
                onSendDigit={(digit) => sendText(digit)}
                voiceState={voiceState}
                onVoicePress={startVoiceSearch}
                volume={volume}
              />

              <KeyboardPanel
                value={keyboardText}
                onChange={setKeyboardText}
                onSubmit={handleKeyboardSubmit}
                inputRef={keyboardInputRef}
              />
            </View>

            <ActivityBar message={lastAction} busy={isBusy} />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
    minHeight: 40,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: 'rgba(52, 225, 161, 0.12)',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    width: 40,
    zIndex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusDotConnected: {
    backgroundColor: '#22C55E',
  },
  statusDotOffline: {
    backgroundColor: '#EF4444',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  stack: {
    gap: spacing.md,
  },
  stackDisconnected: {
    opacity: 0.38,
  },
});
