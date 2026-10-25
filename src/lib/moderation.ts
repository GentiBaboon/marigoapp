/**
 * Member safety in conversations: reporting and blocking (App Store
 * guideline 1.2, user-generated content).
 *
 * Everything here is pure, so the thread page, the report dialog and
 * /admin/moderation agree on the vocabulary and the document shape. The
 * enforcement is in firestore.rules (`blockedBetween()` and the `reports`
 * create rule); this module only builds what those rules accept.
 *
 * - A report is a `reports/{id}` document, always created `pending`, in the
 *   reporter's own name, about someone else. Moderators work it from
 *   /admin/moderation.
 * - A block is `users/{blocker}/blocks/{blocked}`. It stops both sides of a
 *   two-person thread from writing, and stops either opening a new one. The
 *   blocked member is not told.
 */

export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or threats' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual or inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'off_platform', label: 'Asking to pay or meet outside Marigo' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/** Mirrors the `details` size cap in the `reports` create rule. */
export const REPORT_DETAILS_MAX = 1000;

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

/** Label for a stored reason. Reports filed before this module stored free text, so unknown values pass through. */
export function reportReasonLabel(value: string | undefined | null): string {
  if (!value) return 'No reason given';
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

export interface UserReportInput {
  reporterId: string;
  reportedUserId: string;
  conversationId?: string;
  reason: ReportReason;
  details?: string;
}

/**
 * The fields of a report about another member, minus `createdAt` (the caller
 * adds a server timestamp). Throws on input the rules would refuse, so the
 * dialog can say why rather than surfacing a bare permission error.
 */
export function buildUserReport(input: UserReportInput) {
  if (!input.reporterId || !input.reportedUserId) throw new Error('Missing who is reporting whom.');
  if (input.reporterId === input.reportedUserId) throw new Error('You cannot report yourself.');
  if (!isReportReason(input.reason)) throw new Error('Choose a reason for the report.');
  const details = (input.details ?? '').trim();
  if (details.length > REPORT_DETAILS_MAX) {
    throw new Error(`Keep the details under ${REPORT_DETAILS_MAX} characters.`);
  }
  return {
    type: 'user' as const,
    itemId: input.reportedUserId,
    reportedUserId: input.reportedUserId,
    reporterId: input.reporterId,
    reason: input.reason,
    status: 'pending' as const,
    source: input.conversationId ? 'conversation' : 'profile',
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(details ? { details } : {}),
  };
}

/** Where `blocker`'s block on `blocked` is stored. */
export function blockPath(blockerId: string, blockedId: string): string {
  return `users/${blockerId}/blocks/${blockedId}`;
}

interface ModeratableConversation {
  participants?: string[];
  participantDetails?: Array<{ userId: string; role?: string }>;
  source?: string;
}

/**
 * Whether the thread offers Report and Block. Not on dispute threads or
 * threads with Marigo staff on them (a member must always be reachable by
 * support, and the rules exempt admins anyway), and only between exactly two
 * people, which is the case the rules enforce.
 */
export function canReportOrBlock(conversation: ModeratableConversation | null | undefined, currentUserId: string | undefined): boolean {
  if (!conversation || !currentUserId) return false;
  if (conversation.source === 'dispute') return false;
  const participants = conversation.participants ?? [];
  if (participants.length !== 2 || !participants.includes(currentUserId)) return false;
  const other = conversation.participantDetails?.find((p) => p.userId !== currentUserId);
  return other?.role !== 'admin';
}
