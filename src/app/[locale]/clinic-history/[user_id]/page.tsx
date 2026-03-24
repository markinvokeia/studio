
'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import type { Ailment, AttachedFile, Document, Medication, PatientSession, User as UserType } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import {
    AlertTriangle,
    CalendarIcon,
    Check,
    ChevronDown, ChevronsUpDown,
    Clock,
    Download,
    Edit3,
    Eye,
    File,
    FileText,
    FolderArchive,
    GlassWater,
    Heart,
    Image as ImageIcon,
    Loader2,
    Maximize, Minimize,
    MoreHorizontal,
    Pill,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    SearchCheck,
    Smile,
    Stethoscope,
    Trash2,
    Upload,
    User,
    Wind,
    X,
    ZoomIn, ZoomOut
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';


const getAttachmentUrl = (path: string | null | undefined) => {
    if (!path) return '';
    try {
        new URL(path);
        if (path.includes('drive.google.com') || path.includes('lh3.googleusercontent.com')) {
            return `/api/attachment-proxy?url=${encodeURIComponent(path)}`;
        }
        return path;
    } catch (_) {
        return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
    }
};

type PersonalHistoryItem = {
    id?: number;
    padecimiento_id?: string;
    nombre: string;
    categoria?: string;
    nivel_alerta?: number;
    comentarios: string;
};
type FamilyHistoryItem = {
    id?: number;
    padecimiento_id?: string;
    nombre: string;
    parentesco: string;
    comentarios: string;
};
type AllergyItem = {
    id?: number;
    alergeno: string;
    reaccion_descrita: string;
    snomed_ct_id?: string;
};
type MedicationItem = {
    id?: number;
    medicamento_id?: string;
    medicamento_nombre: string;
    dosis: string;
    frecuencia: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    motivo: string;
};

type PatientHabits = {
    id?: number;
    tabaquismo: string | null;
    alcohol: string | null;
    bruxismo: string | null;
};

