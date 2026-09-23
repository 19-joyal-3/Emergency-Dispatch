package com.yourorganization.emergencydispatch;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * EmergencyMeshNativePlugin
 *
 * Exposes native Android background lifecycle, partial wake-lock services,
 * and Battery Optimization exemption controls to the Vanguard Geo web runtime.
 */
@CapacitorPlugin(name = "EmergencyMeshNative")
public class EmergencyMeshNativePlugin extends Plugin {

    @PluginMethod
    public void startBackgroundService(PluginCall call) {
        Context context = getContext();
        try {
            Intent serviceIntent = new Intent(context, EmergencyMeshBackgroundService.class);
            serviceIntent.setAction(EmergencyMeshBackgroundService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            JSObject ret = new JSObject();
            ret.put("status", "started");
            ret.put("active", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start background mesh service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopBackgroundService(PluginCall call) {
        Context context = getContext();
        try {
            Intent serviceIntent = new Intent(context, EmergencyMeshBackgroundService.class);
            serviceIntent.setAction(EmergencyMeshBackgroundService.ACTION_STOP);
            context.startService(serviceIntent);
            JSObject ret = new JSObject();
            ret.put("status", "stopped");
            ret.put("active", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop background mesh service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isBackgroundServiceActive(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", EmergencyMeshBackgroundService.isRunning);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        Context context = getContext();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                String packageName = context.getPackageName();
                boolean isIgnoring = pm != null && pm.isIgnoringBatteryOptimizations(packageName);

                if (!isIgnoring) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                }

                JSObject ret = new JSObject();
                ret.put("exempted", isIgnoring);
                ret.put("requested", !isIgnoring);
                call.resolve(ret);
            } else {
                JSObject ret = new JSObject();
                ret.put("exempted", true);
                ret.put("requested", false);
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Failed to request battery optimization exemption: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isBluetoothAvailable(PluginCall call) {
        Context context = getContext();
        try {
            BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
            boolean available = adapter != null;
            boolean enabled = adapter != null && adapter.isEnabled();

            JSObject ret = new JSObject();
            ret.put("available", available);
            ret.put("enabled", enabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error checking Bluetooth state: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getDiscoveredBeacons(PluginCall call) {
        try {
            JSArray array = new JSArray();
            for (EmergencyMeshBackgroundService.DiscoveredBeacon beacon : EmergencyMeshBackgroundService.discoveredBeacons.values()) {
                JSObject obj = new JSObject();
                obj.put("id", "native-ble-" + beacon.address.replace(":", "-"));
                obj.put("address", beacon.address);
                obj.put("name", beacon.name);
                obj.put("rssi", beacon.rssi);
                obj.put("timestamp", beacon.timestamp);
                array.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("beacons", array);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error fetching discovered BLE beacons: " + e.getMessage(), e);
        }
    }
}
