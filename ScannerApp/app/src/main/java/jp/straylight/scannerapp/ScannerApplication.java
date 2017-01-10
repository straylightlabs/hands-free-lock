package jp.straylight.scannerapp;

import android.app.Application;
import android.content.Context;

import com.polidea.rxandroidble.RxBleClient;
import com.polidea.rxandroidble.internal.RxBleLog;

public class ScannerApplication extends Application {

    private RxBleClient rxBleClient;

    public static RxBleClient getRxBleClient(Context context) {
        ScannerApplication application = (ScannerApplication) context.getApplicationContext();
        return application.rxBleClient;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        rxBleClient = RxBleClient.create(this);
        RxBleClient.setLogLevel(RxBleLog.DEBUG);
    }
}
