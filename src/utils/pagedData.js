/**
 * Paged cache with background prefetch.
 *
 * The screen asks for one page and gets it as soon as that page arrives.
 * The remaining records keep downloading in the background, in chunks, so
 * paging and printing the whole filter become instant afterwards.
 *
 * fetchRange(offset, limit) must resolve to { rows, total } and may also
 * return { complete: true } when the server answered with the whole set.
 */
export const createPagedData = ({ fetchRange, pageSize = 50, chunkSize = 500 }) => {
    let rows = [];
    let total = 0;
    let generation = 0;
    let complete = false;
    const loadedChunks = new Set();
    const inFlight = new Map();
    let prefetchPromise = null;
    let progressHandler = null;

    const chunkCount = () => (total > 0 ? Math.ceil(total / chunkSize) : 0);

    const loadedRows = () => {
        if (complete) return total;
        return Math.min(total, loadedChunks.size * chunkSize);
    };

    const notifyProgress = () => {
        if (progressHandler) progressHandler({ loaded: loadedRows(), total, complete });
    };

    const reset = () => {
        generation += 1;
        rows = [];
        total = 0;
        complete = false;
        loadedChunks.clear();
        inFlight.clear();
        prefetchPromise = null;
    };

    const fetchChunk = async (chunkIndex) => {
        if (loadedChunks.has(chunkIndex) || complete) return;

        const pending = inFlight.get(chunkIndex);
        if (pending) return pending;

        const myGeneration = generation;
        const offset = chunkIndex * chunkSize;

        const request = (async () => {
            const result = await fetchRange(offset, chunkSize);
            if (myGeneration !== generation) return;

            const received = Array.isArray(result?.rows) ? result.rows : [];
            total = Number(result?.total) || received.length;

            if (result?.complete) {
                rows = received;
                complete = true;
                loadedChunks.clear();
            } else {
                for (let i = 0; i < received.length; i += 1) {
                    rows[offset + i] = received[i];
                }
                loadedChunks.add(chunkIndex);
                if (loadedChunks.size >= chunkCount()) complete = true;
            }
            notifyProgress();
        })();

        inFlight.set(chunkIndex, request);
        try {
            await request;
        } finally {
            inFlight.delete(chunkIndex);
        }
    };

    const getPage = async (page = 1) => {
        const requested = Math.max(1, Number(page) || 1);
        const offset = (requested - 1) * pageSize;
        await fetchChunk(Math.floor(offset / chunkSize));

        const pages = total > 0 ? Math.ceil(total / pageSize) : 1;
        const safePage = Math.min(requested, Math.max(1, pages));
        const safeOffset = (safePage - 1) * pageSize;

        return {
            rows: rows.slice(safeOffset, safeOffset + pageSize),
            meta: { page: safePage, limit: pageSize, total, pages }
        };
    };

    /** Downloads whatever is still missing, one chunk at a time, yielding between chunks. */
    const prefetchRest = () => {
        if (prefetchPromise) return prefetchPromise;
        if (complete || total <= pageSize) return Promise.resolve();

        const myGeneration = generation;
        prefetchPromise = (async () => {
            for (let i = 0; i < chunkCount(); i += 1) {
                if (myGeneration !== generation) return;
                if (complete) break;
                if (loadedChunks.has(i)) continue;

                try {
                    await fetchChunk(i);
                } catch (error) {
                    console.error('[PagedData] Falha ao baixar registros em segundo plano:', error);
                    return;
                }
                // Give the browser room to paint and respond to clicks.
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        })();

        prefetchPromise.finally(() => {
            if (myGeneration === generation) prefetchPromise = null;
        });

        return prefetchPromise;
    };

    /** Waits for every record of the current filter. Retries once, then fails loudly
     *  instead of silently handing back a truncated list. */
    const getAllRows = async () => {
        await prefetchRest();
        if (!complete) await prefetchRest();
        if (!complete) throw new Error('Nao foi possivel baixar todos os registros do filtro.');
        return rows.slice(0, total || rows.length);
    };

    return {
        reset,
        getPage,
        prefetchRest,
        getAllRows,
        onProgress: (handler) => { progressHandler = handler; },
        get total() { return total; },
        get loaded() { return loadedRows(); },
        get isComplete() { return complete; }
    };
};
