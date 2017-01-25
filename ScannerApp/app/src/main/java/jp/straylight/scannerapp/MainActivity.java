package jp.straylight.scannerapp;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.util.Log;
import android.util.Pair;
import android.view.WindowManager;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

import butterknife.BindView;
import butterknife.ButterKnife;

public class MainActivity extends Activity implements ScanResultsReporter.Listener {
    private static final String TAG = "MainActivity";
    private static final String REPORT_URL = "ws://192.168.0.5:8080/report";
    private static final int REQUEST_ENABLE_BT = 1;
    private static final int REQUEST_LOCATION_PERMISSION = 2;
    private static final int REQUEST_CAMERA_PERMISSION = 3;

    @BindView(R.id.log_text_view)
    TextView logTextView;

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothScanner;
    private NfcAdapter nfcAdapter;
    private ScanResultsReporter resultsReporter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(0x10);

        setContentView(R.layout.activity_main);
        ButterKnife.bind(this);

        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)) {
            Log.e(TAG, "FEATURE_BLUETOOTH_LE is not supported.");
            finish();
        }
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC)) {
            Log.e(TAG, "FEATURE_NFC is not supported.");
            finish();
        }
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA)) {
            Log.e(TAG, "FEATURE_CAMERA is not supported.");
            finish();
        }

        final BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = bluetoothManager.getAdapter();
        bluetoothScanner = bluetoothAdapter.getBluetoothLeScanner();
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);
        resultsReporter = new ScanResultsReporter(REPORT_URL, this);
    }

    @Override
    protected void onResume() {
        super.onResume();

        List<Pair<String, Integer>> permissions = Arrays.asList(
                Pair.create(Manifest.permission.ACCESS_COARSE_LOCATION, REQUEST_LOCATION_PERMISSION),
                Pair.create(Manifest.permission.CAMERA, REQUEST_CAMERA_PERMISSION));
        for (Pair<String, Integer> permission : permissions) {
            if (ContextCompat.checkSelfPermission(MainActivity.this, permission.first) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(MainActivity.this, new String[]{permission.first}, permission.second);
            }
        }
        if (!bluetoothAdapter.isEnabled()) {
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT);
        }

        List<ScanFilter> filters = new ArrayList();
        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();
        bluetoothScanner.startScan(filters, settings, scanCallback);

        final PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), 0);
        nfcAdapter.enableForegroundDispatch(this, pendingIntent, null, null);

        resultsReporter.connect();
    }

    @Override
    public void onPause() {
        bluetoothScanner.stopScan(scanCallback);
        nfcAdapter.disableForegroundDispatch(this);

        super.onPause();
    }

    @Override
    public void onNewIntent(Intent intent) {
        String url = intent.getDataString();
        resultsReporter.reportNfcScan(url);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_ENABLE_BT) {
            if (resultCode == Activity.RESULT_CANCELED) {
                finish();
                return;
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == REQUEST_LOCATION_PERMISSION || requestCode == REQUEST_CAMERA_PERMISSION) {
            if (grantResults.length != 1 || grantResults[0] == PackageManager.PERMISSION_DENIED) {
                Log.e(TAG, "Did not get required permission: " + requestCode);
                finish();
                return;
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    public void onReport(String report) {
        addLog(report);
    }

    private ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            processScanResult(result);
        }

        @Override
        public void onBatchScanResults(List<ScanResult> results) {
        }

        @Override
        public void onScanFailed(int errorCode) {
            Log.e(TAG, "Scan failed: " + errorCode);
        }
    };

    private void processScanResult(ScanResult result) {
        if (result.getDevice().getName() == null
                || !result.getDevice().getName().startsWith("SLBeacon")) {
            return;
        }
        String macAddress = result.getDevice().getAddress();
        resultsReporter.reportBleScan(result.getRssi(), macAddress);
    }

    private void addLog(String log) {
        SimpleDateFormat dateFormat = new SimpleDateFormat("MM/dd HH:mm:ss");
        String dateString = dateFormat.format(new Date());

        CharSequence pastLogs = logTextView.getText();
        final int MAX_LENGTH = 10000;
        if (pastLogs.length() > MAX_LENGTH) {
            pastLogs = pastLogs.subSequence(0, MAX_LENGTH);
        }

        logTextView.setText(String.format("[%s] %s\n%s", dateString, log, pastLogs));
    }
}
