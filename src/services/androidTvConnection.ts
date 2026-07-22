import { PermissionsAndroid, Platform } from 'react-native';
import { AndroidRemote, RemoteDirection, RemoteKeyCode } from 'react-native-androidtv-remote';
import AudioRecord from 'react-native-audio-record';
import { Buffer } from 'buffer';

import { tvCredentialStore } from './tvCredentialStore';
import type { RemoteKey, TvDevice } from '../types/remote';
import { sanitizeTvDisplayName } from '../utils/tvDisplayName';
import { isBenignSocketError } from '../utils/socketErrors';

// Shape of the payload the (patched) library emits for a `remoteError` -
// the TV echoes back the original request that it couldn't handle.
type RemoteErrorPayload = {
  error?: {
    value?: boolean;
    message?: {
      remoteAppLinkLaunchRequest?: { appLink?: string };
    };
  };
};

// Android TV Remote Protocol v2 voice search expects raw 16-bit PCM, 8 kHz,
// mono audio samples (see RemoteVoicePayload patch notes in
// node_modules/react-native-androidtv-remote for why this had to be patched
// into the library at all - the upstream port shipped empty voice messages).
const VOICE_SAMPLE_RATE = 8000;
const VOICE_CHANNELS = 1;
const VOICE_BITS_PER_SAMPLE = 16;
const VOICE_AUDIO_SOURCE_VOICE_RECOGNITION = 6;
// The protocol pads any RemoteVoicePayload smaller than 8 KB with zeros before
// the TV processes it (per the reference androidtvremote2 implementation), and
// splits anything over ~20 KB. The native mic callback only hands us ~640 byte
// chunks (~40ms) at a time, so if we forwarded those directly, ~92% of every
// message the TV received would be silence padding - the TV would "hear"
// something (hence the Listening UI reacting) but never enough real signal in
// a row to recognize any words. We buffer mic output here and only flush once
// we have a properly-sized chunk.
const VOICE_CHUNK_TARGET_BYTES = 16000; // ~1s of audio at 8kHz/16-bit/mono
// The TV is expected to answer our KEYCODE_SEARCH with a RemoteVoiceBegin
// (containing the session to use). Some TVs / launchers never send it back
// (e.g. no Assistant support), so we give up and fall back to a plain
// on-screen search after this long.
const VOICE_BEGIN_TIMEOUT_MS = 6000;

const PAIRING_PORT = 6467;
const REMOTE_PORT = 6466;
const SERVICE_NAME = 'TV Remote';
// First-time pairing generates a 2048-bit RSA key/cert on-device with no native
// acceleration (see CertificateGenerator patch notes). This is CPU-bound and can
// take 1-2+ minutes on real hardware, so we need a much longer timeout budget
// than a normal reconnect (which reuses a saved cert and should be near-instant).
const FIRST_PAIRING_TIMEOUT_MS = 180000;
const RECONNECT_TIMEOUT_MS = 15000;

const KEY_MAP: Record<RemoteKey, number> = {
  UP: RemoteKeyCode.KEYCODE_DPAD_UP,
  DOWN: RemoteKeyCode.KEYCODE_DPAD_DOWN,
  LEFT: RemoteKeyCode.KEYCODE_DPAD_LEFT,
  RIGHT: RemoteKeyCode.KEYCODE_DPAD_RIGHT,
  OK: RemoteKeyCode.KEYCODE_DPAD_CENTER,
  BACK: RemoteKeyCode.KEYCODE_BACK,
  HOME: RemoteKeyCode.KEYCODE_HOME,
  VOLUME_UP: RemoteKeyCode.KEYCODE_VOLUME_UP,
  VOLUME_DOWN: RemoteKeyCode.KEYCODE_VOLUME_DOWN,
  MUTE: RemoteKeyCode.KEYCODE_VOLUME_MUTE,
  POWER: RemoteKeyCode.KEYCODE_POWER,
  SEARCH: RemoteKeyCode.KEYCODE_SEARCH,
  SETTINGS: RemoteKeyCode.KEYCODE_SETTINGS,
  // Many TVs ignore this key over the remote protocol; switchToHdmi1() also
  // sends a passthrough app-link that Changhong/MediaTek sets usually honor.
  HDMI_1: RemoteKeyCode.KEYCODE_TV_INPUT_HDMI_1 ?? 243,
  CHANNEL_UP: RemoteKeyCode.KEYCODE_CHANNEL_UP ?? 166,
  CHANNEL_DOWN: RemoteKeyCode.KEYCODE_CHANNEL_DOWN ?? 167,
};

