
'use client';
import React, { useEffect, useRef } from 'react';

// All the code from engine.js is now part of this component.
// I have adapted it to work within the React/Next.js environment.
class Engine {
    canvas: HTMLCanvasElement | null = null;
    context: CanvasRenderingContext2D | null = null;
    canvas_width: number = 0;
    canvas_height: number = 0;

    diente_seleccionado = 0;
    parte_seleccionada = 0;

    color_seleccionado = "#FF8080"; // Default to caries color

    parts: any[][] = [];
    properties: any = {};

    adult_dientes_up: any[] = [];
    adult_dientes_down: any[] = [];
    child_dientes_up: any[] = [];
    child_dientes_down: any[] = [];

    tipo_odontograma: number = 1; // 1=adult, 2=child

    data_paciente: any = [];

    constructor() {
        this.tipo_odontograma = 1;
        this.parts = [];
        this.adult_dientes_up = [];
        this.adult_dientes_down = [];
        this.child_dientes_up = [];
        this.child_dientes_down = [];

        this.data_paciente = [];
        for (var i = 1; i < 86; i++) {
            this.data_paciente[i] = [];
            this.data_paciente[i]['completo'] = "#80FFFF";
            for (var j = 1; j < 7; j++) {
                this.data_paciente[i][j] = "#80FFFF";
            }
        }
    }

    setCanvas(canvas_object: HTMLCanvasElement) {
        this.canvas = canvas_object;
        this.context = this.canvas.getContext('2d');
        if (this.context) {
            this.canvas_width = this.canvas.width;
            this.canvas_height = this.canvas.height;
        }
    }
    
    async start() {
        await this.loadImages();
        this.loadParts();
        this.loadDientes();
        const intervalId = setInterval(() => this.draw(), 100);
        return () => clearInterval(intervalId);
    }

    loadPatientData(p_clinica: any, p_paciente: any, p_ficha: any, p_hc: any, p_fecha: any, p_doctor: any, p_observaciones: any, p_especificaciones: any) {
        this.properties.paciente.clinica = p_clinica;
        this.properties.paciente.paciente = p_paciente;
        this.properties.paciente.ficha = p_ficha;
        this.properties.paciente.hc = p_hc;
        this.properties.paciente.fecha = p_fecha;
        this.properties.paciente.doctor = p_doctor;
        this.properties.paciente.observaciones = p_observaciones;
        this.properties.paciente.especificaciones = p_especificaciones;
    }

    draw() {
        if (!this.context) return;
        this.context.clearRect(0, 0, this.canvas_width, this.canvas_height);
        this.context.fillStyle = '#ffffff';
        this.context.fillRect(0, 0, this.canvas_width, this.canvas_height);

        if (this.tipo_odontograma == 1) { // Adult
            for (var i = 0; i < 16; i++) {
                this.adult_dientes_up[i]?.draw(this.context, this.diente_seleccionado, this.parte_seleccionada, this.data_paciente);
                this.adult_dientes_down[i]?.draw(this.context, this.diente_seleccionado, this.parte_seleccionada, this.data_paciente);
            }
        } else { // Child
             for (var i = 0; i < 10; i++) {
                this.child_dientes_up[i]?.draw(this.context, this.diente_seleccionado, this.parte_seleccionada, this.data_paciente);
                this.child_dientes_down[i]?.draw(this.context, this.diente_seleccionado, this.parte_seleccionada, this.data_paciente);
            }
        }
        this.drawPaleta();
        this.drawInfo();
    }

