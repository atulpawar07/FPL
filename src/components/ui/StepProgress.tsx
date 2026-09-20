import React from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export interface StepProgressProps {
  currentStep: number; // 1, 2, 3
  steps: { id: number; title: string; subtitle?: string }[];
}

export const StepProgress: React.FC<StepProgressProps> = ({ currentStep, steps }) => {
  return (
    <div className="w-full my-4">
      {/* Mobile Compact Progress Bar */}
      <div className="block md:hidden bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between mb-2 text-xs font-semibold">
          <span className="text-emerald-400 uppercase tracking-wider">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-slate-200">
            {steps.find((s) => s.id === currentStep)?.title}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Tablet & Desktop Expanded Step Progress */}
      <div className="hidden md:flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
        <div
          className="absolute top-1/2 left-0 h-0.5 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center group cursor-pointer"
            >
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 shadow-md',
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-emerald-950/50 ring-4 ring-slate-950'
                    : isCurrent
                    ? 'bg-slate-900 border-2 border-emerald-500 text-emerald-400 ring-4 ring-emerald-950/50 shadow-emerald-900/30'
                    : 'bg-slate-900 border border-slate-700 text-slate-500 ring-4 ring-slate-950'
                )}
              >
                {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : step.id}
              </div>
              <div className="mt-2 text-center">
                <span
                  className={clsx(
                    'text-xs font-semibold tracking-wide block',
                    isCurrent
                      ? 'text-emerald-400 font-bold'
                      : isCompleted
                      ? 'text-slate-200'
                      : 'text-slate-500'
                  )}
                >
                  {step.title}
                </span>
                {step.subtitle && (
                  <span className="text-[10px] text-slate-400 block hidden lg:block">
                    {step.subtitle}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
