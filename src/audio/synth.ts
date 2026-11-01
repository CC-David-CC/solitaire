export class SynthAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = true;
  private volume = .35;

  unlock(): void {
    if (typeof AudioContext === "undefined") return;
    if (this.context === null) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume();
    this.muted = false;
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume || 0));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master !== null) this.master.gain.value = this.muted ? 0 : this.volume * .12;
  }

  private tone(frequency: number, durationMs: number, type: OscillatorType = "triangle", delay = 0): void {
    if (this.context === null || this.master === null || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;
    const end = start + durationMs / 1000;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.35, start + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(end + .01);
  }

  place(): void {
    this.tone(360, 45);
  }

  draw(): void {
    this.tone(220, 35, "square");
  }

  invalid(): void {
    this.tone(145, 100, "sawtooth");
  }

  hint(): void {
    this.tone(520, 70);
  }

  win(): void {
    [392, 494, 587, 784].forEach((frequency, index) => this.tone(frequency, 180, "triangle", index * .1));
  }

  suspend(): void {
    if (this.context?.state === "running") void this.context.suspend();
  }

  resume(): void {
    if (this.context?.state === "suspended" && !this.muted) void this.context.resume();
  }

  dispose(): void {
    const context = this.context;
    this.context = null;
    this.master = null;
    if (context !== null) void context.close();
  }
}
