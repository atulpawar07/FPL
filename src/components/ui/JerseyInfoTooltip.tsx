'use client';

import React, { useState } from 'react';
import { Info, X, Shirt } from 'lucide-react';

interface JerseyInfoTooltipProps {
  label?: string;
  className?: string;
}

export const JerseyInfoTooltip: React.FC<JerseyInfoTooltipProps> = ({
  label = 'Jersey Name Information',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={`inline-flex items-center ml-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-amber-400 hover:text-amber-300 focus:outline-none transition-colors p-0.5 rounded-full hover:bg-amber-950/40"
        title="View Jersey Name Information"
        aria-label="View Jersey Name Information"
      >
        <Info className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Shirt className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  {label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                The name you enter here will be used for your jersey.
              </p>
              <p className="font-semibold text-amber-300 bg-amber-950/60 p-3 rounded-xl border border-amber-500/30">
                Please enter the name exactly as you want it printed.
              </p>
              <p className="text-[11px] text-slate-400">
                This exact name is locked in your tournament registration snapshot. Subsequent edits to your general profile will not alter historical jersey names.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};
