'use client';

import { API_ROUTES } from '@/constants/routes';
import { Ailment, Medication, PatientSession } from '@/lib/types';
import api from '@/services/api';
import { useCallback, useState } from 'react';

export interface ClinicDocument {
    id: string;
    nombre: string;
    tipo: string;
    ruta: string;
    fecha_subida: string;
    tamaño: number;
    thumbnail_url?: string;
    mimeType?: string;
    hasThumbnail?: boolean;
}

export interface PersonalHistoryItem {
    id?: number;
    padecimiento_id?: string;
    nombre: string;
    categoria: string;
    nivel_alerta: number;
    comentarios: string;
}

export interface FamilyHistoryItem {
    id?: number;
    padecimiento_id?: string;
    nombre: string;
    parentesco: string;
    comentarios: string;
}

export interface AllergyItem {
    id?: number;
    alergeno: string;
    reaccion_descrita: string;
    snomed_ct_id: string;
}

export interface MedicationItem {
    id?: number;
    medicamento_id?: string;
    nombre_medicamento: string;
    principio_activo: string;
    dosis: string;
    frecuencia: string;
    motivo: string;
    fecha_inicio?: string;
    fecha_fin?: string;
}

export interface PatientHabits {
    id?: string;
    fuma: boolean;
    alcohol: boolean;
    drogas: boolean;
    cafe: boolean;
    otros: string;
    comentarios: string;
    tabaquismo?: string;
    alcoholismo?: string;
    bruxismo?: string;
}

export interface MedicationCatalogItem {
    id: string;
    nombre_generico: string;
    nombre_comercial?: string;
}

interface UseClinicHistoryReturn {
    // Data
    personalHistory: PersonalHistoryItem[];
    isLoadingPersonalHistory: boolean;
    familyHistory: FamilyHistoryItem[];
    isLoadingFamilyHistory: boolean;
    allergies: AllergyItem[];
    isLoadingAllergies: boolean;
    medications: MedicationItem[];
    isLoadingMedications: boolean;
    patientSessions: PatientSession[];
    isLoadingPatientSessions: boolean;
    patientHabits: PatientHabits | null;
    isLoadingPatientHabits: boolean;
    documents: ClinicDocument[];
    isLoadingDocuments: boolean;

    // Catalogs
    ailmentsCatalog: Ailment[];
    medicationsCatalog: MedicationCatalogItem[];
    isLoadingAilmentsCatalog: boolean;
    isLoadingMedicationsCatalog: boolean;

    // Fetch functions
    fetchPersonalHistory: (userId: string) => Promise<void>;
    fetchFamilyHistory: (userId: string) => Promise<void>;
    fetchAllergies: (userId: string) => Promise<void>;
    fetchMedications: (userId: string) => Promise<void>;
    fetchPatientSessions: (userId: string) => Promise<void>;
    fetchPatientHabits: (userId: string) => Promise<void>;
    fetchDocuments: (userId: string) => Promise<void>;
    fetchAilmentsCatalog: () => Promise<void>;
    fetchMedicationsCatalog: (search: string) => Promise<void>;
    refreshAll: (userId: string) => Promise<void>;

    // Mutate functions
    createPersonalHistory: (userId: string, data: { padecimiento_id: string, nombre: string, comentarios: string }) => Promise<void>;
    updatePersonalHistory: (userId: string, data: { id: number, padecimiento_id: string, nombre: string, comentarios: string }) => Promise<void>;
    deletePersonalHistory: (userId: string, itemId: number) => Promise<void>;

    createFamilyHistory: (userId: string, data: { padecimiento_id: string, nombre: string, parentesco: string, comentarios: string }) => Promise<void>;
    updateFamilyHistory: (userId: string, data: { id: number, padecimiento_id: string, nombre: string, parentesco: string, comentarios: string }) => Promise<void>;
    deleteFamilyHistory: (userId: string, itemId: number) => Promise<void>;

    createAllergy: (userId: string, data: { alergeno: string, reaccion_descrita: string }) => Promise<void>;
    updateAllergy: (userId: string, data: { id: number, alergeno: string, reaccion_descrita: string }) => Promise<void>;
    deleteAllergy: (userId: string, itemId: number) => Promise<void>;