const HabitCard = ({ userId, fetchPatientHabits, habits, isLoading }: { userId: string, fetchPatientHabits: (userId: string) => void, habits: PatientHabits | null, isLoading: boolean }) => {
    const t = useTranslations('ClinicHistoryPage.habits');
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<PatientHabits>({ tabaquismo: '', alcohol: '', bruxismo: '' });

    useEffect(() => {
        if (habits) {
            setFormData(habits);
        } else {
            setFormData({ tabaquismo: '', alcohol: '', bruxismo: '' });
        }
    }, [habits]);

    const handleSave = async () => {
        try {
            const payload = { ...formData, user_id: userId };
            await api.post(API_ROUTES.CLINIC_HISTORY.PATIENT_HABITS_UPSERT, payload);
            toast({ title: t('toast.success'), description: t('toast.saveSuccess') });
            fetchPatientHabits(userId);
            setIsEditing(false);
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.error'), description: error instanceof Error ? error.message : String(error) });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <User className="w-5 h-5 text-primary mr-2" />
                    <h3 className="text-lg font-bold text-card-foreground">{t('title')}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)}>
                    <Edit3 className="h-4 w-4" />
                </Button>
            </div>
            {isLoading ? (
                <p>Loading patient habits...</p>
            ) : isEditing ? (
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="tabaquismo">{t('smoking')}</Label>
                        <Input id="tabaquismo" name="tabaquismo" value={formData.tabaquismo || ''} onChange={handleChange} placeholder={t('smokingPlaceholder')} />
                    </div>
                    <div>
                        <Label htmlFor="alcohol">{t('alcohol')}</Label>
                        <Input id="alcohol" name="alcohol" value={formData.alcohol || ''} onChange={handleChange} placeholder={t('alcoholPlaceholder')} />
                    </div>
                    <div>
                        <Label htmlFor="bruxismo">{t('bruxism')}</Label>
                        <Input id="bruxismo" name="bruxismo" value={formData.bruxismo || ''} onChange={handleChange} placeholder={t('bruxismPlaceholder')} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditing(false)}>{t('cancel')}</Button>
                        <Button onClick={handleSave}>{t('save')}</Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <Wind className="w-5 h-5 text-muted-foreground mt-1" />
                        <div>
                            <h4 className="font-semibold">{t('smoking')}</h4>
                            <p className="text-sm text-foreground/80">{habits?.tabaquismo || t('noData')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <GlassWater className="w-5 h-5 text-muted-foreground mt-1" />
                        <div>
                            <h4 className="font-semibold">{t('alcohol')}</h4>
                            <p className="text-sm text-foreground/80">{habits?.alcohol || t('noData')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <Smile className="w-5 h-5 text-muted-foreground mt-1" />
                        <div>
                            <h4 className="font-semibold">{t('bruxism')}</h4>
                            <p className="text-sm text-foreground/80">{habits?.bruxismo || t('noData')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const AnamnesisDashboard = ({
    personalHistory,
    isLoadingPersonalHistory,
    fetchPersonalHistory,
    familyHistory,
    isLoadingFamilyHistory,
    fetchFamilyHistory,
    allergies,
    isLoadingAllergies,
    fetchAllergies,
    medications,
    isLoadingMedications,
    fetchMedications,
    patientHabits,
    isLoadingPatientHabits,
    fetchPatientHabits,
    userId
}: {
    personalHistory: PersonalHistoryItem[],
    isLoadingPersonalHistory: boolean,
    fetchPersonalHistory: (userId: string) => void,
    familyHistory: FamilyHistoryItem[],
    isLoadingFamilyHistory: boolean,
    fetchFamilyHistory: (userId: string) => void,
    allergies: AllergyItem[],
    isLoadingAllergies: boolean,
    fetchAllergies: (userId: string) => void,
    medications: MedicationItem[],
    isLoadingMedications: boolean,
    fetchMedications: (userId: string) => void,
    patientHabits: PatientHabits | null,
    isLoadingPatientHabits: boolean,
    fetchPatientHabits: (userId: string) => void,
    userId: string
}) => {
    const t = useTranslations('ClinicHistoryPage');
    const { toast } = useToast();
    const [ailmentsCatalog, setAilmentsCatalog] = useState<Ailment[]>([]);
    const [medicationsCatalog, setMedicationsCatalog] = useState<Medication[]>([]);

    const [isPersonalHistoryDialogOpen, setIsPersonalHistoryDialogOpen] = useState(false);
    const [isFamilyHistoryDialogOpen, setIsFamilyHistoryDialogOpen] = useState(false);
    const [isAllergyDialogOpen, setIsAllergyDialogOpen] = useState(false);
    const [isMedicationDialogOpen, setIsMedicationDialogOpen] = useState(false);

    const [editingPersonalHistory, setEditingPersonalHistory] = useState<PersonalHistoryItem | null>(null);
    const [editingFamilyHistory, setEditingFamilyHistory] = useState<FamilyHistoryItem | null>(null);
    const [editingAllergy, setEditingAllergy] = useState<AllergyItem | null>(null);
    const [editingMedication, setEditingMedication] = useState<MedicationItem | null>(null);

    const [deletingItem, setDeletingItem] = useState<{ item: any, type: string } | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Personal History State
    const [isPersonalHistoryComboboxOpen, setIsPersonalHistoryComboboxOpen] = useState(false);
    const [selectedPersonalAilmentName, setSelectedPersonalAilmentName] = useState<string>('');
    const [personalComentarios, setPersonalComentarios] = useState('');
    const [isSubmittingPersonal, setIsSubmittingPersonal] = useState(false);
    const [personalSubmissionError, setPersonalSubmissionError] = useState<string | null>(null);

    // Family History State
    const [isFamilyHistoryComboboxOpen, setIsFamilyHistoryComboboxOpen] = useState(false);
    const [selectedFamilyAilmentName, setSelectedFamilyAilmentName] = useState<string>('');
    const [familyParentesco, setFamilyParentesco] = useState('');
    const [familyComentarios, setFamilyComentarios] = useState('');
    const [isSubmittingFamily, setIsSubmittingFamily] = useState(false);
    const [familySubmissionError, setFamilySubmissionError] = useState<string | null>(null);

    // Allergy state
    const [isSubmittingAllergy, setIsSubmittingAllergy] = useState(false);
    const [allergySubmissionError, setAllergySubmissionError] = useState<string | null>(null);
    const [allergyData, setAllergyData] = useState({ alergeno: '', reaccion_descrita: '' });

    // Medication state
    const [isMedicationComboboxOpen, setIsMedicationComboboxOpen] = useState(false);
    const [selectedMedication, setSelectedMedication] = useState<{ id: string, name: string } | null>(null);
    const [medicationSearchTerm, setMedicationSearchTerm] = useState('');
    const [isSubmittingMedication, setIsSubmittingMedication] = useState(false);
    const [medicationSubmissionError, setMedicationSubmissionError] = useState<string | null>(null);
    const [medicationData, setMedicationData] = useState({ dosis: '', frecuencia: '', fecha_inicio: '', fecha_fin: '', motivo: '' });

    useEffect(() => {
        const fetchAilments = async () => {
            if (isPersonalHistoryDialogOpen || isFamilyHistoryDialogOpen) {
                try {
                    const data = await api.get(API_ROUTES.CLINIC_HISTORY.AILMENTS_CATALOG);
                    const ailmentsData = Array.isArray(data) ? data : (data.catalogo_padecimientos || data.data || data.result || []);
                    setAilmentsCatalog(ailmentsData.map((a: any) => ({ ...a, id: String(a.id), nombre: a.nombre })));
                } catch (error) {
                    console.error("Failed to fetch ailments catalog", error);
                }
            }
        };
        fetchAilments();
    }, [isPersonalHistoryDialogOpen, isFamilyHistoryDialogOpen]);

    useEffect(() => {
        const fetchMedications = async () => {
            if (isMedicationDialogOpen && medicationSearchTerm.length > 0) {
                try {
                    const data = await api.get(API_ROUTES.CLINIC_HISTORY.MEDICATIONS_CATALOG, {
                        search: medicationSearchTerm,
                        page: '1',
                        limit: '20',
                    });

                    let medicationsData: any[] = [];

                    if (Array.isArray(data) && data.length > 0) {
                        const firstElement = data[0];
                        if (firstElement.json && typeof firstElement.json === 'object') {
                            medicationsData = firstElement.json.data || [];
                        } else if (firstElement.data) {
                            medicationsData = firstElement.data;
                        }
                    } else if (typeof data === 'object' && data !== null) {
                        const responseObj = data[0]?.json || data;
                        medicationsData = responseObj.data || [];
                    }

                    const filteredMedications = medicationsData
                        .filter((m: any) => m.id && String(m.id) !== 'undefined' && m.nombre_generico)
                        .map((m: any) => ({
                            ...m,
                            id: String(m.id),
                            nombre_generico: m.nombre_generico,
                            nombre_comercial: m.nombre_comercial
                        }));

                    setMedicationsCatalog(filteredMedications);
                } catch (error) {
                    console.error("Failed to fetch medications catalog", error);
                }
            } else {
                setMedicationsCatalog([]);
            }
        };

        const debounceTimer = setTimeout(() => {
            fetchMedications();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [isMedicationDialogOpen, medicationSearchTerm]);

    useEffect(() => {
        if (isPersonalHistoryDialogOpen) {
            if (editingPersonalHistory) {
                setSelectedPersonalAilmentName(editingPersonalHistory.nombre || '');
                setPersonalComentarios(editingPersonalHistory.comentarios || '');
            } else {
                setSelectedPersonalAilmentName('');
                setPersonalComentarios('');
            }
            setPersonalSubmissionError(null);
        } else {
            setEditingPersonalHistory(null);
        }
    }, [isPersonalHistoryDialogOpen, editingPersonalHistory]);

    useEffect(() => {
        if (isFamilyHistoryDialogOpen) {
            if (editingFamilyHistory) {
                setSelectedFamilyAilmentName(editingFamilyHistory.nombre || '');
                setFamilyParentesco(editingFamilyHistory.parentesco || '');
                setFamilyComentarios(editingFamilyHistory.comentarios || '');
            } else {
                setSelectedFamilyAilmentName('');
                setFamilyParentesco('');
                setFamilyComentarios('');
            }
            setFamilySubmissionError(null);
        } else {
            setEditingFamilyHistory(null);
        }
    }, [isFamilyHistoryDialogOpen, editingFamilyHistory]);

    useEffect(() => {
        if (isAllergyDialogOpen) {
            if (editingAllergy) {
                setAllergyData({
                    alergeno: editingAllergy.alergeno,
                    reaccion_descrita: editingAllergy.reaccion_descrita,
                });
            } else {
                setAllergyData({ alergeno: '', reaccion_descrita: '' });
            }
            setAllergySubmissionError(null);
        } else {
            setEditingAllergy(null);
        }
    }, [isAllergyDialogOpen, editingAllergy]);

    useEffect(() => {
        const formatDateForInput = (dateString: string | null) => {
            if (!dateString) return '';
            try {
                return format(parseISO(dateString), 'yyyy-MM-dd');
            } catch (e) {
                return '';
            }
        };

        if (isMedicationDialogOpen) {
            if (editingMedication) {
                setSelectedMedication({ id: String(editingMedication.medicamento_id), name: editingMedication.medicamento_nombre });
                setMedicationData({
                    dosis: editingMedication.dosis,
                    frecuencia: editingMedication.frecuencia,
                    fecha_inicio: formatDateForInput(editingMedication.fecha_inicio),
                    fecha_fin: formatDateForInput(editingMedication.fecha_fin),
                    motivo: editingMedication.motivo,
                });
            } else {
                setSelectedMedication(null);
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const today = `${year}-${month}-${day}`;
                setMedicationData({ dosis: '', frecuencia: '', fecha_inicio: today, fecha_fin: '', motivo: '' });
            }
            setMedicationSubmissionError(null);
        } else {
            setEditingMedication(null);
            setMedicationSearchTerm('');
            setMedicationsCatalog([]);
        }
    }, [isMedicationDialogOpen, editingMedication]);

    const handleSubmitPersonalHistory = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSubmittingPersonal) return;

        const selectedAilment = ailmentsCatalog.find(a => a.nombre.toLowerCase() === selectedPersonalAilmentName.toLowerCase());

        if (!selectedAilment || !userId) {
            toast({
                variant: 'destructive',
                title: t('anamnesis.toast.error'),
                description: t('anamnesis.toast.invalidAilment'),
            });
            return;
        }

        setIsSubmittingPersonal(true);
        setPersonalSubmissionError(null);

        const payload: any = {
            paciente_id: userId,
            padecimiento_id: selectedAilment.nombre,
            comentarios: personalComentarios,
        };

        if (editingPersonalHistory && editingPersonalHistory.id) {
            payload.id = editingPersonalHistory.id;
        }


        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY_UPSERT, payload);

            toast({
                title: t('anamnesis.toast.success'),
                description: t('anamnesis.toast.personalSuccess'),
            });

            setIsPersonalHistoryDialogOpen(false);
            fetchPersonalHistory(userId);
        } catch (error: any) {
            console.error('Error saving personal history:', error);
            setPersonalSubmissionError(error.message || t('anamnesis.toast.personalError'));
        } finally {
            setIsSubmittingPersonal(false);
        }
    };

    const handleSubmitFamilyHistory = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSubmittingFamily) return;

        const selectedAilment = ailmentsCatalog.find(a => a.nombre.toLowerCase() === selectedFamilyAilmentName.toLowerCase());

        if (!selectedAilment || !familyParentesco || !userId) {
            toast({
                variant: 'destructive',
                title: t('anamnesis.toast.error'),
                description: t('anamnesis.toast.requiredFields'),
            });
            return;
        }

        setIsSubmittingFamily(true);
        setFamilySubmissionError(null);

        const payload: any = {
            paciente_id: userId,
            padecimiento_id: selectedAilment.nombre,
            parentesco: familyParentesco,
            comentarios: familyComentarios,
        };

        if (editingFamilyHistory && editingFamilyHistory.id) {
            payload.id = editingFamilyHistory.id;
        }

        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY_UPSERT, payload);

            toast({
                title: t('anamnesis.toast.success'),
                description: t('anamnesis.toast.familySuccess'),
            });

            setIsFamilyHistoryDialogOpen(false);
            fetchFamilyHistory(userId);
        } catch (error: any) {
            console.error('Error saving family history:', error);
            setFamilySubmissionError(error.message || t('anamnesis.toast.familyError'));
        } finally {
            setIsSubmittingFamily(false);
        }
    };

    const handleSubmitAllergy = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSubmittingAllergy || !userId) return;

        setIsSubmittingAllergy(true);
        setAllergySubmissionError(null);

        const payload: any = {
            paciente_id: userId,
            alergeno: allergyData.alergeno,
            reaccion_descrita: allergyData.reaccion_descrita,
        };

        if (editingAllergy?.id) {
            payload.id = editingAllergy.id;
        }

        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.ALLERGIES_UPSERT, payload);
            toast({ title: t('anamnesis.toast.success'), description: t('anamnesis.toast.allergySuccess') });
            setIsAllergyDialogOpen(false);
            fetchAllergies(userId);
        } catch (error: any) {
            setAllergySubmissionError(error.message || t('anamnesis.toast.allergyError'));
        } finally {
            setIsSubmittingAllergy(false);
        }
    };

    const handleSubmitMedication = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isSubmittingMedication || !userId || !selectedMedication) return;

        // Validate required fields: medication and start date
        if (!medicationData.fecha_inicio) {
            setMedicationSubmissionError('La fecha de inicio es obligatoria');
            return;
        }

        setIsSubmittingMedication(true);
        setMedicationSubmissionError(null);

        const payload: any = {
            paciente_id: userId,
            medicamento_id: selectedMedication.id,
            medicamento_nombre: selectedMedication.name,
            dosis: medicationData.dosis,
            frecuencia: medicationData.frecuencia,
            fecha_inicio: medicationData.fecha_inicio || null,
            fecha_fin: medicationData.fecha_fin || null,
            motivo: medicationData.motivo,
        };

        if (editingMedication && editingMedication.id) {
            payload.id = editingMedication.id;
        }

        try {
            const response = await api.post(API_ROUTES.CLINIC_HISTORY.MEDICATIONS_UPSERT, payload);

            // Handle API response format
            if (response && response.code === 200) {
                const message = response.message || t('anamnesis.toast.medicationSuccess');
                toast({ title: t('anamnesis.toast.success'), description: message });
                setIsMedicationDialogOpen(false);
                fetchMedications(userId);
            } else if (response && response.code === 400) {
                const errorMessage = response.message || t('anamnesis.toast.medicationError');
                setMedicationSubmissionError(errorMessage);
            } else {
                // Fallback for unexpected response format
                toast({ title: t('anamnesis.toast.success'), description: t('anamnesis.toast.medicationSuccess') });
                setIsMedicationDialogOpen(false);
                fetchMedications(userId);
            }
        } catch (error: any) {
            // Handle network errors or non-JSON responses
            if (error.message && error.message.includes('HTTP error! status: 400')) {
                setMedicationSubmissionError(t('anamnesis.toast.medicationError'));
            } else {
                setMedicationSubmissionError(error.message || t('anamnesis.toast.medicationError'));
            }
        } finally {
            setIsSubmittingMedication(false);
        }
    };

    const handleAddPersonalClick = () => {
        setEditingPersonalHistory(null);
        setIsPersonalHistoryDialogOpen(true);
    };

    const handleEditPersonalClick = (item: PersonalHistoryItem) => {
        setEditingPersonalHistory(item);
        setIsPersonalHistoryDialogOpen(true);
    };

    const handleAddFamilyClick = () => {
        setEditingFamilyHistory(null);
        setIsFamilyHistoryDialogOpen(true);
    };

    const handleEditFamilyClick = (item: FamilyHistoryItem) => {
        setEditingFamilyHistory(item);
        setIsFamilyHistoryDialogOpen(true);
    };

    const handleAddAllergyClick = () => {
        setEditingAllergy(null);
        setIsAllergyDialogOpen(true);
    };

    const handleEditAllergyClick = (item: AllergyItem) => {
        setEditingAllergy(item);
        setIsAllergyDialogOpen(true);
    };

    const handleAddMedicationClick = () => {
        setEditingMedication(null);
        setIsMedicationDialogOpen(true);
    };

    const handleEditMedicationClick = (item: MedicationItem) => {
        setEditingMedication(item);
        setIsMedicationDialogOpen(true);
    };

    const handleDeleteClick = (item: any, type: string) => {
        setDeletingItem({ item, type });
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingItem) return;

        let endpoint = '';
        let body: any = {};
        let fetchCallback: Function | null = null;
        let itemTypeKey = '';

        switch (deletingItem.type) {
            case 'personal':
                endpoint = API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY_DELETE;
                body = { id: deletingItem.item.id };
                fetchCallback = fetchPersonalHistory;
                itemTypeKey = 'personal';
                break;
            case 'family':
                endpoint = API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY_DELETE;
                body = { id: deletingItem.item.id };
                fetchCallback = fetchFamilyHistory;
                itemTypeKey = 'family';
                break;
            case 'allergy':
                endpoint = API_ROUTES.CLINIC_HISTORY.ALLERGIES_DELETE;
                body = { id: deletingItem.item.id };
                fetchCallback = fetchAllergies;
                itemTypeKey = 'allergy';
                break;
            case 'medication':
                endpoint = API_ROUTES.CLINIC_HISTORY.MEDICATIONS_DELETE;
                body = { id: deletingItem.item.id };
                fetchCallback = fetchMedications;
                itemTypeKey = 'medication';
                break;
        }

        if (!endpoint) {
            setIsDeleteDialogOpen(false);
            return;
        }

        if (!body.id) {
            toast({
                variant: 'destructive',
                title: t('anamnesis.toast.error'),
                description: t('anamnesis.toast.genericError'),
            });
            return;
        }

        try {
            const response = await api.delete(endpoint, body);

            // Handle API response format for deletion
            if (response && response.code === 200) {
                const message = response.message || t('anamnesis.toast.deleteSuccess', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) });
                toast({
                    title: t('anamnesis.toast.success'),
                    description: message,
                });
            } else if (response && response.code === 400) {
                const errorMessage = response.message || t('anamnesis.toast.deleteError', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) });
                toast({
                    variant: 'destructive',
                    title: t('anamnesis.toast.error'),
                    description: errorMessage,
                });
                return; // Don't close dialog on error
            } else {
                // Fallback for unexpected response format
                toast({
                    title: t('anamnesis.toast.success'),
                    description: t('anamnesis.toast.deleteSuccess', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) }),
                });
            }

            setIsDeleteDialogOpen(false);
            setDeletingItem(null);

            if (fetchCallback) {
                fetchCallback(userId);
            }

        } catch (error: any) {
            console.error(`Error deleting ${deletingItem.type}:`, error);
            // Handle network errors or non-JSON responses
            let errorMessage = t('anamnesis.toast.deleteError', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) });
            if (error.message && error.message.includes('HTTP error! status: 400')) {
                errorMessage = t('anamnesis.toast.deleteError', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) });
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            toast({
                variant: 'destructive',
                title: t('anamnesis.toast.error'),
                description: errorMessage,
            });
        }
    };


    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        try {
            return format(parseISO(dateString), 'dd/MM/yyyy');
        } catch (error) {
            console.error("Invalid date format:", dateString);
            return '-';
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <User className="w-5 h-5 text-primary mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.personalTitle')}</h3>
                        </div>
                        <Button variant="default" size="icon" onClick={handleAddPersonalClick}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {isLoadingPersonalHistory ? (
                            <p className="text-muted-foreground">{t('anamnesis.loading.personal')}</p>
                        ) : personalHistory.length > 0 ? (
                            personalHistory.map((item, idx) => (
                                <div key={idx} className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 py-2 flex justify-between items-center">
                                    <div>
                                        <div className="font-semibold text-foreground">{item.nombre}</div>
                                        <div className="text-sm text-muted-foreground">{item.comentarios}</div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPersonalClick(item)}>
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'personal')}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground">{t('anamnesis.noData.personal')}</p>
                        )}
                    </div>
                </div>

                <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <Heart className="w-5 h-5 text-red-500 mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.familyTitle')}</h3>
                        </div>
                        <Button variant="default" size="icon" onClick={handleAddFamilyClick}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {isLoadingFamilyHistory ? (
                            <p className="text-muted-foreground">{t('anamnesis.loading.family')}</p>
                        ) : familyHistory.length > 0 ? (
                            familyHistory.map((item, index) => (
                                <div key={index} className="border-l-4 border-red-300 dark:border-red-700 pl-4 py-2 flex justify-between items-center">
                                    <div>
                                        <div className="font-semibold text-foreground">{item.nombre}</div>
                                        <div className="text-sm text-muted-foreground">{t('anamnesis.relative')}: {item.parentesco}</div>
                                        <div className="text-sm text-muted-foreground">{item.comentarios}</div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFamilyClick(item)}>
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'family')}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground">{t('anamnesis.noData.family')}</p>
                        )}
                    </div>
                </div>
                <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <Pill className="w-5 h-5 text-green-500 mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.medicationsTitle')}</h3>
                        </div>
                        <Button variant="default" size="icon" onClick={handleAddMedicationClick}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {isLoadingMedications ? (
                            <p className="text-muted-foreground">{t('anamnesis.loading.medications')}</p>
                        ) : medications.length > 0 ? (
                            medications.map((item, index) => (
                                <div key={index} className="border-l-4 border-green-300 dark:border-green-700 pl-4 py-2 flex justify-between items-center">
                                    <div className="grid grid-cols-3 gap-4 items-start flex-1">
                                        <div className="col-span-2">
                                            <div className="font-semibold text-foreground">{item.medicamento_nombre}</div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {formatDate(item.fecha_inicio)} - {item.fecha_fin ? formatDate(item.fecha_fin) : t('anamnesis.present')}
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">{item.motivo}</div>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">
                                            <div>{item.dosis}</div>
                                            <div>{item.frecuencia}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1 pl-4">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMedicationClick(item)}>
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'medication')}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground">{t('anamnesis.noData.medications')}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.allergiesTitle')}</h3>
                        </div>
                        <Button variant="default" size="icon" onClick={handleAddAllergyClick}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {isLoadingAllergies ? (
                            <p className="text-muted-foreground">{t('anamnesis.loading.allergies')}</p>
                        ) : allergies.length > 0 ? (
                            allergies.map((item, index) => (
                                <div key={index} className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex justify-between items-center">
                                    <div>
                                        <div className="flex justify-between items-center">
                                            <div className="font-semibold text-destructive">{item.alergeno}</div>
                                        </div>
                                        {item.reaccion_descrita && <div className="text-sm text-destructive/80">{item.reaccion_descrita}</div>}
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAllergyClick(item)}>
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'allergy')}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground">{t('anamnesis.noData.allergies')}</p>
                        )}
                    </div>
                </div>
                <HabitCard userId={userId} fetchPatientHabits={fetchPatientHabits} habits={patientHabits} isLoading={isLoadingPatientHabits} />
            </div>

            {/* Personal History Dialog */}
            <Dialog open={isPersonalHistoryDialogOpen} onOpenChange={setIsPersonalHistoryDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPersonalHistory ? t('anamnesis.dialogs.personal.editTitle') : t('anamnesis.dialogs.personal.addTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPersonalHistory ? t('anamnesis.dialogs.personal.editDescription') : t('anamnesis.dialogs.personal.addDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitPersonalHistory} className="flex flex-col h-full">
                        <DialogBody className="space-y-4 px-6 py-4">
                            <div>
                                <Label htmlFor="personal-ailment">{t('anamnesis.dialogs.ailment')}</Label>
                                <Popover open={isPersonalHistoryComboboxOpen} onOpenChange={setIsPersonalHistoryComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {selectedPersonalAilmentName || t('anamnesis.dialogs.selectAilment')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput placeholder={t('anamnesis.dialogs.searchAilment')} />
                                            <CommandList>
                                                <CommandEmpty>{t('anamnesis.dialogs.noAilmentFound')}</CommandEmpty>
                                                <CommandGroup>
                                                    {ailmentsCatalog.map((ailment) => (
                                                        <CommandItem
                                                            key={ailment.id}
                                                            value={ailment.nombre}
                                                            onSelect={(value) => {
                                                                setSelectedPersonalAilmentName(value);
                                                                setIsPersonalHistoryComboboxOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", selectedPersonalAilmentName === ailment.nombre ? "opacity-100" : "opacity-0")} />
                                                            {ailment.nombre}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div>
                                <Label htmlFor="personal-comments">{t('anamnesis.dialogs.comments')}</Label>
                                <Textarea
                                    id="personal-comments"
                                    value={personalComentarios}
                                    onChange={(e) => setPersonalComentarios(e.target.value)}
                                    placeholder={t('anamnesis.dialogs.commentsPlaceholder')}
                                />
                            </div>
                            {personalSubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{personalSubmissionError}</AlertDescription>
                                </Alert>
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmittingPersonal}>
                                {isSubmittingPersonal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmittingPersonal ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsPersonalHistoryDialogOpen(false)} disabled={isSubmittingPersonal}>
                                {t('anamnesis.dialogs.cancel')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Family History Dialog */}
            <Dialog open={isFamilyHistoryDialogOpen} onOpenChange={setIsFamilyHistoryDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingFamilyHistory ? t('anamnesis.dialogs.family.editTitle') : t('anamnesis.dialogs.family.addTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {editingFamilyHistory ? t('anamnesis.dialogs.family.editDescription') : t('anamnesis.dialogs.family.addDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitFamilyHistory} className="flex flex-col h-full">
                        <DialogBody className="space-y-4 px-6 py-4">
                            <div>
                                <Label htmlFor="family-ailment">{t('anamnesis.dialogs.ailment')}</Label>
                                <Popover open={isFamilyHistoryComboboxOpen} onOpenChange={setIsFamilyHistoryComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {selectedFamilyAilmentName || t('anamnesis.dialogs.selectAilment')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput placeholder={t('anamnesis.dialogs.searchAilment')} />
                                            <CommandList>
                                                <CommandEmpty>{t('anamnesis.dialogs.noAilmentFound')}</CommandEmpty>
                                                <CommandGroup>
                                                    {ailmentsCatalog.map((ailment) => (
                                                        <CommandItem
                                                            key={ailment.id}
                                                            value={ailment.nombre}
                                                            onSelect={(value) => {
                                                                setSelectedFamilyAilmentName(value);
                                                                setIsFamilyHistoryComboboxOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", selectedFamilyAilmentName === ailment.nombre ? "opacity-100" : "opacity-0")} />
                                                            {ailment.nombre}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div>
                                <Label htmlFor="family-relationship">{t('anamnesis.dialogs.family.relationship')}</Label>
                                <Input
                                    id="family-relationship"
                                    value={familyParentesco}
                                    onChange={(e) => setFamilyParentesco(e.target.value)}
                                    placeholder={t('anamnesis.dialogs.family.selectRelationship')}
                                />
                            </div>
                            <div>
                                <Label htmlFor="family-comments">{t('anamnesis.dialogs.comments')}</Label>
                                <Textarea
                                    id="family-comments"
                                    value={familyComentarios}
                                    onChange={(e) => setFamilyComentarios(e.target.value)}
                                    placeholder={t('anamnesis.dialogs.family.commentsPlaceholder')}
                                />
                            </div>
                            {familySubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{familySubmissionError}</AlertDescription>
                                </Alert>
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmittingFamily}>
                                {isSubmittingFamily && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmittingFamily ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsFamilyHistoryDialogOpen(false)} disabled={isSubmittingFamily}>
                                {t('anamnesis.dialogs.cancel')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Allergy Dialog */}
            <Dialog open={isAllergyDialogOpen} onOpenChange={setIsAllergyDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAllergy ? t('anamnesis.dialogs.allergy.editTitle') : t('anamnesis.dialogs.allergy.addTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {editingAllergy ? t('anamnesis.dialogs.allergy.editDescription') : t('anamnesis.dialogs.allergy.addDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAllergy} className="flex flex-col h-full">
                        <DialogBody className="space-y-4 px-6 py-4">
                            <div>
                                <Label htmlFor="allergen">{t('anamnesis.dialogs.allergy.allergen')}</Label>
                                <Input
                                    id="allergen"
                                    value={allergyData.alergeno}
                                    onChange={(e) => setAllergyData(prev => ({ ...prev, alergeno: e.target.value }))}
                                    placeholder={t('anamnesis.dialogs.allergy.allergen')}
                                />
                            </div>
                            <div>
                                <Label htmlFor="reaction">{t('anamnesis.dialogs.allergy.reaction')}</Label>
                                <Textarea
                                    id="reaction"
                                    value={allergyData.reaccion_descrita}
                                    onChange={(e) => setAllergyData(prev => ({ ...prev, reaccion_descrita: e.target.value }))}
                                    placeholder={t('anamnesis.dialogs.allergy.reaction')}
                                />
                            </div>
                            {allergySubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{allergySubmissionError}</AlertDescription>
                                </Alert>
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmittingAllergy}>
                                {isSubmittingAllergy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmittingAllergy ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsAllergyDialogOpen(false)} disabled={isSubmittingAllergy}>
                                {t('anamnesis.dialogs.cancel')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Medication Dialog */}
            <Dialog open={isMedicationDialogOpen} onOpenChange={setIsMedicationDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingMedication ? t('anamnesis.dialogs.medication.editTitle') : t('anamnesis.dialogs.medication.addTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {editingMedication ? t('anamnesis.dialogs.medication.editDescription') : t('anamnesis.dialogs.medication.addDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitMedication} className="flex flex-col h-full">
                        <DialogBody className="space-y-4 px-6 py-4">
                            <div>
                                <Label htmlFor="medication">{t('anamnesis.dialogs.medication.name')}</Label>
                                <Popover open={isMedicationComboboxOpen} onOpenChange={setIsMedicationComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {selectedMedication?.name || t('anamnesis.dialogs.medication.selectMedication')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                        <Command>
                                            <CommandInput
                                                placeholder={t('anamnesis.dialogs.medication.searchMedication')}
                                                value={medicationSearchTerm}
                                                onValueChange={setMedicationSearchTerm}
                                            />
                                            <CommandList>
                                                {!medicationSearchTerm ? (
                                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                                        {t('anamnesis.dialogs.medication.typeToSearch')}
                                                    </div>
                                                ) : medicationsCatalog.length === 0 ? (
                                                    <CommandEmpty>{t('anamnesis.dialogs.medication.noMedicationFound')}</CommandEmpty>
                                                ) : (
                                                    <CommandGroup>
                                                        {medicationsCatalog.map((med) => {
                                                            const displayName = med.nombre_comercial ? `${med.nombre_generico} - ${med.nombre_comercial}` : med.nombre_generico;
                                                            return (
                                                                <CommandItem
                                                                    key={med.id}
                                                                    value={displayName}
                                                                    onSelect={() => {
                                                                        setSelectedMedication({ id: med.id, name: displayName });
                                                                        setIsMedicationComboboxOpen(false);
                                                                    }}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedMedication?.id === med.id ? "opacity-100" : "opacity-0")} />
                                                                    {displayName}
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                )}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="dosage">{t('anamnesis.dialogs.medication.dose')}</Label>
                                    <Input
                                        id="dosage"
                                        value={medicationData.dosis}
                                        onChange={(e) => setMedicationData(prev => ({ ...prev, dosis: e.target.value }))}
                                        placeholder="500mg"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="frequency">{t('anamnesis.dialogs.medication.frequency')}</Label>
                                    <Input
                                        id="frequency"
                                        value={medicationData.frecuencia}
                                        onChange={(e) => setMedicationData(prev => ({ ...prev, frecuencia: e.target.value }))}
                                        placeholder="Cada 8 horas"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="start-date">{t('anamnesis.dialogs.medication.startDate')}</Label>
                                    <Input
                                        id="start-date"
                                        type="date"
                                        value={medicationData.fecha_inicio}
                                        onChange={(e) => setMedicationData(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="end-date">{t('anamnesis.dialogs.medication.endDate')}</Label>
                                    <Input
                                        id="end-date"
                                        type="date"
                                        value={medicationData.fecha_fin}
                                        onChange={(e) => setMedicationData(prev => ({ ...prev, fecha_fin: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="reason">{t('anamnesis.dialogs.medication.reason')}</Label>
                                <Textarea
                                    id="reason"
                                    value={medicationData.motivo}
                                    onChange={(e) => setMedicationData(prev => ({ ...prev, motivo: e.target.value }))}
                                    placeholder={t('anamnesis.dialogs.medication.reason')}
                                />
                            </div>
                            {medicationSubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{medicationSubmissionError}</AlertDescription>
                                </Alert>
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmittingMedication}>
                                {isSubmittingMedication && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmittingMedication ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsMedicationDialogOpen(false)} disabled={isSubmittingMedication}>
                                {t('anamnesis.dialogs.cancel')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('anamnesis.deleteDialog.title')}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription>
                        {t('anamnesis.deleteDialog.description')}
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                            {t('anamnesis.deleteDialog.confirm')}
                        </AlertDialogAction>
                        <AlertDialogCancel>{t('anamnesis.deleteDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const sessionFormSchema = z.object({
    doctor_name: z.string().optional(),
    fecha_sesion: z.date({
        required_error: 'Date is required'
    }),
    procedimiento_realizado: z.string().min(1, 'Procedure is required'),
    diagnostico: z.string().optional(),
    notas_clinicas: z.string().optional(),
    plan_proxima_cita: z.string().optional(),
    fecha_proxima_cita: z.date().optional(),
    treatments: z.array(z.object({
        tratamiento_id: z.string().optional(),
        numero_diente: z.string().refine(val => {
            if (val === '' || val === undefined) return true; // Optional field
            const num = parseInt(val, 10);
            if (isNaN(num)) return false; // Must be a number
            if (num < 11 || num > 85) return false; // Must be within the general range
            if (num > 48 && num < 51) return false; // Gap between 48 and 51
            if (num > 85) return false; // Out of range
            const lastDigit = num % 10;
            if (lastDigit === 0 || lastDigit === 9) return false; // Last digit can't be 0 or 9
            return true;
        }, {
            message: 'Invalid tooth number (must be 11-85, not ending in 0 or 9).'
        }).optional(),
        descripcion: z.string().min(1, 'Treatment description is required'),
    }))
});

type SessionFormValues = z.infer<typeof sessionFormSchema>;

const SessionDialog = ({ isOpen, onOpenChange, session, userId, onSave }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    session: PatientSession | null;
    userId: string;
    onSave: () => void;
}) => {
    const t = useTranslations('ClinicHistoryPage.sessionDialog');
    const tPage = useTranslations('ClinicHistoryPage');
    const { toast } = useToast();
    const [doctors, setDoctors] = useState<UserType[]>([]);
    const [newAttachments, setNewAttachments] = useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<AttachedFile[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const form = useForm<SessionFormValues>({
        resolver: zodResolver(sessionFormSchema),
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'treatments'
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            if (isOpen) {
                setIsSubmitting(false);
                setNewAttachments([]);
                setDeletedAttachmentIds([]);

                try {
                    const doctorsData = await api.get(API_ROUTES.USERS_DOCTORS);
                    const doctorsList = doctorsData.map((doc: any) => ({ ...doc, id: String(doc.id) }));
                    setDoctors(doctorsList);
                } catch (error) {
                    console.error('Failed to fetch doctors', error);
                }

                if (session && session.sesion_id) {
                    form.reset({
                        doctor_name: '',
                        fecha_sesion: session.fecha_sesion ? parseISO(session.fecha_sesion) : new Date(),
                        procedimiento_realizado: session.procedimiento_realizado || '',
                        diagnostico: session.diagnostico || '',
                        notas_clinicas: session.notas_clinicas || '',
                        plan_proxima_cita: session.plan_proxima_cita || '',
                        fecha_proxima_cita: session.fecha_proxima_cita ? parseISO(session.fecha_proxima_cita) : undefined,
                        treatments: (session.tratamientos || []).map(t => ({
                            numero_diente: t.numero_diente ? String(t.numero_diente) : '',
                            descripcion: t.descripcion || ''
                        })),
                    });
                    setExistingAttachments(session.archivos_adjuntos || []);
                } else {
                    form.reset({
                        doctor_name: '',
                        fecha_sesion: new Date(),
                        procedimiento_realizado: '',
                        diagnostico: '',
                        notas_clinicas: '',
                        plan_proxima_cita: '',
                        fecha_proxima_cita: undefined,
                        treatments: [],
                    });
                    setExistingAttachments([]);
                }
            }
        };
        fetchInitialData();
    }, [isOpen, session, form]);

    useEffect(() => {
        if (isOpen && session && session.sesion_id && doctors.length > 0) {
            let doctorName = '';
            if (session.doctor_id) {
                const doctor = doctors.find(d => d.id === String(session.doctor_id)) || doctors.find(d => d.name === String(session.doctor_id));
                doctorName = doctor ? doctor.name : '';
            }
            form.setValue('doctor_name', doctorName);
        }
    }, [isOpen, session, doctors, form]);



    // Reset drag state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setIsDragOver(false);
        }
    }, [isOpen]);




    const handleSave: SubmitHandler<SessionFormValues> = async (values) => {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('paciente_id', userId);
        if (session?.sesion_id) formData.append('sesion_id', String(session.sesion_id));

        const selectedDoctor = doctors.find(d => d.name === values.doctor_name);
        formData.append('doctor_id', selectedDoctor ? selectedDoctor.id : '');
        formData.append('fecha_sesion', values.fecha_sesion.toISOString());
        formData.append('procedimiento_realizado', values.procedimiento_realizado);
        formData.append('diagnostico', values.diagnostico || '');
        formData.append('notas_clinicas', values.notas_clinicas || '');
        formData.append('plan_proxima_cita', values.plan_proxima_cita || '');
        formData.append('fecha_proxima_cita', values.fecha_proxima_cita ? values.fecha_proxima_cita.toISOString().split('T')[0] : '');

        if (values.treatments) {
            formData.append('tratamientos', JSON.stringify(values.treatments.map(t => ({
                ...t,
                tratamiento_id: t.tratamiento_id ? parseInt(t.tratamiento_id, 10) : undefined,
                numero_diente: t.numero_diente ? parseInt(t.numero_diente, 10) : null
            }))));
        }

        const keptAttachmentIds = existingAttachments.map(att => String(att.id));
        formData.append('existing_attachment_ids', JSON.stringify(keptAttachmentIds));
        formData.append('deleted_attachment_ids', JSON.stringify(deletedAttachmentIds));

        newAttachments.forEach((file) => {
            formData.append(`newly_added_files`, file);
        });

        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.SESSIONS_UPSERT, formData);
            toast({ title: t('toast.success'), description: t('toast.saveSuccess') });
            onSave();
            onOpenChange(false);
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.error'), description: error instanceof Error ? error.message : t('toast.saveError') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAttachmentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setNewAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };



    const removeNewAttachment = (indexToRemove: number) => {
        setNewAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const removeExistingAttachment = (idToRemove: string) => {
        setExistingAttachments(prev => prev.filter(att => String(att.id) !== idToRemove));
        setDeletedAttachmentIds(prev => [...prev, idToRemove]);
    };


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                maxWidth="4xl"
                showMaximize
                onDragOver={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const label = document.getElementById('session-attachments-label');
                    if (label) {
                        label.style.borderColor = 'hsl(var(--primary))';
                        label.style.backgroundColor = 'hsl(var(--primary) / 0.1)';
                        label.style.transform = 'scale(1.02)';
                    }
                }}
                onDragEnter={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const label = document.getElementById('session-attachments-label');
                    if (label) {
                        label.style.borderColor = 'hsl(var(--primary))';
                        label.style.backgroundColor = 'hsl(var(--primary) / 0.1)';
                        label.style.transform = 'scale(1.02)';
                    }
                }}
                onDragLeave={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const label = document.getElementById('session-attachments-label');
                    if (label) {
                        label.style.borderColor = 'hsl(var(--muted-foreground) / 0.25)';
                        label.style.backgroundColor = 'hsl(var(--muted))';
                        label.style.transform = 'scale(1)';
                    }
                }}
                onDrop={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const label = document.getElementById('session-attachments-label');
                    if (label) {
                        label.style.borderColor = 'hsl(var(--muted-foreground) / 0.25)';
                        label.style.backgroundColor = 'hsl(var(--muted))';
                        label.style.transform = 'scale(1)';
                    }

                    const droppedFiles = e.dataTransfer.files;
                    if (droppedFiles && droppedFiles.length > 0) {
                        const files = Array.from(droppedFiles);
                        console.log('Files dropped:', files);
                        setNewAttachments(prev => [...prev, ...files]);
                    }
                }}
            >
                <DialogHeader className="py-4 px-6">
                    <DialogTitle>{session ? t('editTitle') : t('createTitle')}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col h-full overflow-hidden">
                        <DialogBody className="space-y-3 px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                                <div className="space-y-3">
                                    <FormField control={form.control} name="fecha_sesion" render={({ field }) => (
                                        <FormItem className="flex flex-col mb-2">
                                            <FormLabel className="text-xs font-semibold">{t('date')}</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} size="sm" className={cn("pl-3 text-left font-normal h-8", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "PPP") : <span>{t('pickDate')}</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <DatePicker mode="single" selected={field.value} onSelect={field.onChange} initialFocus translationsNamespace="DatePicker" />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="doctor_name" render={({ field }) => (
                                        <FormItem className="mb-2">
                                            <FormLabel className="text-xs font-semibold">{t('doctor')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                                <FormControl>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder={t('selectDoctor')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {doctors.map(doc => <SelectItem key={doc.id} value={doc.name}>{doc.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="procedimiento_realizado" render={({ field }) => (
                                        <FormItem className="mb-2">
                                            <FormLabel className="text-xs font-semibold">{t('procedure')}</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ''} className="h-8" /></FormControl>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="diagnostico" render={({ field }) => (
                                        <FormItem className="mb-2">
                                            <FormLabel className="text-xs font-semibold">{t('diagnosis')}</FormLabel>
                                            <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} className="min-h-[60px]" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="notas_clinicas" render={({ field }) => (
                                        <FormItem className="mb-2">
                                            <FormLabel className="text-xs font-semibold">{t('notes')}</FormLabel>
                                            <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} className="min-h-[60px]" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="plan_proxima_cita" render={({ field }) => (
                                        <FormItem className="mb-2">
                                            <FormLabel className="text-xs font-semibold">{t('nextSessionPlan')}</FormLabel>
                                            <FormControl><Textarea {...field} value={field.value ?? ''} rows={2} className="min-h-[60px]" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="fecha_proxima_cita" render={({ field }) => (
                                        <FormItem className="mb-2">
                                            <FormLabel className="text-xs font-semibold">{t('nextSessionDate')}</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} size="sm" className={cn("pl-3 text-left font-normal h-8 w-full", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "dd/MM/yyyy") : <span>{t('nextSessionDatePlaceholder')}</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <DatePicker mode="single" selected={field.value} onSelect={field.onChange} initialFocus translationsNamespace="DatePicker" />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="space-y-3">
                                    <Card className="shadow-none border bg-muted/5">
                                        <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
                                            <CardTitle className="text-sm font-bold">{t('treatments')}</CardTitle>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => append({ tratamiento_id: undefined, descripcion: '', numero_diente: '' })} className="h-7 px-2 text-xs">
                                                <Plus className="h-3 w-3 mr-1" />
                                                {t('addTreatment')}
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="p-2 pt-0">
                                            <ScrollArea className="h-40 pr-2">
                                                <div className="space-y-2">
                                                    {fields.length === 0 ? (
                                                        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground italic border border-dashed rounded-md">
                                                            No treatments added yet.
                                                        </div>
                                                    ) : fields.map((field, index) => (
                                                        <div key={field.id} className="flex gap-2 items-start p-2 bg-background border rounded-md">
                                                            <FormField
                                                                control={form.control}
                                                                name={`treatments.${index}.numero_diente`}
                                                                render={({ field }) => (
                                                                    <FormItem className="w-16 mb-0">
                                                                        <FormControl>
                                                                            <Input type="number" placeholder={t('tooth')} {...field} value={field.value ?? ''} className="h-7 text-xs px-1" />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[9px]" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name={`treatments.${index}.descripcion`}
                                                                render={({ field }) => (
                                                                    <FormItem className="flex-1 mb-0">
                                                                        <FormControl>
                                                                            <Textarea placeholder={t('treatmentPlaceholder')} {...field} className="min-h-[32px] h-7 text-xs p-1" value={field.value ?? ''} />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[9px]" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-none border bg-muted/5">
                                        <CardHeader className="py-2 px-3">
                                            <CardTitle className="text-sm font-bold">{t('attachments')}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-3">
                                            {/* Área de drag and drop optimizada */}
                                            <label
                                                id="session-attachments-label"
                                                htmlFor="session-attachments"
                                                className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${isDragOver
                                                    ? 'border-primary bg-primary/10 scale-[1.01]'
                                                    : 'border-muted-foreground/25 bg-muted/50 hover:bg-muted'
                                                    }`}
                                            >
                                                <div className="flex flex-col items-center justify-center py-2">
                                                    <Upload className="w-5 h-5 mb-1 text-muted-foreground" />
                                                    <p className="text-[10px] text-muted-foreground text-center">
                                                        <span className="font-semibold">{tPage('dragDropBold')}</span><br />{tPage('dragDropNormal')}
                                                    </p>
                                                </div>
                                                <Input
                                                    id="session-attachments"
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    onChange={handleAttachmentFileChange}
                                                />
                                            </label>
                                            <div className="mt-3 space-y-2">
                                                {existingAttachments.length > 0 && (
                                                    <div>
                                                        <h4 className="font-bold text-[10px] uppercase text-muted-foreground mb-1">{tPage('existingFiles')}</h4>
                                                        <ScrollArea className="h-20 mt-1 border rounded-md p-1 bg-background">
                                                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                                                                {existingAttachments.map((file) => (
                                                                    <div key={`existing-${file.id}`} className="relative group aspect-square">
                                                                        {file.thumbnail_url ? (
                                                                            <Image src={getAttachmentUrl(file.thumbnail_url)} alt={file.file_name || 'attachment'} layout="fill" className="rounded-md object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                                                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                                            </div>
                                                                        )}
                                                                        <Button type="button" variant="destructive" size="icon" className="absolute -top-1 -right-1 h-4 w-4 rounded-full opacity-0 group-hover:opacity-100" onClick={() => removeExistingAttachment(String(file.id))}>
                                                                            <X className="h-2 w-2" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                )}
                                                {newAttachments.length > 0 && (
                                                    <div>
                                                        <h4 className="font-bold text-[10px] uppercase text-muted-foreground mb-1">{tPage('newFiles')}</h4>
                                                        <ScrollArea className="h-20 mt-1 border rounded-md p-1 bg-background">
                                                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                                                                {newAttachments.map((file, index) => (
                                                                    <div key={`new-${index}`} className="relative group aspect-square">
                                                                        {file.type.startsWith('image/') ? (
                                                                            <Image src={URL.createObjectURL(file)} alt={file.name} layout="fill" className="rounded-md object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                                                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                                            </div>
                                                                        )}
                                                                        <Button type="button" variant="destructive" size="icon" className="absolute -top-1 -right-1 h-4 w-4 rounded-full opacity-0 group-hover:opacity-100" onClick={() => removeNewAttachment(index)}>
                                                                            <X className="h-2 w-2" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </DialogBody>
                        <DialogFooter>
                            <Button type="submit" size="sm" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? t('saving') : t('save')}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>{t('cancel')}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const DocumentViewerModal = ({ isOpen, onOpenChange, document, documentContent }: { isOpen: boolean, onOpenChange: (open: boolean) => void, document: Document | null, documentContent: string | null }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(!documentContent);
            setError(null);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen, documentContent]);

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

    const isImage = document?.mimeType?.startsWith('image/');
    const isPdf = document?.mimeType === 'application/pdf';
    const mimeType = document?.mimeType || '';

    const renderContent = () => {
        if (isLoading || !documentContent) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center h-full bg-muted/10">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-primary/20" />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">Cargando documento...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center h-full bg-destructive/5">
                    <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold text-destructive">Error al cargar</h3>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                    <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setError(null)}
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reintentar
                    </Button>
                </div>
            );
        }

        if (isImage) {
            return (
                <div
                    className="flex-1 w-full h-full overflow-hidden flex items-center justify-center relative bg-gradient-to-br from-muted/10 to-muted/5"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    <img
                        ref={imageRef}
                        src={documentContent}
                        alt={document?.name || 'Documento'}
                        className="max-w-none max-h-none cursor-grab active:cursor-grabbing select-none"
                        style={{ 
                            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, 
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out' 
                        }}
                        onMouseDown={handleMouseDown}
                        draggable={false}
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg border">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.2))}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className='text-xs font-medium w-14 text-center'>{Math.round(zoom * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}>
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            );
        }

        if (isPdf) {
            return (
                <iframe src={documentContent} className="h-full w-full border-0 flex-1 bg-muted/10" title={document?.name} />
            );
        }

        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-muted/10 to-muted/5 p-8">
                <div className="text-center space-y-4 max-w-md">
                    <div className="w-24 h-24 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                        <FileText className="h-12 w-12 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">{document?.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{mimeType}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Este tipo de archivo no se puede previsualizar en el navegador.
                    </p>
                    <a
                        href={documentContent}
                        download={document?.name}
                        className="inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Descargar archivo
                    </a>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="4xl" showMaximize className="h-[90vh] max-w-[95vw] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b bg-muted/10 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            {isImage ? <ImageIcon className="h-5 w-5 text-primary" /> : isPdf ? <FileText className="h-5 w-5 text-primary" /> : <File className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-base font-semibold truncate">{document?.name}</DialogTitle>
                            <p className="text-xs text-muted-foreground">{mimeType}</p>
                        </div>
                        {documentContent && (
                            <a
                                href={documentContent}
                                download={document?.name}
                                className="inline-flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            >
                                <Download className="h-4 w-4" />
                                Descargar
                            </a>
                        )}
                    </div>
                </DialogHeader>
                <DialogBody className="p-0 overflow-hidden flex-1 flex flex-col">
                    {renderContent()}
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
};

const ImageGallery = ({ userId, onViewDocument }: { userId: string, onViewDocument: (doc: any) => void }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
    const t = useTranslations('ClinicHistoryPage');
    const { toast } = useToast();

    const fetchDocuments = useCallback(async () => {
        if (!userId) return;
        setIsLoadingDocuments(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENTS, { user_id: userId });
            const docs = (Array.isArray(data) && data.length > 0 && data[0].items) ? data[0].items : [];
            setDocuments(docs.map((doc: any) => ({
                id: String(doc.id),
                name: doc.name,
                mimeType: doc.mimeType,
                hasThumbnail: doc.hasThumbnail,
                thumbnailLink: getAttachmentUrl(doc.thumbnailLink),
                webViewLink: doc.webViewLink,
            })));
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            setDocuments([]);
        } finally {
            setIsLoadingDocuments(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadFile(file);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const files = event.dataTransfer.files;
        if (files && files[0]) {
            setUploadFile(files[0]);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !userId) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('user_id', userId);

        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.USERS_IMPORT, formData);
            toast({ title: "Upload Successful", description: "Document has been uploaded." });
            fetchDocuments(); // Refresh the list
            setIsUploadDialogOpen(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Upload Error',
                description: error instanceof Error ? error.message : 'An unknown error occurred.',
            });
        } finally {
            setIsUploading(false);
            setUploadFile(null);
        }
    };

    const handleDeleteDocument = (doc: Document) => {
        setDeletingDocument(doc);
    };

    const confirmDeleteDocument = async () => {
        if (!deletingDocument || !userId) return;
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT, undefined, undefined, { id: deletingDocument.id, user_id: userId });
            toast({ title: "Document Deleted", description: `Document "${deletingDocument.name}" has been deleted.` });
            fetchDocuments();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Deletion Error',
                description: error instanceof Error ? error.message : 'An unknown error occurred.',
            });
        } finally {
            setDeletingDocument(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-card text-card-foreground rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-card-foreground">{t('images.title')}</h3>
                    <Button onClick={() => setIsUploadDialogOpen(true)} variant="outline">
                        <Upload className="h-4 w-4" />
                        {t('uploadDocument')}
                    </Button>
                </div>
                {isLoadingDocuments ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {[...Array(4)].map((_, i) => <Skeleton className="h-40 w-full" key={i} />)}
                    </div>
                ) : documents.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {documents.map((doc) => (
                            <Card key={doc.id} className="overflow-hidden">
                                <CardContent className="p-0 flex flex-col justify-between h-full">
                                    <div className="relative aspect-video w-full bg-muted cursor-pointer group" onClick={() => onViewDocument(doc)}>
                                        {doc.hasThumbnail && doc.thumbnailLink ? (
                                            <Image src={doc.thumbnailLink} alt={doc.name} layout="fill" className="object-cover" />
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
                                        <p className="font-semibold text-sm truncate leading-tight">{doc.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{doc.mimeType}</p>
                                    </div>
                                    <div className="flex justify-end p-1 pt-0">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => handleDeleteDocument(doc)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">No documents found for this patient.</p>
                )}
            </div>

            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogContent maxWidth="md">
                    <DialogHeader>
                        <DialogTitle>{t('uploadDocument')}</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4 px-6 py-4">
                        <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file" className={cn("flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/50", isDragging && "border-primary bg-primary/10")} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                                {uploadFile ? (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <FileText className="w-8 h-8 mb-4 text-primary" />
                                        <p className="font-semibold text-foreground">{uploadFile.name}</p>
                                        <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground">
                                            <span className="font-semibold">{t('documentDragDropBold')}</span> {t('documentDragDropNormal')}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{t('documentDragDropSubtext')}</p>
                                    </div>
                                )}
                                <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} />
                            </label>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={handleUpload} disabled={!uploadFile || isUploading}>
                            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isUploading ? t('sessionDialog.saving') : t('upload')}
                        </Button>
                        <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)} disabled={isUploading}>
                            {t('sessionDialog.cancel')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={!!deletingDocument} onOpenChange={() => setDeletingDocument(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription>
                        This will permanently delete the document "{deletingDocument?.name}". This action cannot be undone.
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDeleteDocument} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const DentalClinicalSystem = ({ userId: initialUserId }: { userId: string }) => {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('ClinicHistoryPage');
    const params = useParams();
    const userId = (params?.user_id as string) || initialUserId;

    const [activeView, setActiveView] = useState('anamnesis');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Patient Search State
    const [patientSearchOpen, setPatientSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserType[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [personalHistory, setPersonalHistory] = useState<PersonalHistoryItem[]>([]);
    const [isLoadingPersonalHistory, setIsLoadingPersonalHistory] = useState(false);
    const [familyHistory, setFamilyHistory] = useState<FamilyHistoryItem[]>([]);
    const [isLoadingFamilyHistory, setIsLoadingFamilyHistory] = useState(false);
    const [allergies, setAllergies] = useState<AllergyItem[]>([]);
    const [isLoadingAllergies, setIsLoadingAllergies] = useState(false);
    const [medications, setMedications] = useState<MedicationItem[]>([]);
    const [isLoadingMedications, setIsLoadingMedications] = useState(false);
    const [patientSessions, setPatientSessions] = useState<PatientSession[]>([]);
    const [isLoadingPatientSessions, setIsLoadingPatientSessions] = useState(false);
    const [patientHabits, setPatientHabits] = useState<PatientHabits | null>(null);
    const [isLoadingPatientHabits, setIsLoadingPatientHabits] = useState(false);

    const fetchPersonalHistory = useCallback(async (currentUserId: string) => {
        if (!currentUserId) return;
        setIsLoadingPersonalHistory(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY, { user_id: currentUserId });
            const historyData = Array.isArray(data) ? data : (data.antecedentes_personales || data.data || []);

            const mappedHistory = historyData.map((item: any): PersonalHistoryItem => ({
                id: Number(item.id ?? item.antecedente_id ?? item.antecedente_personal_id) || undefined,
                padecimiento_id: item.padecimiento_id ? String(item.padecimiento_id) : undefined,
                nombre: item.nombre || 'N/A',
                categoria: item.categoria || 'N/A',
                nivel_alerta: Number(item.nivel_alerta) || 1,
                comentarios: item.comentarios || '',
            }));
            setPersonalHistory(mappedHistory);
        } catch (error) {
            console.error("Failed to fetch personal history:", error);
            setPersonalHistory([]);
        } finally {
            setIsLoadingPersonalHistory(false);
        }
    }, []);

    const fetchFamilyHistory = useCallback(async (currentUserId: string) => {
        if (!currentUserId) return;
        setIsLoadingFamilyHistory(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY, { user_id: currentUserId });
            const historyData = Array.isArray(data) ? data : (data.antecedentes_familiares || data.data || []);

            const mappedHistory = historyData.map((item: any): FamilyHistoryItem => ({
                id: Number(item.id) || undefined,
                padecimiento_id: item.padecimiento_id ? String(item.padecimiento_id) : undefined,
                nombre: item.nombre || 'N/A',
                parentesco: item.parentesco || 'N/A',
                comentarios: item.comentarios || '',
            }));
            setFamilyHistory(mappedHistory);
        } catch (error) {
            console.error("Failed to fetch family history:", error);
            setFamilyHistory([]);
        } finally {
            setIsLoadingFamilyHistory(false);
        }
    }, []);

    const fetchAllergies = useCallback(async (currentUserId: string) => {
        if (!currentUserId) return;
        setIsLoadingAllergies(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.ALLERGIES, { user_id: currentUserId });
            const allergyData = Array.isArray(data) ? data : (data.antecedentes_alergias || data.data || []);

            const mappedAllergies = allergyData.map((item: any): AllergyItem => ({
                id: Number(item.id) || undefined,
                alergeno: item.alergeno || 'N/A',
                reaccion_descrita: item.reaccion_descrita || '',
                snomed_ct_id: item.snomed_ct_id || '',
            }));
            setAllergies(mappedAllergies);
        } catch (error) {
            console.error("Failed to fetch allergies:", error);
            setAllergies([]);
        } finally {
            setIsLoadingAllergies(false);
        }
    }, []);

    const fetchMedications = useCallback(async (currentUserId: string) => {
        if (!currentUserId) return;
        setIsLoadingMedications(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.MEDICATIONS, { user_id: currentUserId });
            const medicationData = Array.isArray(data) ? data : (data.antecedentes_medicamentos || data.data || []);

            const mappedMedications = medicationData.map((item: any): MedicationItem => ({
                id: Number(item.id) || undefined,
                medicamento_id: item.medicamento_id ? String(item.medicamento_id) : undefined,
                medicamento_nombre: item.nombre_medicamento || 'N/A',
                dosis: item.dosis || 'N/A',
                frecuencia: item.frecuencia || 'N/A',
                fecha_inicio: item.fecha_inicio || null,
                fecha_fin: item.fecha_fin || null,
                motivo: item.motivo || '',
            }));
            setMedications(mappedMedications);
        } catch (error) {
            console.error("Failed to fetch medications:", error);
            setMedications([]);
        } finally {
            setIsLoadingMedications(false);
        }
    }, []);

    const fetchPatientSessions = useCallback(async (currentUserId: string) => {
        if (!currentUserId) return;
        setIsLoadingPatientSessions(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: currentUserId });
            const sessionsData = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
            setPatientSessions(sessionsData.map((session: any) => ({
                ...session,
                sesion_id: String(session.sesion_id),
                doctor_id: session.doctor_id ? String(session.doctor_id) : '',
                tratamientos: session.tratamientos || [],
                archivos_adjuntos: (session.archivos_adjuntos || []).map((file: any) => ({
                    ...file,
                    id: String(file.id),
                    thumbnail_url: file.thumbnail_url,
                })),
            })));
        } catch (error) {
            console.error("Failed to fetch patient sessions:", error);
            setPatientSessions([]);
        } finally {
            setIsLoadingPatientSessions(false);
        }
    }, []);

    const fetchPatientHabits = useCallback(async (currentUserId: string) => {
        if (!currentUserId) return;
        setIsLoadingPatientHabits(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_HABITS, { user_id: currentUserId });
            const habitsData = Array.isArray(data) && data.length > 0 ? data[0] : (data.patient_habits || data.data || null);
            setPatientHabits(habitsData);
        } catch (error) {
            console.error("Failed to fetch patient habits:", error);
            setPatientHabits(null);
        } finally {
            setIsLoadingPatientHabits(false);
        }
    }, []);

    const refreshAllData = useCallback(() => {
        if (userId && userId !== '1') {
            fetchPersonalHistory(userId);
            fetchFamilyHistory(userId);
            fetchAllergies(userId);
            fetchMedications(userId);
            fetchPatientSessions(userId);
            fetchPatientHabits(userId);
        }
    }, [userId, fetchPersonalHistory, fetchFamilyHistory, fetchAllergies, fetchMedications, fetchPatientSessions, fetchPatientHabits]);

    // Debounced search effect
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (searchQuery.length < 3) {
                setSearchResults([]);
                return;
            };
            setIsSearching(true);
            try {
                const data = await api.get(API_ROUTES.USERS, { search: searchQuery, filter_type: 'PACIENTE' });
                const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);

                const mappedUsers = usersData.map((apiUser: any) => ({
                    id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
                    name: apiUser.name || 'No Name',
                    email: apiUser.email || 'no-email@example.com',
                    phone_number: apiUser.phone_number || '000-000-0000',
                    is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
                    avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
                }));
                setSearchResults(mappedUsers);
            } catch (error) {
                console.error("Failed to fetch users:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    const handleSelectPatient = (user: UserType) => {
        router.push(`/${locale}/clinic-history/${user.id}`);
        setPatientSearchOpen(false);
    };

    useEffect(() => {
        const fetchPatientData = async (currentUserId: string) => {
            if (!currentUserId || currentUserId === '1') {
                setSelectedPatient(null);
                return;
            };

            // Fetch patient details
            try {
                const data = await api.get(API_ROUTES.USERS, { search: currentUserId, filter_type: 'PACIENTE' });
                const usersData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
                if (usersData.length > 0) {
                    const apiUser = usersData[0];
                    setSelectedPatient({
                        id: apiUser.id,
                        name: apiUser.name || "Unknown Patient",
                        age: 30 + Math.floor(Math.random() * 10), // Mocked age
                    });
                    setSearchQuery(apiUser.name || '');
                } else {
                    setSelectedPatient(null); // No user found
                }
            } catch (error) {
                console.error("Error fetching patient details:", error);
                setSelectedPatient(null);
            }

            // Fetch data for all tabs
            refreshAllData();
        };

        if (userId) {
            fetchPatientData(userId);
        }
    }, [userId, refreshAllData, router, locale]);

    const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<PatientSession | null>(null);
    const [deletingSession, setDeletingSession] = useState<PatientSession | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [documentContent, setDocumentContent] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const { toast } = useToast();

    const handleSessionAction = (action: 'add' | 'edit' | 'delete', session?: PatientSession) => {
        if (action === 'add') {
            setEditingSession(null);
            setIsSessionDialogOpen(true);
        } else if (action === 'edit' && session) {
            setEditingSession(session);
            setIsSessionDialogOpen(true);
        } else if (action === 'delete' && session) {
            setDeletingSession(session);
        }
    };

    const handleConfirmDeleteSession = async () => {
        if (!deletingSession) return;
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.SESSIONS_DELETE, { id: deletingSession.sesion_id });
            toast({ title: t('timeline.toast.success'), description: t('timeline.toast.deleteSuccess') });
            refreshAllData();
        } catch (error) {
            console.error('Delete error', error);
            toast({ variant: 'destructive', title: t('timeline.toast.error'), description: error instanceof Error ? error.message : t('timeline.toast.deleteError') });
        } finally {
            setDeletingSession(null);
        }
    };

    const handleViewSessionAttachment = async (session: PatientSession, attachment: AttachedFile) => {
        const doc: Document = {
            id: String(attachment.id),
            name: attachment.tipo || 'Attachment',
            mimeType: 'image/jpeg', // Assumption
            thumbnailLink: getAttachmentUrl(attachment.thumbnail_url || '')
        };
        setSelectedDocument(doc);
        setIsViewerOpen(true);
        setDocumentContent(null);
        try {
            const blob = await api.getBlob(API_ROUTES.CLINIC_HISTORY.SESSIONS_ATTACHMENT, { session_id: String(session.sesion_id), id: String(attachment.id) });
            const url = URL.createObjectURL(blob);
            setDocumentContent(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: "Could not load attachment." });
            setIsViewerOpen(false);
        }
    };


    const handleViewDocument = async (doc: Document) => {
        setSelectedDocument(doc);
        setIsViewerOpen(true);
        setDocumentContent(null);
        try {
            const blob = await api.getBlob(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT, { user_id: userId, id: doc.id });
            const url = URL.createObjectURL(blob);
            setDocumentContent(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: "Could not load document." });
            setIsViewerOpen(false);
        }
    };

    const Navigation = () => {
        const navItems = [
            { id: 'anamnesis', label: t('tabs.anamnesis'), icon: FileText },
            { id: 'timeline', label: t('tabs.timeline'), icon: Clock },
            { id: 'odontogram', label: t('tabs.odontogram'), icon: Smile },
            { id: 'documents', label: t('tabs.documents'), icon: FolderArchive },
        ];

        return (
            <div className="flex items-center gap-2 p-1 bg-muted/30 rounded-lg">
                {navItems.map(({ id, label, icon: Icon }) => (
                    <Button
                        key={id}
                        variant={activeView === id ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveView(id)}
                        className={cn(
                            "gap-2 h-9 px-4 transition-all duration-200",
                            activeView === id 
                                ? "shadow-sm" 
                                : "hover:bg-muted/50 text-muted-foreground"
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{label}</span>
                    </Button>
                ))}
            </div>
        );
    };

    const TreatmentTimeline = ({ sessions, onAction }: { sessions: PatientSession[], onAction: (action: 'add' | 'edit' | 'delete', session?: PatientSession) => void }) => {
        const t = useTranslations('ClinicHistoryPage.timeline');
        const [openItems, setOpenItems] = useState<string[]>([]);

        const toggleItem = (id: string) => {
            setOpenItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
        };

        if (isLoadingPatientSessions) {
            return (
                <div className="bg-card rounded-xl shadow-sm p-6 border-0">
                    <h3 className="text-xl font-bold text-card-foreground mb-6">{t('title')}</h3>
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div className="flex gap-4" key={i}>
                                <Skeleton className="w-6 h-6 rounded-full mt-1" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-card rounded-xl shadow-sm p-6 border-0">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-card-foreground">{t('title')}</h3>
                    <Button onClick={() => onAction('add')}>
                        <Plus className="h-4 w-4" />
                        {t('addSession')}
                    </Button>
                </div>
                <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-muted"></div>
                    {sessions.map((session, index) => {
                        const Icon = {
                            'odontograma': Smile,
                            'clinica': Stethoscope
                        }[session.tipo_sesion || 'clinica'] || Stethoscope;
                        const isOpen = openItems.includes(String(session.sesion_id));

                        return (
                            <div key={`${session.sesion_id}-${index}`} className="relative flex items-start mb-8 last:mb-0 pl-8">
                                <div className="absolute left-0 top-0 z-10 w-6 h-6 rounded-full border-2 border-background shadow-md bg-card flex items-center justify-center">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Icon className="h-4 w-4 text-primary" />
                                            </TooltipTrigger>
                                            <TooltipContent className="z-50">
                                                <p>{session.tipo_sesion === 'odontograma' ? t('odontogramTooltip') : `${t('sessionType')}: ${session.tipo_sesion}`}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="flex-1">
                                    <div className="bg-card rounded-lg border p-4 transition-colors duration-200">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-foreground">{session.procedimiento_realizado}</h4>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <CalendarIcon className="h-3 w-3" />
                                                        {session.fecha_sesion ? format(parseISO(session.fecha_sesion), 'dd/MM/yyyy') : '-'}
                                                    </span>
                                                    {session.doctor_name && (
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3 w-3" />
                                                            Dr. {session.doctor_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {session.tipo_sesion !== 'odontograma' ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => onAction('edit', session)}>{t('edit')}</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onAction('delete', session)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : null}
                                        </div>
                                        <div className="space-y-2.5 text-sm">
                                            {session.diagnostico && (
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium text-foreground shrink-0">{t('diagnosis')}:</span>
                                                    <span className="text-muted-foreground">{session.diagnostico}</span>
                                                </div>
                                            )}
                                            {session.notas_clinicas && (
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium text-foreground shrink-0">{t('notes')}:</span>
                                                    <span className="text-muted-foreground">{session.notas_clinicas}</span>
                                                </div>
                                            )}
                                            {session.plan_proxima_cita && (
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium text-foreground shrink-0">{t('nextSessionPlan')}:</span>
                                                    <span className="text-muted-foreground">{session.plan_proxima_cita}</span>
                                                </div>
                                            )}
                                            {session.fecha_proxima_cita && (
                                                <div className="flex items-start gap-2">
                                                    <span className="font-medium text-foreground shrink-0">{t('nextSessionDate')}:</span>
                                                    <span className="text-muted-foreground font-medium">{format(parseISO(session.fecha_proxima_cita), 'dd/MM/yyyy')}</span>
                                                </div>
                                            )}
                                            <Collapsible open={isOpen} onOpenChange={() => toggleItem(String(session.sesion_id))}>
                                                {(session.tratamientos?.length > 0 || session.archivos_adjuntos?.length > 0 || session.estado_odontograma) && (
                                                    <CollapsibleTrigger asChild>
                                                        <Button variant="link" className="p-0 h-auto text-xs flex items-center gap-1">
                                                            {isOpen ? t('showLess') : t('showMore')}
                                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                )}
                                                <CollapsibleContent>
                                                    <div className="mt-2 space-y-3">
                                                        {session.estado_odontograma && (
                                                            <div>
                                                                <strong className="text-foreground">{t('odontogramUpdate')}</strong>
                                                                <ul className="list-disc pl-5">
                                                                    {Object.entries(session.estado_odontograma).map(([tooth, data]: [string, any]) => (
                                                                        <li key={tooth}>Diente {tooth}: {data.condition} ({data.surface})</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {session.tratamientos && session.tratamientos.length > 0 && (
                                                            <div>
                                                                <strong className="text-foreground">{t('treatments')}:</strong>
                                                                <ul className="list-disc pl-5">
                                                                    {session.tratamientos.map((treatment, i) => (
                                                                        <li key={i}>{treatment.descripcion} {treatment.numero_diente && `(${t('tooth')}: ${treatment.numero_diente})`}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {session.archivos_adjuntos && session.archivos_adjuntos.length > 0 && (
                                                            <div>
                                                                <strong className="text-foreground">{t('attachments')}:</strong>
                                                                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                                    {session.archivos_adjuntos.map((file, i) => (
                                                                        <div key={i} className="relative aspect-video w-full bg-muted cursor-pointer group" onClick={() => handleViewSessionAttachment(session, file)}>
                                                                            {file.thumbnail_url ? (
                                                                                <Image src={getAttachmentUrl(file.thumbnail_url)} alt={file.tipo || 'Attachment'} layout="fill" className="object-cover rounded-md" />
                                                                            ) : (
                                                                                <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                                                                                    <FileText className="h-6 w-6 text-muted-foreground" />
                                                                                </div>
                                                                            )}
                                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                                <Eye className="h-6 w-6 text-white" />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("flex-1 flex flex-col min-h-0", !isFullscreen && "bg-background")}>
            {/* Header */}
            {!isFullscreen && (
                <div className="flex-none bg-card shadow-sm border-b border-border px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold text-card-foreground">{t('title')}</h1>
                            {selectedPatient && (
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl font-bold text-foreground">{selectedPatient.name}</p>
                                    <Button variant="ghost" size="icon" onClick={refreshAllData}>
                                        <RefreshCw className="h-5 w-5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                        <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                            <PopoverTrigger asChild>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value)
                                            if (!patientSearchOpen) setPatientSearchOpen(true)
                                        }}
                                        placeholder={t('searchPlaceholder')}
                                        className="pl-9 w-96"
                                    />
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-96" align="start">
                                <Command>
                                    <CommandInput placeholder={t('searchPlaceholder')} value={searchQuery} onValueChange={setSearchQuery} />
                                    <CommandList>
                                        <CommandEmpty>
                                            {isSearching ? t('searching') : t('noPatientsFound')}
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {searchResults.map((user) => (
                                                <CommandItem
                                                    key={user.id}
                                                    value={user.name}
                                                    onSelect={() => handleSelectPatient(user)}
                                                >
                                                    {user.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <Navigation />
                    </div>
                </div>
            )}

            {selectedPatient ? (
                <>
                    <div className={cn("flex-1 flex flex-col min-h-0", !isFullscreen && "px-6 py-4")}>
                        <div className={cn(
                            "flex-1 flex flex-col min-h-0 rounded-xl border overflow-hidden",
                            activeView === 'odontogram' ? 'bg-background' : 'bg-gradient-to-br from-muted/20 to-muted/5'
                        )}>
                            {activeView === 'anamnesis' &&
                                <ScrollArea className='flex-1 p-4'>
                                    <div className="pr-4 space-y-6">
                                        <AnamnesisDashboard
                                            personalHistory={personalHistory}
                                            isLoadingPersonalHistory={isLoadingPersonalHistory}
                                            fetchPersonalHistory={fetchPersonalHistory}
                                            familyHistory={familyHistory}
                                            isLoadingFamilyHistory={isLoadingFamilyHistory}
                                            fetchFamilyHistory={fetchFamilyHistory}
                                            allergies={allergies}
                                            isLoadingAllergies={isLoadingAllergies}
                                            fetchAllergies={fetchAllergies}
                                            medications={medications}
                                            isLoadingMedications={isLoadingMedications}
                                            fetchMedications={fetchMedications}
                                            patientHabits={patientHabits}
                                            isLoadingPatientHabits={isLoadingPatientHabits}
                                            fetchPatientHabits={fetchPatientHabits}
                                            userId={userId}
                                        />
                                    </div>
                                </ScrollArea>
                            }
                            {activeView === 'timeline' && <ScrollArea className='flex-1 p-4'><div className="pr-4 space-y-6"><TreatmentTimeline sessions={patientSessions} onAction={handleSessionAction} /></div></ScrollArea>}
                            {activeView === 'odontogram' && (
                                <div className={cn("relative", isFullscreen ? "fixed inset-0 z-50 bg-background" : "flex-1 min-h-0 w-full")}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 z-10 bg-background/50 hover:bg-background/80"
                                        onClick={() => setIsFullscreen(!isFullscreen)}
                                    >
                                        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                                    </Button>
                                    <iframe src={`${process.env.NEXT_PUBLIC_ONDONTOGRAMA_URL || 'https://odontogramiia.invokeia.com'}?lang=${locale}&user_id=${userId}&token=${typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''}`} className="w-full h-full border-0" title="Odontograma"></iframe>
                                </div>
                            )}
                            {activeView === 'documents' && <ScrollArea className='flex-1 p-4'><div className="pr-4 space-y-6"><ImageGallery userId={userId} onViewDocument={handleViewDocument} /></div></ScrollArea>}
                        </div>
                    </div>
                </>
            ) : (
                !isFullscreen && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <SearchCheck className="w-24 h-24 text-muted-foreground/30 mb-4" />
                        <h2 className="text-2xl font-semibold text-foreground/80">{t('selectPatientTitle')}</h2>
                        <p className="text-muted-foreground mt-2">{t('selectPatientDescription')}</p>
                    </div>
                )
            )}

            <SessionDialog
                isOpen={isSessionDialogOpen}
                onOpenChange={setIsSessionDialogOpen}
                session={editingSession}
                userId={userId}
                onSave={refreshAllData}
            />

            <AlertDialog open={!!deletingSession} onOpenChange={() => setDeletingSession(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('timeline.deleteDialog.title')}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription>
                        {t('timeline.deleteDialog.description')}
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleConfirmDeleteSession} className="bg-destructive hover:bg-destructive/90">
                            {t('timeline.deleteDialog.confirm')}
                        </AlertDialogAction>
                        <AlertDialogCancel>{t('timeline.deleteDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <DocumentViewerModal
                isOpen={isViewerOpen}
                onOpenChange={setIsViewerOpen}
                document={selectedDocument}
                documentContent={documentContent}
            />
        </div>
    );
};

const DentalClinicalSystemPage = () => {
    const params = useParams();
    const userId = (params?.user_id as string);
    return <DentalClinicalSystem userId={userId} />;
}

export default DentalClinicalSystemPage;
