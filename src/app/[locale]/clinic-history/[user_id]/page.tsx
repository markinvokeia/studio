
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Calendar, AlertTriangle, FileText, Camera, Stethoscope, Heart, Pill, Search, 
  Clock, User, ChevronRight, Eye, Download, Filter, Mic, MicOff, Play, Pause, 
  ZoomIn, ZoomOut, RotateCcw, MessageSquare, Send, FileDown, Layers, TrendingUp, 
  BarChart3, X, Plus, Edit3, Save, Shield, Award, Zap, Paperclip, SearchCheck, RefreshCw,
  Wind, GlassWater, Smile, Maximize, Minimize, ChevronDown, ChevronsUpDown, Check, Trash2, MoreHorizontal, FolderArchive, Upload, Loader2, FileUp, CalendarIcon
} from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import type { User as UserType, PatientSession, TreatmentDetail, AttachedFile, Ailment, Medication, Document } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useLocale, useTranslations } from 'next-intl';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Timeline, TimelineItem, TimelineConnector, TimelineHeader, TimelineTitle, TimelineIcon, TimelineContent } from '@/components/ui/timeline';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


const getAttachmentUrl = (path: string) => {
    try {
        new URL(path);
        if (path.includes('drive.google.com')) {
             return `/api/attachment-proxy?url=${encodeURIComponent(path)}`;
        }
        return path;
    } catch (_) {
        return `https://n8n-project-n8n.7ig1i3.easypanel.host${path}`;
    }
};

