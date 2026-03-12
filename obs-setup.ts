export async function setupObs(pageWidth: number, x1: number, y1: number, x2: number) {
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

                const cropLeft = x1;
                const cropTop = y1;
                const cropRight = 0;
                const cropBottom = 0;

                const scaleX = pageWidth / (x2 - x1);
                const scaleY = scaleX;

                send(
                    'SetSceneItemTransform',
                    {
                        sceneName: firstSceneName,
                        sceneItemId: firstSceneItemId,
                        sceneItemTransform: {
                            cropLeft,
                            cropRight,
                            cropTop,
                            cropBottom,
                            scaleX,
                            scaleY,
                            positionX: 0,
                            positionY: 0,
                        },
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
