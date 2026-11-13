// "What are these failed payments?": turns the failed Mollie payments plus what
// we know about each donor into one plain row per payment. Pure: no DOM, no
// network, no clock of its own (the caller passes `now`).

const DAY_MS = 86_400_000;
const FIRST_REMINDER_DAYS = 3;

export type FailedKind = 'monthly-charge' | 'abandoned-checkout';
export type EmailStatus = 'sent-day-3' | 'sent-day-7' | 'switched-off' | 'not-due-yet' | 'not-sent' | 'not-applicable';
export type FixedStatus = 'paid-since' | 'cancelled' | 'still-unpaid';

export interface FailedPaymentInput {
  paymentId: string;
  customerId: string;
  donorName: string;
  email: string;
  amount: number;
  currency: string;
  gateway: string;
  sequenceType: string;
  status: 'failed' | 'expired';
  failedAt: string;
  reason?: string;
}

export interface FailedStatusContext {
  paidTimesByCustomer: ReadonlyMap<string, readonly string[]>;
  /** Entries look like `${paymentId}:3` or `${paymentId}:7`. */
  sentStages: ReadonlySet<string>;
  cancelledCustomerIds: ReadonlySet<string>;
  remindersEnabled: boolean;
  now: Date;
}

export interface FailedStatusRow {
  paymentId: string;
  kind: FailedKind;
  kindLabel: string;
  donor: string;
  email: string;
  amount: number;
  currency: string;
  gateway: string;
  failedAt: string;
  emailStatus: EmailStatus;
  fixedStatus: FixedStatus;
}

export interface FailedStatusSummary { total: number; fixed: number; stillUnpaid: number; emailed: number }
export interface FailedStatusResult { rows: FailedStatusRow[]; summary: FailedStatusSummary }

const KIND_LABEL: Record<FailedKind, string> = {
  'monthly-charge': 'Failed monthly charge',
  'abandoned-checkout': 'Left checkout, never a monthly donor',
};

function emailStatusOf(payment: FailedPaymentInput, kind: FailedKind, ctx: FailedStatusContext): EmailStatus {
  if (kind === 'abandoned-checkout') return 'not-applicable';
  if (ctx.sentStages.has(`${payment.paymentId}:7`)) return 'sent-day-7';
  if (ctx.sentStages.has(`${payment.paymentId}:3`)) return 'sent-day-3';
  if (!ctx.remindersEnabled) return 'switched-off';
  const ageDays = (ctx.now.getTime() - new Date(payment.failedAt).getTime()) / DAY_MS;
  return ageDays < FIRST_REMINDER_DAYS ? 'not-due-yet' : 'not-sent';
}

function fixedStatusOf(payment: FailedPaymentInput, ctx: FailedStatusContext): FixedStatus {
  const paidTimes = ctx.paidTimesByCustomer.get(payment.customerId) ?? [];
  if (paidTimes.some((t) => t > payment.failedAt)) return 'paid-since';
  if (ctx.cancelledCustomerIds.has(payment.customerId)) return 'cancelled';
  return 'still-unpaid';
}

function toRow(payment: FailedPaymentInput, ctx: FailedStatusContext): FailedStatusRow {
  const kind: FailedKind = payment.sequenceType === 'recurring' ? 'monthly-charge' : 'abandoned-checkout';
  return {
    paymentId: payment.paymentId,
    kind,
    kindLabel: KIND_LABEL[kind],
    donor: payment.donorName || payment.email || 'Unknown donor',
    email: payment.email,
    amount: payment.amount,
    currency: payment.currency,
    gateway: payment.gateway,
    failedAt: payment.failedAt,
    emailStatus: emailStatusOf(payment, kind, ctx),
    fixedStatus: fixedStatusOf(payment, ctx),
  };
}

const unpaidFirst = (a: FailedStatusRow, b: FailedStatusRow): number => {
  const aUnpaid = a.fixedStatus === 'still-unpaid' ? 0 : 1;
  const bUnpaid = b.fixedStatus === 'still-unpaid' ? 0 : 1;
  if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
  return b.failedAt.localeCompare(a.failedAt);
};

export function buildFailedStatus(payments: readonly FailedPaymentInput[], ctx: FailedStatusContext): FailedStatusResult {
  const rows = payments.map((p) => toRow(p, ctx)).sort(unpaidFirst);
  return {
    rows,
    summary: {
      total: rows.length,
      fixed: rows.filter((r) => r.fixedStatus === 'paid-since').length,
      stillUnpaid: rows.filter((r) => r.fixedStatus === 'still-unpaid').length,
      emailed: rows.filter((r) => r.emailStatus === 'sent-day-3' || r.emailStatus === 'sent-day-7').length,
    },
  };
}
