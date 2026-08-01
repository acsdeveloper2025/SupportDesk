import { TicketChannel, TicketPriority, TicketType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { selectMatchingSlaPolicy } from "./sla-policy-matcher";

describe("selectMatchingSlaPolicy", () => {
  const candidates = [
    {
      id: "urgent-only",
      matchChannels: [] as string[],
      matchPriorities: [TicketPriority.URGENT],
      matchTypes: [] as string[],
      priority: 10,
    },
    {
      id: "default",
      matchChannels: [] as string[],
      matchPriorities: [] as string[],
      matchTypes: [] as string[],
      priority: 100,
    },
    {
      id: "incident-web",
      matchChannels: [TicketChannel.WEB],
      matchPriorities: [] as string[],
      matchTypes: [TicketType.INCIDENT],
      priority: 20,
    },
  ];

  it("selects the lowest priority number that matches", () => {
    const matched = selectMatchingSlaPolicy(candidates, {
      channel: TicketChannel.WEB,
      priority: TicketPriority.URGENT,
      type: TicketType.QUESTION,
    });
    expect(matched?.id).toBe("urgent-only");
  });

  it("falls through to broader matches", () => {
    const matched = selectMatchingSlaPolicy(candidates, {
      channel: TicketChannel.WEB,
      priority: TicketPriority.MEDIUM,
      type: TicketType.INCIDENT,
    });
    expect(matched?.id).toBe("incident-web");
  });

  it("uses the catch-all when nothing else matches", () => {
    const matched = selectMatchingSlaPolicy(candidates, {
      channel: TicketChannel.EMAIL,
      priority: TicketPriority.LOW,
      type: TicketType.QUESTION,
    });
    expect(matched?.id).toBe("default");
  });

  it("returns null when no published policy matches", () => {
    const matched = selectMatchingSlaPolicy(
      [
        {
          id: "urgent",
          matchChannels: [],
          matchPriorities: [TicketPriority.URGENT],
          matchTypes: [],
          priority: 1,
        },
      ],
      {
        channel: TicketChannel.WEB,
        priority: TicketPriority.LOW,
        type: TicketType.QUESTION,
      },
    );
    expect(matched).toBeNull();
  });
});
