package jp.straylight.scannerapp;

import android.content.Intent;

public class Application extends android.app.Application {
    @Override
    public void onCreate() {
        startService(new Intent(getApplicationContext(), CameraService.class));
    }
}
