import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientSuggestion {
  name: string;
  phone: string | null;
  source: 'party' | 'parcel';
}

export function useClientSuggestions() {
  return useQuery({
    queryKey: ['client-suggestions'],
    queryFn: async () => {
      const [partiesRes, parcelsRes] = await Promise.all([
        supabase.from('parties').select('name, phone').order('name'),
        supabase
          .from('parcels')
          .select('client_name, client_phone')
          .not('client_name', 'is', null),
      ]);
      if (partiesRes.error) throw partiesRes.error;
      if (parcelsRes.error) throw parcelsRes.error;

      const map = new Map<string, ClientSuggestion>();
      for (const p of partiesRes.data ?? []) {
        if (!p.name) continue;
        const key = p.name.trim().toLowerCase();
        if (!key) continue;
        map.set(key, { name: p.name.trim(), phone: p.phone?.trim() || null, source: 'party' });
      }
      for (const p of parcelsRes.data ?? []) {
        const name = (p.client_name || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const existing = map.get(key);
        // Prefer party entry; fill missing phone from parcels
        if (existing) {
          if (!existing.phone && p.client_phone) existing.phone = p.client_phone.trim();
        } else {
          map.set(key, { name, phone: p.client_phone?.trim() || null, source: 'parcel' });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 60_000,
  });
}
