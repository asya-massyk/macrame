import { Component, Inject, PLATFORM_ID, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { jsPDF } from 'jspdf';
import { SketchTransferService } from '../services/sketch-transfer.service';

@Component({
  selector: 'app-edit-sketch',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './sketch.component.html',
  styleUrls: ['./sketch.component.scss'],
})
export class EditSketchComponent implements AfterViewInit {
  @ViewChild('sketchCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private isBrowser: boolean;
  private ctx: CanvasRenderingContext2D | null = null;
  scale: number = 1;
  rows: number = 10;
  columns: number = 10;
  pixelWidth: number = 10;
  pixelHeight: number = 10;
  private pixelSize: number = 20;
  private drawingData: string | null = null;
  selectedColor: string = '#D95DB0';
  fileName: string = 'sketch';
  fileFormat: string = 'png';
  rowIndex: number = 1;
  columnIndex: number = 1;
  private actionHistory: { type: string; data: any }[] = [];
  private pixelData: string[][] = [];
  private isPainting: boolean = false;
  canUndo: boolean = false;
  private readonly MAX_SIZE = 50;
  Math: any;
  currentTool: 'brush' | 'eraser' = 'brush';

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private sketchTransferService: SketchTransferService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  ngOnInit() {
    this.pixelWidth = 50;
    this.pixelHeight = 25;
    this.updateCanvasSize();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.setupCanvas();
    window.addEventListener('resize', () => this.adjustCanvasSize());
  }

  private setupCanvas(): void {
    if (!this.canvasRef?.nativeElement) {
      console.error('Canvas element not found');
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      console.error('Failed to get 2D context for canvas');
      return;
    }

    this.columns = this.pixelWidth;
    this.rows = this.pixelHeight;
    canvas.width = this.pixelWidth * this.pixelSize;
    canvas.height = this.pixelHeight * this.pixelSize;

    this.pixelData = Array(this.rows).fill(null).map(() => Array(this.columns).fill('#ffffff'));

    this.adjustScale();
    this.redrawCanvas();
    console.log('Canvas initialized:', { width: canvas.width, height: canvas.height });
  }

  private redrawCanvas(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;

    this.redrawPixels();

    this.drawGrid();
  }

  private drawGrid(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;

    this.ctx.strokeStyle = '#ccc';
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= this.columns; i++) {
      const x = i * this.pixelSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, canvas.height);
      this.ctx.stroke();
    }

    for (let i = 0; i <= this.rows; i++) {
      const y = i * this.pixelSize;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(canvas.width, y);
      this.ctx.stroke();
    }
  }

  onWidthChange(value: number): void {
    this.pixelWidth = Math.min(50, Math.max(1, value || 1));
    this.updateCanvasSize();
  }

  onHeightChange(value: number): void {
    this.pixelHeight = Math.min(50, Math.max(1, value || 1));
    this.updateCanvasSize();
  }

  limitDigits(event: Event, type: 'width' | 'height'): void {
    const input = event.target as HTMLInputElement;

    let value = input.value.replace(/\D/g, '');

    if (value.length > 2) {
      value = value.slice(0, 2);
    }

    let numericValue = Number(value);

    if (numericValue > 50) numericValue = 50;
    if (numericValue < 1) numericValue = 1;

    if (type === 'width') {
      this.pixelWidth = numericValue;
    } else {
      this.pixelHeight = numericValue;
    }

    input.value = numericValue.toString();

    this.updateCanvasSize();
  }

  private redrawPixels(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const color = this.pixelData[row][col];
        if (color !== '#ffffff') {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(col * this.pixelSize, row * this.pixelSize, this.pixelSize, this.pixelSize);
        }
      }
    }
  }

  private saveDrawing(): void {
    if (!this.canvasRef?.nativeElement) {
      console.error('Cannot save drawing: Canvas element not found');
      return;
    }
    this.drawingData = this.canvasRef.nativeElement.toDataURL('image/png');
    console.log('Drawing saved:', this.drawingData ? 'Data exists' : 'No data');
  }

  private restoreDrawing(): void {
    if (!this.drawingData || !this.ctx) {
      console.log('No drawing data to restore or context not available');
      return;
    }
    const img = new Image();
    img.src = this.drawingData;
    img.onload = () => {
      if (!this.ctx) return;
      this.ctx.drawImage(img, 0, 0);
      this.drawGrid();
      console.log('Drawing restored');
    };
    img.onerror = () => {
      console.error('Failed to restore drawing');
    };
  }

  convertToScheme(): void {
    if (!this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const color = this.pixelData[row][col];
        if (color !== '#ffffff') {
          ctx.fillStyle = color;
          ctx.fillRect(col * this.pixelSize, row * this.pixelSize, this.pixelSize, this.pixelSize);
        }
      }
    }

    const dataUrl = canvas.toDataURL('image/png', 1.0);

    this.sketchTransferService.setSketch(dataUrl, true);
    this.router.navigate(['/pixel']);
  }

  updateCanvasSize(): void {

    if (this.pixelWidth > this.MAX_SIZE) {
      this.pixelWidth = this.MAX_SIZE;
    }
    if (this.pixelHeight > this.MAX_SIZE) {
      this.pixelHeight = this.MAX_SIZE;
    }

    if (this.pixelWidth < 1) this.pixelWidth = 1;
    if (this.pixelHeight < 1) this.pixelHeight = 1;

    this.columns = this.pixelWidth;
    this.rows = this.pixelHeight;

    this.adjustCanvasSize();

    console.log('Canvas size updated:', { width: this.pixelWidth, height: this.pixelHeight });
  }

  adjustCanvasSize(): void {
    if (!this.canvasRef?.nativeElement || !this.ctx) {
      console.error('Cannot adjust canvas size: Canvas or context not available');
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.pixelWidth * this.pixelSize;
    canvas.height = this.pixelHeight * this.pixelSize;
    this.scale = Math.round(this.scale * 10) / 10;

    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;

    canvas.style.transform = `scale(${this.scale})`;
    canvas.style.transformOrigin = 'center';

    const newPixelData: string[][] = Array(this.rows).fill(null).map(() => Array(this.columns).fill('#ffffff'));
    for (let row = 0; row < Math.min(this.rows, this.pixelData.length); row++) {
      for (let col = 0; col < Math.min(this.columns, this.pixelData[row].length); col++) {
        newPixelData[row][col] = this.pixelData[row][col];
      }
    }
    this.pixelData = newPixelData;

    this.redrawCanvas();
    console.log('Canvas size adjusted:', { width: canvas.width, height: canvas.height, scale: this.scale });
  }

  adjustScale(): void {
    this.adjustCanvasSize();
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  addRow(): void {

    if (this.rows >= this.MAX_SIZE) {
      console.warn('Max rows reached');
      return;
    }

    const oldPixelData = [...this.pixelData.map(row => [...row])];
    this.rows++;
    this.pixelHeight++;
    const newPixelData: string[][] = Array(this.rows).fill(null).map(() => Array(this.columns).fill('#ffffff'));

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (row < this.rowIndex - 1) {
          newPixelData[row][col] = oldPixelData[row][col];
        } else if (row === this.rowIndex - 1) {
          newPixelData[row][col] = '#ffffff';
        } else {
          newPixelData[row][col] = oldPixelData[row - 1][col];
        }
      }
    }
    this.pixelData = newPixelData;

    this.adjustCanvasSize();
    this.actionHistory.push({ type: 'addRow', data: { index: this.rowIndex, oldPixelData } });
    this.updateCanUndo();
    console.log('Row added at index:', this.rowIndex, { rows: this.rows });
  }

  removeRow(): void {
    if (this.rows <= 1 || this.rowIndex < 1 || this.rowIndex > this.rows) {
      console.error('Invalid row index or too few rows:', this.rowIndex);
      return;
    }

    const oldPixelData = [...this.pixelData.map(row => [...row])];
    this.rows--;
    this.pixelHeight--;
    const newPixelData: string[][] = Array(this.rows).fill(null).map(() => Array(this.columns).fill('#ffffff'));

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (row < this.rowIndex - 1) {
          newPixelData[row][col] = oldPixelData[row][col];
        } else {
          newPixelData[row][col] = oldPixelData[row + 1][col];
        }
      }
    }
    this.pixelData = newPixelData;

    this.adjustCanvasSize();
    this.actionHistory.push({ type: 'removeRow', data: { index: this.rowIndex, oldPixelData } });
    this.updateCanUndo();
    console.log('Row removed at index:', this.rowIndex, { rows: this.rows });
  }

  addColumn(): void {

    if (this.columns >= this.MAX_SIZE) {
      console.warn('Max columns reached');
      return;
    }

    const oldPixelData = [...this.pixelData.map(row => [...row])];
    this.columns++;
    this.pixelWidth++;
    const newPixelData: string[][] = Array(this.rows).fill(null).map(() => Array(this.columns).fill('#ffffff'));

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (col < this.columnIndex - 1) {
          newPixelData[row][col] = oldPixelData[row][col];
        } else if (col === this.columnIndex - 1) {
          newPixelData[row][col] = '#ffffff';
        } else {
          newPixelData[row][col] = oldPixelData[row][col - 1];
        }
      }
    }
    this.pixelData = newPixelData;

    this.adjustCanvasSize();
    this.actionHistory.push({ type: 'addColumn', data: { index: this.columnIndex, oldPixelData } });
    this.updateCanUndo();
    console.log('Column added at index:', this.columnIndex, { columns: this.columns });
  }

  removeColumn(): void {
    if (this.columns <= 1 || this.columnIndex < 1 || this.columnIndex > this.columns) {
      console.error('Invalid column index or too few columns:', this.columnIndex);
      return;
    }

    const oldPixelData = [...this.pixelData.map(row => [...row])];
    this.columns--;
    this.pixelWidth--;
    const newPixelData: string[][] = Array(this.rows).fill(null).map(() => Array(this.columns).fill('#ffffff'));

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (col < this.columnIndex - 1) {
          newPixelData[row][col] = oldPixelData[row][col];
        } else {
          newPixelData[row][col] = oldPixelData[row][col + 1];
        }
      }
    }
    this.pixelData = newPixelData;

    this.adjustCanvasSize();
    this.actionHistory.push({ type: 'removeColumn', data: { index: this.columnIndex, oldPixelData } });
    this.updateCanUndo();
    console.log('Column removed at index:', this.columnIndex, { columns: this.columns });
  }

  startPainting(event: MouseEvent): void {
    this.isPainting = true;
    this.paintPixel(event);
  }

  stopPainting(): void {
    this.isPainting = false;
  }

  setTool(tool: 'brush' | 'eraser') {
    this.currentTool = tool;
    this.updateCursor();
  }

  private updateCursor() {
    const canvas = this.canvasRef.nativeElement;

    if (this.currentTool === 'brush') {
      canvas.style.cursor = 'url("/assets/cursors/brush.cur"), crosshair';
    } else if (this.currentTool === 'eraser') {
      canvas.style.cursor = 'url("/assets/cursors/eraser.cur"), crosshair';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }

  paintPixel(event: MouseEvent): void {
    if (!this.isPainting || !this.ctx || !this.canvasRef?.nativeElement) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const col = Math.floor(x / this.pixelSize);
    const row = Math.floor(y / this.pixelSize);

    if (col < 0 || col >= this.columns || row < 0 || row >= this.rows) return;

    const color = this.currentTool === 'eraser'
      ? '#ffffff'
      : this.selectedColor;

    this.pixelData[row][col] = color;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(col * this.pixelSize, row * this.pixelSize, this.pixelSize, this.pixelSize);

    this.actionHistory.push({ type: 'paint', data: { col, row, color: this.selectedColor } });
    this.redrawCanvas();
    this.saveDrawing();
    this.updateCanUndo();
    console.log('Pixel painted:', { col, row, color: this.selectedColor });
  }

  undoLastAction(): void {
    if (this.actionHistory.length === 0 || !this.ctx) return;

    const lastAction = this.actionHistory.pop();
    if (!lastAction) return;

    switch (lastAction.type) {
      case 'paint':
        const { col, row } = lastAction.data;
        this.pixelData[row][col] = '#ffffff';
        this.redrawCanvas();
        console.log('Undo paint:', lastAction.data);
        break;

      case 'addRow':
        this.pixelData = lastAction.data.oldPixelData;
        this.rows--;
        this.pixelHeight--;
        this.adjustCanvasSize();
        console.log('Undo addRow:', lastAction.data);
        break;

      case 'removeRow':
        this.pixelData = lastAction.data.oldPixelData;
        this.rows++;
        this.pixelHeight++;
        this.adjustCanvasSize();
        console.log('Undo removeRow:', lastAction.data);
        break;

      case 'addColumn':
        this.pixelData = lastAction.data.oldPixelData;
        this.columns--;
        this.pixelWidth--;
        this.adjustCanvasSize();
        console.log('Undo addColumn:', lastAction.data);
        break;

      case 'removeColumn':
        this.pixelData = lastAction.data.oldPixelData;
        this.columns++;
        this.pixelWidth++;
        this.adjustCanvasSize();
        console.log('Undo removeColumn:', lastAction.data);
        break;
      case 'fill':
        this.pixelData = lastAction.data.oldPixelData;
        this.redrawCanvas();
        console.log('Undo fill');
        break;
    }

    this.saveDrawing();
    this.updateCanUndo();
  }

  private updateCanUndo(): void {
    this.canUndo = this.actionHistory.length > 0;
    this.cdr.detectChanges();
  }

  clearCanvas(): void {
    this.pixelData = Array(this.rows)
      .fill(null)
      .map(() => Array(this.columns).fill('#ffffff'));

    this.actionHistory = [];

    this.redrawCanvas();
    this.saveDrawing();
    this.updateCanUndo();

    console.log('Canvas cleared');
  }

  fillCanvas(): void {
    const oldPixelData = this.pixelData.map(row => [...row]);

    this.pixelData = Array(this.rows)
      .fill(null)
      .map(() => Array(this.columns).fill(this.selectedColor));

    this.actionHistory.push({
      type: 'fill',
      data: { oldPixelData }
    });

    this.redrawCanvas();
    this.saveDrawing();
    this.updateCanUndo();

    console.log('Canvas filled with:', this.selectedColor);
  }

  saveCanvas(): void {
    if (!this.canvasRef?.nativeElement) {
      console.error('Cannot save canvas: Canvas element not found');
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    let finalFileName = this.fileName.trim() || 'sketch';

    if (this.fileFormat === 'pdf') {
      finalFileName += '.pdf';

      const doc = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      doc.save(finalFileName);
      console.log('PDF saved:', finalFileName);
    } else {
      const format = this.fileFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
      finalFileName += `.${this.fileFormat}`;
      const dataUrl = canvas.toDataURL(format);
      const link = document.createElement('a');
      link.download = finalFileName;
      link.href = dataUrl;
      link.click();
      console.log('Image saved:', { fileName: finalFileName, format });
    }
  }
}