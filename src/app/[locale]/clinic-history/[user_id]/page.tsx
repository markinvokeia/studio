
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Calendar, AlertTriangle, FileText, Camera, Stethoscope, Heart, Pill, Search, 
  Clock, User, ChevronRight, Eye, Download, Filter, Mic, MicOff, Play, Pause, 
  ZoomIn, ZoomOut, RotateCcw, MessageSquare, Send, FileDown, Layers, TrendingUp, 
  BarChart3, X, Plus, Edit3, Save, Shield, Award, Zap, Paperclip, SearchCheck, RefreshCw,
  Wind, GlassWater, Smile, Maximize, Minimize, ChevronDown, ChevronsUpDown, Check, Trash2, MoreVertical
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import type { User as UserType, PatientSession, TreatmentDetail, AttachedFile, Ailment, Medication } from '@/lib/types';
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

const initialPatient = {
    id: '1',
    name: "María García López",
    age: 34,
    lastVisit: "2024-11-15",
    alerts: [
      { type: "allergy", text: "ALERGIA A PENICILINA", severity: "high", code: "294505008" },
      { type: "condition", text: "HIPERTENSIÓN ARTERIAL", severity: "medium", code: "38341003" },
      { type: "medication", text: "ANTICOAGULADO (Sintrom)", severity: "high", code: "182840001" }
    ],
    medicalHistory: {
      personalHistory: [
        { nombre: "Hipertensión Arterial", categoria: "Cardiovascular", nivel_alerta: 2, comentarios: "Medicación diaria" },
        { nombre: "Diabetes Tipo 2", categoria: "Endocrino", nivel_alerta: 2, comentarios: "Dieta y ejercicio" }
      ],
      familyHistory: [
        { condition: "Diabetes", relative: "Madre", comments: "Diagnosticada a los 45 años" },
        { condition: "Cardiopatía", relative: "Padre", comments: "Infarto a los 60 años" }
      ],
      allergies: [
        { allergen: "Penicilina", reaction: "Urticaria severa", snomed: "294505008" },
        { allergen: "AINEs", reaction: "Irritación gástrica", snomed: "293586001" }
      ],
      medications: [
        { name: "Enalapril", dose: "10mg", frequency: "1/día", since: "2019-03-15", code: "387467008" },
        { name: "Metformina", dose: "850mg", frequency: "2/día", since: "2021-07-20", code: "109081006" },
        { name: "Sintrom", dose: "4mg", frequency: "1/día", since: "2023-01-10", code: "387467008" }
      ]
    }
  };
  
type PersonalHistoryItem = {
    id?: number;
    padecimiento_id: number;
    nombre: string;
    comentarios: string;
};

type FamilyHistoryItem = {
    id?: number;
    padecimiento_id: number;
    nombre: string;
    parentesco: string;
    comentarios: string;
};

type AllergyItem = {
    id?: number;
    alergeno: string;
    reaccion_descrita: string;
    snomed_ct_id: string;
};

