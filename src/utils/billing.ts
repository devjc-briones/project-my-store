import { Roles, Store, SubscriptionTransaction, User } from '../types/schema';

export function hasPendingSubscriptionPayment(
  userId: string,
  transactions: SubscriptionTransaction[] = []
): boolean {
  return transactions.some((tx) => tx.userId === userId && tx.status === 'pending');
}

export function isUserPlanPastDue(user: User | null | undefined): boolean {
  if (!user || user.role === Roles.Admin) return false;
  if (user.plan === 'starter') return false;
  if (user.cancelAtPeriodEnd) return false;
  if (!user.planPeriodEndsAt) return false;

  const dueMs = new Date(user.planPeriodEndsAt).getTime();
  if (Number.isNaN(dueMs)) return false;

  return Date.now() >= dueMs;
}

export function isUserPlanUnpaidDue(
  user: User | null | undefined,
  transactions: SubscriptionTransaction[] = []
): boolean {
  if (!user || !isUserPlanPastDue(user)) return false;
  return !hasPendingSubscriptionPayment(user.id, transactions);
}

export function isStoreTemporarilyClosedByBilling(
  store: Store,
  owner: User | null | undefined
): boolean {
  return store.status === 'published' && isUserPlanPastDue(owner);
}
