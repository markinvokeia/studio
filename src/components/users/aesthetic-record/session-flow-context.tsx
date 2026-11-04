'use client';

import React from 'react';

import type {
  AestheticBodyFigure,
  AestheticLayer,
  AestheticSession,
  AestheticSessionStatus,
  ServiceAestheticConfig,
  ServiceConsentTemplate,
} from '@/lib/types';
import type { FaceTone } from './face-models/face-illustration';
import type { SessionFacts, SessionStep } from './session-status';

/** What the session sheet edits locally; it is autosaved */
export interface SessionDraft {
  date: string;
  title: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  /** Summary of the session, editable until it is closed */
  notes: string;
  layers: AestheticLayer[];
  bodyFigure: AestheticBodyFigure;
}

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

export interface LayerChangeOptions {
  /** Kept out of undo (typing in a text field) */
  skipHistory?: boolean;
}

export interface SessionFlowValue {
  patientId: string;
  patientName?: string;
  patientSex: AestheticBodyFigure;

  draft: SessionDraft;
  updateDraft: (patch: Partial<SessionDraft>) => void;
  setLayers: (update: (layers: AestheticLayer[]) => AestheticLayer[], options?: LayerChangeOptions) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** Server copy: consents, photos, notes and activity come from here */
  stored: AestheticSession | null;
  /** Replaces the server copy with what an endpoint returned (the local layers stay) */
  applyServer: (session: AestheticSession) => void;
  /** Patches a stored session (this one or an earlier one): a photo added, removed or aligned */
  updateSession: (sessionId: string, update: (session: AestheticSession) => AestheticSession) => void;
  /** Every session of the patient, oldest first */
  sessions: AestheticSession[];
  /** The patient's earlier sessions (not voided), oldest first: comparison, ghost marks, history */
  previousSessions: AestheticSession[];
  /** Number of this session among the patient's (1 for the first) */
  sessionNumber: number;

  configs: ServiceAestheticConfig[];
  configsError: string | null;
  templates: ServiceConsentTemplate[];
  configFor: (layer: AestheticLayer) => ServiceAestheticConfig | undefined;

  /** Nothing can change: no permission, or the session is closed or voided */
  readOnly: boolean;
  canRegister: boolean;
  facts: SessionFacts;
  status: AestheticSessionStatus;
  completeness: number;
  done: Record<SessionStep, boolean>;

  step: SessionStep;
  goToStep: (step: SessionStep) => void;

  /** Waits for the pending autosave (creating the session if needed) and returns its id */
  ensureSaved: () => Promise<string>;
  saveState: SaveState;
  retrySave: () => void;

  /** Model shown behind the map: sex and skin tone (a view preference) */
  modelSex: AestheticBodyFigure;
  setModelSex: (sex: AestheticBodyFigure) => void;
  modelTone: FaceTone;
  setModelTone: (tone: FaceTone) => void;
}

export const SessionFlowContext = React.createContext<SessionFlowValue | null>(null);

export function useSessionFlow(): SessionFlowValue {
  const value = React.useContext(SessionFlowContext);
  if (!value) throw new Error('useSessionFlow must be used inside the aesthetic session sheet');
  return value;
}
