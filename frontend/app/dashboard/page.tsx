'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';

interface Document {
  id: string;
  documentType: string;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(stored));
    fetchDocuments();
  }, [router]);

  async function fetchDocuments() {
    try {
      const data = await api.documents.list();
      setDocuments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Welcome, {user.name}</p>
        </div>
        <div className="flex gap-3">
          {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
            <Link href="/admin" className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">
              Admin Panel
            </Link>
          )}
          <Link href="/upload" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Upload Document
          </Link>
          <button onClick={handleLogout} className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200">
            Logout
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Your Documents</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No documents yet. <Link href="/upload" className="text-blue-600 hover:underline">Upload your first document</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-sm">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{doc.documentType}</td>
                    <td className="p-3"><StatusBadge status={doc.status} /></td>
                    <td className="p-3 text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
