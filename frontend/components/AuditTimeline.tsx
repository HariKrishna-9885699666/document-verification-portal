/**
 * AuditTimeline - Vertical timeline display for audit trail
 *
 * Renders a chronological list of actions with a visual timeline connector.
 * Each entry shows:
 *   - A colored dot connected by a vertical line
 *   - The action name (human-readable)
 *   - Who performed it and when
 */

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  performedBy?: { name: string };
}

interface AuditTimelineProps {
  entries: AuditEntry[];
}

export default function AuditTimeline({ entries }: AuditTimelineProps) {
  if (!entries || entries.length === 0) {
    return <p className="text-gray-400 text-sm">No audit entries</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline connector: dot + line */}
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
            {idx < entries.length - 1 && (
              <div className="w-px flex-1 bg-gray-200" />
            )}
          </div>

          {/* Entry content */}
          <div className="text-sm">
            <p className="font-medium capitalize">
              {entry.action.replace(/_/g, ' ')}
            </p>
            <p className="text-gray-500 text-xs">
              {entry.performedBy?.name} &middot;{' '}
              {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
