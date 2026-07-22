import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fontSize } from '../../lib/utils';

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
  challengesExamTypeId: string | null;
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
  challengesExamTypeId,
  onAcceptTrigger,
  onDeclineTrigger,
  renderProfilePic,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div
        className="flex justify-between items-center text-zinc-500 dark:text-zinc-400 px-1 font-medium text-xs">
        <span>
          {challengeView === 'received'
            ? 'Challenged to you'
            : 'You sent challenge'}
        </span>
        <span>
          challenges left: {Math.max(0, maxChallengesPerDay - dailyChallengeCount)}/{maxChallengesPerDay}
        </span>
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
                  className="p-3.5 bg-white dark:bg-zinc-900/60 border border-black/8 dark:border-white/10 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 space-y-3"
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
                        <h4 className="text-xs font-semibold text-zinc-800 dark:text-white truncate">{challenge.friendName}</h4>
                        <p className="text-xs text-zinc-550 dark:text-zinc-400">@{challenge.friendUsername}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold  ${challenge.status === 'pending' ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' :
                          challenge.status === 'active' ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20' :
                            challenge.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' :
                              'bg-zinc-500/10 text-zinc-400 dark:text-zinc-550'
                          } text-xs`}>
                        {challenge.status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-xl border border-black/5 dark:border-white/8 flex flex-col gap-1">
                    <div
                      className="font-semibold text-zinc-800 dark:text-zinc-200 truncate text-xs">{challenge.examName}</div>
                    <div
                      className="flex gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs">
                      <span>{challenge.totalQuestions} questions</span>
                      <span>•</span>
                      <span className="">{challenge.difficulty}</span>
                    </div>
                  </div>

                  {challenge.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => onAcceptTrigger(challenge)}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm hover:shadow"
                      >
                        Accept & Take
                      </button>
                      <button
                        onClick={() => onDeclineTrigger(challenge.id)}
                        className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {(challenge.status === 'active' || challenge.status === 'completed') && (
                    <div className="flex flex-col gap-2 mt-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 animate-fade-in">
                      <div className="flex items-center gap-2">
                        {!challenge.receiverResultId ? (
                          <button
                            disabled
                            className="flex-1 py-2 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-400 dark:text-zinc-650 rounded-xl text-xs font-medium text-center border border-zinc-200/20 cursor-not-allowed"
                          >
                            Give Exam First
                          </button>
                        ) : challenge.senderResultId ? (
                          <button
                            onClick={() => navigate(`/results/${challenge.sender_id}/${challenge.exam_id}`)}
                            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border border-blue-200/30"
                          >
                            See Sender's Performance
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-2 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-400 dark:text-zinc-650 rounded-xl text-xs font-medium text-center border border-zinc-200/20 cursor-not-allowed"
                          >
                            Sender didn't give this exam yet
                          </button>
                        )}

                        {challenge.receiverResultId ? (
                          <button
                            onClick={() => navigate(`/results/${challenge.receiver_id}/${challenge.receiver_exam_id}`)}
                            className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border border-emerald-200/30"
                          >
                            See My Performance
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/exam-details/${challengesExamTypeId}`)}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
                          >
                            Take Challenge Exam
                          </button>
                        )}
                      </div>
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
              className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-605 dark:text-zinc-400 transition-all cursor-pointer flex justify-center items-center gap-1.5"
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
                  className="p-3.5 bg-white dark:bg-zinc-900/60 border border-black/8 dark:border-white/10 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 space-y-3"
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
                        <h4 className="text-xs font-semibold text-zinc-800 dark:text-white truncate">{challenge.friendName}</h4>
                        <p className="text-xs text-zinc-550 dark:text-zinc-400 truncate">@{challenge.friendUsername}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold  ${challenge.status === 'pending' ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' :
                          challenge.status === 'active' ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20' :
                            challenge.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' :
                              'bg-zinc-500/10 text-zinc-400 dark:text-zinc-550'
                          } text-xs`}>
                        {challenge.status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900/40 p-2.5 rounded-xl border border-black/5 dark:border-white/8 flex flex-col gap-1">
                    <div
                      className="font-semibold text-zinc-800 dark:text-zinc-200 truncate text-xs">{challenge.examName}</div>
                    <div
                      className="flex gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs">
                      <span>{challenge.totalQuestions} questions</span>
                      <span>•</span>
                      <span className="">{challenge.difficulty}</span>
                    </div>
                  </div>

                  {(challenge.status === 'active' || challenge.status === 'completed') && (
                    <div className="flex flex-col gap-2 mt-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 animate-fade-in">
                      <div className="flex items-center gap-2">
                        {challenge.senderResultId ? (
                          <button
                            onClick={() => navigate(`/results/${challenge.sender_id}/${challenge.exam_id}`)}
                            className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border border-blue-200/30"
                          >
                            My Performance
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-2 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-400 dark:text-zinc-650 rounded-xl text-xs font-medium text-center border border-zinc-200/20 cursor-not-allowed"
                          >
                            No Result Found
                          </button>
                        )}

                        {challenge.receiverResultId ? (
                          <button
                            onClick={() => navigate(`/results/${challenge.receiver_id}/${challenge.receiver_exam_id}`)}
                            className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border border-emerald-200/30"
                          >
                            Friend's Performance
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-2 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-400 dark:text-zinc-655 rounded-xl text-xs font-medium text-center border border-zinc-200/20 cursor-not-allowed"
                          >
                            Friend Has Not Taken Yet
                          </button>
                        )}
                      </div>
                    </div>
                  )}
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
              className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-605 dark:text-zinc-400 transition-all cursor-pointer flex justify-center items-center gap-1.5"
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
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-1 py-1 rounded-full border border-black/10 dark:border-white/10 shadow-lg flex gap-1 w-60 max-w-full">
        <button
          onClick={() => setChallengeView('received')}
          className={`flex-1 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer text-center ${challengeView === 'received'
            ? 'bg-[#007AFF] text-white shadow-sm'
            : 'text-zinc-500 dark:text-zinc-450 hover:text-zinc-800 dark:hover:text-white'
            } text-xs`}>
          Received
        </button>
        <button
          onClick={() => setChallengeView('sent')}
          className={`flex-1 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer text-center ${challengeView === 'sent'
            ? 'bg-[#007AFF] text-white shadow-sm'
            : 'text-zinc-500 dark:text-zinc-450 hover:text-zinc-800 dark:hover:text-white'
            } text-xs`}>
          Sent
        </button>
      </div>
    </div>
  );
};
