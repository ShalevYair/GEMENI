'use client';

interface Props {
  onClick: () => void;
  loading?: boolean;
  done?: boolean;
  label?: string;
}

export default function DeployButton({ onClick, loading, done, label = 'Deploy' }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={loading || done}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-colors
        ${done
          ? 'bg-green-700 text-white cursor-default'
          : loading
          ? 'bg-blue-700 text-white cursor-wait'
          : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
    >
      {loading ? <span className="animate-spin inline-block">⟳</span> : done ? '✓' : '🚀'}
      {loading ? 'מעלה...' : done ? 'הועלה!' : label}
    </button>
  );
}
