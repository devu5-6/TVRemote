declare module 'react-native-androidtv-remote' {
  export type AndroidTvCertificate = {
    key?: string;
    cert?: string;
    androidKeyStore?: string;
    certAlias?: string;
    keyAlias?: string;
  };

  export type AndroidRemoteOptions = {
    pairing_port?: number;
    remote_port?: number;
    service_name?: string;
    systeminfo?: {
      manufacturer?: string;
      model?: string;
    };
    cert?: AndroidTvCertificate;
  };

  export type VolumeInfo = {
    level: number;
    maximum: number;
    muted: boolean;
  };

  export class AndroidRemote {
    constructor(host: string, options: AndroidRemoteOptions);
    start(): Promise<boolean | void>;
    stop(): void;
    sendPairingCode(code: string): boolean | Promise<boolean> | undefined;
    cancelPairing(): void;
    sendPower(): void;
    sendAppLink(appLink: string): void;
    sendKey(key: number, direction: number): void;
    sendText(text: string): void;
    sendVoiceBegin(sessionId: number): void;
    sendVoicePayload(sessionId: number, samples: Uint8Array): void;
    sendVoiceEnd(sessionId: number): void;
    getCertificate(): { key?: string; cert?: string };
    on(event: 'secret', listener: () => void): this;
    on(event: 'powered', listener: (powered: boolean) => void): this;
    on(event: 'volume', listener: (volume: VolumeInfo) => void): this;
    on(event: 'current_app', listener: (currentApp: string) => void): this;
    on(event: 'ready', listener: () => void): this;
    on(event: 'unpaired', listener: () => void): this;
    on(event: 'reconnecting', listener: () => void): this;
    on(event: 'error', listener: (error: unknown) => void): this;
    on(event: 'voiceBegin', listener: (sessionId: number) => void): this;
    on(event: 'voiceEnd', listener: (sessionId: number) => void): this;
    removeAllListeners(event?: string): this;
  }

  export const RemoteKeyCode: Record<string, number>;
  export const RemoteDirection: Record<string, number>;
}

declare module 'react-native-zeroconf' {
  export type ZeroconfService = {
    name: string;
    host: string;
    port: number;
    addresses: string[];
    fullName?: string;
  };

  export default class Zeroconf {
    scan(type?: string, protocol?: string, domain?: string): void;
    stop(): void;
    removeDeviceListeners(): void;
    on(event: 'start', listener: () => void): this;
    on(event: 'stop', listener: () => void): this;
    on(event: 'resolved', listener: (service: ZeroconfService) => void): this;
    on(event: 'error', listener: (error: unknown) => void): this;
    on(event: 'found', listener: (name: string) => void): this;
    removeListener(event: 'resolved', listener: (service: ZeroconfService) => void): this;
    removeListener(event: 'error', listener: (error: unknown) => void): this;
    removeListener(event: 'found', listener: (name: string) => void): this;
  }
}
