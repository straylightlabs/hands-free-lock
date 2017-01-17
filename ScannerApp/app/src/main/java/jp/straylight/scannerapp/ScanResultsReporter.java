package jp.straylight.scannerapp;

import android.util.Log;
import android.os.Handler;

import org.java_websocket.WebSocket;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.TimerTask;
import java.util.Timer;

class ScanResultsReporter {
    private static final String TAG = "ScanResultsReporter";

    private WebSocketClient webSocketClient;
    private URI uri;
    private boolean isConnecting = false;

    public ScanResultsReporter(String url) {
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

    public void sendBleScan(int rssi, String macAddress) {
        if (!isConnected()) {
            Log.e(TAG, "WebSocket is not open.");
            return;
        }
        String report = String.format("{\"type\":\"ble\",\"rssi\":%d,\"macAddress\":\"%s\"}",rssi, macAddress);
        webSocketClient.send(report);
    }

    public void sendNfcScan(String url) {
        if (!isConnected()) {
            Log.e(TAG, "WebSocket is not open.");
            return;
        }
        String report = String.format("{\"type\": \"nfc\",\"url\":\"%s\"}", url);
        webSocketClient.send(report);
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