type MedicationItem = {
    id?: number;
    medicamento_id: number;
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
                title: 'Error',
                description: 'Por favor, seleccione un padecimiento válido.',
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
                title: 'Éxito',
                description: 'El antecedente personal ha sido guardado.',
            });

            setIsPersonalHistoryDialogOpen(false);
            fetchPersonalHistory(userId);
        } catch (error: any) {
            console.error('Error saving personal history:', error);
            setPersonalSubmissionError(error.message || 'No se pudo guardar el antecedente. Por favor, intente de nuevo.');
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
                title: 'Error',
                description: 'Por favor, complete todos los campos requeridos.',
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
                title: 'Éxito',
                description: 'El antecedente familiar ha sido guardado.',
            });

            setIsFamilyHistoryDialogOpen(false);
            fetchFamilyHistory(userId);
        } catch (error: any) {
            console.error('Error saving family history:', error);
            setFamilySubmissionError(error.message || 'No se pudo guardar el antecedente. Por favor, intente de nuevo.');
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

            toast({ title: 'Éxito', description: 'La alergia ha sido guardada.' });
            setIsAllergyDialogOpen(false);
            fetchAllergies(userId);
        } catch (error: any) {
            setAllergySubmissionError(error.message || 'No se pudo guardar la alergia.');
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

            toast({ title: 'Éxito', description: 'El medicamento ha sido guardado.' });
            setIsMedicationDialogOpen(false);
            fetchMedications(userId);
        } catch (error: any) {
            setMedicationSubmissionError(error.message || 'No se pudo guardar el medicamento.');
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
    
        switch (deletingItem.type) {
            case 'antecedente personal':
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_personales/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchPersonalHistory;
                break;
            case 'antecedente familiar':
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/antecedentes_familiares/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchFamilyHistory;
                break;
            case 'alergia':
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/alergias/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchAllergies;
                break;
            case 'medicamento':
                endpoint = 'https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/medicamentos/delete';
                body = { id: deletingItem.item.id };
                fetchCallback = fetchMedications;
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
                throw new Error(`Failed to delete ${deletingItem.type}`);
            }
    
            toast({
                title: 'Éxito',
                description: `El ${deletingItem.type} ha sido eliminado.`,
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
                title: 'Error',
                description: `No se pudo eliminar el ${deletingItem.type}. Por favor, intente de nuevo.`,
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
                                <h3 className="text-lg font-bold text-card-foreground">Antecedentes Personales</h3>
                            </div>
                            <Button variant="outline" size="icon" onClick={handleAddPersonalClick}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {isLoadingPersonalHistory ? (
                                <p className="text-muted-foreground">Loading personal history...</p>
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'antecedente personal')}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground">No personal history found.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-card rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <Heart className="w-5 h-5 text-red-500 mr-2" />
                                <h3 className="text-lg font-bold text-card-foreground">Antecedentes Familiares</h3>
                            </div>
                             <Button variant="outline" size="icon" onClick={handleAddFamilyClick}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {isLoadingFamilyHistory ? (
                                <p className="text-muted-foreground">Loading family history...</p>
                            ) : familyHistory.length > 0 ? (
                                familyHistory.map((item, index) => (
                                    <div key={index} className="border-l-4 border-red-300 dark:border-red-700 pl-4 py-2 flex justify-between items-center">
                                        <div>
                                            <div className="font-semibold text-foreground">{item.nombre}</div>
                                            <div className="text-sm text-muted-foreground">Familiar: {item.parentesco}</div>
                                            <div className="text-sm text-muted-foreground">{item.comentarios}</div>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFamilyClick(item)}>
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'antecedente familiar')}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                            <p className="text-muted-foreground">No family history found.</p>
                            )}
                        </div>
                    </div>
                    <div className="bg-card rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <Pill className="w-5 h-5 text-green-500 mr-2" />
                                <h3 className="text-lg font-bold text-card-foreground">Medicamentos Actuales</h3>
                            </div>
                            <Button variant="outline" size="icon" onClick={handleAddMedicationClick}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {isLoadingMedications ? (
                                <p className="text-muted-foreground">Loading medications...</p>
                            ) : medications.length > 0 ? (
                                medications.map((item, index) => (
                                    <div key={index} className="border-l-4 border-green-300 dark:border-green-700 pl-4 py-2 flex justify-between items-center">
                                        <div className="grid grid-cols-3 gap-4 items-start flex-1">
                                            <div className="col-span-2">
                                                <div className="font-semibold text-foreground">{item.medicamento_nombre}</div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {formatDate(item.fecha_inicio)} - {item.fecha_fin ? formatDate(item.fecha_fin) : 'Presente'}
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'medicamento')}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                            <p className="text-muted-foreground">No medications found.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-card rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                                <h3 className="text-lg font-bold text-card-foreground">Alergias</h3>
                            </div>
                           <Button variant="outline" size="icon" onClick={handleAddAllergyClick}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {isLoadingAllergies ? (
                                <p className="text-muted-foreground">Loading allergies...</p>
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item, 'alergia')}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground">No allergies found.</p>
                            )}
                        </div>
                    </div>
                    <HabitCard habits={patientHabits} isLoading={isLoadingPatientHabits} userId={userId} fetchPatientHabits={fetchPatientHabits} />
                </div>
            </div>
            <Dialog open={isPersonalHistoryDialogOpen} onOpenChange={setIsPersonalHistoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPersonalHistory ? 'Editar Antecedente Personal' : 'Añadir Antecedente Personal'}</DialogTitle>
                        <DialogDescription>
                            {editingPersonalHistory ? 'Actualice los detalles del antecedente.' : 'Complete el formulario para añadir un nuevo antecedente personal.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitPersonalHistory}>
                        <div className="grid gap-4 py-4">
                            {personalSubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{personalSubmissionError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="padecimiento" className="text-right">Padecimiento</Label>
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
                                        : "Seleccione un padecimiento..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar padecimiento..." />
                                        <CommandEmpty>No se encontró el padecimiento.</CommandEmpty>
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
                                    </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="comentarios" className="text-right pt-2">Comentarios</Label>
                                <Textarea 
                                    id="comentarios" 
                                    placeholder="e.g., Medicación diaria" 
                                    className="col-span-3" 
                                    value={personalComentarios} 
                                    onChange={(e) => setPersonalComentarios(e.target.value)} 
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsPersonalHistoryDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmittingPersonal}>
                                {isSubmittingPersonal ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isFamilyHistoryDialogOpen} onOpenChange={setIsFamilyHistoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingFamilyHistory ? 'Editar Antecedente Familiar' : 'Añadir Antecedente Familiar'}</DialogTitle>
                        <DialogDescription>
                            {editingFamilyHistory ? 'Actualice los detalles del antecedente.' : 'Complete el formulario para añadir un nuevo antecedente familiar.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitFamilyHistory}>
                        <div className="grid gap-4 py-4">
                            {familySubmissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{familySubmissionError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="family-padecimiento" className="text-right">Padecimiento</Label>
                                <Popover open={isFamilyHistoryComboboxOpen} onOpenChange={setIsFamilyHistoryComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isFamilyHistoryComboboxOpen} className="w-[300px] justify-between col-span-3" type="button">
                                            {selectedFamilyAilmentName || "Seleccione un padecimiento..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar padecimiento..." />
                                            <CommandEmpty>No se encontró el padecimiento.</CommandEmpty>
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
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="parentesco" className="text-right">Parentesco</Label>
                                <Select onValueChange={setFamilyParentesco} value={familyParentesco}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Seleccione un parentesco" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Padre">Padre</SelectItem>
                                        <SelectItem value="Madre">Madre</SelectItem>
                                        <SelectItem value="Abuelo Materno">Abuelo Materno</SelectItem>
                                        <SelectItem value="Abuela Materna">Abuela Materna</SelectItem>
                                        <SelectItem value="Abuelo Paterno">Abuelo Paterno</SelectItem>
                                        <SelectItem value="Abuela Paterna">Abuela Paterna</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="family-comentarios" className="text-right pt-2">Comentarios</Label>
                                <Textarea 
                                    id="family-comentarios" 
                                    placeholder="e.g., Diagnosticada a los 45 años" 
                                    className="col-span-3" 
                                    value={familyComentarios} 
                                    onChange={(e) => setFamilyComentarios(e.target.value)} 
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsFamilyHistoryDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmittingFamily}>
                                {isSubmittingFamily ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAllergyDialogOpen} onOpenChange={setIsAllergyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAllergy ? 'Editar Alergia' : 'Añadir Alergia'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAllergy}>
                        <div className="grid gap-4 py-4">
                            {allergySubmissionError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{allergySubmissionError}</AlertDescription></Alert>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="alergeno" className="text-right">Alérgeno</Label>
                                <Input id="alergeno" value={allergyData.alergeno} onChange={(e) => setAllergyData({ ...allergyData, alergeno: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="reaccion_descrita" className="text-right">Reacción</Label>
                                <Input id="reaccion_descrita" value={allergyData.reaccion_descrita} onChange={(e) => setAllergyData({ ...allergyData, reaccion_descrita: e.target.value })} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsAllergyDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmittingAllergy}>{isSubmittingAllergy ? 'Guardando...' : 'Guardar'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isMedicationDialogOpen} onOpenChange={setIsMedicationDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingMedication ? 'Editar Medicamento' : 'Añadir Medicamento'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitMedication}>
                        <div className="grid gap-4 py-4">
                            {medicationSubmissionError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{medicationSubmissionError}</AlertDescription></Alert>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-name" className="text-right">Nombre</Label>
                                 <Popover open={isMedicationComboboxOpen} onOpenChange={setIsMedicationComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isMedicationComboboxOpen} className="w-[300px] justify-between col-span-3" type="button">
                                            {selectedMedication?.name || "Seleccione un medicamento..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar medicamento..." />
                                            <CommandEmpty>No se encontró el medicamento.</CommandEmpty>
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
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-dose" className="text-right">Dosis</Label>
                                <Input id="med-dose" value={medicationData.dosis} onChange={e => setMedicationData({ ...medicationData, dosis: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-frequency" className="text-right">Frecuencia</Label>
                                <Input id="med-frequency" value={medicationData.frecuencia} onChange={e => setMedicationData({ ...medicationData, frecuencia: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-since" className="text-right">Desde</Label>
                                <Input id="med-since" type="date" value={medicationData.fecha_inicio || ''} onChange={e => setMedicationData({ ...medicationData, fecha_inicio: e.target.value })} className="col-span-3" />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-endDate" className="text-right">Hasta</Label>
                                <Input id="med-endDate" type="date" value={medicationData.fecha_fin || ''} onChange={e => setMedicationData({ ...medicationData, fecha_fin: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="med-reason" className="text-right">Motivo</Label>
                                <Input id="med-reason" value={medicationData.motivo} onChange={e => setMedicationData({ ...medicationData, motivo: e.target.value })} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsMedicationDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmittingMedication}>{isSubmittingMedication ? 'Guardando...' : 'Guardar'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this item.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingItem(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

const HabitCard = ({ habits: initialHabits, isLoading: isLoadingProp, userId, fetchPatientHabits }: { habits: PatientHabits | null, isLoading: boolean, userId: string, fetchPatientHabits: (userId: string) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedHabits, setEditedHabits] = useState<PatientHabits>({ tabaquismo: '', alcohol: '', bruxismo: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(isLoadingProp);

    useEffect(() => {
        setIsLoading(isLoadingProp);
        if (initialHabits) {
            setEditedHabits(initialHabits);
        } else {
            setEditedHabits({ tabaquismo: '', alcohol: '', bruxismo: '' });
        }
    }, [initialHabits, isLoadingProp]);

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        if (initialHabits) {
            setEditedHabits(initialHabits);
        }
    };

    const handleInputChange = (field: keyof PatientHabits, value: string) => {
        setEditedHabits(prev => ({ ...prev, [field]: value }));
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
            
            toast({ title: 'Éxito', description: 'Los hábitos del paciente han sido guardados.' });
            setIsEditing(false);
            fetchPatientHabits(userId);

        } catch (error: any) {
            setSubmissionError(error.message || 'No se pudo guardar los hábitos.');
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo guardar los hábitos.' });
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
                    <h3 className="text-lg font-bold text-card-foreground">Hábitos del Paciente</h3>
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
                        <Label htmlFor="tabaquismo">Tabaquismo</Label>
                        <Input id="tabaquismo" placeholder="e.g., 10 cigarrillos al día" value={editedHabits.tabaquismo || ''} onChange={(e) => handleInputChange('tabaquismo', e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="alcohol">Alcohol</Label>
                        <Input id="alcohol" placeholder="e.g., 2 cervezas los fines de semana" value={editedHabits.alcohol || ''} onChange={(e) => handleInputChange('alcohol', e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="bruxismo">Bruxismo</Label>
                        <Input id="bruxismo" placeholder="e.g., Nocturno, utiliza placa" value={editedHabits.bruxismo || ''} onChange={(e) => handleInputChange('bruxismo', e.target.value)} />
                    </div>
                     {submissionError && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{submissionError}</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                </div>
            ) : initialHabits ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <Wind className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground">Tabaquismo</h4>
                    <p className="text-sm text-muted-foreground">{initialHabits.tabaquismo || 'No especificado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <GlassWater className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground">Alcohol</h4>
                    <p className="text-sm text-muted-foreground">{initialHabits.alcohol || 'No especificado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Smile className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground">Bruxismo</h4>
                    <p className="text-sm text-muted-foreground">{initialHabits.bruxismo || 'No especificado'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No patient habits found.</p>
            )}
        </div>
    );
};

const DentalClinicalSystem = ({ userId }: { userId: string }) => {
  const router = useRouter();
  const locale = useLocale();

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
          const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/filter_users?search=${searchQuery}`, {
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
            id: apiUser.user_id ? String(apiUser.user_id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/filter_users?search=${currentUserId}`, {
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
                        ...initialPatient, // keep other mocked data for now
                        id: apiUser.user_id,
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
    // API call to delete session
    setDeletingSession(null);
  };


  const ImageGallery = () => {
    const [filter, setFilter] = useState('all');
    const [zoomLevel, setZoomLevel] = useState(1);
    const imageGallery = [
        {
          id: 1,
          name: "Radiografía Panorámica",
          date: "2024-11-15",
          type: "radiografia",
          tooth: "General",
          modality: "DX",
          bodyPart: "JAW",
          viewPosition: "PA",
          url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UmFkaW9ncmFmw61hIFBhbm9yw6FtaWNhPC90ZXh0Pjwvc3ZnPg==",
          description: "Radiografía panorámica mostrando estado general de la dentadura"
        },
        {
          id: 2,
          name: "Foto Intraoral Anterior",
          date: "2024-11-15",
          type: "foto",
          tooth: "Anteriores",
          modality: "IO",
          bodyPart: "TEETH",
          viewPosition: "ANTERIOR",
          url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhkN2RhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM3MjE3NGYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Gb3RvIEludHJhb3JhbCBBbnRlcmlvcjwvdGV4dD48L3N2Zz4=",
          description: "Vista frontal de los dientes anteriores"
        },
        {
          id: 3,
          name: "Radiografía Periapical 24",
          date: "2024-11-15",
          type: "radiografia",
          tooth: "24",
          modality: "DX",
          bodyPart: "TOOTH",
          viewPosition: "PER",
          url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UmFkaW9ncmFmw61hIDI0PC90ZXh0Pjwvc3ZnPg==",
          description: "Radiografía periapical del diente 24 post-endodoncia"
        }
    ];

    const filteredImages = imageGallery.filter(img => {
      if (filter === 'all') return true;
      if (filter === 'tooth' && selectedTooth) return img.tooth === selectedTooth.toString();
      return img.type === filter;
    });

    const ImageModal = ({ image, onClose }: { image: any, onClose: any }) => (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
        <div className="relative max-w-7xl max-h-full w-full h-full flex flex-col">
          <div className="bg-card p-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-card-foreground">{image.name}</h3>
              <p className="text-muted-foreground">{image.date} • {image.description}</p>
              <div className="text-xs text-muted-foreground mt-1">
                DICOM: {image.modality} | {image.viewPosition} | {image.bodyPart}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                className="p-2 text-muted-foreground hover:bg-muted rounded"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm text-muted-foreground">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
                className="p-2 text-muted-foreground hover:bg-muted rounded"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-2 text-muted-foreground hover:bg-muted rounded"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center overflow-hidden bg-background">
            <img
              src={image.url}
              alt={image.name}
              className="max-w-none transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="bg-card rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-card-foreground">Galería de Imágenes</h3>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">DICOM Compliant</span>
              <Filter className="w-5 h-5 text-muted-foreground ml-4" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground"
              >
                <option value="all">Todas las imágenes</option>
                <option value="radiografia">Radiografías</option>
                <option value="foto">Fotografías</option>
                {selectedTooth && <option value="tooth">Diente {selectedTooth}</option>}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredImages.map((image) => (
              <div
                key={image.id}
                className="bg-muted/50 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer border"
                onClick={() => setSelectedImage(image)}
              >
                <div className="aspect-w-16 aspect-h-12">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full h-48 object-cover"
                  />
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-foreground text-sm">{image.name}</h4>
                  <p className="text-muted-foreground text-xs">{image.date}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      image.type === 'radiografia' 
                        ? 'bg-secondary text-secondary-foreground' 
                        : 'bg-blue-200 text-blue-800'
                    }`}>
                      {image.modality}
                    </span>
                    <span className="text-xs text-muted-foreground">{image.tooth}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedImage && (
          <ImageModal
            image={selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </div>
    );
  };

  const MedicalAlerts = ({ alerts }: { alerts: any[] }) => (
    <div className="bg-destructive/10 border-l-4 border-destructive rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-destructive mr-3" />
          <h3 className="text-lg font-bold text-destructive-foreground">Alertas Médicas Críticas</h3>
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
                    {isOpen ? 'Show Less' : `Show ${items.length - 3} more...`}
                </Button>
            )}
        </div>
    );
  };

  const TreatmentTimeline = ({ sessions, onAction }: { sessions: PatientSession[], onAction: (action: 'add' | 'edit' | 'delete', session?: PatientSession) => void }) => {
    const conditionLabels: { [key: string]: string } = {
        caries: "Caries",
        filling: "Restauración",
        crown: "Corona",
        missing: "Ausente",
        fracture: "Fractura",
        'fixed-ortho': "Orto Fija",
        implant: "Implante",
        endodontics: "Endodoncia",
        pulp: "Pulpitis",
        'crown-tmp': "Corona Temporal",
        bolt: "Perno",
        diastema: "Diastema",
        rotation: "Rotación",
        worn: "Desgastado",
        supernumerary: "Supernumerario",
        fusion: "Fusión",
        prosthesis: "Prótesis",
        edentulism: "Edentulismo",
        eruption: "Erupción",
    };

    const surfaceLabels: { [key: string]: string } = {
        center: 'Oclusal',
        top: 'Vestibular',
        bottom: 'Lingual',
        left: 'Mesial',
        right: 'Distal',
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
                <h3 className="text-xl font-bold text-card-foreground mb-6">Historial de Tratamientos</h3>
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
        <div className="bg-card rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-card-foreground">Historial de Tratamientos</h3>
                <Button variant="outline" size="icon" onClick={() => onAction('add')}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-primary"></div>
                {sessions.map((session, index) => {
                    const odontogramSummary = session.tipo_sesion === 'odontograma' ? generateOdontogramSummary(session.estado_odontograma) : null;
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
                                                <DropdownMenuItem onClick={() => onAction('edit', session)}>
                                                    <Edit3 className="mr-2 h-4 w-4" />
                                                    <span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onAction('delete', session)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    <span>Eliminar</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="space-y-3 text-sm text-foreground/80">
                                        {session.tipo_sesion && <p><strong className="text-foreground/90">Tipo de Sesión:</strong> <span className="capitalize bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">{session.tipo_sesion}</span></p>}
                                        {session.diagnostico && <p><strong className="text-foreground/90">Diagnóstico:</strong> {session.diagnostico}</p>}
                                        {session.notas_clinicas && <p><strong className="text-foreground/90">Notas:</strong> {session.notas_clinicas}</p>}
                                        
                                        {odontogramSummary && (
                                            <CollapsibleList
                                                title="Actualización Odontograma"
                                                items={odontogramSummary.map(item => (
                                                    <li key={item.toothId}>
                                                        <strong className="font-medium">Diente {item.toothId}:</strong> {item.conditions.join(', ')}
                                                    </li>
                                                ))}
                                            />
                                        )}

                                        {session.tratamientos && (
                                           <CollapsibleList
                                                title="Tratamientos"
                                                items={session.tratamientos.map((t, i) => (
                                                    <li key={i}>{t.descripcion} {t.numero_diente && `(Diente ${t.numero_diente})`}</li>
                                                ))}
                                            />
                                        )}
                                        {session.archivos_adjuntos && (
                                            <CollapsibleList
                                                title="Archivos Adjuntos"
                                                items={session.archivos_adjuntos.map((file, i) => (
                                                    <li key={i}>
                                                        <a 
                                                            href={file.ruta} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-primary hover:underline flex items-center gap-1"
                                                        >
                                                            <Paperclip className="w-3 h-3" />
                                                            {file.tipo} {file.diente_asociado && `(Diente ${file.diente_asociado})`}
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
            </div>
        </div>
    );
};
  
  const Navigation = () => (
    <div className="flex space-x-1">
      {[
        { id: 'anamnesis', label: 'Anamnesis', icon: FileText },
        { id: 'timeline', label: 'Timeline', icon: Clock },
        { id: 'odontogram', label: 'Odontogram', icon: Smile },
        { id: 'images', label: 'Imágenes', icon: Camera },
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
    <>
      <div className={cn("min-h-screen", !isFullscreen && "bg-background")}>
        {/* Header */}
        {!isFullscreen && (
        <div className="bg-card shadow-sm border-b border-border px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-card-foreground">Historial Clinico Digital</h1>
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
                              placeholder="Buscar paciente..."
                              className="pl-9 w-96"
                          />
                      </div>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-96" align="start">
                      <Command>
                          <CommandInput placeholder="Buscar por nombre o ID..." value={searchQuery} onValueChange={setSearchQuery}/>
                          <CommandList>
                              <CommandEmpty>
                                  {isSearching ? 'Buscando...' : 'No se encontraron pacientes.'}
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
                  <div className={cn(!isFullscreen && "space-y-6")}>

                      {activeView === 'anamnesis' && 
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
                              <iframe src={`https://2eb9dbc586e5.ngrok-free.app/?lang=${locale}&user_id=${userId}`} className="w-full h-full border-0" title="Odontograma"></iframe>
                          </div>
                      )}
                      {activeView === 'images' && <ImageGallery />}
                  </div>
              </div>
          </>
        ) : (
          !isFullscreen && (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
              <SearchCheck className="w-24 h-24 text-muted-foreground/30 mb-4" />
              <h2 className="text-2xl font-semibold text-foreground/80">Seleccione un paciente</h2>
              <p className="text-muted-foreground mt-2">Utilice la barra de búsqueda de arriba para encontrar y cargar el historial clínico de un paciente.</p>
            </div>
          )
        )}
      </div>

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
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the session. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDeleteSession}>Continue</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
};


const SessionDialog = ({ isOpen, onOpenChange, session, userId, onSave }: { isOpen: boolean, onOpenChange: (open: boolean) => void, session: PatientSession | null, userId: string, onSave: () => void }) => {
  const [sessionType, setSessionType] = useState<'odontograma' | 'clinica'>('clinica');
  const [formData, setFormData] = useState<Partial<PatientSession>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (session) {
      setSessionType(session.tipo_sesion || 'clinica');
      setFormData({
        ...session,
        fecha_sesion: session.fecha_sesion ? format(parseISO(session.fecha_sesion), "yyyy-MM-dd'T'HH:mm") : '',
      });
    } else {
      setSessionType('clinica');
      setFormData({
        fecha_sesion: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        diagnostico: '',
        procedimiento_realizado: '',
        notas_clinicas: '',
        tratamientos: [],
        estado_odontograma: {},
      });
    }
  }, [session, isOpen]);
  
  const handleInputChange = (field: keyof PatientSession, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // API call to save session
    console.log('Saving session...', { ...formData, tipo_sesion: sessionType, paciente_id: userId, sesion_id: session?.sesion_id });
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{session ? 'Edit Session' : 'Create New Session'}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label>Session Type</Label>
                  <Select value={sessionType} onValueChange={(value) => setSessionType(value as 'odontograma' | 'clinica')}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="clinica">Clinical Session</SelectItem>
                          <SelectItem value="odontograma">Odontogram</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
               <div className="space-y-2">
                  <Label>Session Date</Label>
                  <Input type="datetime-local" value={formData.fecha_sesion || ''} onChange={e => handleInputChange('fecha_sesion', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Procedure</Label>
              <Input value={formData.procedimiento_realizado || ''} onChange={e => handleInputChange('procedimiento_realizado', e.target.value)} />
            </div>

            {sessionType === 'clinica' && (
              <>
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Textarea value={formData.diagnostico || ''} onChange={e => handleInputChange('diagnostico', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Clinical Notes</Label>
                  <Textarea value={formData.notas_clinicas || ''} onChange={e => handleInputChange('notas_clinicas', e.target.value)} />
                </div>
              </>
            )}

            {sessionType === 'odontograma' && (
              <div className="space-y-2">
                <Label>Odontogram State (JSON)</Label>
                <Textarea 
                  value={formData.estado_odontograma ? JSON.stringify(formData.estado_odontograma, null, 2) : ''}
                  onChange={e => {
                    try {
                      handleInputChange('estado_odontograma', JSON.parse(e.target.value));
                    } catch {
                      // ignore parse error while typing
                    }
                  }}
                  rows={10}
                />
              </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
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

    