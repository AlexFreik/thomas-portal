import { AudioMixer, drawDbMeter } from './audio-mixer.js';
const mixer = new AudioMixer();
const player = document.getElementById('player');
mixer.attachMediaElement(player);
const cameraPreview = document.getElementById('camera-preview');
const cameraSelect = document.getElementById('camera');
const micSelect = document.getElementById('mic');
const masterSelect = document.getElementById('master');
const headphonesSelect = document.getElementById('headphones');
const cameraBtn = document.getElementById('cameraBtn');
const videoBtn = document.getElementById('videoBtn');
let currentCameraStream = null;
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
    if (selectedCamera)
        cameraSelect.value = selectedCamera;
    setCamera(cameraSelect.value);
    const selectedMic = localStorage.getItem('selectedMic');
    if (selectedMic)
        micSelect.value = selectedMic;
    setMic(micSelect.value);
    const selectedMaster = localStorage.getItem('selectedMaster');
    if (selectedMaster)
        masterSelect.value = selectedMaster;
    setMasterSpeaker(masterSelect.value);
    const selectedHeadphones = localStorage.getItem('selectedHeadphones');
    if (selectedHeadphones)
        headphonesSelect.value = selectedHeadphones;
    setHeadphones(headphonesSelect.value);
}
function fill(select, devices, addNone = false) {
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
async function setCamera(id) {
    if (!id)
        return;
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
async function setMic(id) {
    if (!id)
        return;
    await mixer.startMic(id);
    localStorage.setItem('selectedMic', id);
}
async function setMasterSpeaker(id) {
    if (!id)
        return;
    await mixer.setMasterSpeaker(id);
    localStorage.setItem('selectedMaster', id);
}
async function setHeadphones(id) {
    if (!id)
        return;
    await mixer.setHeadphones(id);
    localStorage.setItem('selectedHeadphones', id);
}
cameraBtn.onclick = async () => {
    player.pause();
    player.src = '';
    player.srcObject = currentCameraStream;
    await player.play();
    mixer.unmuteMic();
};
videoBtn.onclick = async () => {
    player.srcObject = null;
    player.src = './video.mp4';
    await new Promise((resolve) => {
        player.addEventListener('loadedmetadata', resolve, { once: true });
    });
    await player.play();
    mixer.muteMic();
};
function updateMeters() {
    const masterLevel = mixer.getMasterLevel();
    const masterCanvas = document.querySelector('#master-meter');
    const masterCtx = masterCanvas.getContext('2d');
    masterCtx.clearRect(0, 0, 100, 100);
    drawDbMeter(masterCtx, 0, 48, masterLevel, false);
    drawDbMeter(masterCtx, 54, 48, masterLevel, false);
    const micLevel = mixer.getMicLevel();
    const micCanvas = document.querySelector('#mic-meter');
    const micCtx = micCanvas.getContext('2d');
    micCtx.clearRect(0, 0, 100, 100);
    drawDbMeter(micCtx, 0, 100, micLevel, false);
    requestAnimationFrame(updateMeters);
}
document.body.addEventListener('click', () => {
    mixer.resume();
}, { once: true });
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
updateMeters();
loadDevices();