    async loadImages() {
        this.properties = {
            'images': {
                'numeros': new Array(),
                'dientes': new Array(),
                'marcas': new Array()
            },
            'paciente': {
                'clinica': 'Default Clinic',
                'paciente': 'Default Patient',
                'ficha': '001',
                'hc': 'HC001',
                'fecha': new Date().toLocaleDateString(),
                'doctor': 'Dr. House',
                'observaciones': 'No observations',
                'especificaciones': 'No specifications'
            }
        };

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (e) => reject(new Error(`Failed to load image: ${src}. Error: ${e}`));
                img.src = src;
            });
        };

        const path = '/odontograma/';
        const imagePromises: Promise<any>[] = [];
        
        const adult_teeth_sup = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
        const adult_teeth_inf = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
        const child_teeth_sup = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
        const child_teeth_inf = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

        for (const toothNum of adult_teeth_sup) {
            imagePromises.push(loadImage(`${path}dentadura-sup-${toothNum}.png`).then(img => this.properties.images.dientes[toothNum] = img));
        }
        for (const toothNum of adult_teeth_inf) {
             imagePromises.push(loadImage(`${path}dentadura-inf-${toothNum}.png`).then(img => this.properties.images.dientes[toothNum] = img));
        }
        for (const toothNum of child_teeth_sup) {
             imagePromises.push(loadImage(`${path}dentadura-sup-${toothNum}.png`).then(img => this.properties.images.dientes[toothNum] = img));
        }
        for (const toothNum of child_teeth_inf) {
             imagePromises.push(loadImage(`${path}dentadura-inf-${toothNum}.png`).then(img => this.properties.images.dientes[toothNum] = img));
        }

        await Promise.all(imagePromises);
    }

    loadDientes() {
        class Diente {
            id: any;
            x: any;
            y: any;
            parts: any;
            image_diente: any;

            constructor(id: any, x: any, y: any, parts: any, image_diente: any) {
                this.id = id;
                this.x = x;
                this.y = y;
                this.parts = parts; // Polygon parts for hit detection
                this.image_diente = image_diente;
            }

            draw(ctx: { drawImage: (arg0: any, arg1: any, arg2: any) => void; lineWidth: number; strokeStyle: string; fillStyle: any; beginPath: () => void; moveTo: (arg0: any, arg1: any) => void; lineTo: (arg0: any, arg1: any) => void; closePath: () => void; fill: () => void; stroke: () => void; strokeRect: (arg0: any, arg1: any, arg2: number, arg3: number) => void; }, diente_sel: number, parte_sel: number, data: { [x: string]: { [x: string]: any; }; }) {
                if (this.image_diente) {
                   try {
                        ctx.drawImage(this.image_diente, this.x, this.y);
                   } catch (e) {
                       console.error("Error drawing tooth image:", e);
                   }
                }
                
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'black';
                if(this.parts) {
                    for (var i = 0; i < this.parts.length; i++) {
                        ctx.fillStyle = data[this.id][i+1];
                        ctx.beginPath();
                        ctx.moveTo(this.parts[i][0][0] + this.x, this.parts[i][0][1] + this.y);
                        for(var j=1; j<this.parts[i].length; j++){
                            ctx.lineTo(this.parts[i][j][0] + this.x, this.parts[i][j][1] + this.y);
                        }
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    }
                }

                if (diente_sel == this.id) {
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#FF0000'; // Red selection
                    if (parte_sel > 0 && this.parts) {
                         const part = this.parts[parte_sel-1];
                         ctx.beginPath();
                         ctx.moveTo(part[0][0] + this.x, part[0][1] + this.y);
                         for(var j=1; j<part.length; j++){
                            ctx.lineTo(part[j][0] + this.x, part[j][1] + this.y);
                         }
                         ctx.closePath();
                         ctx.stroke();
                    } else if (this.image_diente) {
                        ctx.strokeRect(this.x, this.y, this.image_diente.width, this.image_diente.height);
                    }
                }
            }

             isClicked(x: number, y: number) {
                if (this.image_diente && x > this.x && x < this.x + this.image_diente.width && y > this.y && y < this.y + this.image_diente.height) {
                    if(this.parts) {
                        for (var i = 0; i < this.parts.length; i++) {
                            if (isPointInPoly(this.parts[i], x - this.x, y - this.y)) {
                                return {
                                    "diente": this.id,
                                    "parte": i + 1
                                };
                            }
                        }
                    }
                    return {
                        "diente": this.id,
                        "parte": 0
                    };
                }
                return false;
            }
        }
        
        var x_off = 325;
        var y_off = 170;
        var separacion = 4;

        const adult_teeth_sup_right = [18, 17, 16, 15, 14, 13, 12, 11];
        const adult_teeth_sup_left = [21, 22, 23, 24, 25, 26, 27, 28];
        const adult_teeth_inf_left = [31, 32, 33, 34, 35, 36, 37, 38];
        const adult_teeth_inf_right = [41, 42, 43, 44, 45, 46, 47, 48];
        
        for (var i = 0; i < adult_teeth_sup_right.length; i++) {
            const toothNum = adult_teeth_sup_right[i];
            var diente_info = this.parts[18 - toothNum] || this.parts[0];
            var diente_img = this.properties.images.dientes[toothNum];
            if(diente_img) {
                this.adult_dientes_up[i] = new Diente(toothNum, x_off - diente_img.width, y_off, diente_info, diente_img);
                x_off -= (diente_img.width + separacion);
            }
        }
        x_off = 325;
        for (var i = 0; i < adult_teeth_sup_left.length; i++) {
            const toothNum = adult_teeth_sup_left[i];
            var diente_info = this.parts[toothNum - 21] || this.parts[0];
            var diente_img = this.properties.images.dientes[toothNum];
            if(diente_img) {
                this.adult_dientes_up[i + 8] = new Diente(toothNum, x_off, y_off, diente_info, diente_img);
                x_off += (diente_img.width + separacion);
            }
        }

        x_off = 325;
        y_off = 430;
        for (var i = 0; i < adult_teeth_inf_left.length; i++) {
            const toothNum = adult_teeth_inf_left[i];
            var diente_info = this.parts[toothNum - 31 + 8] || this.parts[0];
            var diente_img = this.properties.images.dientes[toothNum];
            if(diente_img) {
                this.adult_dientes_down[i] = new Diente(toothNum, x_off, y_off, diente_info, diente_img);
                x_off += (diente_img.width + separacion);
            }
        }

        x_off = 325;
        const adult_teeth_inf_right_rev = [...adult_teeth_inf_right].reverse();
         for (var i = 0; i < adult_teeth_inf_right_rev.length; i++) {
            const toothNum = adult_teeth_inf_right_rev[i];
            var diente_info = this.parts[48 - toothNum + 8] || this.parts[0];
            var diente_img = this.properties.images.dientes[toothNum];
             if(diente_img) {
                this.adult_dientes_down[i + 8] = new Diente(toothNum, x_off - diente_img.width, y_off, diente_info, diente_img);
                x_off -= (diente_img.width + separacion);
             }
        }
    }

    loadParts() {
        this.parts = [
            // Central superior
            [ [[2,9],[12,11],[12,20],[2,21]], [[14,11],[24,9],[24,21],[14,20]], [[2,23],[12,22],[12,30],[2,31]], [[2,9],[12,11],[12,20],[2,21]], [[4,13],[12,12],[12,21],[4,20]] ],
            // Lateral superior
            [ [[3,10],[11,12],[11,20],[3,21]], [[13,12],[21,10],[21,21],[13,20]], [[3,23],[11,22],[11,30],[3,30]], [[3,10],[11,12],[11,20],[3,21]], [[5,13],[11,12],[11,21],[5,20]] ],
            // Canino superior
            [ [[2,10],[12,12],[12,20],[2,22]], [[14,12],[24,10],[24,22],[14,20]], [[2,24],[12,22],[12,32],[2,32]], [[2,10],[12,12],[12,20],[2,22]], [[4,13],[12,12],[12,21],[4,20]] ],
            // 1er premolar superior
            [ [[3,11],[12,12],[12,19],[3,20]], [[14,12],[23,11],[23,20],[14,19]], [[3,22],[12,21],[12,29],[3,28]], [[3,11],[12,12],[12,19],[3,20]], [[5,14],[12,13],[12,20],[5,19]] ],
            // 2do premolar superior
            [ [[3,11],[12,12],[12,19],[3,20]], [[14,12],[23,11],[23,20],[14,19]], [[3,22],[12,21],[12,29],[3,28]], [[3,11],[12,12],[12,19],[3,20]], [[5,14],[12,13],[12,20],[5,19]] ],
            // 1er molar superior
            [ [[4,10],[14,11],[14,19],[4,20]], [[16,11],[28,10],[28,20],[16,19]], [[4,22],[14,21],[14,29],[4,28]], [[4,10],[14,11],[14,19],[4,20]], [[6,13],[14,12],[14,20],[6,19]] ],
            // 2do molar superior
            [ [[4,10],[14,11],[14,19],[4,20]], [[16,11],[28,10],[28,20],[16,19]], [[4,22],[14,21],[14,29],[4,28]], [[4,10],[14,11],[14,19],[4,20]], [[6,13],[14,12],[14,20],[6,19]] ],
            // 3er molar superior
            [ [[4,10],[14,11],[14,19],[4,20]], [[16,11],[28,10],[28,20],[16,19]], [[4,22],[14,21],[14,29],[4,28]], [[4,10],[14,11],[14,19],[4,20]], [[6,13],[14,12],[14,20],[6,19]] ],
            // Central inferior
            [ [[3,11],[13,10],[13,22],[3,24]], [[15,10],[25,11],[25,24],[15,22]], [[3,26],[13,25],[13,32],[3,32]], [[3,11],[13,10],[13,22],[3,24]], [[5,12],[13,11],[13,23],[5,24]] ],
            // Lateral inferior
            [ [[3,11],[13,10],[13,22],[3,24]], [[15,10],[25,11],[25,24],[15,22]], [[3,26],[13,25],[13,32],[3,32]], [[3,11],[13,10],[13,22],[3,24]], [[5,12],[13,11],[13,23],[5,24]] ],
            // Canino inferior
            [ [[3,11],[13,10],[13,22],[3,24]], [[15,10],[25,11],[25,24],[15,22]], [[3,26],[13,25],[13,32],[3,32]], [[3,11],[13,10],[13,22],[3,24]], [[5,12],[13,11],[13,23],[5,24]] ],
            // 1er premolar inferior
            [ [[4,11],[14,10],[14,20],[4,21]], [[16,10],[26,11],[26,21],[16,20]], [[4,23],[14,22],[14,30],[4,30]], [[4,11],[14,10],[14,20],[4,21]], [[6,12],[14,11],[14,21],[6,20]] ],
            // 2do premolar inferior
            [ [[4,11],[14,10],[14,20],[4,21]], [[16,10],[26,11],[26,21],[16,20]], [[4,23],[14,22],[14,30],[4,30]], [[4,11],[14,10],[14,20],[4,21]], [[6,12],[14,11],[14,21],[6,20]] ],
            // 1er molar inferior
            [ [[5,10],[15,10],[15,20],[5,20]], [[17,10],[29,10],[29,20],[17,20]], [[5,22],[15,22],[15,30],[5,30]], [[5,10],[15,10],[15,20],[5,20]], [[7,12],[15,12],[15,20],[7,20]] ],
            // 2do molar inferior
            [ [[5,10],[15,10],[15,20],[5,20]], [[17,10],[29,10],[29,20],[17,20]], [[5,22],[15,22],[15,30],[5,30]], [[5,10],[15,10],[15,20],[5,20]], [[7,12],[15,12],[15,20],[7,20]] ],
            // 3er molar inferior
            [ [[5,10],[15,10],[15,20],[5,20]], [[17,10],[29,10],[29,20],[17,20]], [[5,22],[15,22],[15,30],[5,30]], [[5,10],[15,10],[15,20],[5,20]], [[7,12],[15,12],[15,20],[7,20]] ],
        ];
    }

    drawPaleta() {
        if (!this.context) return;
        this.context.font = '12px Arial';
        this.context.fillStyle = 'black';
        this.context.fillText('Palette', 10, 20);
        
        const colors = ["#80FFFF", "#FF8080", "#FFFF80", "#80FF80", "#FF80FF", "#000000"];
        const labels = ["Healthy", "Caries", "Restoration", "Endodontics", "Extraction", "Absent"];

        for (var i = 0; i < colors.length; i++) {
            this.context.fillStyle = colors[i];
            this.context.fillRect(10, 30 + i * 25, 20, 20);
            this.context.strokeStyle = "black";
            this.context.strokeRect(10, 30 + i * 25, 20, 20);
            this.context.fillStyle = 'black';
            this.context.fillText(labels[i], 40, 45 + i * 25);
        }
    }

    drawInfo() {
        if (!this.context) return;
        this.context.font = '14px Arial';
        this.context.fillStyle = 'black';
        this.context.fillText('Patient Info', 450, 20);
        this.context.font = '12px Arial';
        this.context.fillText(`Clinic: ${this.properties.paciente.clinica}`, 450, 40);
        this.context.fillText(`Patient: ${this.properties.paciente.paciente}`, 450, 60);
        this.context.fillText(`Record: ${this.properties.paciente.ficha}`, 450, 80);
    }
    
    onMouseClick(event: MouseEvent) {
        if (!this.canvas) return;
        var x = event.pageX - this.canvas.offsetLeft;
        var y = event.pageY - this.canvas.offsetTop;
        var result: any = false;

        var collection = (this.tipo_odontograma == 1) ? [this.adult_dientes_up, this.adult_dientes_down] : [this.child_dientes_up, this.child_dientes_down];

        for (var j = 0; j < collection.length; j++) {
            for (var i = 0; i < collection[j].length; i++) {
                if(collection[j][i]) {
                    result = collection[j][i].isClicked(x, y);
                    if (result) break;
                }
            }
            if (result) break;
        }
        
        if (result) {
            this.diente_seleccionado = result.diente;
            this.parte_seleccionada = result.parte;
            
            if(this.parte_seleccionada > 0){
                this.data_paciente[this.diente_seleccionado][this.parte_seleccionada] = this.color_seleccionado;
            } else {
                 this.data_paciente[this.diente_seleccionado]['completo'] = this.color_seleccionado;
                 for(var i=1; i<7; i++){
                    this.data_paciente[this.diente_seleccionado][i] = this.color_seleccionado;
                 }
            }
        } else {
            if (x > 10 && x < 30) {
                 const colors = ["#80FFFF", "#FF8080", "#FFFF80", "#80FF80", "#FF80FF", "#000000"];
                 for (let i = 0; i < colors.length; i++) {
                     if(y > 30 + i * 25 && y < 50 + i * 25) {
                         this.color_seleccionado = colors[i];
                         break;
                     }
                 }
            }
        }
    }

    onMouseMove(event: MouseEvent) {}
    onButtonClick(event: KeyboardEvent) {}
}

