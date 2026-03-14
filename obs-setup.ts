export async function setupObs(element: HTMLElement, sceneName: string) {
    const ws = new WebSocket('ws://127.0.0.1:4455');

    let windowCaptureSourceId = null as string | null;
    let detectedWindowId = null as string | null;

    function send(requestType: any, requestData = {}, requestId: any) {
        ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    }

    return new Promise((resolve, reject) => {
        ws.onerror = () => {
            reject(new Error('Cannot connect to OBS WebSocket'));
        };

        ws.onopen = () => {
            // Identify
            ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }));
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            // Identify OK
            if (msg.op === 2) send('GetSceneList', {}, 'getScenes');

            if (msg.op !== 7) return;

            const { requestId, responseData, requestStatus } = msg.d;

            if (!requestStatus.result) {
                reject(new Error(requestStatus.comment));
                ws.close();
                return;
            }

            // send(
            //     'GetInputPropertiesListPropertyItems',
            //     { inputKind: 'window_capture', propertyName: 'window' },
            //     'getWindowList');

            // // Window List
            // if (requestId === 'getWindowList') {
            //     const portalWindow = responseData.propertyItems.find(
            //         (item: any) => item.itemName.includes(sceneName)
            //     );

            //     detectedWindowId = portalWindow ? portalWindow.itemValue : null;

            //     send('GetSceneList', {}, 'getScenes');
            // }

            // Scene list
            if (requestId === 'getScenes') {
                const portalScene = responseData.scenes.find(
                    (scene: any) => scene.sceneName === sceneName,
                );

                if (portalScene) {
                    send('GetSceneItemList', { sceneName: sceneName }, 'getSceneItems');
                } else {
                    send('CreateScene', { sceneName: sceneName }, 'createNewScene');
                }
            }

            if (requestId === 'createNewScene') {
                send('GetSceneItemList', { sceneName: sceneName }, 'getSceneItems');
            }

            // Scene items
            if (requestId === 'getSceneItems') {
                console.log(responseData);
                const windowCapture = responseData.sceneItems.find(
                    (item: any) => item.sourceName === 'Window Capture',
                );

                if (windowCapture) {
                    windowCaptureSourceId = windowCapture.sceneItemId;

                    send(
                        'SetSceneItemTransform',
                        {
                            sceneName: sceneName,
                            sceneItemId: windowCaptureSourceId,
                            sceneItemTransform: calculateTransformation(element),
                        },
                        'setTransform',
                    );
                } else {
                    // Create Window Capture source
                    // TODO: automatically select window
                    send(
                        'CreateInput',
                        {
                            sceneName: sceneName,
                            inputName: sceneName + ' Window Capture',
                            inputKind: 'window_capture',
                            inputSettings: { capture_method: 'automatic' },
                            sceneItemEnabled: true,
                        },
                        'createWindowCapture',
                    );
                }
            }

            if (requestId === 'createWindowCapture') {
                send(
                    'SetSceneItemTransform',
                    {
                        sceneName: sceneName,
                        sceneItemId: responseData.inputUuid,
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
