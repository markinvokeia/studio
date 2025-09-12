'use client';

import React, { useRef, useEffect } from 'react';

// This component is a wrapper for the vanilla JS odontogram engine.
// It ensures the canvas is ready before the engine tries to use it.

const OdontogramComponent = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<any | null>(null);

    useEffect(() => {
        class Engine {
            canvas: HTMLCanvasElement | null = null;
            context: CanvasRenderingContext2D | null = null;
            properties: any = {};
            images: any = {};
            interval: any = null;

            setCanvas(canvas: HTMLCanvasElement) {
                this.canvas = canvas;
                this.context = canvas.getContext('2d');
            }

            async init() {
                 console.log("Engine init started");
                await this.loadImages();
                this.loadDientes();
                this.loadPatientData("Clínica Dental Sonrisas", "Juan Pérez", "12345", "789", "2024-05-21", "Dr. Smith", "Paciente presenta sensibilidad en el cuadrante superior derecho.", "");
                this.start();
                console.log("Engine init finished");
                return () => this.stop();
            }
            
            loadPatientData(p_clinica: any, p_paciente: any, p_ficha: any, p_hc: any, p_fecha: any, p_doctor: any, p_observaciones: any, p_especificaciones: any) {
                if (!this.properties.paciente) {
                    this.properties.paciente = {};
                }
                this.properties.paciente.clinica = p_clinica;
                this.properties.paciente.paciente = p_paciente;
                this.properties.paciente.ficha = p_ficha;
                this.properties.paciente.hc = p_hc;
                this.properties.paciente.fecha = p_fecha;
                this.properties.paciente.doctor = p_doctor;
                this.properties.paciente.observaciones = p_observaciones;
                this.properties.paciente.especificaciones = p_especificaciones;
            }

            async loadImages() {
                const loadImage = (src: string): Promise<HTMLImageElement> => {
                    return new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = (e) => reject(new Error(`Failed to load image: ${src}. Error: ${e}`));
                        img.src = src;
                    });
                };
                
                this.properties = {
                    dientes: [],
                    paleta: {},
                    paciente: {}
                };

                const imageSources: { [key: string]: string } = {
                    'odontograma': '/odontograma/img/odontograma.png',
                    'paleta': '/odontograma/img/paleta.png',
                    'odontograma_over': '/odontograma/img/odontograma_over.png',
                    'paleta_over': '/odontograma/img/paleta_over.png',
                };
                
                const sup = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
                const inf = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

                sup.forEach(d => {
                    imageSources[`dentadura-sup-${d}`] = `/odontograma/img/dentadura-sup-${d}.png`;
                });
                inf.forEach(d => {
                    imageSources[`dentadura-inf-${d}`] = `/odontograma/img/dentadura-inf-${d}.png`;
                });
                
                const promises = Object.entries(imageSources).map(([name, src]) =>
                    loadImage(src).then(img => ({ name, img })).catch(error => {
                        console.warn(error.message); // Log missing images as warnings
                        return null; // Return null for failed images
                    })
                );
                
                const results = await Promise.all(promises);

                results.forEach(result => {
                    if (result) { // Only add successfully loaded images
                        this.images[result.name] = result.img;
                    }
                });
            }

            start() {
                if (this.interval) clearInterval(this.interval);
                this.interval = setInterval(() => this.draw(), 1000 / 30);
            }

            draw() {
                if (!this.context || !this.canvas) return;
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

                this.drawOdontograma();
                this.drawPaleta();
                this.drawInfo();
            }

            drawOdontograma() {
                if (!this.context || !this.images.odontograma) return;
                this.context.drawImage(this.images.odontograma, 0, 0);

                this.properties.dientes.forEach((diente: any) => {
                    if (this.images[diente.img]) {
                        this.context!.drawImage(this.images[diente.img], diente.x, diente.y);
                    }
                });
            }

            drawPaleta() {
                if (!this.context || !this.images.paleta) return;
                this.context.drawImage(this.images.paleta, this.properties.paleta.x, this.properties.paleta.y);
            }

            drawInfo() {
                 if (!this.context || !this.properties.paciente) return;
                const { paciente, clinica, ficha, hc, fecha, doctor } = this.properties.paciente;
                
                this.context.fillStyle = "rgb(1, 1, 1)";
                this.context.font = "12px courier";

                if (paciente) this.context.fillText(paciente, 160, 52);
                if (clinica) this.context.fillText(clinica, 160, 32);
                if (ficha) this.context.fillText(ficha, 442, 32);
                if (hc) this.context.fillText(hc, 442, 52);
                if (fecha) this.context.fillText(fecha, 630, 32);
                if (doctor) this.context.fillText(doctor, 630, 52);
            }

            loadDientes() {
                this.properties.dientes = [];
                let x = 32;
                let y = 100;
                const x_start = 32;
                const x_offset = 49;

                const addDiente = (id: number, tipo: string) => {
                    const region = id < 30 ? 'sup' : 'inf';
                    this.properties.dientes.push({ id, img: `dentadura-${region}-${id}`, x, y, tipo, partes: this.getPartes(tipo) });
                    x += x_offset;
                };

                // SUPERIOR DERECHA
                addDiente(18, "M");
                addDiente(17, "M");
                addDiente(16, "M");
                addDiente(15, "P");
                addDiente(14, "P");
                addDiente(13, "C");
                addDiente(12, "I");
                addDiente(11, "I");
                
                // SUPERIOR IZQUIERDA
                addDiente(21, "I");
                addDiente(22, "I");
                addDiente(23, "C");
                addDiente(24, "P");
                addDiente(25, "P");
                addDiente(26, "M");
                addDiente(27, "M");
                addDiente(28, "M");
                
                x = x_start;
                y = 230;

                // INFERIOR DERECHA
                addDiente(48, "M");
                addDiente(47, "M");
                addDiente(46, "M");
                addDiente(45, "P");
                addDiente(44, "P");
                addDiente(43, "C");
                addDiente(42, "I");
                addDiente(41, "I");
                
                // INFERIOR IZQUIERDA
                addDiente(31, "I");
                addDiente(32, "I");
                addDiente(33, "C");
                addDiente(34, "P");
                addDiente(35, "P");
                addDiente(36, "M");
                addDiente(37, "M");
                addDiente(38, "M");

                // Posición de la paleta
                this.properties.paleta = { x: 32, y: 390 };
            }

            getPartes(tipo: string) {
                const partes: any = {};
                if (tipo === "M" || tipo === "P") { // Molar o Premolar
                    partes['O'] = [{ x: 13, y: 21 }, { x: 36, y: 21 }, { x: 36, y: 44 }, { x: 13, y: 44 }];
                    partes['V'] = [{ x: 0, y: 0 }, { x: 49, y: 0 }, { x: 36, y: 21 }, { x: 13, y: 21 }];
                    partes['L'] = [{ x: 13, y: 44 }, { x: 36, y: 44 }, { x: 49, y: 65 }, { x: 0, y: 65 }];
                    partes['D'] = [{ x: 36, y: 21 }, { x: 49, y: 0 }, { x: 49, y: 65 }, { x: 36, y: 44 }];
                    partes['M'] = [{ x: 0, y: 0 }, { x: 13, y: 21 }, { x: 13, y: 44 }, { x: 0, y: 65 }];
                } else if (tipo === "I" || tipo === "C") { // Incisivo o Canino
                    partes['O'] = [{ x: 0, y: 0 }, { x: 49, y: 0 }, { x: 49, y: 20 }, { x: 0, y: 20 }];
                    partes['V'] = [{ x: 0, y: 20 }, { x: 49, y: 20 }, { x: 49, y: 45 }, { x: 0, y: 45 }];
                    partes['L'] = [{ x: 0, y: 45 }, { x: 49, y: 45 }, { x: 49, y: 65 }, { x: 0, y: 65 }];
                }
                return partes;
            }

            stop() {
                clearInterval(this.interval);
            }
        }
        
        let cleanup: (() => void) | null = null;
        
        const initEngine = async () => {
             if (canvasRef.current && !engineRef.current) {
                console.log("Odontogram component mounted, initializing engine...");
                const engine = new Engine();
                engineRef.current = engine;
                engine.setCanvas(canvasRef.current);
                try {
                    cleanup = await engine.init();
                    console.log("Engine initialized, starting draw loop.");
                    alert("Odontogram viewer has been initialized and should be visible.");
                } catch (error) {
                    console.error("Failed to initialize engine:", error);
                }
            }
        };

        initEngine();

        return () => {
            console.log("Unmounting odontogram component, stopping engine.");
            if (cleanup) {
                cleanup();
            }
            if(engineRef.current) {
                engineRef.current.stop();
                engineRef.current = null;
            }
        };
    }, []);

    return (
        <div id="visor">
            <canvas ref={canvasRef} id="canvas" width="820" height="600" style={{ border: '1px solid #000' }}>
                El Navegador que estás utilizando no puede mostrar el Odontograma.
            </canvas>
        </div>
    );
};

export default OdontogramComponent;