function isPointInPoly(poly: string | any[], x: number, y: number) {
    if(!poly) return false;
    var i, j, c = false;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (((poly[i][1] > y) != (poly[j][1] > y)) && (x < (poly[j][0] - poly[i][0]) * (y - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) {
            c = !c;
        }
    }
    return c;
}

export const OdontogramComponent = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        
        const initEngine = async () => {
            if (canvasRef.current && !engineRef.current) {
                const engine = new Engine();
                engineRef.current = engine;
                engine.setCanvas(canvasRef.current);
                
                try {
                    cleanup = await engine.start();

                    engine.loadPatientData(
                        "InvokeAI Clinic",
                        "Leon Macho",
                        "1002",
                        "hc 001",
                        "26/02/2018",
                        "Dr. Gemini",
                        "Initial consultation. Patient reports sensitivity in upper right quadrant.",
                        "Requires crown on tooth 16."
                    );
    
                    const canvas = canvasRef.current;
                    if(!canvas) return;

                    const handleClick = (event: MouseEvent) => engine.onMouseClick(event);
                    const handleMouseMove = (event: MouseEvent) => engine.onMouseMove(event);
                    const handleKeyDown = (event: KeyboardEvent) => engine.onButtonClick(event);
    
                    canvas.addEventListener('mousedown', handleClick);
                    canvas.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('keydown', handleKeyDown);
    
                    return () => {
                        if (cleanup) cleanup();
                        if (canvas) {
                            canvas.removeEventListener('mousedown', handleClick);
                            canvas.removeEventListener('mousemove', handleMouseMove);
                        }
                        window.removeEventListener('keydown', handleKeyDown);
                    };
                } catch (error) {
                    console.error("Failed to initialize odontogram engine:", error);
                }
            }
        };

        const cleanupPromise = initEngine();

        return () => {
            cleanupPromise.then(cleanupFunc => {
                if (cleanupFunc) {
                    cleanupFunc();
                }
            });
        };
    }, []);

    return (
        <div className="flex justify-center items-center bg-gray-100 p-4">
           <canvas ref={canvasRef} width="648" height="800" className="bg-white shadow-lg"></canvas>
        </div>
    );
};

    