'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CornerDownLeft, Mic } from 'lucide-react';
import { interpretUserCommand } from '@/ai/flows/interpret-user-command';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

export function CommandBar() {
  const [command, setCommand] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!command.trim()) return;

    try {
      const result = await interpretUserCommand({
        command,
        availableActions: ['create_invoice', 'find_user', 'show_report'],
      });
      
      toast({
        title: "Command Interpreted Successfully",
        description: (
          <div className='mt-2 w-full rounded-md bg-slate-950 p-4'>
            <pre><code className="text-white">{JSON.stringify(result, null, 2)}</code></pre>
          </div>
        ),
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Interpreting Command',
        description: 'An unexpected error occurred. Please try again.',
      });
    }
    setCommand('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-md">
      <Label htmlFor="command-input" className="sr-only">
        Command
      </Label>
      <Input
        id="command-input"
        type="text"
        placeholder="Enter a command..."
        className="w-full bg-background pl-4 pr-20 h-10"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-1">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Mic className="h-4 w-4" />
          <span className="sr-only">Use Microphone</span>
        </Button>
        <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <CornerDownLeft className="h-4 w-4" />
          <span className="sr-only">Submit Command</span>
        </Button>
      </div>
    </form>
  );
}
