'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TSDUploader from '@/components/TSDUploader';

export default function HomePage() {
  const router = useRouter();
  const [tsdContent, setTsdContent] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [sfError, setSfError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('sf_error');
    if (err) setSfError(decodeURIComponent(err));

    const saved = sessionStorage.getItem('tsd_content');
    if (saved) setTsdContent(saved);
    const savedKey = sessionStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  function handleUpload(content: string) {
    setTsdContent(content);
    sessionStorage.setItem('tsd_content', content);
  }

  function handleApiKey(val: string) {
    setApiKey(val);
    sessionStorage.setItem('gemini_api_key', val);
  }

  function connectSalesforce() {
    window.location.href = '/api/auth/salesforce';
  }

  function startWithoutSF() {
    router.push('/deploy?no_sf=1');
  }

  const ready = tsdContent.trim() && apiKey.trim();

  return (
    <main className="min-h-screen bg-gray-950 text-white" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">🚀 TSD → Salesforce</h1>
          <p className="text-gray-400">
            העלה מסמך TSD בפורמט Markdown וקבל מערכת Salesforce מוכנה לפריסה
          </p>
        </div>

        {sfError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">
            ❌ שגיאת Salesforce: {sfError}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
          <label className="block text-sm font-semibold text-gray-300">
            מפתח API של Gemini
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKey(e.target.value)}
            placeholder="הדבק את מפתח ה-API מ-aistudio.google.com"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            dir="ltr"
          />
          <p className="text-gray-500 text-xs">המפתח נשמר ב-sessionStorage בלבד לצורך השימוש הנוכחי</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-300">קובץ TSD</p>
          <TSDUploader onUpload={handleUpload} />
          {tsdContent && (
            <p className="text-green-400 text-sm">
              ✅ הקובץ נטען בהצלחה ({tsdContent.length.toLocaleString()} תווים)
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={connectSalesforce}
            disabled={!ready}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-lg transition-colors
              ${ready
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
          >
            🔗 חבר Salesforce והתחל יצירה
          </button>
          <button
            onClick={startWithoutSF}
            disabled={!ready}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base transition-colors
              ${ready
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600'
                : 'bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800'}`}
          >
            ⚡ המשך בלי Salesforce (הורדת ZIP בלבד)
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs">
          Salesforce Connected App נדרש לחיבור ישיר. ראה README להוראות.
        </p>
      </div>
    </main>
  );
}
