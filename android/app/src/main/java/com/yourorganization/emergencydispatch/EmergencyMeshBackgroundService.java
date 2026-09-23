package com.yourorganization.emergencydispatch;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

/**
 * EmergencyMeshBackgroundService
 * 
 * Android Foreground Service maintaining continuous zero-connectivity Bluetooth Low Energy (BLE)
 * beacon advertising, scanning, and mesh packet relaying even when the device screen is off,
 * locked, or subjected to Android Doze mode.
 */
public class EmergencyMeshBackgroundService extends Service {
    private static final String TAG = "EmergencyMeshService";
    public static final String CHANNEL_ID = "kerala_emergency_mesh_channel";
    public static final int NOTIFICATION_ID = 1077; // Matches Kerala DEOC Hotline 1077

    public static final String ACTION_START = "ACTION_START_MESH_SERVICE";
    public static final String ACTION_STOP = "ACTION_STOP_MESH_SERVICE";

    private PowerManager.WakeLock wakeLock;
    private Handler handler;
    private Runnable backgroundPulseRunnable;
    public static boolean isRunning = false;

    public static class DiscoveredBeacon {
        public String address;
        public String name;
        public int rssi;
        public long timestamp;

        public DiscoveredBeacon(String address, String name, int rssi, long timestamp) {
            this.address = address;
            this.name = name;
            this.rssi = rssi;
            this.timestamp = timestamp;
        }
    }

    public static final java.util.concurrent.ConcurrentHashMap<String, DiscoveredBeacon> discoveredBeacons = new java.util.concurrent.ConcurrentHashMap<>();

