'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, MedicalEvent } from '@/lib/types';
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineIcon, TimelineDescription, TimelineContent } from '@/components/ui/timeline';
import { medicalHistory } from '@/lib/data';
import { Stethoscope, Pill, Microscope, FileText, UserPlus, Bot, Sparkles } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

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
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] w-full pr-4 p-4">
            <Timeline>
            {medicalHistory.map((event, index) => {
                const Icon = eventIcons[event.eventType];
                return (
                <TimelineItem key={event.id}>
                    <TimelineConnector />
                    <TimelineHeader>
                    <TimelineTitle>{event.title}</TimelineTitle>
                    <TimelineIcon>
                        <Icon size={16} />
                    </TimelineIcon>
                    <p className='text-sm text-muted-foreground'>{event.date}</p>
                    </TimelineHeader>
                    <TimelineContent>
                    <TimelineDescription>{event.description}</TimelineDescription>
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
