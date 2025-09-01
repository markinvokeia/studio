'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User, MedicalEvent } from '@/lib/types';
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineIcon, TimelineDescription, TimelineContent } from '@/components/ui/timeline';
import { medicalHistory } from '@/lib/data';
import { Stethoscope, Pill, Microscope, FileText, UserPlus } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface MedicalHistoryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
}

const eventIcons: { [key in MedicalEvent['eventType']]: React.ElementType } = {
    appointment: UserPlus,
    procedure: Stethoscope,
    test: Microscope,
    prescription: Pill,
    note: FileText,
};

export function MedicalHistory({ isOpen, onOpenChange, user }: MedicalHistoryProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Medical History for {user.name}</DialogTitle>
          <DialogDescription>
            A chronological view of the patient's medical events.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full pr-4">
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
      </DialogContent>
    </Dialog>
  );
}
