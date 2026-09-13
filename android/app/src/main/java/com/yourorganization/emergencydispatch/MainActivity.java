package com.yourorganization.emergencydispatch;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EmergencyMeshNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
