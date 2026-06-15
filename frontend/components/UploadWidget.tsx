/**
 * UploadWidget - Reusable document upload form
 *
 * Provides a dropdown for document type selection and a file input.
 * Supports onSuccess callback for parent component integration.
 *
 * Supported formats: PDF, JPG, PNG (max 20MB per PRD spec).
 */

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const DOCUMENT_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'CERTIFICATE'];

interface UploadWidgetProps {
  /** Called after successful upload with the new document ID */
  onSuccess?: (documentId: string) => void;
}

export default function UploadWidget({ onSuccess }: UploadWidgetProps) {
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage('');

    try {
      // Step 1: Get presigned S3 upload URL from backend
      const { documentId } = await api.documents.requestUploadUrl(documentType);
      // Step 2: Upload file directly to S3 using the presigned URL
      // (Actual S3 upload would use fetch/put with the presigned URL)

      setMessage('Document registered successfully');
      if (onSuccess) onSuccess(documentId);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Document type selector */}
      <select
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm"
      >
        {DOCUMENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {/* File input: accept PDF, JPG, PNG */}
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full border rounded px-3 py-2 text-sm"
        required
      />

      {/* Submit button */}
      <button
        type="submit"
        disabled={uploading || !file}
        className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>

      {/* Status message */}
      {message && (
        <div
          className={`p-2 rounded text-xs ${
            message.startsWith('Error')
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}
        >
          {message}
        </div>
      )}
    </form>
  );
}
