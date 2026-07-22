import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  APP_SHORTCUTS,
  FILE_MANAGER_PACKAGE_CANDIDATES,
  looksLikeFileManagerPackage,
  looksLikeMultiScreenPackage,
  marketLaunchLink,
} from '../constants/appShortcuts';
import { AndroidTvConnection, type VolumeInfo } from '../services/androidTvConnection';
import { scanForAndroidTvDevices } from '../services/androidTvDiscovery';
import { tvCredentialStore } from '../services/tvCredentialStore';
import type { AppShortcut, ConnectionStatus, RemoteKey, TvDevice, VoiceSessionState } from '../types/remote';
import { getHasLocalNetwork, hasLocalNetwork, WIFI_OFF_MESSAGE } from '../utils/localNetwork';
import { isBenignSocketError } from '../utils/socketErrors';
import { showTvErrorToast, showTvSuccessToast, showTvToast, showWifiOffToast, clearWifiOffToast } from '../utils/tvToast';
import { isGenericTvName, sanitizeTvDisplayName } from '../utils/tvDisplayName';
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
  const [isScanning, setIsScanning] = useState(false);

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
  const beginConnectionRef = useRef<(device: TvDevice) => void>(() => {});
  const didAutoConnectRef = useRef(false);
  // Multi-Screen Share: learn real package from current_app (guesses show
  // "item not found" on this TV). Never send bare package names.
  const multiScreenPackageRef = useRef<string | null>(null);
  const multiScreenWaitingRef = useRef(false);
  // File manager / USB browser — same learn-or-launch pattern.
  const fileManagerPackageRef = useRef<string | null>(null);
  const fileManagerWaitingRef = useRef(false);
  const fileManagerQueueRef = useRef<string[]>([]);
  const fileManagerAttemptRef = useRef<string | null>(null);
  const reconnectToastShownRef = useRef(false);
  const wifiOffToastShownRef = useRef(false);
  // Start false until the first Wi‑Fi check completes — avoids reconnect races.
  const hasLocalNetworkRef = useRef(false);

  useEffect(() => {
    void Promise.all([
      tvCredentialStore.getMultiScreenPackage(),
      tvCredentialStore.getFileManagerPackage(),
    ]).then(([sharePkg, filesPkg]) => {
      if (sharePkg) multiScreenPackageRef.current = sharePkg;
      if (filesPkg) fileManagerPackageRef.current = filesPkg;
    });
  }, []);

  // When Wi‑Fi drops, stop reconnect spam: tear down once and toast once.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const handleOffline = () => {
      if (cancelled) return;
      // Already handled this offline stretch — don't tear down / toast again.
      if (!hasLocalNetworkRef.current && wifiOffToastShownRef.current) {
        return;
      }
      hasLocalNetworkRef.current = false;
      stopScanRef.current?.();
      stopScanRef.current = null;
      setIsScanning(false);

      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
      }
      connectingHostRef.current = null;
      setConnectingHost(null);
      setSelectedDevice(null);
      setPairingDevice(null);
      setPairingPin('');
      setVoiceState('idle');
      setVolume(null);
      setStatus('idle');
      setLastAction(WIFI_OFF_MESSAGE);

      wifiOffToastShownRef.current = true;
      // Defer so ToastBanner has subscribed (avoids a dropped first toast).
      setTimeout(() => {
        if (!cancelled) showWifiOffToast();
      }, 0);
    };

    const handleOnline = () => {
      if (cancelled) return;
      hasLocalNetworkRef.current = true;
      wifiOffToastShownRef.current = false;
      clearWifiOffToast();
    };

    const applyNetworkState = (state: Network.NetworkState) => {
      if (cancelled) return;
      if (hasLocalNetwork(state)) {
        handleOnline();
      } else {
        handleOffline();
      }
    };

    const refreshNetwork = async () => {
      if (cancelled) return;
      const online = await getHasLocalNetwork();
      if (cancelled) return;
      if (online) handleOnline();
      else handleOffline();
    };

    void Network.getNetworkStateAsync().then(applyNetworkState).catch(() => {
      void refreshNetwork();
    });
    const sub = Network.addNetworkStateListener(applyNetworkState);

    // Re-check shortly after mount and periodically — listener alone can miss
    // "already offline" or Wi‑Fi toggled while the app was backgrounded.
    const startupTimer = setTimeout(() => {
      void refreshNetwork();
    }, 400);
    pollTimer = setInterval(() => {
      void refreshNetwork();
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(startupTimer);
      if (pollTimer) clearInterval(pollTimer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Gate on Wi‑Fi BEFORE any reconnect toast or connection attempt.
      const online = await getHasLocalNetwork();
      if (cancelled) return;
      hasLocalNetworkRef.current = online;

      const [saved, lastHost] = await Promise.all([
        tvCredentialStore.getAll(),
        tvCredentialStore.getLastHost(),
      ]);
      if (cancelled) return;

      if (saved.length > 0) {
        const savedDevices: TvDevice[] = saved.map((credential) => {
          const name = sanitizeTvDisplayName(credential.name, credential.host);
          if (name !== credential.name) {
            void tvCredentialStore.save({ ...credential, name });
          }
          return {
            id: `${credential.host}:${MANUAL_PORT}`,
            name,
            host: credential.host,
            port: MANUAL_PORT,
            model: credential.model,
            isSaved: true,
          };
        });

        setDevices((current) => {
          const existingHosts = new Set(current.map((device) => device.host));
          const missing = savedDevices.filter((device) => !existingHosts.has(device.host));
          return missing.length === 0 ? current : [...missing, ...current];
        });

        if (!online) {
          setLastAction(WIFI_OFF_MESSAGE);
          if (!wifiOffToastShownRef.current) {
            wifiOffToastShownRef.current = true;
            showWifiOffToast();
          }
          return;
        }

        if (didAutoConnectRef.current) return;
        const preferred =
          (lastHost ? savedDevices.find((device) => device.host === lastHost) : undefined) ??
          (savedDevices.length === 1 ? savedDevices[0] : undefined);
        if (!preferred) return;

        didAutoConnectRef.current = true;
        setLastAction(`Reconnecting to ${preferred.name}...`);
        showTvToast(`Reconnecting to ${preferred.name}...`);
        beginConnectionRef.current(preferred);
        return;
      }

      if (!online) {
        setLastAction(WIFI_OFF_MESSAGE);
        if (!wifiOffToastShownRef.current) {
          wifiOffToastShownRef.current = true;
          showWifiOffToast();
        }
      }
    })();

    return () => {
      cancelled = true;
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

  const beginConnection = useCallback((device: TvDevice) => {
    // Guard against duplicate taps (e.g. tapping "Add" then tapping the
    // resulting "Pair" row, or mashing the button while nothing visible
    // seems to happen yet). Without this, every tap restarted the whole
    // handshake - including the ~15-30s key generation - from scratch.
    if (connectingHostRef.current === device.host) {
      showTvToast(`Still working on ${device.name}, please wait...`);
      setLastAction(`Still connecting to ${device.name}, please wait...`);
      return;
    }

    void (async () => {
      // Always re-check Wi‑Fi before connecting — don't trust a stale ref.
      const online = await getHasLocalNetwork();
      hasLocalNetworkRef.current = online;
      if (!online) {
        setLastAction(WIFI_OFF_MESSAGE);
        if (!wifiOffToastShownRef.current) {
          wifiOffToastShownRef.current = true;
          showWifiOffToast();
        }
        return;
      }

      if (connectingHostRef.current === device.host) return;

      reconnectToastShownRef.current = false;
      connectionRef.current?.disconnect();
      connectionRef.current = null;
      connectingHostRef.current = device.host;
      setConnectingHost(device.host);
      setSelectedDevice(null);
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
          reconnectToastShownRef.current = false;
          wifiOffToastShownRef.current = false;
          clearWifiOffToast();
          setSelectedDevice(device);
          setPairingDevice(null);
          setPairingPin('');
          setStatus('connected');
          markSaved(device.host);
          void tvCredentialStore.setLastHost(device.host);
          setLastAction(`${device.name} is connected.`);
          showTvSuccessToast(`Connected to ${device.name}`);
        },
        onDisconnected: (reason) => {
          clearConnecting(device.host);
          setStatus('idle');
          setSelectedDevice(null);
          setVoiceState('idle');
          setVolume(null);
          if (!hasLocalNetworkRef.current) {
            setLastAction(WIFI_OFF_MESSAGE);
            return;
          }
          if (reason === 'unpaired') {
            setLastAction(`${device.name} needs to be paired again.`);
            showTvErrorToast(`${device.name} needs to be paired again`);
          } else {
            setLastAction(`${device.name} disconnected.`);
            showTvErrorToast(`${device.name} disconnected`);
          }
        },
        onError: (message) => {
          // Teardown/reconnect races from react-native-tcp-socket — ignore.
          if (isBenignSocketError(message)) return;
          clearConnecting(device.host);
          setStatus('error');
          setSelectedDevice(null);
          setPairingDevice(null);
          setPairingPin('');
          setVoiceState('idle');
          setVolume(null);
          if (!hasLocalNetworkRef.current) {
            setLastAction(WIFI_OFF_MESSAGE);
            return;
          }
          setLastAction(message);
          showTvErrorToast(message);
        },
        onAppLinkError: (appLink) => {
          // The connection itself is still alive - the TV just couldn't open
          // that particular app - so only surface a toast, don't touch
          // connection/status state.
          const failed = appLink?.trim() ?? '';
          if (failed && fileManagerAttemptRef.current === failed) {
            const nextPkg = fileManagerQueueRef.current.shift();
            if (nextPkg) {
              const nextLink = marketLaunchLink(nextPkg);
              fileManagerAttemptRef.current = nextLink;
              connectionRef.current?.launchApp(nextLink);
              setLastAction(`Trying another Files app on ${device.name}...`);
              return;
            }
            fileManagerAttemptRef.current = null;
            fileManagerWaitingRef.current = true;
            setLastAction(
              `${device.name} couldn't open Files. Open the USB / file manager on the TV once so we can remember it.`,
            );
            showTvErrorToast(`Couldn't open Files — open it once on the TV`);
            return;
          }

          const app = APP_SHORTCUTS.find((shortcut) => shortcut.appLink === appLink);
          const label = app?.label ?? 'that app';
          if (app?.id === 'multi-screen' || multiScreenWaitingRef.current) {
            multiScreenWaitingRef.current = true;
            setLastAction(
              `${device.name} couldn't open Share. Open Multi-Screen Share on the TV once so we can remember it.`,
            );
            showTvErrorToast(`Couldn't open Share — open it once on the TV`);
            return;
          }
          setLastAction(`${device.name} couldn't open ${label}. Try opening it once from the TV's home screen.`);
          showTvErrorToast(`${device.name} couldn't open ${label}`);
        },
        onCurrentAppChanged: (currentApp) => {
          const pkg = currentApp?.trim();
          if (!pkg) return;

          if (looksLikeMultiScreenPackage(pkg)) {
            const isNew = multiScreenPackageRef.current !== pkg;
            if (isNew) {
              multiScreenPackageRef.current = pkg;
              void tvCredentialStore.setMultiScreenPackage(pkg);
            }
            if (multiScreenWaitingRef.current) {
              multiScreenWaitingRef.current = false;
              connectionRef.current?.launchApp(marketLaunchLink(pkg));
              setLastAction(`Share saved (${pkg}) — opening...`);
              showTvSuccessToast('Share app saved');
              return;
            }
            if (isNew) {
              setLastAction(`Remembered Share app (${pkg}).`);
              showTvSuccessToast('Share app saved for next time');
            }
          }

          if (looksLikeFileManagerPackage(pkg)) {
            const isNew = fileManagerPackageRef.current !== pkg;
            if (isNew) {
              fileManagerPackageRef.current = pkg;
              void tvCredentialStore.setFileManagerPackage(pkg);
            }
            if (fileManagerWaitingRef.current) {
              fileManagerWaitingRef.current = false;
              fileManagerAttemptRef.current = null;
              fileManagerQueueRef.current = [];
              connectionRef.current?.launchApp(marketLaunchLink(pkg));
              setLastAction(`Files saved (${pkg}) — opening...`);
              showTvSuccessToast('Files app saved');
              return;
            }
            if (isNew) {
              setLastAction(`Remembered Files app (${pkg}).`);
              showTvSuccessToast('Files app saved for next time');
            }
          }
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
          // Library auto-retries on socket drops. Toast once — not every retry
          // (Wi‑Fi off otherwise spams "Reconnecting..." forever).
          if (!hasLocalNetworkRef.current) return;
          setLastAction(`${device.name} blinked offline - reconnecting...`);
          if (reconnectToastShownRef.current) return;
          reconnectToastShownRef.current = true;
          showTvToast(`Reconnecting to ${device.name}...`);
        },
      });

      connectionRef.current = connection;
      void connection.connect();
    })();
  }, [clearConnecting, markSaved]);

  beginConnectionRef.current = beginConnection;

  const scanForDevices = useCallback(() => {
    void (async () => {
      if (!(await getHasLocalNetwork())) {
        hasLocalNetworkRef.current = false;
        stopScanRef.current?.();
        stopScanRef.current = null;
        setIsScanning(false);
        setStatus((current) => (current === 'scanning' ? 'idle' : current));
        setLastAction(WIFI_OFF_MESSAGE);
        if (!wifiOffToastShownRef.current) {
          wifiOffToastShownRef.current = true;
          showWifiOffToast();
        }
        return;
      }

      hasLocalNetworkRef.current = true;
      stopScanRef.current?.();
      setIsScanning(true);
      // Don't clobber an active connection / pairing flow — scanning can run
      // in the background while those statuses stay put.
      setStatus((current) =>
        current === 'connected' ||
        current === 'connecting' ||
        current === 'awaiting_pin' ||
        current === 'verifying_pin'
          ? current
          : 'scanning',
      );
      setLastAction('Scanning your Wi-Fi network for TVs...');

      const foundHosts = new Set<string>();
      const SCAN_MS = 12500;
      const stop = scanForAndroidTvDevices(
        (device) => {
          if (foundHosts.has(device.host)) return;
          foundHosts.add(device.host);
          setDevices((current) => {
            const existingIndex = current.findIndex((existing) => existing.host === device.host);
            if (existingIndex >= 0) {
              const existing = current[existingIndex];
              const nextName = device.name;
              // Always prefer a real advertised TV name over a generic placeholder.
              if (nextName === existing.name || isGenericTvName(nextName)) {
                return current;
              }
              const updated = [...current];
              updated[existingIndex] = { ...existing, name: nextName, isSaved: existing.isSaved };
              void tvCredentialStore.get(device.host).then((credential) => {
                if (credential && credential.name !== nextName) {
                  void tvCredentialStore.save({ ...credential, name: nextName });
                }
              });
              setSelectedDevice((selected) =>
                selected?.host === device.host ? { ...selected, name: nextName } : selected,
              );
              return updated;
            }
            return [...current, device];
          });
        },
        (message) => {
          // Discovery start failures only — keep UI usable with manual IP.
          setLastAction(message);
          showTvErrorToast(message);
        },
      );
      stopScanRef.current = stop;

      setTimeout(() => {
        setIsScanning(false);
        setStatus((current) => (current === 'scanning' ? 'idle' : current));
        if (!hasLocalNetworkRef.current) return;
        if (foundHosts.size > 0) {
          setLastAction('Select your TV to connect or pair.');
          showTvSuccessToast(`Found ${foundHosts.size} TV${foundHosts.size > 1 ? 's' : ''} on your network`);
        } else {
          setLastAction('No TVs found. Try manual IP below.');
          showTvErrorToast('No TVs found on this Wi-Fi network. Try the manual IP field below.');
        }
      }, SCAN_MS);
    })();
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
      name: 'TV',
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

      const connection = connectionRef.current;
      if (!connection) {
        setLastAction('Connect a TV first.');
        showTvErrorToast('Connect a TV first');
        return;
      }

      if (app.id === 'multi-screen') {
        // Never send bare package names (drops Changhong session).
        // Never guess unknown packages (TV shows "item not found").
        // Launch only a package we already learned from current_app.
        const learned = multiScreenPackageRef.current;
        if (!learned) {
          multiScreenWaitingRef.current = true;
          setLastAction(
            `Open Multi-Screen Share once on ${selectedDevice.name} — we'll save it, then Share will work.`,
          );
          showTvToast('Open Multi-Screen Share on the TV once');
          return;
        }

        multiScreenWaitingRef.current = false;
        connection.launchApp(marketLaunchLink(learned));
        setLastAction(`Opening Share on ${selectedDevice.name}...`);
        showTvToast(`Opening ${app.label}...`);
        return;
      }

      connection.launchApp(app.appLink);
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
    showTvToast('Opening TV Settings...');
  }, [selectedDevice, status]);

  const openFileManager = useCallback(() => {
    if (!selectedDevice || status !== 'connected') {
      setLastAction('Connect a TV first.');
      showTvErrorToast('Connect a TV first');
      return;
    }
    const connection = connectionRef.current;
    if (!connection) {
      setLastAction('Connect a TV first.');
      showTvErrorToast('Connect a TV first');
      return;
    }

    const learned = fileManagerPackageRef.current;
    if (learned) {
      fileManagerWaitingRef.current = false;
      fileManagerQueueRef.current = [];
      const link = marketLaunchLink(learned);
      fileManagerAttemptRef.current = link;
      connection.launchApp(link);
      setLastAction(`Opening Files on ${selectedDevice.name}...`);
      showTvToast('Opening Files / USB...');
      return;
    }

    // Try common system file managers once; fall back to teach-on-open.
    const queue = [...FILE_MANAGER_PACKAGE_CANDIDATES];
    const first = queue.shift()!;
    const link = marketLaunchLink(first);
    fileManagerQueueRef.current = queue;
    fileManagerAttemptRef.current = link;
    fileManagerWaitingRef.current = true;
    connection.launchApp(link);
    setLastAction(
      `Opening Files on ${selectedDevice.name}... If this misses, open the USB / file manager on the TV once.`,
    );
    showTvToast('Opening Files / USB...');
  }, [selectedDevice, status]);

  const restartTv = useCallback(() => {
    if (!selectedDevice || status !== 'connected') {
      setLastAction('Connect a TV first.');
      showTvErrorToast('Connect a TV first');
      return;
    }
    Alert.alert('Restart TV?', `Restart ${selectedDevice.name}? It will take a minute to come back.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        style: 'destructive',
        onPress: () => {
          connectionRef.current?.restartTv();
          setLastAction(`Restarting ${selectedDevice.name}...`);
          showTvToast(`Restarting ${selectedDevice.name}...`);
        },
      },
    ]);
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

  const isBusy = status === 'connecting' || isScanning || status === 'verifying_pin';

  return {
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
    openFileManager,
    restartTv,
    voiceState,
    voiceOverlayVisible,
    voiceTranscript,
    startVoiceSearch,
    cancelVoiceSearch,
    finishVoiceSearch,
  };
}
