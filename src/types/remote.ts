export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'awaiting_pin'
  | 'verifying_pin'
  | 'connected'
  | 'error';

export type TvDevice = {
  id: string;
  name: string;
  host: string;
  port: number;
  model: string;
  isSaved: boolean;
};

export type RemoteKey =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'OK'
  | 'BACK'
  | 'HOME'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'MUTE'
  | 'POWER'
  | 'SEARCH'
  | 'SETTINGS'
  | 'HDMI_1'
  | 'CHANNEL_UP'
  | 'CHANNEL_DOWN';

export type VoiceSessionState = 'idle' | 'listening' | 'sending';

export type StoredTvCredential = {
  host: string;
  name: string;
  model: string;
  cert: string;
  key: string;
};

export type AppShortcut = {
  id: string;
  label: string;
  /** Deep-link URI sent as the app-link launch request (must be a valid URI). */
  appLink: string;
  icon: string;
  color: string;
};
