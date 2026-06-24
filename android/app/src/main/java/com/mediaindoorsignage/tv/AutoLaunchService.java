package com.mediaindoorsignage.tv;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

public class AutoLaunchService extends Service {
    private static final String TAG = "AutoLaunchService";
    private Handler handler;
    private Runnable checkerRunnable;
    private long lastTimeInForeground = System.currentTimeMillis();
    private static final long INACTIVITY_THRESHOLD = 30000; // 30 segundos em background
    
    private static final int FOREGROUND_NOTIFICATION_ID = 2002;
    private static final String FOREGROUND_CHANNEL_ID = "autolaunch_foreground_channel";

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "onCreate: Inicializando AutoLaunchService.");
        handler = new Handler(Looper.getMainLooper());
        lastTimeInForeground = System.currentTimeMillis();
        
        // Coloca o serviço em primeiro plano (Foreground Service)
        startServiceInForeground();
        
        checkerRunnable = new Runnable() {
            @Override
            public void run() {
                checkAndLaunchIfNeeded();
                handler.postDelayed(this, 10000); // Verifica a cada 10 segundos
            }
        };
        handler.post(checkerRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand chamado.");
        
        // Garante que o serviço continua em primeiro plano
        startServiceInForeground();
        
        // Se iniciado pelo BootReceiver, fazemos um lançamento inicial com atraso para dar tempo ao sistema carregar
        if (intent != null && intent.getBooleanExtra("from_boot", false)) {
            Log.d(TAG, "Iniciado pelo boot do aparelho. Agendando abertura em 15 segundos.");
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    launchMainActivity();
                }
            }, 15000);
        }
        
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy chamado. Removendo callbacks.");
        if (handler != null && checkerRunnable != null) {
            handler.removeCallbacks(checkerRunnable);
        }
    }

    private void startServiceInForeground() {
        try {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    FOREGROUND_CHANNEL_ID,
                    "Serviço de Sinalização Mídia Indoor",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Monitoramento do player Mídia Indoor");
                notificationManager.createNotificationChannel(channel);
            }

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, FOREGROUND_CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            Intent intent = new Intent(this, MainActivity.class);
            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 1, intent, pendingFlags);

            builder.setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle("Mídia Indoor")
                .setContentText("Serviço de sinalização ativo em segundo plano")
                .setContentIntent(pendingIntent)
                .setOngoing(true);

            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(FOREGROUND_NOTIFICATION_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(FOREGROUND_NOTIFICATION_ID, builder.build());
            }
            Log.d(TAG, "Serviço colocado em primeiro plano (Foreground Service).");
        } catch (Exception e) {
            Log.e(TAG, "Erro ao iniciar o serviço em primeiro plano: " + e.getMessage());
        }
    }

    private void checkAndLaunchIfNeeded() {
        boolean isAppInForeground = MainActivity.isAppVisible;
        
        if (isAppInForeground) {
            lastTimeInForeground = System.currentTimeMillis();
        } else {
            long timeInBackground = System.currentTimeMillis() - lastTimeInForeground;
            Log.d(TAG, "Aplicativo está em background há " + (timeInBackground / 1000) + " segundos.");
            
            if (timeInBackground >= INACTIVITY_THRESHOLD) {
                Log.d(TAG, "Tempo limite em background excedido. Trazendo o player de volta para a tela.");
                launchMainActivity();
                lastTimeInForeground = System.currentTimeMillis(); // Reseta para evitar loops constantes
            }
        }
    }

    private void launchMainActivity() {
        Log.d(TAG, "launchMainActivity() executada.");
        
        // 1. Tenta iniciar a Activity diretamente
        try {
            Intent i = new Intent(this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            i.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
            Log.d(TAG, "Activity iniciada diretamente via startActivity.");
        } catch (Exception e) {
            Log.e(TAG, "Falha ao iniciar activity diretamente: " + e.getMessage());
        }

        // 2. Dispara a notificação de Full Screen Intent como reforço/fallback para Android 10+
        showFullScreenNotification();
    }

    private void showFullScreenNotification() {
        try {
            String channelId = "autolaunch_fullscreen_channel";
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "Auto Launch Fallback Channel",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Canal para inicialização automática do player");
                channel.setBypassDnd(true);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                notificationManager.createNotificationChannel(channel);
            }
            
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            
            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingFlags);
            
            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, channelId);
            } else {
                builder = new Notification.Builder(this);
            }
            
            builder.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Mídia Indoor Signage")
                .setContentText("Trazendo player de sinalização para frente...")
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(Notification.CATEGORY_ALARM)
                .setFullScreenIntent(pendingIntent, true)
                .setAutoCancel(true);
                
            notificationManager.notify(1001, builder.build());
            Log.d(TAG, "Notificação de FullScreenIntent enviada.");
        } catch (Exception e) {
            Log.e(TAG, "Erro ao enviar notificação de FullScreenIntent: " + e.getMessage());
        }
    }
}
