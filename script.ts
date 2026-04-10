import { AudioMixer, drawDbMeter } from './audio-mixer.js';

declare global {
    interface Window {
        electronAPI: {
            setupObs: (transformation: any, sceneName: string) => Promise<any>;
        };
    }
}

const mixer = new AudioMixer();

const player = document.getElementById('player') as HTMLVideoElement;
mixer.attachMediaElement(player);

const cameraPreview = document.getElementById('camera-preview') as HTMLVideoElement;

const cameraSelect = document.getElementById('camera') as HTMLSelectElement;
const micSelect = document.getElementById('mic') as HTMLSelectElement;
const masterSelect = document.getElementById('master') as HTMLSelectElement;
const headphonesSelect = document.getElementById('headphones') as HTMLSelectElement;

const cameraBtn = document.getElementById('cameraBtn') as HTMLButtonElement;
const videoBtn = document.getElementById('videoBtn') as HTMLButtonElement;

let currentCameraStream: MediaStream | null = null;
let mainCameraStream: MediaStream | null = null;

async function loadDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const cams = devices.filter((d) => d.kind === 'videoinput');
    const mics = devices.filter((d) => d.kind === 'audioinput');
    const outs = devices.filter((d) => d.kind === 'audiooutput');

    fill(cameraSelect, cams);
    fill(micSelect, mics);
    fill(masterSelect, outs, true);
    fill(headphonesSelect, outs, true);

    const selectedCamera = localStorage.getItem('selectedCamera');
    if (selectedCamera) cameraSelect.value = selectedCamera;
    await setCamera(cameraSelect.value);

    const selectedMic = localStorage.getItem('selectedMic');
    if (selectedMic) micSelect.value = selectedMic;
    setMic(micSelect.value);

    const selectedMaster = localStorage.getItem('selectedMaster');
    if (selectedMaster) masterSelect.value = selectedMaster;
    setMasterSpeaker(masterSelect.value);

    const selectedHeadphones = localStorage.getItem('selectedHeadphones');
    if (selectedHeadphones) headphonesSelect.value = selectedHeadphones;
    setHeadphones(headphonesSelect.value);
}

function fill(select: HTMLSelectElement, devices: any[], addNone = false) {
    select.innerHTML = '';

    if (addNone) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.text = 'None';
        select.appendChild(opt);
    }

    devices.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.text = d.label || d.kind;

        select.appendChild(opt);
    });
}

cameraSelect.onchange = () => setCamera(cameraSelect.value);
micSelect.onchange = () => setMic(micSelect.value);
masterSelect.onchange = () => setMasterSpeaker(masterSelect.value);
headphonesSelect.onchange = () => setHeadphones(headphonesSelect.value);

async function setCamera(id: string) {
    if (!id) return;

    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: id } },
            audio: false,
        });

        const track = stream.getVideoTracks()[0];

        track.onended = () => {
            console.log('Camera disconnected');
        };

        currentCameraStream = stream;

        cameraPreview.srcObject = stream;
        cameraPreview.play();
        localStorage.setItem('selectedCamera', id);
    } catch (err) {
        alert(err);
    }
}

async function setMic(id: string) {
    await mixer.startMic(id);
    localStorage.setItem('selectedMic', id);
}

async function setMasterSpeaker(id: string) {
    await mixer.setMasterSpeaker(id);
    localStorage.setItem('selectedMaster', id);
}

async function setHeadphones(id: string) {
    await mixer.setHeadphones(id);
    localStorage.setItem('selectedHeadphones', id);
}

const micToggle = document.getElementById('mic-toggle') as HTMLInputElement;
const micPreviewToggle = document.getElementById('mic-preview-toggle') as HTMLInputElement;

function muteMic() {
    if (micToggle.checked) micToggle.click();
}

function unmuteMic() {
    if (!micToggle.checked) micToggle.click();
}

micToggle.addEventListener('change', () => {
    if (micToggle.checked) {
        mixer.unmuteMic();
    } else {
        mixer.muteMic();
    }
});

micPreviewToggle.addEventListener('change', () => {
    mixer.previewMic(micPreviewToggle.checked);
});

cameraBtn.onclick = async () => {
    const id = cameraSelect.value;
    if (!id) return;

    if (mainCameraStream) {
        mainCameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: id } },
            audio: false,
        });

        const track = stream.getVideoTracks()[0];

        track.onended = () => {
            console.log('Camera disconnected');
        };

        mainCameraStream = stream;

        player.srcObject = stream;
        player.play();
        localStorage.setItem('selectedCamera', id);
    } catch (err) {
        alert(err);
    }
    unmuteMic();
};

