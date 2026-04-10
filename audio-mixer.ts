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

const BUFF_SIZE = 64;
const SMOOTHING_TIME = 0.8;

export class AudioMixer {
    private ctx: AudioContext;

    private videoSource?: MediaElementAudioSourceNode;
    private micSource?: MediaStreamAudioSourceNode;
    private micInput: GainNode;
    private stereoMic: ChannelMergerNode;

    private masterDest: MediaStreamAudioDestinationNode;
    private headphoneDest: MediaStreamAudioDestinationNode;

    private micGain: GainNode;
    private micMuteGain: GainNode;
    private videoGain: GainNode;
    private masterGain: GainNode;

    private headphoneGain: GainNode;
    private micToHeadphoneGain: GainNode;
    private videoToHeadphoneGain: GainNode;

    private micAnalyser: AnalyserNode;
    private videoAnalyserL: AnalyserNode;
    private videoAnalyserR: AnalyserNode;
    private masterAnalyserL: AnalyserNode;
    private masterAnalyserR: AnalyserNode;

    private masterAudio: HTMLAudioElement;
    private headphoneAudio: HTMLAudioElement;

    constructor() {
        this.ctx = new AudioContext();

        this.micGain = this.ctx.createGain();
        this.micGain.gain.value = 1;

        this.micInput = this.ctx.createGain();
        this.micInput.gain.value = 1;

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
        this.videoAnalyserL = this.ctx.createAnalyser();
        this.videoAnalyserR = this.ctx.createAnalyser();
        this.masterAnalyserL = this.ctx.createAnalyser();
        this.masterAnalyserR = this.ctx.createAnalyser();

        this.micAnalyser.fftSize = BUFF_SIZE * 2;
        this.videoAnalyserL.fftSize = BUFF_SIZE * 2;
        this.videoAnalyserR.fftSize = BUFF_SIZE * 2;
        this.masterAnalyserL.fftSize = BUFF_SIZE * 2;
        this.masterAnalyserR.fftSize = BUFF_SIZE * 2;

        this.micAnalyser.smoothingTimeConstant = SMOOTHING_TIME;
        this.videoAnalyserL.smoothingTimeConstant = SMOOTHING_TIME;
        this.videoAnalyserR.smoothingTimeConstant = SMOOTHING_TIME;
        this.masterAnalyserL.smoothingTimeConstant = SMOOTHING_TIME;
        this.masterAnalyserR.smoothingTimeConstant = SMOOTHING_TIME;

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

        this.masterAudio.play().catch(() => {});
        this.headphoneAudio.play().catch(() => {});

        // Routing
        const micInputSplitter = this.ctx.createChannelSplitter(2);
        this.stereoMic = this.ctx.createChannelMerger(2);
        this.micInput.connect(micInputSplitter);
        micInputSplitter.connect(this.stereoMic, 0, 0);
        micInputSplitter.connect(this.stereoMic, 0, 1);
        this.stereoMic.connect(this.micGain);

        this.micGain.connect(this.micAnalyser);
        this.micGain.connect(this.micMuteGain);
        this.micMuteGain.connect(this.masterGain);
        this.micGain.connect(this.micToHeadphoneGain);
        this.micToHeadphoneGain.connect(this.headphoneGain);

        const videoSplitter = this.ctx.createChannelSplitter(2);
        this.videoGain.connect(videoSplitter);
        videoSplitter.connect(this.videoAnalyserL, 0);
        videoSplitter.connect(this.videoAnalyserR, 1);
        this.videoGain.connect(this.masterGain);
        this.videoGain.connect(this.videoToHeadphoneGain);
        this.videoToHeadphoneGain.connect(this.headphoneGain);

        const masterSplitter = this.ctx.createChannelSplitter(2);
        this.masterGain.connect(masterSplitter);
        masterSplitter.connect(this.masterAnalyserL, 0);
        masterSplitter.connect(this.masterAnalyserR, 1);
        this.masterGain.connect(this.masterDest);
        this.headphoneGain.connect(this.headphoneDest);
    }

    attachMediaElement(el: HTMLMediaElement) {
        if (this.videoSource) {
            console.error('Player already attached.');
            return;
        }
        this.videoSource = this.ctx.createMediaElementSource(el);
        this.videoSource.connect(this.videoGain);
    }

