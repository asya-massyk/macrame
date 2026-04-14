import { Component, ViewChild, ElementRef, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MaterialResponse {
  number: string;
  color: { r: string; g: string; b: string };
  brand: string;      // завжди буде 'DMC'
}

@Component({
  selector: 'app-pixelation',
  templateUrl: './pixelation.component.html',
  styleUrls: ['./pixelation.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class PixelationComponent implements AfterViewInit {
  imageSrc: string | null = null;
  pixelCount: number = 25;
  minPixelCount: number = 8;
  maxPixelCount: number = 50;
  isCropping: boolean = false;
  fileName: string = 'pixelated_image';
  downloadFormat: string = 'image/png';
  sliderValue: number = 25;
  schemeMode: 'color' | 'bw' = 'color';
  materialType: string = 'beads';
  colorCount: number = 10;
  minColorCount: number = 2;
  maxColorCount: number = 50;
  canvasRef!: ElementRef<HTMLCanvasElement>;
  materialList: Array<{
    number: string;
    color: { r: number; g: number; b: number };
    symbol: string;
    fillColor: string;
    brand: string;
  }> = [];
  symbolColors: Array<{
    symbol: string;
    color: { r: number; g: number; b: number };
    fillColor: string;
  }> = [];

  private symbolPool: string[] = [
    '■', '□', '●', '○', '▲', '▼', '▶', '◀', '★', '☆', '◆', '◇', '✚', '✖', '◼', '◻', '⬛', '⬜',
    '▣', '▤', '▥', '▦', '▧', '▨', '▩', '◎', '◉', '✦', '✧', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗',
    '▌', '▍', '◢', '◣', '◤', '◥', '▰', '▱', '◈', '⬘', '⬙', '◬', '◭', '◮',
    '▚', '▞', '▙', '▛', '▜', '▝', '▟', '◴', '◵', '◶', '◷', '◸', '◹', '◺', '◼', '◽', '◾', '◿',
    '▀', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '╱', '╲', '╳', '▔', '▕',
    '◰', '◱', '◲', '◳', '✸', '✹', '✺', '✻', '✼', '✢', '✣', '✤', '✥', '⊕', '⊖',
    '⬒', '⬓', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗', '▰', '▱', '◬', '◭', '◮'
  ];


  private symbolFillPalette: string[] = [
    '#FFFFFF', '#000000', '#333333', '#666666', '#999999',
    '#FFEE00', '#00FFCC', '#FF00AA', '#00AAFF', '#FF8800'
  ];

  private reducedPalette: Array<{ r: number; g: number; b: number }> = [];
  private cropStart: { x: number; y: number } | null = null;
  private cropEnd: { x: number; y: number } | null = null;
  private originalImage: HTMLImageElement | null = null;
  private isMouseDown: boolean = false;
  private minCropSize: number = 10;
  private aspectRatio: number | null = null;
  private preservePixelCount: number | null = null;
  public history: any[] = [];
  private minCellSize = 20;
  private currentNumCols: number = 0;
  private currentNumRows: number = 0;
  private pixelatedCanvas: HTMLCanvasElement | null = null;
  private lastPixelParams: string = '';

  get pixelGridLabel(): string {
    if (this.currentNumCols === 0 || this.currentNumRows === 0) {
      return `${this.pixelCount}×${this.pixelCount}`;
    }
    return `${this.currentNumCols}×${this.currentNumRows}`;
  }

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', () => this.adjustCanvasSize());
    }
  }

  @ViewChild('pixelationCanvas')
  set canvasSetter(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (!canvas) return;

    this.canvasRef = canvas;

    const el = canvas.nativeElement;

    el.addEventListener('mousedown', (e) => this.startCrop(e));
    el.addEventListener('mousemove', (e) => this.updateCrop(e));
    el.addEventListener('mouseup', () => this.endCrop());


    this.adjustCanvasSize();
  }

  private buildColorPalette(colors: { r: number; g: number; b: number }[]): void {
    if (colors.length === 0) return;

    const k = this.colorCount;

    // 1. Випадкові центри (старт)
    let centers = [];
    for (let i = 0; i < k; i++) {
      centers.push(colors[Math.floor(Math.random() * colors.length)]);
    }

    for (let iter = 0; iter < 6; iter++) {
      const clusters: { r: number; g: number; b: number }[][] = Array.from({ length: k }, () => []);

      // 2. Розкидаємо кольори по найближчих центрах
      for (const c of colors) {
        let bestIndex = 0;
        let minDist = Infinity;

        for (let i = 0; i < k; i++) {
          const center = centers[i];
          const dist =
            (c.r - center.r) ** 2 +
            (c.g - center.g) ** 2 +
            (c.b - center.b) ** 2;

          if (dist < minDist) {
            minDist = dist;
            bestIndex = i;
          }
        }

        clusters[bestIndex].push(c);
      }

      // 3. Перерахунок центрів
      for (let i = 0; i < k; i++) {
        const cluster = clusters[i];
        if (cluster.length === 0) continue;

        let sumR = 0, sumG = 0, sumB = 0;

        for (const c of cluster) {
          sumR += c.r;
          sumG += c.g;
          sumB += c.b;
        }

        centers[i] = {
          r: Math.round(sumR / cluster.length),
          g: Math.round(sumG / cluster.length),
          b: Math.round(sumB / cluster.length)
        };
      }
    }

    this.reducedPalette = centers;
  }
  private getClosestColor(r: number, g: number, b: number) {
    if (!this.reducedPalette.length) {
      return { r, g, b };
    }

    let closest = this.reducedPalette[0];
    let minDist = Infinity;

    for (const c of this.reducedPalette) {
      const dist =
        (r - c.r) ** 2 +
        (g - c.g) ** 2 +
        (b - c.b) ** 2;

      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }

    return closest;
  }

  private saveState(): void {
    if (!this.imageSrc) return;

    const state = {
      imageSrc: this.imageSrc,
      pixelCount: this.pixelCount,
      sliderValue: this.sliderValue,
      schemeMode: this.schemeMode,
      colorCount: this.colorCount,
      symbolColors: JSON.parse(JSON.stringify(this.symbolColors || [])),
      materialList: JSON.parse(JSON.stringify(this.materialList || [])),
      currentNumCols: this.currentNumCols,
      currentNumRows: this.currentNumRows
    };

    const last = this.history[this.history.length - 1];

    // ❗ тепер перевірка глибша
    if (
      last &&
      last.imageSrc === state.imageSrc &&
      last.symbolColors?.length === state.symbolColors?.length
    ) {
      return;
    }

    if (this.history.length >= 20) {
      this.history.shift();
    }

    this.history.push(state);
  }

  undo(): void {
    if (this.history.length <= 1) return;

    this.history.pop(); // видаляємо поточний

    const prevState = this.history[this.history.length - 1];
    if (!prevState) return;

    this.imageSrc = prevState.imageSrc;
    this.pixelCount = prevState.pixelCount;
    this.sliderValue = prevState.sliderValue;
    this.schemeMode = prevState.schemeMode;
    this.colorCount = prevState.colorCount;

    this.symbolColors = JSON.parse(JSON.stringify(prevState.symbolColors || []));
    this.materialList = JSON.parse(JSON.stringify(prevState.materialList || []));
    this.currentNumCols = prevState.currentNumCols;
    this.currentNumRows = prevState.currentNumRows;

    this.resetDerivedState();
    if (this.imageSrc) {
      this.loadImage(this.imageSrc);
    }
  }
  private resetDerivedState(): void {
    this.materialList = [];
    this.symbolColors = [];
  }

  private adjustCanvasSize(): void {
    if (!this.canvasRef?.nativeElement || !this.originalImage) return;

    const canvas = this.canvasRef.nativeElement;
    const aspectRatio = this.originalImage.width / this.originalImage.height;

    let newWidth = Math.min(820, this.originalImage.width);   // трохи збільшив максимум
    let newHeight = newWidth / aspectRatio;

    if (newHeight > 620) {
      newHeight = 620;
      newWidth = newHeight * aspectRatio;
    }

    if (isPlatformBrowser(this.platformId)) {
      const parentWidth = window.innerWidth * 0.92;
      if (newWidth > parentWidth) {
        newWidth = parentWidth;
        newHeight = newWidth / aspectRatio;
      }
    }

    canvas.width = Math.round(newWidth);
    canvas.height = Math.round(newHeight);
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;
    canvas.style.margin = '0 auto';
  }

  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Зображення занадто велике (максимум 5MB)');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Непідтримуваний формат (тільки JPEG або PNG)');
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > 3000 || img.height > 3000) {
        alert('Розмір зображення занадто великий (максимум 3000x3000 пікселів)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.history = [];
        this.imageSrc = reader.result as string;
        this.resetDerivedState();
        this.loadImage(this.imageSrc);
        this.saveState();
      };
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('Не вдалося завантажити зображення');
    };
  }

  private loadImage(src: string): void {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      this.originalImage = img;

      const minSide = Math.min(img.width, img.height);
      this.maxPixelCount = Math.min(50, Math.floor(minSide / this.minCellSize));
      this.maxPixelCount = Math.max(this.maxPixelCount, this.minPixelCount);

      if (this.preservePixelCount !== null) {
        this.pixelCount = Math.min(this.maxPixelCount, Math.max(this.minPixelCount, this.preservePixelCount));
        this.preservePixelCount = null;
      } else {
        this.pixelCount = Math.max(this.minPixelCount, Math.floor(this.pixelCount * 0.85));
      }

      this.sliderValue = this.pixelCount;
      this.currentNumCols = 0;
      this.currentNumRows = 0;

      this.adjustCanvasSize();

      setTimeout(() => {
        this.renderImage();
        // НІЯКОГО saveState(true) тут!!!
      }, 30);
    };

    img.onerror = () => {
      console.error('Не вдалося завантажити зображення');
      this.resetCrop();
    };
  }

  private getBlockInfo(side: number, numBlocks: number): { starts: number[]; sizes: number[] } {
    const blockSize = Math.floor(side / numBlocks);
    const remainder = side % numBlocks;
    const starts: number[] = [];
    const sizes: number[] = [];
    let current = 0;
    for (let i = 0; i < numBlocks; i++) {
      const size = i < remainder ? blockSize + 1 : blockSize;
      starts.push(current);
      sizes.push(size);
      current += size;
    }
    return { starts, sizes };
  }

  private getBlockColor(
    px: number,
    py: number,
    blockW: number,
    blockH: number,
    data: Uint8ClampedArray,
    width: number
  ) {
    let sumR = 0, sumG = 0, sumB = 0;
    const count = blockW * blockH;

    for (let iy = py; iy < py + blockH; iy++) {
      for (let ix = px; ix < px + blockW; ix++) {
        const idx = (iy * width + ix) * 4;

        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
      }
    }

    return this.getClosestColor(
      Math.round(sumR / count),
      Math.round(sumG / count),
      Math.round(sumB / count)
    );
  }


  private renderPixelated(): void {
    if (!this.originalImage) return;

    const key = `${this.pixelCount}_${this.colorCount}_${this.schemeMode}`;
    if (this.lastPixelParams === key && this.pixelatedCanvas) return;

    this.lastPixelParams = key;

    const width = this.originalImage.width;
    const height = this.originalImage.height;

    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    tempCanvas.width = width;
    tempCanvas.height = height;
    ctx.drawImage(this.originalImage, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const allColors = [];
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (this.schemeMode === 'bw') {
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        r = g = b = gray;
      }

      allColors.push({ r, g, b });
    }

    this.buildColorPalette(allColors);

    // ⬇️ твоя логіка блоків БЕЗ змін
    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    const isWidthMin = width <= height;
    const numMin = this.pixelCount;
    const pixelSizeApprox = minSide / numMin;
    const numMax = Math.ceil(maxSide / pixelSizeApprox);

    const numCols = isWidthMin ? numMin : numMax;
    const numRows = isWidthMin ? numMax : numMin;

    this.currentNumCols = numCols;
    this.currentNumRows = numRows;

    const colInfo = this.getBlockInfo(width, numCols);
    const rowInfo = this.getBlockInfo(height, numRows);

    ctx.clearRect(0, 0, width, height);

    for (let row = 0; row < numRows; row++) {
      const py = rowInfo.starts[row];
      const blockH = rowInfo.sizes[row];

      for (let col = 0; col < numCols; col++) {
        const px = colInfo.starts[col];
        const blockW = colInfo.sizes[col];

        let avg = this.getBlockColor(px, py, blockW, blockH, data, width);

        if (this.schemeMode === 'bw') {
          const gray = Math.round(0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b);
          avg = { r: gray, g: gray, b: gray };
        }

        ctx.fillStyle = `rgb(${avg.r},${avg.g},${avg.b})`;
        ctx.fillRect(px, py, blockW, blockH);
      }
    }

    this.pixelatedCanvas = tempCanvas;
  }

  private drawToCanvas(): void {
    if (!this.canvasRef || !this.pixelatedCanvas) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(
      canvas.width / this.pixelatedCanvas.width,
      canvas.height / this.pixelatedCanvas.height
    );

    const offsetX = (canvas.width - this.pixelatedCanvas.width * scale) / 2;
    const offsetY = (canvas.height - this.pixelatedCanvas.height * scale) / 2;

    ctx.drawImage(
      this.pixelatedCanvas,
      offsetX,
      offsetY,
      this.pixelatedCanvas.width * scale,
      this.pixelatedCanvas.height * scale
    );
  }

  renderImage(): void {
    if (!this.originalImage || !this.canvasRef?.nativeElement) return;

    //  критично — синхронізація з layout
    this.adjustCanvasSize();

    this.renderPixelated();
    this.drawToCanvas();
    this.drawCropOverlay();
  }

  private drawCropOverlay(): void {
    if (!this.isCropping || !this.cropStart || !this.cropEnd || !this.pixelatedCanvas) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cropX = Math.min(this.cropStart.x, this.cropEnd.x);
    const cropY = Math.min(this.cropStart.y, this.cropEnd.y);
    const cropW = Math.abs(this.cropEnd.x - this.cropStart.x);
    const cropH = Math.abs(this.cropEnd.y - this.cropStart.y);

    if (cropW < 20 || cropH < 20) return;

    const displayW = this.pixelatedCanvas.width;
    const displayH = this.pixelatedCanvas.height;

    const scale = Math.min(
      canvas.width / displayW,
      canvas.height / displayH
    );

    const offsetX = (canvas.width - displayW * scale) / 2;
    const offsetY = (canvas.height - displayH * scale) / 2;

    ctx.save();

    // Затемнення всього полотна
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // === ВИПРАВЛЕНО: правильно вирізати вибрану область ===
    const sourceX = (cropX - offsetX) / scale;
    const sourceY = (cropY - offsetY) / scale;
    const sourceW = cropW / scale;
    const sourceH = cropH / scale;

    ctx.drawImage(
      this.pixelatedCanvas,
      sourceX,          // sx
      sourceY,          // sy
      sourceW,          // sWidth
      sourceH,          // sHeight
      cropX,            // dx
      cropY,            // dy
      cropW,            // dWidth
      cropH             // dHeight
    );

    // Рамка виділення
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(cropX, cropY, cropW, cropH);

    // Додаткова тонка темна рамка для контрасту
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(cropX + 1, cropY + 1, cropW - 2, cropH - 2);

    ctx.restore();
  }
  private mapSliderToPixelCount(value: number): number {
    const normalized = (value - this.minPixelCount) / (this.maxPixelCount - this.minPixelCount);
    const adjusted = Math.pow(normalized, 2.8);
    const maxEffective = 48;

    return Math.round(this.minPixelCount + adjusted * (maxEffective - this.minPixelCount));
  }

  updatePixelation(): void {
    if (!this.imageSrc || this.isCropping) return;

    const mappedValue = this.mapSliderToPixelCount(this.sliderValue);

    const newPixelCount = Math.min(
      this.maxPixelCount,
      Math.max(this.minPixelCount, mappedValue)
    );

    if (newPixelCount === this.pixelCount) return; // 🔥 щоб не спамити історію

    this.pixelCount = newPixelCount;

    this.resetDerivedState();
    this.renderImage();

    this.saveState(); // ✅ ПІСЛЯ змін
  }

  onSchemeModeChange(): void {
    this.saveState();
    this.resetDerivedState();
    this.renderImage();   // просто оновлює фон, символи зникають — як і повинно
  }

  onColorCountChange(): void {
    this.saveState();

    this.colorCount = Math.max(
      this.minColorCount,
      Math.min(this.maxColorCount, this.colorCount)
    );

    this.resetDerivedState();
    this.renderImage();
  }

  startCropping(): void {
    this.isCropping = true;
    this.cropStart = null;
    this.cropEnd = null;
    this.isMouseDown = false;
    this.resetDerivedState();
    this.renderImage();
  }

  startCrop(event: MouseEvent): void {
    if (!this.isCropping || !this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    this.cropStart = {
      x: Math.max(0, Math.min((event.clientX - rect.left) * scaleX, canvas.width)),
      y: Math.max(0, Math.min((event.clientY - rect.top) * scaleY, canvas.height)),
    };
    this.cropEnd = { ...this.cropStart };
    this.isMouseDown = true;
    this.renderImage();
  }

  updateCrop(event: MouseEvent): void {
    if (!this.isCropping || !this.cropStart || !this.isMouseDown || !this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x = (event.clientX - rect.left) * scaleX;
    let y = (event.clientY - rect.top) * scaleY;

    x = Math.max(0, Math.min(x, canvas.width));
    y = Math.max(0, Math.min(y, canvas.height));

    let cropWidth = Math.abs(x - this.cropStart.x);
    let cropHeight = Math.abs(y - this.cropStart.y);

    cropWidth = Math.max(cropWidth, this.minCropSize);
    cropHeight = Math.max(cropHeight, this.minCropSize);

    if (this.aspectRatio) {
      if (cropWidth / cropHeight > this.aspectRatio) {
        cropWidth = cropHeight * this.aspectRatio;
      } else {
        cropHeight = cropWidth / this.aspectRatio;
      }
    }

    if (x < this.cropStart.x) {
      x = Math.max(0, this.cropStart.x - cropWidth);
    } else {
      x = Math.min(canvas.width, this.cropStart.x + cropWidth);
    }
    if (y < this.cropStart.y) {
      y = Math.max(0, this.cropStart.y - cropHeight);
    } else {
      y = Math.min(canvas.height, this.cropStart.y + cropHeight);
    }

    this.cropEnd = { x, y };
    this.renderImage();
  }

  endCrop(): void {
    if (
      !this.isCropping ||
      !this.cropStart ||
      !this.cropEnd ||
      !this.isMouseDown ||
      !this.canvasRef?.nativeElement ||
      !this.originalImage ||
      !this.pixelatedCanvas
    ) {
      this.resetCrop();
      return;
    }

    const canvas = this.canvasRef.nativeElement;

    let cropX = Math.min(this.cropStart.x, this.cropEnd.x);
    let cropY = Math.min(this.cropStart.y, this.cropEnd.y);
    let cropWidth = Math.abs(this.cropEnd.x - this.cropStart.x);
    let cropHeight = Math.abs(this.cropEnd.y - this.cropStart.y);

    if (cropWidth < this.minCropSize || cropHeight < this.minCropSize) {
      this.resetCrop();
      return;
    }

    const displayW = this.pixelatedCanvas.width;
    const displayH = this.pixelatedCanvas.height;

    const scale = Math.min(
      canvas.width / displayW,
      canvas.height / displayH
    );

    const offsetX = (canvas.width - displayW * scale) / 2;
    const offsetY = (canvas.height - displayH * scale) / 2;

    let srcX = Math.round((cropX - offsetX) / scale);
    let srcY = Math.round((cropY - offsetY) / scale);
    let srcW = Math.round(cropWidth / scale);
    let srcH = Math.round(cropHeight / scale);

    srcX = Math.max(0, srcX);
    srcY = Math.max(0, srcY);
    srcW = Math.min(srcW, this.originalImage.width - srcX);
    srcH = Math.min(srcH, this.originalImage.height - srcY);

    if (srcW <= 10 || srcH <= 10) {
      this.resetCrop();
      return;
    }

    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
      this.resetCrop();
      return;
    }

    tempCanvas.width = srcW;
    tempCanvas.height = srcH;

    ctx.drawImage(
      this.originalImage,
      srcX, srcY, srcW, srcH,
      0, 0, srcW, srcH
    );

    const newImageSrc = tempCanvas.toDataURL('image/png', 1.0);

    // 🔥 очищаємо crop-стан
    this.isCropping = false;
    this.cropStart = null;
    this.cropEnd = null;
    this.isMouseDown = false;
    this.pixelatedCanvas = null;
    this.lastPixelParams = '';

    // 🔥 застосовуємо зміну
    this.imageSrc = newImageSrc;
    this.resetDerivedState();

    // 🔥 завантажуємо нове зображення
    this.loadImage(newImageSrc);

    // ✅ ГОЛОВНЕ — зберігаємо ПІСЛЯ зміни
    this.saveState();
  }
  private resetCrop(): void {
    this.isCropping = false;
    this.cropStart = null;
    this.cropEnd = null;
    this.isMouseDown = false;
    this.renderImage();
  }

  get canUndo(): boolean {
    return this.history.length > 1;
  }

  // ==================== ГОЛОВНИЙ МЕТОД ЗБЕРЕЖЕННЯ ====================
  downloadImage(): void {
    const safeFileName = (this.fileName || 'pixelated_image')
      .replace(/[^a-zA-Z0-9_-]/g, '');

    if (this.materialList.length === 0) {
      this.downloadCanvasOnly(safeFileName);
    } else {
      this.downloadWithLegend(safeFileName);
    }
  }

  // ==================== Збереження ТІЛЬКИ canvas ====================
  private downloadCanvasOnly(fileName: string): void {
    const canvas = this.canvasRef.nativeElement;
    const scaleFactor = this.pixelCount > 100 ? 3 : 2;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * scaleFactor;
    tempCanvas.height = canvas.height * scaleFactor;

    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

    this.saveCanvasAsFile(tempCanvas, fileName);
  }

  // ==================== Збереження canvas + легенда ====================
  private async downloadWithLegend(fileName: string): Promise<void> {
    const mainCanvas = this.canvasRef.nativeElement;
    const scaleFactor = this.pixelCount > 100 ? 3 : 2;

    // 1. Підготовка основного зображення
    const mainTemp = document.createElement('canvas');
    mainTemp.width = mainCanvas.width * scaleFactor;
    mainTemp.height = mainCanvas.height * scaleFactor;

    const mainCtx = mainTemp.getContext('2d')!;
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(mainCanvas, 0, 0, mainTemp.width, mainTemp.height);

    // 2. Створення canvas з легенди
    const legendCanvas = await this.createLegendCanvas(scaleFactor);

    if (!legendCanvas) {
      this.saveCanvasAsFile(mainTemp, fileName);
      return;
    }

    // 3. Фінальне комбіноване зображення
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = Math.max(mainTemp.width, legendCanvas.width);
    finalCanvas.height = mainTemp.height + legendCanvas.height + 60; // відступ між схемою і легендою

    const finalCtx = finalCanvas.getContext('2d')!;
    finalCtx.fillStyle = '#111111';
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Малюємо схему зверху
    finalCtx.drawImage(mainTemp, 0, 0);

    // Малюємо легенду знизу по центру
    finalCtx.drawImage(
      legendCanvas,
      (finalCanvas.width - legendCanvas.width) / 2,
      mainTemp.height + 40
    );

    this.saveCanvasAsFile(finalCanvas, fileName);
  }

  // ==================== Створення canvas з легенди (html2canvas) ====================
  private async createLegendCanvas(scale: number = 2): Promise<HTMLCanvasElement | null> {
    const legendEl = document.querySelector('.legend-container') as HTMLElement;
    if (!legendEl) return null;

    try {
      const canvas = await html2canvas(legendEl, {
        scale: scale,
        backgroundColor: '#111111',
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: legendEl.offsetWidth,
        height: legendEl.offsetHeight
      });

      return canvas;
    } catch (error) {
      console.error('Помилка створення легенди для збереження:', error);
      return null;
    }
  }

  // ==================== Збереження canvas у файл (PDF або PNG/JPG) ====================
  private saveCanvasAsFile(canvas: HTMLCanvasElement, fileName: string): void {
    if (this.downloadFormat === 'application/pdf') {
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
        compress: false
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${fileName}.pdf`);
    } else {
      const isJpeg = this.downloadFormat === 'image/jpeg';
      const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
      const extension = isJpeg ? 'jpg' : 'png';
      const quality = isJpeg ? 0.92 : 1.0;

      const dataUrl = canvas.toDataURL(mimeType, quality);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${fileName}.${extension}`;
      link.click();
    }
  }

  rotateImage(): void {
    if (!this.originalImage) return;

    this.preservePixelCount = this.pixelCount;

    const source = this.pixelatedCanvas || this.originalImage;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = source.height;
    tempCanvas.height = source.width;

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(Math.PI / 2);

    tempCtx.drawImage(source, -source.width / 2, -source.height / 2);

    const newImageSrc = tempCanvas.toDataURL('image/png');

    this.imageSrc = newImageSrc;
    this.pixelatedCanvas = tempCanvas;

    this.loadImage(newImageSrc);

    //  ЗБЕРІГАЄМО ПІСЛЯ зміни
    this.saveState();
  }

  onMaterialTypeChange(): void {
    this.materialList = [];           // очищаємо тільки легенду

    // Відновлюємо символи на canvas (щоб вони не зникали)
    if (this.pixelatedCanvas && this.symbolColors.length > 0) {
      this.generateNumberedScheme();
    }
  }

  private getCanvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  onGenerateScheme(): void {
    if (!this.imageSrc) return;

    // будуємо пікселізацію
    this.renderPixelated();

    // будуємо символи
    this.buildSymbolColors();

    // малюємо схему
    this.generateNumberedScheme();

    // очищаємо легенду (щоб вона з’явилась заново)
    this.materialList = [];

    // 🔥 ФІКС: після зміни DOM (legend) — перемалювати canvas
    setTimeout(() => {
      this.adjustCanvasSize();
      this.renderPixelated();
      this.drawToCanvas();
      this.generateNumberedScheme();
    }, 0);

    this.saveState();
  }

  private buildSymbolColors(): void {
    if (!this.originalImage) return;

    // гарантуємо, що палітра вже побудована
    if (!this.reducedPalette || this.reducedPalette.length === 0) {
      const width = this.originalImage.width;
      const height = this.originalImage.height;

      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      tempCanvas.width = width;
      tempCanvas.height = height;
      ctx.drawImage(this.originalImage, 0, 0);

      const data = ctx.getImageData(0, 0, width, height).data;

      const allColors: { r: number; g: number; b: number }[] = [];
      for (let i = 0; i < data.length; i += 4) {
        allColors.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }

      this.buildColorPalette(allColors);
    }

    //  перевірка на кількість символів
    if (this.reducedPalette.length > this.symbolPool.length) {
      console.warn('Недостатньо символів для всіх кольорів!');
    }

    //  ГОЛОВНЕ — 1:1 відповідність
    this.symbolColors = this.reducedPalette.map((color, index) => {
      const brightness =
        color.r * 0.299 +
        color.g * 0.587 +
        color.b * 0.114;

      const fillColor = brightness < 140 ? '#FFFFFF' : '#000000';

      return {
        symbol: this.symbolPool[index], //  більше НЕ повторюється
        color,
        fillColor
      };
    });
    this.symbolColors = [...this.symbolColors]; // примусове оновлення масиву для Angular
  }

  generateNumberedScheme(): void {
    if (!this.canvasRef?.nativeElement || !this.pixelatedCanvas) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // малюємо фон
    this.drawToCanvas();

    const width = this.pixelatedCanvas.width;
    const height = this.pixelatedCanvas.height;

    // беремо пікселі з пікселізованого канвасу
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(this.pixelatedCanvas, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // === СІТКА ===
    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    const isWidthMin = width <= height;
    const numMin = this.pixelCount;
    const pixelSizeApprox = minSide / numMin;
    const numMax = Math.ceil(maxSide / pixelSizeApprox);

    const numCols = isWidthMin ? numMin : numMax;
    const numRows = isWidthMin ? numMax : numMin;

    const colInfo = this.getBlockInfo(width, numCols);
    const rowInfo = this.getBlockInfo(height, numRows);

    // === МАПА СИМВОЛІВ (тільки з палітри) ===
    const symbolMap: { [key: string]: any } = {};
    this.symbolColors.forEach(sc => {
      const key = `${sc.color.r},${sc.color.g},${sc.color.b}`;
      symbolMap[key] = sc;
    });

    // === SCALE ===
    const scale = Math.min(
      canvas.width / width,
      canvas.height / height
    );

    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    // === МАЛЮЄМО СИМВОЛИ ===
    for (let row = 0; row < numRows; row++) {
      const py = rowInfo.starts[row];
      const blockH = rowInfo.sizes[row];

      for (let col = 0; col < numCols; col++) {
        const px = colInfo.starts[col];
        const blockW = colInfo.sizes[col];

        // беремо СЕРЕДНІЙ колір блоку (як при генерації палітри)
        const avg = this.getBlockColor(px, py, blockW, blockH, data, width);

        const key = `${avg.r},${avg.g},${avg.b}`;
        const symbolInfo = symbolMap[key];

        if (symbolInfo) {
          ctx.save();

          ctx.fillStyle = symbolInfo.fillColor;

          ctx.font = `${Math.floor(Math.min(blockW, blockH) * scale * 0.55)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.fillText(
            symbolInfo.symbol,
            Math.round(offsetX + (px + blockW / 2) * scale),
            Math.round(offsetY + (py + blockH / 2) * scale)
          );

          ctx.restore();
        }
      }
    }
  }


  // Допоміжний метод для отримання кольору блоку з оригінального зображення
  private getBlockColorFromOriginal(
    px: number, py: number, blockW: number, blockH: number, width: number, height: number
  ): { r: number; g: number; b: number } {
    if (!this.originalImage) return { r: 0, g: 0, b: 0 };

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return { r: 0, g: 0, b: 0 };

    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(this.originalImage, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    return this.getBlockColor(px, py, blockW, blockH, data, width);
  }

  // === НОВА МЕТОДА ДЛЯ ЛЕГЕНДИ ===
  renderLegend(): void {
    // нічого не робимо — легенда рендериться автоматично через *ngFor
    // (можна додати логіку, якщо треба)
  }

  findMaterials(): void {
    if (this.symbolColors.length === 0) {
      alert('Спочатку створіть схему з позначками кольорів (кнопка "Перетворити на схему")');
      return;
    }

    const colorList = this.symbolColors.map(colorInfo => ({
      r: colorInfo.color.r.toString(),
      g: colorInfo.color.g.toString(),
      b: colorInfo.color.b.toString()
    }));

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-CSRFToken': this.getCsrfToken(),
      ...(isPlatformBrowser(this.platformId) && localStorage.getItem('token')
        ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        : {})
    });

    this.http.post<{ materials: MaterialResponse[] }>(
      'http://localhost:8000/accounts/materials/',
      {
        colors: colorList,
        materialType: this.materialType   // ← тепер динамічно!
      },
      { headers }
    ).subscribe({
      next: (response) => {
        this.materialList = response.materials.map((m, index) => ({
          number: m.number || '???',
          color: {
            r: +m.color.r,
            g: +m.color.g,
            b: +m.color.b
          },
          symbol: this.symbolColors[index].symbol,
          fillColor: this.symbolColors[index].fillColor,
          brand: m.brand || (this.materialType === 'threads' ? 'DMC' : 'Miyuki')
        }));

        console.log(` Знайдено матеріали для ${this.materialList.length} кольорів (${this.materialType})`);

        setTimeout(() => {
          this.adjustCanvasSize();
          this.renderPixelated();
          this.drawToCanvas();
          this.generateNumberedScheme();
        }, 10);
      },
      error: (err) => {
        console.error(' Помилка при підборі матеріалів:', err);
        if (err.status === 0) alert('Не вдалося підключитися до сервера');
        else alert('Не вдалося знайти матеріали. Перевірте логи сервера.');
      }
    });
  }

  private getCsrfToken(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    const name = 'csrftoken=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookies = decodedCookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length, cookie.length);
      }
    }
    return '';
  }
}