'use client';

import React, { useState, useRef } from 'react';
import { 
  Calendar, AlertTriangle, FileText, Camera, Stethoscope, Heart, Pill, Search, 
  Clock, User, ChevronRight, Eye, Download, Filter, Mic, MicOff, Play, Pause, 
  ZoomIn, ZoomOut, RotateCcw, MessageSquare, Send, FileDown, Layers, TrendingUp, 
  BarChart3, X, Plus, Edit3, Save, Shield, Award, Zap
} from 'lucide-react';

const DentalClinicalSystem = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [selectedDate, setSelectedDate] = useState('2024-11-15');
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDate, setCompareDate] = useState('2024-01-15');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [dentitionType, setDentitionType] = useState('permanent');

  // Nomenclatura FDI ISO 3950 completa
  const FDI_NOTATION = {
    permanent: {
      upperRight: [18,17,16,15,14,13,12,11],
      upperLeft: [21,22,23,24,25,26,27,28],
      lowerLeft: [31,32,33,34,35,36,37,38],
      lowerRight: [41,42,43,44,45,46,47,48]
    },
    deciduous: {
      upperRight: [55,54,53,52,51],
      upperLeft: [61,62,63,64,65],
      lowerLeft: [71,72,73,74,75],
      lowerRight: [81,82,83,84,85]
    }
  };

  // Estados ISO 1942 estándar internacional
  const ISO_1942_SYMBOLS = {
    SOUND: { 
      code: 'S', 
      color: '#E8F5E8', 
      borderColor: '#4CAF50',
      name: 'Sano',
      description: 'Diente sano sin patología'
    },
    CARIES: { 
      code: 'C', 
      color: '#FFEBEE', 
      borderColor: '#F44336',
      name: 'Caries',
      description: 'Lesión cariosa activa'
    },
    FILLED: { 
      code: 'F', 
      color: '#E3F2FD', 
      borderColor: '#2196F3',
      name: 'Obturado',
      description: 'Restauración presente'
    },
    MISSING: { 
      code: 'M', 
      color: '#F5F5F5', 
      borderColor: '#9E9E9E',
      name: 'Ausente',
      description: 'Diente ausente'
    },
    CROWN: { 
      code: 'CR', 
      color: '#FFF8E1', 
      borderColor: '#FFC107',
      name: 'Corona',
      description: 'Corona protésica'
    },
    BRIDGE: { 
      code: 'BR', 
      color: '#F3E5F5', 
      borderColor: '#9C27B0',
      name: 'Puente',
      description: 'Elemento de puente'
    },
    IMPLANT: { 
      code: 'I', 
      color: '#E8EAF6', 
      borderColor: '#673AB7',
      name: 'Implante',
      description: 'Implante osteointegrado'
    },
    ROOT_FILLED: { 
      code: 'RF', 
      color: '#FCE4EC', 
      borderColor: '#E91E63',
      name: 'Endodoncia',
      description: 'Tratamiento endodóntico'
    },
    IMPACTED: { 
      code: 'IMP', 
      color: '#EFEBE9', 
      borderColor: '#795548',
      name: 'Impactado',
      description: 'Diente impactado'
    },
    EXTRACTED: { 
      code: 'EXT', 
      color: '#FAFAFA', 
      borderColor: '#616161',
      name: 'Extraído',
      description: 'Indicado para extracción'
    }
  };

  // Tipos de dientes para formas SVG realistas
  const TOOTH_TYPES = {
    11: 'incisor_central', 21: 'incisor_central', 31: 'incisor_central', 41: 'incisor_central',
    51: 'incisor_central', 61: 'incisor_central', 71: 'incisor_central', 81: 'incisor_central',
    12: 'incisor_lateral', 22: 'incisor_lateral', 32: 'incisor_lateral', 42: 'incisor_lateral',
    52: 'incisor_lateral', 62: 'incisor_lateral', 72: 'incisor_lateral', 82: 'incisor_lateral',
    13: 'canine', 23: 'canine', 33: 'canine', 43: 'canine',
    53: 'canine', 63: 'canine', 73: 'canine', 83: 'canine',
    14: 'premolar1', 24: 'premolar1', 34: 'premolar1', 44: 'premolar1',
    15: 'premolar2', 25: 'premolar2', 35: 'premolar2', 45: 'premolar2',
    54: 'premolar1', 64: 'premolar1', 74: 'premolar1', 84: 'premolar1',
    55: 'premolar2', 65: 'premolar2', 75: 'premolar2', 85: 'premolar2',
    16: 'molar1', 26: 'molar1', 36: 'molar1', 46: 'molar1',
    17: 'molar2', 27: 'molar2', 37: 'molar2', 47: 'molar2',
    18: 'molar3', 28: 'molar3', 38: 'molar3', 48: 'molar3'
  };

  // Datos del paciente
  const patient = {
    id: 1,
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
        { condition: "Hipertensión Arterial", since: "2019", status: "Controlada", comments: "Medicación diaria", icd10: "I10", snomed: "38341003" },
        { condition: "Diabetes Tipo 2", since: "2021", status: "En control", comments: "Dieta y ejercicio", icd10: "E11", snomed: "44054006" }
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

  // Datos del odontograma
  const odontogramData = {
    '2024-11-15': {
      11: { conditions: ['SOUND'], surfaces: {}, notes: "Diente sano", lastModified: "2024-11-15T10:30:00Z" },
      12: { conditions: ['SOUND'], surfaces: {} },
      13: { conditions: ['SOUND'], surfaces: {} },
      14: { conditions: ['FILLED'], surfaces: { 'O': 'resina' }, notes: "Restauración de resina compuesta oclusal" },
      15: { conditions: ['SOUND'], surfaces: {} },
      16: { conditions: ['CROWN'], surfaces: {}, notes: "Corona de porcelana sobre metal" },
      17: { conditions: ['SOUND'], surfaces: {} },
      18: { conditions: ['MISSING'], surfaces: {}, notes: "Extraído por caries extensa" },
      21: { conditions: ['SOUND'], surfaces: {} },
      22: { conditions: ['SOUND'], surfaces: {} },
      23: { conditions: ['SOUND'], surfaces: {} },
      24: { conditions: ['ROOT_FILLED'], surfaces: {}, notes: "Endodoncia completada, pendiente corona" },
      25: { conditions: ['SOUND'], surfaces: {} },
      26: { conditions: ['FILLED'], surfaces: { 'O': 'amalgama' }, notes: "Restauración de amalgama antigua" },
      27: { conditions: ['SOUND'], surfaces: {} },
      28: { conditions: ['MISSING'], surfaces: {}, notes: "Nunca erupcionó" },
      31: { conditions: ['SOUND'], surfaces: {} },
      32: { conditions: ['SOUND'], surfaces: {} },
      33: { conditions: ['SOUND'], surfaces: {} },
      34: { conditions: ['SOUND'], surfaces: {} },
      35: { conditions: ['SOUND'], surfaces: {} },
      36: { conditions: ['FILLED'], surfaces: { 'O': 'resina' }, notes: "Restauración reciente" },
      37: { conditions: ['SOUND'], surfaces: {} },
      38: { conditions: ['MISSING'], surfaces: {}, notes: "Extraído por impactación" },
      41: { conditions: ['SOUND'], surfaces: {} },
      42: { conditions: ['SOUND'], surfaces: {} },
      43: { conditions: ['SOUND'], surfaces: {} },
      44: { conditions: ['SOUND'], surfaces: {} },
      45: { conditions: ['SOUND'], surfaces: {} },
      46: { conditions: ['CROWN'], surfaces: {}, notes: "Corona de porcelana" },
      47: { conditions: ['SOUND'], surfaces: {} },
      48: { conditions: ['IMPACTED'], surfaces: {}, notes: "Muela del juicio impactada, asintomática" }
    },
    '2024-01-15': {
      11: { conditions: ['SOUND'], surfaces: {} },
      12: { conditions: ['SOUND'], surfaces: {} },
      13: { conditions: ['SOUND'], surfaces: {} },
      14: { conditions: ['CARIES'], surfaces: { 'O': 'caries' }, notes: "Caries oclusal detectada" },
      15: { conditions: ['SOUND'], surfaces: {} },
      16: { conditions: ['FILLED'], surfaces: { 'O': 'amalgama' }, notes: "Restauración de amalgama antigua" },
      17: { conditions: ['SOUND'], surfaces: {} },
      18: { conditions: ['MISSING'], surfaces: {} },
      21: { conditions: ['SOUND'], surfaces: {} },
      22: { conditions: ['SOUND'], surfaces: {} },
      23: { conditions: ['SOUND'], surfaces: {} },
      24: { conditions: ['CARIES'], surfaces: { 'O': 'caries', 'M': 'caries' }, notes: "Caries extensa MO" },
      25: { conditions: ['SOUND'], surfaces: {} },
      26: { conditions: ['CARIES'], surfaces: { 'O': 'caries' }, notes: "Caries oclusal" },
      27: { conditions: ['SOUND'], surfaces: {} },
      28: { conditions: ['MISSING'], surfaces: {} },
      31: { conditions: ['SOUND'], surfaces: {} },
      32: { conditions: ['SOUND'], surfaces: {} },
      33: { conditions: ['SOUND'], surfaces: {} },
      34: { conditions: ['SOUND'], surfaces: {} },
      35: { conditions: ['SOUND'], surfaces: {} },
      36: { conditions: ['SOUND'], surfaces: {} },
      37: { conditions: ['SOUND'], surfaces: {} },
      38: { conditions: ['MISSING'], surfaces: {} },
      41: { conditions: ['SOUND'], surfaces: {} },
      42: { conditions: ['SOUND'], surfaces: {} },
      43: { conditions: ['SOUND'], surfaces: {} },
      44: { conditions: ['SOUND'], surfaces: {} },
      45: { conditions: ['SOUND'], surfaces: {} },
      46: { conditions: ['FILLED'], surfaces: { 'O': 'amalgama' }, notes: "Restauración antigua" },
      47: { conditions: ['SOUND'], surfaces: {} },
      48: { conditions: ['IMPACTED'], surfaces: {} }
    }
  };

  // Datos del periodontograma
  const periodontogramData = {
    '2024-11-15': {
      16: {
        probing: { MB: 2, B: 3, DB: 2, ML: 2, L: 3, DL: 2 },
        bleeding: { MB: false, B: true, DB: false, ML: false, L: true, DL: false },
        suppuration: { MB: false, B: false, DB: false, ML: false, L: false, DL: false },
        mobility: 0,
        furcation: 0,
        recession: { MB: 0, B: 0, DB: 0, ML: 0, L: 0, DL: 0 },
        CAL: { MB: 2, B: 3, DB: 2, ML: 2, L: 3, DL: 2 },
        BOP: 33.3,
        PSR: 1,
        stage: 'I',
        grade: 'A'
      },
      26: {
        probing: { MB: 4, B: 5, DB: 3, ML: 3, L: 4, DL: 3 },
        bleeding: { MB: true, B: true, DB: false, ML: false, L: true, DL: false },
        suppuration: { MB: false, B: false, DB: false, ML: false, L: false, DL: false },
        mobility: 1,
        furcation: 1,
        recession: { MB: 1, B: 1, DB: 0, ML: 0, L: 1, DL: 0 },
        CAL: { MB: 5, B: 6, DB: 3, ML: 3, L: 5, DL: 3 },
        BOP: 50.0,
        PSR: 3,
        stage: 'II',
        grade: 'B'
      },
      36: {
        probing: { MB: 3, B: 4, DB: 3, ML: 2, L: 3, DL: 2 },
        bleeding: { MB: false, B: true, DB: false, ML: false, L: false, DL: false },
        suppuration: { MB: false, B: false, DB: false, ML: false, L: false, DL: false },
        mobility: 0,
        furcation: 0,
        recession: { MB: 0, B: 0, DB: 0, ML: 0, L: 0, DL: 0 },
        CAL: { MB: 3, B: 4, DB: 3, ML: 2, L: 3, DL: 2 },
        BOP: 16.7,
        PSR: 2,
        stage: 'I',
        grade: 'A'
      },
      46: {
        probing: { MB: 5, B: 6, DB: 4, ML: 4, L: 5, DL: 3 },
        bleeding: { MB: true, B: true, DB: true, ML: false, L: true, DL: false },
        suppuration: { MB: false, B: true, DB: false, ML: false, L: false, DL: false },
        mobility: 2,
        furcation: 2,
        recession: { MB: 2, B: 2, DB: 1, ML: 1, L: 2, DL: 1 },
        CAL: { MB: 7, B: 8, DB: 5, ML: 5, L: 7, DL: 4 },
        BOP: 66.7,
        PSR: 4,
        stage: 'III',
        grade: 'C'
      }
    }
  };

  // Galería de imágenes
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

  // Timeline de tratamientos
  const treatmentTimeline = [
    {
      date: '2024-11-15',
      doctor: 'Dr. Rodríguez',
      tooth: '24',
      procedure: 'Endodoncia',
      procedureCode: '18946005',
      diagnosis: 'Caries profunda',
      diagnosisCode: '80967001',
      notes: 'Procedimiento completado exitosamente. Paciente tolera bien el tratamiento.',
      images: [1, 3],
      status: 'completed'
    },
    {
      date: '2024-10-20',
      doctor: 'Dr. Martínez',
      tooth: '46',
      procedure: 'Corona de porcelana',
      procedureCode: '82130000',
      diagnosis: 'Fractura dental',
      diagnosisCode: '125589008',
      notes: 'Colocación de corona temporal. Control en 2 semanas.',
      images: [],
      status: 'in_progress'
    },
    {
      date: '2024-09-15',
      doctor: 'Dra. López',
      tooth: 'General',
      procedure: 'Higiene dental',
      procedureCode: '108290001',
      diagnosis: 'Acumulación de sarro',
      diagnosisCode: '109564008',
      notes: 'Limpieza profunda realizada. Se instruye en técnica de cepillado.',
      images: [2],
      status: 'completed'
    }
  ];

  // Componente ToothShape para formas realistas
  const ToothShape = ({ toothNumber, toothType, state, size = 40 }) => {
    const condition = state.conditions[0];
    const colorData = ISO_1942_SYMBOLS[condition] || ISO_1942_SYMBOLS.SOUND;
    
    const getToothPath = (type) => {
      const w = size;
      const h = size * 1.5;
      
      switch(type) {
        case 'incisor_central':
          return `M ${w*0.2} ${h*0.1} Q ${w*0.5} 0 ${w*0.8} ${h*0.1} L ${w*0.85} ${h*0.9} Q ${w*0.5} ${h} ${w*0.15} ${h*0.9} Z`;
        case 'incisor_lateral':
          return `M ${w*0.25} ${h*0.15} Q ${w*0.5} 0 ${w*0.75} ${h*0.15} L ${w*0.8} ${h*0.9} Q ${w*0.5} ${h} ${w*0.2} ${h*0.9} Z`;
        case 'canine':
          return `M ${w*0.3} ${h*0.2} L ${w*0.5} 0 L ${w*0.7} ${h*0.2} L ${w*0.75} ${h*0.9} Q ${w*0.5} ${h} ${w*0.25} ${h*0.9} Z`;
        case 'premolar1':
        case 'premolar2':
          return `M ${w*0.2} ${h*0.25} Q ${w*0.35} 0 ${w*0.5} ${h*0.1} Q ${w*0.65} 0 ${w*0.8} ${h*0.25} L ${w*0.85} ${h*0.85} Q ${w*0.5} ${h} ${w*0.15} ${h*0.85} Z`;
        case 'molar1':
        case 'molar2':
        case 'molar3':
          return `M ${w*0.15} ${h*0.3} Q ${w*0.25} 0 ${w*0.4} ${h*0.15} Q ${w*0.5} 0 ${w*0.6} ${h*0.15} Q ${w*0.75} 0 ${w*0.85} ${h*0.3} L ${w*0.9} ${h*0.8} Q ${w*0.5} ${h} ${w*0.1} ${h*0.8} Z`;
        default:
          return `M ${w*0.2} ${h*0.2} Q ${w*0.5} 0 ${w*0.8} ${h*0.2} L ${w*0.8} ${h*0.8} Q ${w*0.5} ${h} ${w*0.2} ${h*0.8} Z`;
      }
    };

    const getSpecialSymbol = (condition, size) => {
      switch(condition) {
        case 'CROWN':
          return (
            <g>
              <path d={`M ${size*0.25} ${size*0.3} L ${size*0.75} ${size*0.3} L ${size*0.7} ${size*0.15} L ${size*0.5} ${size*0.05} L ${size*0.3} ${size*0.15} Z`} 
                    fill="#FFD700" stroke="#FFA000" strokeWidth="1"/>
            </g>
          );
        case 'IMPLANT':
          return (
            <g>
              <rect x={size*0.35} y={size*0.7} width={size*0.3} height={size*0.4} 
                    fill="#673AB7" stroke="#4527A0" strokeWidth="1" rx="2"/>
              <circle cx={size*0.5} cy={size*0.5} r={size*0.15} 
                      fill="none" stroke="#673AB7" strokeWidth="2"/>
            </g>
          );
        case 'MISSING':
          return (
            <g>
              <line x1={size*0.2} y1={size*0.2} x2={size*0.8} y2={size*0.8} 
                    stroke="#9E9E9E" strokeWidth="3"/>
              <line x1={size*0.8} y1={size*0.2} x2={size*0.2} y2={size*0.8} 
                    stroke="#9E9E9E" strokeWidth="3"/>
            </g>
          );
        case 'ROOT_FILLED':
          return (
            <g>
              <circle cx={size*0.5} cy={size*0.6} r={size*0.1} 
                      fill="#E91E63" stroke="#C2185B" strokeWidth="1"/>
              <line x1={size*0.5} y1={size*0.5} x2={size*0.5} y2={size*0.9} 
                    stroke="#E91E63" strokeWidth="2"/>
            </g>
          );
        default:
          return null;
      }
    };

    return (
      <g>
        <path
          d={getToothPath(toothType)}
          fill={colorData.color}
          stroke={colorData.borderColor}
          strokeWidth="2"
          opacity={condition === 'MISSING' ? 0.3 : 1}
        />
        
        {getSpecialSymbol(condition, size)}
        
        <text
          x={size/2}
          y={size * 1.2}
          textAnchor="middle"
          className="text-xs font-medium fill-current text-gray-700"
        >
          {toothNumber}
        </text>
        
        {Object.keys(state.surfaces).length > 0 && (
          <circle
            cx={size * 0.85}
            cy={size * 0.15}
            r="4"
            fill="#FF5722"
            stroke="white"
            strokeWidth="1"
          />
        )}
      </g>
    );
  };

  // Componente Odontograma
  const Odontogram = ({ data, onToothClick, onToothHover, hoveredTooth, selectedTooth, title, isComparison = false }) => {
    const getToothStroke = (toothNum) => {
      if (selectedTooth === toothNum) return '#007bff';
      if (hoveredTooth === toothNum) return '#0056b3';
      return 'transparent';
    };

    const currentNotation = FDI_NOTATION[dentitionType];
    const { upperRight, upperLeft, lowerLeft, lowerRight } = currentNotation;

    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${isComparison ? 'border-2 border-blue-200' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">ISO 3950 Compliant</span>
            </div>
            <select
              value={dentitionType}
              onChange={(e) => setDentitionType(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
              disabled={isComparison}
            >
              <option value="permanent">Dentición Permanente</option>
              <option value="deciduous">Dentición Decidua</option>
            </select>
          </div>
        </div>

        <svg viewBox="0 0 900 500" className="w-full h-auto border border-gray-200 rounded-lg">
          {/* Arcada Superior Derecha */}
          <g transform="translate(50, 50)">
            {upperRight.map((tooth, index) => {
              const toothData = data[tooth] || { conditions: ['SOUND'], surfaces: {} };
              const toothType = TOOTH_TYPES[tooth] || 'premolar1';
              
              return (
                <g key={tooth} transform={`translate(${index * 55}, 0)`}>
                  <rect
                    x="0" y="0" width="50" height="80" fill="transparent"
                    stroke={getToothStroke(tooth)} strokeWidth="3" rx="8"
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => !isComparison && onToothClick(tooth)}
                    onMouseEnter={() => !isComparison && onToothHover(tooth)}
                    onMouseLeave={() => !isComparison && onToothHover(null)}
                  />
                  <g transform="translate(5, 5)">
                    <ToothShape 
                      toothNumber={tooth}
                      toothType={toothType}
                      state={toothData}
                      size={40}
                    />
                  </g>
                  
                  {isComparison && data !== odontogramData[selectedDate] && 
                   JSON.stringify(data[tooth]) !== JSON.stringify(odontogramData[selectedDate][tooth]) && (
                    <circle cx="45" cy="5" r="5" fill="#ff6b35" stroke="white" strokeWidth="2" />
                  )}
                </g>
              );
            })}
          </g>

          {/* Arcada Superior Izquierda */}
          <g transform="translate(490, 50)">
            {upperLeft.map((tooth, index) => {
              const toothData = data[tooth] || { conditions: ['SOUND'], surfaces: {} };
              const toothType = TOOTH_TYPES[tooth] || 'premolar1';
              
              return (
                <g key={tooth} transform={`translate(${index * 55}, 0)`}>
                  <rect
                    x="0" y="0" width="50" height="80" fill="transparent"
                    stroke={getToothStroke(tooth)} strokeWidth="3" rx="8"
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => !isComparison && onToothClick(tooth)}
                    onMouseEnter={() => !isComparison && onToothHover(tooth)}
                    onMouseLeave={() => !isComparison && onToothHover(null)}
                  />
                  <g transform="translate(5, 5)">
                    <ToothShape 
                      toothNumber={tooth}
                      toothType={toothType}
                      state={toothData}
                      size={40}
                    />
                  </g>
                </g>
              );
            })}
          </g>

          {/* Arcada Inferior Izquierda */}
          <g transform="translate(490, 300)">
            {lowerLeft.map((tooth, index) => {
              const toothData = data[tooth] || { conditions: ['SOUND'], surfaces: {} };
              const toothType = TOOTH_TYPES[tooth] || 'premolar1';
              
              return (
                <g key={tooth} transform={`translate(${index * 55}, 0)`}>
                  <rect
                    x="0" y="0" width="50" height="80" fill="transparent"
                    stroke={getToothStroke(tooth)} strokeWidth="3" rx="8"
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => !isComparison && onToothClick(tooth)}
                    onMouseEnter={() => !isComparison && onToothHover(tooth)}
                    onMouseLeave={() => !isComparison && onToothHover(null)}
                  />
                  <g transform="translate(5, 5) scale(1, -1) translate(0, -60)">
                    <ToothShape 
                      toothNumber={tooth}
                      toothType={toothType}
                      state={toothData}
                      size={40}
                    />
                  </g>
                </g>
              );
            })}
          </g>

          {/* Arcada Inferior Derecha */}
          <g transform="translate(50, 300)">
            {lowerRight.map((tooth, index) => {
              const toothData = data[tooth] || { conditions: ['SOUND'], surfaces: {} };
              const toothType = TOOTH_TYPES[tooth] || 'premolar1';
              
              return (
                <g key={tooth} transform={`translate(${index * 55}, 0)`}>
                  <rect
                    x="0" y="0" width="50" height="80" fill="transparent"
                    stroke={getToothStroke(tooth)} strokeWidth="3" rx="8"
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => !isComparison && onToothClick(tooth)}
                    onMouseEnter={() => !isComparison && onToothHover(tooth)}
                    onMouseLeave={() => !isComparison && onToothHover(null)}
                  />
                  <g transform="translate(5, 5) scale(1, -1) translate(0, -60)">
                    <ToothShape 
                      toothNumber={tooth}
                      toothType={toothType}
                      state={toothData}
                      size={40}
                    />
                  </g>
                </g>
              );
            })}
          </g>

          {/* Leyenda ISO 1942 */}
          <g transform="translate(50, 430)">
            {Object.entries(ISO_1942_SYMBOLS).slice(0, 6).map(([key, symbol], index) => (
              <g key={key} transform={`translate(${index * 100}, 0)`}>
                <rect 
                  x="0" y="0" width="15" height="15" 
                  fill={symbol.color} stroke={symbol.borderColor} strokeWidth="2"
                />
                <text x="20" y="12" className="text-xs fill-current text-gray-600">
                  {symbol.name}
                </text>
              </g>
            ))}
            
            {isComparison && (
              <g transform="translate(700, 0)">
                <circle cx="7" cy="7" r="5" fill="#ff6b35" stroke="white" strokeWidth="1" />
                <text x="20" y="12" className="text-xs fill-current text-gray-600">Cambio</text>
              </g>
            )}
          </g>
        </svg>

        {/* Panel de información ISO */}
        <div className="mt-4 bg-blue-50 rounded-lg p-3">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Estándar: ISO 3950 (FDI World Dental Federation)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-green-600" />
              <span>Simbología: ISO 1942</span>
            </div>
            <div className="text-gray-600">
              Última actualización: {selectedDate}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Periodontograma
  const Periodontogram = ({ data, tooth, onPointClick, onPointHover }) => {
    if (!data || !tooth || !data[tooth]) return null;

    const toothData = data[tooth];
    const points = ['MB', 'B', 'DB', 'ML', 'L', 'DL'];
    
    const getPointColor = (point) => {
      const depth = toothData.probing[point];
      const bleeding = toothData.bleeding[point];
      const suppuration = toothData.suppuration[point];
      
      if (suppuration) return '#9C27B0';
      if (bleeding) return '#F44336';
      if (depth >= 5) return '#FF9800';
      if (depth >= 4) return '#FFC107';
      if (depth >= 3) return '#FF5722';
      return '#4CAF50';
    };

    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Periodontograma - Diente {tooth}
          </h3>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">AAP/EFP 2017</span>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="flex justify-center">
            <svg viewBox="0 0 300 200" className="w-80 h-56">
              <rect x="130" y="80" width="40" height="60" rx="8" fill="#f8f9fa" stroke="#dee2e6" strokeWidth="2" />
              
              {points.map((point, index) => {
                const positions = {
                  'MB': { x: 120, y: 70 },
                  'B': { x: 150, y: 60 },
                  'DB': { x: 180, y: 70 },
                  'ML': { x: 120, y: 170 },
                  'L': { x: 150, y: 180 },
                  'DL': { x: 180, y: 170 }
                };
                
                const depth = toothData.probing[point];
                
                return (
                  <g key={point}>
                    <circle
                      cx={positions[point].x}
                      cy={positions[point].y}
                      r="12"
                      fill={getPointColor(point)}
                      stroke={selectedPoint === `${tooth}-${point}` ? '#007bff' : '#ffffff'}
                      strokeWidth="2"
                      className="cursor-pointer transition-all duration-200 hover:brightness-110"
                      onClick={() => onPointClick(`${tooth}-${point}`)}
                      onMouseEnter={() => onPointHover(`${tooth}-${point}`)}
                      onMouseLeave={() => onPointHover(null)}
                    />
                    
                    <text
                      x={positions[point].x}
                      y={positions[point].y + 3}
                      textAnchor="middle"
                      className="text-xs font-bold fill-white pointer-events-none"
                    >
                      {depth}
                    </text>
                    
                    <text
                      x={positions[point].x}
                      y={positions[point].y - 20}
                      textAnchor="middle"
                      className="text-xs font-medium fill-current text-gray-600"
                    >
                      {point}
                    </text>
                    
                    {toothData.bleeding[point] && (
                      <circle
                        cx={positions[point].x + 10}
                        cy={positions[point].y - 10}
                        r="3"
                        fill="#F44336"
                      />
                    )}
                    
                    {toothData.suppuration[point] && (
                      <circle
                        cx={positions[point].x - 10}
                        cy={positions[point].y - 10}
                        r="3"
                        fill="#9C27B0"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                Profundidades (mm)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {points.map(point => (
                  <div key={point} className="flex justify-between">
                    <span className="text-gray-600">{point}:</span>
                    <span className="font-medium">{toothData.probing[point]}mm</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Índices Periodontales
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">BOP:</span>
                  <span className="font-medium">{toothData.BOP.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PSR:</span>
                  <span className="font-medium">Código {toothData.PSR}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Movilidad:</span>
                  <span className="font-medium">Grado {toothData.mobility}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Furca:</span>
                  <span className="font-medium">Grado {toothData.furcation}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                <Award className="w-4 h-4 mr-2" />
                Clasificación 2017
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Estadio:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    toothData.stage === 'IV' ? 'bg-red-200 text-red-800' :
                    toothData.stage === 'III' ? 'bg-orange-200 text-orange-800' :
                    toothData.stage === 'II' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-green-200 text-green-800'
                  }`}>
                    {toothData.stage}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Grado:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    toothData.grade === 'C' ? 'bg-red-200 text-red-800' :
                    toothData.grade === 'B' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-green-200 text-green-800'
                  }`}>
                    {toothData.grade}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Leyenda de Indicadores</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span>&lt; 3mm (Saludable)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <span>3-4mm (Moderado)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <span>≥ 5mm (Severo)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span>Sangrado al sondaje</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Otros componentes simplificados
  const ImageGallery = () => {
    const [filter, setFilter] = useState('all');
    const [zoomLevel, setZoomLevel] = useState(1);

    const filteredImages = imageGallery.filter(img => {
      if (filter === 'all') return true;
      if (filter === 'tooth' && selectedTooth) return img.tooth === selectedTooth.toString();
      return img.type === filter;
    });

    const ImageModal = ({ image, onClose }) => (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
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
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">Galería de Imágenes DICOM</h3>
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

  // Componentes simplificados
  const AIChat = () => {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = async () => {
      if (!message.trim()) return;
      const userMessage = { role: 'user', content: message, timestamp: new Date() };
      setAiMessages([...aiMessages, userMessage]);
      setMessage('');
      setIsLoading(true);

      setTimeout(() => {
        const response = `Análisis HL7 FHIR del historial de ${patient.name}: Sistema con codificación SNOMED-CT activo. ¿Qué aspecto clínico específico deseas consultar?`;
        const aiResponse = { role: 'assistant', content: response, timestamp: new Date() };
        setAiMessages(prev => [...prev, aiResponse]);
        setIsLoading(false);
      }, 1500);
    };

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 h-96 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <MessageSquare className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-bold text-gray-800">Asistente IA Clínico</h3>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-600">HL7 FHIR</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {aiMessages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Asistente IA con Estándares Médicos</p>
              <p className="text-sm">Consulta sobre análisis HL7 FHIR, códigos SNOMED-CT, clasificación AAP 2017</p>
            </div>
          )}
          
          {aiMessages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                <p className="text-sm">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Consulta sobre estándares médicos..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || isLoading}
            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const VoiceCapture = () => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-4">
        <Mic className="w-5 h-5 text-purple-600 mr-2" />
        <h3 className="text-lg font-bold text-gray-800">Captura por Voz</h3>
        <Shield className="w-4 h-4 text-green-600 ml-auto" />
      </div>
      <div className="text-center">
        <p className="text-gray-600 mb-4">Captura de sesiones con transcripción automática y codificación SNOMED-CT</p>
        <button className="w-20 h-20 rounded-full bg-purple-500 text-white flex items-center justify-center hover:bg-purple-600">
          <Mic className="w-8 h-8" />
        </button>
      </div>
    </div>
  );

  const ReportExport = () => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-4">
        <FileDown className="w-5 h-5 text-green-600 mr-2" />
        <h3 className="text-lg font-bold text-gray-800">Exportar Reportes</h3>
        <Shield className="w-4 h-4 text-green-600 ml-auto" />
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Reporte HL7 FHIR</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option>Bundle FHIR Completo</option>
            <option>Observation SNOMED-CT</option>
            <option>Procedure ISO/ICD-10</option>
            <option>DiagnosticReport DICOM</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 flex items-center justify-center">
            <FileDown className="w-4 h-4 mr-2" />PDF
          </button>
          <button className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 flex items-center justify-center">
            <FileDown className="w-4 h-4 mr-2" />HL7
          </button>
        </div>
      </div>
    </div>
  );

  const MedicalAlerts = ({ alerts }) => (
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

  const TreatmentTimeline = ({ treatments }) => (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">Historial de Tratamientos</h3>
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-gray-600">HL7 FHIR</span>
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-blue-600"></div>
        {treatments.map((treatment, index) => (
          <div key={index} className="relative flex items-start mb-8 last:mb-0">
            <div className={`relative z-10 w-6 h-6 rounded-full border-4 border-white shadow-lg ${
              treatment.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
            }`}></div>
            <div className="ml-6 flex-1">
              <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-800">{treatment.procedure}</h4>
                  <span className="text-sm text-gray-500">{treatment.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <span className="text-sm text-gray-600">SNOMED-CT:</span>
                    <span className="ml-2 font-mono text-xs">{treatment.procedureCode}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Diente:</span>
                    <span className="ml-2 font-medium">{treatment.tooth}</span>
                  </div>
                </div>
                <p className="text-gray-700 text-sm">{treatment.notes}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ToothDetails = ({ toothNumber, data }) => {
    if (!toothNumber || !data[toothNumber]) return null;
    const toothData = data[toothNumber];
    const condition = ISO_1942_SYMBOLS[toothData.conditions[0]] || ISO_1942_SYMBOLS.SOUND;

    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Diente {toothNumber}</h3>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-600">ISO 3950</span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <span className="font-semibold text-gray-700">Estado ISO 1942:</span>
            <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: condition.color, borderColor: condition.borderColor, borderWidth: '1px' }}>
              <div className="font-medium">{condition.name} ({condition.code})</div>
              <div className="text-sm text-gray-600">{condition.description}</div>
            </div>
          </div>
          {Object.keys(toothData.surfaces).length > 0 && (
            <div>
              <span className="font-semibold text-gray-700">Superficies afectadas:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(toothData.surfaces).map(([surface, condition]) => (
                  <span key={surface} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {surface}: {condition}
                  </span>
                ))}
              </div>
            </div>
          )}
          {toothData.notes && (
            <div>
              <span className="font-semibold text-gray-700">Notas clínicas:</span>
              <p className="text-sm text-gray-600 mt-1">{toothData.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AnamnesisDashboard = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Anamnesis Estructurada</h3>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">HL7 FHIR | SNOMED-CT</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center mb-4">
            <User className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-bold text-gray-800">Antecedentes Personales</h3>
          </div>
          <div className="space-y-3">
            {patient.medicalHistory.personalHistory.map((item, index) => (
              <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-gray-800">{item.condition}</div>
                  <span className="text-xs font-mono text-gray-500">{item.snomed}</span>
                </div>
                <div className="text-sm text-gray-600">
                  ICD-10: {item.icd10} • Desde: {item.since} • Estado: {item.status}
                </div>
                <div className="text-sm text-gray-700">{item.comments}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center mb-4">
            <Heart className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="text-lg font-bold text-gray-800">Antecedentes Familiares</h3>
          </div>
          <div className="space-y-3">
            {patient.medicalHistory.familyHistory.map((item, index) => (
              <div key={index} className="border-l-4 border-red-200 pl-4 py-2">
                <div className="font-semibold text-gray-800">{item.condition}</div>
                <div className="text-sm text-gray-600">Familiar: {item.relative}</div>
                <div className="text-sm text-gray-700">{item.comments}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <h3 className="text-lg font-bold text-gray-800">Alergias</h3>
          </div>
          <div className="space-y-3">
            {patient.medicalHistory.allergies.map((item, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-red-800">{item.allergen}</div>
                  <span className="text-xs font-mono text-gray-500">{item.snomed}</span>
                </div>
                <div className="text-sm text-red-600">{item.reaction}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center mb-4">
            <Pill className="w-5 h-5 text-green-600 mr-2" />
            <h3 className="text-lg font-bold text-gray-800">Medicamentos Actuales</h3>
          </div>
          <div className="space-y-3">
            {patient.medicalHistory.medications.map((item, index) => (
              <div key={index} className="border-l-4 border-green-200 pl-4 py-2">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-gray-800">{item.name}</div>
                  <span className="text-xs font-mono text-gray-500">{item.code}</span>
                </div>
                <div className="text-sm text-gray-600">{item.dose} • {item.frequency}</div>
                <div className="text-sm text-gray-700">Desde: {item.since}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const Navigation = () => (
    <div className="bg-white shadow-sm border-b border-gray-200 mb-8">
      <div className="flex space-x-8 px-6 overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Stethoscope },
          { id: 'odontogram', label: 'Odontograma ISO', icon: Search },
          { id: 'anamnesis', label: 'Anamnesis HL7', icon: FileText },
          { id: 'timeline', label: 'Timeline FHIR', icon: Clock },
          { id: 'images', label: 'Imágenes DICOM', icon: Camera },
          { id: 'voice', label: 'Voz SNOMED', icon: Mic },
          { id: 'reports', label: 'Reportes HL7', icon: FileDown }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Historial Clinico Digital</h1>
            <p className="text-gray-600">Paciente: {patient.name} • Edad: {patient.age} años</p>
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1 text-sm">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">ISO 3950/1942</span>
              </div>
              <div className="flex items-center space-x-1 text-sm">
                <Award className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">AAP/EFP 2017</span>
              </div>
              <div className="flex items-center space-x-1 text-sm">
                <Zap className="w-4 h-4 text-purple-600" />
                <span className="text-gray-600">HL7 FHIR</span>
              </div>
              <div className="flex items-center space-x-1 text-sm">
                <Camera className="w-4 h-4 text-orange-600" />
                <span className="text-gray-600">DICOM</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center space-x-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>IA SNOMED-CT</span>
            </button>
            <div className="text-right">
              <div className="text-sm text-gray-500">Última visita</div>
              <div className="font-semibold text-gray-800">{patient.lastVisit}</div>
              <div className="text-xs text-gray-500">Registro HL7 FHIR: {patient.id}</div>
            </div>
          </div>
        </div>
      </div>

      <Navigation />

      <div className="px-6 pb-8">
        <div className="space-y-6">
          {activeView === 'dashboard' && (
              <div className="space-y-6">
                <MedicalAlerts alerts={patient.alerts} />
                
                <div className="bg-white rounded-xl shadow-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Control del Odontograma ISO 3950</h3>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={compareMode}
                          onChange={(e) => setCompareMode(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Modo comparación temporal</span>
                      </label>
                      {compareMode && (
                        <select
                          value={compareDate}
                          onChange={(e) => setCompareDate(e.target.value)}
                          className="border border-gray-300 rounded px-3 py-1 text-sm"
                        >
                          <option value="2024-01-15">Enero 2024 (Estado anterior)</option>
                        </select>
                      )}
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-600">Certificado ISO</span>
                      </div>
                    </div>
                  </div>
                </div>

                {compareMode ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Odontogram
                      data={odontogramData[selectedDate]}
                      onToothClick={setSelectedTooth}
                      onToothHover={setHoveredTooth}
                      hoveredTooth={hoveredTooth}
                      selectedTooth={selectedTooth}
                      title={`Estado Actual (${selectedDate})`}
                    />
                    <Odontogram
                      data={odontogramData[compareDate]}
                      onToothClick={() => {}}
                      onToothHover={() => {}}
                      hoveredTooth={null}
                      selectedTooth={null}
                      title={`Estado Anterior (${compareDate})`}
                      isComparison={true}
                    />
                  </div>
                ) : (
                  <Odontogram
                    data={odontogramData[selectedDate]}
                    onToothClick={setSelectedTooth}
                    onToothHover={setHoveredTooth}
                    hoveredTooth={hoveredTooth}
                    selectedTooth={selectedTooth}
                    title="Odontograma Interactivo ISO 3950"
                  />
                )}

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Estadísticas Clínicas ISO 1942</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(ISO_1942_SYMBOLS).slice(0, 4).map(([key, symbol]) => {
                      const count = Object.values(odontogramData[selectedDate])
                        .filter(tooth => tooth.conditions.includes(key)).length;
                      return (
                        <div key={key} className="bg-white rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-gray-800">{count}</div>
                          <div className="text-sm text-gray-600">{symbol.name}</div>
                          <div className="text-xs text-gray-500">Código: {symbol.code}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeView === 'odontogram' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Odontograma ISO 3950 + Periodontograma AAP 2017</h3>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={compareMode}
                          onChange={(e) => setCompareMode(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Comparación temporal</span>
                      </label>
                      {compareMode && (
                        <select
                          value={compareDate}
                          onChange={(e) => setCompareDate(e.target.value)}
                          className="border border-gray-300 rounded px-3 py-1 text-sm"
                        >
                          <option value="2024-01-15">Enero 2024</option>
                        </select>
                      )}
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-600">ISO + AAP Certified</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">ISO 3950/1942</span>
                        <span className="text-gray-600">- Nomenclatura y Simbología Internacional</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        <span className="font-medium">AAP/EFP 2017</span>
                        <span className="text-gray-600">- Clasificación Periodontal Moderna</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    {compareMode ? (
                      <div className="space-y-4">
                        <Odontogram
                          data={odontogramData[selectedDate]}
                          onToothClick={setSelectedTooth}
                          onToothHover={setHoveredTooth}
                          hoveredTooth={hoveredTooth}
                          selectedTooth={selectedTooth}
                          title={`Estado Actual (${selectedDate})`}
                        />
                        <Odontogram
                          data={odontogramData[compareDate]}
                          onToothClick={() => {}}
                          onToothHover={() => {}}
                          hoveredTooth={null}
                          selectedTooth={null}
                          title={`Estado Anterior (${compareDate})`}
                          isComparison={true}
                        />
                      </div>
                    ) : (
                      <Odontogram
                        data={odontogramData[selectedDate]}
                        onToothClick={setSelectedTooth}
                        onToothHover={setHoveredTooth}
                        hoveredTooth={hoveredTooth}
                        selectedTooth={selectedTooth}
                        title="Odontograma Interactivo ISO 3950"
                      />
                    )}
                  </div>

                  <div className="space-y-6">
                     {selectedTooth && (
                      <ToothDetails
                        toothNumber={selectedTooth}
                        data={odontogramData[selectedDate]}
                      />
                    )}

                    {selectedTooth && periodontogramData[selectedDate] && periodontogramData[selectedDate][selectedTooth] ? (
                      <Periodontogram
                        data={periodontogramData[selectedDate]}
                        tooth={selectedTooth}
                        onPointClick={setSelectedPoint}
                        onPointHover={setHoveredPoint}
                      />
                    ) : (
                      <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-800">Periodontograma AAP 2017</h3>
                          <div className="flex items-center space-x-2">
                            <Award className="w-4 h-4 text-purple-600" />
                            <span className="text-sm text-gray-600">AAP/EFP 2017</span>
                          </div>
                        </div>
                        <div className="text-center py-12">
                          <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-600 mb-4">
                            Selecciona un diente para ver su periodontograma
                          </p>
                          <div className="text-sm text-gray-500 mb-4">
                            Disponible para dientes: <br/>
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">16, 26, 36, 46</span>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <Award className="w-4 h-4 text-purple-600" />
                              <span className="font-medium">Clasificación AAP/EFP 2017</span>
                            </div>
                            <div className="text-gray-600">
                              6 puntos de sondaje • Estadios I-IV • Grados A-C
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeView === 'anamnesis' && <AnamnesisDashboard />}
            {activeView === 'timeline' && <TreatmentTimeline treatments={treatmentTimeline} />}
            {activeView === 'images' && <ImageGallery />}
            {activeView === 'voice' && <VoiceCapture />}
            {activeView === 'reports' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportExport />
                {showAIChat && <AIChat />}
              </div>
            )}
             
            {activeView !== 'reports' && showAIChat && (
              <div className="mt-6">
                <AIChat />
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DentalClinicalSystem;
