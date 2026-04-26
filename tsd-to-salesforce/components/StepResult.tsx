'use client';
import { useState } from 'react';
import { GeneratedFile, StepStatus, DeployResult } from '@/types/salesforce';
import { buildZipBlob } from '@/lib/xml-builder';

interface Props {
  stepId: number;
  titleHe: string;
  instructions: string;
  files: GeneratedFile[];
  status: StepStatus;
  deployResult?: DeployResult;
  onDeploy: () => void;
}

export default function StepResult({
  stepId,
  titleHe,
  instructions,
  files,
  status,
  deployResult,
  onDeploy,
}: Props) {
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function downloadZip() {
    const blob = await buildZipBlob(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `step${stepId}-${titleHe}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyFile(content: string, filename: string) {
    navigator.clipboard.writeText(content);
    setCopied(filename);
    setTimeout(() => setCopied(null), 2000);
  }

  const isBusy = status === 'deploying';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-green-400 text-xl">✅</span>
        <h3 className="text-white font-semibold">
          שלב {stepId} – {titleHe} מוכן ({files.length} קבצים)
        </h3>
      </div>

      {/* File list */}
      <div className="space-y-2">
        <p className="text-gray-400 text-sm font-medium">📁 קבצים שנוצרו:</p>
        {files.map((f) => (
          <div key={f.filename} className="bg-gray-900 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              onClick={() => setOpenFile(openFile === f.filename ? null : f.filename)}
            >
              <span className="font-mono text-blue-300 truncate">{f.filename}</span>
              <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                <button
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                  onClick={(e) => { e.stopPropagation(); copyFile(f.content, f.filename); }}
                >
                  {copied === f.filename ? '✓ הועתק' : 'העתק'}
                </button>
                <span>{openFile === f.filename ? '▲' : '▼'}</span>
              </div>
            </button>
            {openFile === f.filename && (
              <pre className="px-4 py-3 text-xs text-gray-300 overflow-x-auto max-h-72 bg-gray-950 font-mono leading-relaxed">
                {f.content}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Deploy button */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={onDeploy}
          disabled={isBusy || status === 'done'}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors
            ${status === 'done'
              ? 'bg-green-700 text-white cursor-default'
              : isBusy
              ? 'bg-blue-700 text-white cursor-wait'
              : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
        >
          {isBusy ? (
            <><span className="animate-spin">⟳</span> מעלה ל-Salesforce...</>
          ) : status === 'done' ? (
            <>✓ הועלה בהצלחה</>
          ) : (
            <>🚀 Deploy לשלב זה</>
          )}
        </button>
        <button
          onClick={downloadZip}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          ⬇️ הורד ZIP
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
        <p className="text-gray-400 text-xs font-medium mb-1">📋 מה לעשות אחרי ה-Deploy:</p>
        <p className="text-gray-200 text-sm">{instructions}</p>
      </div>

      {/* Deploy result */}
      {deployResult && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            deployResult.success
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}
        >
          {deployResult.success ? (
            <>✅ Deploy הצליח! מזהה: {deployResult.id}</>
          ) : (
            <>
              ❌ Deploy נכשל:
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {deployResult.errors?.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