    createMedication: (userId: string, data: { medicamento_id?: string, nombre_medicamento: string, dosis: string, frecuencia: string, motivo: string, fecha_inicio?: string, fecha_fin?: string }) => Promise<void>;
    updateMedication: (userId: string, data: { id: number, medicamento_id?: string, nombre_medicamento: string, dosis: string, frecuencia: string, motivo: string, fecha_inicio?: string, fecha_fin?: string }) => Promise<void>;
    deleteMedication: (userId: string, itemId: number) => Promise<void>;

    updatePatientHabits: (userId: string, data: PatientHabits) => Promise<void>;

    // Document functions with thumbnail support
    uploadDocument: (userId: string, file: File) => Promise<void>;
    deleteDocument: (userId: string, docId: string) => Promise<void>;
    getDocumentContent: (userId: string, docId: string) => Promise<Blob>;

    // Session functions with attachments
    createSession: (userId: string, data: any, files?: File[]) => Promise<number | undefined>;
    updateSession: (sessionId: number, userId: string, data: any, files?: File[], deletedAttachmentIds?: string[]) => Promise<void>;
    deleteSession: (sessionId: number, userId: string) => Promise<void>;
    fetchDoctors: () => Promise<void>;
    doctors: { id: string; name: string }[];
    isLoadingDoctors: boolean;
    getSessionAttachment: (sessionId: string, attachmentId: string) => Promise<Blob>;

    // Submitting states
    isSubmittingPersonal: boolean;
    isSubmittingFamily: boolean;
    isSubmittingAllergy: boolean;
    isSubmittingMedication: boolean;
    isSubmittingHabits: boolean;
    isSubmittingSession: boolean;
    isUploadingDocument: boolean;

    loading: boolean;
}

