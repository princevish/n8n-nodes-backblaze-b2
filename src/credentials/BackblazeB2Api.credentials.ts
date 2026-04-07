import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class BackblazeB2Api implements ICredentialType {
	name = 'backblazeB2Api';
	displayName = 'Backblaze B2 API';
	documentationUrl = 'https://www.backblaze.com/docs/cloud-storage';

	properties: INodeProperties[] = [
		{
			displayName: 'Application Key ID',
			name: 'applicationKeyId',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. 005de222866735c0000000003',
			description: 'The Application Key ID (also called Access Key ID) from your Backblaze B2 account',
		},
		{
			displayName: 'Application Key',
			name: 'applicationKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The Application Key (also called Secret Access Key) from your Backblaze B2 account',
		},
		{
			displayName: 'S3 Endpoint URL',
			name: 'endpointUrl',
			type: 'string',
			default: '',
			placeholder: 'e.g. https://s3.us-east-005.backblazeb2.com',
			description: 'Optional. The S3-compatible endpoint URL (for reference only, the node uses the native B2 API).',
		},
		{
			displayName: 'Default Bucket Name',
			name: 'bucketName',
			type: 'string',
			default: '',
			placeholder: 'e.g. zoho-session-recording-dev',
			description: 'Optional. Default bucket name. The node will auto-resolve this to a Bucket ID if you leave the Bucket ID field empty.',
		},
	];
}