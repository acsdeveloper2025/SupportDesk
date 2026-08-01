export const PLATFORM_HARD_MAX_AUTOMATION_DEPTH = 3;

export interface RecursionBudgetCheckResult {
  isCapped: boolean;
  currentDepth: number;
  maxAllowedDepth: number;
  reason?: string;
}

export function evaluateRecursionBudget(
  automationDepth: number,
  tenantMaxDepthSetting?: number,
): RecursionBudgetCheckResult {
  const effectiveMax =
    typeof tenantMaxDepthSetting === "number" && tenantMaxDepthSetting >= 0
      ? Math.min(tenantMaxDepthSetting, PLATFORM_HARD_MAX_AUTOMATION_DEPTH)
      : PLATFORM_HARD_MAX_AUTOMATION_DEPTH;

  if (automationDepth >= effectiveMax) {
    return {
      isCapped: true,
      currentDepth: automationDepth,
      maxAllowedDepth: effectiveMax,
      reason: `Automation depth ${automationDepth} reached maximum allowed threshold of ${effectiveMax}`,
    };
  }

  return {
    isCapped: false,
    currentDepth: automationDepth,
    maxAllowedDepth: effectiveMax,
  };
}
