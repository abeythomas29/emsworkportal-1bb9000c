import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, UserPlus, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useClientSuggestions, ClientSuggestion } from '@/hooks/useClientSuggestions';

interface Props {
  value: string;
  onChange: (name: string, phone?: string | null) => void;
  placeholder?: string;
}

export function ClientNameCombobox({ value, onChange, placeholder = 'Search or add client…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: suggestions, isLoading } = useClientSuggestions();

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (suggestions ?? []).some((s) => s.name.toLowerCase() === q);
  }, [suggestions, query]);

  const select = (s: ClientSuggestion) => {
    onChange(s.name, s.phone);
    setOpen(false);
    setQuery('');
  };

  const addNew = () => {
    const name = query.trim();
    if (!name) return;
    onChange(name, null);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search clients…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <CommandEmpty>No matching clients.</CommandEmpty>
                <CommandGroup>
                  {(suggestions ?? []).map((s) => (
                    <CommandItem
                      key={`${s.source}-${s.name}`}
                      value={s.name}
                      onSelect={() => select(s)}
                    >
                      <Check
                        className={cn('mr-2 w-4 h-4', value === s.name ? 'opacity-100' : 'opacity-0')}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{s.name}</span>
                        {s.phone && (
                          <span className="text-xs text-muted-foreground truncate">{s.phone}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {query.trim() && !hasExactMatch && (
                  <CommandGroup heading="New">
                    <CommandItem value={`__add__${query}`} onSelect={addNew}>
                      <UserPlus className="mr-2 w-4 h-4" />
                      Add "{query.trim()}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