/**
 * HDMI 1 passthrough URIs for MediaTek Google TVs (Changhong / AI PONT, etc.).
 * Port 1 is commonly HDMI100004; HW5 is the usual first HDMI hardware id.
 * We avoid spraying unrelated vendor links - bad app-links can drop the remote
 * session on some TVs.
 */
const HDMI_1_APP_LINKS = [
  'content://android.media.tv/passthrough/com.mediatek.tvinput%2F.hdmi.HDMIInputService%2FHDMI100004',
  'content://android.media.tv/passthrough/com.mediatek.tvinput%2F.hdmi.HDMIInputService%2FHW5',
];

/** Map a single typed character to an Android TV keycode, if possible. */
function charToKeyCode(char: string): number | null {
  if (char.length !== 1) return null;
  const lower = char.toLowerCase();
  if (lower >= 'a' && lower <= 'z') {
    return RemoteKeyCode.KEYCODE_A + (lower.charCodeAt(0) - 'a'.charCodeAt(0));
  }
  if (char >= '0' && char <= '9') {
    return RemoteKeyCode.KEYCODE_0 + (char.charCodeAt(0) - '0'.charCodeAt(0));
  }
  switch (char) {
    case ' ':
      return RemoteKeyCode.KEYCODE_SPACE;
    case '-':
      return RemoteKeyCode.KEYCODE_MINUS;
    case '=':
      return RemoteKeyCode.KEYCODE_EQUALS;
    case '.':
      return RemoteKeyCode.KEYCODE_PERIOD;
    case ',':
      return RemoteKeyCode.KEYCODE_COMMA;
    case '/':
      return RemoteKeyCode.KEYCODE_SLASH;
    case '\\':
      return RemoteKeyCode.KEYCODE_BACKSLASH;
    case ';':
      return RemoteKeyCode.KEYCODE_SEMICOLON;
    case "'":
      return RemoteKeyCode.KEYCODE_APOSTROPHE;
    case '@':
      return RemoteKeyCode.KEYCODE_AT;
    case '+':
      return RemoteKeyCode.KEYCODE_PLUS;
    case '*':
      return RemoteKeyCode.KEYCODE_STAR;
    case '#':
      return RemoteKeyCode.KEYCODE_POUND;
    case '`':
      return RemoteKeyCode.KEYCODE_GRAVE;
    case '[':
      return RemoteKeyCode.KEYCODE_LEFT_BRACKET;
    case ']':
      return RemoteKeyCode.KEYCODE_RIGHT_BRACKET;
    default:
      return null;
  }
}

export type VolumeInfo = {
  level: number;
  maximum: number;
  muted: boolean;
};

export type AndroidTvConnectionCallbacks = {
  onPinRequired: () => void;
  onConnected: () => void;
  onDisconnected: (reason?: string) => void;
  onError: (message: string) => void;
  /**
   * The TV rejected a launch-app request (bad/unsupported app link, app not
   * installed, etc). The remote connection itself stays alive for this - it's
   * not a real disconnect - so this is surfaced separately from onError to
   * avoid tearing down "connected" state over it.
   */
  onAppLinkError?: (appLink: string | undefined) => void;
  onGeneratingKeys?: () => void;
  onVolumeChanged?: (volume: VolumeInfo) => void;
  onPoweredChanged?: (powered: boolean) => void;
  onCurrentAppChanged?: (currentApp: string) => void;
  /** We just asked the TV to open search/voice and are waiting for it to ack. */
  onVoiceRequesting?: () => void;
  /** The TV accepted our voice session and the phone mic is now streaming to it. */
  onVoiceListening?: () => void;
  /** Voice session ended (either we stopped it, or the TV closed it first). */
  onVoiceEnded?: () => void;
  /**
   * The underlying connection dropped for a reason we didn't cause (TV-side
   * quirk, not a real disconnect) and the library is auto-reconnecting.
   * We stay "connected" from the UI's perspective, but this is a brief
   * (~1-2s) window where commands may not reach the TV.
   */
  onReconnecting?: () => void;
};

