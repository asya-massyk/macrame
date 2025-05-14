import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pixelation',
  templateUrl: './pixelation.component.html',
  standalone: true,
  styleUrls: ['./pixelation.component.scss'],
  imports: [NgIf, FormsModule],
})
export class PixelationComponent implements AfterViewInit {
  @ViewChild('pixelationCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  imageSrc: string | null = null;
  pixelCount: number = 20;
  minPixelCount: number = 5;
  maxPixelCount: number = 100;
  isCropping: boolean = false;
  fileName: string = 'pixelated_image';
  downloadFormat: string = 'image/png';
  private cropStart: { x: number; y: number } | null = null;
  private cropEnd: { x: number; y: number } | null = null;
  private originalImage: HTMLImageElement | null = null;
  private isMouseDown: boolean = false;
  private minCropSize: number = 10;
  private aspectRatio: number | null = null;
  private maxHeight: number = window.innerHeight - 195;
  public history: { imageSrc: string; pixelCount: number; imageWidth: number; imageHeight: number }[] = [];

  ngAfterViewInit(): void {
    window.addEventListener('resize', () => this.adjustCanvasSize());
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
      console.log('State saved:', { historyLength: this.history.length });
    }
  }

  undo(): void {
    if (this.history.length === 0) return;

    const lastState = this.history.pop();
    if (lastState) {
      this.imageSrc = lastState.imageSrc;
      this.pixelCount = lastState.pixelCount;
      this.loadImage(this.imageSrc);
      console.log('Undo:', { pixelCount: this.pixelCount, historyLength: this.history.length });
    }
  }

