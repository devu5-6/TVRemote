import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

import { APP_SHORTCUTS } from '../constants/appShortcuts';
import { AndroidTvConnection, type VolumeInfo } from '../services/androidTvConnection';
import { scanForAndroidTvDevices } from '../services/androidTvDiscovery';
import { tvCredentialStore } from '../services/tvCredentialStore';
import type { AppShortcut, ConnectionStatus, RemoteKey, TvDevice, VoiceSessionState } from '../types/remote';
import { showTvErrorToast, showTvSuccessToast, showTvToast } from '../utils/tvToast';
import { routeVoiceCommand, youtubeSearchLink } from '../utils/voiceCommandRouter';

const MANUAL_PORT = 6466;

export function useAndroidTvRemote() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [devices, setDevices] = useState<TvDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TvDevice | null>(null);
  const [pairingDevice, setPairingDevice] = useState<TvDevice | null>(null);
  const [pairingPin, setPairingPin] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [volume, setVolume] = useState<VolumeInfo | null>(null);
  const [isPowered, setIsPowered] = useState<boolean | null>(null);
  const [lastAction, setLastAction] = useState('Ready to discover your TV.');
  const [voiceState, setVoiceState] = useState<VoiceSessionState>('idle');
  const [voiceOverlayVisible, setVoiceOverlayVisible] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const [connectingHost, setConnectingHost] = useState<string | null>(null);

  const connectionRef = useRef<AndroidTvConnection | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);
  // Mirrors connectingHost but readable synchronously inside beginConnection,
  // since state updates from the previous call may not have flushed yet.
  const connectingHostRef = useRef<string | null>(null);
  // Phone-side speech recognition session bookkeeping. Refs (not state)
  // because the recognizer's event callbacks need the freshest values
  // synchronously, without waiting for a re-render.
  const voiceLatestTranscriptRef = useRef('');
  const voiceFinalTranscriptRef = useRef('');
  const voiceCancelledRef = useRef(false);

  useEffect(() => {
    void tvCredentialStore.getAll().then((saved) => {
      if (saved.length === 0) return;
      setDevices((current) => {
        const existingHosts = new Set(current.map((device) => device.host));
        const savedDevices: TvDevice[] = saved
          .filter((credential) => !existingHosts.has(credential.host))
          .map((credential) => ({
            id: `${credential.host}:${MANUAL_PORT}`,
            name: credential.name,
            host: credential.host,
            port: MANUAL_PORT,
            model: credential.model,
            isSaved: true,
          }));
        return [...savedDevices, ...current];
      });
    });

    return () => {
      stopScanRef.current?.();
      connectionRef.current?.disconnect();
    };
  }, []);

  const markSaved = useCallback((host: string) => {
    setDevices((current) =>
      current.map((device) => (device.host === host ? { ...device, isSaved: true } : device)),
    );
  }, []);

  const clearConnecting = useCallback((host: string) => {
    if (connectingHostRef.current === host) {
      connectingHostRef.current = null;
      setConnectingHost(null);
    }
  }, []);

  const beginConnection = useCallback(
    (device: TvDevice) => {
      // Guard against duplicate taps (e.g. tapping "Add" then tapping the
      // resulting "Pair" row, or mashing the button while nothing visible
      // seems to happen yet). Without this, every tap restarted the whole
      // handshake - including the ~15-30s key generation - from scratch.
      if (connectingHostRef.current === device.host) {
        showTvToast(`Still working on ${device.name}, please wait...`);
        setLastAction(`Still connecting to ${device.name}, please wait...`);
        return;
      }

      connectionRef.current?.disconnect();
      connectingHostRef.current = device.host;
      setConnectingHost(device.host);
      setStatus('connecting');
      setLastAction(`Connecting to ${device.name}...`);

      const connection = new AndroidTvConnection(device, {
        onGeneratingKeys: () => {
          setLastAction(
            `Setting up secure pairing keys for ${device.name} - first-time setup can take up to a minute, please wait...`,
          );
          showTvToast('Generating secure pairing keys - this can take up to a minute on first pair. Please wait...');
        },
        onPinRequired: () => {
          clearConnecting(device.host);
          setPairingDevice(device);
          setPairingPin('');
          setStatus('awaiting_pin');
          setLastAction(`Enter the PIN shown on ${device.name}.`);
          showTvToast(`Enter the PIN shown on ${device.name}`);
        },
        onConnected: () => {
          clearConnecting(device.host);
          setSelectedDevice(device);
          setPairingDevice(null);
          setPairingPin('');
          setStatus('connected');
          markSaved(device.host);
          setLastAction(`${device.name} is connected.`);
          showTvSuccessToast(`Connected to ${device.name}`);
        },
        onDisconnected: (reason) => {
          clearConnecting(device.host);
          setStatus('idle');
          setSelectedDevice(null);
          setVoiceState('idle');
          if (reason === 'unpaired') {
            setLastAction(`${device.name} needs to be paired again.`);
            showTvErrorToast(`${device.name} needs to be paired again`);
          } else {
            setLastAction(`${device.name} disconnected.`);
            showTvErrorToast(`${device.name} disconnected`);
          }
        },
        onError: (message) => {
          clearConnecting(device.host);
          setStatus('error');
          setPairingDevice(null);
          setPairingPin('');
          setVoiceState('idle');
          setLastAction(message);
          showTvErrorToast(message);
        },
        onAppLinkError: (appLink) => {
          // The connection itself is still alive - the TV just couldn't open
          // that particular app - so only surface a toast, don't touch
          // connection/status state.
          const app = APP_SHORTCUTS.find((shortcut) => shortcut.appLink === appLink);
          const label = app?.label ?? 'that app';
          setLastAction(`${device.name} couldn't open ${label}. Try opening it once from the TV's home screen.`);
          showTvErrorToast(`${device.name} couldn't open ${label}`);
        },
        onVolumeChanged: setVolume,
        onPoweredChanged: setIsPowered,
        onVoiceRequesting: () => {
          setVoiceState('sending');
          setLastAction(`Opening voice search on ${device.name}...`);
        },
        onVoiceListening: () => {
          setVoiceState('listening');
          setLastAction(`Listening... speak now for ${device.name}.`);
        },
        onVoiceEnded: () => {
          setVoiceState('idle');
          setLastAction('Voice search ended.');
        },
        onReconnecting: () => {
          // Stay in "connected" status - this recovers on its own within a
          // couple seconds - but tell the user why a button might briefly
          // seem unresponsive instead of leaving them guessing.
          setLastAction(`${device.name} blinked offline - reconnecting...`);
          showTvToast(`Reconnecting to ${device.name}...`);
        },
      });

      connectionRef.current = connection;
      void connection.connect();
    },
    [clearConnecting, markSaved],
  );

  const scanForDevices = useCallback(() => {
    stopScanRef.current?.();
    setStatus('scanning');
    setLastAction('Scanning your Wi-Fi network for TVs...');

    const foundHosts = new Set<string>();
    const stop = scanForAndroidTvDevices(
      (device) => {
        if (foundHosts.has(device.host)) return;
        foundHosts.add(device.host);
        setDevices((current) => {
          if (current.some((existing) => existing.host === device.host)) return current;
          return [...current, device];
        });
      },
      (message) => {
        setStatus('error');
        setLastAction(message);
        showTvErrorToast(message);
      },
    );
    stopScanRef.current = stop;

    setTimeout(() => {
      setStatus((current) => (current === 'scanning' ? 'idle' : current));
      if (foundHosts.size > 0) {
        setLastAction('Select your TV to connect or pair.');
        showTvSuccessToast(`Found ${foundHosts.size} TV${foundHosts.size > 1 ? 's' : ''} on your network`);
      } else {
        setLastAction('No TVs found. Try manual IP below.');
        showTvErrorToast('No TVs found on this Wi-Fi network. Try the manual IP field below.');
      }
    }, 6200);
  }, []);

  const selectDevice = useCallback(
    (device: TvDevice) => {
      beginConnection(device);
    },
    [beginConnection],
  );

  const removeDevice = useCallback(
    (device: TvDevice) => {
      // If we're mid-connection or currently connected to this exact device,
      // tear that down first so a stale connection/cert isn't left dangling.
      if (connectingHostRef.current === device.host) {
        clearConnecting(device.host);
      }
      if (selectedDevice?.host === device.host) {
        connectionRef.current?.disconnect();
        connectionRef.current = null;
        setSelectedDevice(null);
        setStatus('idle');
      }
      if (pairingDevice?.host === device.host) {
        setPairingDevice(null);
        setPairingPin('');
      }
      void tvCredentialStore.remove(device.host);
      setDevices((current) => current.filter((existing) => existing.host !== device.host));
      setLastAction(`Removed ${device.name}. You can re-pair it with a fresh code.`);
      showTvToast(`Removed ${device.name}`);
    },
    [clearConnecting, pairingDevice, selectedDevice],
  );

  const confirmPairing = useCallback(() => {
    if (!pairingDevice || pairingPin.trim().length < 4) {
      setLastAction('Enter the pairing PIN shown on your TV.');
      showTvErrorToast('Enter the pairing code shown on your TV first');
      return;
    }
    setStatus('verifying_pin');
    setLastAction(`Verifying PIN with ${pairingDevice.name}...`);
    connectionRef.current?.submitPin(pairingPin.trim());
  }, [pairingDevice, pairingPin]);

  const connectManualIp = useCallback(() => {
    const host = manualIp.trim();
    if (!host) {
      setLastAction('Enter your TV IP address first.');
      showTvErrorToast('Enter your TV IP address first');
      return;
    }
    const device: TvDevice = {
      id: `${host}:${MANUAL_PORT}`,
      name: `TV (${host})`,
      host,
      port: MANUAL_PORT,
      model: 'Android TV / Google TV',
      isSaved: false,
    };
    setDevices((current) => {
      if (current.some((existing) => existing.host === host)) return current;
      return [device, ...current];
    });
    setManualIp('');
    beginConnection(device);
  }, [manualIp, beginConnection]);

  const sendKey = useCallback(
    (key: RemoteKey) => {
      if (!selectedDevice || status !== 'connected') {
        setLastAction('Connect a TV first.');
        return;
      }
      if (key === 'HDMI_1') {
        connectionRef.current?.switchToHdmi1();
        setLastAction(`Switching ${selectedDevice.name} to HDMI 1…`);
        return;
      }
      connectionRef.current?.sendKey(key);
      setLastAction(`Sent ${key.replace('_', ' ')} to ${selectedDevice.name}.`);
    },
    [selectedDevice, status],
  );

  const sendText = useCallback(
    (text: string) => {
      if (!selectedDevice || status !== 'connected') {
        setLastAction('Connect a TV first.');
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        setLastAction('Type something to send to the TV.');
        return;
      }
      connectionRef.current?.sendText(trimmed);
      setLastAction(`Sent "${trimmed}" to the TV.`);
    },
    [selectedDevice, status],
  );

  const launchApp = useCallback(
    (app: AppShortcut) => {
      if (!selectedDevice || status !== 'connected') {
        setLastAction('Connect a TV first.');
        showTvErrorToast('Connect a TV first');
        return;
      }
      connectionRef.current?.launchApp(app.appLink);
      setLastAction(`Opening ${app.label} on ${selectedDevice.name}...`);
      showTvToast(`Opening ${app.label}...`);
    },
    [selectedDevice, status],
  );

  const openTvSettings = useCallback(() => {
    if (!selectedDevice || status !== 'connected') {
      setLastAction('Connect a TV first.');
      showTvErrorToast('Connect a TV first');
      return;
    }
    // Tried launching the root settings screen via an
    // "intent:#Intent;action=android.settings.SETTINGS;end" app link, but this
    // TV's remote service rejects any app link that isn't a plain resolvable
    // URL (it answers remoteError AND drops the connection). KEYCODE_SETTINGS
    // is the only settings entry point it accepts remotely - on some TVs that
    // opens the full settings, on others (like this Changhong) a quick
    // picture/sound panel that links onward to the full settings.
    connectionRef.current?.sendKey('SETTINGS');
    setLastAction(`Opening settings on ${selectedDevice.name}...`);
    showTvToast('Opening TV settings...');
  }, [selectedDevice, status]);

  /**
   * Take a finished spoken command ("play shubh new music on youtube") and
   * make the TV act on it. YouTube requests open the YouTube app directly on
   * the search results; everything else goes through the TV's Google search.
   */
  const executeVoiceCommand = useCallback((text: string) => {
    const route = routeVoiceCommand(text);
    if (route.kind === 'youtube') {
      connectionRef.current?.launchApp(youtubeSearchLink(route.query));
      const message = route.query ? `Searching YouTube for "${route.query}"...` : 'Opening YouTube...';
      setLastAction(message);
      showTvToast(message);
    } else {
      void connectionRef.current?.searchOnTv(route.query);
      setLastAction(`Searching your TV for "${route.query}"...`);
      showTvToast(`Searching TV for "${route.query}"...`);
    }
  }, []);

  const resetPhoneVoiceUi = useCallback(() => {
    setVoiceState('idle');
    setVoiceOverlayVisible(false);
    setVoiceTranscript('');
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript ?? '';
    if (text) {
      voiceLatestTranscriptRef.current = text;
      setVoiceTranscript(text);
    }
    if (event.isFinal && text) {
      voiceFinalTranscriptRef.current = text;
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    // "end" always follows "error"; flag the session so it doesn't execute.
    voiceCancelledRef.current = true;
    resetPhoneVoiceUi();
    if (event.error === 'aborted') return; // user tapped Cancel
    if (event.error === 'no-speech') {
      setLastAction("Didn't catch that. Tap the mic and try again.");
      showTvErrorToast("Didn't catch that - try again");
      return;
    }
    setLastAction(`Voice recognition failed (${event.error}).`);
    showTvErrorToast(`Voice recognition failed (${event.error})`);
  });

  useSpeechRecognitionEvent('end', () => {
    const wasCancelled = voiceCancelledRef.current;
    const text = (voiceFinalTranscriptRef.current || voiceLatestTranscriptRef.current).trim();
    voiceCancelledRef.current = false;
    voiceFinalTranscriptRef.current = '';
    voiceLatestTranscriptRef.current = '';
    resetPhoneVoiceUi();
    if (wasCancelled) return;
    if (!text) {
      setLastAction("Didn't catch that. Tap the mic and try again.");
      showTvErrorToast("Didn't catch that - try again");
      return;
    }
    executeVoiceCommand(text);
  });

  /**
   * Voice commands are recognized ON THE PHONE (Google's speech recognizer,
   * with a "Speak now" popup), then the final text is executed on the TV.
   * This replaced streaming raw mic audio to the TV over the remote protocol:
   * this TV accepted the audio session but never transcribed anything, so
   * recognition had to move to the phone. Streaming is kept as a fallback for
   * phones without a speech recognition service.
   */
  const startVoiceSearch = useCallback(async () => {
    if (!selectedDevice || status !== 'connected') {
      setLastAction('Connect a TV first.');
      showTvErrorToast('Connect a TV first');
      return;
    }
    if (voiceState !== 'idle') return;

    let recognitionAvailable = false;
    try {
      recognitionAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      recognitionAvailable = false;
    }
    if (!recognitionAvailable) {
      // No Google/OEM speech service on this phone - stream mic audio to the
      // TV instead and let the TV try to recognize it.
      void connectionRef.current?.startVoiceSearch();
      return;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setLastAction('Microphone permission is required for voice commands.');
      showTvErrorToast('Microphone permission is required for voice commands');
      return;
    }

    voiceCancelledRef.current = false;
    voiceFinalTranscriptRef.current = '';
    voiceLatestTranscriptRef.current = '';
    setVoiceTranscript('');
    setVoiceState('listening');
    setVoiceOverlayVisible(true);
    setLastAction('Listening... speak your command.');
    try {
      ExpoSpeechRecognitionModule.start({
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
      });
    } catch {
      resetPhoneVoiceUi();
      setLastAction('Could not start voice recognition on this phone.');
      showTvErrorToast('Could not start voice recognition on this phone');
    }
  }, [selectedDevice, status, voiceState, resetPhoneVoiceUi]);

  const cancelVoiceSearch = useCallback(() => {
    voiceCancelledRef.current = true;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // recognizer wasn't running - just clean up the UI
    }
    resetPhoneVoiceUi();
    setLastAction('Voice command cancelled.');
  }, [resetPhoneVoiceUi]);

  const finishVoiceSearch = useCallback(() => {
    // Ask the recognizer to wrap up; the "end" event does the execution.
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      resetPhoneVoiceUi();
    }
  }, [resetPhoneVoiceUi]);

  const cancelPairing = useCallback(() => {
    if (pairingDevice) {
      clearConnecting(pairingDevice.host);
    }
    connectionRef.current?.cancelPairing();
    setPairingDevice(null);
    setPairingPin('');
    setStatus('idle');
    setLastAction('Pairing cancelled.');
  }, [pairingDevice, clearConnecting]);

  const isBusy = status === 'connecting' || status === 'scanning' || status === 'verifying_pin';

  return {
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
    volume,
    isPowered,
    lastAction,
    scanForDevices,
    selectDevice,
    removeDevice,
    confirmPairing,
    cancelPairing,
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
  };
}
