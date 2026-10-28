/**
 * Firebase Client Initialization & Service Module
 * Configured with user project: smart-concrete-d2fbc
 */
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  User
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  FirestoreError
} from "firebase/firestore";

// User-provided Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBN4viEdnwgOxjImz53lASdRJMmhahesm0",
  authDomain: "smart-concrete-d2fbc.firebaseapp.com",
  projectId: "smart-concrete-d2fbc",
  storageBucket: "smart-concrete-d2fbc.firebasestorage.app",
  messagingSenderId: "71481106512",
  appId: "1:71481106512:web:22a155d443e9f74553f155",
  measurementId: "G-KGNYC5NP82"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Operation Types for Error Handling
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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null
    },
    operationType,
    path
  };
  console.error("Firestore Security / Permission Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// Authentication Functions
// ==========================================

export async function loginWithEmail(email: string, pass: string) {
  return await signInWithEmailAndPassword(auth, email.trim(), pass);
}

export async function signupWithEmail(email: string, pass: string, fullName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (cred.user && fullName.trim()) {
    try {
      await updateProfile(cred.user, { displayName: fullName.trim() });
    } catch (e) {
      console.warn("Could not set displayName:", e);
    }
  }
  // Optional verification email
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    console.log("Email verification notice:", e);
  }
  return cred;
}

export async function loginWithGoogle() {
  return await signInWithPopup(auth, googleProvider);
}

export async function resetPassword(email: string) {
  return await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser() {
  return await signOut(auth);
}

// ==========================================
// Firestore Per-User Project Operations
// Path: users/{uid}/projects/{projectId}
// ==========================================

export interface ProjectRecord {
  id: string;
  name: string;
  location: string;
  date: string;
  structure: string;
  grade: string;
  volume: number;
  wastage: number;
  notes?: string;
  rates?: {
    cementRate: number;
    sandRate: number;
    aggRate: number;
  };
  quantities?: any;
  costs?: any;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Subscribe to current user's projects in real-time
 */
export function subscribeToUserProjects(
  uid: string,
  onSuccess: (projects: ProjectRecord[]) => void,
  onError: (err: any) => void
) {
  const collectionPath = `users/${uid}/projects`;
  const projectsRef = collection(db, 'users', uid, 'projects');
  
  return onSnapshot(
    projectsRef,
    (snapshot) => {
      const list: ProjectRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || 'Untitled Project',
          location: data.location || '',
          date: data.date || '',
          structure: data.structure || 'Roof Slab & Beams',
          grade: data.grade || 'M20',
          volume: Number(data.volume) || 10,
          wastage: Number(data.wastage) || 3,
          notes: data.notes || '',
          rates: data.rates || null,
          quantities: data.quantities || null,
          costs: data.costs || null,
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || ''
        });
      });
      // Sort in memory by date/updatedAt
      list.sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || ''));
      onSuccess(list);
    },
    (err) => {
      const errInfo: FirestoreErrorInfo = {
        error: err instanceof Error ? err.message : String(err),
        authInfo: {
          userId: auth.currentUser?.uid || null,
          email: auth.currentUser?.email || null,
          emailVerified: auth.currentUser?.emailVerified || null
        },
        operationType: OperationType.GET,
        path: collectionPath
      };
      console.warn("Firestore Snapshot Listener Notice: ", JSON.stringify(errInfo));
      onError(errInfo);
    }
  );
}

/**
 * Save or update project in Firestore
 */
export async function saveUserProjectToCloud(uid: string, project: ProjectRecord) {
  const path = `users/${uid}/projects/${project.id}`;
  try {
    const docRef = doc(db, 'users', uid, 'projects', project.id);
    const payload = {
      id: project.id,
      name: project.name,
      location: project.location,
      date: project.date,
      structure: project.structure,
      grade: project.grade,
      volume: Number(project.volume),
      wastage: Number(project.wastage),
      notes: project.notes || '',
      rates: project.rates || null,
      quantities: project.quantities || null,
      costs: project.costs || null,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete a user project from Firestore
 */
export async function deleteUserProjectFromCloud(uid: string, projectId: string) {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    const docRef = doc(db, 'users', uid, 'projects', projectId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Migrate local projects into Firestore (without duplicate overwrites)
 */
export async function migrateLocalProjectsToFirestore(uid: string, localProjects: ProjectRecord[]) {
  if (!localProjects || localProjects.length === 0) return { count: 0, skipped: 0 };
  
  const path = `users/${uid}/projects`;
  try {
    const existingSnap = await getDocs(collection(db, 'users', uid, 'projects'));
    const existingIds = new Set<string>();
    existingSnap.forEach(d => existingIds.add(d.id));

    let count = 0;
    let skipped = 0;

    for (const p of localProjects) {
      if (existingIds.has(p.id)) {
        skipped++;
        continue;
      }
      await saveUserProjectToCloud(uid, p);
      count++;
    }

    return { count, skipped };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
