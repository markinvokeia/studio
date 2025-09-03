'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, MedicalEvent } from '@/lib/types';
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineIcon, TimelineContent } from '@/components/ui/timeline';
import { medicalHistory } from '@/lib/data';
import { Stethoscope, Pill, Microscope, FileText, UserPlus, Bot, Sparkles, ChevronDown } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface MedicalHistoryProps {
  user: User;
}

const eventIcons: { [key in MedicalEvent['eventType']]: React.ElementType } = {
    appointment: UserPlus,
    procedure: Stethoscope,
    test: Microscope,
    prescription: Pill,
    note: FileText,
};

export function MedicalHistory({ user }: MedicalHistoryProps) {
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };
  
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] w-full p-4">
            <Timeline>
            {medicalHistory.map((event) => {
                const Icon = eventIcons[event.eventType];
                const isOpen = openItems.includes(event.id);
                return (
                <TimelineItem key={event.id}>
                    <TimelineConnector />
                    <TimelineHeader>
                        <TimelineIcon>
                            <Icon size={16} />
                        </TimelineIcon>
                        <div className="flex flex-col flex-grow ml-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-baseline gap-2">
                                     <p className='text-sm font-medium text-muted-foreground'>{event.date}</p>
                                    <TimelineTitle>{event.title}</TimelineTitle>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{event.summary}</p>
                        </div>
                    </TimelineHeader>
                    <TimelineContent>
                         <Collapsible open={isOpen} onOpenChange={() => toggleItem(event.id)}>
                            <CollapsibleTrigger asChild>
                                <Button variant="link" className="p-0 h-auto text-sm flex items-center gap-1">
                                    {isOpen ? 'Show Less' : 'Show More'}
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                               <div className="mt-2 text-sm text-muted-foreground space-y-2">
                                   <p><strong>Doctor:</strong> {event.doctor}</p>
                                   <div dangerouslySetInnerHTML={{ __html: event.details }} />
                               </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </TimelineContent>
                </TimelineItem>
                );
            })}
            </Timeline>
        </ScrollArea>
        <div className="p-4 border-t space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Assistant
            </h4>
            <Textarea 
                placeholder="Ask AI to summarize patient history, explain a procedure, or draft a follow-up message... e.g., 'Summarize the last 3 events for this patient.'"
                className="min-h-[80px]"
            />
             <Button>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
