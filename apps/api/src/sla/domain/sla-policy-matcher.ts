import type { TicketChannel, TicketPriority, TicketType } from "@prisma/client";

export interface SlaMatchTicketAttributes {
  channel: TicketChannel;
  priority: TicketPriority;
  type: TicketType;
}

export interface SlaPolicyMatchCandidate {
  id: string;
  matchChannels: string[];
  matchPriorities: string[];
  matchTypes: string[];
  priority: number;
}

/**
 * First matching published policy by ascending unique priority.
 * Empty match arrays mean "match all" for that attribute.
 */
export function selectMatchingSlaPolicy<T extends SlaPolicyMatchCandidate>(
  candidates: T[],
  ticket: SlaMatchTicketAttributes,
): T | null {
  const ordered = [...candidates].sort((a, b) => a.priority - b.priority);

  for (const candidate of ordered) {
    if (!matchesList(candidate.matchPriorities, ticket.priority)) {
      continue;
    }
    if (!matchesList(candidate.matchTypes, ticket.type)) {
      continue;
    }
    if (!matchesList(candidate.matchChannels, ticket.channel)) {
      continue;
    }
    return candidate;
  }

  return null;
}

function matchesList(allowed: string[], value: string): boolean {
  if (allowed.length === 0) {
    return true;
  }
  return allowed.includes(value);
}
