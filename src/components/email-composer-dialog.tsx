'use client';

import * as React from 'react';
import { Bold, Italic, Underline, List, Link2, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

interface EmailComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled recipient email */
  to: string;
  /** Display name of the recipient */
  recipientName?: string;
}

interface ClinicInfo {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

function buildSignature(clinic: ClinicInfo | null): string {
  if (!clinic) return '';
  const parts: string[] = ['<br/><br/>'];
  parts.push('<div style="border-top:1px solid #e5e7eb;padding-top:8px;color:#6b7280;font-size:13px;">');
  if (clinic.name) parts.push(`<strong style="color:#374151">${clinic.name}</strong><br/>`);
  if (clinic.phone) parts.push(`Tel: ${clinic.phone}<br/>`);
  if (clinic.email) parts.push(`Email: ${clinic.email}<br/>`);
  if (clinic.address) parts.push(`${clinic.address}<br/>`);
  parts.push('</div>');
  return parts.join('');
}

export function EmailComposerDialog({
  open,
  onOpenChange,
  to,
  recipientName,
}: EmailComposerDialogProps) {
  const [subject, setSubject] = React.useState('');
  const [clinic, setClinic] = React.useState<ClinicInfo | null>(null);
  const editorRef = React.useRef<HTMLDivElement>(null);

  // Fetch clinic info once
  React.useEffect(() => {
    if (!open) return;
    api.get(API_ROUTES.CLINIC).then((data: any) => {
      const c = Array.isArray(data) ? data[0] : data;
      setClinic({
        name: c?.name || c?.clinic_name,
        email: c?.email,
        phone: c?.phone || c?.phone_number,
        address: c?.address,
      });
    }).catch(() => {});
  }, [open]);

  // Set initial editor content with signature when clinic loads or dialog opens
  React.useEffect(() => {
    if (!open || !editorRef.current) return;
    const sig = buildSignature(clinic);
    // Only set if editor is empty or just has the old signature
    if (editorRef.current.innerHTML === '' || editorRef.current.dataset.hasContent !== 'true') {
      editorRef.current.innerHTML = sig;
    }
  }, [open, clinic]);

  // Reset on close
  React.useEffect(() => {
    if (!open && editorRef.current) {
      editorRef.current.innerHTML = '';
      editorRef.current.dataset.hasContent = '';
      setSubject('');
    }
  }, [open]);

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) editorRef.current.dataset.hasContent = 'true';
  };

  const handleSend = () => {
    const html = editorRef.current?.innerHTML || '';
    // Convert basic HTML to plain text for mailto
    const body = html
      .replace(/<br\s*\/?>/gi, '%0A')
      .replace(/<\/p>/gi, '%0A')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${body}`;
    window.location.href = mailto;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full sm:max-w-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] p-0 gap-0"
        showMaximize
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Nuevo correo
            {recipientName && <span className="text-muted-foreground font-normal">— {recipientName}</span>}
          </DialogTitle>
        </DialogHeader>

        <Separator />

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* To / Subject */}
          <div className="px-4 py-2 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <Label className="w-14 shrink-0 text-xs text-muted-foreground">Para</Label>
              <Input
                value={to}
                readOnly
                className="h-8 text-sm bg-muted/50 border-0 px-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="email-subject" className="w-14 shrink-0 text-xs text-muted-foreground">Asunto</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Escribe el asunto..."
                className="h-8 text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-3 py-1 shrink-0 border-b border-border">
            <ToolbarButton icon={Bold} label="Negrita" onClick={() => execCmd('bold')} />
            <ToolbarButton icon={Italic} label="Cursiva" onClick={() => execCmd('italic')} />
            <ToolbarButton icon={Underline} label="Subrayado" onClick={() => execCmd('underline')} />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton icon={List} label="Lista" onClick={() => execCmd('insertUnorderedList')} />
            <ToolbarButton
              icon={Link2}
              label="Insertar enlace"
              onClick={() => {
                const url = window.prompt('URL del enlace:');
                if (url) execCmd('createLink', url);
              }}
            />
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                if (editorRef.current) editorRef.current.dataset.hasContent = 'true';
              }}
              className={cn(
                'min-h-[200px] outline-none text-sm leading-relaxed focus:outline-none',
                'prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4'
              )}
              data-placeholder="Escribe tu mensaje aquí..."
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        </div>

        <Separator />

        <DialogFooter className="px-4 py-3 shrink-0 flex-row items-center justify-between sm:justify-between gap-2">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Se abrirá tu aplicación de correo con el mensaje preparado.
          </p>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSend} disabled={!to || !subject}>
              <Send className="h-4 w-4 mr-1" />
              Abrir en correo
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
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault(); // prevent losing editor focus
        onClick();
      }}
      className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
