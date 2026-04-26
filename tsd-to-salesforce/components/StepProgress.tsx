'use client';
import { DEPLOY_STEPS } from '@/lib/gemini';
import { StepStatus } from '@/types/salesforce';

interface Props {
  currentStep: number;
  statuses: Record<number, StepStatus>;
}

const STATUS_ICON: Record<StepStatus, string> = {
  idle: '○',
  generating: '⟳',
  ready: '◎',
  deploying: '⟳',
  done: '✓',
  error: '✗',
};

const STATUS_COLOR: Record<StepStatus, string> = {
  idle: 'text-gray-500',
  generating: 'text-blue-400 animate-spin',
  ready: 'text-yellow-400',
  deploying: 'text-blue-400 animate-spin',
  done: 'text-green-400',
  error: 'text-red-400',
};

export default function StepProgress({ currentStep, statuses }: Props) {
  return (
    <div className="flex items-center justify-between w-full gap-2">
      {DEPLOY_STEPS.map((step, idx) => {
        const status = statuses[step.id] ?? 'idle';
        const isActive = step.id === currentStep;
        return (
          <div key={step.id} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-colors
                ${isActive ? 'border-blue-400 bg-blue-900/40' : 'border-gray-600 bg-gray-800'}`}
            >
              <span className={STATUS_COLOR[status]}>{STATUS_ICON[status]}</span>
            </div>
            <p className="text-xs text-center text-gray-300 leading-tight">{step.titleHe}</p>
            {idx < DEPLOY_STEPS.length - 1 && (
              <div className="absolute hidden" />
            )}
          </div>
        );
      })}
    </div>
  );
}