/** Wraps a single live Android TV Remote Protocol v2 session for one device. */
export class AndroidTvConnection {
  private remote: AndroidRemote | null = null;
  private isDisposed = false;
  private voiceSessionId: number | null = null;
  // Covers the window between tapping the mic and the TV actually replying
  // with a voiceBegin/timeout. Without this, the UI showed no feedback during
  // that gap (voiceState only flips once we're actually listening), so
  // impatient repeat taps fired multiple concurrent KEYCODE_SEARCH + voice
  // negotiations at the TV, which seems to be able to confuse some TVs badly
  // enough that they stop responding to the whole connection afterwards.
  private voicePending = false;
  // Accumulates raw mic bytes until we have a properly-sized chunk to send
  // (see VOICE_CHUNK_TARGET_BYTES above).
  private voiceAudioBuffer: Buffer = Buffer.alloc(0);

  constructor(private readonly device: TvDevice, private readonly callbacks: AndroidTvConnectionCallbacks) {}

  async connect(): Promise<void> {
    const savedCredential = await tvCredentialStore.get(this.device.host);

    if (!savedCredential) {
      this.callbacks.onGeneratingKeys?.();
    }

    const remote = new AndroidRemote(this.device.host, {
      pairing_port: PAIRING_PORT,
      remote_port: REMOTE_PORT,
      service_name: SERVICE_NAME,
      systeminfo: {
        manufacturer: 'TV Remote App',
        model: 'Phone',
      },
      cert: savedCredential
        ? { key: savedCredential.key, cert: savedCredential.cert }
        : undefined,
    });

    this.remote = remote;

    remote.on('secret', () => {
      if (this.isDisposed) return;
      this.callbacks.onPinRequired();
    });

    remote.on('ready', () => {
      if (this.isDisposed) return;
      void this.persistCertificateIfNeeded();
      this.callbacks.onConnected();
    });

    remote.on('unpaired', () => {
      if (this.isDisposed) return;
      void tvCredentialStore.remove(this.device.host);
      this.callbacks.onDisconnected('unpaired');
    });

    remote.on('error', (error: unknown) => {
      if (this.isDisposed) return;
      // The TV reports a bad/unsupported app link over the same live socket
      // instead of closing the connection - the RemoteError proto embeds the
      // original request that triggered it, so we can tell this apart from a
      // real connection failure and avoid tearing down "connected" state.
      const appLinkRequest = (error as RemoteErrorPayload | undefined)?.error?.message?.remoteAppLinkLaunchRequest;
      if (appLinkRequest) {
        this.callbacks.onAppLinkError?.(appLinkRequest.appLink);
        return;
      }
      // Ping/key writes during teardown throw "Socket is closed." — noise, not a failure.
      if (isBenignSocketError(error)) return;
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Connection error';
      if (isBenignSocketError(message)) return;
      this.callbacks.onError(message);
    });

    remote.on('volume', (volume) => this.callbacks.onVolumeChanged?.(volume));
    remote.on('powered', (powered) => this.callbacks.onPoweredChanged?.(powered));
    remote.on('current_app', (currentApp) => this.callbacks.onCurrentAppChanged?.(currentApp));
    // The TV can end a voice session on its own (e.g. it recognized speech or
    // the user cancelled on-screen) - make sure we stop the mic in that case
    // too, otherwise we'd keep recording and streaming into a dead session.
    remote.on('voiceEnd', (sessionId) => {
      if (this.voiceSessionId === sessionId) {
        this.stopVoiceSearch();
      }
    });
    // Some TVs (observed on a Changhong AI PONT set) silently close this
    // connection ~20s after every voice search use and the library
    // auto-reconnects within ~1-2s. Surface that gap instead of leaving
    // command taps looking like they did nothing during it.
    remote.on('reconnecting', () => {
      if (this.isDisposed) return;
      this.callbacks.onReconnecting?.();
    });

    let settled = false;
    const timeoutMs = savedCredential ? RECONNECT_TIMEOUT_MS : FIRST_PAIRING_TIMEOUT_MS;

    const timeout = new Promise<void>((_, reject) => {
      setTimeout(() => {
        if (!settled) {
          reject(
            new Error(
              `No response from ${this.device.host}:${PAIRING_PORT} within ${
                timeoutMs / 1000
              }s. Check the IP address, that the TV is on, and that nothing is blocking the connection (firewall / AP isolation).`,
            ),
          );
        }
      }, timeoutMs);
    });

    try {
      await Promise.race([remote.start(), timeout]);
      settled = true;
    } catch (error) {
      settled = true;
      if (this.isDisposed) return;
      if (isBenignSocketError(error)) return;
      const message = error instanceof Error ? error.message : 'Could not reach the TV on this network.';
      if (isBenignSocketError(message)) return;
      this.callbacks.onError(message);
      // Stop the underlying remote so a late/zombie success after the timeout
      // can't silently flip the UI back to "connected" behind the error state.
      remote.removeAllListeners();
      remote.stop();
      if (this.remote === remote) {
        this.remote = null;
      }
    }
  }

