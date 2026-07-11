import React from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ActionConfirmModalsProps {
  // Send confirm
  confirmSendExamId: string | null;
  setConfirmSendExamId: (id: string | null) => void;
  sendingChallengeLoading: boolean;
  onSendChallenge: (examId: string) => void;
  friendName?: string;
  challengeError?: string;

  // Accept confirm
  confirmAcceptChallenge: { id: string; examId: string } | null;
  setConfirmAcceptChallenge: (val: { id: string; examId: string } | null) => void;
  challengeActionLoading: string | null;
  onAcceptChallenge: (id: string, examId: string) => void;

  // Decline confirm
  confirmDeclineChallengeId: string | null;
  setConfirmDeclineChallengeId: (id: string | null) => void;
  onDeclineChallenge: (id: string) => void;
}

export const ActionConfirmModals: React.FC<ActionConfirmModalsProps> = ({
  confirmSendExamId,
  setConfirmSendExamId,
  sendingChallengeLoading,
  onSendChallenge,
  friendName,
  challengeError,

  confirmAcceptChallenge,
  setConfirmAcceptChallenge,
  challengeActionLoading,
  onAcceptChallenge,

  confirmDeclineChallengeId,
  setConfirmDeclineChallengeId,
  onDeclineChallenge,
}) => {
  return (
    <>
      {/* Send Challenge Confirmation Modal */}
      {confirmSendExamId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 max-w-xs w-full shadow-2xl flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-blue-500 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Send Challenge?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed font-medium">
              Are you sure you want to send this exam challenge to {friendName || 'your friend'}?
            </p>

            {challengeError && (
              <div className="p-2 mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-405 text-[10px] font-medium flex gap-1.5 text-left w-full">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{challengeError}</span>
              </div>
            )}

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => setConfirmSendExamId(null)}
                disabled={sendingChallengeLoading}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => onSendChallenge(confirmSendExamId)}
                disabled={sendingChallengeLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {sendingChallengeLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Challenge Confirmation Modal */}
      {confirmAcceptChallenge && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 max-w-xs w-full shadow-2xl flex flex-col items-center text-center">
            <CheckCircle2 className="w-10 h-10 text-blue-500 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Accept Challenge?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed font-medium">
              Accepting will copy this exam to your <strong>challenges</strong> category so you can take it. Ready?
            </p>

            {challengeError && (
              <div className="p-2 mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-405 text-[10px] font-medium flex gap-1.5 text-left w-full">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{challengeError}</span>
              </div>
            )}

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => setConfirmAcceptChallenge(null)}
                disabled={challengeActionLoading !== null}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onAcceptChallenge(confirmAcceptChallenge.id, confirmAcceptChallenge.examId);
                }}
                disabled={challengeActionLoading !== null}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {challengeActionLoading === confirmAcceptChallenge.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Accept & Take'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Challenge Confirmation Modal */}
      {confirmDeclineChallengeId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 max-w-xs w-full shadow-2xl flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Decline Challenge?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed font-medium">
              Are you sure you want to decline this challenge? This action cannot be undone.
            </p>

            {challengeError && (
              <div className="p-2 mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-405 text-[10px] font-medium flex gap-1.5 text-left w-full">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{challengeError}</span>
              </div>
            )}

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => setConfirmDeclineChallengeId(null)}
                disabled={challengeActionLoading !== null}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeclineChallenge(confirmDeclineChallengeId);
                }}
                disabled={challengeActionLoading !== null}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {challengeActionLoading === confirmDeclineChallengeId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Decline'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
