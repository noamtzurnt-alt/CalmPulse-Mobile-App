import Constants from 'expo-constants';
import { auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

const extra: any = (Constants.expoConfig?.extra as any) ?? (Constants.manifestExtra as any) ?? {};
const MEDIA_API_URL: string | undefined = extra.MEDIA_API_URL;

async function ensureUrl(): Promise<string> {
  if (!MEDIA_API_URL) throw new Error('MEDIA_API_URL is not configured');
  const sanitized = String(MEDIA_API_URL).trim().replace(/\/$/, '');
  if (!/^https:\/\//i.test(sanitized)) throw new Error('MEDIA_API_URL must be HTTPS');
  return sanitized;
}

function b64urlToString(b64url: string): string {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const hasAtob = typeof (globalThis as any).atob === 'function';
  const raw = hasAtob ? (globalThis as any).atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  return raw;
}

async function authHeaders(): Promise<Record<string, string>> {
  // Ensure we have a user (anonymous if needed)
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth as any);
    } catch (e) {
      // no-op; we'll still try to get a token below
    }
  }

  // Try to obtain a fresh Firebase ID token with retries
  const maxAttempts = 10;
  const delayMs = 300;
  let lastError: any = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // First try forced refresh
      const token = await auth.currentUser?.getIdToken?.(true);
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
      // Fallback to non-forced
      const token2 = await auth.currentUser?.getIdToken?.();
      if (token2) {
        return { Authorization: `Bearer ${token2}` };
      }
    } catch (e) {
      lastError = e;
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  if (!auth.currentUser) {
    console.warn('mediaApi: No authenticated user; requests will be unauthorized');
  } else if (lastError) {
    console.warn('mediaApi: Failed to get ID token');
  } else {
    console.warn('mediaApi: Missing ID token');
  }
  return {};
}

export async function loadUserMedia(uid: string, type: 'photos' | 'videos'): Promise<any[]> {
  const base = await ensureUrl();
  const url = `${base}?uid=${encodeURIComponent(uid)}&type=${encodeURIComponent(type)}`;
  const resp = await fetch(url, { method: 'GET', headers: await authHeaders() });
  if (!resp.ok) {
    try { console.warn('R2 load failed', resp.status, await resp.text()); } catch {}
    return [];
  }
  const data = await resp.json().catch(() => ({ items: [] }));
  return Array.isArray(data?.items) ? data.items : [];
}

export async function saveUserMedia(uid: string, type: 'photos' | 'videos', items: any[]): Promise<boolean> {
  const base = await ensureUrl();
  const resp = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ uid, type, items })
  });
  if (!resp.ok) {
    try { console.warn('R2 save failed', resp.status, await resp.text()); } catch {}
  }
  return resp.ok;
}

export async function uploadFileToR2(params: { uid: string; type: 'photos' | 'videos'; fileUri: string; filename?: string; mime?: string }): Promise<{ url: string; key: string; contentType: string } | null> {
  const { uid, type, fileUri, filename, mime } = params;
  const base = await ensureUrl();
  const uploadUrl = `${base}/upload`;

  const form = new FormData();
  form.append('uid', uid);
  form.append('type', type);

  const name = filename || fileUri.split('/')?.pop() || 'file';
  const contentType = mime || (name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
  form.append('file', {
    uri: fileUri,
    name,
    type: contentType,
  } as any);
  form.append('filename', name);
  form.append('mime', contentType);

  const resp = await fetch(uploadUrl, { method: 'POST', headers: await authHeaders(), body: form as any });
  if (!resp.ok) {
    try { console.warn('R2 upload failed', resp.status, await resp.text()); } catch {}
    return null;
  }
  const data = await resp.json();
  if (data?.ok && data?.url && data?.key) {
    return { url: data.url, key: data.key, contentType: data.contentType || contentType };
  }
  return null;
}

export async function deleteFilesFromR2(uid: string, keys: string[]): Promise<boolean> {
  if (!keys || keys.length === 0) return true;
  const base = await ensureUrl();
  const resp = await fetch(`${base}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ uid, keys })
  });
  if (!resp.ok) {
    try { console.warn('R2 delete failed', resp.status, await resp.text()); } catch {}
  }
  return resp.ok;
}

export async function getQuota(uid: string): Promise<{ extraVideos: number }> {
  const base = await ensureUrl();
  const resp = await fetch(`${base}/quota?uid=${encodeURIComponent(uid)}`, { method: 'GET', headers: await authHeaders() });
  if (!resp.ok) return { extraVideos: 0 };
  const data = await resp.json().catch(() => ({ extraVideos: 0 }));
  return { extraVideos: Number(data?.extraVideos || 0) };
}

export async function addQuota(uid: string, addVideos: number): Promise<{ ok: boolean; extraVideos: number }> {
  const base = await ensureUrl();
  const resp = await fetch(`${base}/quota`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ uid, addVideos })
  });
  if (!resp.ok) return { ok: false, extraVideos: 0 };
  const data = await resp.json().catch(() => ({ ok: false, extraVideos: 0 }));
  return { ok: !!data?.ok, extraVideos: Number(data?.extraVideos || 0) };
} 