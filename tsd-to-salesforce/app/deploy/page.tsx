'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import StepProgress from '@/components/StepProgress';
import StepResult from '@/components/StepResult';
import { DEPLOY_STEPS } from '@/lib/gemini';
import { StepStatus, StepState, SalesforceSession, DeployResult } from '@/types/salesforce';

function DeployPageInner() {
  const params = useSearchParams();

  const [tsdContent, setTsdContent] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [session, setSession] = useState<SalesforceSession | null>(null);
  const [noSf, setNoSf] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStates, setStepStates] = useState<Record<number, StepState>>(
    Object.fromEntries(DEPLOY_STEPS.map((s) => [s.id, { status: 'idle' as StepStatus, files: [] }]))
  );
  const [toast, setToast] = useState('');
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tsd = sessionStorage.getItem('tsd_content') ?? '';
    const key = sessionStorage.getItem('gemini_api_key') ?? '';
    setTsdContent(tsd);
    setApiKey(key);

    const at = params.get('access_token');
    const iu = params.get('instance_url');
    if (at && iu) {
      setSession({ accessToken: at, instanceUrl: iu });
    }
    if (params.get('no_sf') === '1') setNoSf(true);
  }, [params]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 4000);
  }

  function setStepField<K extends keyof StepState>(step: number, key: K, value: StepState[K]) {
    setStepStates((prev) => ({ ...prev, [step]: { ...prev[step], [key]: value } }));
  }

  async function generateStep(stepId: number) {
    if (!tsdContent) { showToast('לא נמצא קובץ TSD. חזור לדף הראשי.'); return; }
    if (!apiKey) { showToast('לא נמצא מפתח API. חזור לדף הראשי.'); return; }

    setStepField(stepId, 'status', 'generating');
    setStepField(stepId, 'error', undefined);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tsdContent, step: stepId, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStepField(stepId, 'files', data.files);
      setStepField(stepId, 'status', 'ready');
      showToast(`✅ שלב ${stepId} נוצר עם ${data.files.length} קבצים`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      setStepField(stepId, 'status', 'error');
      setStepField(stepId, 'error', message);
      showToast(`❌ שגיאה בשלב ${stepId}: ${message}`);
    }
  }

  async function deployStep(stepId: number) {
    if (!session) { showToast('לא מחובר ל-Salesforce. חזור לדף הראשי.'); return; }
    const files = stepStates[stepId].files;
    if (!files.length) { showToast('אין קבצים ל-deploy'); return; }

    setStepField(stepId, 'status', 'deploying');
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, accessToken: session.accessToken, instanceUrl: session.instanceUrl }),
      });
      const result: DeployResult = await res.json();
      setStepField(stepId, 'deployResult', result);
      setStepField(stepId, 'status', result.success ? 'done' : 'error');
      if (result.success) {
        showToast(`✅ שלב ${stepId} הועלה בהצלחה!`);
        if (stepId < 4) setCurrentStep(stepId + 1);
      } else {
        showToast(`❌ Deploy נכשל: ${result.errors?.[0] ?? 'שגיאה לא ידועה'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      setStepField(stepId, 'status', 'error');
      showToast(`❌ שגיאת רשת: ${message}`);
    }
  }

  const statuses = Object.fromEntries(
    Object.entries(stepStates).map(([k, v]) => [k, v.status])
  ) as Record<number, StepStatus>;

  return (
    <main className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 border border-gray-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm max-w-sm">
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">🚀 יצירה ופריסה ל-Salesforce</h1>
          {session ? (
            <p className="text-green-400 text-sm">✅ מחובר ל-Salesforce: {session.instanceUrl}</p>
          ) : noSf ? (
            <p className="text-yellow-400 text-sm">⚠️ מצב הורדה בלבד (ללא חיבור ל-Salesforce)</p>
          ) : (
            <p className="text-gray-400 text-sm">לא מחובר ל-Salesforce</p>
          )}
        </div>

        {/* Step progress */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <StepProgress currentStep={currentStep} statuses={statuses} />
        </div>

        {/* Steps */}
        {DEPLOY_STEPS.map((step) => {
          const state = stepStates[step.id];
          const isActive = step.id === currentStep;
          const isPast = step.id < currentStep;

          return (
            <div
              key={step.id}
              className={`rounded-xl border transition-all ${
                isActive
                  ? 'border-blue-500 bg-gray-900'
                  : isPast
                  ? 'border-gray-700 bg-gray-900/50 opacity-80'
                  : 'border-gray-800 bg-gray-900/30 opacity-50'
              }`}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-gray-400 text-sm">שלב {step.id}</span>
                    <h2 className="text-white font-bold text-lg">{step.titleHe}</h2>
                    <p className="text-gray-400 text-sm">{step.description}</p>
                  </div>
                  {(state.status === 'idle' || state.status === 'error') && isActive && (
                    <button
                      onClick={() => generateStep(step.id)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                    >
                      ⚡ צור קבצים
                    </button>
                  )}
                  {state.status === 'generating' && (
                    <div className="flex items-center gap-2 text-blue-400 text-sm">
                      <span className="animate-spin">⟳</span> מייצר קבצים...
                    </div>
                  )}
                  {state.status === 'error' && !isActive && (
                    <button
                      onClick={() => { setCurrentStep(step.id); generateStep(step.id); }}
                      className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      🔄 נסה שוב
                    </button>
                  )}
                </div>

                {state.error && (
                  <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
                    ❌ {state.error}
                    <button
                      className="mr-3 text-xs underline text-red-400 hover:text-red-300"
                      onClick={() => generateStep(step.id)}
                    >
                      נסה שוב
                    </button>
                  </div>
                )}

                {state.files.length > 0 && (
                  <StepResult
                    stepId={step.id}
                    titleHe={step.titleHe}
                    instructions={step.instructions}
                    files={state.files}
                    status={state.status}
                    deployResult={state.deployResult}
                    onDeploy={() => deployStep(step.id)}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Done */}
        {Object.values(stepStates).every((s) => s.status === 'done') && (
          <div className="bg-green-900/30 border border-green-600 rounded-xl p-6 text-center space-y-2">
            <div className="text-4xl">🎉</div>
            <h2 className="text-green-300 text-xl font-bold">כל השלבים הושלמו בהצלחה!</h2>
            <p className="text-gray-400 text-sm">
              הפריסה ל-Salesforce הושלמה. עכשיו ניתן להקצות הרשאות ולבדוק את המערכת.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DeployPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">טוען...</div>}>
      <DeployPageInner />
    </Suspense>
  );
}
