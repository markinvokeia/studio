'use client';
import React, { useEffect, useRef, useState } from 'react';

const toothShapes = {
  incisor: "M 5,5 L 25,5 L 20,25 L 10,25 Z",
  canine: "M 5,5 L 15,2 L 25,5 L 20,25 L 10,25 Z",
  premolar: "M 5,5 L 25,5 L 25,25 L 5,25 Z",
  molar: "M 5,5 L 25,5 L 30,25 L 0,25 Z"
};

const toothTypes = {
    1: 'incisor', 2: 'incisor', 3: 'canine', 4: 'premolar', 5: 'premolar', 6: 'molar', 7: 'molar', 8: 'molar'
};

const Tooth = ({ id, onSelect, selected }) => {
    const type = toothTypes[id % 10] || 'molar';
    const shape = toothShapes[type];
    const isUpper = id < 30;

    return (
        <div className="tooth-container" onClick={() => onSelect(id)}>
            <svg viewBox="0 0 30 30" className={`tooth-svg ${selected ? 'selected' : ''}`} style={{ transform: isUpper ? 'none' : 'scaleY(-1)' }}>
                <path d={shape} stroke="black" strokeWidth="1" fill="white" />
            </svg>
            <div className="tooth-id">{id}</div>
        </div>
    );
};

export const OdontogramComponent = () => {
    const [selectedTooth, setSelectedTooth] = useState(null);
    const canvasRef = useRef(null);

    const quadrants = {
        upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
        upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
        lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
        lowerRight: [48, 47, 46, 45, 44, 43, 42, 41]
    };
    
    useEffect(() => {
        const cssLink = document.createElement("link");
        cssLink.href = "/odontograma/css/style.css";
        cssLink.rel = "stylesheet";
        cssLink.type = "text/css";
        document.head.appendChild(cssLink);
        
        return () => {
            document.head.removeChild(cssLink);
        }
    }, []);


    return (
      <div id="wrapper">
        <div id="paleta">
            <div className="row">
                <div className="colors" style={{ backgroundColor: '#80FFFF' }} id="sano"></div>
                <div className="colors" style={{ backgroundColor: '#FF8080' }} id="caries"></div>
                <div className="colors" style={{ backgroundColor: '#FFFF80' }} id="restauracion"></div>
                <div className="colors" style={{ backgroundColor: '#80FF80' }} id="endodoncia"></div>
                <div className="colors" style={{ backgroundColor: '#FF80FF' }} id="extraccion"></div>
            </div>
        </div>
        <div id="container">
            <div id="cuadrante_1">
                <div className="row">
                    <img id="img_18" src="/odontograma/img/18.png" alt="18" />
                    <img id="img_17" src="/odontograma/img/17.png" alt="17" />
                    <img id="img_16" src="/odontograma/img/16.png" alt="16" />
                    <img id="img_15" src="/odontograma/img/15.png" alt="15" />
                    <img id="img_14" src="/odontograma/img/14.png" alt="14" />
                    <img id="img_13" src="/odontograma/img/13.png" alt="13" />
                    <img id="img_12" src="/odontograma/img/12.png" alt="12" />
                    <img id="img_11" src="/odontograma/img/11.png" alt="11" />
                </div>
            </div>
            <div id="cuadrante_2">
                <div className="row">
                    <img id="img_21" src="/odontograma/img/21.png" alt="21" />
                    <img id="img_22" src="/odontograma/img/22.png" alt="22" />
                    <img id="img_23" src="/odontograma/img/23.png" alt="23" />
                    <img id="img_24" src="/odontograma/img/24.png" alt="24" />
                    <img id="img_25" src="/odontograma/img/25.png" alt="25" />
                    <img id="img_26" src="/odontograma/img/26.png" alt="26" />
                    <img id="img_27" src="/odontograma/img/27.png" alt="27" />
                    <img id="img_28" src="/odontograma/img/28.png" alt="28" />
                </div>
            </div>
            <div id="cuadrante_3">
                <div className="row">
                    <img id="img_48" src="/odontograma/img/48.png" alt="48" />
                    <img id="img_47" src="/odontograma/img/47.png" alt="47" />
                    <img id="img_46" src="/odontograma/img/46.png" alt="46" />
                    <img id="img_45" src="/odontograma/img/45.png" alt="45" />
                    <img id="img_44" src="/odontograma/img/44.png" alt="44" />
                    <img id="img_43" src="/odontograma/img/43.png" alt="43" />
                    <img id="img_42" src="/odontograma/img/42.png" alt="42" />
                    <img id="img_41" src="/odontograma/img/41.png" alt="41" />
                </div>
            </div>
            <div id="cuadrante_4">
                <div className="row">
                    <img id="img_31" src="/odontograma/img/31.png" alt="31" />
                    <img id="img_32" src="/odontograma/img/32.png" alt="32" />
                    <img id="img_33" src="/odontograma/img/33.png" alt="33" />
                    <img id="img_34" src="/odontograma/img/34.png" alt="34" />
                    <img id="img_35" src="/odontograma/img/35.png" alt="35" />
                    <img id="img_36" src="/odontograma/img/36.png" alt="36" />
                    <img id="img_37" src="/odontograma/img/37.png" alt="37" />
                    <img id="img_38" src="/odontograma/img/38.png" alt="38" />
                </div>
            </div>
        </div>
      </div>
    );
};
