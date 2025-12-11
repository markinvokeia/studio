

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Calendar, AlertTriangle, FileText, Camera, Stethoscope, Heart, Pill, Search, 
  Clock, User, ChevronRight, Eye, Download, Filter, Mic, MicOff, Play, Pause, 
  ZoomIn, ZoomOut, RotateCcw, MessageSquare, Send, FileDown, Layers, TrendingUp, 
  BarChart3, X, Plus, Edit3, Save, Shield, Award, Zap, Paperclip, SearchCheck, RefreshCw,
  Wind, GlassWater, Smile, Maximize, Minimize, ChevronDown, ChevronsUpDown, Check, Trash2, MoreVertical, FolderArchive, Upload, Loader2, MoreHorizontal
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
import { Card, CardContent } from '@/components/ui/card';

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
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div className="bg-card rounded-xl shadow-lg p-6">
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

                    <div className="bg-card rounded-xl shadow-lg p-6">
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
                    <div className="bg-card rounded-xl shadow-lg p-6">
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
                    <div className="bg-card rounded-xl shadow-lg p-6">
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
                    <HabitCard userId={userId} fetchPatientHabits={fetchPatientHabits} />
                </div>
            </div>
            <Dialog open={isPersonalHistoryDialogOpen} onOpenChange={setIsPersonalHistoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPersonalHistory ? t('anamnesis.dialogs.personal.editTitle') : t('anamnesis.dialogs.personal.addTitle')}</DialogTitle>
                        <DialogDescription>
                            {editingPersonalHistory ? t('anamnesis.dialogs.personal.editDescription') : t('anamnesis.dialogs.personal.addDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitPersonalHistory}>
                        <div className="grid gap-4 py-4">
                            {personalSubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('anamnesis.toast.error')}</AlertTitle>
                                    <AlertDescription>{personalSubmissionError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="padecimiento" className="text-right">{t('anamnesis.dialogs.ailment')}</Label>
                                <Popover open={isPersonalHistoryComboboxOpen} onOpenChange={setIsPersonalHistoryComboboxOpen}>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isPersonalHistoryComboboxOpen}
                                        className="w-[300px] justify-between col-span-3"
                                        type="button"
                                    >
                                        {selectedPersonalAilmentName
                                        ? selectedPersonalAilmentName
                                        : t('anamnesis.dialogs.selectAilment')}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder={t('anamnesis.dialogs.searchAilment')} />
                                        <CommandList>
                                        <CommandEmpty>{t('anamnesis.dialogs.noAilmentFound')}</CommandEmpty>
                                        <CommandGroup>
                                        {ailmentsCatalog.map((ailment) => (
                                            <CommandItem
                                            key={ailment.nombre}
                                            value={ailment.nombre}
                                            onSelect={(currentValue) => {
                                                setSelectedPersonalAilmentName(currentValue === selectedPersonalAilmentName ? "" : currentValue)
                                                setIsPersonalHistoryComboboxOpen(false)
                                            }}
                                            >
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedPersonalAilmentName === ailment.nombre ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {ailment.nombre}
                                            </CommandItem>
                                        ))}
                                        </CommandGroup>
                                        </CommandList>
                                    </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="comentarios" className="text-right pt-2">{t('anamnesis.dialogs.comments')}</Label>
                                <Textarea 
                                    id="comentarios" 
                                    placeholder={t('anamnesis.dialogs.commentsPlaceholder')} 
                                    className="col-span-3" 
                                    value={personalComentarios} 
                                    onChange={(e) => setPersonalComentarios(e.target.value)} 
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsPersonalHistoryDialogOpen(false)}>{t('anamnesis.dialogs.cancel')}</Button>
                            <Button type="submit" disabled={isSubmittingPersonal}>
                                {isSubmittingPersonal ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isFamilyHistoryDialogOpen} onOpenChange={setIsFamilyHistoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingFamilyHistory ? t('anamnesis.dialogs.family.editTitle') : t('anamnesis.dialogs.family.addTitle')}</DialogTitle>
                        <DialogDescription>
                             {editingFamilyHistory ? t('anamnesis.dialogs.family.editDescription') : t('anamnesis.dialogs.family.addDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitFamilyHistory}>
                        <div className="grid gap-4 py-4">
                            {familySubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('anamnesis.toast.error')}</AlertTitle>
                                    <AlertDescription>{familySubmissionError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="family-padecimiento" className="text-right">{t('anamnesis.dialogs.ailment')}</Label>
                                <Popover open={isFamilyHistoryComboboxOpen} onOpenChange={setIsFamilyHistoryComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isFamilyHistoryComboboxOpen} className="w-[300px] justify-between col-span-3" type="button">
                                            {selectedFamilyAilmentName || t('anamnesis.dialogs.selectAilment')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder={t('anamnesis.dialogs.searchAilment')} />
                                            <CommandList>
                                            <CommandEmpty>{t('anamnesis.dialogs.noAilmentFound')}</CommandEmpty>
                                            <CommandGroup>
                                                {ailmentsCatalog.map((ailment) => (
                                                    <CommandItem
                                                        key={ailment.nombre}
                                                        value={ailment.nombre}
                                                        onSelect={(currentValue) => {
                                                            setSelectedFamilyAilmentName(currentValue === selectedFamilyAilmentName ? "" : currentValue);
                                                            setIsFamilyHistoryComboboxOpen(false);
                                                        }}>
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
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="parentesco" className="text-right">{t('anamnesis.dialogs.family.relationship')}</Label>
                                <Select onValueChange={setFamilyParentesco} value={familyParentesco}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('anamnesis.dialogs.family.selectRelationship')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Padre">{t('anamnesis.dialogs.family.father')}</SelectItem>
                                        <SelectItem value="Madre">{t('anamnesis.dialogs.family.mother')}</SelectItem>
                                        <SelectItem value="Abuelo Materno">{t('anamnesis.dialogs.family.maternalGrandfather')}</SelectItem>
                                        <SelectItem value="Abuela Paterna">{t('anamnesis.dialogs.family.paternalGrandmother')}</SelectItem>
                                        <SelectItem value="Abuelo Paterno">{t('anamnesis.dialogs.family.paternalGrandfather')}</SelectItem>
                                        <SelectItem value="Abuela Materna">{t('anamnesis.dialogs.family.maternalGrandmother')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="family-comentarios" className="text-right pt-2">{t('anamnesis.dialogs.comments')}</Label>
                                <Textarea 
                                    id="family-comentarios" 
                                    placeholder={t('anamnesis.dialogs.family.commentsPlaceholder')} 
                                    className="col-span-3" 
                                    value={familyComentarios} 
                                    onChange={(e) => setFamilyComentarios(e.target.value)} 
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsFamilyHistoryDialogOpen(false)}>{t('anamnesis.dialogs.cancel')}</Button>
                            <Button type="submit" disabled={isSubmittingFamily}>
                                {isSubmittingFamily ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAllergyDialogOpen} onOpenChange={setIsAllergyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAllergy ? t('anamnesis.dialogs.allergy.editTitle') : t('anamnesis.dialogs.allergy.addTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAllergy}>
                        <div className="grid gap-4 py-4">
                            {allergySubmissionError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('anamnesis.toast.error')}</AlertTitle><AlertDescription>{allergySubmissionError}</AlertDescription></Alert>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="alergeno" className="text-right">{t('anamnesis.dialogs.allergy.allergen')}</Label>
                                <Input id="alergeno" value={allergyData.alergeno} onChange={(e) => setAllergyData({ ...allergyData, alergeno: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="reaccion_descrita" className="text-right">{t('anamnesis.dialogs.allergy.reaction')}</Label>
                                <Input id="reaccion_descrita" value={allergyData.reaccion_descrita} onChange={(e) => setAllergyData({ ...allergyData, reaccion_descrita: e.target.value })} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsAllergyDialogOpen(false)}>{t('anamnesis.dialogs.cancel')}</Button>
                            <Button type="submit" disabled={isSubmittingAllergy}>{isSubmittingAllergy ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isMedicationDialogOpen} onOpenChange={setIsMedicationDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingMedication ? t('anamnesis.dialogs.medication.editTitle') : t('anamnesis.dialogs.medication.addTitle')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitMedication}>
                        <div className="grid gap-4 py-4">
                            {medicationSubmissionError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('anamnesis.toast.error')}</AlertTitle><AlertDescription>{medicationSubmissionError}</AlertDescription></Alert>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-name" className="text-right">{t('anamnesis.dialogs.medication.name')}</Label>
                                 <Popover open={isMedicationComboboxOpen} onOpenChange={setIsMedicationComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isMedicationComboboxOpen} className="w-[300px] justify-between col-span-3" type="button">
                                            {selectedMedication?.name || t('anamnesis.dialogs.medication.selectMedication')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder={t('anamnesis.dialogs.medication.searchMedication')} />
                                            <CommandList>
                                            <CommandEmpty>{t('anamnesis.dialogs.medication.noMedicationFound')}</CommandEmpty>
                                            <CommandGroup>
                                                {medicationsCatalog.map((med) => (
                                                    <CommandItem
                                                        key={med.id}
                                                        value={med.nombre_generico}
                                                        onSelect={() => {
                                                            setSelectedMedication({ id: med.id, name: med.nombre_generico });
                                                            setIsMedicationComboboxOpen(false);
                                                        }}>
                                                        <Check className={cn("mr-2 h-4 w-4", selectedMedication?.id === med.id ? "opacity-100" : "opacity-0")} />
                                                        {med.nombre_generico}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-dose" className="text-right">{t('anamnesis.dialogs.medication.dose')}</Label>
                                <Input id="med-dose" value={medicationData.dosis} onChange={e => setMedicationData({ ...medicationData, dosis: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-frequency" className="text-right">{t('anamnesis.dialogs.medication.frequency')}</Label>
                                <Input id="med-frequency" value={medicationData.frecuencia} onChange={e => setMedicationData({ ...medicationData, frecuencia: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-since" className="text-right">{t('anamnesis.dialogs.medication.startDate')}</Label>
                                <Input id="med-since" type="date" value={medicationData.fecha_inicio || ''} onChange={e => setMedicationData({ ...medicationData, fecha_inicio: e.target.value })} className="col-span-3" />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-endDate" className="text-right">{t('anamnesis.dialogs.medication.endDate')}</Label>
                                <Input id="med-endDate" type="date" value={medicationData.fecha_fin || ''} onChange={e => setMedicationData({ ...medicationData, fecha_fin: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-reason" className="text-right">{t('anamnesis.dialogs.medication.reason')}</Label>
                                <Input id="med-reason" value={medicationData.motivo} onChange={e => setMedicationData({ ...medicationData, motivo: e.target.value })} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsMedicationDialogOpen(false)}>{t('anamnesis.dialogs.cancel')}</Button>
                            <Button type="submit" disabled={isSubmittingMedication}>{isSubmittingMedication ? t('anamnesis.dialogs.saving') : t('anamnesis.dialogs.save')}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('anamnesis.deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                           {t('anamnesis.deleteDialog.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingItem(null)}>{t('anamnesis.deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete}>{t('anamnesis.deleteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

const HabitCard = ({ userId, fetchPatientHabits }: { userId: string, fetchPatientHabits: (userId: string) => void }) => {
    const t = useTranslations('ClinicHistoryPage.habits');
    const [isEditing, setIsEditing] = useState(false);
    const [editedHabits, setEditedHabits] = useState<PatientHabits>({ tabaquismo: '', alcohol: '', bruxismo: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [initialHabits, setInitialHabits] = useState<PatientHabits | null>(null);

    const loadHabits = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/habitos_paciente?user_id=${userId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                if (response.status === 404) {
                    setInitialHabits(null);
                    setEditedHabits({ tabaquismo: '', alcohol: '', bruxismo: '' });
                    return;
                }
                throw new Error(errorData?.message || 'Network response was not ok for patient habits');
            }
            const data = await response.json();
            const habitsData = Array.isArray(data) && data.length > 0 ? data[0] : (data.habitos_paciente || data.data || null);
            setInitialHabits(habitsData);
            setEditedHabits(habitsData || { tabaquismo: '', alcohol: '', bruxismo: '' });
        } catch (error) {
            console.error("Failed to fetch patient habits:", error);
            setInitialHabits(null);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);
    
    useEffect(() => {
        loadHabits();
    }, [loadHabits]);

    const handleInputChange = (field: keyof Omit<PatientHabits, 'id'>, value: string) => {
        setEditedHabits(prev => ({ ...prev, [field]: value }));
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedHabits(initialHabits || { tabaquismo: '', alcohol: '', bruxismo: '' });
        setSubmissionError(null);
    };
    
    const handleSave = async () => {
        if (!userId) return;
        setIsSubmitting(true);
        setSubmissionError(null);
        try {
            const payload: any = {
                paciente_id: userId,
                ...editedHabits
            };
            if(initialHabits?.id) {
                payload.id = initialHabits.id;
            }

            const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/habitos/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.status > 299) throw new Error((await response.json()).message || 'Server error');
            
            toast({ title: t('toast.success'), description: t('toast.saveSuccess') });
            setIsEditing(false);
            loadHabits(); // Re-fetch to update initialHabits

        } catch (error: any) {
            setSubmissionError(error.message || t('toast.saveError'));
            toast({ variant: 'destructive', title: t('toast.error'), description: error.message || t('toast.saveError') });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-card rounded-xl shadow-lg p-6">
                 <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-8 w-8" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <User className="w-5 h-5 text-primary mr-2" />
                    <h3 className="text-lg font-bold text-card-foreground">{t('title')}</h3>
                </div>
                {!isEditing && (
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEdit}>
                        <Edit3 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {isEditing ? (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="tabaquismo">{t('smoking')}</Label>
                        <Input id="tabaquismo" placeholder={t('smokingPlaceholder')} value={editedHabits.tabaquismo || ''} onChange={(e) => handleInputChange('tabaquismo', e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="alcohol">{t('alcohol')}</Label>
                        <Input id="alcohol" placeholder={t('alcoholPlaceholder')} value={editedHabits.alcohol || ''} onChange={(e) => handleInputChange('alcohol', e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="bruxismo">{t('bruxism')}</Label>
                        <Input id="bruxismo" placeholder={t('bruxismPlaceholder')} value={editedHabits.bruxismo || ''} onChange={(e) => handleInputChange('bruxismo', e.target.value)} />
                    </div>
                     {submissionError && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{t('toast.error')}</AlertTitle>
                            <AlertDescription>{submissionError}</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={handleCancel}>{t('cancel')}</Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? t('saving') : t('save')}
                        </Button>
                    </div>
                </div>
            ) : initialHabits ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <Wind className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground">{t('smoking')}</h4>
                    <p className="text-sm text-muted-foreground">{initialHabits.tabaquismo || t('notSpecified')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <GlassWater className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground">{t('alcohol')}</h4>
                    <p className="text-sm text-muted-foreground">{initialHabits.alcohol || t('notSpecified')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Smile className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground">{t('bruxism')}</h4>
                    <p className="text-sm text-muted-foreground">{initialHabits.bruxismo || t('notSpecified')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{t('noData')}</p>
            )}
        </div>
    );
};

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

const DentalClinicalSystem = ({ userId: initialUserId }: { userId: string }) => {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('ClinicHistoryPage');
  const params = useParams();
  const userId = params.user_id as string || initialUserId;

  const [activeView, setActiveView] = useState('anamnesis');
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [selectedDate, setSelectedDate] = useState('2024-11-15');
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDate, setCompareDate] = useState('2024-01-15');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [dentitionType, setDentitionType] = useState('permanent');
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
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?search=${searchQuery}`, {
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?search=${currentUserId}`, {
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


  const ImageGallery = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [documentContent, setDocumentContent] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);


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
            thumbnailLink: doc.thumbnailLink
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
    
    const handleViewDocument = async (doc: Document) => {
      setSelectedDocument(doc);
      setIsViewerOpen(true);
      setDocumentContent(null);
      try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/users/document?id=${doc.id}&user_id=${userId}`);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setDocumentContent(url);
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not load document.',
          });
          setIsViewerOpen(false);
        }
      } catch (error) {
        console.error("Failed to load document content:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to fetch document content.',
        });
        setIsViewerOpen(false);
      }
    };
    
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
    
    const DocumentViewerModal = () => (
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
          </DialogHeader>
          {documentContent ? (
              selectedDocument?.mimeType?.startsWith('image/') ? (
                  <ImageViewer src={documentContent} alt={selectedDocument.name} />
              ) : (
                  <iframe src={documentContent} className="h-full w-full border-0 flex-1" title={selectedDocument?.name} />
              )
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    );

    return (
      <div className="space-y-6">
        <div className="bg-card rounded-xl shadow-lg p-6">
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
                        <div className="relative aspect-video w-full bg-muted cursor-pointer" onClick={() => handleViewDocument(doc)}>
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
        {isViewerOpen && <DocumentViewerModal />}
        
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

  const MedicalAlerts = ({ alerts }: { alerts: any[] }) => (
    <div className="bg-destructive/10 border-l-4 border-destructive rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-destructive mr-3" />
          <h3 className="text-lg font-bold text-destructive-foreground">{t('alerts.title')}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-muted-foreground">SNOMED-CT</span>
        </div>
      </div>
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div key={index} className={`p-3 rounded-lg ${
            alert.severity === 'high' ? 'bg-destructive/20 border border-destructive/50' : 'bg-yellow-500/20 border border-yellow-500/50'
          }`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold ${alert.severity === 'high' ? 'text-destructive-foreground' : 'text-yellow-800 dark:text-yellow-300'}`}>
                🔴 {alert.text}
              </span>
              <span className="text-xs text-muted-foreground">{alert.code}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const CollapsibleList = ({ title, items }: { title: string, items: React.ReactNode[] }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (!items || items.length === 0) return null;
    
    const visibleItems = isOpen ? items : items.slice(0, 3);

    return (
        <div>
            <strong className="text-foreground/80">{title}:</strong>
            <ul className="list-disc pl-5 mt-1">
                {visibleItems}
            </ul>
            {items.length > 3 && (
                <Button variant="link" onClick={() => setIsOpen(!isOpen)} className="p-0 h-auto text-xs">
                    {isOpen ? t('timeline.showLess') : t('timeline.showMore', { count: items.length - 3 })}
                </Button>
            )}
        </div>
    );
  };

  const TreatmentTimeline = ({ sessions, onAction }: { sessions: PatientSession[], onAction: (action: 'add' | 'edit' | 'delete', session?: PatientSession) => void }) => {
    const conditionLabels: { [key: string]: string } = {
        caries: t('odontogram.conditions.caries'),
        filling: t('odontogram.conditions.filling'),
        crown: t('odontogram.conditions.crown'),
        missing: t('odontogram.conditions.missing'),
        fracture: t('odontogram.conditions.fracture'),
        'fixed-ortho': t('odontogram.conditions.fixed-ortho'),
        implant: t('odontogram.conditions.implant'),
        endodontics: t('odontogram.conditions.endodontics'),
        pulp: t('odontogram.conditions.pulp'),
        'crown-tmp': t('odontogram.conditions.crown-tmp'),
        bolt: t('odontogram.conditions.bolt'),
        diastema: t('odontogram.conditions.diastema'),
        rotation: t('odontogram.conditions.rotation'),
        worn: t('odontogram.conditions.worn'),
        supernumerary: t('odontogram.conditions.supernumerary'),
        prosthesis: t('odontogram.conditions.prosthesis'),
        edentulism: t('odontogram.conditions.edentulism'),
        eruption: t('odontogram.conditions.eruption'),
    };

    const surfaceLabels: { [key: string]: string } = {
        center: t('odontogram.surfaces.center'),
        top: t('odontogram.surfaces.top'),
        bottom: t('odontogram.surfaces.bottom'),
        left: t('odontogram.surfaces.left'),
        right: t('odontogram.surfaces.right'),
    };

    const getDescriptionsForTooth = (toothState: any) => {
        if (!toothState) return [];

        const descriptions = [];
        if (toothState.whole) {
            const conditionLabel = conditionLabels[toothState.whole] || toothState.whole;
            descriptions.push(conditionLabel);
        }

        const surfaceGroups: { [key: string]: string[] } = {};
        for (const surface in surfaceLabels) {
            const conditionId = toothState[surface];
            if (conditionId) {
                if (!surfaceGroups[conditionId]) {
                    surfaceGroups[conditionId] = [];
                }
                surfaceGroups[conditionId].push(surfaceLabels[surface]);
            }
        }

        for (const conditionId in surfaceGroups) {
            const conditionLabel = conditionLabels[conditionId] || conditionId;
            const affectedSurfaces = surfaceGroups[conditionId].join(', ');
            descriptions.push(`${conditionLabel} (${affectedSurfaces})`);
        }

        if (toothState.overlays && Array.isArray(toothState.overlays)) {
            toothState.overlays.forEach((overlayId: string) => {
                const conditionLabel = conditionLabels[overlayId] || overlayId;
                descriptions.push(conditionLabel);
            });
        }

        return descriptions;
    };

    const generateOdontogramSummary = (odontogramState: any) => {
        if (!odontogramState) return null;
        const summary: { toothId: string, conditions: string[] }[] = [];
        const toothIds = Object.keys(odontogramState).sort((a, b) => Number(a) - Number(b));
        
        toothIds.forEach(toothId => {
            const toothState = odontogramState[toothId];
            const conditions = getDescriptionsForTooth(toothState);
            if(conditions.length > 0) {
               summary.push({ toothId, conditions });
            }
        });

        return summary;
    };


    if (isLoadingPatientSessions) {
        return (
            <div className="bg-card rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-card-foreground mb-6">{t('timeline.title')}</h3>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="flex flex-col items-center">
                               <div className="w-6 h-6 rounded-full bg-muted animate-pulse"></div>
                               <div className="w-0.5 h-20 bg-muted animate-pulse mt-2"></div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="h-5 w-3/4 bg-muted rounded animate-pulse"></div>
                                <div className="h-4 w-1/2 bg-muted rounded animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-card rounded-xl shadow-lg p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-card-foreground">{t('timeline.title')}</h3>
                <Button variant="outline" size="icon" onClick={() => onAction('add')}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            <ScrollArea className="flex-1 -mr-6">
                <div className="relative pr-6">
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-primary"></div>
                    <TooltipProvider>
                    {sessions.map((session, index) => {
                        const odontogramSummary = session.tipo_sesion === 'odontograma' ? generateOdontogramSummary(session.estado_odontograma) : null;
                        const isOdontogramSession = session.tipo_sesion === 'odontograma';
                        return (
                            <div key={`${session.sesion_id}-${index}`} className="relative flex items-start mb-8 last:mb-0 pl-8">
                                <div className={`absolute left-0 top-0 z-10 w-6 h-6 rounded-full border-4 border-background shadow-lg bg-primary`}></div>
                                <div className="flex-1">
                                    <div className="bg-muted/50 rounded-lg p-4 hover:bg-muted transition-colors duration-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-semibold text-foreground">{session.procedimiento_realizado}</h4>
                                                <span className="text-sm text-muted-foreground">{session.fecha_sesion ? format(parseISO(session.fecha_sesion), 'dd/MM/yyyy') : ''}</span>
                                            </div>
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className={cn('w-full', isOdontogramSession && 'cursor-not-allowed')}>
                                                                <DropdownMenuItem 
                                                                    onSelect={(e) => isOdontogramSession && e.preventDefault()}
                                                                    onClick={() => !isOdontogramSession && onAction('edit', session)} 
                                                                    disabled={isOdontogramSession}
                                                                >
                                                                    <Edit3 className="mr-2 h-4 w-4" />
                                                                    <span>{t('timeline.edit')}</span>
                                                                </DropdownMenuItem>
                                                            </div>
                                                        </TooltipTrigger>
                                                        {isOdontogramSession && <TooltipContent>{t('timeline.odontogramTooltip')}</TooltipContent>}
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className={cn('w-full', isOdontogramSession && 'cursor-not-allowed')}>
                                                                <DropdownMenuItem
                                                                    onSelect={(e) => isOdontogramSession && e.preventDefault()}
                                                                    onClick={() => !isOdontogramSession && onAction('delete', session)}
                                                                    disabled={isOdontogramSession}
                                                                    className="text-destructive"
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    <span>{t('timeline.delete')}</span>
                                                                </DropdownMenuItem>
                                                            </div>
                                                        </TooltipTrigger>
                                                         {isOdontogramSession && <TooltipContent>{t('timeline.odontogramTooltip')}</TooltipContent>}
                                                    </Tooltip>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="space-y-3 text-sm text-foreground/80">
                                            {session.tipo_sesion && <p><strong className="text-foreground/90">{t('timeline.sessionType')}:</strong> <span className="capitalize bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">{session.tipo_sesion}</span></p>}
                                            {session.diagnostico && <p><strong className="text-foreground/90">{t('timeline.diagnosis')}:</strong> {session.diagnostico}</p>}
                                            {session.notas_clinicas && <p><strong className="text-foreground/90">{t('timeline.notes')}:</strong> {session.notas_clinicas}</p>}
                                            
                                            {odontogramSummary && (
                                                <CollapsibleList
                                                    title={t('timeline.odontogramUpdate')}
                                                    items={odontogramSummary.map(item => (
                                                        <li key={item.toothId}>
                                                            <strong className="font-medium">{t('timeline.tooth', {id: item.toothId})}:</strong> {item.conditions.join(', ')}
                                                        </li>
                                                    ))}
                                                />
                                            )}

                                            {session.tratamientos && (
                                               <CollapsibleList
                                                    title={t('timeline.treatments')}
                                                    items={session.tratamientos.map((tr, i) => (
                                                        <li key={i}>{tr.descripcion} {tr.numero_diente && `(${t('timeline.tooth', {id: tr.numero_diente})})`}</li>
                                                    ))}
                                                />
                                            )}
                                            {session.archivos_adjuntos && (
                                                <CollapsibleList
                                                    title={t('timeline.attachments')}
                                                    items={session.archivos_adjuntos.map((file, i) => (
                                                        <li key={i}>
                                                            <a 
                                                                href={file.ruta} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-primary hover:underline flex items-center gap-1"
                                                            >
                                                                <Paperclip className="w-3 h-3" />
                                                                {file.tipo} {file.diente_asociado && `(${t('timeline.tooth', {id: file.diente_asociado})})`}
                                                            </a>
                                                        </li>
                                                    ))}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    </TooltipProvider>
                </div>
            </ScrollArea>
        </div>
    );
};
  
  const Navigation = () => (
    <div className="flex space-x-1">
      {[
        { id: 'anamnesis', label: t('tabs.anamnesis'), icon: FileText },
        { id: 'timeline', label: t('tabs.timeline'), icon: Clock },
        { id: 'odontogram', label: t('tabs.odontogram'), icon: Smile },
        { id: 'documents', label: t('tabs.documents'), icon: FolderArchive },
      ].map(({ id, label, icon: Icon }) => (
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
                    {activeView === 'documents' && <ImageGallery />}
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
    </div>
  );
};

const SessionDialog = ({ isOpen, onOpenChange, session, userId, onSave }: { isOpen: boolean, onOpenChange: (open: boolean) => void, session: PatientSession | null, userId: string, onSave: () => void }) => {
    const t = useTranslations('ClinicHistoryPage.sessionDialog');
    const [formData, setFormData] = useState<Partial<PatientSession>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [doctors, setDoctors] = useState<UserType[]>([]);
    const { toast } = useToast();

    const [newTreatmentDescription, setNewTreatmentDescription] = useState('');
    const [newTreatmentTooth, setNewTreatmentTooth] = useState('');

    useEffect(() => {
        async function fetchDoctors() {
            try {
                const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users/doctors`);
                if (response.ok) {
                    const data = await response.json();
                    const doctorsData = Array.isArray(data) ? data : (data.doctors || data.data || data.result || []);
                    setDoctors(doctorsData);
                }
            } catch (error) {
                console.error("Failed to fetch doctors:", error);
            }
        }
        if (isOpen) {
            fetchDoctors();
        }
    }, [isOpen]);

    useEffect(() => {
        const fetchSessionDetails = async (sessionId: number) => {
            try {
                const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/sesiones/details?session_id=${sessionId}`);
                if (response.ok) {
                    const data = await response.json();
                     const sessionDetails = Array.isArray(data) && data.length > 0 ? data[0] : null;
                     if(sessionDetails) {
                        setFormData({
                            ...sessionDetails,
                            fecha_sesion: sessionDetails.fecha_sesion ? format(parseISO(sessionDetails.fecha_sesion), "yyyy-MM-dd'T'HH:mm") : '',
                            tratamientos: sessionDetails.lista_tratamientos || [],
                        });
                     }
                }
            } catch (error) {
                console.error('Failed to fetch session details', error);
            }
        };

        if (isOpen) {
            if (session) {
                fetchSessionDetails(session.sesion_id);
            } else {
                setFormData({
                    fecha_sesion: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                    diagnostico: '',
                    procedimiento_realizado: '',
                    notas_clinicas: '',
                    tratamientos: [],
                });
            }
        }
    }, [session, isOpen]);
  
    const handleInputChange = (field: keyof PatientSession, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
  
    const handleAddTreatment = () => {
        if (!newTreatmentDescription) {
            toast({
                variant: 'destructive',
                title: t('toast.error'),
                description: t('toast.treatmentDescriptionEmpty'),
            });
            return;
        }

        const toothNumber = newTreatmentTooth ? parseInt(newTreatmentTooth, 10) : null;
        if (toothNumber !== null && (isNaN(toothNumber) || toothNumber < 11 || toothNumber > 85)) {
            toast({
                variant: 'destructive',
                title: t('toast.error'),
                description: "The tooth number must be between 11 and 85.",
            });
            return;
        }

        const newTreatment: TreatmentDetail = {
            descripcion: newTreatmentDescription,
            numero_diente: toothNumber,
        };
        setFormData(prev => ({
            ...prev,
            tratamientos: [...(prev.tratamientos || []), newTreatment]
        }));
        setNewTreatmentDescription('');
        setNewTreatmentTooth('');
    };
  
    const handleRemoveTreatment = (index: number) => {
        setFormData(prev => ({
            ...prev,
            tratamientos: prev.tratamientos?.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        const endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/sesiones/upsert';

        const payload: any = {
            ...formData,
            paciente_id: userId,
            tipo_sesion: 'clinica', 
        };

        delete payload.estado_odontograma;

        if (session) {
            payload.id = session.sesion_id;
        } else {
            delete payload.sesion_id;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to save session: ${errorText}`);
            }
            toast({ title: t('toast.success'), description: t('toast.saveSuccess') });
            onSave();
            onOpenChange(false);
        } catch (error) {
            console.error('Save error', error);
            toast({ variant: 'destructive', title: t('toast.error'), description: t('toast.saveError') });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{session ? t('editTitle') : t('createTitle')}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>{t('date')}</Label>
                        <Input type="datetime-local" value={formData.fecha_sesion || ''} onChange={e => handleInputChange('fecha_sesion', e.target.value)} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('doctor')}</Label>
                                <Select value={formData.doctor_id || ''} onValueChange={(value) => handleInputChange('doctor_id', value)}>
                                    <SelectTrigger><SelectValue placeholder={t('selectDoctor')} /></SelectTrigger>
                                    <SelectContent>
                                        {doctors.map(doc => (
                                            <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('procedure')}</Label>
                                <Input value={formData.procedimiento_realizado || ''} onChange={e => handleInputChange('procedimiento_realizado', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('diagnosis')}</Label>
                                <Textarea value={formData.diagnostico || ''} onChange={e => handleInputChange('diagnostico', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('notes')}</Label>
                                <Textarea value={formData.notas_clinicas || ''} onChange={e => handleInputChange('notas_clinicas', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-semibold">{t('treatments')}</h4>
                            <div className="space-y-2 p-2 border rounded-md">
                                <div className="flex gap-2">
                                    <Input 
                                        type="number"
                                        placeholder={t('toothPlaceholder')}
                                        value={newTreatmentTooth}
                                        onChange={(e) => setNewTreatmentTooth(e.target.value)}
                                        className="w-24"
                                    />
                                    <Input 
                                        placeholder={t('treatmentPlaceholder')} 
                                        value={newTreatmentDescription}
                                        onChange={(e) => setNewTreatmentDescription(e.target.value)}
                                    />
                                    <Button type="button" onClick={handleAddTreatment} size="icon"><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {formData.tratamientos && formData.tratamientos.map((treatment, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                        <div>
                                            <p className="text-sm font-medium">{treatment.descripcion}</p>
                                            {treatment.numero_diente && <p className="text-xs text-muted-foreground">{t('tooth')}: {treatment.numero_diente}</p>}
                                        </div>
                                        <Button type="button" variant="destructive-ghost" size="icon" onClick={() => handleRemoveTreatment(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? t('saving') : t('save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function DentalClinicalSystemPage() {
    const params = useParams();
    const userId = params.user_id as string;
    return <DentalClinicalSystem userId={userId} />;
}

    

    






