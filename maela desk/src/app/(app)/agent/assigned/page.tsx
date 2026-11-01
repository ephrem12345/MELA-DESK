'use client';

import { useI18n } from '@/lib/i18n/provider';
import { TicketListViewWithSuspense } from '@/components/ticket-list-view';

export default function AgentAssignedPage() {
  const { t } = useI18n();
  return <TicketListViewWithSuspense title={t("nav.assigned")} />;
}
