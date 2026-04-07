import { IExecuteFunctions } from 'n8n-workflow';
import * as crypto from 'crypto';

const B2_AUTH_URL = 'https://api.backblazeb2.com/b2api/v3/b2_authorize_account';

interface B2AuthResponse {
	absoluteMinimumPartSize: number;
	accountId: string;
	allowed: {
		bucketId?: string;
		bucketName?: string;
		capabilities: string[];
		namePrefix?: string;
	};
	apiInfo: {
		storageApi: {
			absoluteMinimumPartSize: number;
			apiUrl: string;
			bucketId?: string;
			bucketName?: string;
			capabilities: string[];
			downloadUrl: string;
			infoType: string;
			namePrefix?: string;
			recommendedPartSize: number;
			s3ApiUrl: string;
		};
	};
	applicationKeyExpirationTimestamp?: number;
	authorizationToken: string;
}

interface B2UploadUrlResponse {
	bucketId: string;
	uploadUrl: string;
	authorizationToken: string;
}

interface B2UploadResponse {
	accountId: string;
	action: string;
	bucketId: string;
	contentLength: number;
	contentSha1: string;
	contentType: string;
	fileId: string;
	fileName: string;
	uploadTimestamp: number;
}

/**
 * Authorize with Backblaze B2 and return auth data.
 */
export async function b2Authorize(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<B2AuthResponse> {
	const credentials = await context.getCredentials('backblazeB2Api', itemIndex);
	const keyId = credentials.applicationKeyId as string;
	const appKey = credentials.applicationKey as string;

	if (!keyId || !appKey) {
		throw new Error('Backblaze B2 Application Key ID and Application Key are required.');
	}

	const authString = Buffer.from(`${keyId}:${appKey}`).toString('base64');

	const response = await context.helpers.httpRequest({
		method: 'GET',
		url: B2_AUTH_URL,
		headers: {
			Authorization: `Basic ${authString}`,
		},
		json: true,
	});

	return response as B2AuthResponse;
}

/**
 * Get an upload URL for a specific bucket.
 */
export async function b2GetUploadUrl(
	context: IExecuteFunctions,
	auth: B2AuthResponse,
	bucketId: string,
): Promise<B2UploadUrlResponse> {
	const apiUrl = auth.apiInfo.storageApi.apiUrl;

	const response = await context.helpers.httpRequest({
		method: 'POST',
		url: `${apiUrl}/b2api/v3/b2_get_upload_url`,
		headers: {
			Authorization: auth.authorizationToken,
		},
		body: { bucketId },
		json: true,
	});

	return response as B2UploadUrlResponse;
}

/**
 * Upload a file buffer to Backblaze B2.
 */
export async function b2UploadFile(
	context: IExecuteFunctions,
	uploadUrlData: B2UploadUrlResponse,
	fileName: string,
	fileBuffer: Buffer,
	contentType: string,
): Promise<B2UploadResponse> {
	const sha1Hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
	const encodedFileName = encodeURIComponent(fileName).replace(/%2F/g, '/');

	const response = await context.helpers.httpRequest({
		method: 'POST',
		url: uploadUrlData.uploadUrl,
		headers: {
			Authorization: uploadUrlData.authorizationToken,
			'X-Bz-File-Name': encodedFileName,
			'Content-Type': contentType,
			'Content-Length': fileBuffer.length.toString(),
			'X-Bz-Content-Sha1': sha1Hash,
		},
		body: fileBuffer,
		json: true,
	});

	return response as B2UploadResponse;
}

/**
 * Make an authenticated API request to Backblaze B2.
 */
export async function b2ApiRequest(
	context: IExecuteFunctions,
	auth: B2AuthResponse,
	method: string,
	endpoint: string,
	body?: any,
	qs?: any,
): Promise<any> {
	const apiUrl = auth.apiInfo.storageApi.apiUrl;

	const options: any = {
		method,
		url: `${apiUrl}/b2api/v3/${endpoint}`,
		headers: {
			Authorization: auth.authorizationToken,
		},
		json: true,
	};

	if (body) {
		options.body = body;
	}

	if (qs) {
		options.qs = qs;
	}

	return await context.helpers.httpRequest(options);
}

/**
 * Resolve the Bucket ID from provided ID, restricted key, or credential bucket name.
 */
export async function getBucketId(
	context: IExecuteFunctions,
	auth: any,
	itemIndex: number,
	providedBucketId?: string,
): Promise<string> {
	// 1. If Bucket ID is explicitly provided, use it
	if (providedBucketId?.trim()) {
		return providedBucketId.trim();
	}

	// 2. If the application key is restricted to a specific bucket, B2 returns it in authorize_account
	if (auth.allowed?.bucketId) {
		return auth.allowed.bucketId;
	}

	// 3. Fallback: Resolve from Default Bucket Name in credentials
	const credentials = await context.getCredentials('backblazeB2Api', itemIndex);
	const bucketName = credentials.bucketName as string;

	if (bucketName?.trim()) {
		const result = await b2ApiRequest(context, auth, 'POST', 'b2_list_buckets', {
			accountId: auth.accountId,
			bucketName: bucketName.trim(),
		});

		if (result?.buckets && Array.isArray(result.buckets) && result.buckets.length > 0) {
			return result.buckets[0].bucketId;
		}

		throw new Error(`Could not find a B2 bucket with name "${bucketName}". Please check your credentials.`);
	}

	throw new Error('Bucket ID is required. Please provide a Bucket ID in the node or set a "Default Bucket Name" in your credentials.');
}

/**
 * Get content type from file name extension.
 */
export function getContentType(fileName: string): string {
	const ext = fileName.split('.').pop()?.toLowerCase() || '';
	const mimeTypes: { [key: string]: string } = {
		mp4: 'video/mp4',
		webm: 'video/webm',
		avi: 'video/x-msvideo',
		mov: 'video/quicktime',
		mkv: 'video/x-matroska',
		flv: 'video/x-flv',
		wmv: 'video/x-ms-wmv',
		m4v: 'video/x-m4v',
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		svg: 'image/svg+xml',
		webp: 'image/webp',
		pdf: 'application/pdf',
		zip: 'application/zip',
		json: 'application/json',
		xml: 'application/xml',
		csv: 'text/csv',
		txt: 'text/plain',
		html: 'text/html',
	};
	return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get file extension from mime type.
 */
export function getExtension(mimeType: string): string {
	const extensions: { [key: string]: string } = {
		'video/mp4': 'mp4',
		'video/webm': 'webm',
		'video/x-msvideo': 'avi',
		'video/quicktime': 'mov',
		'video/x-matroska': 'mkv',
		'video/x-flv': 'flv',
		'video/x-ms-wmv': 'wmv',
		'video/x-m4v': 'm4v',
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/gif': 'gif',
		'image/svg+xml': 'svg',
		'image/webp': 'webp',
		'application/pdf': 'pdf',
		'application/zip': 'zip',
		'application/json': 'json',
		'application/xml': 'xml',
		'text/csv': 'csv',
		'text/plain': 'txt',
		'text/html': 'html',
	};
	return extensions[mimeType] || '';
}