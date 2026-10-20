import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, IPC_EVENTS, type IpcChannel, type IpcEventName, type IpcPayload, type IpcEventData } from '../shared/ipc';

const allowedChannels = new Set<string>(IPC_CHANNELS);
const allowedEvents = new Set<string>(IPC_EVENTS);

contextBridge.exposeInMainWorld('vibe', {
  invoke(channel: string, payload?: unknown): Promise<unknown> {
    if (!allowedChannels.has(channel)) {
      return Promise.reject(new Error(`IPC channel blocked: ${channel}`));
    }
    return ipcRenderer.invoke(channel, payload);
  },
  on(event: string, listener: (data: unknown) => void): () => void {
    if (!allowedEvents.has(event)) {
      throw new Error(`IPC event blocked: ${event}`);
    }
    const wrapped = (_e: unknown, data: unknown) => listener(data);
    ipcRenderer.on(event, wrapped);
    return () => {
      ipcRenderer.removeListener(event, wrapped);
    };
  },
});

export type VibeApi = {
  invoke<C extends IpcChannel>(channel: C, payload?: IpcPayload<C>): Promise<unknown>;
  on<E extends IpcEventName>(event: E, listener: (data: IpcEventData<E>) => void): () => void;
};
