'use client';

import { useI18n } from '@/lib/i18n/provider';
import { TicketListViewWithSuspense } from '@/components/ticket-list-view';

export default function AgentQueuePage() {
  const { t } = useI18n();
  return <TicketListViewWithSuspense title={t("nav.queue")} preset={{ status: "OPEN" }} />;
}
