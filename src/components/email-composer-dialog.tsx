'use client';

import * as React from 'react';
import { Bold, Italic, Underline, List, Link2, Send, X, Code2, Eye, PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  useDialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useCommunicationTemplates, substituteTokens } from '@/hooks/useCommunicationTemplates';
import { EMAIL_TEMPLATE_DEFAULTS } from '@/lib/email-template-defaults';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

interface EmailComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Email address shown read-only in the To field */
  to: string;
  /** User ID sent to the backend */
  userId: string;
  /** Display name shown in the dialog title */
  recipientName?: string;
  /** API code of the communication template to load (default: PATIENT_GENERAL_EMAIL) */
  templateCode?: string;
  /** Extra token variables merged on top of the base clinic/patient vars */
  templateVars?: Record<string, string>;
  /**
   * When provided, the subject field is pre-filled using the template subject or this value.
   * When omitted, the subject starts empty and the user fills it manually.
   */
  defaultSubject?: string;
  /** Fallback body HTML when no template is found (default: email_patient_general body) */
  defaultBody?: string;
  /** Optional subtitle below the dialog title */
  description?: string;
  /** Warning shown inside the dialog when `to` is empty */
  missingToMessage?: string;
  /** Warning shown inside the dialog when `userId` is empty */
  missingUserIdMessage?: string;
}

type ViewMode = 'edit' | 'source' | 'preview';

