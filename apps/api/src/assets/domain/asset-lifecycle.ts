import { AssetLifecycleState } from "@prisma/client";

export const ASSET_LIFECYCLE_STATES: AssetLifecycleState[] = [
  AssetLifecycleState.DRAFT,
  AssetLifecycleState.IN_STOCK,
  AssetLifecycleState.ASSIGNED,
  AssetLifecycleState.IN_REPAIR,
  AssetLifecycleState.RETIRED,
  AssetLifecycleState.DISPOSED,
  AssetLifecycleState.LOST,
  AssetLifecycleState.ARCHIVED,
];

export const ASSET_TERMINAL_STATES: AssetLifecycleState[] = [
  AssetLifecycleState.RETIRED,
  AssetLifecycleState.DISPOSED,
  AssetLifecycleState.LOST,
  AssetLifecycleState.ARCHIVED,
];

/**
 * Allowed lifecycle transitions for an asset.
 *
 * - Draft assets can be moved to stock or disposed directly.
 * - In-stock assets enter service (assigned), repair, or retirement.
 * - Assigned assets can be moved back to stock, into repair, or retired.
 * - In-repair assets return to stock or assigned, or are retired/disposed.
 * - Terminal states (retired, disposed, lost, archived) accept a limited
 *   set of recovery/restoration moves; archived is the archival endpoint.
 */
const TRANSITIONS: Record<AssetLifecycleState, AssetLifecycleState[]> = {
  [AssetLifecycleState.DRAFT]: [
    AssetLifecycleState.IN_STOCK,
    AssetLifecycleState.ASSIGNED,
    AssetLifecycleState.DISPOSED,
    AssetLifecycleState.ARCHIVED,
  ],
  [AssetLifecycleState.IN_STOCK]: [
    AssetLifecycleState.ASSIGNED,
    AssetLifecycleState.IN_REPAIR,
    AssetLifecycleState.RETIRED,
    AssetLifecycleState.DISPOSED,
    AssetLifecycleState.LOST,
    AssetLifecycleState.ARCHIVED,
  ],
  [AssetLifecycleState.ASSIGNED]: [
    AssetLifecycleState.IN_STOCK,
    AssetLifecycleState.IN_REPAIR,
    AssetLifecycleState.RETIRED,
    AssetLifecycleState.DISPOSED,
    AssetLifecycleState.LOST,
    AssetLifecycleState.ARCHIVED,
  ],
  [AssetLifecycleState.IN_REPAIR]: [
    AssetLifecycleState.IN_STOCK,
    AssetLifecycleState.ASSIGNED,
    AssetLifecycleState.RETIRED,
    AssetLifecycleState.DISPOSED,
    AssetLifecycleState.LOST,
    AssetLifecycleState.ARCHIVED,
  ],
  [AssetLifecycleState.RETIRED]: [
    AssetLifecycleState.ARCHIVED,
    AssetLifecycleState.IN_STOCK,
    AssetLifecycleState.DISPOSED,
  ],
  [AssetLifecycleState.DISPOSED]: [AssetLifecycleState.ARCHIVED],
  [AssetLifecycleState.LOST]: [AssetLifecycleState.IN_STOCK, AssetLifecycleState.ARCHIVED],
  [AssetLifecycleState.ARCHIVED]: [],
};

export function isAllowedAssetTransition(
  from: AssetLifecycleState,
  to: AssetLifecycleState,
): boolean {
  if (from === to) {
    return false;
  }
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertAllowedAssetTransition(
  from: AssetLifecycleState,
  to: AssetLifecycleState,
): void {
  if (!isAllowedAssetTransition(from, to)) {
    throw new Error(`Asset lifecycle transition from ${from} to ${to} is not allowed`);
  }
}

export function isTerminalAssetState(state: AssetLifecycleState): boolean {
  return ASSET_TERMINAL_STATES.includes(state);
}