videoBtn.onclick = async () => {
    player.pause();
    player.currentTime = 0;

    player.srcObject = null;
    player.src = './video1.mp4';

    await new Promise((resolve) => {
        player.addEventListener('loadedmetadata', resolve, { once: true });
    });

    await player.play();
    muteMic();
};

function updateMeters() {
    const [masterLeftLevel, masterRightLevel] = mixer.getMasterLevel();
    const masterCanvas = document.querySelector('#master-meter') as HTMLCanvasElement;
    drawDbMeter(masterCanvas, masterLeftLevel, masterRightLevel, false);

    const [micLeftLevel, micRightLevel] = mixer.getMicLevel();
    const micCanvas = document.querySelector('#mic-meter') as HTMLCanvasElement;
    drawDbMeter(micCanvas, micLeftLevel, micRightLevel, mixer.isMicMuted());

    const [videoLeftLevel, videoRightLevel] = mixer.getVideoLevel();
    const videoCanvas = document.querySelector('#video-meter') as HTMLCanvasElement;
    drawDbMeter(videoCanvas, videoLeftLevel, videoRightLevel, false);

    setTimeout(() => requestAnimationFrame(updateMeters), 100);
}

document.body.addEventListener(
    'click',
    () => {
        mixer.resume();
    },
    { once: true },
);

// Detect if camera is unplugged
navigator.mediaDevices.addEventListener('devicechange', async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const cameras = devices.filter((d) => d.kind === 'videoinput');

    const stillExists = cameras.some((d) => d.deviceId === cameraSelect.value);

    if (!stillExists) {
        console.log('Selected camera disconnected');

        if (cameras.length > 0) {
            setCamera(cameras[0].deviceId);
            cameraSelect.value = cameras[0].deviceId;
        }
    }
});

function calculateObsTransformation(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const bodyElem = document.querySelector('body') as HTMLBodyElement;
    const bodyRect = bodyElem.getBoundingClientRect();

    const pageWidth = screen.width;
    const scale = window.devicePixelRatio;

    const offsetX = window.screenX;
    const offsetY = window.screenY + (window.outerHeight - bodyRect.height);

    const x1 = (rect.left + offsetX) * scale;
    const y1 = (rect.top + offsetY) * scale;
    const x2 = (rect.right + offsetX) * scale;

    const cropLeft = x1;
    const cropTop = y1;
    const cropRight = 0;
    const cropBottom = 0;

    const scaleX = pageWidth / (x2 - x1);
    const scaleY = scaleX;

    return {
        cropLeft,
        cropRight,
        cropTop,
        cropBottom,
        scaleX,
        scaleY,
        positionX: 0,
        positionY: 0,
    };
}

let autoSetupObs = false;
async function handleSetupObsClick() {
    try {
        await window.electronAPI.setupObs(calculateObsTransformation(player), 'Scene');
        autoSetupObs = true;
    } catch (err: any) {
        console.error('OBS setup failed:', err);
        alert('OBS setup failed: ' + err.message);
    }
}

document.getElementById('setupObsBtn')?.addEventListener('click', handleSetupObsClick);

function sliderPercentToGain(sliderValue: number) {
    let gain = sliderValue / 100;
    if (gain > 1) gain = (gain - 1) * 5 + 1;
    return gain;
}

const micGainSlider = document.getElementById('mic-gain') as HTMLInputElement;
const micGainLabel = document.getElementById('mic-gain-label') as HTMLSpanElement;
const videoGainSlider = document.getElementById('video-gain') as HTMLInputElement;
const videoGainLabel = document.getElementById('video-gain-label') as HTMLSpanElement;

micGainSlider.addEventListener('input', () => {
    const gain = sliderPercentToGain(parseInt(micGainSlider.value));
    micGainLabel.textContent = Math.round(gain * 100) + '%';
    mixer.setMicGain(gain);
});

videoGainSlider.addEventListener('input', () => {
    const gain = sliderPercentToGain(parseInt(videoGainSlider.value));
    videoGainLabel.textContent = Math.round(gain * 100) + '%';
    mixer.setVideoGain(gain);
});

const fullscreenBtn = document.getElementById('fullscreenBtn') as HTMLButtonElement;

fullscreenBtn.onclick = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
};

const divider = document.getElementById('divider') as HTMLElement;
const leftPanel = document.getElementById('leftPanel') as HTMLElement;

let dragging = false;

divider.addEventListener('mousedown', () => (dragging = true));

document.addEventListener('mouseup', () => {
    dragging = false;
    if (autoSetupObs) handleSetupObsClick();
});

document.addEventListener('mousemove', (e) => {
    if (!dragging) return;

    const newWidth = e.clientX;
    leftPanel.style.width = newWidth + 'px';
});

updateMeters();

loadDevices();