  private async persistCertificateIfNeeded(): Promise<void> {
    if (!this.remote) return;
    const cert = this.remote.getCertificate();
    if (!cert.cert || !cert.key) return;
    await tvCredentialStore.save({
      host: this.device.host,
      name: sanitizeTvDisplayName(this.device.name, this.device.host),
      model: this.device.model,
      cert: cert.cert,
      key: cert.key,
    });
  }

  submitPin(pin: string): void {
    this.remote?.sendPairingCode(pin.trim());
  }

  cancelPairing(): void {
    this.remote?.cancelPairing();
  }

  sendKey(key: RemoteKey): void {
    const keyCode = KEY_MAP[key];
    if (keyCode === undefined) return;
    try {
      if (key === 'POWER') {
        this.remote?.sendPower();
        return;
      }
      this.remote?.sendKey(keyCode, RemoteDirection.SHORT);
    } catch (error) {
      if (!isBenignSocketError(error)) throw error;
    }
  }

  /**
   * Switch the TV to HDMI 1.
   *
   * KEYCODE_TV_INPUT_HDMI_1 is sent first, but many smart TVs ignore it over
   * the remote protocol. We then send common HDMI-1 passthrough deep links
   * (MediaTek / DroidLogic), which is what Home Assistant and similar remotes
   * use successfully on Changhong-class Google TVs.
   */
  switchToHdmi1(): void {
    if (!this.remote) return;

    const keyCode = KEY_MAP.HDMI_1;
    try {
      if (keyCode !== undefined) {
        this.remote.sendKey(keyCode, RemoteDirection.SHORT);
      }
    } catch (error) {
      if (!isBenignSocketError(error)) throw error;
    }

    // Prefer the deep-link path: most Changhong/MediaTek sets ignore the HDMI
    // keycode over this protocol but accept the passthrough content URI.
    // Stagger links so the TV isn't flooded with concurrent launch requests.
    HDMI_1_APP_LINKS.forEach((appLink, index) => {
      setTimeout(() => {
        try {
          this.remote?.sendAppLink(appLink);
        } catch (error) {
          if (!isBenignSocketError(error)) throw error;
        }
      }, index * 400);
    });
  }

  /**
   * Restart the TV via the system power menu.
   * Long-press Power opens the menu with Restart focused on Changhong /
   * Google TV — do NOT press DPAD_DOWN (that selects Power off). Confirm OK.
   */
  restartTv(): void {
    if (!this.remote) return;

    const power = RemoteKeyCode.KEYCODE_POWER;
    const ok = RemoteKeyCode.KEYCODE_DPAD_CENTER;

    try {
      this.remote.sendKey(power, RemoteDirection.START_LONG);
    } catch (error) {
      if (!isBenignSocketError(error)) throw error;
      return;
    }
    setTimeout(() => {
      try {
        this.remote?.sendKey(power, RemoteDirection.END_LONG);
        setTimeout(() => {
          try {
            this.remote?.sendKey(ok, RemoteDirection.SHORT);
          } catch (error) {
            if (!isBenignSocketError(error)) throw error;
          }
        }, 900);
      } catch (error) {
        if (!isBenignSocketError(error)) throw error;
      }
    }, 2500);
  }

  /**
   * Launch an app via a deep-link URI (e.g. "https://www.netflix.com/title")
   * or market://launch?id=<package> for installed apps.
   * Never send bare package names on Changhong — they drop the remote session.
   * Avoid raw #Intent;… links on some sets — they can also drop the session.
   */
  launchApp(appLink: string): void {
    try {
      this.remote?.sendAppLink(appLink);
    } catch (error) {
      if (!isBenignSocketError(error)) throw error;
    }
  }

  /**
   * Type text into the focused TV field.
   *
   * Prefer per-character key events: that is what works with YouTube (and
   * similar apps) while their on-screen keyboard is open. RemoteImeBatchEdit
   * is also sent for strings we cannot map to keys (e.g. non-Latin), but the
   * IME path is ignored by many TVs whenever the OSK is visible.
   */
  sendText(text: string): void {
    if (!this.remote || !text) return;

    const chars = [...text];
    const keyCodes = chars.map((char) => charToKeyCode(char));
    const canTypeAll = keyCodes.every((code) => code != null);

    if (canTypeAll) {
      void this.typeTextViaKeys(keyCodes as number[]);
      return;
    }

    try {
      this.remote.sendText(text);
    } catch (error) {
      if (isBenignSocketError(error)) return;
      this.callbacks.onError('This TV screen may not have a text field focused.');
    }
  }

