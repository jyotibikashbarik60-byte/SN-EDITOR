import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getAnalytics, isSupported, logEvent as firebaseLogEvent, Analytics } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

// 1. Initialize Firebase App and Services
export const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass databaseId from config as mandated by Firebase Enterprise spec
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Safe Analytics Initialization
let analyticsInstance: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      try {
        analyticsInstance = getAnalytics(app);
      } catch (err) {
        console.warn('Analytics init skipped:', err);
      }
    }
  }).catch(() => {
    // Graceful fallback for non-supported browser contexts
  });
}

// 2. Validate Connection to Firestore (Mandatory Skill Requirement)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// 3. Mandatory Error Handling Conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 4. Analytics Logging Helper
export function logAnalyticsEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    if (analyticsInstance) {
      firebaseLogEvent(analyticsInstance, eventName, params);
    }
  } catch (err) {
    console.debug('Analytics log event error:', err);
  }
}

// 5. Auth API Helpers
export async function registerWithEmail(email: string, pass: string, displayName: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  // Create user profile in Firestore
  const userDocPath = `users/${credential.user.uid}`;
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      email: credential.user.email || email,
      displayName: displayName || email.split('@')[0],
      photoURL: credential.user.photoURL || '',
      role: 'user',
      createdAt: now,
      lastLoginAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userDocPath);
  }

  await recordActivity('signup', `User registered: ${email}`, '/auth/signup');
  return credential.user;
}

export async function loginWithEmail(email: string, pass: string) {
  const credential = await signInWithEmailAndPassword(auth, email, pass);
  
  // Update lastLoginAt in Firestore
  const userDocPath = `users/${credential.user.uid}`;
  const now = new Date().toISOString();
  try {
    const userRef = doc(db, 'users', credential.user.uid);
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      await updateDoc(userRef, { lastLoginAt: now });
    } else {
      await setDoc(userRef, {
        uid: credential.user.uid,
        email: credential.user.email || email,
        displayName: credential.user.displayName || email.split('@')[0],
        photoURL: credential.user.photoURL || '',
        role: 'user',
        createdAt: now,
        lastLoginAt: now,
      });
    }
  } catch (err) {
    console.warn('Could not sync user profile on login:', err);
  }

  await recordActivity('login', `User logged in: ${email}`, '/auth/login');
  return credential.user;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const now = new Date().toISOString();
  const userDocPath = `users/${credential.user.uid}`;

  try {
    const userRef = doc(db, 'users', credential.user.uid);
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      await updateDoc(userRef, {
        lastLoginAt: now,
        displayName: credential.user.displayName || '',
        photoURL: credential.user.photoURL || '',
      });
    } else {
      await setDoc(userRef, {
        uid: credential.user.uid,
        email: credential.user.email || '',
        displayName: credential.user.displayName || 'Google User',
        photoURL: credential.user.photoURL || '',
        role: 'user',
        createdAt: now,
        lastLoginAt: now,
      });
    }
  } catch (err) {
    console.warn('Could not sync Google user profile:', err);
  }

  await recordActivity('login', `Google sign in: ${credential.user.email}`, '/auth/google');
  return credential.user;
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
  await recordActivity('login', `Password reset requested for: ${email}`, '/auth/reset');
}

export async function logoutUser() {
  const email = auth.currentUser?.email || 'user';
  await signOut(auth);
  await recordActivity('session_start', `User signed out: ${email}`, '/auth/logout');
}

// 6. Documents Database Service
export interface SavedDocument {
  id: string;
  ownerId: string;
  name: string;
  pageCount: number;
  fileSize?: number;
  thumbnail?: string;
  pdfDataUrl?: string;
  editsSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveDocument(document: Omit<SavedDocument, 'createdAt' | 'updatedAt'> & { id?: string }) {
  if (!auth.currentUser) {
    throw new Error('Authentication required to save document');
  }

  const docId = document.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docPath = `documents/${docId}`;
  const now = new Date().toISOString();

  const payload: SavedDocument = {
    ...document,
    id: docId,
    ownerId: auth.currentUser.uid,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, 'documents', docId);
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      const existingData = existing.data() as SavedDocument;
      await updateDoc(docRef, {
        name: payload.name,
        pageCount: payload.pageCount,
        fileSize: payload.fileSize || 0,
        thumbnail: payload.thumbnail || '',
        pdfDataUrl: payload.pdfDataUrl || '',
        editsSummary: payload.editsSummary || '',
        updatedAt: now,
      });
    } else {
      await setDoc(docRef, payload);
    }

