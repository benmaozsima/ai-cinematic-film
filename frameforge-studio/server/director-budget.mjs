import { fail, mutate, now } from './store.mjs';

const money = (value) => Math.round(Number(value || 0) * 10000) / 10000;

export function quoteForPlan(plan) {
  const estimated = money(plan.estimatedCost);
  const repairAllowance = money(Math.max(0.05, estimated * 0.15));
  return {
    currency: 'USD',
    estimated,
    repairAllowance,
    cap: money(estimated + repairAllowance),
    priceSource: 'active model registry',
    verifiedAt: now(),
  };
}

export function authorizationForQuote(quote, cap) {
  const requestedNumber = Number(cap);
  if (!Number.isFinite(requestedNumber) || requestedNumber < 0)
    fail('Enter a valid production budget.', 409);
  const requested = money(requestedNumber);
  if (requested < quote.estimated)
    fail(`Authorize at least $${quote.estimated.toFixed(2)} for this production.`);
  return {
    cap: requested,
    currency: quote.currency,
    reserved: 0,
    committed: 0,
    authorizations: [{ id: crypto.randomUUID(), cap: requested, at: now() }],
    reservations: [],
  };
}

export function authorizeRun(id, runId, cap) {
  return mutate(id, 'director.budget_authorized', (film) => {
    const run = film.concierge?.runs?.find((item) => item.id === runId);
    if (!run) fail('Production run not found.', 404);
    if (run.status !== 'queued') fail('Only a queued production can receive a budget authorization.', 409);
    const quote = run.quote || quoteForPlan(run.plan);
    run.quote = quote;
    run.budget = authorizationForQuote(quote, cap);
    return { runId, cap: run.budget.cap, currency: quote.currency };
  });
}

export function reserveRunTask(id, runId, taskId, amount) {
  if (amount == null || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0)
    fail('Task price is unavailable; this task cannot be submitted automatically.', 409);
  const cost = money(amount);
  return mutate(id, 'director.budget_reserved', (film) => {
    const run = film.concierge?.runs?.find((item) => item.id === runId);
    if (!run?.budget) fail('Authorize the production budget before submitting media.', 409);
    const existing = [...run.budget.reservations].reverse().find((item) => item.taskId === taskId && ['reserved', 'committed'].includes(item.status));
    if (existing) return existing;
    const remaining = money(run.budget.cap - run.budget.reserved - run.budget.committed);
    if (cost > remaining) fail('This task exceeds the authorized production budget.', 409);
    const reservation = { id: crypto.randomUUID(), taskId, amount: cost, status: 'reserved', at: now() };
    run.budget.reservations.push(reservation);
    run.budget.reserved = money(run.budget.reserved + cost);
    return reservation;
  });
}

export function releaseRunTask(id, runId, taskId, reason = 'not_submitted') {
  return mutate(id, 'director.budget_released', (film) => {
    const run = film.concierge?.runs?.find((item) => item.id === runId);
    const reservation = run?.budget?.reservations?.find((item) => item.taskId === taskId && item.status === 'reserved');
    if (!reservation) return { runId, taskId, released: false };
    reservation.status = 'released';
    reservation.reason = reason;
    run.budget.reserved = money(run.budget.reserved - reservation.amount);
    return { runId, taskId, released: true };
  });
}

// A provider result is not an approval, but it does make the reserved amount
// committed: the job was submitted and the result is now preserved locally.
// This transition is idempotent so recovery polling cannot charge twice.
export function commitRunTask(id, runId, taskId, actualCost) {
  if (actualCost == null || actualCost === '' || !Number.isFinite(Number(actualCost)) || Number(actualCost) < 0)
    fail('Actual task cost is unavailable.', 409);
  const actual = money(actualCost);
  return mutate(id, 'director.budget_committed', (film) => {
    const run = film.concierge?.runs?.find((item) => item.id === runId);
    const reservation = [...(run?.budget?.reservations || [])].reverse().find((item) => item.taskId === taskId);
    if (!reservation) fail('Task reservation was not found.', 409);
    if (reservation.status === 'committed') return { ...reservation, alreadyCommitted: true };
    // A local preflight may release a reservation immediately before a safe
    // retry submits the same idempotent task. If the provider result arrives,
    // recover that released generation reservation before committing it.
    if (reservation.status === 'released' && reservation.reason === 'generation_rejected') {
      const remaining = money(run.budget.cap - run.budget.reserved - run.budget.committed);
      if (reservation.amount > remaining) fail('Recovered task exceeds the remaining authorized budget.', 409);
      reservation.status = 'reserved';
      run.budget.reserved = money(run.budget.reserved + reservation.amount);
    }
    if (reservation.status !== 'reserved') fail('Only a reserved task can be committed.', 409);
    if (actual > reservation.amount) fail('Actual task cost exceeds its reserved budget.', 409);
    reservation.status = 'committed';
    reservation.actualCost = actual;
    reservation.committedAt = now();
    run.budget.reserved = money(run.budget.reserved - reservation.amount);
    run.budget.committed = money(run.budget.committed + actual);
    return reservation;
  });
}
