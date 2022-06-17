import path from 'path';
import { watchStore } from '../services/store';
import { ipcRenderer } from 'electron';
import { ElectronFile, WatchStoreType } from '../types';
import { getElectronFile, getFilesFromDir } from '../services/fs';

export async function addWatchMapping(
    collectionName: string,
    folderPath: string
) {
    let watchMappings = getWatchMappings();
    if (!watchMappings) {
        watchMappings = [];
    }

    const watchMapping = watchMappings?.find(
        (mapping) =>
            mapping.collectionName === collectionName ||
            mapping.folderPath === folderPath
    );

    if (watchMapping) {
        return;
    }

    await ipcRenderer.invoke('add-watcher', {
        dir: folderPath,
    });

    watchMappings.push({
        collectionName,
        folderPath,
        files: [],
    });

    setWatchMappings(watchMappings);
}

export async function removeWatchMapping(collectionName: string) {
    const watchMappings = getWatchMappings();
    const watchMapping = watchMappings.find(
        (mapping) => mapping.collectionName === collectionName
    );

    if (!watchMapping) {
        return;
    }

    await ipcRenderer.invoke('remove-watcher', {
        dir: watchMapping.folderPath,
    });

    watchMappings.splice(watchMappings.indexOf(watchMapping), 1);

    setWatchMappings(watchMappings);
}

export function getWatchMappings() {
    const mappings = watchStore.get('mappings') ?? [];
    return mappings;
}

export function setWatchMappings(watchMappings: WatchStoreType['mappings']) {
    watchStore.set('mappings', watchMappings);
}

export async function getAllFilesFromDir(dirPath: string) {
    const files = await getFilesFromDir(dirPath);
    const electronFiles = await Promise.all(files.map(getElectronFile));
    return electronFiles;
}

export function registerWatcherFunctions(
    WatchServiceInstance: any,
    addFile: (WatchServiceInstance: any, file: ElectronFile) => Promise<void>,
    removeFile: (WatchServiceInstance: any, path: string) => Promise<void>,
    removeFolder: (
        WatchServiceInstance: any,
        folderPath: string
    ) => Promise<void>
) {
    ipcRenderer.removeAllListeners('watch-add');
    ipcRenderer.removeAllListeners('watch-change');
    ipcRenderer.removeAllListeners('watch-unlink');
    ipcRenderer.on('watch-add', async (_, filePath: string) => {
        filePath = filePath.split(path.sep).join(path.posix.sep);
        await addFile(WatchServiceInstance, await getElectronFile(filePath));
    });
    ipcRenderer.on('watch-change', async (_, filePath: string) => {
        filePath = filePath.split(path.sep).join(path.posix.sep);
        await removeFile(WatchServiceInstance, filePath);
        await addFile(WatchServiceInstance, await getElectronFile(filePath));
    });
    ipcRenderer.on(
        'watch-unlink',
        async (_, filePath: string, isDir?: boolean) => {
            filePath = filePath.split(path.sep).join(path.posix.sep);
            if (isDir) {
                await removeFolder(WatchServiceInstance, filePath);
            } else {
                await removeFile(WatchServiceInstance, filePath);
            }
        }
    );
}