import { BadRequestException, ForbiddenException, Logger, NotFoundException } from "@nestjs/common";
import { NotificationChannel, NotificationEventType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RbacService } from "../rbac/rbac.service";
import { NotificationEntity } from "./domain/notification.entity";
import type {
  NotificationPreferenceRecord,
  NotificationsRepository,
} from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const recipientUserId = "22222222-2222-4222-8222-222222222222";
  const actorUserId = "33333333-3333-4333-8333-333333333333";

  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let rbacService: Record<string, ReturnType<typeof vi.fn>>;
  let service: NotificationsService;

  beforeEach(() => {
    repository = {
      countUnread: vi.fn().mockResolvedValue(0),
      create: vi.fn((entity: NotificationEntity) => Promise.resolve(entity)),
      findById: vi.fn(),
      findMany: vi.fn().mockResolvedValue({ items: [], totalRecords: 0 }),
      findPreference: vi.fn().mockResolvedValue(null),
      listPreferences: vi.fn().mockResolvedValue([]),
      updateWithAudit: vi.fn((entity: NotificationEntity) => Promise.resolve(entity)),
      upsertPreference: vi.fn(
        (input: {
          channel: NotificationChannel;
          enabled: boolean;
          eventType: NotificationEventType;
          expectedVersion?: number;
          tenantId: string;
          userId: string;
        }): Promise<NotificationPreferenceRecord> =>
          Promise.resolve({
            channel: input.channel,
            createdAt: new Date(),
            enabled: input.enabled,
            eventType: input.eventType,
            id: "pref-1",
            tenantId: input.tenantId,
            updatedAt: new Date(),
            userId: input.userId,
            version: (input.expectedVersion ?? 0) + 1,
          }),
      ),
    };
    rbacService = {
      can: vi.fn().mockResolvedValue(false),
    };
    service = new NotificationsService(
      repository as unknown as NotificationsRepository,
      rbacService as unknown as RbacService,
    );
  });

  it("creates an in-app notification", async () => {
    const created = await service.create({
      actorUserId,
      eventType: NotificationEventType.TICKET_ASSIGNED,
      recipientUserId,
      tenantId,
      title: "Assigned",
    });

    expect(created).not.toBeNull();
    expect(created?.eventType).toBe(NotificationEventType.TICKET_ASSIGNED);
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("suppresses self-notifications", async () => {
    const created = await service.create({
      actorUserId: recipientUserId,
      eventType: NotificationEventType.TICKET_ASSIGNED,
      recipientUserId,
      tenantId,
      title: "Assigned",
    });
    expect(created).toBeNull();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("suppresses when preference disables the event", async () => {
    repository.findPreference!.mockResolvedValue({
      channel: NotificationChannel.IN_APP,
      enabled: false,
      eventType: NotificationEventType.TICKET_ASSIGNED,
      id: "p1",
      tenantId,
      userId: recipientUserId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await service.create({
      actorUserId,
      eventType: NotificationEventType.TICKET_ASSIGNED,
      recipientUserId,
      tenantId,
      title: "Assigned",
    });
    expect(created).toBeNull();
  });

  it("ignores disabled preference for mandatory security events", async () => {
    repository.findPreference!.mockResolvedValue({
      channel: NotificationChannel.IN_APP,
      enabled: false,
      eventType: NotificationEventType.AUTH_SESSION_REVOKED,
      id: "p1",
      tenantId,
      userId: recipientUserId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await service.create({
      actorUserId,
      eventType: NotificationEventType.AUTH_SESSION_REVOKED,
      recipientUserId,
      tenantId,
      title: "Session revoked",
    });
    expect(created).not.toBeNull();
  });

  it("updates own notification read state", async () => {
    const entity = new NotificationEntity({
      createdAt: new Date(),
      eventType: NotificationEventType.TICKET_ASSIGNED,
      id: "n1",
      recipientUserId,
      tenantId,
      title: "Assigned",
      updatedAt: new Date(),
      version: 1,
    });
    repository.findById!.mockResolvedValue(entity);

    const updated = await service.updateOwnNotification({
      actorUserId: recipientUserId,
      notificationId: "n1",
      read: true,
      tenantId,
      version: 1,
    });

    expect(updated.isRead).toBe(true);
    expect(repository.updateWithAudit).toHaveBeenCalledOnce();
  });

  it("hides other users notifications as not found", async () => {
    const entity = new NotificationEntity({
      createdAt: new Date(),
      eventType: NotificationEventType.TICKET_ASSIGNED,
      id: "n1",
      recipientUserId,
      tenantId,
      title: "Assigned",
      updatedAt: new Date(),
      version: 1,
    });
    repository.findById!.mockResolvedValue(entity);

    await expect(
      service.updateOwnNotification({
        actorUserId: actorUserId,
        notificationId: "n1",
        read: true,
        tenantId,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects disabling mandatory preferences", async () => {
    await expect(
      service.updatePreferences({
        actorUserId: recipientUserId,
        preferences: [
          {
            channel: NotificationChannel.IN_APP,
            enabled: false,
            eventType: NotificationEventType.AUTH_SESSION_REVOKED,
          },
        ],
        targetUserId: recipientUserId,
        tenantId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("forbids reading another user's preferences without permission", async () => {
    await expect(
      service.getPreferences(tenantId, recipientUserId, actorUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows reading another user's preferences with permission", async () => {
    rbacService.can!.mockResolvedValue(true);
    const result = await service.getPreferences(tenantId, recipientUserId, actorUserId);
    expect(result.userId).toBe(recipientUserId);
    expect(result.preferences.length).toBeGreaterThan(0);
  });

  it("createSafe swallows repository failures", async () => {
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    repository.create!.mockRejectedValue(new Error("db down"));
    const created = await service.createSafe({
      actorUserId,
      eventType: NotificationEventType.TICKET_ASSIGNED,
      recipientUserId,
      tenantId,
      title: "Assigned",
    });
    expect(created).toBeNull();
    errorSpy.mockRestore();
  });
});