  private async typeTextViaKeys(keyCodes: number[]): Promise<void> {
    for (const keyCode of keyCodes) {
      if (this.isDisposed || !this.remote) return;
      try {
        this.remote.sendKey(keyCode, RemoteDirection.SHORT);
      } catch (error) {
        if (isBenignSocketError(error)) return;
        throw error;
      }
      // Small gap so the TV IME/OSK can process each key (bursting them
      // drops characters on several Android TV builds).
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Run a text search on the TV's Google search UI. Used by the phone-side
   * voice flow: speech is recognized ON THE PHONE (Google's recognizer), and
   * the resulting text is typed into the TV's search screen and submitted.
   *
   * KEYCODE_SEARCH makes the TV open its search UI in *voice* mode (it offers
   * us a RemoteVoiceBegin session). We ack that session and immediately end it
   * so the TV stops waiting for audio and falls back to its keyboard/text
   * search field, then we inject the query via IME and press ENTER.
   */
  async searchOnTv(query: string): Promise<void> {
    const remote = this.remote;
    if (!remote || !query) return;

    remote.removeAllListeners('voiceBegin');
    const sessionId = await new Promise<number | null>((resolve) => {
      let settled = false;
      const finish = (id: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        remote.removeAllListeners('voiceBegin');
        resolve(id);
      };
      const timer = setTimeout(() => finish(null), 3000);
      remote.on('voiceBegin', finish);
      remote.sendKey(RemoteKeyCode.KEYCODE_SEARCH, RemoteDirection.SHORT);
    });
    if (this.isDisposed) return;

    if (sessionId !== null) {
      remote.sendVoiceBegin(sessionId);
      remote.sendVoiceEnd(sessionId);
    }

    // Give the TV a moment to settle into the text-search field.
    await new Promise((resolve) => setTimeout(resolve, 900));
    if (this.isDisposed) return;
    this.sendText(query);

    await new Promise((resolve) => setTimeout(resolve, 400));
    if (this.isDisposed) return;
    this.remote?.sendKey(RemoteKeyCode.KEYCODE_ENTER, RemoteDirection.SHORT);
  }

  /**
   * Mirrors what the official Google TV app does when you tap the mic:
   * 1. Send KEYCODE_SEARCH so the TV opens its search / Assistant UI.
   * 2. Wait for the TV to reply with a RemoteVoiceBegin session_id.
   * 3. Ack it, then stream the phone's mic (PCM16, 8kHz, mono) to the TV as
   *    RemoteVoicePayload chunks so Assistant hears your voice live.
   */
  async startVoiceSearch(): Promise<void> {
    const remote = this.remote;
    if (!remote) {
      this.callbacks.onError('Connect a TV first.');
      return;
    }
    if (this.voiceSessionId !== null) {
      // Already listening - treat a second tap as "stop".
      this.stopVoiceSearch();
      return;
    }
    if (this.voicePending) {
      // Already negotiating a session (tap arrived before the TV answered
      // the last one) - ignore instead of firing a second KEYCODE_SEARCH.
      return;
    }
    this.voicePending = true;
    this.callbacks.onVoiceRequesting?.();

    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Microphone access',
          message: 'TV Remote needs the microphone to send your voice to the TV for Google Assistant search.',
          buttonPositive: 'Allow',
        });
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          this.callbacks.onError('Microphone permission is required for Google Voice search.');
          return;
        }
      }

      const sessionId = await new Promise<number | null>((resolve) => {
        let settled = false;
        const finish = (id: number | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          remote.removeAllListeners('voiceBegin');
          resolve(id);
        };
        const timer = setTimeout(() => finish(null), VOICE_BEGIN_TIMEOUT_MS);
        remote.on('voiceBegin', finish);
        remote.sendKey(RemoteKeyCode.KEYCODE_SEARCH, RemoteDirection.SHORT);
      });

      if (this.isDisposed) return;

      if (sessionId === null) {
        this.callbacks.onError(
          'Opened search on the TV, but it did not respond for mic streaming. Speak into the TV remote/mic, or type your search below.',
        );
        return;
      }

      this.voiceSessionId = sessionId;
      remote.sendVoiceBegin(sessionId);

