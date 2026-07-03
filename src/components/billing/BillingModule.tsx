import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillingListPanel } from './BillingListPanel';
import { PartiesPanel } from './PartiesPanel';
import { CompanySettingsPanel } from './CompanySettingsPanel';

export function BillingModule() {
  return (
    <Tabs defaultValue="documents" className="space-y-4">
      <TabsList>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="parties">Parties</TabsTrigger>
        <TabsTrigger value="settings">Company Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="documents"><BillingListPanel /></TabsContent>
      <TabsContent value="parties"><PartiesPanel /></TabsContent>
      <TabsContent value="settings"><CompanySettingsPanel /></TabsContent>
    </Tabs>
  );
}
