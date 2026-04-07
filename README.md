# n8n-nodes-backblaze-b2

🚀 Backblaze B2 Cloud Storage integration for n8n.

---

## ✨ Features

### ☁️ Cloud Storage Operations
- **Upload Files**: Upload binary data to Backblaze B2 buckets
- **List Files**: List files in buckets with prefix filtering
- **Delete Files**: Remove files from B2 storage
- **Get Download URLs**: Generate download links for files

### 🔐 Authentication
- **Application Key Authentication**: Secure API key-based authentication
- **Bucket Restrictions**: Support for restricted application keys
- **Auto Bucket Resolution**: Resolve bucket names to IDs automatically

### 📁 Bucket Management
- **List Buckets**: View all accessible buckets
- **Flexible Bucket Selection**: Use bucket IDs or names

### ⚙️ Production Grade
- **Large File Support**: Efficient handling of large uploads
- **Content Type Detection**: Automatic MIME type detection
- **SHA1 Verification**: Built-in file integrity checks

---

## 📦 Installation

### Option 1 — n8n UI (Recommended)
1. Go to **Settings > Community Nodes**.
2. Click **Install a node**.
3. Enter `n8n-nodes-backblaze-b2`.
4. Agree to the TOS and click **Install**.

### Option 2 — Manual (CLI)
In your n8n installation directory, run:
```bash
npm install n8n-nodes-backblaze-b2
```

---

## 🔐 Credentials Setup

1. Go to your [Backblaze B2 Account](https://secure.backblaze.com/b2_buckets.htm).
2. Navigate to **App Keys** section.
3. Create a new Application Key with appropriate permissions.
4. Copy the **Key ID** and **Application Key**.
5. In n8n, paste these values in the Backblaze B2 API credential.

### Required Permissions
For full functionality, your application key should have:
- `readBuckets` (for listing buckets)
- `readFiles` (for listing files)
- `writeFiles` (for uploading files)
- `deleteFiles` (for deleting files)

---

## 🚀 Resources & Operations

| Resource | Operations |
| :--- | :--- |
| **File** | Upload, List, Delete, Get Download URL |
| **Bucket** | List |

### 💡 Pro Tip: Bucket Names
You can set a default bucket name in your credentials. The node will automatically resolve this to a bucket ID, making workflows cleaner.

---

## 📄 License
[MIT](LICENSE)

## 🤝 Support
For bugs and feature requests, please open an [Issue](https://github.com/princevish/n8n-nodes-backblaze-b2/issues).

---
Made with ❤️ by [Prince Vishwakarma](https://github.com/princevish)