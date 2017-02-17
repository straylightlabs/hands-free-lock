package jp.straylight.scannerapp;

import android.os.Handler;
import android.util.Base64;
import android.util.Log;

import org.java_websocket.WebSocket;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Timer;
import java.util.TimerTask;

class ScanResultsReporter {

    public interface Listener {
        void onReport(String report);
    }

    private static final String TAG = "ScanResultsReporter";

    private Listener listener;
    private WebSocketClient webSocketClient;
    private URI uri;
    private boolean isConnecting = false;

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
                logInfo("WebSocket opened");
            }

            @Override
            public void onMessage(String s) {
                logInfo("WebSocket message: " + s);
            }

            @Override
            public void onClose(int i, String s, boolean b) {
                logInfo("WebSocket closed");
            }

            @Override
            public void onError(Exception e) {
                logError("WebSocket error: " + e.getMessage());
            }
        };
        logInfo("Opening WebSocket");
        webSocketClient.connect();
        isConnecting = true;
    }

    public void disconnect() {
        if (webSocketClient != null) {
            logInfo("Closing WebSocket");
            webSocketClient.close();
        }
        isConnecting = false;
    }

    public void reportNfcScan(String url) {
        String data = String.format("{\"type\": \"nfc\", \"url\": \"%s\"}", url);
        report(data);
    }

    public void reportBleScan(int rssi, String macAddress, String deviceName) {
        String data = String.format("{\"type\": \"ble\", \"rssi\": %d, \"macAddress\": \"%s\", \"deviceName\": \"%s\"}", rssi, macAddress, deviceName);
        report(data);
    }

    public void reportImage(byte[] bytes) {
        String base64Bytes = Base64.encodeToString(bytes, Base64.NO_WRAP);
        String data = String.format("{\"type\": \"image\", \"data\": \"%s\"}", base64Bytes);
        report(data);
    }

    private void report(String data) {
        if (!isConnected()) {
            logError("WebSocket is not open.");
            return;
        }

        webSocketClient.send(data);
        if (listener != null) {
            listener.onReport(data);
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

    private void logError(String message) {
        Log.e(TAG, message);
        if (listener != null) {
            listener.onReport("ERROR: " + message);
        }
    }

    private void logInfo(String message) {
        Log.i(TAG, message);
        if (listener != null) {
            listener.onReport(message);
        }
    }
}
