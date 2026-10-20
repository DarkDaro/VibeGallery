import type {
  IpcChannel,
  IpcEventName,
  IpcPayload,
  IpcResult,
  IpcEventData,
} from '../../shared/ipc';

export const ipc = {
  invoke<C extends IpcChannel>(channel: C, payload?: IpcPayload<C>): Promise<IpcResult<C>> {
    return window.vibe.invoke<C>(channel, payload);
  },
  on<E extends IpcEventName>(event: E, listener: (data: IpcEventData<E>) => void): () => void {
    return window.vibe.on<E>(event, listener);
  },
};
