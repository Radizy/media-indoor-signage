package com.mediaindoorsignage.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.d("BootReceiver", "Boot ou reinicializacao rápida detectada. Iniciando MainActivity e AutoLaunchService.");
            
            // 1. Tenta abrir a MainActivity imediatamente no boot
            try {
                Intent i = new Intent(context, MainActivity.class);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(i);
            } catch (Exception e) {
                Log.e("BootReceiver", "Nao foi possivel abrir a MainActivity diretamente no boot: " + e.getMessage());
            }

            // 2. Inicializa o servico de auto-abertura como contingencia
            try {
                Intent serviceIntent = new Intent(context, AutoLaunchService.class);
                serviceIntent.putExtra("from_boot", true);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.e("BootReceiver", "Nao foi possivel inicializar o AutoLaunchService no boot: " + e.getMessage());
            }
        }
    }
}
