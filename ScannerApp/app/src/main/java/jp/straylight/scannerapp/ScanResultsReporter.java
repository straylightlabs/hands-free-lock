package jp.straylight.scannerapp;

import android.os.Handler;
import android.util.Log;

import org.java_websocket.WebSocket;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

class ScanResultsReporter {

    public interface Listener {
        void onReport(String report);
    }

    private static final String TAG = "ScanResultsReporter";
    private static double SECONDS_UNTIL_DISSAPPEARANCE = 10.0;

    private Listener listener;
    private WebSocketClient webSocketClient;
    private URI uri;
    private boolean isConnecting = false;
    private Map<String, RssiRange> rssiRangeMap = new HashMap();

    private class RssiRange {
        public Integer max = null;
        public Integer min = null;
        public Date lastSignalSeen;

        public boolean shouldReportRssi(int rssi) {
            boolean shouldReport = false;
            if (max == null || rssi > max) {
                max = rssi;
                shouldReport = true;
            }
            if (min == null || rssi < min) {
                min = rssi;
                shouldReport = true;
            }
            lastSignalSeen = new Date();
            return shouldReport;
        }

        public boolean shouldReportDisappearance() {
            if (lastSignalSeen == null) {
                return false;
            }
            long secondsElapsed = (new Date().getTime() - lastSignalSeen.getTime()) / 1000;
            boolean disappeared = secondsElapsed >= SECONDS_UNTIL_DISSAPPEARANCE;
            if (disappeared) {
                max = null;
                min = null;
                lastSignalSeen = null;
            }
            return disappeared;
        }
    }

    public ScanResultsReporter(String url, Listener listener) {
        this.listener = listener;

        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            e.printStackTrace();
        }

        setInterval(new Runnable() {
            @Override
            public void run() {
                reconnect();
                reportDisappearance();
            }
        }, 10000);
    }

    public void connect() {
        if (isConnected()) {
            return;
        }

        webSocketClient = new WebSocketClient(uri) {
            @Override
            public void onOpen(ServerHandshake serverHandshake) {
                Log.i(TAG, "onOpen");
            }

            @Override
            public void onMessage(String s) {
                Log.i(TAG, "onMessage:" + s);
            }

            @Override
            public void onClose(int i, String s, boolean b) {
                Log.i(TAG, "onClose:" + s);
            }

            @Override
            public void onError(Exception e) {
                Log.i(TAG, "onError:" + e.getMessage());
            }
        };
        webSocketClient.connect();
        isConnecting = true;
    }

    public void disconnect() {
        if (webSocketClient != null) {
            webSocketClient.close();
        }
        isConnecting = false;
    }

    public void reportBleScan(int rssi, String macAddress) {
        RssiRange rssiRange = rssiRangeMap.get(macAddress);
        if (rssiRange == null) {
            rssiRange = new RssiRange();
            rssiRangeMap.put(macAddress, rssiRange);
        }
        if (rssiRange.shouldReportRssi(rssi)) {
            reportBleScanInternal(rssi, macAddress);
        }
    }

    public void reportNfcScan(String url) {
        String data = String.format("{\"type\":\"nfc\",\"url\":\"%s\"}", url);
        report(data);
    }

    private void reportBleScanInternal(int rssi, String macAddress) {
        String data = String.format("{\"type\":\"ble\",\"rssi\":%d,\"macAddress\":\"%s\"}", rssi, macAddress);
        report(data);
    }

    private void report(String data) {
        if (!isConnected()) {
            Log.e(TAG, "WebSocket is not open.");
            listener.onReport("ERROR: WebSocket is not open");
            return;
        }

        webSocketClient.send(data);
        listener.onReport(data);
    }

    private void reportDisappearance() {
        for (Map.Entry<String, RssiRange> rssiRange : rssiRangeMap.entrySet()) {
            if (rssiRange.getValue().shouldReportDisappearance()) {
                reportBleScanInternal(-1 /* RSSI */, rssiRange.getKey());
            }
        }
    }

    private void reconnect() {
        if (isConnecting && !isConnected()) {
            connect();
        }
    }

    private boolean isConnected() {
        return webSocketClient != null && webSocketClient.getReadyState() == WebSocket.READYSTATE.OPEN;
    }

    private static void setInterval(final Runnable r, long interval) {
        // Unlike JavaScript, in Java the initial call is immediate, so we put interval instead.
        final Timer timer = new Timer();
        final Handler handler = new Handler();
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                handler.post(r);
            }
        }, interval, interval);
    }
}
