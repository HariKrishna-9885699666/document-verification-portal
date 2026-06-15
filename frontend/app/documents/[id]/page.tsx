'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import OcrViewer from '@/components/OcrViewer';

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(stored));
    fetchDocument();
  }, [router]);

  async function fetchDocument() {
    try {
      const data = await api.documents.get(id);
      setDoc(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;
  if (loading) return <div className="p-6 text-center text-gray-400">Loading...</div>;
  if (!doc) return <div className="p-6 text-center text-gray-400">Document not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-600 hover:underline">&larr; Back to Dashboard</Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">{doc.documentType}</h1>
          <StatusBadge status={doc.status} />
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex">
            <dt className="w-32 text-gray-500">Document ID</dt>
            <dd className="font-mono">{doc.id}</dd>
          </div>
          <div className="flex">
            <dt className="w-32 text-gray-500">Uploaded</dt>
            <dd>{new Date(doc.createdAt).toLocaleString()}</dd>
          </div>
          {doc.remarks && (
            <div className="flex">
              <dt className="w-32 text-gray-500">Remarks</dt>
              <dd>{doc.remarks}</dd>
            </div>
          )}
        </dl>

        {doc.ocrData && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">OCR Extracted Data</h2>
            <OcrViewer data={doc.ocrData} />
          </div>
        )}
      </div>
    </div>
  );
}
