const BUDGETS: Record<string, number> = {
  '/api/check': 3000,
  '/api/alerts': 500,
  '/admin': 1000,
};

export function checkBudget(
  endpoint: string,
  durationMs: number
): { exceeded: boolean; budget: number } {
  const budget =
    Object.entries(BUDGETS).find(([prefix]) => endpoint.startsWith(prefix))?.[1] ?? 5000;
  return { exceeded: durationMs > budget, budget };
}
