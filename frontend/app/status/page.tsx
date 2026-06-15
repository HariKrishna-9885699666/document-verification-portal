'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';

export default function StatusPage() {
  const [documentId, setDocumentId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStatus(null);
    try {
      const res = await api.documents.getStatus(documentId);
      setStatus(res.status);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-600 hover:underline">&larr; Back to Dashboard</Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">Check Document Status</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Document ID</label>
          <input
            type="text"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter document UUID"
            required
          />
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700">
          Check Status
        </button>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>}

        {status && (
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-500">Document {documentId}</p>
            <p className="mt-2">
              Status: <StatusBadge status={status} />
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
