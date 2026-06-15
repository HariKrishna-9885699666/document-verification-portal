/**
 * OcrViewer - Display OCR-extracted data in a readable key-value format
 *
 * Renders a list of extracted fields (name, DOB, ID number, etc.)
 * in a clean two-column layout. Handles empty/missing data gracefully.
 */

interface OcrViewerProps {
  data: Record<string, any> | null;
}

export default function OcrViewer({ data }: OcrViewerProps) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-gray-400 text-sm">No OCR data available</p>;
  }

  return (
    <div className="bg-gray-50 rounded p-4">
      <dl className="space-y-2 text-sm">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex">
            {/* Field name: convert snake_case to Title Case */}
            <dt className="w-32 font-medium text-gray-500 capitalize">
              {key.replace(/_/g, ' ')}
            </dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
