import { NativeModules, Platform } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import Zeroconf, { type ZeroconfService } from 'react-native-zeroconf';

import type { TvDevice } from '../types/remote';
import { nameFromDiscoveredService } from '../utils/tvDisplayName';
import { tvCredentialStore } from './tvCredentialStore';

const SERVICE_TYPE = 'androidtvremote2';
const SERVICE_PROTOCOL = 'tcp';
/** Android TV Remote Protocol v2 remote port (pairing is 6467). */
const REMOTE_PORT = 6466;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const RNZeroconf = NativeModules.RNZeroconf as
  | { scan?: (type: string, protocol: string, domain: string, implType: string) => void; stop?: (implType: string) => void }
  | undefined;

function pickHost(service: ZeroconfService): string | null {
  const addresses = service.addresses ?? [];
  const ipv4 = addresses.find((address) => IPV4.test(address));
  if (ipv4) return ipv4;
  // Prefer non-link-local IPv6 if that's all we got.
  const ipv6 = addresses.find((address) => address.includes(':') && !address.toLowerCase().startsWith('fe80:'));
  if (ipv6) return ipv6;
  if (service.host && IPV4.test(service.host)) return service.host;
  return null;
}

function toTvDevice(service: ZeroconfService): TvDevice | null {
  const host = pickHost(service);
  if (!host) return null;
  const port = service.port > 0 ? service.port : REMOTE_PORT;
  return {
    id: `${host}:${port}`,
    name: nameFromDiscoveredService(service),
    host,
    port,
    model: 'Android TV / Google TV',
    isSaved: false,
  };
}

function getLocalIpv4(): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(value);
    };

    const socket = TcpSocket.createConnection(
      { host: '8.8.8.8', port: 53, connectTimeout: 2500, interface: 'wifi' },
      () => {
        const local = socket.localAddress;
        finish(local && IPV4.test(local) ? local : null);
      },
    );
    socket.on('error', () => finish(null));
    setTimeout(() => finish(null), 2600);
  });
}

function probeAndroidTvPort(host: string, timeoutMs = 450): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(value);
    };

    const socket = TcpSocket.createConnection(
      { host, port: REMOTE_PORT, connectTimeout: timeoutMs, interface: 'wifi' },
      () => finish(true),
    );
    socket.on('error', () => finish(false));
    setTimeout(() => finish(false), timeoutMs + 100);
  });
}

async function collectSubnetPrefixes(): Promise<string[]> {
  const prefixes = new Set<string>();

  const localIp = await getLocalIpv4();
  if (localIp) {
    prefixes.add(localIp.split('.').slice(0, 3).join('.'));
  }

  const lastHost = await tvCredentialStore.getLastHost();
  if (lastHost && IPV4.test(lastHost)) {
    prefixes.add(lastHost.split('.').slice(0, 3).join('.'));
  }

  const saved = await tvCredentialStore.getAll();
  for (const credential of saved) {
    if (IPV4.test(credential.host)) {
      prefixes.add(credential.host.split('.').slice(0, 3).join('.'));
    }
  }

  return [...prefixes];
}

/**
 * Fallback when mDNS is blocked/unreliable: probe the LAN /24 for TVs
 * listening on the Android TV Remote port.
 */
async function scanSubnetForAndroidTvs(
  onDeviceFound: (device: TvDevice) => void,
  isStopped: () => boolean,
): Promise<void> {
  const prefixes = await collectSubnetPrefixes();
  if (prefixes.length === 0 || isStopped()) return;

  const hosts: string[] = [];
  for (const prefix of prefixes) {
    for (let i = 1; i <= 254; i += 1) {
      hosts.push(`${prefix}.${i}`);
    }
  }

  const concurrency = 40;
  let index = 0;

  const worker = async () => {
    while (!isStopped()) {
      const current = index;
      index += 1;
      if (current >= hosts.length) return;
      const host = hosts[current];
      const open = await probeAndroidTvPort(host);
      if (!open || isStopped()) continue;
      onDeviceFound({
        id: `${host}:${REMOTE_PORT}`,
        name: 'TV',
        host,
        port: REMOTE_PORT,
        model: 'Android TV / Google TV',
        isSaved: false,
      });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

/**
 * Discover Android TV / Google TV devices via mDNS (`_androidtvremote2._tcp`)
 * with a TCP port-scan fallback. Manual IP works without mDNS; scanning often
 * fails on Android unless both NSD + DNSSD are used and multicast is held.
 */
export function scanForAndroidTvDevices(
  onDeviceFound: (device: TvDevice) => void,
  onError: (message: string) => void,
  timeoutMs = 12000,
): () => void {
  const zeroconf = new Zeroconf();
  let stopped = false;
  const seenHosts = new Set<string>();

  const emitDevice = (device: TvDevice) => {
    if (stopped || seenHosts.has(device.host)) return;
    seenHosts.add(device.host);
    onDeviceFound(device);
  };

  const handleResolved = (service: ZeroconfService) => {
    if (stopped) return;
    const device = toTvDevice(service);
    if (device) emitDevice(device);
  };

  // Soft-fail: Android NSD often emits resolve errors that should not abort the scan.
  const handleError = (error: unknown) => {
    if (stopped) return;
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/resolving service failed/i.test(message) || /already active/i.test(message)) {
      return;
    }
    // Keep scanning; only surface unexpected failures.
    console.warn('[TVDiscovery]', message);
  };

  zeroconf.on('resolved', handleResolved);
  zeroconf.on('error', handleError);

  try {
    // DNSSD (embedded mDNSResponder) — generally most reliable on modern Android.
    zeroconf.scan(SERVICE_TYPE, SERVICE_PROTOCOL, 'local.', Platform.OS === 'android' ? 'DNSSD' : undefined);
    // Also run Android NSD in parallel — some OEMs only answer one stack.
    if (Platform.OS === 'android' && RNZeroconf?.scan) {
      RNZeroconf.scan(SERVICE_TYPE, SERVICE_PROTOCOL, 'local.', 'NSD');
    }
  } catch {
    onError('Could not start network scan on this device.');
  }

  // TCP fallback overlaps mDNS so we still find TVs when multicast is filtered.
  const subnetPromise = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (stopped) return;
    try {
      await scanSubnetForAndroidTvs(emitDevice, () => stopped);
    } catch (error) {
      console.warn('[TVDiscovery] subnet scan failed', error);
    }
  })();

  const timeout = setTimeout(() => {
    if (!stopped) {
      stopped = true;
      cleanupNative();
    }
  }, timeoutMs);

  const cleanupNative = () => {
    try {
      zeroconf.removeListener('resolved', handleResolved);
      zeroconf.removeListener('error', handleError);
      if (Platform.OS === 'android') {
        (zeroconf.stop as (implType?: string) => void)('DNSSD');
        RNZeroconf?.stop?.('NSD');
      } else {
        zeroconf.stop();
      }
      zeroconf.removeDeviceListeners?.();
    } catch {
      // ignore cleanup races
    }
  };

  void subnetPromise;

  return () => {
    stopped = true;
    clearTimeout(timeout);
    cleanupNative();
  };
}
