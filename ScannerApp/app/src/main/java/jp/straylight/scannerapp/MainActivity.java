package jp.straylight.scannerapp;

import android.os.Bundle;
import android.support.v7.widget.RecyclerView;
import android.support.v7.app.AppCompatActivity;
import com.polidea.rxandroidble.RxBleClient;
import com.polidea.rxandroidble.RxBleScanResult;
import com.polidea.rxandroidble.exceptions.BleScanException;

import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.util.Log;
import butterknife.BindView;
import butterknife.ButterKnife;
import android.widget.Toast;
import android.support.v7.widget.LinearLayoutManager;

import rx.Subscriber;
import rx.Subscription;
import rx.android.schedulers.AndroidSchedulers;
import rx.functions.Action0;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "MainActivity";
    private static final String REPORT_URL = "ws://192.168.0.5:8080";

    @BindView(R.id.scan_results)
    RecyclerView recyclerView;

    private RxBleClient rxBleClient;
    private Subscription scanSubscription;
    private ScanResultsAdapter resultsAdapter;
    private ScanResultsReporter resultsReporter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ButterKnife.bind(this);
        rxBleClient = ScannerApplication.getRxBleClient(this);
        configureResultList();
    }

    @Override
    public void onPause() {
        super.onPause();
        if (scanSubscription != null) {
            scanSubscription.unsubscribe();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        subscribe();
    }

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
                final RxBleScanResult itemAtPosition = resultsAdapter.getItemAtPosition(childAdapterPosition);
                onAdapterItemClick(itemAtPosition);
            }
        });
    }

    private void onAdapterItemClick(RxBleScanResult scanResults) {
        final String macAddress = scanResults.getBleDevice().getMacAddress();
        Log.i(TAG, "onAdapterItemClick:" + macAddress);
    }

    private void subscribe() {
        resultsReporter = new ScanResultsReporter(REPORT_URL);
        scanSubscription = rxBleClient.scanBleDevices()
                .observeOn(AndroidSchedulers.mainThread())
                .doOnUnsubscribe(new Action0() {
                    @Override
                    public void call() {
                        clearSubscription();
                    }
                })
                .subscribe(new Subscriber<RxBleScanResult>() {
                    @Override
                    public void onCompleted() {
                    }

                    @Override
                    public void onError(Throwable e) {
                        onScanFailure(e);
                    }

                    @Override
                    public void onNext(RxBleScanResult rxBleScanResult) {
                        processScanResult(rxBleScanResult);
                    }
                });
    }

    private void processScanResult(RxBleScanResult result) {
        String macAddress = result.getBleDevice().getMacAddress();
        int rssi = result.getRssi();
        resultsReporter.send(rssi, macAddress);
        resultsAdapter.addScanResult(result);
    }

    private void onScanFailure(Throwable throwable) {
        if (throwable instanceof BleScanException) {
            handleBleScanException((BleScanException) throwable);
        }
    }

    private void handleBleScanException(BleScanException bleScanException) {
        switch (bleScanException.getReason()) {
            case BleScanException.BLUETOOTH_NOT_AVAILABLE:
                Toast.makeText(MainActivity.this, "Bluetooth is not available", Toast.LENGTH_SHORT).show();
                break;
            case BleScanException.BLUETOOTH_DISABLED:
                Toast.makeText(MainActivity.this, "Enable bluetooth and try again", Toast.LENGTH_SHORT).show();
                break;
            case BleScanException.LOCATION_PERMISSION_MISSING:
                Toast.makeText(MainActivity.this,
                        "On Android 6.0 location permission is required. Implement Runtime Permissions", Toast.LENGTH_SHORT).show();
                break;
            case BleScanException.LOCATION_SERVICES_DISABLED:
                Toast.makeText(MainActivity.this, "Location services needs to be enabled on Android 6.0", Toast.LENGTH_SHORT).show();
                break;
            case BleScanException.BLUETOOTH_CANNOT_START:
            default:
                Toast.makeText(MainActivity.this, "Unable to start scanning", Toast.LENGTH_SHORT).show();
                break;
        }
    }

    private void clearSubscription() {
        scanSubscription = null;
        resultsAdapter.clearScanResults();
        resultsReporter.disconnect();
        resultsReporter = null;
    }
}
