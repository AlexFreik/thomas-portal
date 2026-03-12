export async function setupObs(
    pageWidth: number,
    pageHeight: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
) {
    const ws = new WebSocket('ws://127.0.0.1:4455');

    return new Promise((resolve, reject) => {
        ws.onerror = () => {
            reject(
                new Error(
                    'Cannot connect to OBS WebSocket. Make sure OBS is running and WebSocket server is enabled.',
                ),
            );
        };

        ws.onopen = () => {
            // OBS v5 requires identify message
            ws.send(
                JSON.stringify({
                    op: 1,
                    d: {
                        rpcVersion: 1,
                    },
                }),
            );
        };

        ws.onmessage = async (event) => {
            const msg = JSON.parse(event.data);

            // After identify success
            if (msg.op === 2) {
                const playerWidth = x2 - x1;
                const playerHeight = y2 - y1;

                const cropLeft = x1;
                const cropTop = y1;
                const cropRight = pageWidth - x2;
                const cropBottom = pageHeight - y2;

                const scaleX = pageWidth / playerWidth;
                const scaleY = pageHeight / playerHeight;

                // Request id
                const requestId = 'set-transform';

                ws.send(
                    JSON.stringify({
                        op: 6,
                        d: {
                            requestType: 'SetSceneItemTransform',
                            requestId: requestId,
                            requestData: {
                                sceneName: 'Scene',
                                sceneItemId: 1,
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
                        },
                    }),
                );
            }

            // Request response
            if (msg.op === 7) {
                if (!msg.d.requestStatus.result) {
                    reject(new Error('OBS error: ' + msg.d.requestStatus.comment));
                } else {
                    resolve(true);
                }

                ws.close();
            }
        };
    });
}
