export interface AnimationFrame {
  id: string;
  duration: number; // ms
}

export interface OnionSkinSettings {
  enabled: boolean;
  prev: number;
  next: number;
  opacity: number; // 0..1
}

export interface AnimationState {
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  onion: OnionSkinSettings;
}