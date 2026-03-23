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
  @ViewChild('pixelationCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  imageSrc: string | null = null;
  pixelCount: number = 25;
  minPixelCount: number = 8;
  maxPixelCount: number = 50;
  isCropping: boolean = false;
  fileName: string = 'pixelated_image';
  downloadFormat: string = 'image/png';
  sliderValue: number = 25;
  materialType: string = 'beads';
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

  private cropStart: { x: number; y: number } | null = null;
  private cropEnd: { x: number; y: number } | null = null;
  private originalImage: HTMLImageElement | null = null;
  private isMouseDown: boolean = false;
  private minCropSize: number = 10;
  private aspectRatio: number | null = null;
  private preservePixelCount: number | null = null;
  public history: { imageSrc: string; pixelCount: number; imageWidth: number; imageHeight: number }[] = [];
  private minCellSize = 20;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', () => this.adjustCanvasSize());
      const canvas = this.canvasRef.nativeElement;
      canvas.addEventListener('mousedown', (e) => this.startCrop(e));
      canvas.addEventListener('mousemove', (e) => this.updateCrop(e));
      canvas.addEventListener('mouseup', () => this.endCrop());
      canvas.addEventListener('mouseleave', () => this.endCrop());
    }
    this.adjustCanvasSize();
  }

  private saveState(): void {
    if (this.imageSrc && this.originalImage) {
      if (this.history.length >= 10) {
        this.history.shift();
      }
      this.history.push({
        imageSrc: this.imageSrc,
        pixelCount: this.pixelCount,
        imageWidth: this.originalImage.width,
        imageHeight: this.originalImage.height,
      });
    }
  }

  undo(): void {
    if (this.history.length === 0) {
      this.resetState();
      return;
    }

    const lastState = this.history.pop();
    if (lastState) {
      this.imageSrc = lastState.imageSrc;
      this.pixelCount = lastState.pixelCount;
      this.resetDerivedState();
      this.loadImage(this.imageSrc);
    }
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


  private renderImage(): void {
    if (!this.canvasRef?.nativeElement || !this.imageSrc || !this.originalImage) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    tempCanvas.width = this.originalImage.width;
    tempCanvas.height = this.originalImage.height;
    tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    const width = tempCanvas.width;
    const height = tempCanvas.height;
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

        let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
        const count = blockW * blockH;
        for (let iy = py; iy < py + blockH; iy++) {
          for (let ix = px; ix < px + blockW; ix++) {
            const idx = (iy * width + ix) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            sumA += data[idx + 3];
          }
        }
        const avgR = count > 0 ? Math.round(sumR / count) : 0;
        const avgG = count > 0 ? Math.round(sumG / count) : 0;
        const avgB = count > 0 ? Math.round(sumB / count) : 0;
        const avgA = count > 0 ? sumA / count / 255 : 0;

        tempCtx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`;
        tempCtx.fillRect(px, py, blockW, blockH);
      }
    }

    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    ctx.drawImage(tempCanvas, offsetX, offsetY, width * scale, height * scale);

    if (this.symbolColors.length > 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

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
          const avgR = count > 0 ? Math.round(sumR / count) : 0;
          const avgG = count > 0 ? Math.round(sumG / count) : 0;
          const avgB = count > 0 ? Math.round(sumB / count) : 0;

          const colorInfo = this.symbolColors.find(c =>
            c.color.r === avgR && c.color.g === avgG && c.color.b === avgB
          );

          if (colorInfo) {
            const displayedW = blockW * scale;
            const displayedH = blockH * scale;
            const fontSize = Math.min(displayedW, displayedH) * 0.78;

            ctx.font = `bold ${fontSize}px Arial, Helvetica, "Segoe UI Symbol", sans-serif`;

            const centerX = Math.round(offsetX + (px + blockW / 2) * scale);
            const centerY = Math.round(offsetY + (py + blockH / 2) * scale);

            // Обводка
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(3.5, fontSize * 0.16);
            ctx.strokeText(colorInfo.symbol, centerX, centerY);

            // Заповнення — використовуємо заздалегідь збережений колір
            ctx.fillStyle = colorInfo.fillColor || '#000000';
            ctx.fillText(colorInfo.symbol, centerX, centerY);
          }
        }
      }
    }
    // ────────────────────────────────────────────────
    //               Обрізка (crop) — без змін
    // ────────────────────────────────────────────────
    if (this.isCropping && this.cropStart && this.cropEnd && this.isMouseDown) {
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

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#3344dc';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(cropX, cropY, cropWidth, cropHeight);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private mapSliderToPixelCount(value: number): number {
    const normalized = (value - this.minPixelCount) / (this.maxPixelCount - this.minPixelCount);
    const adjusted = Math.pow(normalized, 2.8);
    const maxEffective = 48;

    return Math.round(this.minPixelCount + adjusted * (maxEffective - this.minPixelCount));
  }

  updatePixelation(): void {
    if (this.imageSrc && !this.isCropping) {
      this.saveState();

      const mappedValue = this.mapSliderToPixelCount(this.sliderValue);

      this.pixelCount = Math.min(
        this.maxPixelCount,
        Math.max(this.minPixelCount, mappedValue)
      );

      this.resetDerivedState();
      this.renderImage();
    }
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

    this.loadImage(this.imageSrc);
  }

  downloadImage(): void {
    if (!this.canvasRef?.nativeElement) return;

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
    this.loadImage(this.imageSrc);
  }

  onMaterialTypeChange(): void {
    this.resetDerivedState();
  }

  generateNumberedScheme(): void {
    if (!this.originalImage) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    tempCanvas.width = this.originalImage.width;
    tempCanvas.height = this.originalImage.height;
    tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    const width = tempCanvas.width;
    const height = tempCanvas.height;
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

    const colorCounts: { [key: string]: { r: number; g: number; b: number; count: number } } = {};

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
        const avgR = count > 0 ? Math.round(sumR / count) : 0;
        const avgG = count > 0 ? Math.round(sumG / count) : 0;
        const avgB = count > 0 ? Math.round(sumB / count) : 0;
        const key = `${avgR},${avgG},${avgB}`;
        if (!colorCounts[key]) {
          colorCounts[key] = { r: avgR, g: avgG, b: avgB, count: 0 };
        }
        colorCounts[key].count++;
      }
    }

    const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);

    // === НОВА ЛОГІКА ===
    const baseSymbols = this.symbolPool.slice(0, 18);           // перші 18 — "базові" (чорно-білі)
    const extraSymbols = this.symbolPool.slice(18);

    this.symbolColors = sortedColors.map((color, index) => {
      let symbol: string;
      let fillColor: string = '#000000';   // за замовчуванням чорний

      if (index < baseSymbols.length) {
        // Перші N кольорів — тільки базові символи + чорний/білий
        symbol = baseSymbols[index];

        const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
        fillColor = luminance < 130 ? '#FFFFFF' : '#000000';
      }
      else {
        // Коли символів не вистачає — починаємо повторювати + використовувати кольорову палітру
        const extraIndex = index - baseSymbols.length;
        symbol = extraSymbols[extraIndex % extraSymbols.length];

        // Колір з палітри (циклічно)
        fillColor = this.symbolFillPalette[extraIndex % this.symbolFillPalette.length];
      }

      return {
        symbol,
        color: { r: color.r, g: color.g, b: color.b },
        fillColor   // зберігаємо колір заливки в об'єкті
      };
    });

    this.renderImage();
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