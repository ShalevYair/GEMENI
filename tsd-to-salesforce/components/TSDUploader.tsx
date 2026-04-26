'use client';
import { useCallback, useState } from 'react';

interface Props {
  onUpload: (content: string) => void;
}

export default function TSDUploader({ onUpload }: Props) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
        alert('נא להעלות קובץ Markdown (.md) או טקסט (.txt)');
        return;
      }
      const text = await file.text();
      if (!text.trim()) {
        alert('הקובץ ריק. נא להעלות קובץ TSD תקין.');
        return;
      }
      setFileName(file.name);
      onUpload(text);
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
        ${dragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-600 hover:border-gray-400'}`}
    >
      <input
        type="file"
        accept=".md,.txt"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="text-4xl mb-3">📄</div>
      {fileName ? (
        <>
          <p className="text-green-400 font-semibold">{fileName}</p>
          <p className="text-gray-400 text-sm mt-1">לחץ להחלפת קובץ</p>
        </>
      ) : (
        <>
          <p className="text-gray-200 font-semibold">גרור קובץ TSD לכאן</p>
          <p className="text-gray-400 text-sm mt-1">או לחץ לבחירת קובץ (.md / .txt)</p>
        </>
      )}
    </div>
  );
}