    // Native Bluetooth LE Radio Components
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeAdvertiser bleAdvertiser;
    private BluetoothLeScanner bleScanner;
    private AdvertiseCallback advertiseCallback;
    private ScanCallback scanCallback;
    private boolean isBleAdvertising = false;
    private boolean isBleScanning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquirePartialWakeLock();
        handler = new Handler(Looper.getMainLooper());
        initBluetoothAdapter();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopMeshService();
            return START_NOT_STICKY;
        }

        startForegroundWithNotification();
        startNativeBleMesh();
        startBackgroundMeshPulse();
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Kerala Emergency Mesh Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains continuous background beacon relay and survivor discovery across Kerala disaster mesh.");
            channel.setShowBadge(false);
            channel.enableVibration(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startForegroundWithNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Vanguard Geo — Emergency Mesh Active")
            .setContentText("Relaying zero-connectivity BLE disaster beacons in background")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        try {
            if (Build.VERSION.SDK_INT >= 34) { // Android 14+
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE |
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION |
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                );
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { // Android 10-13
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isRunning = true;
            Log.d(TAG, "Foreground Mesh Service successfully bound with notification ID " + NOTIFICATION_ID);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground service: " + e.getMessage(), e);
        }
    }

    private void acquirePartialWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && wakeLock == null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "VanguardGeo:EmergencyMeshWakeLock"
                );
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(24 * 60 * 60 * 1000L); // 24-hour max safety timeout
                Log.d(TAG, "Partial WakeLock acquired for zero-connectivity background mesh operation.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire partial WakeLock: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
                Log.d(TAG, "Partial WakeLock released.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error releasing WakeLock: " + e.getMessage());
        }
    }

    private void initBluetoothAdapter() {
        try {
            BluetoothManager manager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
            if (manager != null) {
                bluetoothAdapter = manager.getAdapter();
            }
        } catch (Exception e) {
            Log.w(TAG, "Bluetooth hardware initialization failed: " + e.getMessage());
        }
    }

    private boolean hasBlePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            boolean canScan = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
            boolean canAdvertise = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED;
            boolean canConnect = ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
            return canScan && canAdvertise && canConnect;
        }
        return true;
    }

    private void startNativeBleMesh() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            Log.w(TAG, "Bluetooth is disabled or unsupported on this device. Mesh radio in standby.");
            return;
        }

        if (!hasBlePermissions()) {
            Log.w(TAG, "Bluetooth runtime permissions not yet granted. Native BLE relay in standby.");
            return;
        }

        startBleAdvertiser();
        startBleScanner();
    }

    private void startBleAdvertiser() {
        if (isBleAdvertising || bluetoothAdapter == null) return;

        try {
            bleAdvertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
            if (bleAdvertiser == null) {
                Log.w(TAG, "Device does not support Bluetooth LE Advertising Peripheral mode.");
                return;
            }

            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_LOW)
                .setConnectable(false)
                .setTimeout(0)
                .build();

            // Vanguard Geo Emergency Mesh Manufacturer Payload (0x0999)
            byte[] beaconPayload = "VANGUARD-GEO-BEACON".getBytes(StandardCharsets.UTF_8);
            AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .addManufacturerData(0x0999, beaconPayload)
                .build();

            advertiseCallback = new AdvertiseCallback() {
                @Override
                public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                    super.onStartSuccess(settingsInEffect);
                    isBleAdvertising = true;
                    Log.i(TAG, "Vanguard Geo Native BLE Disaster Beacon actively broadcasting.");
                }

                @Override
                public void onStartFailure(int errorCode) {
                    super.onStartFailure(errorCode);
                    isBleAdvertising = false;
                    Log.w(TAG, "Vanguard Geo Native BLE Advertising failed (code: " + errorCode + ")");
                }
            };

            bleAdvertiser.startAdvertising(settings, data, advertiseCallback);
        } catch (SecurityException se) {
            Log.w(TAG, "SecurityException while starting BLE advertising: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error starting BLE advertising: " + e.getMessage(), e);
        }
    }

    private void startBleScanner() {
        if (isBleScanning || bluetoothAdapter == null) return;

        try {
            bleScanner = bluetoothAdapter.getBluetoothLeScanner();
            if (bleScanner == null) {
                Log.w(TAG, "Device does not support Bluetooth LE Scanner.");
                return;
            }

            ScanSettings scanSettings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER)
                .build();

            scanCallback = new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult result) {
                    super.onScanResult(callbackType, result);
                    if (result != null && result.getScanRecord() != null) {
                        byte[] mfgData = result.getScanRecord().getManufacturerSpecificData(0x0999);
                        if (mfgData != null) {
                            String address = result.getDevice() != null ? result.getDevice().getAddress() : "UNKNOWN";
                            String name = result.getDevice() != null && result.getDevice().getName() != null 
                                ? result.getDevice().getName() 
                                : "Vanguard Disaster Beacon";
                            discoveredBeacons.put(address, new DiscoveredBeacon(address, name, result.getRssi(), System.currentTimeMillis()));
                            Log.d(TAG, "Discovered Vanguard Geo Peer Beacon: " + address + ", RSSI: " + result.getRssi() + " dBm");
                        }
                    }
                }

                @Override
                public void onBatchScanResults(List<ScanResult> results) {
                    super.onBatchScanResults(results);
                }

                @Override
                public void onScanFailed(int errorCode) {
                    super.onScanFailed(errorCode);
                    isBleScanning = false;
                    Log.w(TAG, "Native BLE Scanner failed (code: " + errorCode + ")");
                }
            };

            bleScanner.startScan(Collections.emptyList(), scanSettings, scanCallback);
            isBleScanning = true;
            Log.i(TAG, "Vanguard Geo Native BLE Low-Power Background Scanner active.");
        } catch (SecurityException se) {
            Log.w(TAG, "SecurityException while starting BLE scanner: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error starting BLE scanner: " + e.getMessage(), e);
        }
    }

    private void stopNativeBleMesh() {
        try {
            if (bleAdvertiser != null && advertiseCallback != null) {
                bleAdvertiser.stopAdvertising(advertiseCallback);
                advertiseCallback = null;
                isBleAdvertising = false;
                Log.d(TAG, "BLE Advertiser stopped.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping BLE advertiser: " + e.getMessage());
        }

        try {
            if (bleScanner != null && scanCallback != null) {
                bleScanner.stopScan(scanCallback);
                scanCallback = null;
                isBleScanning = false;
                Log.d(TAG, "BLE Scanner stopped.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping BLE scanner: " + e.getMessage());
        }
    }

    private void startBackgroundMeshPulse() {
        if (backgroundPulseRunnable != null) return;

        backgroundPulseRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRunning) return;

                // Health check & recovery: If BLE was off when started and user enabled it, re-start mesh
                if ((!isBleAdvertising || !isBleScanning) && bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
                    startNativeBleMesh();
                }

                Log.v(TAG, "Vanguard Geo Mesh Heartbeat Active (Adv: " + isBleAdvertising + ", Scan: " + isBleScanning + ")");
                if (handler != null && isRunning) {
                    handler.postDelayed(this, 15000); // 15-second low-power pulse
                }
            }
        };
        handler.post(backgroundPulseRunnable);
    }

    private void stopMeshService() {
        isRunning = false;
        if (handler != null && backgroundPulseRunnable != null) {
            handler.removeCallbacks(backgroundPulseRunnable);
            backgroundPulseRunnable = null;
        }
        stopNativeBleMesh();
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
        Log.d(TAG, "EmergencyMeshBackgroundService stopped.");
    }

    @Override
    public void onDestroy() {
        stopMeshService();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
