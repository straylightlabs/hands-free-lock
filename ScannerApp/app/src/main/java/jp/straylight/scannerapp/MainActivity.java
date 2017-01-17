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
import android.support.v7.app.AppCompatActivity;
import android.support.v7.widget.LinearLayoutManager;
import android.support.v7.widget.RecyclerView;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;

import java.util.ArrayList;
import java.util.List;

import butterknife.BindView;
import butterknife.ButterKnife;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "MainActivity";
    private static final String REPORT_URL = "ws://192.168.0.5:8080";
    private static final int REQUEST_ENABLE_BT = 1;
    private static final int REQUEST_ENABLE_LOCATION = 2;

    @BindView(R.id.scan_results)
    RecyclerView recyclerView;

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothScanner;
    private NfcAdapter nfcAdapter;
    private ScanResultsAdapter resultsAdapter;
    private ScanResultsReporter resultsReporter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_main);
        ButterKnife.bind(this);

        final BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = bluetoothManager.getAdapter();
        bluetoothScanner = bluetoothAdapter.getBluetoothLeScanner();

        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        resultsReporter = new ScanResultsReporter(REPORT_URL);

        configureResultList();
    }

    @Override
    protected void onResume() {
        super.onResume();

        String permission = Manifest.permission.ACCESS_COARSE_LOCATION;
        if (ContextCompat.checkSelfPermission(MainActivity.this, permission) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(MainActivity.this, new String[]{permission}, REQUEST_ENABLE_LOCATION);
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
        resultsAdapter.clearScanResults();

        super.onPause();
    }

    @Override
    public void onNewIntent(Intent intent) {
        String url = intent.getDataString();
        resultsReporter.sendNfcScan(url);
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
        if (requestCode == REQUEST_ENABLE_LOCATION) {
            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i] == Manifest.permission.ACCESS_COARSE_LOCATION
                        && grantResults[i] == PackageManager.PERMISSION_DENIED) {
                    finish();
                    return;
                }
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
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

    private void configureResultList() {
        recyclerView.setHasFixedSize(true);
        LinearLayoutManager recyclerLayoutManager = new LinearLayoutManager(this);
        recyclerView.setLayoutManager(recyclerLayoutManager);
        resultsAdapter = new ScanResultsAdapter();
        recyclerView.setAdapter(resultsAdapter);
        resultsAdapter.setOnAdapterItemClickListener(new ScanResultsAdapter.OnAdapterItemClickListener() {
            @Override
            public void onAdapterViewClick(View view) {
                final int childAdapterPosition = recyclerView.getChildAdapterPosition(view);
                final ScanResult itemAtPosition = resultsAdapter.getItemAtPosition(childAdapterPosition);
                onAdapterItemClick(itemAtPosition);
            }
        });
    }

    private void onAdapterItemClick(ScanResult result) {
        final String macAddress = result.getDevice().getAddress();
        Log.i(TAG, "onAdapterItemClick:" + macAddress);
    }

    private void processScanResult(ScanResult result) {
        if (result.getDevice().getName() == null
                || !result.getDevice().getName().startsWith("SLBeacon")) {
            return;
        }
        String macAddress = result.getDevice().getAddress();
        int rssi = result.getRssi();
        resultsReporter.sendBleScan(rssi, macAddress);
        resultsAdapter.addScanResult(result);
    }
}
