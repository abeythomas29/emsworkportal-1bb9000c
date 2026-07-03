import { useState } from 'react';
import { BillingListPanel } from './BillingListPanel';
import { PartiesPanel } from './PartiesPanel';
import { CompanySettingsPanel } from './CompanySettingsPanel';
import { cn } from '@/lib/utils';

type SubTab = 'documents' | 'parties' | 'settings';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'documents', label: 'Documents' },
  { id: 'parties', label: 'Parties' },
  { id: 'settings', label: 'Company Settings' },
];

export function BillingModule() {
  const [tab, setTab] = useState<SubTab>('documents');

  return (
    <div className="space-y-6">
      <nav
        role="tablist"
        aria-label="Billing sections"
        className="flex items-center gap-6 md:gap-8 border-b border-border/60 overflow-x-auto scrollbar-hide"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative pb-3 -mb-px text-sm font-semibold uppercase tracking-wider whitespace-nowrap transition-colors min-h-11',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                active
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div>
        {tab === 'documents' && <BillingListPanel />}
        {tab === 'parties' && <PartiesPanel />}
        {tab === 'settings' && <CompanySettingsPanel />}
      </div>
    </div>
  );
}
