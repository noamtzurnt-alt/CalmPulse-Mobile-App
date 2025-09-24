import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { auth } from '@/lib/firebase';

export type MediaType = 'photos' | 'videos';

type Kind = 'image' | 'video';

interface CreateUrlResponse {
	putUrl?: string;
	key?: string;
	publicUrl?: string;
	headers?: Record<string, string>;
}

interface ListResponseItem {
	key: string;
	url?: string;
	publicUrl?: string;
	[extra: string]: any;
}

function getBaseUrl(): string {
	const extra: any = Constants.expoConfig?.extra || {};
	const base: string | undefined = extra.MEDIA_API_URL || extra.EXPO_PUBLIC_MEDIA_API_URL;
	if (!base) throw new Error('MEDIA_API_URL is not configured');
	const sanitized = String(base).trim().replace(/\/$/, '');
	if (!/^https:\/\//i.test(sanitized)) throw new Error('MEDIA_API_URL must be HTTPS');
	return sanitized;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
	try {
		const token = await auth.currentUser?.getIdToken?.(true);
		return token ? { Authorization: `Bearer ${token}` } : {};
	} catch {
		return {};
	}
}

function guessExt(mime?: string, fallbackKind: Kind = 'image', fileUri?: string, filename?: string): string {
	const lowerName = String(filename || fileUri || '').toLowerCase();
	if (lowerName.endsWith('.heic') || (mime && /heic/i.test(mime))) return 'jpg';
	if (mime?.includes('png') || lowerName.endsWith('.png')) return 'png';
	if (mime?.includes('jpeg') || mime?.includes('jpg') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'jpg';
	if (mime && /quicktime|mov/i.test(mime)) return 'mp4';
	if (mime?.includes('mp4') || lowerName.endsWith('.mp4')) return 'mp4';
	return fallbackKind === 'video' ? 'mp4' : 'jpg';
}

function toKind(t: MediaType): Kind {
	return t === 'videos' ? 'video' : 'image';
}

export async function uploadFileToR2(params: {
	uploadUserId?: string; // backward-friendly alias (not used)
	uid?: string;
	type: MediaType;
	fileUri: string;
	filename?: string;
	mime?: string;
}): Promise<{ url: string; key: string } | null> {
	const { type, fileUri, filename, mime } = params;
	const base = getBaseUrl();

	const kind: Kind = toKind(type);
	let contentType = mime || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
	let ext = guessExt(mime, kind, fileUri, filename);
	// Normalize iOS-specific formats
	if (kind === 'video' && (/quicktime|mov/i.test(String(mime)) || String(filename || fileUri).toLowerCase().endsWith('.mov'))) {
		contentType = 'video/mp4';
		ext = 'mp4';
	}
	if (kind === 'image' && (/heic/i.test(String(mime)) || String(filename || fileUri).toLowerCase().endsWith('.heic'))) {
		contentType = 'image/jpeg';
		ext = 'jpg';
	}

	const info = await FileSystem.getInfoAsync(fileUri, { size: true });
	const byteLength = (info.exists && typeof info.size === 'number') ? info.size : 0;
	if (!byteLength) return null;

	const authHeaders = await getAuthHeaders();
	const createResp = await fetch(`${base}/create-url`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders },
		body: JSON.stringify({ uid: params.uid, kind, contentType, ext, byteLength })
	});
	if (!createResp.ok) {
		try { console.warn('create-url failed', createResp.status, await createResp.text()); } catch {}
		return null;
	}
	const data: CreateUrlResponse = await createResp.json().catch(() => ({} as any));
	const putUrl = data.putUrl;
	const key = data.key;
	if (!putUrl || !key) return null;

	const putHeaders: Record<string, string> = { 'Content-Type': contentType, 'Content-Length': String(byteLength) };
	if (data && typeof data.headers === 'object' && data.headers) {
		for (const [k, v] of Object.entries(data.headers)) {
			if (typeof v === 'string') putHeaders[k] = v;
		}
	}

	const putResult = await FileSystem.uploadAsync(putUrl, fileUri, {
		httpMethod: 'PUT',
		headers: putHeaders,
		uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
	});
	if (putResult.status < 200 || putResult.status >= 300) {
		try { console.warn('R2 PUT failed', putResult.status, putResult.body?.slice?.(0, 200)); } catch {}
		return null;
	}

	const publicUrl = data.publicUrl || '';
	return { url: publicUrl, key };
}

export async function loadUserMedia(uid: string, type: MediaType): Promise<any[]> {
	const base = getBaseUrl();
	const q = uid ? `?uid=${encodeURIComponent(uid)}` : '';
	const authHeaders = await getAuthHeaders();
	const resp = await fetch(`${base}/list${q}`, { headers: { ...authHeaders } });
	if (!resp.ok) return [];
	const payload = await resp.json().catch(() => ({}));
	let items: ListResponseItem[] = Array.isArray(payload?.items) ? payload.items : [];
	// Filter by requested media type to avoid mixing photos/videos
	const wantVideo = type === 'videos';
	items = items.filter((it) => {
		const key = String(it?.key || '').toLowerCase();
		if (wantVideo) {
			return key.includes('/video/') || key.endsWith('.mp4');
		}
		return key.includes('/image/') || key.endsWith('.jpg') || key.endsWith('.jpeg') || key.endsWith('.png');
	});
	return items
		.map((it) => ({
			uri: it.publicUrl || it.url || '',
			remoteKey: it.key,
			...it,
		}))
		.filter(x => !!x.remoteKey);
}

export async function deleteFilesFromR2(uid: string, keys: string[], _type?: MediaType): Promise<boolean> {
	const base = getBaseUrl();
	const authHeaders = await getAuthHeaders();
	for (const key of keys) {
		const r = await fetch(`${base}/delete`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeaders },
			body: JSON.stringify({ uid, key })
		});
		if (!r.ok) return false;
	}
	return true;
}

export async function saveUserMedia(_uid: string, _type: MediaType, _items: any[]): Promise<boolean> {
	return true;
}

export async function getQuota(_uid: string): Promise<{ ok?: boolean; extraVideos: number } | null> {
	return { ok: true, extraVideos: 0 };
}

export async function addQuota(_uid: string, amount: number): Promise<{ ok: boolean; extraVideos?: number }> {
	return { ok: true, extraVideos: amount };
} 