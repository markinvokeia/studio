'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AllergyItem, FamilyHistoryItem, MedicationCatalogItem, MedicationItem, PatientHabits as PatientHabitsType, PersonalHistoryItem, useClinicHistory } from '@/hooks/useClinicHistory';
import { PatientSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
    AlertTriangle,
    Calendar as CalendarIcon,
    Check,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Clock,
    Edit3,
    Eye,
    File,
    FileText,
    FolderArchive,
    GlassWater,
    Heart,
    Loader2,
    Maximize,
    Minimize,
    MoreHorizontal,
    Pill,
    Plus,
    RotateCcw,
    Smile,
    Stethoscope,
    Trash2,
    Upload,
    User,
    Wind,
    X,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import * as React from 'react';

interface ClinicHistoryViewerProps {
    userId: string;
    userName?: string;
}

type ActiveView = 'anamnesis' | 'timeline' | 'odontogram' | 'documents';

export function ClinicHistoryViewer({ userId, userName }: ClinicHistoryViewerProps) {
    const t = useTranslations('ClinicHistoryPage');
    const locale = useLocale();
    const [activeView, setActiveView] = React.useState<ActiveView>('anamnesis');
    const [isOdontogramFullscreen, setIsOdontogramFullscreen] = React.useState(false);

    const {
        personalHistory,
        isLoadingPersonalHistory,
        familyHistory,
        isLoadingFamilyHistory,
        allergies,
        isLoadingAllergies,
        medications,
        isLoadingMedications,
        patientSessions,
        isLoadingPatientSessions,
        patientHabits,
        isLoadingPatientHabits,
        documents,
        isLoadingDocuments,
        refreshAll,
        uploadDocument,
        deleteDocument,
        getDocumentContent,
        ailmentsCatalog,
        medicationsCatalog,
        isLoadingAilmentsCatalog,
        isLoadingMedicationsCatalog,
        createPersonalHistory,
        updatePersonalHistory,
        deletePersonalHistory,
        createFamilyHistory,
        updateFamilyHistory,
        deleteFamilyHistory,
        createAllergy,
        updateAllergy,
        deleteAllergy,
        createMedication,
        updateMedication,
        deleteMedication,
        updatePatientHabits,
        fetchAilmentsCatalog,
        fetchMedicationsCatalog,
        isSubmittingPersonal,
        isSubmittingFamily,
        isSubmittingAllergy,
        isSubmittingMedication,
        isSubmittingHabits,
        createSession,
        updateSession,
        deleteSession,
        fetchDoctors,
        doctors,
        isLoadingDoctors,
        isSubmittingSession,
    } = useClinicHistory();

    React.useEffect(() => {
        if (userId) {
            refreshAll(userId);
        }
    }, [userId, refreshAll]);

    const navItems = [
        { id: 'anamnesis' as const, label: t('tabs.anamnesis'), icon: FileText },
        { id: 'timeline' as const, label: t('tabs.timeline'), icon: Clock },
        { id: 'odontogram' as const, label: t('tabs.odontogram'), icon: Smile },
        { id: 'documents' as const, label: t('tabs.documents'), icon: FolderArchive },
    ];

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex space-x-0.5 bg-muted/40 rounded-lg p-1 mb-1">
                {navItems.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveView(id)}
                        className={cn(
                            "flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all",
                            activeView === id
                                ? "bg-background text-foreground shadow-sm border border-border/50"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <div className="pr-4 pt-2">
                        {activeView === 'anamnesis' && (
                            <AnamnesisSection
                                userId={userId}
                                personalHistory={personalHistory}
                                isLoadingPersonalHistory={isLoadingPersonalHistory}
                                familyHistory={familyHistory}
                                isLoadingFamilyHistory={isLoadingFamilyHistory}
                                allergies={allergies}
                                isLoadingAllergies={isLoadingAllergies}
                                medications={medications}
                                isLoadingMedications={isLoadingMedications}
                                patientHabits={patientHabits}
                                isLoadingPatientHabits={isLoadingPatientHabits}
                                ailmentsCatalog={ailmentsCatalog}
                                medicationsCatalog={medicationsCatalog}
                                isLoadingAilmentsCatalog={isLoadingAilmentsCatalog}
                                isLoadingMedicationsCatalog={isLoadingMedicationsCatalog}
                                isSubmittingPersonal={isSubmittingPersonal}
                                isSubmittingFamily={isSubmittingFamily}
                                isSubmittingAllergy={isSubmittingAllergy}
                                isSubmittingMedication={isSubmittingMedication}
                                isSubmittingHabits={isSubmittingHabits}
                                onCreatePersonalHistory={createPersonalHistory}
                                onUpdatePersonalHistory={updatePersonalHistory}
                                onDeletePersonalHistory={deletePersonalHistory}
                                onCreateFamilyHistory={createFamilyHistory}
                                onUpdateFamilyHistory={updateFamilyHistory}
                                onDeleteFamilyHistory={deleteFamilyHistory}
                                onCreateAllergy={createAllergy}
                                onUpdateAllergy={updateAllergy}
                                onDeleteAllergy={deleteAllergy}
                                onCreateMedication={createMedication}
                                onUpdateMedication={updateMedication}
                                onDeleteMedication={deleteMedication}
                                onUpdatePatientHabits={updatePatientHabits}
                                onFetchAilmentsCatalog={fetchAilmentsCatalog}
                                onFetchMedicationsCatalog={fetchMedicationsCatalog}
                            />
                        )}
                        {activeView === 'timeline' && (
                            <TreatmentTimeline
                                sessions={patientSessions}
                                isLoading={isLoadingPatientSessions}
                                userId={userId}
                                doctors={doctors}
                                isLoadingDoctors={isLoadingDoctors}
                                isSubmittingSession={isSubmittingSession}
                                onCreateSession={createSession}
                                onUpdateSession={updateSession}
                                onDeleteSession={deleteSession}
                                onFetchDoctors={fetchDoctors}
                                onRefreshAll={refreshAll}
                            />
                        )}
                        {activeView === 'odontogram' && (
                            <div className={cn(
                                "relative",
                                isOdontogramFullscreen ? "fixed inset-0 z-50 bg-background p-4" : "h-[600px] w-full"
                            )}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "absolute z-10 bg-background/50 hover:bg-background/80",
                                        isOdontogramFullscreen ? "top-6 right-6" : "top-2 right-2"
                                    )}
                                    onClick={() => setIsOdontogramFullscreen(!isOdontogramFullscreen)}
                                >
                                    {isOdontogramFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                                </Button>
                                <iframe
                                    src={`${process.env.NEXT_PUBLIC_ONDONTOGRAMA_URL || 'https://odontogramiia.invokeia.com'}?lang=${locale}&user_id=${userId}&token=${typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''}`}
                                    className="w-full h-full border-0 rounded-lg"
                                    title="Odontograma"
                                />
                            </div>
                        )}
                        {activeView === 'documents' && (
                            <EnhancedDocumentsGallery
                                documents={documents}
                                isLoading={isLoadingDocuments}
                                userId={userId}
                                uploadDocument={uploadDocument}
                                deleteDocument={deleteDocument}
                                getDocumentContent={getDocumentContent}
                            />
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}

interface AnamnesisSectionProps {
    userId: string;
    personalHistory: PersonalHistoryItem[];
    isLoadingPersonalHistory: boolean;
    familyHistory: FamilyHistoryItem[];
    isLoadingFamilyHistory: boolean;
    allergies: AllergyItem[];
    isLoadingAllergies: boolean;
    medications: MedicationItem[];
    isLoadingMedications: boolean;
    patientHabits: PatientHabitsType | null;
    isLoadingPatientHabits: boolean;
    ailmentsCatalog: { id: string; nombre: string }[];
    medicationsCatalog: MedicationCatalogItem[];
    isLoadingAilmentsCatalog: boolean;
    isLoadingMedicationsCatalog: boolean;
    isSubmittingPersonal: boolean;
    isSubmittingFamily: boolean;
    isSubmittingAllergy: boolean;
    isSubmittingMedication: boolean;
    isSubmittingHabits: boolean;
    onCreatePersonalHistory: (userId: string, data: { padecimiento_id: string; nombre: string; comentarios: string }) => Promise<void>;
    onUpdatePersonalHistory: (userId: string, data: { id: number; padecimiento_id: string; nombre: string; comentarios: string }) => Promise<void>;
    onDeletePersonalHistory: (userId: string, itemId: number) => Promise<void>;
    onCreateFamilyHistory: (userId: string, data: { padecimiento_id: string; nombre: string; parentesco: string; comentarios: string }) => Promise<void>;
    onUpdateFamilyHistory: (userId: string, data: { id: number; padecimiento_id: string; nombre: string; parentesco: string; comentarios: string }) => Promise<void>;
    onDeleteFamilyHistory: (userId: string, itemId: number) => Promise<void>;
    onCreateAllergy: (userId: string, data: { alergeno: string; reaccion_descrita: string }) => Promise<void>;
    onUpdateAllergy: (userId: string, data: { id: number; alergeno: string; reaccion_descrita: string }) => Promise<void>;
    onDeleteAllergy: (userId: string, itemId: number) => Promise<void>;
    onCreateMedication: (userId: string, data: { medicamento_id?: string; nombre_medicamento: string; dosis: string; frecuencia: string; motivo: string; fecha_inicio?: string; fecha_fin?: string }) => Promise<void>;
    onUpdateMedication: (userId: string, data: { id: number; medicamento_id?: string; nombre_medicamento: string; dosis: string; frecuencia: string; motivo: string; fecha_inicio?: string; fecha_fin?: string }) => Promise<void>;
    onDeleteMedication: (userId: string, itemId: number) => Promise<void>;
    onUpdatePatientHabits: (userId: string, data: PatientHabitsType) => Promise<void>;
    onFetchAilmentsCatalog: () => Promise<void>;
    onFetchMedicationsCatalog: (search: string) => Promise<void>;
}

function AnamnesisSection({
    userId,
    personalHistory,
    isLoadingPersonalHistory,
    familyHistory,
    isLoadingFamilyHistory,
    allergies,
    isLoadingAllergies,
    medications,
    isLoadingMedications,
    patientHabits,
    isLoadingPatientHabits,
    ailmentsCatalog,
    medicationsCatalog,
    isLoadingAilmentsCatalog,
    isLoadingMedicationsCatalog,
    isSubmittingPersonal,
    isSubmittingFamily,
    isSubmittingAllergy,
    isSubmittingMedication,
    isSubmittingHabits,
    onCreatePersonalHistory,
    onUpdatePersonalHistory,
    onDeletePersonalHistory,
    onCreateFamilyHistory,
    onUpdateFamilyHistory,
    onDeleteFamilyHistory,
    onCreateAllergy,
    onUpdateAllergy,
    onDeleteAllergy,
    onCreateMedication,
    onUpdateMedication,
    onDeleteMedication,
    onUpdatePatientHabits,
    onFetchAilmentsCatalog,
    onFetchMedicationsCatalog,
}: AnamnesisSectionProps) {
    const t = useTranslations('ClinicHistoryPage.anamnesis');
    const tHabits = useTranslations('ClinicHistoryPage.habits');
    const { toast } = useToast();

    // Dialog states
    const [isPersonalDialogOpen, setIsPersonalDialogOpen] = React.useState(false);
    const [isFamilyDialogOpen, setIsFamilyDialogOpen] = React.useState(false);
    const [isAllergyDialogOpen, setIsAllergyDialogOpen] = React.useState(false);
    const [isMedicationDialogOpen, setIsMedicationDialogOpen] = React.useState(false);

    // Editing states
    const [editingPersonalItem, setEditingPersonalItem] = React.useState<PersonalHistoryItem | null>(null);
    const [editingFamilyItem, setEditingFamilyItem] = React.useState<FamilyHistoryItem | null>(null);
    const [editingAllergyItem, setEditingAllergyItem] = React.useState<AllergyItem | null>(null);
    const [editingMedicationItem, setEditingMedicationItem] = React.useState<MedicationItem | null>(null);

    // Deleting states
    const [deletingPersonalItem, setDeletingPersonalItem] = React.useState<PersonalHistoryItem | null>(null);
    const [deletingFamilyItem, setDeletingFamilyItem] = React.useState<FamilyHistoryItem | null>(null);
    const [deletingAllergyItem, setDeletingAllergyItem] = React.useState<AllergyItem | null>(null);
    const [deletingMedicationItem, setDeletingMedicationItem] = React.useState<MedicationItem | null>(null);

    // Habits editing state
    const [isHabitsEditing, setIsHabitsEditing] = React.useState(false);
    const [habitsFormData, setHabitsFormData] = React.useState<PatientHabitsType>({
        fuma: false,
        alcohol: false,
        drogas: false,
        cafe: false,
        otros: '',
        comentarios: '',
        tabaquismo: '',
        alcoholismo: '',
        bruxismo: '',
    });

    // Form states
    const [personalAilmentName, setPersonalAilmentName] = React.useState('');
    const [personalComentarios, setPersonalComentarios] = React.useState('');
    const [familyAilmentName, setFamilyAilmentName] = React.useState('');
    const [familyParentesco, setFamilyParentesco] = React.useState('');
    const [familyComentarios, setFamilyComentarios] = React.useState('');
    const [allergyAlergeno, setAllergyAlergeno] = React.useState('');
    const [allergyReaccion, setAllergyReaccion] = React.useState('');
    const [medicationSearchTerm, setMedicationSearchTerm] = React.useState('');
    const [selectedMedication, setSelectedMedication] = React.useState<MedicationCatalogItem | null>(null);
    const [medicationDosis, setMedicationDosis] = React.useState('');
    const [medicationFrecuencia, setMedicationFrecuencia] = React.useState('');
    const [medicationMotivo, setMedicationMotivo] = React.useState('');
    const [medicationFechaInicio, setMedicationFechaInicio] = React.useState('');
    const [medicationFechaFin, setMedicationFechaFin] = React.useState('');

    // Combobox states
    const [isPersonalComboboxOpen, setIsPersonalComboboxOpen] = React.useState(false);
    const [isFamilyComboboxOpen, setIsFamilyComboboxOpen] = React.useState(false);
    const [isMedicationComboboxOpen, setIsMedicationComboboxOpen] = React.useState(false);

    // Load catalog when dialog opens
    React.useEffect(() => {
        if (isPersonalDialogOpen || isFamilyDialogOpen) {
            onFetchAilmentsCatalog();
        }
    }, [isPersonalDialogOpen, isFamilyDialogOpen, onFetchAilmentsCatalog]);

    React.useEffect(() => {
        if (isMedicationDialogOpen && medicationSearchTerm.length > 0) {
            const timer = setTimeout(() => {
                onFetchMedicationsCatalog(medicationSearchTerm);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isMedicationDialogOpen, medicationSearchTerm, onFetchMedicationsCatalog]);

    // Load editing data when dialog opens
    React.useEffect(() => {
        if (isPersonalDialogOpen) {
            if (editingPersonalItem) {
                setPersonalAilmentName(editingPersonalItem.padecimiento_id || editingPersonalItem.nombre);
                setPersonalComentarios(editingPersonalItem.comentarios);
            } else {
                setPersonalAilmentName('');
                setPersonalComentarios('');
            }
        }
    }, [isPersonalDialogOpen, editingPersonalItem]);

    React.useEffect(() => {
        if (isFamilyDialogOpen) {
            if (editingFamilyItem) {
                setFamilyAilmentName(editingFamilyItem.padecimiento_id || editingFamilyItem.nombre);
                setFamilyParentesco(editingFamilyItem.parentesco);
                setFamilyComentarios(editingFamilyItem.comentarios);
            } else {
                setFamilyAilmentName('');
                setFamilyParentesco('');
                setFamilyComentarios('');
            }
        }
    }, [isFamilyDialogOpen, editingFamilyItem]);

    React.useEffect(() => {
        if (isAllergyDialogOpen) {
            if (editingAllergyItem) {
                setAllergyAlergeno(editingAllergyItem.alergeno);
                setAllergyReaccion(editingAllergyItem.reaccion_descrita);
            } else {
                setAllergyAlergeno('');
                setAllergyReaccion('');
            }
        }
    }, [isAllergyDialogOpen, editingAllergyItem]);

    React.useEffect(() => {
        if (isMedicationDialogOpen) {
            if (editingMedicationItem) {
                setSelectedMedication({ id: String(editingMedicationItem.id), nombre_generico: editingMedicationItem.nombre_medicamento });
                setMedicationDosis(editingMedicationItem.dosis);
                setMedicationFrecuencia(editingMedicationItem.frecuencia);
                setMedicationMotivo(editingMedicationItem.motivo);
                setMedicationFechaInicio(editingMedicationItem.fecha_inicio || '');
                setMedicationFechaFin(editingMedicationItem.fecha_fin || '');
            } else {
                setSelectedMedication(null);
                setMedicationDosis('');
                setMedicationFrecuencia('');
                setMedicationMotivo('');
                setMedicationFechaInicio('');
                setMedicationFechaFin('');
            }
        }
    }, [isMedicationDialogOpen, editingMedicationItem]);

    // Load habits
    React.useEffect(() => {
        if (patientHabits) {
            setHabitsFormData({
                fuma: Boolean(patientHabits.fuma),
                alcohol: Boolean(patientHabits.alcohol),
                drogas: Boolean(patientHabits.drogas),
                cafe: Boolean(patientHabits.cafe),
                otros: patientHabits.otros || '',
                comentarios: patientHabits.comentarios || '',
                tabaquismo: (patientHabits as any).tabaquismo || '',
                alcoholismo: (patientHabits as any).alcoholismo || '',
                bruxismo: (patientHabits as any).bruxismo || '',
            });
        }
    }, [patientHabits]);

    // Handlers
    const handleOpenPersonalDialog = (item?: PersonalHistoryItem) => {
        setEditingPersonalItem(item || null);
        setIsPersonalDialogOpen(true);
    };

    const handleOpenFamilyDialog = (item?: FamilyHistoryItem) => {
        setEditingFamilyItem(item || null);
        setIsFamilyDialogOpen(true);
    };

    const handleOpenAllergyDialog = (item?: AllergyItem) => {
        setEditingAllergyItem(item || null);
        setIsAllergyDialogOpen(true);
    };

    const handleOpenMedicationDialog = (item?: MedicationItem) => {
        setEditingMedicationItem(item || null);
        setIsMedicationDialogOpen(true);
    };

    const handleSubmitPersonal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingPersonalItem?.id) {
                await onUpdatePersonalHistory(userId, {
                    id: editingPersonalItem.id,
                    padecimiento_id: personalAilmentName,
                    nombre: personalAilmentName,
                    comentarios: personalComentarios,
                });
            } else {
                await onCreatePersonalHistory(userId, {
                    padecimiento_id: personalAilmentName,
                    nombre: personalAilmentName,
                    comentarios: personalComentarios,
                });
            }
            toast({ title: t('toast.success') });
            setIsPersonalDialogOpen(false);
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        }
    };

    const handleDeletePersonal = (item: PersonalHistoryItem) => {
        setDeletingPersonalItem(item);
    };

    const confirmDeletePersonal = async () => {
        if (!deletingPersonalItem?.id) return;
        try {
            await onDeletePersonalHistory(userId, deletingPersonalItem.id);
            toast({ title: t('toast.deleteSuccess') });
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        } finally {
            setDeletingPersonalItem(null);
        }
    };

    const handleSubmitFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingFamilyItem?.id) {
                await onUpdateFamilyHistory(userId, {
                    id: editingFamilyItem.id,
                    padecimiento_id: familyAilmentName,
                    nombre: familyAilmentName,
                    parentesco: familyParentesco,
                    comentarios: familyComentarios,
                });
            } else {
                await onCreateFamilyHistory(userId, {
                    padecimiento_id: familyAilmentName,
                    nombre: familyAilmentName,
                    parentesco: familyParentesco,
                    comentarios: familyComentarios,
                });
            }
            toast({ title: t('toast.success') });
            setIsFamilyDialogOpen(false);
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        }
    };

    const handleDeleteFamily = (item: FamilyHistoryItem) => {
        setDeletingFamilyItem(item);
    };

    const confirmDeleteFamily = async () => {
        if (!deletingFamilyItem?.id) return;
        try {
            await onDeleteFamilyHistory(userId, deletingFamilyItem.id);
            toast({ title: t('toast.deleteSuccess') });
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        } finally {
            setDeletingFamilyItem(null);
        }
    };

    const handleSubmitAllergy = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingAllergyItem?.id) {
                await onUpdateAllergy(userId, {
                    id: editingAllergyItem.id,
                    alergeno: allergyAlergeno,
                    reaccion_descrita: allergyReaccion,
                });
            } else {
                await onCreateAllergy(userId, {
                    alergeno: allergyAlergeno,
                    reaccion_descrita: allergyReaccion,
                });
            }
            toast({ title: t('toast.success') });
            setIsAllergyDialogOpen(false);
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        }
    };

    const handleDeleteAllergy = (item: AllergyItem) => {
        setDeletingAllergyItem(item);
    };

    const confirmDeleteAllergy = async () => {
        if (!deletingAllergyItem?.id) return;
        try {
            await onDeleteAllergy(userId, deletingAllergyItem.id);
            toast({ title: t('toast.deleteSuccess') });
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        } finally {
            setDeletingAllergyItem(null);
        }
    };

    const handleSubmitMedication = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingMedicationItem?.id) {
                await onUpdateMedication(userId, {
                    id: editingMedicationItem.id,
                    medicamento_id: selectedMedication?.id,
                    nombre_medicamento: selectedMedication?.nombre_generico || medicationSearchTerm,
                    dosis: medicationDosis,
                    frecuencia: medicationFrecuencia,
                    motivo: medicationMotivo,
                    fecha_inicio: medicationFechaInicio || undefined,
                    fecha_fin: medicationFechaFin || undefined,
                });
            } else {
                await onCreateMedication(userId, {
                    medicamento_id: selectedMedication?.id,
                    nombre_medicamento: selectedMedication?.nombre_generico || medicationSearchTerm,
                    dosis: medicationDosis,
                    frecuencia: medicationFrecuencia,
                    motivo: medicationMotivo,
                    fecha_inicio: medicationFechaInicio || undefined,
                    fecha_fin: medicationFechaFin || undefined,
                });
            }
            toast({ title: t('toast.success') });
            setIsMedicationDialogOpen(false);
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        }
    };

    const handleDeleteMedication = (item: MedicationItem) => {
        setDeletingMedicationItem(item);
    };

    const confirmDeleteMedication = async () => {
        if (!deletingMedicationItem?.id) return;
        try {
            await onDeleteMedication(userId, deletingMedicationItem.id);
            toast({ title: t('toast.deleteSuccess') });
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        } finally {
            setDeletingMedicationItem(null);
        }
    };

    const handleSaveHabits = async () => {
        try {
            await onUpdatePatientHabits(userId, habitsFormData);
            toast({ title: tHabits('toast.success'), description: tHabits('toast.saveSuccess') });
            setIsHabitsEditing(false);
        } catch (error) {
            toast({ title: tHabits('toast.error'), variant: 'destructive' });
        }
    };

    const handleHabitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setHabitsFormData(prev => ({ ...prev, [name]: value }));
    };

    const isLoading = isLoadingPersonalHistory || isLoadingFamilyHistory || isLoadingAllergies ||
        isLoadingMedications || isLoadingPatientHabits;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full md:col-span-2" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal History */}
            <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <User className="w-5 h-5 text-primary mr-2" />
                        <h3 className="text-lg font-bold text-card-foreground">{t('personalTitle')}</h3>
                    </div>
                    <Button variant="default" size="icon" onClick={() => handleOpenPersonalDialog()}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="space-y-3">
                    {personalHistory.length > 0 ? (
                        personalHistory.map((item, idx) => (
                            <div key={idx} className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 py-2 flex justify-between items-center">
                                <div>
                                    <div className="font-semibold text-foreground">{item.nombre}</div>
                                    {item.comentarios && <div className="text-sm text-muted-foreground">{item.comentarios}</div>}
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenPersonalDialog(item)}>
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeletePersonal(item)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">{t('noData.personal')}</p>
                    )}
                </div>
            </div>

            {/* Medications */}
            <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <Pill className="w-5 h-5 text-green-500 mr-2" />
                        <h3 className="text-lg font-bold text-card-foreground">{t('medicationsTitle')}</h3>
                    </div>
                    <Button variant="default" size="icon" onClick={() => handleOpenMedicationDialog()}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="space-y-3">
                    {medications.length > 0 ? (
                        medications.map((item, idx) => (
                            <div key={idx} className="border-l-4 border-green-300 dark:border-green-700 pl-4 py-2 flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="font-semibold text-foreground">{item.nombre_medicamento}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {item.dosis} - {item.frecuencia}
                                    </div>
                                    {(item.fecha_inicio || item.fecha_fin) && (
                                        <div className="text-sm text-muted-foreground">
                                            {item.fecha_inicio && `From: ${item.fecha_inicio}`}
                                            {item.fecha_inicio && item.fecha_fin && ' - '}
                                            {item.fecha_fin && `To: ${item.fecha_fin}`}
                                        </div>
                                    )}
                                    {item.motivo && <div className="text-sm text-muted-foreground">{item.motivo}</div>}
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenMedicationDialog(item)}>
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteMedication(item)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">{t('noData.medications')}</p>
                    )}
                </div>
            </div>

            {/* Family History */}
            <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <Heart className="w-5 h-5 text-red-500 mr-2" />
                        <h3 className="text-lg font-bold text-card-foreground">{t('familyTitle')}</h3>
                    </div>
                    <Button variant="default" size="icon" onClick={() => handleOpenFamilyDialog()}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="space-y-3">
                    {familyHistory.length > 0 ? (
                        familyHistory.map((item, idx) => (
                            <div key={idx} className="border-l-4 border-red-300 dark:border-red-700 pl-4 py-2 flex justify-between items-center">
                                <div>
                                    <div className="font-semibold text-foreground">{item.nombre}</div>
                                    <div className="text-sm text-muted-foreground">{t('relative')}: {item.parentesco}</div>
                                    {item.comentarios && <div className="text-sm text-muted-foreground">{item.comentarios}</div>}
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenFamilyDialog(item)}>
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteFamily(item)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">{t('noData.family')}</p>
                    )}
                </div>
            </div>

            {/* Allergies */}
            <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                        <h3 className="text-lg font-bold text-card-foreground">{t('allergiesTitle')}</h3>
                    </div>
                    <Button variant="default" size="icon" onClick={() => handleOpenAllergyDialog()}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="space-y-3">
                    {allergies.length > 0 ? (
                        allergies.map((item, idx) => (
                            <div key={idx} className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex justify-between items-center">
                                <div>
                                    <div className="font-semibold text-destructive">{item.alergeno}</div>
                                    {item.reaccion_descrita && <div className="text-sm text-destructive/80">{item.reaccion_descrita}</div>}
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAllergyDialog(item)}>
                                        <Edit3 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteAllergy(item)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">{t('noData.allergies')}</p>
                    )}
                </div>
            </div>

            {/* Habits - Full Width */}
            <Card className="md:col-span-2 shadow-sm border">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <Wind className="w-5 h-5 text-purple-500 mr-2" />
                            <CardTitle className="text-lg font-bold">{tHabits('title')}</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsHabitsEditing(!isHabitsEditing)}>
                            <Edit3 className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingPatientHabits ? (
                        <p>Loading...</p>
                    ) : isHabitsEditing ? (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="tabaquismo">{tHabits('smoking')}</Label>
                                <Input
                                    id="tabaquismo"
                                    name="tabaquismo"
                                    value={habitsFormData.tabaquismo || ''}
                                    onChange={handleHabitsChange}
                                    placeholder={tHabits('smokingPlaceholder')}
                                />
                            </div>
                            <div>
                                <Label htmlFor="alcoholismo">{tHabits('alcohol')}</Label>
                                <Input
                                    id="alcoholismo"
                                    name="alcoholismo"
                                    value={habitsFormData.alcoholismo || ''}
                                    onChange={handleHabitsChange}
                                    placeholder={tHabits('alcoholPlaceholder')}
                                />
                            </div>
                            <div>
                                <Label htmlFor="bruxismo">{tHabits('bruxism')}</Label>
                                <Input
                                    id="bruxismo"
                                    name="bruxismo"
                                    value={habitsFormData.bruxismo || ''}
                                    onChange={handleHabitsChange}
                                    placeholder={tHabits('bruxismPlaceholder')}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsHabitsEditing(false)}>{tHabits('cancel')}</Button>
                                <Button onClick={handleSaveHabits} disabled={isSubmittingHabits}>
                                    {isSubmittingHabits && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {tHabits('save')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <Wind className="w-5 h-5 text-muted-foreground mt-1" />
                                <div>
                                    <h4 className="font-semibold">{tHabits('smoking')}</h4>
                                    <p className="text-sm text-foreground/80">{habitsFormData.tabaquismo || tHabits('noData')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <GlassWater className="w-5 h-5 text-muted-foreground mt-1" />
                                <div>
                                    <h4 className="font-semibold">{tHabits('alcohol')}</h4>
                                    <p className="text-sm text-foreground/80">{habitsFormData.alcoholismo || tHabits('noData')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Smile className="w-5 h-5 text-muted-foreground mt-1" />
                                <div>
                                    <h4 className="font-semibold">{tHabits('bruxism')}</h4>
                                    <p className="text-sm text-foreground/80">{habitsFormData.bruxismo || tHabits('noData')}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Personal History Dialog */}
            <Dialog open={isPersonalDialogOpen} onOpenChange={setIsPersonalDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>{editingPersonalItem ? t('dialogs.personal.editTitle') : t('dialogs.personal.addTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitPersonal}>
                        <DialogBody className="space-y-6 px-6 py-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.ailment')}</Label>
                                <Popover open={isPersonalComboboxOpen} onOpenChange={setIsPersonalComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-10 border-input hover:bg-accent hover:text-accent-foreground">
                                            {personalAilmentName || t('dialogs.selectAilment')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                        <Command>
                                            <CommandInput placeholder={t('dialogs.searchAilment')} className="h-9" />
                                            <CommandList>
                                                <CommandEmpty>{t('dialogs.noAilmentFound')}</CommandEmpty>
                                                <CommandGroup>
                                                    {ailmentsCatalog.map((ailment) => (
                                                        <CommandItem
                                                            key={ailment.id}
                                                            value={ailment.nombre}
                                                            onSelect={(value) => {
                                                                setPersonalAilmentName(value);
                                                                setIsPersonalComboboxOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", personalAilmentName === ailment.nombre ? "opacity-100" : "opacity-0")} />
                                                            {ailment.nombre}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.comments')}</Label>
                                <Textarea
                                    value={personalComentarios}
                                    onChange={(e) => setPersonalComentarios(e.target.value)}
                                    placeholder={t('dialogs.commentsPlaceholder')}
                                    className="min-h-[120px] resize-none"
                                />
                            </div>
                        </DialogBody>
                        <DialogFooter className="px-6 py-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsPersonalDialogOpen(false)}>
                                {t('dialogs.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmittingPersonal} className="px-8">
                                {isSubmittingPersonal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('dialogs.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Family History Dialog */}
            <Dialog open={isFamilyDialogOpen} onOpenChange={setIsFamilyDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>{editingFamilyItem ? t('dialogs.family.editTitle') : t('dialogs.family.addTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitFamily}>
                        <DialogBody className="space-y-6 px-6 py-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.ailment')}</Label>
                                <Popover open={isFamilyComboboxOpen} onOpenChange={setIsFamilyComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-10 border-input">
                                            {familyAilmentName || t('dialogs.selectAilment')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                        <Command>
                                            <CommandInput placeholder={t('dialogs.searchAilment')} className="h-9" />
                                            <CommandList>
                                                <CommandEmpty>{t('dialogs.noAilmentFound')}</CommandEmpty>
                                                <CommandGroup>
                                                    {ailmentsCatalog.map((ailment) => (
                                                        <CommandItem
                                                            key={ailment.id}
                                                            value={ailment.nombre}
                                                            onSelect={(value) => {
                                                                setFamilyAilmentName(value);
                                                                setIsFamilyComboboxOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", familyAilmentName === ailment.nombre ? "opacity-100" : "opacity-0")} />
                                                            {ailment.nombre}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.family.relationship')}</Label>
                                <Input
                                    value={familyParentesco}
                                    onChange={(e) => setFamilyParentesco(e.target.value)}
                                    placeholder={t('dialogs.family.selectRelationship')}
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.comments')}</Label>
                                <Textarea
                                    value={familyComentarios}
                                    onChange={(e) => setFamilyComentarios(e.target.value)}
                                    placeholder={t('dialogs.commentsPlaceholder')}
                                    className="min-h-[120px] resize-none"
                                />
                            </div>
                        </DialogBody>
                        <DialogFooter className="px-6 py-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsFamilyDialogOpen(false)}>
                                {t('dialogs.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmittingFamily} className="px-8">
                                {isSubmittingFamily && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('dialogs.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Allergy Dialog */}
            <Dialog open={isAllergyDialogOpen} onOpenChange={setIsAllergyDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>{editingAllergyItem ? t('dialogs.allergy.editTitle') : t('dialogs.allergy.addTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAllergy}>
                        <DialogBody className="space-y-6 px-6 py-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.allergy.allergen')}</Label>
                                <Input
                                    value={allergyAlergeno}
                                    onChange={(e) => setAllergyAlergeno(e.target.value)}
                                    placeholder={t('dialogs.allergy.allergenPlaceholder')}
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.allergy.reaction')}</Label>
                                <Textarea
                                    value={allergyReaccion}
                                    onChange={(e) => setAllergyReaccion(e.target.value)}
                                    placeholder={t('dialogs.allergy.reactionPlaceholder')}
                                    className="min-h-[120px] resize-none"
                                />
                            </div>
                        </DialogBody>
                        <DialogFooter className="px-6 py-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsAllergyDialogOpen(false)}>
                                {t('dialogs.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmittingAllergy} className="px-8">
                                {isSubmittingAllergy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('dialogs.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Medication Dialog */}
            <Dialog open={isMedicationDialogOpen} onOpenChange={setIsMedicationDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>{editingMedicationItem ? t('dialogs.medication.editTitle') : t('dialogs.medication.addTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitMedication}>
                        <DialogBody className="space-y-6 px-6 py-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.medication.name')}</Label>
                                <Popover open={isMedicationComboboxOpen} onOpenChange={setIsMedicationComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-10 border-input">
                                            {selectedMedication?.nombre_generico || medicationSearchTerm || t('dialogs.medication.selectMedication')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                        <Command>
                                            <CommandInput
                                                placeholder={t('dialogs.medication.searchMedication')}
                                                value={medicationSearchTerm}
                                                onValueChange={setMedicationSearchTerm}
                                                className="h-9"
                                            />
                                            <CommandList>
                                                <CommandEmpty>{t('dialogs.medication.noMedicationFound')}</CommandEmpty>
                                                <CommandGroup>
                                                    {medicationsCatalog.map((med) => (
                                                        <CommandItem
                                                            key={med.id}
                                                            value={med.nombre_generico}
                                                            onSelect={(value) => {
                                                                setSelectedMedication(med);
                                                                setMedicationSearchTerm(value);
                                                                setIsMedicationComboboxOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", selectedMedication?.nombre_generico === med.nombre_generico ? "opacity-100" : "opacity-0")} />
                                                            {med.nombre_generico}
                                                            {med.nombre_comercial && <span className="text-muted-foreground ml-1 text-xs">({med.nombre_comercial})</span>}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">{t('dialogs.medication.dose')}</Label>
                                    <Input
                                        value={medicationDosis}
                                        onChange={(e) => setMedicationDosis(e.target.value)}
                                        placeholder={t('dialogs.medication.dosePlaceholder')}
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">{t('dialogs.medication.frequency')}</Label>
                                    <Input
                                        value={medicationFrecuencia}
                                        onChange={(e) => setMedicationFrecuencia(e.target.value)}
                                        placeholder={t('dialogs.medication.frequencyPlaceholder')}
                                        className="h-10"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">{t('dialogs.medication.startDate')}</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal h-10 border-input",
                                                    !medicationFechaInicio && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {medicationFechaInicio ? medicationFechaInicio : t('dialogs.medication.startDatePlaceholder')}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={medicationFechaInicio ? new Date(medicationFechaInicio) : undefined}
                                                onSelect={(date) => setMedicationFechaInicio(date ? date.toISOString().split('T')[0] : '')}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">{t('dialogs.medication.endDate')}</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal h-10 border-input",
                                                    !medicationFechaFin && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {medicationFechaFin ? medicationFechaFin : t('dialogs.medication.endDatePlaceholder')}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={medicationFechaFin ? new Date(medicationFechaFin) : undefined}
                                                onSelect={(date) => setMedicationFechaFin(date ? date.toISOString().split('T')[0] : '')}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('dialogs.medication.reason')}</Label>
                                <Textarea
                                    value={medicationMotivo}
                                    onChange={(e) => setMedicationMotivo(e.target.value)}
                                    placeholder={t('dialogs.medication.reasonPlaceholder')}
                                    className="min-h-[100px] resize-none"
                                />
                            </div>
                        </DialogBody>
                        <DialogFooter className="px-6 py-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsMedicationDialogOpen(false)}>
                                {t('dialogs.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmittingMedication} className="px-8">
                                {isSubmittingMedication && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('dialogs.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Personal History Confirmation Dialog */}
            <Dialog open={!!deletingPersonalItem} onOpenChange={() => setDeletingPersonalItem(null)}>
                <DialogContent maxWidth="sm">
                    <DialogHeader>
                        <DialogTitle>{t('common.delete')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-6 px-6">
                        <p className="text-muted-foreground">{t('common.confirmDelete')}</p>
                    </DialogBody>
                    <DialogFooter className="px-6 py-4 border-t gap-2">
                        <Button variant="outline" onClick={() => setDeletingPersonalItem(null)}>
                            {t('dialogs.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDeletePersonal} disabled={isSubmittingPersonal} className="px-8">
                            {isSubmittingPersonal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Family History Confirmation Dialog */}
            <Dialog open={!!deletingFamilyItem} onOpenChange={() => setDeletingFamilyItem(null)}>
                <DialogContent maxWidth="sm">
                    <DialogHeader>
                        <DialogTitle>{t('common.delete')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-6 px-6">
                        <p className="text-muted-foreground">{t('common.confirmDelete')}</p>
                    </DialogBody>
                    <DialogFooter className="px-6 py-4 border-t gap-2">
                        <Button variant="outline" onClick={() => setDeletingFamilyItem(null)}>
                            {t('dialogs.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteFamily} disabled={isSubmittingFamily} className="px-8">
                            {isSubmittingFamily && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Allergy Confirmation Dialog */}
            <Dialog open={!!deletingAllergyItem} onOpenChange={() => setDeletingAllergyItem(null)}>
                <DialogContent maxWidth="sm">
                    <DialogHeader>
                        <DialogTitle>{t('common.delete')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-6 px-6">
                        <p className="text-muted-foreground">{t('common.confirmDelete')}</p>
                    </DialogBody>
                    <DialogFooter className="px-6 py-4 border-t gap-2">
                        <Button variant="outline" onClick={() => setDeletingAllergyItem(null)}>
                            {t('dialogs.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteAllergy} disabled={isSubmittingAllergy} className="px-8">
                            {isSubmittingAllergy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Medication Confirmation Dialog */}
            <Dialog open={!!deletingMedicationItem} onOpenChange={() => setDeletingMedicationItem(null)}>
                <DialogContent maxWidth="sm">
                    <DialogHeader>
                        <DialogTitle>{t('common.delete')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-6 px-6">
                        <p className="text-muted-foreground">{t('common.confirmDelete')}</p>
                    </DialogBody>
                    <DialogFooter className="px-6 py-4 border-t gap-2">
                        <Button variant="outline" onClick={() => setDeletingMedicationItem(null)}>
                            {t('dialogs.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteMedication} disabled={isSubmittingMedication} className="px-8">
                            {isSubmittingMedication && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Treatment Timeline Component with CRUD
interface TreatmentTimelineProps {
    sessions: PatientSession[];
    isLoading: boolean;
    userId: string;
    doctors: { id: string; name: string }[];
    isLoadingDoctors: boolean;
    isSubmittingSession: boolean;
    onCreateSession: (userId: string, data: any, files?: File[]) => Promise<void>;
    onUpdateSession: (sessionId: number, userId: string, data: any, files?: File[], deletedAttachmentIds?: string[]) => Promise<void>;
    onDeleteSession: (sessionId: number, userId: string) => Promise<void>;
    onFetchDoctors: () => Promise<void>;
    onRefreshAll: (userId: string) => Promise<void>;
}

function TreatmentTimeline({ sessions, isLoading, userId, doctors, isLoadingDoctors, isSubmittingSession, onCreateSession, onUpdateSession, onDeleteSession, onFetchDoctors, onRefreshAll }: TreatmentTimelineProps) {
    const t = useTranslations('ClinicHistoryPage.timeline');
    const tDialog = useTranslations('ClinicHistoryPage.sessionDialog');
    const tPage = useTranslations('ClinicHistoryPage');
    const { toast } = useToast();
    const [openItems, setOpenItems] = React.useState<string[]>([]);

    const [isSessionDialogOpen, setIsSessionDialogOpen] = React.useState(false);
    const [editingSession, setEditingSession] = React.useState<PatientSession | null>(null);
    const [deletingSession, setDeletingSession] = React.useState<PatientSession | null>(null);

    // Form states for session dialog
    const [sessionForm, setSessionForm] = React.useState({
        doctor_id: '',
        doctor_name: '',
        fecha_sesion: new Date().toISOString().split('T')[0],
        procedimiento_realizado: '',
        diagnostico: '',
        notas_clinicas: '',
        plan_proxima_cita: '',
    });
    const [sessionTreatments, setSessionTreatments] = React.useState<{ numero_diente: string, descripcion: string }[]>([]);

    // Attachment states
    const [attachedFiles, setAttachedFiles] = React.useState<File[]>([]);
    const [isDragOverSession, setIsDragOverSession] = React.useState(false);
    const [existingAttachments, setExistingAttachments] = React.useState<any[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = React.useState<string[]>([]);

    const toggleItem = (id: string) => {
        setOpenItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleAddSession = () => {
        setEditingSession(null);
        setSessionForm({
            doctor_id: '',
            doctor_name: '',
            fecha_sesion: new Date().toISOString().split('T')[0],
            procedimiento_realizado: '',
            diagnostico: '',
            notas_clinicas: '',
            plan_proxima_cita: '',
        });
        setSessionTreatments([]);
        setAttachedFiles([]);
        setExistingAttachments([]);
        setDeletedAttachmentIds([]);
        onFetchDoctors();
        setIsSessionDialogOpen(true);
    };

    const handleEditSession = (session: PatientSession) => {
        setEditingSession(session);
        setSessionForm({
            doctor_id: (session as any).doctor_id || '',
            doctor_name: session.doctor_name || '',
            fecha_sesion: session.fecha_sesion ? session.fecha_sesion.split('T')[0] : new Date().toISOString().split('T')[0],
            procedimiento_realizado: session.procedimiento_realizado || '',
            diagnostico: session.diagnostico || '',
            notas_clinicas: session.notas_clinicas || '',
            plan_proxima_cita: session.plan_proxima_cita || '',
        });
        setSessionTreatments((session.tratamientos || []).map(t => ({
            numero_diente: t.numero_diente ? String(t.numero_diente) : '',
            descripcion: t.descripcion || ''
        })));
        // Load existing attachments
        setExistingAttachments((session as any).attachments || []);
        setAttachedFiles([]);
        setDeletedAttachmentIds([]);
        onFetchDoctors();
        setIsSessionDialogOpen(true);
    };

    const handleDeleteSession = (session: PatientSession) => {
        setDeletingSession(session);
    };

    const confirmDeleteSession = async () => {
        if (!deletingSession) return;
        try {
            await onDeleteSession(deletingSession.sesion_id, userId);
            toast({ title: t('toast.success'), description: t('toast.deleteSuccess') });
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        } finally {
            setDeletingSession(null);
        }
    };

    const handleSaveSession = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dataToSave = {
                ...sessionForm,
                tratamientos: sessionTreatments.length > 0 ? JSON.stringify(sessionTreatments.map(t => ({
                    numero_diente: t.numero_diente ? parseInt(t.numero_diente, 10) : null,
                    descripcion: t.descripcion
                }))) : undefined
            };

            if (editingSession?.sesion_id) {
                await onUpdateSession(editingSession.sesion_id, userId, dataToSave, attachedFiles, deletedAttachmentIds);
            } else {
                await onCreateSession(userId, dataToSave, attachedFiles);
            }
            toast({ title: t('toast.success'), description: t('toast.saveSuccess') });
            setIsSessionDialogOpen(false);
            onRefreshAll(userId);
        } catch (error) {
            toast({ title: t('toast.error'), variant: 'destructive' });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
        }
    };

    const handleRemoveNewFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDeleteExistingAttachment = (attachmentId: string) => {
        setDeletedAttachmentIds(prev => [...prev, attachmentId]);
        setExistingAttachments(prev => prev.filter((a: any) => a.id !== attachmentId));
    };

    const handleUndoDeleteAttachment = (attachment: any) => {
        setDeletedAttachmentIds(prev => prev.filter(id => id !== attachment.id));
        setExistingAttachments(prev => [...prev, attachment]);
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '';
        try {
            return format(parseISO(dateString), 'dd/MM/yyyy');
        } catch {
            return '';
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">{t('title')}</h3>
                            <p className="text-sm text-muted-foreground">{sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'} registradas</p>
                        </div>
                    </div>
                    <Button onClick={handleAddSession}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('addSession')}
                    </Button>
                </div>

                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-xl gap-3">
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="w-7 h-7" />
                        </div>
                        <p className="text-sm">{t('noSessions')}</p>
                        <Button size="sm" variant="outline" onClick={handleAddSession}>
                            <Plus className="w-3 h-3 mr-1" />
                            {t('addFirstSession')}
                        </Button>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-muted to-muted"></div>
                        {sessions.map((session, index) => {
                            const Icon = session.tipo_sesion === 'odontograma' ? Smile : Stethoscope;
                            const isOpen = openItems.includes(String(session.sesion_id));

                            return (
                                <div key={index} className="relative flex items-start mb-6 last:mb-0 pl-8">
                                    <div className="absolute left-0 top-0 z-10 w-6 h-6 rounded-full border-2 border-background shadow-md bg-card flex items-center justify-center">
                                        <Icon className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <Card className="flex-1 hover:shadow-md transition-shadow duration-200 border-muted/60">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <CardTitle className="text-base font-semibold">{session.procedimiento_realizado || t('noTitle')}</CardTitle>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                            <CalendarIcon className="h-3.5 w-3.5" />
                                                            {formatDate(session.fecha_sesion)}
                                                        </p>
                                                        {session.doctor_name && (
                                                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                                <User className="h-3.5 w-3.5" />
                                                                {session.doctor_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-md font-medium">
                                                        {session.tipo_sesion === 'odontograma' ? t('odontogramTooltip') : session.tipo_sesion}
                                                    </span>
                                                    {session.tipo_sesion !== 'odontograma' && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={() => handleEditSession(session)}>{tPage('common.edit')}</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDeleteSession(session)} className="text-destructive">{tPage('common.delete')}</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <Collapsible open={isOpen} onOpenChange={() => toggleItem(String(session.sesion_id))}>
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" size="sm" className="w-full justify-start px-4 py-1 h-7 text-xs text-muted-foreground hover:text-foreground">
                                                    {isOpen ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                                    {isOpen ? t('hideDetails') || 'Ocultar detalles' : t('showDetails') || 'Ver detalles'}
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <CardContent className="pt-0 pb-3 space-y-2">
                                                    {session.diagnostico && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('diagnosis')}</p>
                                                            <p className="text-sm">{session.diagnostico}</p>
                                                        </div>
                                                    )}
                                                    {session.notas_clinicas && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('notes') || 'Notas clínicas'}</p>
                                                            <p className="text-sm">{session.notas_clinicas}</p>
                                                        </div>
                                                    )}
                                                    {session.plan_proxima_cita && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('nextPlan') || 'Plan próxima cita'}</p>
                                                            <p className="text-sm">{session.plan_proxima_cita}</p>
                                                        </div>
                                                    )}
                                                    {session.tratamientos && session.tratamientos.length > 0 && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('treatments') || 'Tratamientos'}</p>
                                                            <div className="space-y-1">
                                                                {session.tratamientos.map((tr: any, i: number) => (
                                                                    <div key={i} className="flex items-center gap-2 text-sm">
                                                                        {tr.numero_diente && (
                                                                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{t('tooth') || 'Diente'} {tr.numero_diente}</span>
                                                                        )}
                                                                        <span>{tr.descripcion}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(session as any).attachments && (session as any).attachments.length > 0 && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('attachments') || 'Adjuntos'}</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {(session as any).attachments.map((att: any, i: number) => (
                                                                    <span key={i} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                                                                        <FileText className="h-3 w-3" />
                                                                        {att.nombre || att.name || 'File'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Session Dialog */}
            <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
                <DialogContent maxWidth="4xl">
                    <DialogHeader>
                        <DialogTitle>{editingSession ? tDialog('editTitle') : tDialog('createTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveSession}>
                        <DialogBody className="space-y-4 px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column: General Info */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{tDialog('date')}</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal h-10 border-input",
                                                            !sessionForm.fecha_sesion && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {sessionForm.fecha_sesion
                                                            ? format(new Date(sessionForm.fecha_sesion + 'T00:00:00'), 'dd/MM/yyyy')
                                                            : tDialog('date')}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <DatePicker
                                                        mode="single"
                                                        selected={sessionForm.fecha_sesion ? new Date(sessionForm.fecha_sesion + 'T00:00:00') : undefined}
                                                        onSelect={(date) => setSessionForm({ ...sessionForm, fecha_sesion: date ? date.toISOString().split('T')[0] : '' })}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{tDialog('doctor')}</Label>
                                            <Select
                                                value={sessionForm.doctor_id}
                                                onValueChange={(value) => {
                                                    const selectedDoc = doctors.find(d => d.id === value);
                                                    setSessionForm({ 
                                                        ...sessionForm, 
                                                        doctor_id: value,
                                                        doctor_name: selectedDoc?.name || ''
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder={tDialog('selectDoctor')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {doctors.map((doc) => (
                                                        <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{tDialog('procedure')}</Label>
                                        <Input
                                            value={sessionForm.procedimiento_realizado}
                                            onChange={(e) => setSessionForm({ ...sessionForm, procedimiento_realizado: e.target.value })}
                                            placeholder={tDialog('procedurePlaceholder')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{tDialog('diagnosis')}</Label>
                                        <Textarea
                                            value={sessionForm.diagnostico}
                                            onChange={(e) => setSessionForm({ ...sessionForm, diagnostico: e.target.value })}
                                            placeholder={tDialog('diagnosisPlaceholder')}
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{tDialog('notes')}</Label>
                                        <Textarea
                                            value={sessionForm.notas_clinicas}
                                            onChange={(e) => setSessionForm({ ...sessionForm, notas_clinicas: e.target.value })}
                                            placeholder={tDialog('notesPlaceholder')}
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{tDialog('nextSessionPlan')}</Label>
                                        <Input
                                            value={sessionForm.plan_proxima_cita}
                                            onChange={(e) => setSessionForm({ ...sessionForm, plan_proxima_cita: e.target.value })}
                                            placeholder={tDialog('nextSessionPlanPlaceholder')}
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Treatments & Attachments */}
                                <div className="space-y-4">
                                    <Card className="shadow-none border bg-muted/5">
                                        <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
                                            <CardTitle className="text-sm font-bold">{tDialog('treatments') || 'Trabajos'}</CardTitle>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setSessionTreatments([...sessionTreatments, { numero_diente: '', descripcion: '' }])} className="h-7 px-2 text-xs">
                                                <Plus className="h-3 w-3 mr-1" />
                                                {tDialog('addTreatment') || 'Añadir'}
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="p-2 pt-0">
                                            <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
                                                {sessionTreatments.length === 0 ? (
                                                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground italic border border-dashed rounded-md">
                                                        No treatments added yet.
                                                    </div>
                                                ) : sessionTreatments.map((treatment, index) => (
                                                    <div key={index} className="flex gap-2 items-start p-2 bg-background border rounded-md">
                                                        <Input
                                                            type="number"
                                                            placeholder={tDialog('tooth') || 'Diente'}
                                                            value={treatment.numero_diente}
                                                            onChange={(e) => {
                                                                const newTreatments = [...sessionTreatments];
                                                                newTreatments[index].numero_diente = e.target.value;
                                                                setSessionTreatments(newTreatments);
                                                            }}
                                                            className="h-7 text-xs px-2 w-16"
                                                        />
                                                        <Textarea
                                                            placeholder={tDialog('treatmentPlaceholder') || 'Descripción...'}
                                                            value={treatment.descripcion}
                                                            onChange={(e) => {
                                                                const newTreatments = [...sessionTreatments];
                                                                newTreatments[index].descripcion = e.target.value;
                                                                setSessionTreatments(newTreatments);
                                                            }}
                                                            className="min-h-[28px] h-7 text-xs p-1 flex-1 resize-none"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive"
                                                            onClick={() => setSessionTreatments(sessionTreatments.filter((_, i) => i !== index))}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Attachments Section */}
                                    <Card className="shadow-none border bg-muted/5">
                                        <CardHeader className="py-2 px-3">
                                            <CardTitle className="text-sm font-bold">{tDialog('attachments')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-3">
                                            {/* Drag and Drop Area */}
                                            <div
                                                className={cn(
                                                    "border-2 border-dashed rounded-lg p-4 transition-colors",
                                                    isDragOverSession ? "border-primary bg-primary/10" : "border-muted-foreground/25"
                                                )}
                                                onDragOver={(e) => { e.preventDefault(); setIsDragOverSession(true); }}
                                                onDragLeave={() => setIsDragOverSession(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDragOverSession(false);
                                                    if (e.dataTransfer.files?.length) {
                                                        setAttachedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                                                    }
                                                }}
                                            >
                                                <div className="flex flex-col items-center text-center">
                                                    <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                                                    <p className="text-xs text-muted-foreground mb-2">{tDialog('dragDropFiles')}</p>
                                                    <Input
                                                        type="file"
                                                        multiple
                                                        className="hidden"
                                                        id="session-file-upload"
                                                        onChange={handleFileChange}
                                                    />
                                                    <Label htmlFor="session-file-upload" className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                                                        {tDialog('browseFiles')}
                                                    </Label>
                                                </div>
                                            </div>

                                            {/* Existing Attachments */}
                                            {existingAttachments.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">{tDialog('existingAttachments')}</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {existingAttachments.map((attachment: any, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs">
                                                                <File className="w-3 h-3" />
                                                                <span className="truncate max-w-[100px]">{attachment.nombre || attachment.name || 'File'}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 text-destructive"
                                                                    onClick={() => handleDeleteExistingAttachment(attachment.id)}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* New Attached Files */}
                                            {attachedFiles.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">{tDialog('newAttachments')}</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {attachedFiles.map((file, idx) => (
                                                            <div key={idx} className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1 text-xs">
                                                                <File className="w-3 h-3" />
                                                                <span className="truncate max-w-[100px]">{file.name}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4"
                                                                    onClick={() => handleRemoveNewFile(idx)}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </DialogBody>
                        <DialogFooter className="px-6 py-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsSessionDialogOpen(false)}>
                                {tDialog('cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmittingSession} className="px-8">
                                {isSubmittingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {tDialog('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingSession} onOpenChange={() => setDeletingSession(null)}>
                <DialogContent maxWidth="sm">
                    <DialogHeader>
                        <DialogTitle>{tPage('common.delete')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-6 px-6">
                        <p className="text-muted-foreground">{tDialog('deleteConfirm')}</p>
                    </DialogBody>
                    <DialogFooter className="px-6 py-4 border-t gap-2">
                        <Button variant="outline" onClick={() => setDeletingSession(null)}>
                            {tDialog('cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteSession} className="px-8">
                            {tPage('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}



// Document Viewer Modal Component
interface DocumentViewerModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    document: { id: string; name: string; mimeType?: string } | null;
    documentContent: string | null;
    isLoadingDocument?: boolean;
    onLoadDocument: (doc: { id: string; name: string; mimeType?: string }) => void;
}

function DocumentViewerModal({ isOpen, onOpenChange, document, documentContent, isLoadingDocument, onLoadDocument }: DocumentViewerModalProps) {
    const [zoom, setZoom] = React.useState(1);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
    const imageRef = React.useRef<HTMLImageElement>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!imageRef.current) return;
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging || !imageRef.current) return;
        e.preventDefault();
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom((prev) => Math.max(0.1, Math.min(prev * zoomFactor, 5)));
    };

    React.useEffect(() => {
        if (isOpen && document) {
            onLoadDocument(document);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen, document]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="4xl" className="h-[90vh] flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>{document?.name}</DialogTitle>
                </DialogHeader>
                <DialogBody className="p-0 overflow-hidden flex-1 flex flex-col relative"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    {isLoadingDocument ? (
                        <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Cargando documento...</p>
                        </div>
                    ) : documentContent ? (
                        document?.mimeType?.startsWith('image/') || document?.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <div className="flex-1 w-full h-full overflow-hidden flex items-center justify-center relative bg-muted/20">
                                <Image
                                    ref={imageRef}
                                    src={documentContent}
                                    alt={document?.name || 'Document'}
                                    fill
                                    className="object-contain cursor-grab transform-gpu"
                                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
                                    onMouseDown={handleMouseDown}
                                    unoptimized
                                />
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 p-2 rounded-lg backdrop-blur-sm">
                                    <Button variant="outline" size="icon" onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.2))}><ZoomOut className="h-4 w-4" /></Button>
                                    <span className='text-sm font-medium w-16 text-center bg-transparent'>{(zoom * 100).toFixed(0)}%</span>
                                    <Button variant="outline" size="icon" onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))}><ZoomIn className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="icon" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}><RotateCcw className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ) : (
                            <iframe src={documentContent} className="h-full w-full border-0 flex-1" title={document?.name} />
                        )
                    ) : (
                        <div className="flex-1 flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}

// Enhanced Documents Gallery with thumbnails and viewer
interface EnhancedDocumentsGalleryProps {
    documents: any[];
    isLoading: boolean;
    userId: string;
    uploadDocument: (userId: string, file: File) => Promise<void>;
    deleteDocument: (userId: string, docId: string) => Promise<void>;
    getDocumentContent: (userId: string, docId: string) => Promise<Blob>;
}

function EnhancedDocumentsGallery({ documents, isLoading, userId, uploadDocument, deleteDocument, getDocumentContent }: EnhancedDocumentsGalleryProps) {
    const t = useTranslations('ClinicHistoryPage');
    const { toast } = useToast();
    const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
    const [uploadFile, setUploadFile] = React.useState<File | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [selectedDocument, setSelectedDocument] = React.useState<{ id: string; name: string; mimeType?: string } | null>(null);
    const [documentContent, setDocumentContent] = React.useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = React.useState(false);
    const [isLoadingDocument, setIsLoadingDocument] = React.useState(false);
    const [deletingDocument, setDeletingDocument] = React.useState<{ id: string; name: string } | null>(null);

    const handleUpload = async () => {
        if (!uploadFile || !userId) return;
        setIsUploading(true);
        try {
            await uploadDocument(userId, uploadFile);
            toast({ title: t('documents.uploadSuccess') });
            setIsUploadDialogOpen(false);
            setUploadFile(null);
        } catch (error) {
            toast({ title: t('documents.uploadError'), variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = (doc: { id: string; nombre?: string; name?: string }) => {
        setDeletingDocument({ id: doc.id, name: doc.nombre || doc.name || 'Document' });
    };

    const confirmDeleteDocument = async () => {
        if (!deletingDocument || !userId) return;
        try {
            await deleteDocument(userId, deletingDocument.id);
            toast({ title: t('documents.deleteSuccess') });
        } catch (error) {
            toast({ title: t('documents.deleteError'), variant: 'destructive' });
        } finally {
            setDeletingDocument(null);
        }
    };

    const handleViewDocument = async (doc: any) => {
        setSelectedDocument({ 
            id: doc.id, 
            name: doc.nombre || doc.name || 'Document', 
            mimeType: doc.mimeType || doc.tipo || ''
        });
        setIsViewerOpen(true);
        setDocumentContent(null);
        setIsLoadingDocument(true);
        try {
            const blob = await getDocumentContent(userId, doc.id);
            const url = URL.createObjectURL(blob);
            setDocumentContent(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: "Could not load document." });
            setIsViewerOpen(false);
        } finally {
            setIsLoadingDocument(false);
        }
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '';
        try {
            return format(parseISO(dateString), 'PP');
        } catch {
            return '';
        }
    };

    const isImageFile = (filename: string) => {
        return filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    return (
        <>
            <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-card-foreground">{t('tabs.documents')}</h3>
                    <Button onClick={() => setIsUploadDialogOpen(true)} variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        {t('documents.add')}
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(4)].map((_, i) => <Skeleton className="h-48 w-full" key={i} />)}
                    </div>
                ) : documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.map((doc, idx) => {
                            const isImage = isImageFile(doc.nombre || doc.name || '');
                            const docName = doc.nombre || doc.name || 'Document';
                            return (
                                <Card key={idx} className="overflow-hidden">
                                    <CardContent className="p-0 flex flex-col justify-between h-full">
                                        <div className="relative aspect-video w-full bg-muted cursor-pointer group" onClick={() => handleViewDocument(doc)}>
                                            {isImage ? (
                                                <Image
                                                    src={doc.thumbnail_url || doc.ruta ? `${process.env.NEXT_PUBLIC_API_URL}${doc.thumbnail_url || doc.ruta}` : ''}
                                                    alt={docName}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <FileText className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Eye className="h-6 w-6 text-white" />
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <p className="font-semibold text-sm truncate leading-tight" title={docName}>{docName}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{doc.mimeType || doc.tipo || ''}</p>
                                        </div>
                                        <div className="flex justify-end p-1 pt-0">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleDelete(doc)} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {t('documents.delete') || 'Delete'}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-xl gap-3">
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                            <FolderArchive className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm">{t('documents.noDocuments')}</p>
                        <Button size="sm" variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                            <Plus className="w-3 h-3 mr-1" />
                            {t('documents.add')}
                        </Button>
                    </div>
                )}
            </div>

            {/* Upload Dialog */}
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>{t('documents.upload') || t('tabs.documents')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-6 px-6 py-6">
                        <div
                            className={cn(
                                "flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/30",
                                isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragOver(false);
                                if (e.dataTransfer.files?.[0]) {
                                    setUploadFile(e.dataTransfer.files[0]);
                                }
                            }}
                            onClick={() => {
                                const input = document.getElementById('document-file-input');
                                if (input) input.click();
                            }}
                        >
                            {uploadFile ? (
                                <div className="flex flex-col items-center text-center p-4">
                                    <FileText className="w-12 h-12 mb-4 text-primary" />
                                    <p className="text-sm font-semibold truncate max-w-[250px]">{uploadFile.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setUploadFile(null); }} className="mt-4 text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <X className="w-4 h-4 mr-2" /> {t('common.cancel') || 'Remove'}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-muted-foreground p-4">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <Upload className="w-8 h-8" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-base font-medium text-foreground">{t('documentDragDropBold') || 'Click to upload'}</p>
                                        <p className="text-sm mt-1">{t('documentDragDropNormal') || 'or drag and drop'}</p>
                                        <p className="text-xs mt-2 opacity-70">{t('documentDragDropSubtext') || 'PDF, PNG, JPG or GIF (MAX. 10MB)'}</p>
                                    </div>
                                </div>
                            )}
                            <input
                                id="document-file-input"
                                type="file"
                                className="hidden"
                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                accept="image/*,.pdf,.doc,.docx"
                            />
                        </div>
                    </DialogBody>
                    <DialogFooter className="px-6 py-4 border-t gap-2">
                        <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleUpload} disabled={!uploadFile || isUploading} className="px-8">
                            {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Document Viewer Modal */}
            <DocumentViewerModal
                isOpen={isViewerOpen}
                onOpenChange={setIsViewerOpen}
                document={selectedDocument}
                documentContent={documentContent}
                isLoadingDocument={isLoadingDocument}
                onLoadDocument={() => { }}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingDocument} onOpenChange={(open) => !open && setDeletingDocument(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('documents.delete')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="py-4 px-1">
                        <p className="text-muted-foreground text-base">
                            {t('documents.confirmDelete')}
                        </p>
                    </DialogBody>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeletingDocument(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteDocument}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('documents.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}