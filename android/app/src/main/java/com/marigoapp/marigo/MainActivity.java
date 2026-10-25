package com.marigoapp.marigo;

import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Android 16 draws an app targeting API 36 edge to edge, full stop:
     * `windowOptOutEdgeToEdgeEnforcement` (values-v35/styles.xml) is ignored
     * there, and so are the status and navigation bar colours. The WebView
     * would then sit under the status bar and the gesture bar, with the bottom
     * tab bar behind the latter — Android WebView does not report system-bar
     * insets to CSS dependably, so the page cannot compensate itself.
     *
     * So the shell does it: the content view is padded by the system bars
     * (and the keyboard, which an edge-to-edge window no longer resizes for),
     * and the padding is painted the colours the bars used to have — brand
     * purple above, the app background below. The page lays out exactly as it
     * does on Android 15 and earlier, where none of this runs.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
            padForSystemBars();
        }
    }

    private void padForSystemBars() {
        View content = findViewById(android.R.id.content);

        // Purple underneath, white over everything below the status bar; the
        // white layer's top inset is the status bar height, set per inset pass.
        LayerDrawable background = new LayerDrawable(new Drawable[] {
            new ColorDrawable(ContextCompat.getColor(this, R.color.brandPurple)),
            new ColorDrawable(ContextCompat.getColor(this, R.color.appBackground)),
        });
        content.setBackground(background);

        ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int bottom = Math.max(bars.bottom, ime.bottom);
            background.setLayerInset(1, 0, bars.top, 0, 0);
            view.setPadding(bars.left, bars.top, bars.right, bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