  private adjustCanvasSize(): void {
    if (!this.canvasRef?.nativeElement || !this.originalImage) return;

    const canvas = this.canvasRef.nativeElement;
    const aspectRatio = this.originalImage.width / this.originalImage.height;
    let newWidth = Math.min(800, this.originalImage.width); // Фіксований максимум 800px
    let newHeight = newWidth / aspectRatio;

    if (newHeight > 600) { // Фіксований максимум 600px
      newHeight = 600;
      newWidth = newHeight * aspectRatio;
    }

    const parentWidth = window.innerWidth * 0.95;
    if (newWidth > parentWidth) {
      newWidth = parentWidth;
      newHeight = newWidth / aspectRatio;
    }

    canvas.width = Math.round(newWidth);
    canvas.height = Math.round(newHeight);
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;
    canvas.style.margin = '0 auto'; // Центрування canvas

    console.log('adjustCanvasSize:', { width: canvas.width, height: canvas.height, parentWidth, aspectRatio });
    this.renderImage();
  }

  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        console.error('Image too large (max 5MB)');
        alert('Зображення занадто велике (максимум 5MB)');
        return;
      }
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        console.error('Invalid format (JPEG/PNG only)');
        alert('Непідтримуваний формат (тільки JPEG або PNG)');
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxWidth = 3000;
        const maxHeight = 3000;
        if (img.width > maxWidth || img.height > maxHeight) {
          console.error(`Image dimensions too large (max ${maxWidth}x${maxHeight})`);
          alert(`Розмір зображення занадто великий (максимум ${maxWidth}x${maxHeight} пікселів)`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          this.history = [];
          this.imageSrc = reader.result as string;
          this.loadImage(this.imageSrc);
        };
        reader.readAsDataURL(file);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.error('Failed to load image for validation');
        alert('Не вдалося завантажити зображення');
      };
    }
  }

  private loadImage(src: string): void {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      this.originalImage = img;
      this.maxPixelCount = Math.max(100, Math.floor(Math.min(img.width, img.height) / 5));
      this.pixelCount = Math.min(this.maxPixelCount, Math.max(this.minPixelCount, 20));
      console.log('loadImage:', { 
        width: img.width, 
        height: img.height, 
        maxPixelCount: this.maxPixelCount, 
        pixelCount: this.pixelCount 
      });
      this.adjustCanvasSize();
      this.renderImage();
    };
    img.onerror = () => {
      console.error('Failed to load image');
      this.imageSrc = null;
      this.originalImage = null;
    };
  }

  private renderImage(): void {
    if (!this.canvasRef?.nativeElement || !this.imageSrc || !this.originalImage) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = this.originalImage.width;
    tempCanvas.height = this.originalImage.height;
    tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);

    const pixelSize = Math.min(tempCanvas.width, tempCanvas.height) / this.pixelCount;
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    for (let y = 0; y < tempCanvas.height; y += pixelSize) {
      for (let x = 0; x < tempCanvas.width; x += pixelSize) {
        const pixelIndex = (Math.floor(y) * tempCanvas.width + Math.floor(x)) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const a = data[pixelIndex + 3];
        tempCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        tempCtx.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    const scale = Math.min(canvas.width / tempCanvas.width, canvas.height / tempCanvas.height);
    const drawWidth = tempCanvas.width * scale;
    const drawHeight = tempCanvas.height * scale;
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;

    ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);

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

    console.log('renderImage:', { 
      pixelCount: this.pixelCount,
      pixelSize: pixelSize,
      canvasSize: { width: canvas.width, height: canvas.height },
      drawSize: { width: drawWidth, height: drawHeight },
      offset: { x: offsetX, y: offsetY }
    });
  }

  updatePixelation(): void {
    if (this.imageSrc && !this.isCropping) {
      this.saveState();
      this.pixelCount = Math.min(this.maxPixelCount, Math.max(this.minPixelCount, Math.round(this.pixelCount)));
      console.log('updatePixelation:', { pixelCount: this.pixelCount });
      this.renderImage();
    }
  }

  startCropping(): void {
    this.isCropping = true;
    this.cropStart = null;
    this.cropEnd = null;
    this.isMouseDown = false;
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
      this.renderImage();
      return;
    }

    this.saveState();

    const scaleX = this.originalImage.width / canvas.width;
    const scaleY = this.originalImage.height / canvas.height;
    const origCropX = Math.round(cropX * scaleX);
    const origCropY = Math.round(cropY * scaleY);
    const origCropWidth = Math.round(cropWidth * scaleX);
    const origCropHeight = Math.round(cropHeight * scaleY);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
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

    const pixelSize = Math.min(origCropWidth, origCropHeight) / this.pixelCount;
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    for (let y = 0; y < tempCanvas.height; y += pixelSize) {
      for (let x = 0; x < tempCanvas.width; x += pixelSize) {
        const pixelIndex = (Math.floor(y) * tempCanvas.width + Math.floor(x)) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const a = data[pixelIndex + 3];
        tempCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        tempCtx.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    this.imageSrc = tempCanvas.toDataURL('image/png');
    this.isCropping = false;
    this.cropStart = null;
    this.cropEnd = null;
    this.isMouseDown = false;

    this.loadImage(this.imageSrc);
    console.log('endCrop:', { origCropX, origCropY, origCropWidth, origCropHeight, pixelSize });
  }

  downloadImage(): void {
    if (!this.canvasRef?.nativeElement) return;

    const canvas = this.canvasRef.nativeElement;
    const safeFileName = (this.fileName || 'pixelated_image').replace(/[^a-zA-Z0-9_-]/g, '');
    const link = document.createElement('a');
    link.href = canvas.toDataURL(this.downloadFormat, this.downloadFormat === 'image/jpeg' ? 0.8 : 1);
    link.download = `${safeFileName}.${this.downloadFormat === 'image/jpeg' ? 'jpg' : 'png'}`;
    link.click();
  }

  rotateImage(): void {
    if (!this.originalImage || !this.canvasRef?.nativeElement) return;

    this.saveState();

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = this.originalImage.height;
    tempCanvas.height = this.originalImage.width;

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(Math.PI / 2);
    tempCtx.drawImage(this.originalImage, -this.originalImage.width / 2, -this.originalImage.height / 2);

    this.originalImage = new Image();
    this.originalImage.src = tempCanvas.toDataURL('image/png');
    this.originalImage.onload = () => {
      this.imageSrc = this.originalImage?.src || null;
      if (this.imageSrc) {
        this.loadImage(this.imageSrc);
      }
    };
  }
}