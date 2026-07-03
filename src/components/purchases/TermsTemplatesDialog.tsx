import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Pencil, Plus, FileText, Loader2 } from 'lucide-react';
import { usePOTermTemplates, type POTermTemplate } from '@/hooks/usePOTermTemplates';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function TermsTemplatesDialog({ open, onOpenChange }: Props) {
  const { templates, isLoading, saveTemplate, deleteTemplate, isSaving } = usePOTermTemplates();
  const [editing, setEditing] = useState<Partial<POTermTemplate> | null>(null);

  const startNew = () => setEditing({ name: '', content: '', is_default: false });

  const handleSave = async () => {
    if (!editing?.name?.trim() || !editing?.content?.trim()) return;
    await saveTemplate({
      id: editing.id,
      name: editing.name.trim(),
      content: editing.content,
      is_default: !!editing.is_default,
    });
    setEditing(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditing(null); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Terms &amp; Conditions Templates
          </DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="space-y-3 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label>Template name</Label>
              <Input
                value={editing.name ?? ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Standard Purchase Terms"
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <p className="text-xs text-muted-foreground">
                Separate clauses with a blank line. Each paragraph prints as a numbered item on the PDF.
              </p>
              <Textarea
                rows={16}
                value={editing.content ?? ''}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                className="font-mono text-xs"
                placeholder={'Clause 1: ...\n\nClause 2: ...'}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={!!editing.is_default}
                onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
              />
              <Label>Use as default for new POs</Label>
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing.id ? 'Save changes' : 'Create template'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {templates.length} template{templates.length === 1 ? '' : 's'}
              </p>
              <Button size="sm" onClick={startNew} className="gap-2">
                <Plus className="w-4 h-4" /> New template
              </Button>
            </div>
            <ScrollArea className="flex-1 border border-border rounded-lg">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No templates yet. Create one to reuse across POs.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {templates.map((t) => (
                    <li key={t.id} className="p-4 flex items-start justify-between gap-4 hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.name}</span>
                          {t.is_default && (
                            <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px] uppercase">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
                          {t.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing(t)}
                          aria-label={`Edit ${t.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete template "${t.name}"?`)) deleteTemplate(t.id);
                          }}
                          aria-label={`Delete ${t.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