    logAnalyticsEvent('document_saved', { documentId: docId, pages: payload.pageCount });
    await recordActivity('pdf_edit', `Saved document "${payload.name}" (${payload.pageCount} pages)`, '/editor/save');
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}

export async function fetchUserDocuments(): Promise<SavedDocument[]> {
  if (!auth.currentUser) return [];
  const collPath = 'documents';

  try {
    const q = query(
      collection(db, collPath),
      where('ownerId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    const results: SavedDocument[] = [];
    snapshot.forEach((docSnap) => {
      results.push(docSnap.data() as SavedDocument);
    });

    // Sort by updatedAt descending
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collPath);
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Authentication required to delete document');
  }
  const docPath = `documents/${docId}`;

  try {
    await deleteDoc(doc(db, 'documents', docId));
    logAnalyticsEvent('document_deleted', { documentId: docId });
    await recordActivity('pdf_edit', `Deleted document ID ${docId}`, '/editor/delete');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }
}

// 7. Activity Logs & Traffic Telemetry
export interface ActivityLogItem {
  id: string;
  userId: string;
  eventType: 'page_view' | 'pdf_open' | 'pdf_edit' | 'pdf_export' | 'image_crop' | 'session_start' | 'login' | 'signup';
  details?: string;
  path?: string;
  timestamp: string;
}

export async function recordActivity(
  eventType: ActivityLogItem['eventType'],
  details = '',
  path = window.location.pathname || '/'
) {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const logPath = `activity_logs/${logId}`;
  const now = new Date().toISOString();
  const userId = auth.currentUser?.uid || 'anonymous';

  const logPayload: ActivityLogItem = {
    id: logId,
    userId,
    eventType,
    details: details.substring(0, 500),
    path: path.substring(0, 255),
    timestamp: now,
  };

  try {
    await setDoc(doc(db, 'activity_logs', logId), logPayload);
    logAnalyticsEvent(eventType, { details, path });
  } catch (err) {
    // Non-fatal telemetry logging
    console.debug('Activity log recording skipped:', err);
  }
}

export async function fetchRecentActivityLogs(maxItems = 15): Promise<ActivityLogItem[]> {
  if (!auth.currentUser) return [];
  const collPath = 'activity_logs';
  try {
    const q = query(
      collection(db, collPath),
      where('userId', '==', auth.currentUser.uid),
      limit(maxItems)
    );
    const snap = await getDocs(q);
    const list: ActivityLogItem[] = [];
    snap.forEach((d) => list.push(d.data() as ActivityLogItem));
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collPath);
  }
}

// 8. Traffic & Daily Metrics for Monetization / AdSense preparation
export interface TrafficDailyStat {
  id: string; // YYYY-MM-DD
  date: string;
  pageViews: number;
  activeSessions: number;
  uniqueUsers: number;
  totalExports: number;
  updatedAt: string;
}

export async function recordDailyTrafficPageView(isExport = false) {
  const today = new Date().toISOString().split('T')[0];
  const statPath = `traffic_stats/${today}`;
  const now = new Date().toISOString();

  try {
    const statRef = doc(db, 'traffic_stats', today);
    const existing = await getDoc(statRef);

    if (existing.exists()) {
      const data = existing.data() as TrafficDailyStat;
      await updateDoc(statRef, {
        pageViews: (data.pageViews || 0) + (isExport ? 0 : 1),
        totalExports: (data.totalExports || 0) + (isExport ? 1 : 0),
        activeSessions: (data.activeSessions || 1) + 1,
        updatedAt: now,
      });
    } else {
      await setDoc(statRef, {
        id: today,
        date: today,
        pageViews: isExport ? 0 : 1,
        activeSessions: 1,
        uniqueUsers: 1,
        totalExports: isExport ? 1 : 0,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.debug('Traffic stat record skipped:', err);
  }
}

export async function fetchAllTrafficStats(): Promise<TrafficDailyStat[]> {
  const collPath = 'traffic_stats';
  try {
    const snap = await getDocs(collection(db, collPath));
    const items: TrafficDailyStat[] = [];
    snap.forEach((docSnap) => items.push(docSnap.data() as TrafficDailyStat));
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collPath);
  }
}

export { onAuthStateChanged, type FirebaseUser };
