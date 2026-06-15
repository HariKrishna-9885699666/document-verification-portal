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
  user: { name: string; email: string };
  remarks?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [pending, setPending] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
      return;
    }
    const u = JSON.parse(stored);
    if (u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    setUser(u);
    fetchPending();
  }, [router]);

  async function fetchPending() {
    try {
      const data = await api.admin.getPending();
      setPending(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionMsg('');
    try {
      const remarks = action === 'reject' ? prompt('Reason for rejection:') : undefined;
      if (action === 'reject' && !remarks) return;
      await (action === 'approve' ? api.admin.approve(id) : api.admin.reject(id, remarks ?? undefined));
      setPending((prev) => prev.filter((d) => d.id !== id));
      setActionMsg(`Document ${action}d successfully`);
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-500">Review pending documents</p>
        </div>
        <Link href="/dashboard" className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">
          User Dashboard
        </Link>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded text-sm mb-4 ${actionMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {actionMsg}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Pending Review ({pending.length})</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : pending.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No pending documents</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-sm">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {pending.map((doc) => (
                  <tr key={doc.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{doc.user?.name}</div>
                      <div className="text-gray-500 text-xs">{doc.user?.email}</div>
                    </td>
                    <td className="p-3">{doc.documentType}</td>
                    <td className="p-3"><StatusBadge status={doc.status} /></td>
                    <td className="p-3 text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 space-x-2">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleAction(doc.id, 'approve')}
                        className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs hover:bg-green-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(doc.id, 'reject')}
                        className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs hover:bg-red-200"
                      >
                        Reject
                      </button>
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
