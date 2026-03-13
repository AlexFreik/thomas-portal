export async function setupObs(element: HTMLElement) {
    const ws = new WebSocket('ws://127.0.0.1:4455');

    let firstSceneName = null as any;
    let firstSceneItemId = null as any;

    function send(requestType: any, requestData = {}, requestId: any) {
        ws.send(
            JSON.stringify({
                op: 6,
                d: {
                    requestType,
                    requestId,
                    requestData,
                },
            }),
        );
    }

    return new Promise((resolve, reject) => {
        ws.onerror = () => {
            reject(new Error('Cannot connect to OBS WebSocket'));
        };

        ws.onopen = () => {
            // Identify
            ws.send(
                JSON.stringify({
                    op: 1,
                    d: { rpcVersion: 1 },
                }),
            );
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            // Identify OK
            if (msg.op === 2) {
                send('GetSceneList', {}, 'getScenes');
            }

            if (msg.op !== 7) return;

            const { requestId, responseData, requestStatus } = msg.d;

            if (!requestStatus.result) {
                reject(new Error(requestStatus.comment));
                ws.close();
                return;
            }

            // Scene list
            if (requestId === 'getScenes') {
                if (!responseData.scenes.length) {
                    reject(new Error('OBS has no scenes'));
                    ws.close();
                    return;
                }

                firstSceneName = responseData.scenes[0].sceneName;

                send(
                    'GetSceneItemList',
                    {
                        sceneName: firstSceneName,
                    },
                    'getSceneItems',
                );
            }

            // Scene items
            if (requestId === 'getSceneItems') {
                if (!responseData.sceneItems.length) {
                    reject(new Error('First scene has no sources'));
                    ws.close();
                    return;
                }

                firstSceneItemId = responseData.sceneItems[0].sceneItemId;

                send(
                    'SetSceneItemTransform',
                    {
                        sceneName: firstSceneName,
                        sceneItemId: firstSceneItemId,
                        sceneItemTransform: calculateTransformation(element),
                    },
                    'setTransform',
                );
            }

            if (requestId === 'setTransform') {
                ws.close();
                resolve(true);
            }
        };
    });
}

function calculateTransformation(element: HTMLElement) {
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