      try {
        AudioRecord.init({
          sampleRate: VOICE_SAMPLE_RATE,
          channels: VOICE_CHANNELS,
          bitsPerSample: VOICE_BITS_PER_SAMPLE,
          audioSource: VOICE_AUDIO_SOURCE_VOICE_RECOGNITION,
          wavFile: 'tvremote_voice_search.wav',
        });
        let chunkCount = 0;
        let totalBytes = 0;
        let sentMessages = 0;
        this.voiceAudioBuffer = Buffer.alloc(0);
        AudioRecord.on('data', (base64Chunk: unknown) => {
          if (this.voiceSessionId !== sessionId) return;
          // react-native-tcp-socket and react-native-audio-record both emit a
          // native event literally named "data", and neither implements the
          // addListener/removeListeners methods RN wants for scoping - so RN
          // falls back to routing both through the same global event bus.
          // That means this listener also fires for the TV's raw socket
          // packets (shape: { id, data }), not just our own base64 audio
          // chunks. Ignore anything that isn't the string payload we asked for.
          if (typeof base64Chunk !== 'string') return;
          const samples = Buffer.from(base64Chunk, 'base64');
          chunkCount += 1;
          totalBytes += samples.byteLength;
          this.voiceAudioBuffer = Buffer.concat([this.voiceAudioBuffer, samples]);
          while (this.voiceAudioBuffer.byteLength >= VOICE_CHUNK_TARGET_BYTES) {
            const toSend = Buffer.from(this.voiceAudioBuffer.subarray(0, VOICE_CHUNK_TARGET_BYTES));
            this.voiceAudioBuffer = Buffer.from(this.voiceAudioBuffer.subarray(VOICE_CHUNK_TARGET_BYTES));
            sentMessages += 1;
            this.remote?.sendVoicePayload(sessionId, toSend);
          }
          if (chunkCount === 1 || chunkCount % 10 === 0) {
            console.debug(
              `[voice] session=${sessionId} chunk#${chunkCount} bytes=${samples.byteLength} totalBytes=${totalBytes} sentMessages=${sentMessages}`,
            );
          }
        });
        AudioRecord.start();
        this.callbacks.onVoiceListening?.();

        // Watchdog: if the mic never actually produces a single chunk (bad
        // permission grant, no compatible audio source, OEM restriction on
        // VOICE_RECOGNITION, etc.) we'd otherwise sit in "Listening..." with
        // silence being sent (or nothing at all) and no way to tell the user.
        setTimeout(() => {
          if (this.voiceSessionId !== sessionId) return;
          if (chunkCount === 0) {
            console.warn(`[voice] session=${sessionId} no audio chunks received after 1.5s - mic likely not capturing`);
            this.stopVoiceSearch();
            this.callbacks.onError(
              'The microphone did not capture any audio. Check mic permission in Android Settings and try again.',
            );
          }
        }, 1500);
      } catch {
        this.voiceSessionId = null;
        this.callbacks.onError('Could not start the microphone on this device.');
      }
    } finally {
      this.voicePending = false;
    }
  }

  stopVoiceSearch(): void {
    if (this.voiceSessionId === null) return;
    const sessionId = this.voiceSessionId;
    this.voiceSessionId = null;
    AudioRecord.stop().catch(() => {});
    // Flush whatever's left in the buffer (even if under the 8KB minimum -
    // it'll just get zero-padded on the wire, which is fine for a tail end).
    if (this.voiceAudioBuffer.byteLength > 0) {
      this.remote?.sendVoicePayload(sessionId, this.voiceAudioBuffer);
      this.voiceAudioBuffer = Buffer.alloc(0);
    }
    this.remote?.sendVoiceEnd(sessionId);
    this.callbacks.onVoiceEnded?.();

    // We never tell the TV to close the search/voice overlay we opened with
    // KEYCODE_SEARCH - we just leave it sitting open. On this TV that overlay
    // seems to auto-expire on its own ~20s later, and that cleanup path
    // appears to be what's tearing down the whole remote connection (voice
    // search via the TV's own remote doesn't disconnect anything, so this is
    // specific to us leaving the UI dangling). Close it ourselves instead of
    // letting it time out - give the results a moment to be visible first.
    const remote = this.remote;
    setTimeout(() => {
      if (this.isDisposed || this.voiceSessionId !== null) return;
      remote?.sendKey(RemoteKeyCode.KEYCODE_BACK, RemoteDirection.SHORT);
    }, 3000);
  }

  disconnect(): void {
    this.isDisposed = true;
    this.stopVoiceSearch();
    this.remote?.removeAllListeners();
    this.remote?.stop();
    this.remote = null;
  }
}
