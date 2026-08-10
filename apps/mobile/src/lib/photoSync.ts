import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '../store/authStore';

// Simple queue for uploading photos in the background
// In a real app, you would persist this queue to WatermelonDB or AsyncStorage
// to survive app restarts.

type PhotoUploadTask = {
  id: string;
  localUri: string;
  endpoint: string;
  metadata?: Record<string, string>;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
};

class PhotoSyncQueue {
  private queue: PhotoUploadTask[] = [];
  private isProcessing = false;

  add(task: Omit<PhotoUploadTask, 'id' | 'status'>) {
    const newTask: PhotoUploadTask = {
      ...task,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
    };
    this.queue.push(newTask);
    this.processQueue();
    return newTask.id;
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (const task of this.queue.filter(t => t.status === 'pending' || t.status === 'failed')) {
        task.status = 'uploading';
        
        const token = useAuthStore.getState().token;
        if (!token) {
          task.status = 'failed';
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
      }
    } finally {
      // Remove completed tasks
      this.queue = this.queue.filter(t => t.status !== 'completed');
      this.isProcessing = false;
    }
  }

  getPendingCount() {
    return this.queue.filter(t => t.status !== 'completed').length;
  }
}

export const photoSyncQueue = new PhotoSyncQueue();
