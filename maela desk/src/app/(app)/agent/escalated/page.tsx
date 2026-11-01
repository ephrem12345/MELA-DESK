'use client';

import { useI18n } from '@/lib/i18n/provider';
import { TicketListViewWithSuspense } from '@/components/ticket-list-view';

export default function EscalatedPage() {
  const { t } = useI18n();
  return <TicketListViewWithSuspense title={t("nav.escalated")} preset={{ priority: "URGENT" }} />;
}
