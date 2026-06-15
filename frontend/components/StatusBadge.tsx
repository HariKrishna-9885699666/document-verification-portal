/**
 * StatusBadge - Color-coded document status indicator
 *
 * Maps each document status to a distinct color scheme:
 *   UPLOADED      - Gray (pending)
 *   PROCESSING    - Yellow (in progress)
 *   OCR_COMPLETED - Blue (extraction done)
 *   REVIEW_PENDING- Orange (awaiting admin)
 *   APPROVED      - Green (verified)
 *   REJECTED      - Red (failed)
 */

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  OCR_COMPLETED: 'bg-blue-100 text-blue-700',
  REVIEW_PENDING: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
