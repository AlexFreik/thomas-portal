import { AudioMixer, drawDbMeter } from './audio-mixer.js';
import { setupObs } from './obs-setup.js';

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

async function loadDevices() {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

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
    setCamera(cameraSelect.value);

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
        opt.value = 'none';
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
}

async function setMic(id: string) {
    if (!id) return;
    await mixer.startMic(id);
    localStorage.setItem('selectedMic', id);
}

async function setMasterSpeaker(id: string) {
    if (!id) return;
    await mixer.setMasterSpeaker(id);
    localStorage.setItem('selectedMaster', id);
}

async function setHeadphones(id: string) {
    if (!id) return;
    await mixer.setHeadphones(id);
    localStorage.setItem('selectedHeadphones', id);
}

const micToggle = document.getElementById('mic-toggle') as HTMLInputElement;
const micPreviewToggle = document.getElementById('mic-preview-toggle') as HTMLInputElement;

function muteMic() {
    if (!micToggle.checked) micToggle.click();
}

function unmuteMic() {
    if (micToggle.checked) micToggle.click();
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
    player.pause();
    player.currentTime = 0;

    player.src = '';
    player.srcObject = currentCameraStream;

    await player.play();
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
    const masterLevel = mixer.getMasterLevel();
    const masterCanvas = document.querySelector('#master-meter') as HTMLCanvasElement;
    const masterCtx = masterCanvas.getContext('2d')!;
    masterCtx.clearRect(0, 0, 100, 100);
    drawDbMeter(masterCtx, 0, 48, masterLevel, false);
    drawDbMeter(masterCtx, 54, 48, masterLevel, false);

    const micLevel = mixer.getMicLevel();
    const micCanvas = document.querySelector('#mic-meter') as HTMLCanvasElement;
    const micCtx = micCanvas.getContext('2d')!;
    micCtx.clearRect(0, 0, 100, 100);
    drawDbMeter(micCtx, 0, 100, micLevel, mixer.isMicMuted());

    requestAnimationFrame(updateMeters);
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

async function handleSetupObsClick() {
    try {
        await setupObs(player, 'Scene');
    } catch (err: any) {
        console.error('OBS setup failed:', err);
        alert('OBS setup failed: ' + err.message);
    }
}

document.getElementById('setupObsBtn')?.addEventListener('click', handleSetupObsClick);

const gainSlider = document.getElementById('mic-gain') as HTMLInputElement;
const gainLabel = document.getElementById('mic-gain-label') as HTMLSpanElement;

gainSlider.addEventListener('input', () => {
    const value = parseInt(gainSlider.value);
    let gain = value / 100;
    if (gain > 1) gain = (gain - 1) * 5 + 1;

    gainLabel.textContent = Math.round(gain * 100) + '%';

    mixer.setMicGain(gain);
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
    handleSetupObsClick();
});

document.addEventListener('mousemove', (e) => {
    if (!dragging) return;

    const newWidth = e.clientX;
    leftPanel.style.width = newWidth + 'px';
});

updateMeters();

loadDevices();
