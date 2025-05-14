import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-sketch',
  templateUrl: './edit-sketch.component.html',
  standalone: true,
  styleUrls: ['./edit-sketch.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class EditSketchComponent implements AfterViewInit {
  @ViewChild('sketchCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hueStrip') hueStripRef!: ElementRef<HTMLDivElement>;

  width: number = 50;
  height: number = 50;
  selectedColor: string = '#ffffff';
  r: number = 255;
  g: number = 255;
  b: number = 255;
  fileName: string = 'sketch';
  downloadFormat: string = 'image/png';
  huePosition: number = 0;
  hueColor: string = '#ff0000';
  lightness: number = 50;
  zoomLevel: number = 100; // Початковий масштаб у відсотках
  basicColors: string[] = [
    '#FF0000', '#FF4500', '#FFA500', '#FFD700', '#FFFF00',
    '#ADFF2F', '#00FF00', '#32CD32', '#00CED1', '#00BFFF',
    '#0000FF', '#4B0082', '#8A2BE2', '#FF00FF', '#FF69B4',
    '#FFFFFF', '#D3D3D3', '#808080', '#000000', '#8B4513',
  ];
  history: string[] = [];
  private ctx!: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private baseGridSize: number = 10; // Базовий розмір пікселя
  private gridSize: number = this.baseGridSize;

  ngAfterViewInit(): void {
    this.createCanvas();
  }

  updateZoom(): void {
    this.gridSize = this.baseGridSize * (this.zoomLevel / 100);
    this.createCanvas();
  }

  selectHue(event: MouseEvent): void {
    const strip = this.hueStripRef.nativeElement;
    const rect = strip.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    this.huePosition = Math.max(0, Math.min(100, percentage));

    const hue = (this.huePosition / 100) * 360;
    const rgb = this.hslToRgb(hue / 360, 1, this.lightness / 100);
    this.hueColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    this.r = rgb.r;
    this.g = rgb.g;
    this.b = rgb.b;
    this.updateColor();
  }

  hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  updateColor(): void {
    const hue = (this.huePosition / 100) * 360;
    const rgb = this.hslToRgb(hue / 360, 1, this.lightness / 100);
    this.r = rgb.r;
    this.g = rgb.g;
    this.b = rgb.b;
    this.selectedColor = `rgb(${this.r}, ${this.g}, ${this.b})`;
  }

  selectColor(color: string): void {
    this.selectedColor = color;
    const rgb = color.match(/\d+/g);
    if (rgb) {
      this.r = parseInt(rgb[0]);
      this.g = parseInt(rgb[1]);
      this.b = parseInt(rgb[2]);
      const hsl = this.rgbToHsl(this.r, this.g, this.b);
      this.huePosition = (hsl.h / 360) * 100;
      this.lightness = hsl.l * 100;
      this.hueColor = `rgb(${this.r}, ${this.g}, ${this.b})`;
    }
  }

  rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  createCanvas(): void {
    if (!this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.width * this.gridSize;
    canvas.height = this.height * this.gridSize;
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.drawGrid();
    this.history = [];
    this.saveState();
    canvas.addEventListener('mousedown', this.startDrawing.bind(this));
    canvas.addEventListener('mousemove', this.draw.bind(this));
    canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
  }

  private drawGrid(): void {
    if (!this.ctx) return;
    this.ctx.strokeStyle = '#666666';
    this.ctx.lineWidth = 0.5;
    for (let x = 0; x <= this.width; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.gridSize, 0);
      this.ctx.lineTo(x * this.gridSize, this.height * this.gridSize);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.height; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.gridSize);
      this.ctx.lineTo(this.width * this.gridSize, y * this.gridSize);
      this.ctx.stroke();
    }
  }

  private saveState(): void {
    if (this.history.length >= 10) {
      this.history.shift();
    }
    this.history.push(this.canvasRef.nativeElement.toDataURL());
  }

  undo(): void {
    if (this.history.length <= 1) return;
    this.history.pop();
    const previousState = this.history[this.history.length - 1];
    const img = new Image();
    img.src = previousState;
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
      this.ctx.drawImage(img, 0, 0);
      this.drawGrid();
    };
  }

  private startDrawing(event: MouseEvent): void {
    this.isDrawing = true;
    this.draw(event);
  }

  private draw(event: MouseEvent): void {
    if (!this.isDrawing || !this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((event.clientX - rect.left) * scaleX) / this.gridSize);
    const y = Math.floor(((event.clientY - rect.top) * scaleY) / this.gridSize);

    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.saveState();
      this.ctx.fillStyle = this.selectedColor;
      this.ctx.fillRect(x * this.gridSize, y * this.gridSize, this.gridSize, this.gridSize);
    }
  }

  private stopDrawing(): void {
    this.isDrawing = false;
  }

  saveSketch(): void {
    if (!this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const safeFileName = (this.fileName || 'sketch').replace(/[^a-zA-Z0-9_-]/g, '');
    const link = document.createElement('a');
    link.href = canvas.toDataURL(this.downloadFormat, this.downloadFormat === 'image/jpeg' ? 0.8 : 1);
    link.download = `${safeFileName}.${this.downloadFormat === 'image/jpeg' ? 'jpg' : 'png'}`;
    link.click();
  }
}