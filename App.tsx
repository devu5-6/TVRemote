import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ActivityBar } from './src/components/ActivityBar';
import { ConnectPanel } from './src/components/ConnectPanel';
import { KeyboardPanel } from './src/components/KeyboardPanel';
import { RemoteCard } from './src/components/RemoteCard';
import { StatusPill } from './src/components/StatusPill';
import { ToastBanner } from './src/components/ToastBanner';
import { VoiceSearchOverlay } from './src/components/VoiceSearchOverlay';
import { useAndroidTvRemote } from './src/hooks/useAndroidTvRemote';
import { colors, spacing } from './src/theme';

export default function App() {
  const {
    status,
    isBusy,
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
    voiceState,
    voiceOverlayVisible,
    voiceTranscript,
    startVoiceSearch,
    cancelVoiceSearch,
    finishVoiceSearch,
    volume,
  } = useAndroidTvRemote();

  const [keyboardText, setKeyboardText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const keyboardInputRef = useRef<TextInput>(null);

  const handleKeyboardSubmit = () => {
    sendText(keyboardText);
    setKeyboardText('');
    Keyboard.dismiss();
  };

  const openKeyboard = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => keyboardInputRef.current?.focus(), 280);
  };

  return (
    <SafeAreaProvider>
      <ToastBanner />
      <VoiceSearchOverlay
        visible={voiceOverlayVisible}
        transcript={voiceTranscript}
        onCancel={cancelVoiceSearch}
        onDone={finishVoiceSearch}
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
              <View style={styles.brandRow}>
                <View style={styles.logo}>
                  <Ionicons name="tv" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.eyebrow}>Android TV · Google TV</Text>
                  <Text style={styles.title}>TV Remote</Text>
                </View>
              </View>
              <StatusPill label={selectedDevice ? 'Connected' : 'Offline'} active={!!selectedDevice} />
            </View>

            <View style={styles.stack}>
              <ConnectPanel
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
              />

              <RemoteCard
                connectedDeviceName={selectedDevice?.name ?? null}
                onKeyPress={sendKey}
                onLaunchApp={launchApp}
                onOpenSettings={openTvSettings}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: 'rgba(52, 225, 161, 0.12)',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  stack: {
    gap: spacing.md,
  },
});
