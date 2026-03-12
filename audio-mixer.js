/*
   ===== VIDEO ELEMENT =====              ===== MIC INPUT =====
            │                                       │
            ▼                                       ▼
    createMediaElementSource                    micSource
            │                                       │
            ▼                                       ▼
        videoGain                   ┌─────────  micGain → micAnalizer
        │      │                    │               │
        │   videoToHeadphoneGain    │      micToHeadhponesGain
        │      │                    │               │
        │      └────────────────────────────────┐   │
        ▼                           │           ▼   ▼
    masterGain <─── micMuteGain ────┘        headphoneGain
     │     │                                       │
     │     ▼                                       ▼
     ▼   masterAnalyser                     headphoneDest → headphones device
 masterDest
     │
     ▼
 masterAudio → speaker device
 */
export class AudioMixer {
    constructor() {
        this.ctx = new AudioContext();
        this.micGain = this.ctx.createGain();
        this.micGain.gain.value = 1;
        this.micMuteGain = this.ctx.createGain();
        this.micMuteGain.gain.value = 0;
        this.videoGain = this.ctx.createGain();
        this.videoGain.gain.value = 1;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1;
        this.headphoneGain = this.ctx.createGain();
        this.headphoneGain.gain.value = 1;
        this.micToHeadphoneGain = this.ctx.createGain();
        this.micToHeadphoneGain.gain.value = 0;
        this.videoToHeadphoneGain = this.ctx.createGain();
        this.videoToHeadphoneGain.gain.value = 1;
        this.micAnalyser = this.ctx.createAnalyser();
        this.masterAnalyser = this.ctx.createAnalyser();
        this.micAnalyser.fftSize = 256;
        this.masterAnalyser.fftSize = 256;
        this.masterDest = this.ctx.createMediaStreamDestination();
        this.headphoneDest = this.ctx.createMediaStreamDestination();
        this.masterAudio = new Audio();
        this.headphoneAudio = new Audio();
        this.masterAudio.srcObject = this.masterDest.stream;
        this.headphoneAudio.srcObject = this.headphoneDest.stream;
        this.masterAudio.autoplay = true;
        this.headphoneAudio.autoplay = true;
        this.masterAudio.muted = false;
        this.headphoneAudio.muted = false;
        this.masterAudio.play().catch(() => { });
        this.headphoneAudio.play().catch(() => { });
        // Routing
        this.micGain.connect(this.micAnalyser);
        this.micGain.connect(this.micMuteGain);
        this.micMuteGain.connect(this.masterGain);
        this.micGain.connect(this.micToHeadphoneGain);
        this.micToHeadphoneGain.connect(this.headphoneGain);
        this.videoGain.connect(this.masterGain);
        this.videoGain.connect(this.videoToHeadphoneGain);
        this.videoToHeadphoneGain.connect(this.headphoneGain);
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.masterDest);
        this.headphoneGain.connect(this.headphoneDest);
    }
    attachMediaElement(el) {
        if (this.videoSource) {
            console.error('Player already attached.');
            return;
        }
        this.videoSource = this.ctx.createMediaElementSource(el);
        this.videoSource.connect(this.videoGain);
    }
    async startMic(deviceId) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId },
        });
        this.micSource = this.ctx.createMediaStreamSource(stream);
        this.stereoMic = forceMonoToStereo(this.ctx, this.micSource);
        this.stereoMic.connect(this.micGain);
    }
    muteMic() {
        this.micMuteGain.gain.value = 0;
    }
    unmuteMic() {
        this.micMuteGain.gain.value = 1;
    }
    isMicMuted() {
        return this.micMuteGain.gain.value === 0;
    }
    previewMic(on) {
        if (on) {
            this.micToHeadphoneGain.gain.value = 1;
            this.videoToHeadphoneGain.gain.value = 0;
        }
        else {
            this.micToHeadphoneGain.gain.value = 0;
            this.videoToHeadphoneGain.gain.value = 1;
        }
    }
    setMasterVolume(percent) {
        const gain = Math.min(percent / 100, 3);
        this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }
    async setMasterSpeaker(deviceId) {
        const audio = this.masterAudio;
        if (deviceId === 'none') {
            this.masterGain.gain.value = 0;
            return;
        }
        else
            this.masterGain.gain.value = 1;
        if (audio.setSinkId)
            await audio.setSinkId(deviceId);
    }
    async setHeadphones(deviceId) {
        const audio = this.headphoneAudio;
        if (deviceId === 'none') {
            this.headphoneGain.gain.value = 0;
            return;
        }
        else
            this.headphoneGain.gain.value = 1;
        if (audio.setSinkId)
            await audio.setSinkId(deviceId);
    }
    getMicLevel() {
        return getAudioLevel(this.micAnalyser);
    }
    getMasterLevel() {
        return getAudioLevel(this.masterAnalyser);
    }
    async resume() {
        if (this.ctx.state !== 'running') {
            await this.ctx.resume();
        }
        if (this.masterAudio.paused) {
            try {
                await this.masterAudio.play();
            }
            catch { }
        }
        if (this.headphoneAudio.paused) {
            try {
                await this.headphoneAudio.play();
            }
            catch { }
        }
    }
}
// ===== Utility Functions =====
function forceMonoToStereo(audioContext, sourceNode) {
    const splitter = audioContext.createChannelSplitter(2);
    const merger = audioContext.createChannelMerger(2);
    sourceNode.connect(splitter);
    // duplicate channel 0 to L and R
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 0, 1);
    return merger;
}
function getAudioLevel(analyser) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return rms;
}
// =====
// ===== Audio Meter =====
// =====
// Draw the segmented dB meter with peak indicator
export function drawDbMeter(ctx, xOffset, xWidth, volume, muted) {
    const dB = Math.max(-100, Math.min(0, Math.log10(volume) * 20));
    const canvasHeight = 100;
    // Define dB ranges and colors
    const dbRanges = [
        { min: -100, max: -90, frac: 0.07, colorOn: '#008000', colorOff: '#008080' },
        { min: -90, max: -36, frac: 0.28, colorOn: '#008000', colorOff: '#008080' },
        { min: -36, max: -18, frac: 0.25, colorOn: '#00c000', colorOff: '#00c0c0' },
        { min: -18, max: -6, frac: 0.25, colorOn: '#00ff00', colorOff: '#00ffff' },
        { min: -6, max: -1, frac: 0.12, colorOn: '#ffff00', colorOff: '#faff74' },
        { min: -1, max: 0, frac: 0.03, colorOn: '#ff0000', colorOff: '#ff0000' },
    ];
    let accumulatedHeight = 0; // Track filled height
    dbRanges.forEach((range) => {
        if (dB >= range.min) {
            const rangeHeight = range.frac * canvasHeight;
            // Calculate the portion of this range to be filled
            const filledFraction = Math.min(dB, range.max) - range.min;
            const filledHeight = (filledFraction / (range.max - range.min)) * rangeHeight;
            // Draw the segment for this range
            ctx.fillStyle = muted ? range.colorOff : range.colorOn;
            ctx.fillRect(xOffset, canvasHeight - accumulatedHeight - filledHeight, xWidth, filledHeight);
            accumulatedHeight += rangeHeight;
        }
    });
}