export function EmailComposerDialog({
  open,
  onOpenChange,
  to,
  userId,
  recipientName,
  templateCode,
  templateVars,
  defaultSubject,
  defaultBody,
  description,
  missingToMessage,
  missingUserIdMessage,
}: EmailComposerDialogProps) {
  const t = useTranslations('EmailComposerDialog');
  const { toast } = useToast();
  const handleClose = useDialogClose();
  const clinic = useClinicInfo();
  const commTemplates = useCommunicationTemplates();

  const [subject, setSubject] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>('edit');
  const [sourceHtml, setSourceHtml] = React.useState('');

  const editorRef = React.useRef<HTMLDivElement | null>(null);
  // editorMounted tracks when the contentEditable div actually enters the DOM.
  // Radix Presence mounts dialog content one render cycle after `open` becomes true,
  // so we need this state as a dep to re-run the pre-fill effect at the right time.
  const [editorMounted, setEditorMounted] = React.useState(false);
  const setEditorRef = React.useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node;
    setEditorMounted(node !== null);
  }, []);

  // Tracks whether the user has manually edited body/subject — only then do we stop auto-filling.
  // Using refs (not state) so the effects don't re-run just because the user typed.
  const bodyUserEdited = React.useRef(false);
  const subjectUserEdited = React.useRef(false);

  // Build the full token variable map
  const allVars = React.useMemo<Record<string, string>>(() => ({
    patient_name:   recipientName   || '',
    clinic_name:    clinic?.name    || '',
    clinic_phone:   clinic?.phone   || '',
    clinic_email:   clinic?.email   || '',
    clinic_logo:    clinic?.logoUrl || '',
    clinic_address: clinic?.address || '',
    ...templateVars,
  }), [clinic, recipientName, templateVars]);

  // Pre-fill body — re-runs whenever templates, vars, or the editor element change.
  // editorMounted is required as a dep: Radix Presence mounts the dialog content one render
  // cycle after `open` becomes true, so the first effect run always sees editorRef.current=null.
  React.useEffect(() => {
    if (!open || !editorMounted || !editorRef.current || bodyUserEdited.current) return;
    const code = templateCode ?? 'PATIENT_GENERAL_EMAIL';
    const tpl = commTemplates[code];
    const rawBody = tpl?.body_html || tpl?.body_text || defaultBody || EMAIL_TEMPLATE_DEFAULTS.email_patient_general.body;
    const html = substituteTokens(rawBody, allVars);
    editorRef.current.innerHTML = html;
    editorRef.current.dataset.hasContent = html ? 'true' : '';
  }, [open, editorMounted, commTemplates, allVars, templateCode, defaultBody]);

  // Pre-fill subject — re-runs whenever templates or vars change, stops only if user edited manually.
  React.useEffect(() => {
    if (!open || subjectUserEdited.current) return;
    const code = templateCode ?? 'PATIENT_GENERAL_EMAIL';
    const tpl = commTemplates[code];
    const rawSubject = tpl?.subject || defaultSubject;
    if (!rawSubject) return;
    setSubject(substituteTokens(rawSubject, allVars));
  }, [open, commTemplates, allVars, templateCode, defaultSubject]);

  // Reset on close
  React.useEffect(() => {
    if (!open && editorRef.current) {
      editorRef.current.innerHTML = '';
      editorRef.current.dataset.hasContent = '';
      setSubject('');
      setViewMode('edit');
      setSourceHtml('');
      bodyUserEdited.current = false;
      subjectUserEdited.current = false;
    }
  }, [open]);

  const switchMode = (next: ViewMode) => {
    if (next === viewMode) return;
    if (viewMode === 'edit') setSourceHtml(editorRef.current?.innerHTML || '');
    if (next === 'edit' && editorRef.current) {
      editorRef.current.innerHTML = sourceHtml;
      editorRef.current.dataset.hasContent = sourceHtml ? 'true' : '';
    }
    setViewMode(next);
  };

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) editorRef.current.dataset.hasContent = 'true';
    bodyUserEdited.current = true;
  };

  const handleSend = async () => {
    if (!to || !subject || !userId || isSending) return;
    setIsSending(true);
    const html = viewMode === 'edit' ? (editorRef.current?.innerHTML || '') : sourceHtml;
    try {
      await api.post(API_ROUTES.USERS_SEND_EMAIL, { id: userId, subject, bodyHTML: html });
      toast({ title: t('toast.sendSuccessTitle'), description: t('toast.sendSuccessDescription') });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast.sendErrorTitle'),
        description: error instanceof Error ? error.message : t('toast.sendErrorDescription'),
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full sm:max-w-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] p-0 gap-0"
        showMaximize
        confirmOnClose
        isDirty={subject.trim() !== ''}
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            {t('title')}
            {recipientName && <span className="text-muted-foreground font-normal">— {recipientName}</span>}
          </DialogTitle>
          {description && <DialogDescription className="pl-6">{description}</DialogDescription>}
        </DialogHeader>

        <Separator />

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* To / Subject */}
          <div className="px-4 py-2 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <Label className="w-14 shrink-0 text-xs text-muted-foreground">{t('to')}</Label>
              <Input value={to} readOnly className="h-8 text-sm bg-muted/50 border-0 px-2" />
            </div>
            {!to && missingToMessage && (
              <p className="text-xs text-destructive pl-16">{missingToMessage}</p>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="email-subject" className="w-14 shrink-0 text-xs text-muted-foreground">{t('subject')}</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => { subjectUserEdited.current = true; setSubject(e.target.value); }}
                placeholder={t('subjectPlaceholder')}
                className="h-8 text-sm"
              />
            </div>
            {!userId && missingUserIdMessage && (
              <p className="text-xs text-destructive pl-16">{missingUserIdMessage}</p>
            )}
          </div>

          <Separator />

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-3 py-1 shrink-0 border-b border-border">
            {viewMode === 'edit' && (
              <>
                <ToolbarButton icon={Bold}      label={t('toolbar.bold')}       onClick={() => execCmd('bold')} />
                <ToolbarButton icon={Italic}    label={t('toolbar.italic')}     onClick={() => execCmd('italic')} />
                <ToolbarButton icon={Underline} label={t('toolbar.underline')}  onClick={() => execCmd('underline')} />
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarButton icon={List}      label={t('toolbar.list')}       onClick={() => execCmd('insertUnorderedList')} />
                <ToolbarButton
                  icon={Link2}
                  label={t('toolbar.insertLink')}
                  onClick={() => {
                    const url = window.prompt(t('toolbar.linkPrompt'));
                    if (url) execCmd('createLink', url);
                  }}
                />
              </>
            )}
            <div className="ml-auto flex items-center border border-border rounded-md overflow-hidden">
              <ToolbarButton icon={PenLine} label={t('toolbar.modeEdit')}    onClick={() => switchMode('edit')}    active={viewMode === 'edit'} />
              <ToolbarButton icon={Code2}   label={t('toolbar.modeSource')}  onClick={() => switchMode('source')}  active={viewMode === 'source'} />
              <ToolbarButton icon={Eye}     label={t('toolbar.modePreview')} onClick={() => switchMode('preview')} active={viewMode === 'preview'} />
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
            {/* WYSIWYG — kept mounted so the ref stays valid */}
            <div
              ref={setEditorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                if (editorRef.current) editorRef.current.dataset.hasContent = 'true';
                bodyUserEdited.current = true;
              }}
              className={cn(
                'min-h-[200px] outline-none text-sm leading-relaxed focus:outline-none',
                'prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4',
                viewMode !== 'edit' && 'hidden'
              )}
              data-placeholder={t('bodyPlaceholder')}
              style={{ whiteSpace: 'pre-wrap' }}
            />
            {viewMode === 'source' && (
              <textarea
                value={sourceHtml}
                onChange={(e) => { bodyUserEdited.current = true; setSourceHtml(e.target.value); }}
                spellCheck={false}
                className="w-full min-h-[300px] h-full font-mono text-xs leading-relaxed resize-none outline-none bg-transparent"
              />
            )}
            {viewMode === 'preview' && (
              <iframe
                srcDoc={sourceHtml}
                title={t('toolbar.modePreview')}
                className="w-full min-h-[400px] border-0 rounded"
              />
            )}
          </div>
        </div>

        <Separator />

        <DialogFooter className="px-4 py-3 shrink-0 flex-row items-center justify-between sm:justify-between gap-2">
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleClose}>
              <X className="h-4 w-4 mr-1" />
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleSend} disabled={!to || !subject || !userId || isSending}>
              <Send className="h-4 w-4 mr-1" />
              {isSending ? t('sending') : t('send')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded transition-colors',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
