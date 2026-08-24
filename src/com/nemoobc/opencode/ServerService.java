package com.nemoobc.opencode;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

public class ServerService extends Service {
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel("oc", "OpenCode", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("menjaga server tetap hangat");
        nm.createNotificationChannel(ch);
        Notification n = new Notification.Builder(this, "oc")
                .setContentTitle("OpenCode aktif")
                .setContentText("server AI siap \u2014 respons instan")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .build();
        startForeground(1, n);
        return START_STICKY;
    }
    @Override
    public IBinder onBind(Intent i) { return null; }
}
