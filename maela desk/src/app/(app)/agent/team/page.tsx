'use client';

import { useI18n } from '@/lib/i18n/provider';
import { PageHeader } from '@/components/admin-shared';
import { TicketListViewWithSuspense } from '@/components/ticket-list-view';

export default function AgentTeamPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.agentTeam')} />
      <TicketListViewWithSuspense />
    </div>
  );
}
