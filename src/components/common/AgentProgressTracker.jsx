import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, AlertCircle, Cpu } from 'lucide-react';
import { PIPELINE_STEPS, subscribeAgentProgress } from '../../services/ai/agentProgressService';

export default function AgentProgressTracker({ isProcessing = false, activeMissionId = null }) {
  const [stepsState, setStepsState] = useState(() => {
    return PIPELINE_STEPS.map(s => ({ ...s, status: 'idle', detail: '' }));
  });

  useEffect(() => {
    if (isProcessing) {
      setStepsState(PIPELINE_STEPS.map((s, i) => ({
        ...s,
        status: i === 0 ? 'running' : 'idle',
        detail: ''
      })));
    }
  }, [isProcessing]);

  useEffect(() => {
    const unsubscribe = subscribeAgentProgress(({ stepId, status, detail }) => {
      setStepsState(prev => prev.map(s => {
        if (s.id === stepId) {
          return { ...s, status, detail };
        }
        return s;
      }));
    });
    return unsubscribe;
  }, []);

  if (!isProcessing && stepsState.every(s => s.status === 'idle')) return null;

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs space-y-3 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="font-bold text-sky-300">Care Superagent Pipeline Tracker</span>
        </div>
        {activeMissionId && (
          <span className="text-[10px] text-slate-400">Mission: {activeMissionId.slice(0, 12)}</span>
        )}
      </div>

      <div className="space-y-2">
        {stepsState.map((step) => {
          const isDone = step.status === 'success';
          const isRunning = step.status === 'running';
          const isFailed = step.status === 'failed';

          return (
            <div key={step.id} className="flex items-center justify-between p-2 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {isRunning && <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />}
                {isFailed && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                {!isDone && !isRunning && !isFailed && <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />}

                <span className={isDone ? 'text-emerald-300' : (isRunning ? 'text-sky-300 font-bold' : 'text-slate-400')}>
                  {step.label}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-sans">{step.model}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
