
'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

// Nomenclatura FDI ISO 3950 completa
const FDI_NOTATION = {
  permanent: {
    upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
    upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
    lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
    lowerRight: [41, 42, 43, 44, 45, 46, 47, 48],
  },
  deciduous: {
    upperRight: [55, 54, 53, 52, 51],
    upperLeft: [61, 62, 63, 64, 65],
    lowerLeft: [71, 72, 73, 74, 75],
    lowerRight: [81, 82, 83, 84, 85],
  },
};

// Tipos de dientes para formas SVG realistas
const TOOTH_TYPES: Record<number, string> = {
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
};

const AnatomicalTooth = ({ toothNumber, state }: { toothNumber: number, state: any }) => {
    const toothType = TOOTH_TYPES[toothNumber];
    const condition = state.conditions[0];

    const paths: Record<string, string> = {
      incisor_central: "M10 2 L20 2 L22 20 L8 20 Z",
      incisor_lateral: "M11 2 L19 2 L21 20 L9 20 Z",
      canine: "M10 2 L15 0 L20 2 L22 20 L8 20 Z",
      premolar1: "M8 3 L22 3 L24 20 L6 20 Z",
      premolar2: "M8 3 L22 3 L24 20 L6 20 Z",
      molar1: "M5 4 L25 4 L28 20 L2 20 Z",
      molar2: "M6 4 L24 4 L26 20 L4 20 Z",
      molar3: "M7 4 L23 4 L25 20 L5 20 Z",
    };

    const SvgWrapper = ({ children, isUpper }: { children: React.ReactNode, isUpper: boolean }) => (
      <svg
        viewBox="0 0 30 22"
        className="w-full h-full"
        style={{ transform: isUpper ? 'none' : 'scaleY(-1)' }}
      >
        {children}
      </svg>
    );

    const isUpper = toothNumber < 30;
    let toothFill = '#FFFFFF';
    let strokeColor = '#6b7280';
    let specialRender = null;
    
    if (condition === 'MISSING') {
      return null;
    }
    
    if (condition === 'ROOT_FILLED') {
      toothFill = '#e5e7eb';
      specialRender = <path d="M14 10 L16 10 L16 20 L14 20 Z" fill="black" />;
    }
    
    if (condition === 'IMPLANT') {
        toothFill = '#111827';
        strokeColor = '#4b5563';
    }

    if (condition === 'CROWN') {
        toothFill = '#fef08a';
    }
    
    if(Object.keys(state.surfaces).length > 0){
        toothFill = '#9ca3af';
    }

    return (
      <div className="w-6 h-8 flex items-center justify-center">
        <SvgWrapper isUpper={isUpper}>
          <g>
            <path d={paths[toothType] || paths.premolar1} fill={toothFill} stroke={strokeColor} strokeWidth="0.5" />
            {specialRender}
          </g>
        </SvgWrapper>
      </div>
    );
};

const SymbolicTooth = ({ state }: { state: any }) => {
    const condition = state.conditions[0];
    let symbolFill = 'white';
    let strokeColor = '#9ca3af';

    if (condition === 'MISSING') {
        return (
            <div className="w-6 h-6 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
            </div>
        );
    }
    
    if(Object.keys(state.surfaces).length > 0){
        symbolFill = '#9ca3af';
    }

    return (
      <div className="w-6 h-6">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill={symbolFill} stroke={strokeColor} strokeWidth="1" />
          <path d="M12 2 L12 22 M2 12 L22 12 M7 7 L17 17 M7 17 L17 7" stroke={strokeColor} strokeWidth="0.5" />
        </svg>
      </div>
    );
};

export const OdontogramComponent = () => {
    const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
    const [dentitionType, setDentitionType] = useState<'permanent' | 'deciduous'>('permanent');

    const data = odontogramData['2024-11-15'];

    const onToothClick = (toothNum: number) => {
        setSelectedTooth(toothNum === selectedTooth ? null : toothNum);
    };

    const QuadrantRow = ({ teeth, isUpper }: { teeth: number[], isUpper: boolean }) => {
        const midPoint = teeth.length / 2;
        const rightQuadrant = isUpper ? teeth.slice(0, midPoint).reverse() : teeth.slice(0, midPoint).reverse();
        const leftQuadrant = isUpper ? teeth.slice(midPoint) : teeth.slice(midPoint);

        const renderTeeth = (quadrantTeeth: number[]) => quadrantTeeth.map(toothNum => {
            const toothData = data[toothNum as keyof typeof data] || { conditions: ['SOUND'], surfaces: {} };
            const isMissing = toothData.conditions[0] === 'MISSING';
            return (
                <div
                  key={toothNum}
                  className={`flex flex-col items-center cursor-pointer p-1 space-y-1 ${selectedTooth === toothNum ? 'bg-blue-100 rounded-md' : ''}`}
                  onClick={() => onToothClick(toothNum)}
                >
                  {isUpper && !isMissing && <AnatomicalTooth toothNumber={toothNum} state={toothData} />}
                   <SymbolicTooth state={toothData} />
                   <span className="text-xs font-mono">{toothNum}</span>
                  {!isUpper && !isMissing && <AnatomicalTooth toothNumber={toothNum} state={toothData} />}
                </div>
            )
        });

        return (
            <div className="flex justify-between w-full">
                <div className="flex justify-end flex-1">{renderTeeth(rightQuadrant)}</div>
                <div className="w-px bg-gray-300 mx-2"></div>
                <div className="flex justify-start flex-1">{renderTeeth(leftQuadrant)}</div>
            </div>
        )
    }

    const { upperRight, upperLeft, lowerLeft, lowerRight } = FDI_NOTATION[dentitionType];
    const allUpper = [...upperRight, ...upperLeft];
    const allLower = [...lowerRight, ...lowerLeft];

    return (
        <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Odontogram</h3>
            <div className="flex flex-col items-center space-y-2">
                <QuadrantRow teeth={allUpper} isUpper={true} />
                <div className="w-full h-px bg-gray-300 my-2"></div>
                <QuadrantRow teeth={allLower} isUpper={false} />
            </div>
        </div>
    );
};
