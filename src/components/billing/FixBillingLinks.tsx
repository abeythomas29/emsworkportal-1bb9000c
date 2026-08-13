import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function FixBillingLinks() {
  useEffect(() => {
    async function runFix() {
      const fixes = [
        { doc_num: 'EST-26-27-14', target_id: '339aa2cd-76df-4898-bba8-8715422f20d9' },
        { doc_num: 'EST-26-27-12', target_id: 'cbbbe4fa-bed6-4198-889b-d717dbf92b3b' },
        { doc_num: 'EST-26-27-13', target_id: 'd13a114d-ab4c-4fe9-9147-b69b43b2b6b1' }
      ];

      for (const fix of fixes) {
        const { error } = await supabase
          .from('billing_documents')
          .update({ converted_to_id: fix.target_id, status: 'finalized' } as any)
          .eq('doc_number', fix.doc_num)
          .is('converted_to_id', null);
        
        if (error) {
          console.error(`Error fixing ${fix.doc_num}:`, error);
        } else {
          console.log(`Fixed ${fix.doc_num}`);
        }
      }
      toast.success('Billing links fixed');
    }
    
    runFix();
  }, []);

  return null;
}
