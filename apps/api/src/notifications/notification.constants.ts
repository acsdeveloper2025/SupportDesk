import { NotificationChannel, NotificationEventType } from "@prisma/client";

/** Event types that cannot be disabled via preferences (security/mandatory notices). */
export const MANDATORY_NOTIFICATION_EVENTS: ReadonlySet<NotificationEventType> = new Set([
  NotificationEventType.AUTH_SESSION_REVOKED,
  NotificationEventType.SETTINGS_SECURITY_UPDATED,
]);

export const ALL_NOTIFICATION_EVENT_TYPES: readonly NotificationEventType[] = [
  NotificationEventType.TICKET_ASSIGNED,
  NotificationEventType.TICKET_REASSIGNED,
  NotificationEventType.TICKET_STATUS_CHANGED,
  NotificationEventType.COMMENT_CREATED_PUBLIC,
  NotificationEventType.COMMENT_CREATED_INTERNAL,
  NotificationEventType.ATTACHMENT_UPLOADED,
  NotificationEventType.AUTH_SESSION_REVOKED,
  NotificationEventType.SETTINGS_SECURITY_UPDATED,
  NotificationEventType.SLA_WARNING,
  NotificationEventType.SLA_BREACHED,
];

export const DEFAULT_NOTIFICATION_CHANNEL = NotificationChannel.IN_APP;

export function isMandatoryNotificationEvent(eventType: NotificationEventType): boolean {
  return MANDATORY_NOTIFICATION_EVENTS.has(eventType);
}
