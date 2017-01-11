package jp.straylight.scannerapp;

import android.util.Log;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.net.URISyntaxException;

class ScanResultsReporter {
    private static final String TAG = "ScanResultsReporter";

    private WebSocketClient webSocketClient;

    public ScanResultsReporter(String url) {
        connectWebSocket(url);
    }

    public void send(int rssi, String macAddress) {
        String report = String.format("{\"rssi\":%d,\"macAddress\":\"%s\"}",rssi, macAddress);
        webSocketClient.send(report);
    }

    public void disconnect() {
        webSocketClient.close();
    }

    private void connectWebSocket(String url) {
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            e.printStackTrace();
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
    }
}