type PersonalHistoryItem = {
    id: number;
    padecimiento_id: string;
    nombre: string;
    comentarios: string;
};
type FamilyHistoryItem = {
    id: number;
    padecimiento_id: string;
    nombre: string;
    parentesco: string;
    comentarios: string;
};
type AllergyItem = {
    id: number;
    alergeno: string;
    reaccion_descrita: string;
    snomed_ct_id: string;
};
type MedicationItem = {
    id: number;
    medicamento_id: string;
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
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/habitos_paciente/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Failed to save habits');
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
        <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6">
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
    const [allergyData, setAllergyData] = useState({ alergeno: '', reaccion_descrita: ''});

    // Medication state
    const [isMedicationComboboxOpen, setIsMedicationComboboxOpen] = useState(false);
    const [selectedMedication, setSelectedMedication] = useState<{id: string, name: string} | null>(null);
    const [isSubmittingMedication, setIsSubmittingMedication] = useState(false);
    const [medicationSubmissionError, setMedicationSubmissionError] = useState<string | null>(null);
    const [medicationData, setMedicationData] = useState({ dosis: '', frecuencia: '', fecha_inicio: '', fecha_fin: '', motivo: '' });

    useEffect(() => {
        const fetchAilments = async () => {
            if (isPersonalHistoryDialogOpen || isFamilyHistoryDialogOpen) {
                try {
                    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogo_padecimientos');
                    const data = await response.json();
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
            if (isMedicationDialogOpen) {
                try {
                    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogo_medicamentos');
                    const data = await response.json();
                    const medicationsData = Array.isArray(data) ? data : (data.catalogo_medicamentos || data.data || data.result || []);
                    setMedicationsCatalog(medicationsData.map((m: any) => ({ ...m, id: String(m.id), nombre_generico: m.nombre_generico })));
                } catch (error) {
                    console.error("Failed to fetch medications catalog", error);
                }
            }
        };
        fetchMedications();
    }, [isMedicationDialogOpen]);
    
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
                setAllergyData({ alergeno: '', reaccion_descrita: ''});
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
                setMedicationData({ dosis: '', frecuencia: '', fecha_inicio: '', fecha_fin: '', motivo: '' });
            }
            setMedicationSubmissionError(null);
        } else {
            setEditingMedication(null);
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
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_personales/upsert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.status > 299) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server error');
            }

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
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_familiares/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.status > 299) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Server error');
            }

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

        if (editingAllergy && editingAllergy.id) {
            payload.id = editingAllergy.id;
        }
        
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/alergias/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (response.status > 299) throw new Error((await response.json()).message || 'Server error');

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
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/medicamentos/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (response.status > 299) throw new Error((await response.json()).message || 'Server error');

            toast({ title: t('anamnesis.toast.success'), description: t('anamnesis.toast.medicationSuccess') });
            setIsMedicationDialogOpen(false);
            fetchMedications(userId);
        } catch (error: any) {
            setMedicationSubmissionError(error.message || t('anamnesis.toast.medicationError'));
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
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_personales/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchPersonalHistory;
                itemTypeKey = 'personal';
                break;
            case 'family':
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_familiares/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchFamilyHistory;
                itemTypeKey = 'family';
                break;
            case 'allergy':
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/alergias/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchAllergies;
                itemTypeKey = 'allergy';
                break;
            case 'medication':
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/medicamentos/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchMedications;
                itemTypeKey = 'medication';
                break;
        }
    
        if (!endpoint) {
            setIsDeleteDialogOpen(false);
            return;
        }
    
        try {
            const response = await fetch(endpoint, {
                method: 'DELETE',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
    
            if (!response.ok) {
                throw new Error(t('anamnesis.toast.deleteFailed', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) }));
            }
    
            toast({
                title: t('anamnesis.toast.success'),
                description: t('anamnesis.toast.deleteSuccess', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) }),
            });
    
            setIsDeleteDialogOpen(false);
            setDeletingItem(null);
    
            if (fetchCallback) {
                fetchCallback(userId);
            }
    
        } catch (error) {
            console.error(`Error deleting ${deletingItem.type}:`, error);
            toast({
                variant: 'destructive',
                title: t('anamnesis.toast.error'),
                description: error instanceof Error ? error.message : t('anamnesis.toast.deleteError', { item: t(`anamnesis.itemTypes.${itemTypeKey}`) }),
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
                <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <User className="w-5 h-5 text-primary mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.personalTitle')}</h3>
                        </div>
                        <Button variant="outline" size="icon" onClick={handleAddPersonalClick}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {isLoadingPersonalHistory ? (
                            <p className="text-muted-foreground">{t('anamnesis.loading.personal')}</p>
                        ) : personalHistory.length > 0 ? (
                            personalHistory.map((item) => (
                                <div key={item.id} className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 py-2 flex justify-between items-center">
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

                <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <Heart className="w-5 h-5 text-red-500 mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.familyTitle')}</h3>
                        </div>
                            <Button variant="outline" size="icon" onClick={handleAddFamilyClick}>
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
                <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <Pill className="w-5 h-5 text-green-500 mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.medicationsTitle')}</h3>
                        </div>
                        <Button variant="outline" size="icon" onClick={handleAddMedicationClick}>
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
                <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                            <h3 className="text-lg font-bold text-card-foreground">{t('anamnesis.allergiesTitle')}</h3>
                        </div>
                        <Button variant="outline" size="icon" onClick={handleAddAllergyClick}>
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
        </div>
    );
};

const sessionFormSchema = z.object({
  doctor_id: z.string().optional(),
  fecha_sesion: z.date({
    required_error: 'Date is required'
  }),
  procedimiento_realizado: z.string().min(1, 'Procedure is required'),
  diagnostico: z.string().optional(),
  notas_clinicas: z.string().optional(),
  plan_proxima_cita: z.string().optional(),
  treatments: z.array(z.object({
    descripcion: z.string().min(1, 'Treatment description is required'),
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
    const { toast } = useToast();
    const [doctors, setDoctors] = useState<UserType[]>([]);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

    const form = useForm<SessionFormValues>({
        resolver: zodResolver(sessionFormSchema),
        defaultValues: {
            doctor_id: '',
            fecha_sesion: new Date(),
            procedimiento_realizado: '',
            diagnostico: '',
            notas_clinicas: '',
            plan_proxima_cita: '',
            treatments: [],
        }
    });

    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: 'treatments'
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            if (isOpen) {
                // Fetch doctors
                try {
                    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?filter_type=DOCTOR');
                    const data = await response.json();
                    const doctorsData = (Array.isArray(data) && data.length > 0) ? data[0].data : (data.data || []);
                    setDoctors(doctorsData);
                } catch (error) {
                    console.error('Failed to fetch doctors', error);
                }

                // Reset form and attachments
                setAttachments([]);

                if (session) {
                    setIsLoadingAttachments(true);
                    form.reset({
                        doctor_id: session.doctor_id || '',
                        fecha_sesion: session.fecha_sesion ? parseISO(session.fecha_sesion) : new Date(),
                        procedimiento_realizado: session.procedimiento_realizado || '',
                        diagnostico: session.diagnostico || '',
                        notas_clinicas: session.notas_clinicas || '',
                        plan_proxima_cita: session.plan_proxima_cita || '',
                        treatments: session.tratamientos?.map(t => ({...t, numero_diente: String(t.numero_diente)})) || [],
                    });

                    if (session.archivos_adjuntos && session.archivos_adjuntos.length > 0) {
                        const filePromises = session.archivos_adjuntos.map(async (file) => {
                            try {
                                const response = await fetch(getAttachmentUrl(file.ruta));
                                if (!response.ok) throw new Error('Failed to fetch attachment blob');
                                const blob = await response.blob();
                                return new File([blob], file.file_name || 'attachment.jpg', { type: blob.type });
                            } catch (e) {
                                console.error("Could not fetch attachment:", file.ruta, e);
                                return null;
                            }
                        });
                        const fetchedFiles = await Promise.all(filePromises);
                        setAttachments(fetchedFiles.filter((f): f is File => f !== null));
                    }
                    setIsLoadingAttachments(false);
                } else {
                    form.reset({
                        doctor_id: '',
                        fecha_sesion: new Date(),
                        procedimiento_realizado: '',
                        diagnostico: '',
                        notas_clinicas: '',
                        plan_proxima_cita: '',
                        treatments: [],
                    });
                }
            }
        };
        fetchInitialData();
    }, [isOpen, session, form]);


    const handleSave: SubmitHandler<SessionFormValues> = async (values) => {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('paciente_id', userId);
        if (session?.sesion_id) formData.append('sesion_id', String(session.sesion_id));
        
        Object.entries(values).forEach(([key, value]) => {
            if (key !== 'treatments' && key !== 'archivos_adjuntos' && value) {
                if (value instanceof Date) {
                    formData.append(key, value.toISOString());
                } else {
                    formData.append(key, String(value));
                }
            }
        });

        if (values.treatments) {
            formData.append('tratamientos', JSON.stringify(values.treatments));
        }

        attachments.forEach((file, index) => {
            formData.append(`archivos_adjuntos_${index}`, file);
        });

        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/sesiones/upsert', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) throw new Error(t('toast.saveError'));
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
            setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const removeAttachment = (indexToRemove: number) => {
        setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
    };


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{session ? t('editTitle') : t('createTitle')}</DialogTitle>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                            <div className="space-y-4">
                                <FormField control={form.control} name="fecha_sesion" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>{t('date')}</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="doctor_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('doctor')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('selectDoctor')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {doctors.map(doc => <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="procedimiento_realizado" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('procedure')}</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                         <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="diagnostico" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('diagnosis')}</FormLabel>
                                        <FormControl><Textarea {...field} /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="notas_clinicas" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('notes')}</FormLabel>
                                        <FormControl><Textarea {...field} /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="plan_proxima_cita" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('nextSessionPlan')}</FormLabel>
                                        <FormControl><Textarea {...field} /></FormControl>
                                    </FormItem>
                                )} />
                            </div>
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{t('treatments')}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <ScrollArea className="h-48 pr-4">
                                            <div className="space-y-3">
                                                {fields.map((field, index) => (
                                                    <div key={field.id} className="flex gap-2 items-start p-2 border rounded-md">
                                                        <FormField
                                                          control={form.control}
                                                          name={`treatments.${index}.numero_diente`}
                                                          render={({ field }) => (
                                                            <FormItem className="w-24">
                                                              <FormLabel className="text-xs">{t('tooth')}</FormLabel>
                                                              <FormControl>
                                                                <Input type="number" placeholder={t('tooth')} {...field} className="h-8" />
                                                              </FormControl>
                                                              <FormMessage />
                                                            </FormItem>
                                                          )}
                                                        />
                                                        <FormField
                                                          control={form.control}
                                                          name={`treatments.${index}.descripcion`}
                                                          render={({ field }) => (
                                                            <FormItem className="flex-1">
                                                              <FormLabel className="text-xs">Tratamiento</FormLabel>
                                                              <FormControl>
                                                                <Textarea placeholder={t('treatmentPlaceholder')} {...field} className="min-h-[32px] h-8" />
                                                              </FormControl>
                                                              <FormMessage />
                                                            </FormItem>
                                                          )}
                                                        />
                                                        <Button type="button" variant="ghost" size="icon" className="mt-5" onClick={() => remove(index)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                        <Button type="button" variant="outline" size="sm" onClick={() => append({ descripcion: '', numero_diente: '' })}>{t('addTreatment')}</Button>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{t('attachments')}</CardTitle>
                                    </CardHeader>
                                     <CardContent>
                                        <div className="flex items-center justify-center w-full">
                                            <label htmlFor="session-attachments" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/50">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                                                    <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG, etc.</p>
                                                </div>
                                                <Input id="session-attachments" type="file" multiple className="hidden" onChange={handleAttachmentFileChange} />
                                            </label>
                                        </div>
                                        <div className="mt-4">
                                            <h4 className="font-semibold text-sm mb-2">Existing Files</h4>
                                            {isLoadingAttachments ? (
                                                <div className="flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                                            ) : attachments.length === 0 ? (
                                                <p className="text-xs text-muted-foreground text-center py-2">No files attached.</p>
                                            ) : (
                                                <ScrollArea className="h-24 mt-1 border rounded-md p-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {attachments.map((file, index) => (
                                                            <div key={`new-${index}`} className="flex items-center justify-between gap-2 p-1 bg-blue-100 dark:bg-blue-900/50 rounded-md">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <Image src={URL.createObjectURL(file)} alt={file.name} width={24} height={24} className="rounded object-cover aspect-square"/>
                                                                <span className="text-sm truncate flex-1">{file.name}</span>
                                                            </div>
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(index)}>
                                                                <X className="h-3 w-3"/>
                                                            </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>{t('cancel')}</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? t('saving') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const DocumentViewerModal = ({ isOpen, onOpenChange, document, documentContent }: { isOpen: boolean, onOpenChange: (open: boolean) => void, document: Document | null, documentContent: string | null }) => {
    const ImageViewer = ({ src, alt }: { src: string; alt: string; }) => {
        const [zoom, setZoom] = useState(1);
        const [position, setPosition] = useState({ x: 0, y: 0 });
        const [isDragging, setIsDragging] = useState(false);
        const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
        const imageRef = useRef<HTMLImageElement>(null);

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

        return (
            <div 
                className="flex-1 w-full h-full overflow-hidden flex items-center justify-center relative bg-muted/20"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <img
                    ref={imageRef}
                    src={src}
                    alt={alt}
                    className="max-w-none max-h-none cursor-grab transform-gpu"
                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
                    onMouseDown={handleMouseDown}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 p-2 rounded-lg backdrop-blur-sm">
                    <Button variant="outline" size="icon" onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.2))}><ZoomOut className="h-4 w-4" /></Button>
                    <span className='text-sm font-medium w-16 text-center bg-transparent'>{(zoom * 100).toFixed(0)}%</span>
                    <Button variant="outline" size="icon" onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))}><ZoomIn className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
            </div>
        );
    }
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-4 border-b">
            <DialogTitle>{document?.name}</DialogTitle>
            </DialogHeader>
            {documentContent ? (
                document?.mimeType?.startsWith('image/') ? (
                    <ImageViewer src={documentContent} alt={document.name} />
                ) : (
                    <iframe src={documentContent} className="h-full w-full border-0 flex-1" title={document?.name} />
                )
            ) : (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
            )}
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
    const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
    const t = useTranslations('ClinicHistoryPage');
    const {toast} = useToast();

    const fetchDocuments = useCallback(async () => {
        if (!userId) return;
        setIsLoadingDocuments(true);
        try {
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/users/documents?user_id=${userId}`);
            if (response.ok) {
                const data = await response.json();
                const docs = (Array.isArray(data) && data.length > 0 && data[0].items) ? data[0].items : [];
                setDocuments(docs.map((doc: any) => ({
                    id: String(doc.id),
                    name: doc.name,
                    mimeType: doc.mimeType,
                    hasThumbnail: doc.hasThumbnail,
                    thumbnailLink: getGoogleDriveThumbnailUrl(doc.thumbnailLink),
                    webViewLink: doc.webViewLink,
                })));
            } else {
                setDocuments([]);
            }
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
    
    const handleUpload = async () => {
        if (!uploadFile || !userId) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('user_id', userId);
        
        try {
            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/users/import', {
                method: 'POST',
                body: formData,
            });

            if (response.status === 201) {
                toast({ title: "Upload Successful", description: "Document has been uploaded." });
                fetchDocuments(); // Refresh the list
                setIsUploadDialogOpen(false);
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'File upload failed');
            }
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/users/document?id=${deletingDocument.id}&user_id=${userId}`, {
                method: 'DELETE',
            });
            if (response.status === 204) {
                toast({ title: "Document Deleted", description: `Document "${deletingDocument.name}" has been deleted.` });
                fetchDocuments();
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete document.');
            }
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

    const getGoogleDriveThumbnailUrl = (url: string | undefined) => {
      if (!url) return undefined;
      // Transforms the URL to get a larger thumbnail
      return url.replace(/=s\d+$/, '=s800');
    };
    
    return (
      <div className="space-y-6">
        <div className="bg-card text-card-foreground rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-card-foreground">{t('images.title')}</h3>
            <Button onClick={() => setIsUploadDialogOpen(true)} variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
            </Button>
          </div>
          {isLoadingDocuments ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
          ) : documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="overflow-hidden">
                    <CardContent className="p-0 flex flex-col justify-between h-full">
                        <div className="relative aspect-video w-full bg-muted cursor-pointer" onClick={() => onViewDocument(doc)}>
                            {doc.hasThumbnail && doc.thumbnailLink ? (
                                <Image src={doc.thumbnailLink} alt={doc.name} layout="fill" className="object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                  <FileText className="h-10 w-10 text-muted-foreground" />
                                </div>
                            )}
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/50">
                            {uploadFile ? (
                                 <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FileText className="w-8 h-8 mb-4 text-primary" />
                                    <p className="font-semibold text-foreground">{uploadFile.name}</p>
                                    <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG or GIF (MAX. 10MB)</p>
                                </div>
                            )}
                            <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} />
                        </label>
                    </div> 
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)} disabled={isUploading}>Cancel</Button>
                    <Button onClick={handleUpload} disabled={!uploadFile || isUploading}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isUploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <AlertDialog open={!!deletingDocument} onOpenChange={() => setDeletingDocument(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the document "{deletingDocument?.name}". This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteDocument} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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
  const userId = params.user_id as string || initialUserId;

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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_personales?user_id=${currentUserId}`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Network response was not ok for personal history');
            }
            const data = await response.json();
            const historyData = Array.isArray(data) ? data : (data.antecedentes_personales || data.data || []);
            
            const mappedHistory = historyData.map((item: any, index: number): PersonalHistoryItem => ({
                id: item.id || index,
                padecimiento_id: item.padecimiento_id,
                nombre: item.nombre || 'N/A',
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_familiares?user_id=${currentUserId}`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Network response was not ok for family history');
            }
            const data = await response.json();
            const historyData = Array.isArray(data) ? data : (data.antecedentes_familiares || data.data || []);
            
            const mappedHistory = historyData.map((item: any): FamilyHistoryItem => ({
                id: item.id,
                padecimiento_id: item.padecimiento_id,
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_alergias?user_id=${currentUserId}`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Network response was not ok for allergies');
            }
            const data = await response.json();
            const allergyData = Array.isArray(data) ? data : (data.antecedentes_alergias || data.data || []);
            
            const mappedAllergies = allergyData.map((item: any): AllergyItem => ({
                id: item.id,
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_medicamentos?user_id=${currentUserId}`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Network response was not ok for medications');
            }
            const data = await response.json();
            const medicationData = Array.isArray(data) ? data : (data.antecedentes_medicamentos || data.data || []);
            
            const mappedMedications = medicationData.map((item: any): MedicationItem => ({
                id: item.id,
                medicamento_id: item.medicamento_id,
                medicamento_nombre: item.medicamento_nombre || 'N/A',
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/patient_sessions?user_id=${currentUserId}`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                console.error('Network response was not ok for patient sessions');
                setPatientSessions([]);
                return;
            }
            const data = await response.json();
            const sessionsData = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);
            setPatientSessions(sessionsData);
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/habitos_paciente?user_id=${currentUserId}`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                if (response.status === 404) {
                    setPatientHabits(null);
                    return;
                }
                throw new Error('Network response was not ok for patient habits');
            }
            const data = await response.json();
            const habitsData = Array.isArray(data) && data.length > 0 ? data[0] : (data.habitos_paciente || data.data || null);
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
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?search=${searchQuery}&filter_type=PACIENTE`, {
            method: 'GET',
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
            },
          });
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          const data = await response.json();
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?search=${currentUserId}&filter_type=PACIENTE`, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
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
            } else {
                 throw new Error('Failed to fetch patient details');
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
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/sesiones/delete', {
            method: 'DELETE',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: deletingSession.sesion_id })
        });
        if (!response.ok) throw new Error(t('timeline.toast.deleteError'));
        toast({ title: t('timeline.toast.success'), description: t('timeline.toast.deleteSuccess') });
        refreshAllData();
    } catch (error) {
        console.error('Delete error', error);
        toast({ variant: 'destructive', title: t('timeline.toast.error'), description: error instanceof Error ? error.message : t('timeline.toast.deleteError') });
    } finally {
        setDeletingSession(null);
    }
  };

  const handleViewAttachment = async (file: AttachedFile) => {
    setSelectedDocument({ id: file.ruta, name: file.file_name || 'Attachment', mimeType: file.mime_type });
    setIsViewerOpen(true);
    setDocumentContent(null);
    try {
        const response = await fetch(getAttachmentUrl(file.ruta));
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setDocumentContent(url);
        } else {
            throw new Error("Failed to load attachment");
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: "Could not load attachment." });
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
        <div className="flex space-x-1">
        {navItems.map(({ id, label, icon: Icon }) => (
            <Button
                key={id}
                variant={activeView === id ? 'default' : 'ghost'}
                onClick={() => setActiveView(id)}
                className="flex items-center space-x-2"
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
            <div className="bg-card rounded-xl shadow-lg p-6">
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
        <div className="bg-card rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-card-foreground">{t('title')}</h3>
                <Button onClick={() => onAction('add')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Session
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
                            <TooltipContent>
                                <p>{session.tipo_sesion === 'odontograma' ? t('odontogramTooltip') : t('sessionType')}: {session.tipo_sesion}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    </div>
                    <div className="flex-1">
                    <div className="bg-card rounded-lg border p-4 transition-colors duration-200">
                        <div className="flex justify-between items-start mb-2">
                        <div>
                            <h4 className="font-semibold text-foreground">{session.procedimiento_realizado}</h4>
                            <p className="text-sm text-muted-foreground">{session.fecha_sesion ? format(parseISO(session.fecha_sesion), 'dd/MM/yyyy') : ''}</p>
                        </div>
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
                        </div>
                        <div className="space-y-3 text-sm text-muted-foreground">
                        <p><strong>{t('diagnosis')}:</strong> {session.diagnostico}</p>
                        <p><strong>{t('notes')}:</strong> {session.notas_clinicas}</p>
                        {session.plan_proxima_cita && <p><strong>{t('nextSessionPlan')}:</strong> {session.plan_proxima_cita}</p>}
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
                                    <ul className="list-disc pl-5">
                                    {session.archivos_adjuntos.map((file, i) => (
                                        <li key={i}>
                                        <button
                                            onClick={() => handleViewAttachment(file)}
                                            className="text-primary hover:underline flex items-center gap-1"
                                        >
                                            <Paperclip className="w-3 h-3" />
                                            {file.file_name || 'Attachment'}
                                        </button>
                                        </li>
                                    ))}
                                    </ul>
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
        <div className={cn("min-h-screen", !isFullscreen && "bg-background")}>
        {/* Header */}
        {!isFullscreen && (
        <div className="bg-card shadow-sm border-b border-border px-6 py-4">
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
                                    if(!patientSearchOpen) setPatientSearchOpen(true)
                                }}
                                placeholder={t('searchPlaceholder')}
                                className="pl-9 w-96"
                            />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-96" align="start">
                        <Command>
                            <CommandInput placeholder={t('searchPlaceholder')} value={searchQuery} onValueChange={setSearchQuery}/>
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
                <div className={cn(!isFullscreen && "px-6 py-8")}>
                    <div className={cn("h-[calc(100vh-230px)]", 
                        activeView === 'timeline' && 'flex flex-col',
                        activeView !== 'odontogram' && 'space-y-6')}>

                        {activeView === 'anamnesis' && 
                        <ScrollArea className='flex-1'>
                            <div className="pr-4">
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
                        {activeView === 'timeline' && <TreatmentTimeline sessions={patientSessions} onAction={handleSessionAction} />}
                        {activeView === 'odontogram' && (
                            <div className={cn("relative", isFullscreen ? "fixed inset-0 z-50 bg-background" : "h-[800px] w-full")}>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-2 z-10 bg-background/50 hover:bg-background/80"
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                >
                                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                            </Button>
                                <iframe src={`https://odontogramiia.invokeia.com/?lang=${locale}&user_id=${userId}`} className="w-full h-full border-0" title="Odontograma"></iframe>
                            </div>
                        )}
                        {activeView === 'documents' && <ImageGallery userId={userId} onViewDocument={handleViewAttachment}/>}
                    </div>
                </div>
            </>
        ) : (
            !isFullscreen && (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
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
                        <AlertDialogDescription>
                            {t('timeline.deleteDialog.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('timeline.deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDeleteSession}>{t('timeline.deleteDialog.confirm')}</AlertDialogAction>
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
    const userId = params.user_id as string;
    return <DentalClinicalSystem userId={userId} />;
}
    
export default DentalClinicalSystemPage;







