export const abortError = (): DOMException => new DOMException('The operation was aborted', 'AbortError');

export const waitForAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(abortError());
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
            value => {
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            },
            error => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            },
        );
    });
};

export const forwardAbort = (source: AbortSignal | undefined, target: AbortController): (() => void) => {
    if (!source) return () => undefined;
    if (source.aborted) {
        target.abort();
        return () => undefined;
    }
    const onAbort = () => target.abort();
    source.addEventListener('abort', onAbort, { once: true });
    return () => source.removeEventListener('abort', onAbort);
};
