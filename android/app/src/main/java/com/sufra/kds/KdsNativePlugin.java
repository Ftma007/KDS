package com.sufra.kds;

import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Base64;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * Native helper for the KDS app. It reads basic device
 * details, checks whether a printer's network port can be reached, sends a
 * plain-text test print, toggles full screen / keep-screen-on, and opens
 * Android's settings screens. It does not change any system setting itself.
 */
@CapacitorPlugin(name = "KdsNative")
public class KdsNativePlugin extends Plugin {

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("manufacturer", Build.MANUFACTURER);
        ret.put("brand", Build.BRAND);
        ret.put("model", Build.MODEL);
        ret.put("device", Build.DEVICE);
        ret.put("androidRelease", Build.VERSION.RELEASE);
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        ret.put("buildId", Build.ID);
        ret.put("fingerprint", Build.FINGERPRINT);
        ret.put("uptimeMinutes", SystemClock.elapsedRealtime() / 60000L);
        call.resolve(ret);
    }

    /** Can we open a TCP connection to the printer? */
    @PluginMethod
    public void tcpCheck(final PluginCall call) {
        final String host = call.getString("host");
        final int port = call.getInt("port", 9100);
        final int timeoutMs = call.getInt("timeoutMs", 3000);
        if (host == null || host.trim().isEmpty()) {
            call.reject("host is required");
            return;
        }
        new Thread(() -> {
            JSObject ret = new JSObject();
            long start = System.currentTimeMillis();
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host.trim(), port), timeoutMs);
                ret.put("ok", true);
                ret.put("ms", System.currentTimeMillis() - start);
            } catch (Exception e) {
                ret.put("ok", false);
                ret.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            call.resolve(ret);
        }).start();
    }

    /**
     * Sends plain ASCII text plus a few line feeds, then an optional cut command.
     * cut = "star"   -> ESC d 3 (Star command style: feed to cut position, partial cut)
     * cut = "escpos" -> GS V 66 0 (standard ESC/POS style: feed to cut position, partial cut)
     * cut = "none"   -> no cut (the first version's behaviour)
     */
    @PluginMethod
    public void rawPrintText(final PluginCall call) {
        final String host = call.getString("host");
        final int port = call.getInt("port", 9100);
        final String text = call.getString("text", "Sufra KDS test print");
        final String cut = call.getString("cut", "none");
        if (host == null || host.trim().isEmpty()) {
            call.reject("host is required");
            return;
        }
        new Thread(() -> {
            JSObject ret = new JSObject();
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host.trim(), port), 4000);
                OutputStream out = socket.getOutputStream();
                out.write(text.getBytes(StandardCharsets.US_ASCII));
                out.write(new byte[] {0x0A, 0x0A, 0x0A, 0x0A});
                if ("star".equals(cut)) {
                    out.write(new byte[] {0x1B, 0x64, 0x03});
                } else if ("escpos".equals(cut)) {
                    out.write(new byte[] {0x1D, 0x56, 0x42, 0x00});
                }
                out.flush();
                ret.put("ok", true);
                ret.put("cut", cut);
            } catch (Exception e) {
                ret.put("ok", false);
                ret.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
            call.resolve(ret);
        }).start();
    }

    /**
     * Sends ready-made printer commands (base64) to a network printer over TCP.
     * The result says where a failure happened:
     *   stage "connect": nothing reached the printer, so it is safe to retry;
     *   stage "write":   the connection dropped while sending, so the label may have
     *                    half-printed and a person checks it ("Check This Label").
     */
    @PluginMethod
    public void rawPrintBytes(final PluginCall call) {
        final String host = call.getString("host");
        final Integer portArg = call.getInt("port", 9100);
        final Integer timeoutArg = call.getInt("timeoutMs", 6000);
        final String data = call.getString("data");
        if (host == null || host.isEmpty() || data == null || data.isEmpty()) {
            call.reject("host and data are required");
            return;
        }
        final int port = portArg == null ? 9100 : portArg;
        final int timeoutMs = timeoutArg == null ? 6000 : timeoutArg;
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSObject ret = new JSObject();
                byte[] bytes;
                try {
                    bytes = Base64.decode(data, Base64.DEFAULT);
                } catch (IllegalArgumentException e) {
                    ret.put("ok", false);
                    ret.put("stage", "connect");
                    ret.put("error", "Print data could not be read.");
                    call.resolve(ret);
                    return;
                }
                Socket socket = new Socket();
                try {
                    socket.connect(new InetSocketAddress(host, port), timeoutMs);
                } catch (Exception e) {
                    try { socket.close(); } catch (Exception ignored) { }
                    ret.put("ok", false);
                    ret.put("stage", "connect");
                    ret.put("error", e.getMessage() == null ? e.toString() : e.getMessage());
                    call.resolve(ret);
                    return;
                }
                try {
                    socket.setSoTimeout(timeoutMs);
                    OutputStream out = socket.getOutputStream();
                    out.write(bytes);
                    out.flush();
                    ret.put("ok", true);
                    ret.put("bytes", bytes.length);
                } catch (Exception e) {
                    ret.put("ok", false);
                    ret.put("stage", "write");
                    ret.put("error", e.getMessage() == null ? e.toString() : e.getMessage());
                } finally {
                    try { socket.close(); } catch (Exception ignored) { }
                }
                call.resolve(ret);
            }
        }).start();
    }

    @PluginMethod
    public void keepScreenOn(final PluginCall call) {
        final boolean enabled = call.getBoolean("enabled", true);
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    /** Full screen. Swiping from an edge brings the system bars back, so this cannot lock anyone out. */
    @PluginMethod
    public void setImmersive(final PluginCall call) {
        final boolean enabled = call.getBoolean("enabled", true);
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            if (enabled) {
                decor.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            } else {
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            }
            call.resolve();
        });
    }

    /** Opens an Android settings screen so staff can switch the Home app back at any time. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String target = call.getString("target", "main");
        String action = Settings.ACTION_SETTINGS;
        if ("home".equals(target)) {
            action = Settings.ACTION_HOME_SETTINGS;
        } else if ("apps".equals(target)) {
            action = Settings.ACTION_APPLICATION_SETTINGS;
        }
        try {
            Intent intent = new Intent(action);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception first) {
            try {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(fallback);
                call.resolve();
            } catch (Exception second) {
                call.reject("Could not open settings: " + second.getMessage());
            }
        }
    }
}
