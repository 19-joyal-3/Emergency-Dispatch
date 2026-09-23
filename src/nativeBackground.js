import { registerPlugin, Capacitor } from '@capacitor/core';

// Bridge to native Android EmergencyMeshNativePlugin
const EmergencyMeshNative = registerPlugin('EmergencyMeshNative');

class NativeBackgroundMeshController {
  constructor() {
    this.active = false;
    this.wakeLockSentinel = null;
    this.keepAliveTimer = null;
    this.listeners = new Set();
    this.isNative = Capacitor.isNativePlatform();

    // Auto-check native status on load if running natively
    if (this.isNative) {
      this.checkNativeStatus();
    }

    // Handle web visibilitychange to restore wake lock if active in browser
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', async () => {
        if (this.active && !this.isNative && document.visibilityState === 'visible') {
          await this.acquireWebWakeLock();
        }
      });
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.active);
      } catch (e) {
        console.error('Listener notification error:', e);
      }
    });
  }

  async checkNativeStatus() {
    try {
      const res = await EmergencyMeshNative.isBackgroundServiceActive();
      this.active = Boolean(res?.active);
      this.notify();
      return this.active;
    } catch {
      return false;
    }
  }

  async acquireWebWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          if (this.active && document.visibilityState === 'visible') {
            this.acquireWebWakeLock().catch(() => {});
          }
        });
      } catch (err) {
        console.warn('Web Wake Lock request rejected or unsupported:', err);
      }
    }
  }

  releaseWebWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  async start() {
    if (this.active) return true;

    if (this.isNative) {
      try {
        await EmergencyMeshNative.startBackgroundService();
        this.active = true;
        this.notify();
        return true;
      } catch (err) {
        console.error('Failed to start native EmergencyMeshBackgroundService:', err);
        return false;
      }
    } else {
      // Browser fallback: Keep screen awake + lightweight heartbeat pulse
      await this.acquireWebWakeLock();
      this.keepAliveTimer = setInterval(() => {
        // Heartbeat keepalive for P2P WebRTC / Bluetooth
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('emergency_mesh_heartbeat'));
        }
      }, 10000);
      this.active = true;
      this.notify();
      return true;
    }
  }

  async stop() {
    if (!this.active) return true;

    if (this.isNative) {
      try {
        await EmergencyMeshNative.stopBackgroundService();
      } catch (err) {
        console.warn('Error stopping native mesh service:', err);
      }
    } else {
      this.releaseWebWakeLock();
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
    }

    this.active = false;
    this.notify();
    return true;
  }

  async toggle() {
    if (this.active) {
      await this.stop();
    } else {
      await this.start();
    }
    return this.active;
  }

  async requestBatteryOptimizationExemption() {
    if (this.isNative) {
      try {
        const res = await EmergencyMeshNative.requestBatteryOptimizationExemption();
        return res;
      } catch (e) {
        console.warn('Could not request battery optimization exemption:', e);
        return { exempted: false, requested: false };
      }
    }
    return { exempted: true, requested: false };
  }

  async getDiscoveredNativeBeacons() {
    if (this.isNative) {
      try {
        const res = await EmergencyMeshNative.getDiscoveredBeacons();
        return Array.isArray(res?.beacons) ? res.beacons : [];
      } catch (err) {
        console.warn('[Native BLE] Could not fetch discovered beacons:', err);
        return [];
      }
    }
    return [];
  }

  async checkNativeBluetoothStatus() {
    if (this.isNative) {
      try {
        const res = await EmergencyMeshNative.isBluetoothAvailable();
        return {
          available: Boolean(res?.available),
          enabled: Boolean(res?.enabled)
        };
      } catch {
        return { available: false, enabled: false };
      }
    }
    return null;
  }

  isActive() {
    return this.active;
  }

  isNativeApp() {
    return this.isNative;
  }
}

export const nativeBackgroundMesh = new NativeBackgroundMeshController();
export default nativeBackgroundMesh;
