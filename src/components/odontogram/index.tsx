
'use client';

import React, { useRef, useEffect } from 'react';

// This component is a wrapper for the vanilla JS odontogram engine.
// It ensures the canvas is ready before the engine tries to use it.

const OdontogramComponent = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        // The Engine class and all its logic are defined inside this useEffect
        // to keep it self-contained and avoid polluting the global scope.

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
                await this.loadImages();
                this.loadPatientData("Clínica Dental Sonrisas", "Juan Pérez", "12345", "789", "2024-05-21", "Dr. Smith", "Paciente presenta sensibilidad en el cuadrante superior derecho.", "");
                this.start();
            }
            
            loadPatientData(p_clinica: any, p_paciente: any, p_ficha: any, p_hc: any, p_fecha: any, p_doctor: any, p_observaciones: any, p_especificaciones: any) {
                if(!this.properties.paciente) this.properties.paciente = {};
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

                try {
                    const imageSources = [
                        'odontograma', 'paleta', 'odontograma_over', 'paleta_over',
                        'p_a', 'p_b', 'p_c', 'p_d', 'p_e', 'p_f', 'p_g', 'p_h', 'p_i', 'p_j',
                        'p_k', 'p_l', 'p_m', 'p_n', 'p_o', 'p_p', 'p_q', 'p_r', 'p_s',
                        'p_t', 'p_u', 'p_v', 'p_w', 'p_x', 'p_y', 'p_z', 'p_0', 'p_1',
                        'p_2', 'p_3', 'p_4', 'p_5', 'p_6', 'p_7'
                    ];

                    const dienteSources: string[] = [];
                    const sup = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
                    const inf = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

                    sup.forEach(d => dienteSources.push(`dentadura-sup-${d}`));
                    inf.forEach(d => dienteSources.push(`dentadura-inf-${d}`));

                    const allSources = [...imageSources, ...dienteSources];

                    const promises = allSources.map(name =>
                        loadImage(`/odontograma/img/${name}.png`).then(img => ({ name, img }))
                    );
                    
                    const results = await Promise.all(promises);

                    results.forEach(result => {
                        this.images[result.name] = result.img;
                    });

                } catch (error) {
                    console.error("Error loading images:", error);
                    // Stop further execution if images fail to load.
                    throw error;
                }
            }


            start() {
                this.loadDientes();
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

                // Dibujar dientes
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

                this.context.fillText(paciente, 160, 52);
                this.context.fillText(clinica, 160, 32);
                this.context.fillText(ficha, 442, 32);
                this.context.fillText(hc, 442, 52);
                this.context.fillText(fecha, 630, 32);
                this.context.fillText(doctor, 630, 52);
            }


            loadDientes() {
                this.properties.dientes = [];
                let x = 32;
                let y = 100;

                const addDiente = (id: number, img: string, tipo: string) => {
                    this.properties.dientes.push({ id, img, x, y, tipo, partes: this.getPartes(tipo) });
                    x += 49;
                };

                // SUPERIOR DERECHA
                addDiente(18, 'dentadura-sup-18', "M");
                addDiente(17, 'dentadura-sup-17', "M");
                addDiente(16, 'dentadura-sup-16', "M");
                addDiente(15, 'dentadura-sup-15', "P");
                addDiente(14, 'dentadura-sup-14', "P");
                addDiente(13, 'dentadura-sup-13', "C");
                addDiente(12, 'dentadura-sup-12', "I");
                addDiente(11, 'dentadura-sup-11', "I");
                
                // SUPERIOR IZQUIERDA
                addDiente(21, 'dentadura-sup-21', "I");
                addDiente(22, 'dentadura-sup-22', "I");
                addDiente(23, 'dentadura-sup-23', "C");
                addDiente(24, 'dentadura-sup-24', "P");
                addDiente(25, 'dentadura-sup-25', "P");
                addDiente(26, 'dentadura-sup-26', "M");
                addDiente(27, 'dentadura-sup-27', "M");
                addDiente(28, 'dentadura-sup-28', "M");
                
                x = 32;
                y = 230;

                // INFERIOR DERECHA
                addDiente(48, 'dentadura-inf-48', "M");
                addDiente(47, 'dentadura-inf-47', "M");
                addDiente(46, 'dentadura-inf-46', "M");
                addDiente(45, 'dentadura-inf-45', "P");
                addDiente(44, 'dentadura-inf-44', "P");
                addDiente(43, 'dentadura-inf-43', "C");
                addDiente(42, 'dentadura-inf-42', "I");
                addDiente(41, 'dentadura-inf-41', "I");
                
                // INFERIOR IZQUIERDA
                addDiente(31, 'dentadura-inf-31', "I");
                addDiente(32, 'dentadura-inf-32', "I");
                addDiente(33, 'dentadura-inf-33', "C");
                addDiente(34, 'dentadura-inf-34', "P");
                addDiente(35, 'dentadura-inf-35', "P");
                addDiente(36, 'dentadura-inf-36', "M");
                addDiente(37, 'dentadura-inf-37', "M");
                addDiente(38, 'dentadura-inf-38', "M");

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
        
        console.log("Odontogram component mounted, initializing engine...");

        if (canvasRef.current) {
            const engine = new Engine();
            engine.setCanvas(canvasRef.current);
            engine.init().then(() => {
                console.log("Engine initialized and drawing started.");
                alert("Odontogram viewer has been initialized and should be visible.");
            }).catch(error => {
                console.error("Engine failed to initialize:", error);
                alert(`Error initializing odontogram: ${error.message}`);
            });
            
            // Cleanup function to stop the interval when the component unmounts.
            return () => {
                console.log("Unmounting odontogram component, stopping engine.");
                engine.stop();
            };
        }
    }, []); // Empty dependency array ensures this effect runs only once.

    return (
        <div id="visor">
            <canvas ref={canvasRef} id="canvas" width="820" height="600" style={{ border: '1px solid #000' }}>
                El Navegador que estás utilizando no puede mostrar el Odontograma.
            </canvas>
        </div>
    );
};

export default OdontogramComponent;

    