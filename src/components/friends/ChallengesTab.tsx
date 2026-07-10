import React from 'react';
import { Loader2 } from 'lucide-react';

interface ChallengesTabProps {
  challengeView: 'received' | 'sent';
  setChallengeView: (view: 'received' | 'sent') => void;
  maxChallengesPerDay: number;
  dailyChallengeCount: number;
  loadingReceived: boolean;
  receivedChallenges: any[];
  hasMoreReceived: boolean;
  onLoadMoreReceived: () => void;
  loadingSent: boolean;
  sentChallenges: any[];
  hasMoreSent: boolean;
  onLoadMoreSent: () => void;
  challengeActionLoading: string | null;
  onAcceptTrigger: (challenge: any) => void;
  onDeclineTrigger: (challengeId: string) => void;
  renderProfilePic: (profile: any, className: string) => React.ReactNode;
}

export const ChallengesTab: React.FC<ChallengesTabProps> = ({
  challengeView,
  setChallengeView,
  maxChallengesPerDay,
  dailyChallengeCount,
  loadingReceived,
  receivedChallenges,
  hasMoreReceived,
  onLoadMoreReceived,
  loadingSent,
  sentChallenges,
  hasMoreSent,
  onLoadMoreSent,
  onAcceptTrigger,
  onDeclineTrigger,
  renderProfilePic,
}) => {
  return (
    <div className="space-y-4">
      {/* Sub-tabs for Received and Sent */}
      <div className="flex border-b border-zinc-250 dark:border-zinc-800">
        <button
          onClick={() => setChallengeView('received')}
          className={`flex-1 pb-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            challengeView === 'received'
              ? 'border-blue-500 text-blue-500 font-bold'
              : 'border-transparent text-zinc-400 dark:text-zinc-550 hover:text-zinc-600 dark:hover:text-zinc-400'
          }`}
        >
          Received
        </button>
        <button
          onClick={() => setChallengeView('sent')}
          className={`flex-1 pb-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            challengeView === 'sent'
              ? 'border-blue-500 text-blue-500 font-bold'
              : 'border-transparent text-zinc-400 dark:text-zinc-550 hover:text-zinc-600 dark:hover:text-zinc-400'
          }`}
        >
          Sent
        </button>
      </div>

      {/* Daily Send Limit Indicator */}
      <div className="flex justify-between items-center text-[10px] text-zinc-500 dark:text-zinc-400 px-1 font-medium">
        <span>Daily Limit: {maxChallengesPerDay} challenges</span>
        <span>{Math.max(0, maxChallengesPerDay - dailyChallengeCount)} remaining today</span>
      </div>

      {challengeView === 'received' && (
        <div className="space-y-3">
          {loadingReceived && receivedChallenges.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : receivedChallenges.length > 0 ? (
            <div className="grid gap-3">
              {receivedChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="p-3.5 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 w-full">
                      {renderProfilePic({
                        id: challenge.sender_id,
                        name: challenge.friendName,
                        username: challenge.friendUsername,
                        profile_picture: challenge.friendProfilePic
                      }, 'w-8 h-8')}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-zinc-850 dark:text-white truncate">{challenge.friendName}</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">@{challenge.friendUsername}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                        challenge.status === 'pending' ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' :
                        challenge.status === 'active' ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20' :
                        challenge.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' :
                        'bg-zinc-500/10 text-zinc-400 dark:text-zinc-550'
                      }`}>
                        {challenge.status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-800/50 flex flex-col gap-1">
                    <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{challenge.examName}</div>
                    <div className="flex gap-2 text-[9px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <span>{challenge.totalQuestions} questions</span>
                      <span>•</span>
                      <span className="uppercase">{challenge.difficulty}</span>
                    </div>
                  </div>

                  {challenge.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => onAcceptTrigger(challenge)}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl text-[10px] font-semibold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm hover:shadow"
                      >
                        Accept & Take
                      </button>
                      <button
                        onClick={() => onDeclineTrigger(challenge.id)}
                        className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-[10px] font-semibold transition-all cursor-pointer text-center"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                No received challenges.
              </p>
            </div>
          )}

          {hasMoreReceived && (
            <button
              onClick={onLoadMoreReceived}
              disabled={loadingReceived}
              className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-650 dark:text-zinc-400 transition-all cursor-pointer flex justify-center items-center gap-1.5"
            >
              {loadingReceived ? (
                <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
              ) : (
                'Load More'
              )}
            </button>
          )}
        </div>
      )}

      {challengeView === 'sent' && (
        <div className="space-y-3">
          {loadingSent && sentChallenges.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : sentChallenges.length > 0 ? (
            <div className="grid gap-3">
              {sentChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="p-3.5 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 w-full">
                      {renderProfilePic({
                        id: challenge.receiver_id,
                        name: challenge.friendName,
                        username: challenge.friendUsername,
                        profile_picture: challenge.friendProfilePic
                      }, 'w-8 h-8')}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-zinc-805 dark:text-white truncate">{challenge.friendName}</h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">@{challenge.friendUsername}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                        challenge.status === 'pending' ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' :
                        challenge.status === 'active' ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20' :
                        challenge.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' :
                        'bg-zinc-500/10 text-zinc-400 dark:text-zinc-550'
                      }`}>
                        {challenge.status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-800/50 flex flex-col gap-1">
                    <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{challenge.examName}</div>
                    <div className="flex gap-2 text-[9px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <span>{challenge.totalQuestions} questions</span>
                      <span>•</span>
                      <span className="uppercase">{challenge.difficulty}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                No sent challenges.
              </p>
            </div>
          )}

          {hasMoreSent && (
            <button
              onClick={onLoadMoreSent}
              disabled={loadingSent}
              className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-650 dark:text-zinc-400 transition-all cursor-pointer flex justify-center items-center gap-1.5"
            >
              {loadingSent ? (
                <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
              ) : (
                'Load More'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
