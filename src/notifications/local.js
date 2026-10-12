// ─── Notificaciones LOCALES (no pasan por el servidor) ──────────────────────
// Igual que Android: aviso de desbloqueo a la hora exacta (NotificationWorker) y recordatorio
// después de abrir una oferta (RecordatorioWorker). Cada tipo tiene un identificador fijo:
// programar uno nuevo reemplaza al anterior.
import * as Notifications from "expo-notifications";

const ID_DESBLOQUEO = "desbloqueo";
const ID_RECORDATORIO = "recordatorio";

async function programar(identifier, segundos, title, body, screen) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, sound: "default", data: { screen } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(5, Math.round(segundos)),
        repeats: false,
      },
    });
  } catch {
    // Sin permiso de notificaciones o error del sistema: nunca rompe el flujo.
  }
}

/** Al enviar la solicitud: "Daniel, tu solicitud tiene novedades" justo cuando se desbloquean las ofertas. */
export function programarDesbloqueo(horas, nombre, monto) {
  const title = nombre ? `🎉 ${nombre}, tu solicitud tiene novedades` : "🎉 ¡Tu solicitud tiene novedades!";
  const body = monto
    ? `Ya están listas tus opciones de ${monto}. Entra a la app.`
    : "Ya están listas las mejores opciones para ti. Entra a la app.";
  return programar(ID_DESBLOQUEO, horas * 3600, title, body, "home");
}

export function programarRecordatorio(ms, titulo, cuerpo) {
  return programar(ID_RECORDATORIO, ms / 1000, titulo, cuerpo, "offers");
}

export function cancelarRecordatorio() {
  return Notifications.cancelScheduledNotificationAsync(ID_RECORDATORIO).catch(() => {});
}
