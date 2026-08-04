import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { TicketPriority } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { cleanDatabase } from "../common/testing/clean-database";
import { PrismaService } from "../database/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { BusinessSchedulesService } from "../sla/business-schedules.service";
import { standardWeekdayNineToFive } from "../sla/domain/schedule.types";
import { SlaPoliciesService } from "../sla/sla-policies.service";
import { CatalogCategoriesService } from "./catalog-categories.service";
import { CatalogRequestsService } from "./catalog-requests.service";
import { CatalogServicesService } from "./catalog-services.service";

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration("Service Catalog Integration Tests", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let categoriesService: CatalogCategoriesService;
  let servicesService: CatalogServicesService;
  let requestsService: CatalogRequestsService;
  let schedulesService: BusinessSchedulesService;
  let policiesService: SlaPoliciesService;

  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let approverId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    categoriesService = moduleRef.get(CatalogCategoriesService);
    servicesService = moduleRef.get(CatalogServicesService);
    requestsService = moduleRef.get(CatalogRequestsService);
    schedulesService = moduleRef.get(BusinessSchedulesService);
    policiesService = moduleRef.get(SlaPoliciesService);
    const rbacService = moduleRef.get(RbacService);
    vi.spyOn(rbacService, "can").mockResolvedValue(true);
  });

  afterAll(async () => {
    if (prisma) {
      await cleanDatabase(prisma);
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    const t1 = await prisma.tenant.create({
      data: {
        slug: `cat-t1-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: "Catalog Tenant 1",
      },
    });
    tenant1Id = t1.id;

    const t2 = await prisma.tenant.create({
      data: {
        slug: `cat-t2-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: "Catalog Tenant 2",
      },
    });
    tenant2Id = t2.id;

    const u1 = await prisma.user.create({
      data: {
        email: `cat-u1-${Date.now()}@example.com`,
        emailNormalized: `cat-u1-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    user1Id = u1.id;

    const approver = await prisma.user.create({
      data: {
        email: `cat-appr-${Date.now()}@example.com`,
        emailNormalized: `cat-appr-${Date.now()}@example.com`,
        passwordHash: "hash",
        state: "ACTIVE",
      },
    });
    approverId = approver.id;
  });

  it("supports category/service lifecycle, approval-gated request flow, ticket generation with pinned SLA, outbox events, and tenant isolation", async () => {
    // 1. Category tree
    const rootCat = await categoriesService.createCategory(
      tenant1Id,
      { name: "IT Services" },
      user1Id,
    );
    expect(rootCat.slug).toBe("it-services");

    const softwareCat = await categoriesService.createCategory(
      tenant1Id,
      { name: "Software", parentId: rootCat.id },
      user1Id,
    );
    expect(softwareCat.parentId).toBe(rootCat.id);

    // 2. Publish a default schedule + SLA policy (needed for pinned SLA targets)
    const schedule = await schedulesService.create({
      actorUserId: user1Id,
      name: "Default",
      tenantId: tenant1Id,
      timeZone: "UTC",
      weeklyHours: standardWeekdayNineToFive(),
    });
    await schedulesService.publish(tenant1Id, schedule!.id, user1Id);
    const policy = await policiesService.create({
      actorUserId: user1Id,
      key: "catalog-default",
      name: "Catalog Default SLA",
      priority: 100,
      resolutionMinutes: 240,
      responseMinutes: 60,
      tenantId: tenant1Id,
    });
    await policiesService.publish(tenant1Id, policy!.id, user1Id);

    // 3. Create a service with a form, approval step, and pinned SLA policy
    const service = await servicesService.createService(
      tenant1Id,
      {
        categoryId: softwareCat.id,
        name: "Software License Request",
        description: "Request a software license",
        kind: "TECHNICAL",
        approvalMode: "ALL",
        approvalSteps: [{ ordinal: 1, approverRole: "manager", approverUserId: approverId }],
        slaPolicyId: policy!.id,
        defaultTicketType: "FEATURE_REQUEST",
        defaultPriority: TicketPriority.MEDIUM,
        suggestedKbTags: ["software", "licensing"],
        formSchema: {
          fields: [
            {
              key: "software",
              label: "Software",
              type: "SELECT",
              required: true,
              options: ["word", "excel"],
            },
            {
              key: "license_count",
              label: "License count",
              type: "NUMBER",
              required: true,
              validation: { min: 1, max: 500 },
            },
            { key: "justification", label: "Justification", type: "TEXTAREA", required: false },
          ],
        },
      },
      user1Id,
    );
    expect(service.slug).toBe("software-license-request");
    expect(service.state).toBe("DRAFT");
    expect(service.form?.formVersion).toBe(1);

    // 4. Publish the service
    const published = await servicesService.publishService(
      tenant1Id,
      service.id,
      user1Id,
      undefined,
      "PUBLISHED",
    );
    expect(published.state).toBe("PUBLISHED");

    // 5. Published list only shows published services
    const publishedList = await servicesService.listPublishedServices(tenant1Id);
    expect(publishedList.map((item) => item.id)).toContain(service.id);

    // 6. Submit a request -> AWAITING_APPROVAL with an approval step
    const request = await requestsService.submit(
      { tenantId: tenant1Id, userId: user1Id },
      {
        serviceId: service.id,
        answers: { software: "word", license_count: 25, justification: "Team needs it" },
        priority: TicketPriority.HIGH,
      },
    );
    expect(request.status).toBe("AWAITING_APPROVAL");
    expect(request.requestRef).toMatch(/^REQ-\d{6}$/);
    expect(request.approvals).toHaveLength(1);
    expect(request.approvals?.[0]?.approverUserId).toBe(approverId);

    // Approval gate not satisfied yet
    await expect(
      requestsService.startFulfillment({ tenantId: tenant1Id, userId: user1Id }, request.id),
    ).rejects.toThrow();

    // 7. Approve the request (the assigned approver decides)
    const approvalId = request.approvals![0]!.id;
    const approved = await requestsService.decideApproval(
      { tenantId: tenant1Id, userId: approverId },
      request.id,
      approvalId,
      { decision: "APPROVED", comment: "Approved" },
    );
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedAt).toBeDefined();

    // 8. Start fulfillment -> auto-generates a ticket
    const fulfilled = await requestsService.startFulfillment(
      { tenantId: tenant1Id, userId: user1Id },
      request.id,
    );
    expect(fulfilled.status).toBe("IN_FULFILLMENT");
    expect(fulfilled.ticketId).toBeDefined();

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: fulfilled.ticketId! },
    });
    expect(ticket.title).toContain(request.requestRef);
    expect(ticket.priority).toBe("HIGH");

    // 9. SLA targets were pinned from the service's policy
    const targets = await prisma.slaTarget.findMany({
      where: { tenantId: tenant1Id, ticketId: ticket.id },
    });
    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.type).sort()).toEqual(["RESOLUTION", "RESPONSE"]);

    // 10. Outbox events recorded
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { tenantId: tenant1Id, aggregateId: request.id },
      orderBy: { createdAt: "asc" },
    });
    const eventTypes = outboxEvents.map((event) => event.eventType);
    expect(eventTypes).toContain("service_request.created");
    expect(eventTypes).toContain("service_request.approval_started");
    expect(eventTypes).toContain("service_request.approval_decided");
    expect(eventTypes).toContain("service_request.fulfillment_started");
    expect(eventTypes).toContain("service_request.ticket_created");

    // Ticket creation also emitted the canonical ticket.created event
    const ticketEvents = await prisma.outboxEvent.findMany({
      where: { tenantId: tenant1Id, aggregateType: "ticket", aggregateId: ticket.id },
    });
    expect(ticketEvents.some((event) => event.eventType === "ticket.created")).toBe(true);

    // 11. Notifications were created for requester and approver
    const notifications = await prisma.notification.findMany({
      where: { tenantId: tenant1Id, resourceId: request.id },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(2);
    expect(
      notifications.some(
        (notification) =>
          notification.eventType === "REQUEST_APPROVAL_REQUIRED" &&
          notification.recipientUserId === approverId,
      ),
    ).toBe(true);
    expect(
      notifications.some(
        (notification) =>
          notification.eventType === "REQUEST_APPROVAL_DECIDED" &&
          notification.recipientUserId === user1Id,
      ),
    ).toBe(true);

    // 12. Complete the request
    const completed = await requestsService.complete(
      { tenantId: tenant1Id, userId: user1Id },
      request.id,
      "Delivered",
    );
    expect(completed.status).toBe("COMPLETED");

    // 13. History recorded transitions
    const history = await requestsService.listHistory(
      { tenantId: tenant1Id, userId: user1Id },
      request.id,
    );
    const actions = history.map((entry) => entry.action);
    expect(actions).toContain("catalog.request.submitted");
    expect(actions).toContain("catalog.request.approved");
    expect(actions).toContain("catalog.request.fulfillment_started");
    expect(actions).toContain("catalog.request.ticket_created");
    expect(actions).toContain("catalog.request.completed");

    // 14. Audit events logged (ticket creation is audited against the ticket itself)
    const audits = await prisma.auditEvent.findMany({
      where: { tenantId: tenant1Id, targetType: "service_request" },
    });
    const auditActions = audits.map((audit) => audit.action);
    expect(auditActions).toContain("catalog.request.submitted");
    expect(auditActions).toContain("catalog.approval.decided");
    expect(auditActions).toContain("catalog.request.fulfillment_started");
    expect(auditActions).toContain("catalog.request.completed");

    const ticketAudits = await prisma.auditEvent.findMany({
      where: { tenantId: tenant1Id, targetType: "ticket", targetId: ticket.id },
    });
    expect(ticketAudits.some((audit) => audit.action === "catalog.request.ticket_created")).toBe(
      true,
    );

    // 15. Tenant isolation negatives
    await expect(categoriesService.getCategory(tenant2Id, softwareCat.id)).rejects.toThrow();
    await expect(servicesService.getService(tenant2Id, service.id)).rejects.toThrow();
    await expect(
      requestsService.getRequest({ tenantId: tenant2Id, userId: user1Id }, request.id),
    ).rejects.toThrow();

    const tenant2List = await requestsService.listRequests(
      { tenantId: tenant2Id, userId: user1Id },
      "all",
      { page: 1, pageSize: 10 },
    );
    expect(tenant2List.totalRecords).toBe(0);
  });

  it("supports KB article suggestions and answer updates on CHANGES_REQUESTED requests", async () => {
    // 1. Seed a KB article that matches the service tags
    const category = await categoriesService.createCategory(
      tenant1Id,
      { name: "Catalog" },
      user1Id,
    );
    const service = await servicesService.createService(
      tenant1Id,
      {
        categoryId: category.id,
        name: "VPN Access Request",
        suggestedKbTags: ["vpn"],
        approvalMode: "SINGLE",
        approvalSteps: [{ ordinal: 1, approverRole: "manager", approverUserId: approverId }],
        formSchema: { fields: [{ key: "region", label: "Region", type: "TEXT", required: true }] },
      },
      user1Id,
    );
    await servicesService.publishService(tenant1Id, service.id, user1Id, undefined, "PUBLISHED");

    await prisma.kbCategory.create({
      data: {
        tenantId: tenant1Id,
        name: "Network",
        slug: "network",
      },
    });
    const kbCategory = await prisma.kbCategory.findFirstOrThrow({
      where: { tenantId: tenant1Id, slug: "network" },
    });
    const article = await prisma.kbArticle.create({
      data: {
        tenantId: tenant1Id,
        categoryId: kbCategory.id,
        authorId: user1Id,
        title: "Connecting to the VPN",
        slug: "connecting-to-the-vpn",
        content: "Use the VPN client",
        summary: "How to connect",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        versionNumber: 1,
      },
    });
    const vpnTag = await prisma.kbTag.create({
      data: { tenantId: tenant1Id, name: "vpn", slug: "vpn" },
    });
    await prisma.kbArticleTag.create({
      data: { articleId: article.id, tagId: vpnTag.id },
    });

    // 2. Suggestions resolve for the service
    const suggestions = await servicesService.suggestions(tenant1Id, service.id, true, 5);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0]?.title).toContain("VPN");

    // 3. Submit a request then request changes back and update answers
    const request = await requestsService.submit(
      { tenantId: tenant1Id, userId: user1Id },
      { serviceId: service.id, answers: { region: "us-east" } },
    );
    expect(request.status).toBe("AWAITING_APPROVAL");

    await requestsService.decideApproval(
      { tenantId: tenant1Id, userId: user1Id },
      request.id,
      request.approvals![0]!.id,
      { decision: "CHANGES_REQUESTED", comment: "Pick another region" },
    );

    const updated = await requestsService.updateAnswers(
      { tenantId: tenant1Id, userId: user1Id },
      request.id,
      { answers: { region: "eu-west" }, note: "Changed region" },
    );
    expect(updated.status).toBe("AWAITING_APPROVAL");
    expect(updated.answers).toMatchObject({ region: "eu-west" });

    // Approval cycle was reset with a fresh pending step
    const freshApprovals = await prisma.serviceRequestApproval.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: "asc" },
    });
    expect(freshApprovals[freshApprovals.length - 1]?.status).toBe("PENDING");
  });

  it("enforces service state rules (default form on creation, cannot delete with requests)", async () => {
    const category = await categoriesService.createCategory(tenant1Id, { name: "Empty" }, user1Id);

    const service = await servicesService.createService(
      tenant1Id,
      { categoryId: category.id, name: "No Form Service" },
      user1Id,
    );

    // Services always receive a default request form, so publication succeeds
    expect(service.form?.formVersion).toBe(1);
    await expect(
      servicesService.publishService(tenant1Id, service.id, user1Id, undefined, "PUBLISHED"),
    ).resolves.toMatchObject({ state: "PUBLISHED" });

    // A submitted request blocks deletion
    const request = await requestsService.submit(
      { tenantId: tenant1Id, userId: user1Id },
      { serviceId: service.id, answers: { details: "please help" } },
    );
    expect(request.status).toBe("SUBMITTED");
    await expect(servicesService.deleteService(tenant1Id, service.id, user1Id)).rejects.toThrow();
    await expect(servicesService.getService(tenant1Id, service.id)).resolves.toBeDefined();

    // The requester can cancel their own request
    const cancelled = await requestsService.cancel(
      { tenantId: tenant1Id, userId: user1Id },
      request.id,
      { reason: "No longer needed" },
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledReason).toBe("No longer needed");
    expect(cancelled.cancelledAt).toBeDefined();

    const cancelEvents = await prisma.outboxEvent.findMany({
      where: {
        tenantId: tenant1Id,
        aggregateId: request.id,
        eventType: "service_request.cancelled",
      },
    });
    expect(cancelEvents).toHaveLength(1);

    // Self-service cancellation suppresses the in-app notification (actor == recipient)
    const cancelNotifications = await prisma.notification.findMany({
      where: { tenantId: tenant1Id, resourceId: request.id, eventType: "REQUEST_CANCELLED" },
    });
    expect(cancelNotifications).toHaveLength(0);

    const cancelAudits = await prisma.auditEvent.findMany({
      where: { tenantId: tenant1Id, targetId: request.id, action: "catalog.request.cancelled" },
    });
    expect(cancelAudits).toHaveLength(1);
  });
});
