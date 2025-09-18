
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Calendar, AlertTriangle, FileText, Camera, Stethoscope, Heart, Pill, Search, 
  Clock, User, ChevronRight, Eye, Download, Filter, Mic, MicOff, Play, Pause, 
  ZoomIn, ZoomOut, RotateCcw, MessageSquare, Send, FileDown, Layers, TrendingUp, 
  BarChart3, X, Plus, Edit3, Save, Shield, Award, Zap, Paperclip, SearchCheck, RefreshCw,
  Wind, GlassWater, Smile, Maximize, Minimize, ChevronDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import type { User as UserType, PatientSession, TreatmentDetail, AttachedFile } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useLocale } from 'next-intl';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"


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
    nombre: string;
    categoria: string;
    nivel_alerta: number;
    comentarios: string;
};

type FamilyHistoryItem = {
    condition: string;
    relative: string;
    comments: string;
};

type AllergyItem = {
    allergen: string;
    reaction: string;
    snomed: string;
};

type MedicationItem = {
    name: string;
    dose: string;
    frequency: string;
    since: string | null;
    endDate: string | null;
    reason: string;
    code: string;
};

type PatientHabits = {
  tabaquismo: string | null;
  alcohol: string | null;
  bruxismo: string | null;
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
  const [selectedImage, setSelectedImage] = useState(null);
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
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Network response was not ok for personal history');
            }
            const data = await response.json();
            const historyData = Array.isArray(data) ? data : (data.antecedentes_personales || data.data || []);
            
            const mappedHistory = historyData.map((item: any): PersonalHistoryItem => ({
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
                condition: item.nombre || 'N/A',
                relative: item.parentesco || 'N/A',
                comments: item.comentarios || '',
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
                allergen: item.alergeno || 'N/A',
                reaction: item.reaccion_descrita || '',
                snomed: item.snomed_ct_id || '',
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
                name: item.nombre_medicamento || 'N/A',
                dose: item.dosis || 'N/A',
                frequency: item.frecuencia || 'N/A',
                since: item.fecha_inicio || null,
                endDate: item.fecha_fin || null,
                reason: item.motivo || '',
                code: item.snomed_ct_id || '',
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


  // Galería de imágenes
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
      (<div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
        <div className="relative max-w-7xl max-h-full w-full h-full flex flex-col">
          <div className="bg-white p-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-800">{image.name}</h3>
              <p className="text-gray-600">{image.date} • {image.description}</p>
              <div className="text-xs text-gray-500 mt-1">
                DICOM: {image.modality} | {image.viewPosition} | {image.bodyPart}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-900">
            <img
              src={image.url}
              alt={image.name}
              className="max-w-none transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
              draggable={false}
            />
          </div>
        </div>
      </div>)
    );

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">Galería de Imágenes</h3>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600">DICOM Compliant</span>
              <Filter className="w-5 h-5 text-gray-500 ml-4" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                className="bg-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer border"
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
                  <h4 className="font-semibold text-gray-800 text-sm">{image.name}</h4>
                  <p className="text-gray-600 text-xs">{image.date}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      image.type === 'radiografia' 
                        ? 'bg-gray-200 text-gray-800' 
                        : 'bg-blue-200 text-blue-800'
                    }`}>
                      {image.modality}
                    </span>
                    <span className="text-xs text-gray-500">{image.tooth}</span>
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
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
          <h3 className="text-lg font-bold text-red-800">Alertas Médicas Críticas</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-gray-600">SNOMED-CT</span>
        </div>
      </div>
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div key={index} className={`p-3 rounded-lg ${
            alert.severity === 'high' ? 'bg-red-100 border border-red-300' : 'bg-yellow-100 border border-yellow-300'
          }`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold ${alert.severity === 'high' ? 'text-red-800' : 'text-yellow-800'}`}>
                🔴 {alert.text}
              </span>
              <span className="text-xs text-gray-500">{alert.code}</span>
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
            <strong className="text-gray-600">{title}:</strong>
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

  const TreatmentTimeline = ({ sessions }: { sessions: PatientSession[] }) => {
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
            <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Historial de Tratamientos</h3>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="flex flex-col items-center">
                               <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse"></div>
                               <div className="w-0.5 h-20 bg-gray-200 animate-pulse mt-2"></div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Historial de Tratamientos</h3>
                <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-600">HL7 FHIR</span>
                </div>
            </div>
            <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-blue-600"></div>
                {sessions.map((session, index) => {
                    const odontogramSummary = session.tipo_sesion === 'odontograma' ? generateOdontogramSummary(session.estado_odontograma) : null;
                    return (
                        <div key={`${session.sesion_id}-${index}`} className="relative flex items-start mb-8 last:mb-0 pl-8">
                            <div className={`absolute left-0 top-0 z-10 w-6 h-6 rounded-full border-4 border-white shadow-lg bg-blue-500`}></div>
                            <div className="flex-1">
                                <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-gray-800">{session.procedimiento_realizado}</h4>
                                        <span className="text-sm text-gray-500">{session.fecha_sesion ? format(parseISO(session.fecha_sesion), 'dd/MM/yyyy') : ''}</span>
                                    </div>
                                    <div className="space-y-3 text-sm text-gray-700">
                                        {session.tipo_sesion && <p><strong className="text-gray-600">Tipo de Sesión:</strong> <span className="capitalize bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">{session.tipo_sesion}</span></p>}
                                        {session.diagnostico && <p><strong className="text-gray-600">Diagnóstico:</strong> {session.diagnostico}</p>}
                                        {session.notas_clinicas && <p><strong className="text-gray-600">Notas:</strong> {session.notas_clinicas}</p>}
                                        
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
                                                            className="text-blue-600 hover:underline flex items-center gap-1"
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

  const AnamnesisDashboard = () => {
    const getAlertBorderColor = (level: number) => {
        switch (level) {
            case 1: return 'border-blue-300';
            case 2: return 'border-yellow-400';
            case 3: return 'border-red-500';
            default: return 'border-gray-200';
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

    const ToothIcon = (props: React.SVGProps<SVGSVGElement>) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        {...props}
      >
        <path d="M12.75,2.008c-3.134,0-5.75,2.566-5.75,5.75c0,1.517,0.613,2.93,1.5,4l-1.5,6.242H18l-1.5-6.242c0.887-1.07,1.5-2.483,1.5-4C18.5,4.574,15.884,2.008,12.75,2.008z M12.75,4.008c2.071,0,3.75,1.679,3.75,3.75S14.821,11.508,12.75,11.508c-2.071,0-3.75-1.679-3.75-3.75S10.679,4.008,12.75,4.008z" />
      </svg>
    );

    const HabitCard = ({ habits, isLoading }: { habits: PatientHabits | null, isLoading: boolean }) => (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-4">
          <User className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-bold text-gray-800">Hábitos del Paciente</h3>
        </div>
        {isLoading ? (
          <p>Loading patient habits...</p>
        ) : habits ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Wind className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <h4 className="font-semibold">Tabaquismo</h4>
                <p className="text-sm text-gray-700">{habits.tabaquismo || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <GlassWater className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <h4 className="font-semibold">Alcohol</h4>
                <p className="text-sm text-gray-700">{habits.alcohol || 'No especificado'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <ToothIcon className="w-5 h-5 text-gray-500 mt-1" />
              <div>
                <h4 className="font-semibold">Bruxismo</h4>
                <p className="text-sm text-gray-700">{habits.bruxismo || 'No especificado'}</p>
              </div>
            </div>
          </div>
        ) : (
          <p>No patient habits found.</p>
        )}
      </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center mb-4">
                        <User className="w-5 h-5 text-blue-600 mr-2" />
                        <h3 className="text-lg font-bold text-gray-800">Antecedentes Personales</h3>
                    </div>
                    <div className="space-y-3">
                        {isLoadingPersonalHistory ? (
                            <p>Loading personal history...</p>
                        ) : personalHistory.length > 0 ? (
                            personalHistory.map((item, index) => (
                                <div key={index} className={`border-l-4 ${getAlertBorderColor(item.nivel_alerta)} pl-4 py-2`}>
                                    <div className="flex justify-between items-center">
                                        <div className="font-semibold text-gray-800">{item.nombre}</div>
                                        <div className="text-xs text-gray-500">{item.categoria}</div>
                                    </div>
                                    <div className="text-sm text-gray-700">{item.comentarios}</div>
                                </div>
                            ))
                        ) : (
                            <p>No personal history found.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center mb-4">
                        <Heart className="w-5 h-5 text-red-600 mr-2" />
                        <h3 className="text-lg font-bold text-gray-800">Antecedentes Familiares</h3>
                    </div>
                    <div className="space-y-3">
                        {isLoadingFamilyHistory ? (
                            <p>Loading family history...</p>
                        ) : familyHistory.length > 0 ? (
                            familyHistory.map((item, index) => (
                                <div key={index} className="border-l-4 border-red-200 pl-4 py-2">
                                    <div className="font-semibold text-gray-800">{item.condition}</div>
                                    <div className="text-sm text-gray-600">Familiar: {item.relative}</div>
                                    <div className="text-sm text-gray-700">{item.comments}</div>
                                </div>
                            ))
                        ) : (
                           <p>No family history found.</p>
                        )}
                    </div>
                </div>
                 <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center mb-4">
                        <Pill className="w-5 h-5 text-green-600 mr-2" />
                        <h3 className="text-lg font-bold text-gray-800">Medicamentos Actuales</h3>
                    </div>
                    <div className="space-y-3">
                        {isLoadingMedications ? (
                            <p>Loading medications...</p>
                        ) : medications.length > 0 ? (
                            medications.map((item, index) => (
                                <div key={index} className="border-l-4 border-green-200 pl-4 py-2">
                                    <div className="flex justify-between items-start">
                                        <div className="font-semibold text-gray-800">{item.name}</div>
                                        <div className="text-right text-xs text-gray-500">
                                            <div>{item.dose}</div>
                                            <div>{item.frequency}</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {formatDate(item.since)} - {item.endDate ? formatDate(item.endDate) : 'Presente'}
                                    </div>
                                    <div className="text-sm text-gray-700 mt-1">{item.reason}</div>
                                </div>
                            ))
                        ) : (
                           <p>No medications found.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center mb-4">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                        <h3 className="text-lg font-bold text-gray-800">Alergias</h3>
                    </div>
                    <div className="space-y-3">
                        {isLoadingAllergies ? (
                            <p>Loading allergies...</p>
                        ) : allergies.length > 0 ? (
                            allergies.map((item, index) => (
                                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="flex justify-between items-center">
                                        <div className="font-semibold text-red-800">{item.allergen}</div>
                                        {item.snomed && <span className="text-xs font-mono text-gray-500">{item.snomed}</span>}
                                    </div>
                                    {item.reaction && <div className="text-sm text-red-700">{item.reaction}</div>}
                                </div>
                            ))
                        ) : (
                            <p>No allergies found.</p>
                        )}
                    </div>
                </div>
                <HabitCard habits={patientHabits} isLoading={isLoadingPatientHabits} />
            </div>
        </div>
    );
    };

  const Navigation = () => (
    <div className="bg-white shadow-sm border-b border-gray-200 mb-8">
      <div className="flex space-x-8 px-6 overflow-x-auto">
        {[
          { id: 'anamnesis', label: 'Anamnesis', icon: FileText },
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'odontogram', label: 'Odontograma', icon: Smile },
          { id: 'images', label: 'Imágenes', icon: Camera },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors duration-200 whitespace-nowrap ${
              activeView === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-screen", !isFullscreen && "bg-background")}>
      {/* Header */}
      {!isFullscreen && (
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Historial Clinico Digital</h1>
                {selectedPatient && (
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-gray-900">{selectedPatient.name}</p>
                        <Button variant="ghost" size="icon" onClick={refreshAllData}>
                            <RefreshCw className="h-5 w-5" />
                        </Button>
                    </div>
                )}
            </div>
             <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                <PopoverTrigger asChild>
                    <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
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
          </div>
          <div className="flex items-center space-x-4">
            {selectedPatient && (
                <div className="text-right">
                <div className="text-sm text-gray-500">Última visita</div>
                <div className="font-semibold text-gray-800">{selectedPatient.lastVisit}</div>
                </div>
            )}
          </div>
        </div>
      </div>
      )}
    
      {selectedPatient ? (
        <>
            {!isFullscreen && <Navigation />}
            
            <div className={cn(!isFullscreen && "px-6 pb-8")}>
                <div className={cn(!isFullscreen && "space-y-6")}>

                    {activeView === 'anamnesis' && <AnamnesisDashboard />}
                    {activeView === 'timeline' && <TreatmentTimeline sessions={patientSessions} />}
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
                            <iframe src={`http://localhost:5173/?lang=${locale}&user_id=${userId}`} className="w-full h-full border-0" title="Odontograma"></iframe>
                        </div>
                    )}
                    {activeView === 'images' && <ImageGallery />}
                </div>
            </div>
        </>
      ) : (
        !isFullscreen && (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
            <SearchCheck className="w-24 h-24 text-gray-300 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700">Seleccione un paciente</h2>
            <p className="text-gray-500 mt-2">Utilice la barra de búsqueda de arriba para encontrar y cargar el historial clínico de un paciente.</p>
          </div>
        )
      )}
    </div>
  );
};

export default function DentalClinicalSystemPage() {
    const params = useParams();
    const userId = params.user_id as string;
    return <DentalClinicalSystem userId={userId} />;
}
    

    

    

    

    

    

    