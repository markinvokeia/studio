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
        // Initialization logic that was in init()
        this.tipo_odontograma = 1;
        this.parts = [];
        this.adult_dientes_up = [];
        this.adult_dientes_down = [];
        this.child_dientes_up = [];
        this.child_dientes_down = [];

        this.loadImages();
        this.loadParts();
        this.loadDientes();

        this.data_paciente = [];
        for (var i = 1; i < 53; i++) {
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
    
    start() {
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
        this.context.fillStyle = '#f0f0f0';
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

    loadImages() {
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
        }
        var path = '/odontograma/img/';
        for (var i = 1; i < 6; i++) {
            this.properties.images.numeros[i] = new Image();
            this.properties.images.numeros[i].src = path + 'numero_' + i + '.png';
        }
        for (var i = 1; i < 9; i++) {
            this.properties.images.dientes[i] = new Image();
            this.properties.images.dientes[i].src = path + 'adult_diente_' + i + '.png';
        }
        for (var i = 1; i < 6; i++) {
            this.properties.images.dientes[i + 10] = new Image();
            this.properties.images.dientes[i + 10].src = path + 'child_diente_' + i + '.png';
        }
        this.properties.images.marcas[1] = new Image(); //ausente
        this.properties.images.marcas[1].src = path + 'marca_1.png';
        this.properties.images.marcas[2] = new Image(); //extraer
        this.properties.images.marcas[2].src = path + 'marca_2.png';
        this.properties.images.marcas[3] = new Image(); //corona
        this.properties.images.marcas[3].src = path + 'marca_3.png';
    }

    loadDientes() {
        class Diente {
            id: any;
            x: any;
            y: any;
            parts: any;
            image_diente: any;
            image_numero: any;

            constructor(id: any, x: any, y: any, parts: any, image_diente: any, image_numero: any) {
                this.id = id;
                this.x = x;
                this.y = y;
                this.parts = parts; // Polygon parts for hit detection
                this.image_diente = image_diente;
                this.image_numero = image_numero;
            }

            draw(ctx: { drawImage: (arg0: any, arg1: any, arg2: any) => void; lineWidth: number; strokeStyle: string; fillStyle: any; beginPath: () => void; moveTo: (arg0: any, arg1: any) => void; lineTo: (arg0: any, arg1: any) => void; closePath: () => void; fill: () => void; stroke: () => void; strokeRect: (arg0: any, arg1: any, arg2: any, arg3: any) => void; }, diente_sel: number, parte_sel: number, data: { [x: string]: { [x: string]: any; }; }) {
                if (this.image_diente) {
                   try {
                        ctx.drawImage(this.image_diente, this.x, this.y);
                   } catch (e) {
                       // Image might not be loaded yet, ignore for now
                   }
                }
                
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'black';
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

                if (diente_sel == this.id) {
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#FF0000'; // Red selection
                    if (parte_sel > 0) {
                         const part = this.parts[parte_sel-1];
                         ctx.beginPath();
                         ctx.moveTo(part[0][0] + this.x, part[0][1] + this.y);
                         for(var j=1; j<part.length; j++){
                            ctx.lineTo(part[j][0] + this.x, part[j][1] + this.y);
                         }
                         ctx.closePath();
                         ctx.stroke();
                    } else {
                        ctx.strokeRect(this.x, this.y, this.image_diente.width, this.image_diente.height);
                    }
                }
            }

             isClicked(x: number, y: number) {
                if (x > this.x && x < this.x + this.image_diente.width && y > this.y && y < this.y + this.image_diente.height) {
                    for (var i = 0; i < this.parts.length; i++) {
                        if (isPointInPoly(this.parts[i], x - this.x, y - this.y)) {
                            return {
                                "diente": this.id,
                                "parte": i + 1
                            };
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
        
        for (var i = 0; i < 8; i++) {
            var diente_info = this.parts[8 - (i + 1)];
            var diente_img = this.properties.images.dientes[8 - i];
            this.adult_dientes_up[i] = new Diente(18 - i, x_off - diente_img.width, y_off, diente_info, diente_img, this.properties.images.numeros[1]);
            x_off -= (diente_img.width + separacion);
        }
        x_off = 325;
        for (var i = 0; i < 8; i++) {
            var diente_info = this.parts[i];
            var diente_img = this.properties.images.dientes[i + 1];
            this.adult_dientes_up[i + 8] = new Diente(21 + i, x_off, y_off, diente_info, diente_img, this.properties.images.numeros[2]);
            x_off += (diente_img.width + separacion);
        }

        x_off = 325;
        y_off = 430;
        for (var i = 0; i < 8; i++) {
            var diente_info = this.parts[i + 8];
            var diente_img = this.properties.images.dientes[i + 1];
            this.adult_dientes_down[i] = new Diente(31 + i, x_off, y_off, diente_info, diente_img, this.properties.images.numeros[3]);
            x_off += (diente_img.width + separacion);
        }
        x_off = 325;
        for (var i = 0; i < 8; i++) {
            var diente_info = this.parts[15 - i];
            var diente_img = this.properties.images.dientes[8 - i];
            this.adult_dientes_down[i + 8] = new Diente(48 - i, x_off - diente_img.width, y_off, diente_info, diente_img, this.properties.images.numeros[4]);
            x_off -= (diente_img.width + separacion);
        }
    }

    loadParts() {
        this.parts[0] = new Array(Array(3, 10), Array(13, 12), Array(13, 21), Array(3, 22)); //vestibular
        this.parts[1] = new Array(Array(15, 12), Array(25, 10), Array(25, 22), Array(15, 21)); //distal
        this.parts[2] = new Array(Array(3, 24), Array(13, 23), Array(13, 31), Array(3, 32)); //palatino
        this.parts[3] = new Array(Array(3, 10), Array(13, 12), Array(13, 21), Array(3, 22)); //mesial..
        this.parts[4] = new Array(Array(5, 14), Array(12, 13), Array(12, 22), Array(5, 21)); //oclusal..
        for(let i=5; i<53*5; i++) { // Mocking the rest
            this.parts[i] = this.parts[0];
        }
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
                result = collection[j][i].isClicked(x, y);
                if (result) break;
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
        
        this.draw();
    }

    onMouseMove(event: MouseEvent) {}
    onButtonClick(event: KeyboardEvent) {}
}

function isPointInPoly(poly: string | any[], x: number, y: number) {
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
        if (canvasRef.current && !engineRef.current) {
            const engine = new Engine();
            engine.setCanvas(canvasRef.current);
            const cleanup = engine.start();

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

            engineRef.current = engine;

            const canvas = canvasRef.current;
            const handleClick = (event: MouseEvent) => engine.onMouseClick(event);
            const handleMouseMove = (event: MouseEvent) => engine.onMouseMove(event);
            const handleKeyDown = (event: KeyboardEvent) => engine.onButtonClick(event);

            canvas.addEventListener('mousedown', handleClick);
            canvas.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('keydown', handleKeyDown);

            return () => {
                cleanup();
                canvas.removeEventListener('mousedown', handleClick);
                canvas.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, []);

    return (
        <div className="flex justify-center items-center bg-gray-100 p-4">
           <canvas ref={canvasRef} width="648" height="800" className="bg-white shadow-lg"></canvas>
        </div>
    );
};
