import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SketchTransferService {
  private sketchImage: string | null = null;
  private disableControlsFlag = false;

  setSketch(dataUrl: string, disableControls: boolean = true): void {
    this.sketchImage = dataUrl;
    this.disableControlsFlag = disableControls;
  }

  getAndClearSketch(): string | null {
    const data = this.sketchImage;
    this.sketchImage = null;        // очищаємо після використання
    return data;
  }

  shouldDisableControls(): boolean {
    return this.disableControlsFlag;
  }
}