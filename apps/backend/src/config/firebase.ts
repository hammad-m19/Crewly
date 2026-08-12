import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

let initialized = false;
let initAttempted = false;
let missingCredsLogged = false;

/**
 * Lazily initialize the Firebase Admin SDK for FCM.
 * Credentials are optional — when absent we log once and stay in no-op mode
 * so the API never crashes in local/dev/test environments.
 */
export function initFirebase(): boolean {
  if (initAttempted) return initialized;
  initAttempted = true;

  try {
    if (admin.apps.length > 0) {
      initialized = true;
      return true;
    }

    const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (explicitPath) {
      const resolved = path.resolve(explicitPath);
      if (!fs.existsSync(resolved)) {
        logMissingCreds(
          `FIREBASE_SERVICE_ACCOUNT_PATH set but file not found: ${resolved}`
        );
        return false;
      }
      const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      initialized = true;
      console.log('🔥 Firebase Admin initialized (service account file)');
      return true;
    }

    if (gacPath) {
      // Application Default Credentials picks up GOOGLE_APPLICATION_CREDENTIALS
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      initialized = true;
      console.log('🔥 Firebase Admin initialized (application default credentials)');
      return true;
    }

    logMissingCreds(
      'No FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS — FCM push disabled'
    );
    return false;
  } catch (error) {
    console.error('Firebase Admin initialization failed — FCM push disabled:', error);
    initialized = false;
    return false;
  }
}

function logMissingCreds(message: string): void {
  if (missingCredsLogged) return;
  missingCredsLogged = true;
  console.warn(`⚠️  ${message}`);
}

/** Whether Firebase Admin was successfully initialized. */
export function isFirebaseReady(): boolean {
  if (!initAttempted) initFirebase();
  return initialized;
}

/**
 * Send a data+notification FCM message. Returns false when Firebase is not
 * configured or the send fails — callers should treat this as best-effort.
 */
export async function sendFcmPush(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<boolean> {
  if (!isFirebaseReady()) return false;

  try {
    await admin.messaging().send({
      token: params.token,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: params.data,
    });
    return true;
  } catch (error) {
    console.error('FCM send error:', error);
    return false;
  }
}
