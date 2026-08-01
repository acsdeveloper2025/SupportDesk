import { NotificationEventType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { NotificationConcurrencyException, NotificationEntity } from "./notification.entity";

function makeNotification(
  overrides: Partial<ConstructorParameters<typeof NotificationEntity>[0]> = {},
) {
  return new NotificationEntity({
    createdAt: new Date("2026-07-31T10:00:00.000Z"),
    eventType: NotificationEventType.TICKET_ASSIGNED,
    id: "n1111111-1111-4111-8111-111111111111",
    recipientUserId: "u1111111-1111-4111-8111-111111111111",
    tenantId: "t1111111-1111-4111-8111-111111111111",
    title: "Assigned",
    updatedAt: new Date("2026-07-31T10:00:00.000Z"),
    version: 1,
    ...overrides,
  });
}

describe("NotificationEntity", () => {
  it("marks read and archive in a single version bump", () => {
    const notification = makeNotification();
    const changed = notification.applyStateUpdate(1, { archived: true, read: true });

    expect(changed).toBe(true);
    expect(notification.isRead).toBe(true);
    expect(notification.isArchived).toBe(true);
    expect(notification.version).toBe(2);
  });

  it("returns false when state is unchanged", () => {
    const notification = makeNotification({
      readAt: new Date("2026-07-31T10:01:00.000Z"),
    });
    const changed = notification.applyStateUpdate(1, { read: true });
    expect(changed).toBe(false);
    expect(notification.version).toBe(1);
  });

  it("throws on stale version", () => {
    const notification = makeNotification();
    expect(() => notification.applyStateUpdate(2, { read: true })).toThrow(
      NotificationConcurrencyException,
    );
  });

  it("unreads and unarchives", () => {
    const notification = makeNotification({
      archivedAt: new Date("2026-07-31T10:02:00.000Z"),
      readAt: new Date("2026-07-31T10:01:00.000Z"),
    });

    notification.applyStateUpdate(1, { archived: false, read: false });
    expect(notification.isRead).toBe(false);
    expect(notification.isArchived).toBe(false);
    expect(notification.version).toBe(2);
  });
});
