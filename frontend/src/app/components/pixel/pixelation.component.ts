import { Component, ViewChild, ElementRef, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import jsPDF from 'jspdf';

interface MaterialResponse {
  number: string;
  color: { r: string; g: string; b: string };
  materials: Array<{ brand: string; number: string }>;
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
    materials: Array<{ brand: string; number: string }>;
  }> = [];
  symbolColors: Array<{
    symbol: string;
    color: { r: number; g: number; b: number };
    fillColor: string;           // ← ДОДАЙ це поле
  }> = [];
  // ====================== ВЕЛИКИЙ ПУЛ СИМВОЛІВ ======================
  private symbolPool: string[] = [
    '■', '□', '●', '○', '▲', '▼', '▶', '◀', '★', '☆', '◆', '◇', '✚', '✖', '◼', '◻', '⬛', '⬜',
    '▣', '▤', '▥', '▦', '▧', '▨', '▩', '◎', '◉', '✦', '✧', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗',
    '▌', '▍', '░', '▒', '▓', '◢', '◣', '◤', '◥', '▰', '▱', '◈', '⬘', '⬙', '◬', '◭', '◮',
    '▚', '▞', '▙', '▛', '▜', '▝', '▟', '◴', '◵', '◶', '◷', '◸', '◹', '◺', '◼', '◽', '◾', '◿',
    '▀', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '╱', '╲', '╳', '▔', '▕',
    '◰', '◱', '◲', '◳', '✸', '✹', '✺', '✻', '✼', '✢', '✣', '✤', '✥', '⊕', '⊖',
    '⬒', '⬓', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗', '▰', '▱', '◬', '◭', '◮'
  ];

  // ====================== ПАЛІТРА КОЛЬОРІВ ДЛЯ СИМВОЛІВ ======================
  // Коли символ повторюється — беремо наступний колір з цієї палітри
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
    el.addEventListener('mouseleave', () => this.endCrop());

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
      schemeMode: this.schemeMode,
      colorCount: this.colorCount,
      symbolColors: JSON.parse(JSON.stringify(this.symbolColors)),
      materialList: JSON.parse(JSON.stringify(this.materialList))
    };

    // не дублюємо однакові стани
    const last = this.history[this.history.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(state)) {
      return;
    }

    if (this.history.length >= 20) {
      this.history.shift();
    }

    this.history.push(state);
  }

  undo(): void {
    if (this.history.length < 2) {
      return;
    }

    // видаляємо поточний стан
    this.history.pop();

    // беремо попередній
    const prevState = this.history[this.history.length - 1];

    this.imageSrc = prevState.imageSrc;
    this.pixelCount = prevState.pixelCount;
    this.schemeMode = prevState.schemeMode;
    this.colorCount = prevState.colorCount;

    this.symbolColors = JSON.parse(JSON.stringify(prevState.symbolColors || []));
    this.materialList = JSON.parse(JSON.stringify(prevState.materialList || []));

    if (this.imageSrc) {
      this.loadImage(this.imageSrc);
    }

    setTimeout(() => {
      if (this.symbolColors.length > 0) {
        this.generateNumberedScheme();
      } else {
        this.renderImage();
      }
    });
  }

  private resetState(): void {
    this.imageSrc = null;
    this.originalImage = null;
    this.pixelCount = 20;
    this.isCropping = false;
    this.cropStart = null;
    this.cropEnd = null;
    this.isMouseDown = false;
    this.resetDerivedState();
  }

  private resetDerivedState(): void {
    this.materialList = [];
    this.symbolColors = [];
  }

  private adjustCanvasSize(): void {
    if (!this.canvasRef?.nativeElement || !this.originalImage) return;

    const canvas = this.canvasRef.nativeElement;
    const aspectRatio = this.originalImage.width / this.originalImage.height;
    let newWidth = Math.min(800, this.originalImage.width);
    let newHeight = newWidth / aspectRatio;

    if (newHeight > 600) {
      newHeight = 600;
      newWidth = newHeight * aspectRatio;
    }

    if (isPlatformBrowser(this.platformId)) {
      const parentWidth = window.innerWidth * 0.95;
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

    this.renderImage();
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
    this.sliderValue = this.pixelCount;
    img.onload = () => {
      this.originalImage = img;
      const minSide = Math.min(img.width, img.height);

      this.maxPixelCount = Math.min(50, Math.floor(minSide / this.minCellSize));
      this.maxPixelCount = Math.max(this.maxPixelCount, this.minPixelCount);

      this.pixelCount = this.preservePixelCount
        ? Math.min(this.maxPixelCount, Math.max(this.minPixelCount, this.preservePixelCount))
        : 25;

      this.preservePixelCount = null;
      this.adjustCanvasSize();
      this.renderImage();
    };
    img.onerror = () => this.resetState();
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

  private drawSchemeOnCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    colInfo: any,
    rowInfo: any,
    data: Uint8ClampedArray
  ): void {

    const symbolMap: { [key: string]: any } = {};

    this.symbolColors.forEach(sc => {
      const key = `${sc.color.r},${sc.color.g},${sc.color.b}`;
      symbolMap[key] = sc;
    });

    for (let row = 0; row < rowInfo.starts.length; row++) {
      const py = rowInfo.starts[row];
      const blockH = rowInfo.sizes[row];

      for (let col = 0; col < colInfo.starts.length; col++) {
        const px = colInfo.starts[col];
        const blockW = colInfo.sizes[col];

        const avg = this.getBlockColor(px, py, blockW, blockH, data, width);

        const key = `${avg.r},${avg.g},${avg.b}`;
        const symbolInfo = symbolMap[key];

        // 🎨 ФОН (color або bw)
        if (this.schemeMode === 'color') {
          ctx.fillStyle = `rgb(${avg.r}, ${avg.g}, ${avg.b})`;
        } else {
          const gray = Math.round(0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b);
          ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        }

        ctx.fillRect(px, py, blockW, blockH);

        // 🔲 СІТКА
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.strokeRect(px, py, blockW, blockH);

        // 🔤 СИМВОЛ (ЗАВЖДИ, якщо є)
        if (symbolInfo) {
          ctx.fillStyle = symbolInfo.fillColor;
          ctx.font = `${Math.min(blockW, blockH) * 0.6}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.fillText(
            symbolInfo.symbol,
            px + blockW / 2,
            py + blockH / 2
          );
        }
      }
    }
  }

  private drawScheme(
    numCols: number,
    numRows: number,
    colInfo: any,
    rowInfo: any,
    data: Uint8ClampedArray,
    width: number
  ) {
    if (!this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / numCols;
    const cellH = canvas.height / numRows;

    ctx.font = `${Math.min(cellW, cellH) * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {

        const px = colInfo.starts[col];
        const py = rowInfo.starts[row];

        const idx = (py * width + px) * 4;

        const c = this.getClosestColor(
          data[idx],
          data[idx + 1],
          data[idx + 2]
        );

        const symbolInfo = this.symbolColors.find(s =>
          s.color.r === c.r &&
          s.color.g === c.g &&
          s.color.b === c.b
        );

        if (!symbolInfo) continue;

        const x = col * cellW;
        const y = row * cellH;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, cellW, cellH);

        ctx.strokeStyle = '#CCCCCC';
        ctx.strokeRect(x, y, cellW, cellH);

        ctx.fillStyle = symbolInfo.fillColor;
        ctx.fillText(
          symbolInfo.symbol,
          x + cellW / 2,
          y + cellH / 2
        );
      }
    }
  }

  renderImage(): void {
    if (!this.canvasRef?.nativeElement || !this.imageSrc || !this.originalImage) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    const width = this.originalImage.width;
    const height = this.originalImage.height;

    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(this.originalImage, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 🔹 збір кольорів
    const allColors: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < data.length; i += 4) {
      allColors.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2]
      });
    }

    // 🔹 палітра
    this.buildColorPalette(allColors);

    // 🔹 сітка
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

    tempCtx.clearRect(0, 0, width, height);

    for (let row = 0; row < numRows; row++) {
      const py = rowInfo.starts[row];
      const blockH = rowInfo.sizes[row];

      for (let col = 0; col < numCols; col++) {
        const px = colInfo.starts[col];
        const blockW = colInfo.sizes[col];

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

        let avg = this.getClosestColor(
          Math.round(sumR / count),
          Math.round(sumG / count),
          Math.round(sumB / count)
        );

        // 🔥 ТУТ ГОЛОВНЕ — режим
        if (this.schemeMode === 'bw') {
          const gray = Math.round(0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b);
          avg = { r: gray, g: gray, b: gray };
        }

        tempCtx.fillStyle = `rgb(${avg.r}, ${avg.g}, ${avg.b})`;
        tempCtx.fillRect(px, py, blockW, blockH);
      }
    }

    const scale = Math.min(canvas.width / width, canvas.height / height);
    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    ctx.drawImage(tempCanvas, offsetX, offsetY, width * scale, height * scale);
  }

  private mapSliderToPixelCount(value: number): number {
    const normalized = (value - this.minPixelCount) / (this.maxPixelCount - this.minPixelCount);
    const adjusted = Math.pow(normalized, 2.8);
    const maxEffective = 48;

    return Math.round(this.minPixelCount + adjusted * (maxEffective - this.minPixelCount));
  }

  updatePixelation(): void {
    if (!this.imageSrc || this.isCropping) return;

    this.saveState();

    const mappedValue = this.mapSliderToPixelCount(this.sliderValue);

    this.pixelCount = Math.min(
      this.maxPixelCount,
      Math.max(this.minPixelCount, mappedValue)
    );

    this.resetDerivedState();
    this.renderImage();
  }

  onSchemeModeChange(): void {
  this.saveState();
  this.resetDerivedState();
  this.renderImage();
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
    if (!this.isCropping || !this.cropStart || !this.cropEnd || !this.isMouseDown || !this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;
    if (!this.originalImage) return;

    let cropX = Math.min(this.cropStart.x, this.cropEnd.x);
    let cropY = Math.min(this.cropStart.y, this.cropEnd.y);
    let cropWidth = Math.abs(this.cropEnd.x - this.cropStart.x);
    let cropHeight = Math.abs(this.cropEnd.y - this.cropStart.y);

    cropWidth = Math.max(cropWidth, this.minCropSize);
    cropHeight = Math.max(cropHeight, this.minCropSize);

    if (this.aspectRatio) {
      if (cropWidth / cropHeight > this.aspectRatio) {
        cropWidth = cropHeight * this.aspectRatio;
      } else {
        cropHeight = cropWidth / this.aspectRatio;
      }
    }

    cropX = Math.max(0, Math.min(cropX, canvas.width - cropWidth));
    cropY = Math.max(0, Math.min(cropY, canvas.height - cropHeight));

    if (cropWidth < this.minCropSize || cropHeight < this.minCropSize) {
      this.isCropping = false;
      this.cropStart = null;
      this.cropEnd = null;
      this.isMouseDown = false;
      this.resetDerivedState();
      this.renderImage();
      return;
    }

    this.saveState();
    this.preservePixelCount = this.pixelCount;

    const scaleX = this.originalImage.width / canvas.width;
    const scaleY = this.originalImage.height / canvas.height;
    const origCropX = Math.round(cropX * scaleX);
    const origCropY = Math.round(cropY * scaleY);
    const origCropWidth = Math.round(cropWidth * scaleX);
    const origCropHeight = Math.round(cropHeight * scaleY);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    tempCanvas.width = origCropWidth;
    tempCanvas.height = origCropHeight;

    tempCtx.drawImage(
      this.originalImage,
      origCropX,
      origCropY,
      origCropWidth,
      origCropHeight,
      0,
      0,
      origCropWidth,
      origCropHeight
    );

    this.imageSrc = tempCanvas.toDataURL('image/png');
    this.isCropping = false;
    this.cropStart = null;
    this.cropEnd = null;
    this.isMouseDown = false;
    this.resetDerivedState();

    if (this.imageSrc) {
      this.loadImage(this.imageSrc);
    }
  }

  downloadImage(): void {
    const canvas = this.getCanvas();

    const originalCanvas = this.canvasRef.nativeElement;
    const safeFileName = (this.fileName || 'pixelated_image').replace(/[^a-zA-Z0-9_-]/g, '');

    let scaleFactor = 2;
    if (this.pixelCount > 80) scaleFactor = 3;
    if (this.pixelCount > 150) scaleFactor = 4;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalCanvas.width * scaleFactor;
    tempCanvas.height = originalCanvas.height * scaleFactor;

    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(originalCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

    if (this.downloadFormat === 'application/pdf') {
      const pdf = new jsPDF({
        orientation: tempCanvas.width > tempCanvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [tempCanvas.width, tempCanvas.height],
        compress: false
      });

      const imgData = tempCanvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, 0, tempCanvas.width, tempCanvas.height);

      pdf.save(`${safeFileName}.pdf`);
    } else {
      const mimeType = this.downloadFormat;
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const quality = mimeType === 'image/jpeg' ? 0.92 : 1.0;

      const dataUrl = tempCanvas.toDataURL(mimeType, quality);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${safeFileName}.${extension}`;
      link.click();
    }

    tempCanvas.remove();
  }

  rotateImage(): void {
    if (!this.originalImage || !this.canvasRef?.nativeElement) return;

    this.saveState();
    this.preservePixelCount = this.pixelCount;
    this.resetDerivedState();

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    tempCanvas.width = this.originalImage.height;
    tempCanvas.height = this.originalImage.width;

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(Math.PI / 2);
    tempCtx.drawImage(this.originalImage, -this.originalImage.width / 2, -this.originalImage.height / 2);

    this.imageSrc = tempCanvas.toDataURL('image/png');
    if (this.imageSrc) {
      this.loadImage(this.imageSrc);
    }
  }

  onMaterialTypeChange(): void {
    this.resetDerivedState();
  }

  private getCanvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }
  onGenerateScheme(): void {
  this.saveState();
  this.generateNumberedScheme();
}

  generateNumberedScheme(): void {
    if (!this.originalImage) return;

    const width = this.originalImage.width;
    const height = this.originalImage.height;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(this.originalImage, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // палітра
    const allColors: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < data.length; i += 4) {
      allColors.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2]
      });
    }

    this.buildColorPalette(allColors);

    // сітка
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

    const colorMap: any = {};

    for (let row = 0; row < numRows; row++) {
      const py = rowInfo.starts[row];
      const blockH = rowInfo.sizes[row];

      for (let col = 0; col < numCols; col++) {
        const px = colInfo.starts[col];
        const blockW = colInfo.sizes[col];

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

        const avg = this.getClosestColor(
          Math.round(sumR / count),
          Math.round(sumG / count),
          Math.round(sumB / count)
        );

        const key = `${avg.r},${avg.g},${avg.b}`;

        if (!colorMap[key]) {
          colorMap[key] = { r: avg.r, g: avg.g, b: avg.b, count: 0 };
        }

        colorMap[key].count++;
      }
    }

    const sortedColors = Object.values(colorMap)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, this.colorCount);

    // 🔥 КОНТРАСТ СИМВОЛІВ
    this.symbolColors = sortedColors.map((color: any, index: number) => {
      const brightness = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;

      return {
        symbol: this.symbolPool[index],
        color,
        fillColor: brightness < 128 ? '#FFFFFF' : '#000000'
      };
    });

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const scale = Math.min(scaleX, scaleY);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    this.drawSchemeOnCanvas(ctx, width, height, colInfo, rowInfo, data);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  findMaterials(): void {
    if (this.symbolColors.length === 0) {
      alert('Спочатку створіть схему з позначками кольорів');
      return;
    }

    const colorList = this.symbolColors.map(colorInfo => ({
      number: colorInfo.symbol,
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

    this.http.post<{ materials: MaterialResponse[] }>('http://localhost:8000/accounts/materials/',
      { colors: colorList, materialType: this.materialType },
      { headers }
    ).subscribe({
      next: (response) => {
        this.materialList = response.materials.map((m: MaterialResponse) => ({
          number: m.number,
          color: { r: parseInt(m.color.r), g: parseInt(m.color.g), b: parseInt(m.color.b) },
          materials: m.materials
        }));
      },
      error: (error) => {
        alert('Не вдалося знайти матеріали: ' + (error.error?.error || error.message));
      }
    });
  }

  saveSketch(): void {
    if (!this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const sketchData = {
      image: canvas.toDataURL('image/png'),
      caption: this.fileName,
      materialList: this.materialList
    };
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-CSRFToken': this.getCsrfToken(),
      ...(isPlatformBrowser(this.platformId) && localStorage.getItem('token')
        ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        : {})
    });
    this.http.post('http://localhost:8000/accounts/sketches/', sketchData, { headers }).subscribe({
      next: (response) => console.log('Sketch saved:', response),
      error: (error) => console.error('Failed to save sketch:', error)
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