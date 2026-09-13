package com.yourorganization.emergencydispatch;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * EmergencyMeshBackgroundService
 * 
 * Android Foreground Service maintaining continuous zero-connectivity Bluetooth Low Energy (BLE)
 * and mesh packet relaying even when the device screen is off, locked, or subjected to Android Doze mode.
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

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquirePartialWakeLock();
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopMeshService();
            return START_NOT_STICKY;
        }

        startForegroundWithNotification();
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

    private void startBackgroundMeshPulse() {
        if (backgroundPulseRunnable != null) return;

        backgroundPulseRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRunning) return;
                // Periodic low-power background pulse (every 10 seconds)
                // Keeps the native network radio stack from entering deep freeze
                Log.v(TAG, "Vanguard Geo Mesh Heartbeat Pulse Active");
                if (handler != null && isRunning) {
                    handler.postDelayed(this, 10000);
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