    async startMic(deviceId: string) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId },
        });

        this.micSource?.disconnect();
        this.micSource = this.ctx.createMediaStreamSource(stream);
        this.micSource.connect(this.micInput);
    }

    setMicGain(gain: number) {
        console.assert(gain >= 0 && gain <= 6, gain);
        this.micGain.gain.value = Math.max(0, Math.min(gain, 6));
    }

    setVideoGain(gain: number) {
        console.assert(gain >= 0 && gain <= 6, gain);
        this.videoGain.gain.value = Math.max(0, Math.min(gain, 6));
    }

    getVideoGain() {
        return this.videoGain.gain.value;
    }

    getVideoLevel() {
        return getAudioLevel(this.videoAnalyserL, this.videoAnalyserR);
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

    previewMic(on: boolean) {
        if (on) {
            this.micToHeadphoneGain.gain.value = 1;
            this.videoToHeadphoneGain.gain.value = 0;
        } else {
            this.micToHeadphoneGain.gain.value = 0;
            this.videoToHeadphoneGain.gain.value = 1;
        }
    }

    setMasterVolume(percent: number) {
        const gain = Math.min(percent / 100, 3);

        this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }

    async setMasterSpeaker(deviceId: string) {
        const audio = this.masterAudio as any;

        if (deviceId === '') {
            this.masterGain.gain.value = 0;
            return;
        } else this.masterGain.gain.value = 1;

        if (audio.setSinkId) await audio.setSinkId(deviceId);
    }

    async setHeadphones(deviceId: string) {
        const audio = this.headphoneAudio as any;

        if (deviceId === '') {
            this.headphoneGain.gain.value = 0;
            return;
        } else this.headphoneGain.gain.value = 1;

        if (audio.setSinkId) await audio.setSinkId(deviceId);
    }

    getMicLevel() {
        return getAudioLevel(this.micAnalyser, this.micAnalyser);
    }

    getMasterLevel() {
        return getAudioLevel(this.masterAnalyserL, this.masterAnalyserR);
    }

    async resume() {
        if (this.ctx.state !== 'running') {
            await this.ctx.resume();
        }

        if (this.masterAudio.paused) {
            try {
                await this.masterAudio.play();
            } catch {}
        }

        if (this.headphoneAudio.paused) {
            try {
                await this.headphoneAudio.play();
            } catch {}
        }
    }
}

// ===== Utility Functions =====

function getAudioLevel(analyserL: AnalyserNode, analyserR: AnalyserNode): [number, number] {
    const dataL = new Float32Array(analyserL.fftSize);
    const dataR = new Float32Array(analyserR.fftSize);

    analyserL.getFloatTimeDomainData(dataL);
    analyserR.getFloatTimeDomainData(dataR);

    const leftDb = getDbFromTimeData(dataL);
    const rightDb = getDbFromTimeData(dataR);
    return [leftDb, rightDb];
}

function getDbFromTimeData(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i] ** 2;
    }
    const rms = Math.sqrt(sum / data.length) * 2.3; // Apply gain
    const dB = 20 * Math.log10(rms + 1e-10); // Avoid log(0) error
    return Math.min(0, dB);
}

// =====
// ===== Audio Meter =====
// =====

// Draw the segmented dB meter with peak indicator
export function drawDbMeter(
    canvas: HTMLCanvasElement,
    leftDb: number,
    rightdB: number,
    muted: boolean,
) {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawDbMeterHelper(canvas, ctx, true, leftDb, muted);
    drawDbMeterHelper(canvas, ctx, false, rightdB, muted);
}

function drawDbMeterHelper(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    isLeft: boolean,
    dB: number,
    muted: boolean,
) {
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
            const rangeHeight = range.frac * canvas.height;

            // Calculate the portion of this range to be filled
            const filledFraction = Math.min(dB, range.max) - range.min;
            const filledHeight = (filledFraction / (range.max - range.min)) * rangeHeight;

            // Draw the segment for this range
            ctx.fillStyle = muted ? range.colorOff : range.colorOn;
            ctx.fillRect(
                (isLeft ? 0 : 0.55) * canvas.width,
                canvas.height - accumulatedHeight - filledHeight,
                0.45 * canvas.width,
                filledHeight,
            );
            accumulatedHeight += rangeHeight;
        }
    });
}
