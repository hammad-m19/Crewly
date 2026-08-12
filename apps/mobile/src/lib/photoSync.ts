import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuthStore } from '../store/authStore';

const QUEUE_STORAGE_KEY = '@crewly/photo_upload_queue';
const MAX_LONG_EDGE = 1200;
const JPEG_QUALITY = 0.8;

type PhotoUploadTask = {
  id: string;
  localUri: string;
  endpoint: string;
  metadata?: Record<string, string>;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
};

/**
 * Compress a local photo before upload: max 1200px long edge, JPEG ~80%.
 */
export async function compressPhoto(localUri: string): Promise<string> {
  let width = 0;
  let height = 0;

  try {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      Image.getSize(
        localUri,
        (w, h) => resolve({ width: w, height: h }),
        reject
      );
    });
    width = size.width;
    height = size.height;
  } catch {
    // Still re-encode as JPEG if dimensions are unavailable
  }

  const actions: ImageManipulator.Action[] = [];
  const longEdge = Math.max(width, height);
  if (longEdge > MAX_LONG_EDGE) {
    if (width >= height) {
      actions.push({ resize: { width: MAX_LONG_EDGE } });
    } else {
      actions.push({ resize: { height: MAX_LONG_EDGE } });
    }
  }

  const result = await ImageManipulator.manipulateAsync(localUri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return result.uri;
}

/**
 * Background photo upload queue with AsyncStorage persistence across restarts.
 */
class PhotoSyncQueue {
  private queue: PhotoUploadTask[] = [];
  private isProcessing = false;
  private hydrated = false;

  /** Restore pending/failed tasks from AsyncStorage (call once on app launch). */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PhotoUploadTask[];
        this.queue = parsed
          .filter((t) => t.status === 'pending' || t.status === 'failed' || t.status === 'uploading')
          .map((t) => ({
            ...t,
            // Resume interrupted uploads as pending
            status: t.status === 'uploading' ? 'pending' : t.status,
          }));
      }
    } catch (error) {
      console.error('Failed to restore photo upload queue:', error);
    } finally {
      this.hydrated = true;
    }

    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  private async persist(): Promise<void> {
    try {
      const durable = this.queue.filter((t) => t.status !== 'completed');
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(durable));
    } catch (error) {
      console.error('Failed to persist photo upload queue:', error);
    }
  }

  async add(task: Omit<PhotoUploadTask, 'id' | 'status' | 'localUri'> & { localUri: string }) {
    await this.hydrate();

    let uri = task.localUri;
    try {
      uri = await compressPhoto(task.localUri);
    } catch (error) {
      console.error('Photo compression failed; uploading original:', error);
    }

    const newTask: PhotoUploadTask = {
      ...task,
      localUri: uri,
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
      status: 'pending',
    };
    this.queue.push(newTask);
    await this.persist();
    this.processQueue();
    return newTask.id;
  }

  async processQueue() {
    if (this.isProcessing) return;
    await this.hydrate();
    this.isProcessing = true;

    try {
      for (const task of this.queue.filter(
        (t) => t.status === 'pending' || t.status === 'failed'
      )) {
        task.status = 'uploading';
        await this.persist();

        const token = useAuthStore.getState().token;
        if (!token) {
          task.status = 'failed';
          await this.persist();
          continue;
        }

        try {
          const response = await FileSystem.uploadAsync(task.endpoint, task.localUri, {
            fieldName: 'photo',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            parameters: task.metadata,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.status >= 200 && response.status < 300) {
            task.status = 'completed';
          } else {
            task.status = 'failed';
          }
        } catch (error) {
          console.error(`Photo upload failed for task ${task.id}:`, error);
          task.status = 'failed';
        }

        await this.persist();
      }
    } finally {
      this.queue = this.queue.filter((t) => t.status !== 'completed');
      await this.persist();
      this.isProcessing = false;
    }
  }

  getPendingCount() {
    return this.queue.filter((t) => t.status !== 'completed').length;
  }
}

export const photoSyncQueue = new PhotoSyncQueue();
