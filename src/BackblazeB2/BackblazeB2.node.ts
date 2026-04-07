import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
} from 'n8n-workflow';

import {
	b2Authorize,
	b2GetUploadUrl,
	b2UploadFile,
	b2ApiRequest,
	getContentType,
	getBucketId,
	getExtension,
} from './B2GenericFunctions';

export class BackblazeB2 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Backblaze B2',
		name: 'backblazeB2',
		icon: 'file:backblazeB2.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Upload, list, delete, and manage files on Backblaze B2 Cloud Storage',
		defaults: { name: 'Backblaze B2' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'backblazeB2Api', required: true }],
		properties: [
			// --- Resource ---
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'File', value: 'file', description: 'Manage files in B2 buckets' },
					{ name: 'Bucket', value: 'bucket', description: 'Manage B2 buckets' },
				],
				default: 'file',
			},

			// --- File Operations ---
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['file'],
					},
				},
				options: [
					{ name: 'Upload', value: 'upload', description: 'Upload a file to a B2 bucket' },
					{ name: 'List', value: 'list', description: 'List files in a B2 bucket' },
					{ name: 'Delete', value: 'delete', description: 'Delete a file from B2' },
					{ name: 'Get Download URL', value: 'getDownloadUrl', description: 'Get a download URL for a file' },
				],
				default: 'upload',
			},

			// --- Bucket Operations ---
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['bucket'],
					},
				},
				options: [
					{ name: 'List', value: 'list', description: 'List all buckets' },
				],
				default: 'list',
			},

			// ========== FILE PARAMETERS ==========

			// Bucket ID (for upload, list — optional if bucket name is set in credentials)
			{
				displayName: 'Bucket ID',
				name: 'bucketId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['upload', 'list'],
					},
				},
				default: '',
				placeholder: 'e.g. 4a48fe8875c6214145260818',
				description: 'The ID of the B2 bucket. Leave empty to auto-resolve from the Default Bucket Name in your credentials.',
			},

			// File Name (for upload)
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['upload'],
					},
				},
				default: '',
				placeholder: 'e.g. videos/recording.mp4',
				description: 'The name/path for the file in the bucket (supports folder paths like "videos/my-video.mp4")',
			},

			// Binary Property (for upload)
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['upload'],
					},
				},
				default: 'data',
				description: 'Name of the binary property containing the file data to upload. Use "video" if uploading from Zoho Assist Download Recording.',
			},

			// Content Type (for upload, optional override)
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['upload'],
					},
				},
				default: '',
				placeholder: 'e.g. video/mp4',
				description: 'MIME type of the file. Leave empty to auto-detect from file name.',
			},

			// File ID (for delete, getDownloadUrl)
			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['delete', 'getDownloadUrl'],
					},
				},
				default: '',
				description: 'The ID of the file in B2 (returned from upload or list operations)',
			},

			// File Name for Delete (required by B2 API)
			{
				displayName: 'File Name',
				name: 'deleteFileName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['delete'],
					},
				},
				default: '',
				description: 'The name of the file to delete (must match the file name in B2)',
			},

			// List options
			{
				displayName: 'Max Files',
				name: 'maxFileCount',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['list'],
					},
				},
				default: 100,
				description: 'Maximum number of files to return (1-10000)',
			},
			{
				displayName: 'Prefix',
				name: 'prefix',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['list'],
					},
				},
				default: '',
				placeholder: 'e.g. videos/',
				description: 'Only return files whose names start with this prefix (useful for listing folder contents)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				// Authorize with B2 for every item (token is short-lived)
				const auth = await b2Authorize(this, i);

				if (resource === 'file') {
					if (operation === 'upload') {
						const providedBucketId = String(this.getNodeParameter('bucketId', i) ?? '');
						const fileName = String(this.getNodeParameter('fileName', i) ?? '');
						const binaryPropertyName = String(this.getNodeParameter('binaryPropertyName', i) ?? 'data');
						const contentTypeOverride = String(this.getNodeParameter('contentType', i, '') ?? '');

						// Resolve bucketId (manual input -> restricted key -> credentials)
						const bucketId = await getBucketId(this, auth, i, providedBucketId);

						if (!fileName.trim()) throw new Error('File Name is required.');

						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

						// Force filename extension if missing
						let finalFileName = fileName.trim();
						if (!finalFileName.includes('.') && binaryData) {
							const ext = binaryData.fileExtension
								|| (binaryData.fileName?.includes('.') ? binaryData.fileName.split('.').pop() : '')
								|| getExtension(binaryData.mimeType);

							if (ext) {
								finalFileName += `.${ext}`;
							}
						}

						const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

						// Determine content type
						const contentType = contentTypeOverride.trim()
							|| binaryData.mimeType
							|| getContentType(finalFileName);

						// Step 1: Get upload URL
						const uploadUrlData = await b2GetUploadUrl(this, auth, bucketId.trim());

						// Step 2: Upload the file
						const uploadResult = await b2UploadFile(
							this,
							uploadUrlData,
							finalFileName,
							fileBuffer,
							contentType,
						);

						// Build download URL
						const downloadUrl = `${auth.apiInfo.storageApi.downloadUrl}/file/${uploadResult.bucketId}/${uploadResult.fileName}`;

						returnData.push({
							json: {
								...uploadResult,
								downloadUrl,
								success: true,
							},
						});
					} else if (operation === 'list') {
						const providedBucketId = this.getNodeParameter('bucketId', i) as string;
						const maxFileCount = this.getNodeParameter('maxFileCount', i, 100) as number;
						const prefix = this.getNodeParameter('prefix', i, '') as string;

						// Resolve bucketId (manual input -> restricted key -> credentials)
						const bucketId = await getBucketId(this, auth, i, providedBucketId);

						const body: any = {
							bucketId: bucketId.trim(),
							maxFileCount: Math.min(Math.max(maxFileCount, 1), 10000),
						};

						if (prefix.trim()) {
							body.prefix = prefix.trim();
						}

						const result = await b2ApiRequest(this, auth, 'POST', 'b2_list_file_names', body);

						if (Array.isArray(result?.files)) {
							returnData.push(...result.files.map((file: any) => ({ json: file })));
						} else {
							returnData.push({ json: result });
						}
					} else if (operation === 'delete') {
						const fileId = this.getNodeParameter('fileId', i) as string;
						const deleteFileName = this.getNodeParameter('deleteFileName', i) as string;

						if (!fileId.trim()) throw new Error('File ID is required.');
						if (!deleteFileName.trim()) throw new Error('File Name is required for deletion.');

						const result = await b2ApiRequest(this, auth, 'POST', 'b2_delete_file_version', {
							fileId: fileId.trim(),
							fileName: deleteFileName.trim(),
						});

						returnData.push({ json: { ...result, success: true } });
					} else if (operation === 'getDownloadUrl') {
						const fileId = this.getNodeParameter('fileId', i) as string;

						if (!fileId.trim()) throw new Error('File ID is required.');

						const downloadUrl = `${auth.apiInfo.storageApi.downloadUrl}/b2api/v3/b2_download_file_by_id?fileId=${encodeURIComponent(fileId.trim())}`;

						returnData.push({
							json: {
								fileId: fileId.trim(),
								downloadUrl,
								success: true,
							},
						});
					} else {
						throw new Error(`The operation "${operation}" is not supported.`);
					}
				} else if (resource === 'bucket') {
					if (operation === 'list') {
						const result = await b2ApiRequest(this, auth, 'POST', 'b2_list_buckets', {
							accountId: auth.accountId,
						});

						if (Array.isArray(result?.buckets)) {
							returnData.push(...result.buckets.map((bucket: any) => ({ json: bucket })));
						} else {
							returnData.push({ json: result });
						}
					} else {
						throw new Error(`The operation "${operation}" is not supported.`);
					}
				} else {
					throw new Error(`The resource "${resource}" is not supported.`);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as any);
			}
		}

		return [returnData];
	}
}