export function useClinicHistory(): UseClinicHistoryReturn {
    // Data states
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

    const [documents, setDocuments] = useState<ClinicDocument[]>([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

    // Catalog states
    const [ailmentsCatalog, setAilmentsCatalog] = useState<Ailment[]>([]);
    const [isLoadingAilmentsCatalog, setIsLoadingAilmentsCatalog] = useState(false);
    const [medicationsCatalog, setMedicationsCatalog] = useState<MedicationCatalogItem[]>([]);
    const [isLoadingMedicationsCatalog, setIsLoadingMedicationsCatalog] = useState(false);

    // Submitting states
    const [isSubmittingPersonal, setIsSubmittingPersonal] = useState(false);
    const [isSubmittingFamily, setIsSubmittingFamily] = useState(false);
    const [isSubmittingAllergy, setIsSubmittingAllergy] = useState(false);
    const [isSubmittingMedication, setIsSubmittingMedication] = useState(false);
    const [isSubmittingHabits, setIsSubmittingHabits] = useState(false);
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);
    const [isSubmittingSession, setIsSubmittingSession] = useState(false);
    const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

    const loading = isLoadingPersonalHistory || isLoadingFamilyHistory || isLoadingAllergies ||
        isLoadingMedications || isLoadingPatientSessions || isLoadingPatientHabits ||
        isLoadingDocuments;

    // Fetch functions
    const fetchPersonalHistory = useCallback(async (userId: string) => {
        if (!userId) return;
        setIsLoadingPersonalHistory(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY, { user_id: userId });
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

    const fetchFamilyHistory = useCallback(async (userId: string) => {
        if (!userId) return;
        setIsLoadingFamilyHistory(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY, { user_id: userId });
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

    const fetchAllergies = useCallback(async (userId: string) => {
        if (!userId) return;
        setIsLoadingAllergies(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.ALLERGIES, { user_id: userId });
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

    const fetchMedications = useCallback(async (userId: string) => {
        if (!userId) return;
        setIsLoadingMedications(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.MEDICATIONS, { user_id: userId });
            const medicationData = Array.isArray(data) ? data : (data.antecedentes_medicamentos || data.data || []);

            const mappedMedications = medicationData.map((item: any): MedicationItem => ({
                id: Number(item.id) || undefined,
                medicamento_id: item.medicamento_id ? String(item.medicamento_id) : undefined,
                nombre_medicamento: item.medicamento_nombre || item.nombre_medicamento || item.nombre || 'N/A',
                principio_activo: item.principio_activo || '',
                dosis: item.dosis || '',
                frecuencia: item.frecuencia || '',
                motivo: item.motivo || '',
                fecha_inicio: item.fecha_inicio || '',
                fecha_fin: item.fecha_fin || '',
            }));
            setMedications(mappedMedications);
        } catch (error) {
            console.error("Failed to fetch medications:", error);
            setMedications([]);
        } finally {
            setIsLoadingMedications(false);
        }
    }, []);

    const fetchPatientSessions = useCallback(async (userId: string) => {
        if (!userId) return;
        setIsLoadingPatientSessions(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: userId });
            const sessionsData = Array.isArray(data) ? data : (data.patient_sessions || data.data || []);

            const mappedSessions = sessionsData.map((session: any): PatientSession => ({
                ...session,
                sesion_id: Number(session.sesion_id),
            }));
            setPatientSessions(mappedSessions);
        } catch (error) {
            console.error("Failed to fetch patient sessions:", error);
            setPatientSessions([]);
        } finally {
            setIsLoadingPatientSessions(false);
        }
    }, []);

    const fetchPatientHabits = useCallback(async (userId: string) => {
        if (!userId) return;
        setIsLoadingPatientHabits(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_HABITS, { user_id: userId });
            let habitsData = data?.data || data?.habitos || data;

            if (Array.isArray(habitsData) && habitsData.length > 0) {
                habitsData = habitsData[0];
            }

            if (habitsData && typeof habitsData === 'object') {
                setPatientHabits({
                    id: habitsData.id,
                    fuma: Boolean(habitsData.fuma),
                    alcohol: habitsData.alcohol === 'true' || habitsData.alcohol === true,
                    drogas: Boolean(habitsData.drogas),
                    cafe: Boolean(habitsData.cafe),
                    otros: habitsData.otros || '',
                    comentarios: habitsData.comentarios || '',
                    tabaquismo: habitsData.tabaquismo || '',
                    alcoholismo: habitsData.alcohol || '',
                    bruxismo: habitsData.bruxismo || '',
                });
            } else {
                setPatientHabits(null);
            }
        } catch (error) {
            console.error("Failed to fetch patient habits:", error);
            setPatientHabits(null);
        } finally {
            setIsLoadingPatientHabits(false);
        }
    }, []);

    const fetchDocuments = useCallback(async (userId: string) => {
        if (!userId) return;
        setIsLoadingDocuments(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENTS, { user_id: userId });
            const docsArray = Array.isArray(data) ? data : (data.documents || data.data || []);
            const docsData = docsArray[0]?.items || docsArray[0] || [];

            const mappedDocs = docsData.map((doc: any): ClinicDocument => ({
                id: doc.id,
                nombre: doc.nombre || doc.name || '',
                tipo: doc.mimeType || doc.tipo || doc.type || '',
                ruta: doc.ruta || doc.path || doc.thumbnailLink || '',
                fecha_subida: doc.fecha_subida || doc.created_at || '',
                tamaño: doc.tamaño || doc.size || 0,
                thumbnail_url: doc.thumbnailLink || doc.thumbnail_url || '',
                mimeType: doc.mimeType || '',
                hasThumbnail: doc.hasThumbnail || false,
            }));
            setDocuments(mappedDocs);
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            setDocuments([]);
        } finally {
            setIsLoadingDocuments(false);
        }
    }, []);

    const fetchAilmentsCatalog = useCallback(async () => {
        setIsLoadingAilmentsCatalog(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.AILMENTS_CATALOG);
            const ailmentsData = Array.isArray(data) ? data : (data.catalogo_padecimientos || data.data || data.result || []);
            setAilmentsCatalog(ailmentsData.map((a: any) => ({ ...a, id: String(a.id), nombre: a.nombre })));
        } catch (error) {
            console.error("Failed to fetch ailments catalog:", error);
            setAilmentsCatalog([]);
        } finally {
            setIsLoadingAilmentsCatalog(false);
        }
    }, []);

    const fetchMedicationsCatalog = useCallback(async (search: string) => {
        setIsLoadingMedicationsCatalog(true);
        try {
            const data = await api.get(API_ROUTES.CLINIC_HISTORY.MEDICATIONS_CATALOG, {
                search: search,
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
                    id: String(m.id),
                    nombre_generico: m.nombre_generico,
                    nombre_comercial: m.nombre_comercial
                }));

            setMedicationsCatalog(filteredMedications);
        } catch (error) {
            console.error("Failed to fetch medications catalog:", error);
            setMedicationsCatalog([]);
        } finally {
            setIsLoadingMedicationsCatalog(false);
        }
    }, []);

    const refreshAll = useCallback(async (userId: string) => {
        await Promise.all([
            fetchPersonalHistory(userId),
            fetchFamilyHistory(userId),
            fetchAllergies(userId),
            fetchMedications(userId),
            fetchPatientSessions(userId),
            fetchPatientHabits(userId),
            fetchDocuments(userId),
        ]);
    }, [fetchPersonalHistory, fetchFamilyHistory, fetchAllergies, fetchMedications, fetchPatientSessions, fetchPatientHabits, fetchDocuments]);

    // Personal History CRUD
    const createPersonalHistory = useCallback(async (userId: string, data: { padecimiento_id: string, nombre: string, comentarios: string }) => {
        setIsSubmittingPersonal(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY_UPSERT, {
                ...data,
                paciente_id: userId,
            });
            await fetchPersonalHistory(userId);
        } catch (error) {
            console.error("Failed to create personal history:", error);
            throw error;
        } finally {
            setIsSubmittingPersonal(false);
        }
    }, [fetchPersonalHistory]);

    const updatePersonalHistory = useCallback(async (userId: string, data: { id: number, padecimiento_id: string, nombre: string, comentarios: string }) => {
        setIsSubmittingPersonal(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY_UPSERT, {
                ...data,
                id: data.id,
                paciente_id: userId,
            });
            await fetchPersonalHistory(userId);
        } catch (error) {
            console.error("Failed to update personal history:", error);
            throw error;
        } finally {
            setIsSubmittingPersonal(false);
        }
    }, [fetchPersonalHistory]);

    const deletePersonalHistory = useCallback(async (userId: string, itemId: number) => {
        setIsSubmittingPersonal(true);
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY_DELETE, {
                id: itemId,
                paciente_id: userId,
            });
            await fetchPersonalHistory(userId);
        } catch (error) {
            console.error("Failed to delete personal history:", error);
            throw error;
        } finally {
            setIsSubmittingPersonal(false);
        }
    }, [fetchPersonalHistory]);

    // Family History CRUD
    const createFamilyHistory = useCallback(async (userId: string, data: { padecimiento_id: string, nombre: string, parentesco: string, comentarios: string }) => {
        setIsSubmittingFamily(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY_UPSERT, {
                ...data,
                paciente_id: userId,
            });
            await fetchFamilyHistory(userId);
        } catch (error) {
            console.error("Failed to create family history:", error);
            throw error;
        } finally {
            setIsSubmittingFamily(false);
        }
    }, [fetchFamilyHistory]);

    const updateFamilyHistory = useCallback(async (userId: string, data: { id: number, padecimiento_id: string, nombre: string, parentesco: string, comentarios: string }) => {
        setIsSubmittingFamily(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY_UPSERT, {
                ...data,
                id: data.id,
                paciente_id: userId,
            });
            await fetchFamilyHistory(userId);
        } catch (error) {
            console.error("Failed to update family history:", error);
            throw error;
        } finally {
            setIsSubmittingFamily(false);
        }
    }, [fetchFamilyHistory]);

    const deleteFamilyHistory = useCallback(async (userId: string, itemId: number) => {
        setIsSubmittingFamily(true);
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.FAMILY_HISTORY_DELETE, {
                id: itemId,
                paciente_id: userId,
            });
            await fetchFamilyHistory(userId);
        } catch (error) {
            console.error("Failed to delete family history:", error);
            throw error;
        } finally {
            setIsSubmittingFamily(false);
        }
    }, [fetchFamilyHistory]);

    // Allergy CRUD
    const createAllergy = useCallback(async (userId: string, data: { alergeno: string, reaccion_descrita: string }) => {
        setIsSubmittingAllergy(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.ALLERGIES_UPSERT, {
                ...data,
                paciente_id: userId,
            });
            await fetchAllergies(userId);
        } catch (error) {
            console.error("Failed to create allergy:", error);
            throw error;
        } finally {
            setIsSubmittingAllergy(false);
        }
    }, [fetchAllergies]);

    const updateAllergy = useCallback(async (userId: string, data: { id: number, alergeno: string, reaccion_descrita: string }) => {
        setIsSubmittingAllergy(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.ALLERGIES_UPSERT, {
                ...data,
                id: data.id,
                paciente_id: userId,
            });
            await fetchAllergies(userId);
        } catch (error) {
            console.error("Failed to update allergy:", error);
            throw error;
        } finally {
            setIsSubmittingAllergy(false);
        }
    }, [fetchAllergies]);

    const deleteAllergy = useCallback(async (userId: string, itemId: number) => {
        setIsSubmittingAllergy(true);
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.ALLERGIES_DELETE, {
                id: itemId,
                paciente_id: userId,
            });
            await fetchAllergies(userId);
        } catch (error) {
            console.error("Failed to delete allergy:", error);
            throw error;
        } finally {
            setIsSubmittingAllergy(false);
        }
    }, [fetchAllergies]);

    // Medication CRUD
    const createMedication = useCallback(async (userId: string, data: { medicamento_id?: string, nombre_medicamento: string, dosis: string, frecuencia: string, motivo: string, fecha_inicio?: string, fecha_fin?: string }) => {
        setIsSubmittingMedication(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.MEDICATIONS_UPSERT, {
                ...data,
                paciente_id: userId,
                medicamento_id: data.medicamento_id,
            });
            await fetchMedications(userId);
        } catch (error) {
            console.error("Failed to create medication:", error);
            throw error;
        } finally {
            setIsSubmittingMedication(false);
        }
    }, [fetchMedications]);

    const updateMedication = useCallback(async (userId: string, data: { id: number, medicamento_id?: string, nombre_medicamento: string, dosis: string, frecuencia: string, motivo: string, fecha_inicio?: string, fecha_fin?: string }) => {
        setIsSubmittingMedication(true);
        try {
            await api.post(API_ROUTES.CLINIC_HISTORY.MEDICATIONS_UPSERT, {
                ...data,
                id: data.id,
                paciente_id: userId,
                medicamento_id: data.medicamento_id,
            });
            await fetchMedications(userId);
        } catch (error) {
            console.error("Failed to update medication:", error);
            throw error;
        } finally {
            setIsSubmittingMedication(false);
        }
    }, [fetchMedications]);

    const deleteMedication = useCallback(async (userId: string, itemId: number) => {
        setIsSubmittingMedication(true);
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.MEDICATIONS_DELETE, {
                id: itemId,
                paciente_id: userId,
            });
            await fetchMedications(userId);
        } catch (error) {
            console.error("Failed to delete medication:", error);
            throw error;
        } finally {
            setIsSubmittingMedication(false);
        }
    }, [fetchMedications]);

    // Patient Habits CRUD
    const updatePatientHabits = useCallback(async (userId: string, data: PatientHabits) => {
        setIsSubmittingHabits(true);
        try {
            const { alcoholismo, ...rest } = data;
            const payload: Record<string, unknown> = {
                ...rest,
                id: data.id,
                alcohol: alcoholismo,
            };

            if (data.id) {
                payload.paciente_id = userId;
            } else {
                payload.user_id = userId;
            }

            await api.post(API_ROUTES.CLINIC_HISTORY.PATIENT_HABITS_UPSERT, payload);
            await fetchPatientHabits(userId);
        } catch (error) {
            console.error("Failed to update patient habits:", error);
            throw error;
        } finally {
            setIsSubmittingHabits(false);
        }
    }, [fetchPatientHabits]);

    // Document functions with thumbnail support
    const uploadDocument = useCallback(async (userId: string, file: File) => {
        setIsUploadingDocument(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('user_id', userId);
            await api.post(API_ROUTES.CLINIC_HISTORY.USERS_IMPORT, formData);
            await fetchDocuments(userId);
        } catch (error) {
            console.error("Failed to upload document:", error);
            throw error;
        } finally {
            setIsUploadingDocument(false);
        }
    }, [fetchDocuments]);

    const deleteDocument = useCallback(async (userId: string, docId: string) => {
        setIsUploadingDocument(true);
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT, undefined, undefined, { id: docId, user_id: userId });
            await fetchDocuments(userId);
        } catch (error) {
            console.error("Failed to delete document:", error);
            throw error;
        } finally {
            setIsUploadingDocument(false);
        }
    }, [fetchDocuments]);

    const getDocumentContent = useCallback(async (userId: string, docId: string): Promise<Blob> => {
        const blob = await api.getBlob(API_ROUTES.CLINIC_HISTORY.USERS_DOCUMENT, { user_id: userId, id: docId });
        return blob;
    }, []);

    // Session functions
    const fetchDoctors = useCallback(async () => {
        setIsLoadingDoctors(true);
        try {
            const data = await api.get(API_ROUTES.USERS_DOCTORS);
            setDoctors(data.map((doc: any) => ({ id: String(doc.id), name: doc.name })));
        } catch (error) {
            console.error("Failed to fetch doctors:", error);
            setDoctors([]);
        } finally {
            setIsLoadingDoctors(false);
        }
    }, []);

    const getSessionAttachment = useCallback(async (sessionId: string, attachmentId: string): Promise<Blob> => {
        const blob = await api.getBlob(API_ROUTES.CLINIC_HISTORY.SESSIONS_ATTACHMENT, { session_id: sessionId, id: attachmentId });
        return blob;
    }, []);

    const buildSessionFormData = (sessionData: any, scalarOverrides: Record<string, string>, files?: File[]) => {
        const formData = new FormData();

        // Scalar fields
        const skipKeys = new Set(['tratamientos', 'archivos_adjuntos', 'deletedAttachmentIds']);
        Object.entries(sessionData).forEach(([k, v]) => {
            if (!skipKeys.has(k) && v !== undefined && v !== null) {
                formData.append(k, String(v));
            }
        });

        Object.entries(scalarOverrides).forEach(([k, v]) => formData.append(k, v));

        if (sessionData.tratamientos && sessionData.tratamientos.length > 0) {
            formData.append('tratamientos', JSON.stringify(sessionData.tratamientos));
        }

        if (files && files.length > 0) {
            files.forEach(file => formData.append('newly_added_files', file));
        }

        return formData;
    };

    const createSession = useCallback(async (userId: string, data: any, files?: File[]): Promise<number | undefined> => {
        setIsSubmittingSession(true);
        try {
            const { archivos_adjuntos, deletedAttachmentIds, ...sessionData } = data;
            const formData = buildSessionFormData(sessionData, { paciente_id: userId }, files);
            const response = await api.post(API_ROUTES.CLINIC_HISTORY.SESSIONS_UPSERT, formData);
            await fetchPatientSessions(userId);
            // Return the new sesion_id so callers can link it to treatment steps
            return response?.sesion_id ?? response?.data?.sesion_id ?? response?.id ?? undefined;
        } catch (error) {
            console.error("Failed to create session:", error);
            throw error;
        } finally {
            setIsSubmittingSession(false);
        }
    }, [fetchPatientSessions]);

    const updateSession = useCallback(async (sessionId: number, userId: string, data: any, files?: File[], deletedAttachmentIds?: string[], existingAttachments?: any[]) => {
        setIsSubmittingSession(true);
        try {
            const { archivos_adjuntos, deletedAttachmentIds: _deleted, sesion_id: _sesion_id, ...sessionData } = data;
            const formData = buildSessionFormData(sessionData, { sesion_id: String(sessionId), paciente_id: userId }, files);
            formData.append('deleted_attachment_ids', JSON.stringify(deletedAttachmentIds || []));
            if (existingAttachments && existingAttachments.length > 0) {
                formData.append('existing_attachment_ids', JSON.stringify(existingAttachments.map((att: any) => String(att.id))));
            }
            await api.post(API_ROUTES.CLINIC_HISTORY.SESSIONS_UPSERT, formData);
            await fetchPatientSessions(userId);
        } catch (error) {
            console.error("Failed to update session:", error);
            throw error;
        } finally {
            setIsSubmittingSession(false);
        }
    }, [fetchPatientSessions]);

    const deleteSession = useCallback(async (sessionId: number, userId: string) => {
        setIsSubmittingSession(true);
        try {
            await api.delete(API_ROUTES.CLINIC_HISTORY.SESSIONS_DELETE, { id: sessionId });
            await fetchPatientSessions(userId);
        } catch (error) {
            console.error("Failed to delete session:", error);
            throw error;
        } finally {
            setIsSubmittingSession(false);
        }
    }, [fetchPatientSessions]);

    return {
        // Data
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

        // Catalogs
        ailmentsCatalog,
        medicationsCatalog,
        isLoadingAilmentsCatalog,
        isLoadingMedicationsCatalog,

        // Fetch functions
        fetchPersonalHistory,
        fetchFamilyHistory,
        fetchAllergies,
        fetchMedications,
        fetchPatientSessions,
        fetchPatientHabits,
        fetchDocuments,
        fetchAilmentsCatalog,
        fetchMedicationsCatalog,
        refreshAll,

        // Mutate functions
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
        uploadDocument,
        deleteDocument,
        getDocumentContent,
        createSession,
        updateSession,
        deleteSession,
        fetchDoctors,
        doctors,
        isLoadingDoctors,
        getSessionAttachment,

        // Submitting states
        isSubmittingPersonal,
        isSubmittingFamily,
        isSubmittingAllergy,
        isSubmittingMedication,
        isSubmittingHabits,
        isSubmittingSession,
        isUploadingDocument,

        loading,
    };
}
