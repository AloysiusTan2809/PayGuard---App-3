import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface StartNewDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: () => void;
  currentRecordCount: number;
  currentFilename: string;
}

export const StartNewDatasetModal: React.FC<StartNewDatasetModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
  currentRecordCount,
  currentFilename
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2>(1);
  const [typedInput, setTypedInput] = useState('');
  const [inputError, setInputError] = useState('');

  const handleNextStep = () => {
    setStep(2);
  };

  const handleFinalConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedInput.trim() !== 'START NEW DATASET') {
      setInputError('You must type exact text: START NEW DATASET');
      return;
    }
    setInputError('');
    onConfirmClear();
    setStep(1);
    setTypedInput('');
    onClose();
  };

  const handleModalClose = () => {
    setStep(1);
    setTypedInput('');
    setInputError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-600 rounded-xl text-white">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950">
                {step === 1 ? 'Start New Dataset?' : 'Final Confirmation Required'}
              </h3>
              <p className="text-xs text-rose-700">
                Current dataset: <strong className="text-rose-950">{currentFilename || 'App 3 Handoff'}</strong> ({currentRecordCount} records)
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="bg-rose-50/80 border border-rose-200 p-4 rounded-xl text-xs text-rose-900 leading-relaxed space-y-2">
                <p className="font-bold text-sm text-rose-950">
                  “Start a new dataset? Current invoice records will be removed from the active workspace.”
                </p>
                <p>
                  This action will clear all <strong className="font-bold">{currentRecordCount} active invoice records</strong> from the workspace and reset dashboard counts.
                </p>
                <p className="text-slate-600 pt-1">
                  Note: Audit trail logs will be safely retained.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center"
                >
                  <span>Proceed to Final Confirmation</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleFinalConfirm} className="space-y-4">
              <div className="bg-rose-100 border border-rose-300 p-4 rounded-xl text-xs text-rose-950 space-y-2">
                <p className="font-bold text-sm text-rose-950">
                  “Final confirmation: Active invoice records and current working changes will be cleared. Audit records will be retained.”
                </p>
                <p className="text-rose-800">
                  To prevent accidental loss of active work, please type <strong className="font-mono bg-rose-200 px-1.5 py-0.5 rounded text-rose-950">START NEW DATASET</strong> below to confirm.
                </p>
              </div>

              {inputError && (
                <div className="bg-rose-50 border border-rose-300 p-2.5 rounded-lg text-xs text-rose-700 font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{inputError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Type <span className="font-mono text-rose-700">START NEW DATASET</span> to enable confirmation:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={typedInput}
                  onChange={(e) => {
                    setTypedInput(e.target.value);
                    if (inputError) setInputError('');
                  }}
                  placeholder="START NEW DATASET"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
                >
                  ← Back to First Step
                </button>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={typedInput.trim() !== 'START NEW DATASET'}
                    className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all flex items-center space-x-1.5 ${
                      typedInput.trim() !== 'START NEW DATASET'
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-rose-600/30'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span>Confirm & Clear Dataset</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
