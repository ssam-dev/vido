/**
 * Error Display Component
 * 
 * Shows error messages to the user
 */

interface ErrorDisplayProps {
  error: string;
}

export default function ErrorDisplay({ error }: ErrorDisplayProps) {
  return (
    <div className="max-w-3xl mx-auto mb-8">
      <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-center">
        <p className="text-red-300">{error}</p>
      </div>
    </div>
  );
}
