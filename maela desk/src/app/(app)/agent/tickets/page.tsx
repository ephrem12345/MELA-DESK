'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentTicketsIndex() {
  const router = useRouter();
  useEffect(() => router.replace('/agent/assigned'), [router]);
  return null;
}
