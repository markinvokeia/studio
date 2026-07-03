'use client';

import * as React from 'react';

import { Extension } from '@tiptap/core';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn } from '@/lib/utils';
import type { PrintTemplateVariable } from '@/lib/print-template-variables';

import {
    Bold,
    Code2,
    Italic,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Strikethrough,
    Underline as UnderlineIcon,
} from 'lucide-react';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (fontSize: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return { types: ['textStyle'] };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
                        renderHTML: (attributes: { fontSize?: string | null }) => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize:
                (fontSize: string) =>
                ({ chain }: { chain: () => any }) => chain().setMark('textStyle', { fontSize }).run(),
            unsetFontSize:
                () =>
                ({ chain }: { chain: () => any }) => chain().setMark('textStyle', { fontSize: null }).run(),
        };
    },
});

const FONT_FAMILIES = [
    { label: 'Segoe UI', value: 'Segoe UI, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'Courier New', value: 'Courier New, monospace' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px'];

interface InstructionRichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    variables: PrintTemplateVariable[];
    groupOrder?: PrintTemplateVariable['group'][];
    groupLabels?: Partial<Record<PrintTemplateVariable['group'], string>>;
    variablesLabel: string;
    minHeight?: string;
    disabled?: boolean;
}

function ToolbarButton({
    active,
    disabled,
    onClick,
    children,
    title,
}: {
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
}) {
    return (
        <Button
            type="button"
            variant={active ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            disabled={disabled}
            title={title}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

export function InstructionRichTextEditor({
    value,
    onChange,
    variables,
    groupOrder,
    groupLabels,
    variablesLabel,
    minHeight = '16rem',
    disabled = false,
}: InstructionRichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            FontFamily,
            FontSize,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ],
        content: value,
        editable: !disabled,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        editorProps: {
            attributes: {
                class: cn(
                    'prose-instructions rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1',
                    'overflow-y-auto whitespace-pre-wrap',
                ),
                style: `min-height: ${minHeight}`,
            },
        },
        immediatelyRender: false,
    });

    React.useEffect(() => {
        if (!editor) return;
        if (value !== editor.getHTML()) {
            editor.commands.setContent(value || '', { emitUpdate: false });
        }
    }, [value, editor]);

    React.useEffect(() => {
        editor?.setEditable(!disabled);
    }, [disabled, editor]);

    const insertVariable = (key: string) => {
        editor?.chain().focus().insertContent(key).run();
    };

    const groupedVariables = React.useMemo(() => {
        const groups = new Map<PrintTemplateVariable['group'], PrintTemplateVariable[]>();
        for (const variable of variables) {
            const list = groups.get(variable.group) ?? [];
            list.push(variable);
            groups.set(variable.group, list);
        }
        const order = groupOrder ?? Array.from(groups.keys());
        return order.filter((group) => groups.has(group)).map((group) => [group, groups.get(group)!] as const);
    }, [variables, groupOrder]);

    if (!editor) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap rounded-md border p-1.5">
                <Select
                    disabled={disabled}
                    onValueChange={(fontFamily) => editor.chain().focus().setFontFamily(fontFamily).run()}
                >
                    <SelectTrigger className="h-7 w-[140px] text-xs">
                        <SelectValue placeholder="Fuente" />
                    </SelectTrigger>
                    <SelectContent>
                        {FONT_FAMILIES.map((font) => (
                            <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                                {font.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    disabled={disabled}
                    onValueChange={(fontSize) => editor.chain().focus().setFontSize(fontSize).run()}
                >
                    <SelectTrigger className="h-7 w-[80px] text-xs">
                        <SelectValue placeholder="Tamaño" />
                    </SelectTrigger>
                    <SelectContent>
                        {FONT_SIZES.map((size) => (
                            <SelectItem key={size} value={size}>{size}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex items-center space-x-1 border-l pl-2">
                    <ToolbarButton title="Negrita" active={editor.isActive('bold')} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
                        <Bold className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Cursiva" active={editor.isActive('italic')} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
                        <Italic className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Subrayado" active={editor.isActive('underline')} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                        <UnderlineIcon className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Tachado" active={editor.isActive('strike')} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
                        <Strikethrough className="h-4 w-4" />
                    </ToolbarButton>
                </div>

                <div className="flex items-center space-x-1 border-l pl-2">
                    <ToolbarButton title="Alinear izquierda" active={editor.isActive({ textAlign: 'left' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                        <AlignLeft className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Centrar" active={editor.isActive({ textAlign: 'center' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                        <AlignCenter className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Alinear derecha" active={editor.isActive({ textAlign: 'right' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                        <AlignRight className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Justificar" active={editor.isActive({ textAlign: 'justify' })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
                        <AlignJustify className="h-4 w-4" />
                    </ToolbarButton>
                </div>

                <div className="flex items-center space-x-1 border-l pl-2">
                    <ToolbarButton title="Lista con viñetas" active={editor.isActive('bulletList')} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                        <List className="h-4 w-4" />
                    </ToolbarButton>
                    <ToolbarButton title="Lista numerada" active={editor.isActive('orderedList')} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                        <ListOrdered className="h-4 w-4" />
                    </ToolbarButton>
                </div>

                <div className="border-l pl-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-7" disabled={disabled}>
                                <Code2 className="mr-2 h-3.5 w-3.5" /> {variablesLabel}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {groupedVariables.map(([group, groupVariables]) => (
                                <React.Fragment key={group}>
                                    <DropdownMenuLabel className="capitalize">
                                        {groupLabels?.[group] ?? group}
                                    </DropdownMenuLabel>
                                    {groupVariables.map((variable) => (
                                        <DropdownMenuItem key={variable.key} onSelect={() => insertVariable(variable.key)}>
                                            {variable.label}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                </React.Fragment>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}

export type { Editor };
