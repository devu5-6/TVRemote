import Zeroconf, { type ZeroconfService } from 'react-native-zeroconf';

import type { TvDevice } from '../types/remote';

const SERVICE_TYPE = 'androidtvremote2';
const SERVICE_PROTOCOL = 'tcp';

function toTvDevice(service: ZeroconfService): TvDevice {
  const host = service.addresses?.[0] ?? service.host;
  return {
    id: `${host}:${service.port}`,
    name: service.name || 'Android TV',
    host,
    port: service.port,
    model: 'Android TV / Google TV',
    isSaved: false,
  };
}

export function scanForAndroidTvDevices(
  onDeviceFound: (device: TvDevice) => void,
  onError: (message: string) => void,
  timeoutMs = 6000,
): () => void {
  const zeroconf = new Zeroconf();
  let stopped = false;

  const handleResolved = (service: ZeroconfService) => {
    if (stopped) return;
    onDeviceFound(toTvDevice(service));
  };

  const handleError = (error: unknown) => {
    if (stopped) return;
    const message = error instanceof Error ? error.message : 'Discovery failed. Try manual IP.';
    onError(message);
  };

  zeroconf.on('resolved', handleResolved);
  zeroconf.on('error', handleError);

  try {
    zeroconf.scan(SERVICE_TYPE, SERVICE_PROTOCOL, 'local.');
  } catch {
    onError('Could not start network scan on this device.');
  }

  const timeout = setTimeout(() => {
    if (!stopped) {
      zeroconf.stop();
    }
  }, timeoutMs);

  return () => {
    stopped = true;
    clearTimeout(timeout);
    zeroconf.removeListener('resolved', handleResolved);
    zeroconf.removeListener('error', handleError);
    zeroconf.stop();
  };
}
