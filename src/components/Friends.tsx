import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useUserProfile } from '../lib/UserContext';
import { ChevronLeft } from 'lucide-react';
import Footer from './Footer';
import { useQueryClient } from '@tanstack/react-query';
import localStorageCache from '../lib/localStorage';

// Sub-components
import { MissingCategoryModal } from './friends/MissingCategoryModal';
import { ExamSelectorModal } from './friends/ExamSelectorModal';
import { ActionConfirmModals } from './friends/ActionConfirmModals';
import { FriendsTab } from './friends/FriendsTab';
import { ChallengesTab } from './friends/ChallengesTab';
import { SearchTab } from './friends/SearchTab';
import ProfileCard from './profile/ProfileCard';

interface ProfileData {
  id: string;
  name: string;
  username: string;
  profile_picture?: string;
  is_premium?: boolean;
  premium_type?: string;
}

interface FriendRequest {
  id: string;
  created_at: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profile_picture?: string;
  };
}

export default function Friends() {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ProfileData | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'challenges' | 'search'>('friends');
  const [friendsList, setFriendsList] = useState<ProfileData[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [requestError, setRequestError] = useState('');
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Challenges Specific States
  const [challengesExamTypeId, setChallengesExamTypeId] = useState<string | null>(null);
  const [showMissingCategoryModal, setShowMissingCategoryModal] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [challengeView, setChallengeView] = useState<'received' | 'sent'>('received');

  const [receivedChallenges, setReceivedChallenges] = useState<any[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(false);
  const [hasMoreReceived, setHasMoreReceived] = useState(false);
  const [receivedOffset, setReceivedOffset] = useState(0);

  const [sentChallenges, setSentChallenges] = useState<any[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [hasMoreSent, setHasMoreSent] = useState(false);
  const [sentOffset, setSentOffset] = useState(0);

  const [showExamSelector, setShowExamSelector] = useState(false);
  const [selectedFriendForChallenge, setSelectedFriendForChallenge] = useState<ProfileData | null>(null);
  const [myExams, setMyExams] = useState<any[]>([]);
  const [loadingMyExams, setLoadingMyExams] = useState(false);
  const [examSearchQuery, setExamSearchQuery] = useState('');
  const [activeExamSearchQuery, setActiveExamSearchQuery] = useState('');
  const [examOffset, setExamOffset] = useState(0);
  const [hasMoreExams, setHasMoreExams] = useState(false);

  // Public Profile States
  const [selectedProfileForDetails, setSelectedProfileForDetails] = useState<any | null>(null);
  const [showPublicProfileModal, setShowPublicProfileModal] = useState(false);

  const [dailyChallengeCount, setDailyChallengeCount] = useState(0);
  const [challengeActionLoading, setChallengeActionLoading] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState('');

  // Confirmation states
  const [confirmSendExamId, setConfirmSendExamId] = useState<string | null>(null);
  const [sendingChallengeLoading, setSendingChallengeLoading] = useState(false);
  const [confirmAcceptChallenge, setConfirmAcceptChallenge] = useState<{ id: string; examId: string } | null>(null);
  const [confirmDeclineChallengeId, setConfirmDeclineChallengeId] = useState<string | null>(null);

  // 1. Verify if 'challenges' category exists with correct properties
  const checkChallengesCategory = async () => {
    if (!userProfile?.id) return;
    try {
      const { data, error } = await supabase
        .from('examtypes')
        .select('id, name, subjects, academicLevel')
        .eq('userId', userProfile.id)
        .eq('name', 'challenges')
        .maybeSingle();

      if (error) throw error;

      if (data && Array.isArray(data.subjects) && data.subjects.includes('any') && data.academicLevel === 'any') {
        setChallengesExamTypeId(data.id);
        setShowMissingCategoryModal(false);
      } else {
        setShowMissingCategoryModal(true);
      }
    } catch (err) {
      console.error('Error checking challenges category:', err);
    }
  };

  // 2. Create the special challenges category, ignoring plan constraints
  const handleCreateChallengesCategory = async () => {
    if (!userProfile?.id) return;
    setCreatingCategory(true);
    try {
      const { data, error } = await supabase
        .from('examtypes')
        .insert({
          userId: userProfile.id,
          name: 'challenges',
          subjects: ['any'],
          academicLevel: 'any'
        })
        .select('id')
        .single();

      if (error) throw error;
      setChallengesExamTypeId(data.id);
      setShowMissingCategoryModal(false);

      const cached = localStorageCache.get<any[]>(localStorageCache.keys.EXAM_CATEGORIES) || [];
      const newCategory = { id: data.id, name: 'challenges', subjects: ['any'], academicLevel: 'any' };
      localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, [...cached, newCategory]);

      queryClient.invalidateQueries({ queryKey: ['examCategories', userProfile.id] });
    } catch (err) {
      console.error('Error creating challenges category:', err);
    } finally {
      setCreatingCategory(false);
    }
  };

  const getFriendLimit = () => {
    const tier = userProfile?.PremiumType?.toLowerCase() || 'free';
    if (tier.includes('peak')) return 50;
    if (tier.includes('rise')) return 30;
    if (tier.includes('lite')) return 15;
    return 5;
  };

  const getMaxChallengesPerDay = () => {
    const tier = userProfile?.PremiumType?.toLowerCase() || 'free';
    if (tier.includes('peak')) return 20;
    if (tier.includes('rise')) return 15;
    if (tier.includes('lite')) return 10;
    return 3;
  };

  // Paginated Sent/Received Challenges Fetchers
  const fetchReceivedChallenges = async (offset = 0) => {
    if (!userProfile?.id) return;
    if (offset === 0) {
      setLoadingReceived(true);
      setReceivedOffset(0);
    }
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          updated_at,
          exam_id,
          receiver_exam_id,
          sender:profiles!challenges_sender_id_fkey (id, name, username, profile_picture),
          exams!challenges_exam_id_fkey (id, examName, totalQuestions, difficulty)
        `)
        .eq('receiver_id', userProfile.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + 9);

      if (error) throw error;

      const examIds = (data || []).map((row: any) => row.exam_id).filter(Boolean);
      const receiverExamIds = (data || []).map((row: any) => row.receiver_exam_id).filter(Boolean);
      const allExamIds = [...new Set([...examIds, ...receiverExamIds])];

      let resultsMap: { [key: string]: string } = {};
      if (allExamIds.length > 0) {
        const { data: resultsData } = await supabase
          .from('results')
          .select('id, examId')
          .in('examId', allExamIds);
        
        if (resultsData) {
          resultsData.forEach((r: any) => {
            resultsMap[r.examId] = r.id;
          });
        }
      }

      const list = (data || []).map((row: any) => ({
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        exam_id: row.exam_id,
        receiver_exam_id: row.receiver_exam_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        examName: row.exams?.examName || 'Deleted Exam',
        totalQuestions: row.exams?.totalQuestions || 0,
        difficulty: row.exams?.difficulty || 'medium',
        friendName: row.sender?.name || 'Someone',
        friendUsername: row.sender?.username || 'user',
        friendProfilePic: row.sender?.profile_picture,
        senderResultId: resultsMap[row.exam_id] || null,
        receiverResultId: resultsMap[row.receiver_exam_id] || null,
      }));

      if (offset === 0) {
        setReceivedChallenges(list);
      } else {
        setReceivedChallenges(prev => [...prev, ...list]);
      }
      setHasMoreReceived(list.length === 10);
    } catch (err) {
      console.error('Error fetching received challenges:', err);
    } finally {
      setLoadingReceived(false);
    }
  };

  const fetchSentChallenges = async (offset = 0) => {
    if (!userProfile?.id) return;
    if (offset === 0) {
      setLoadingSent(true);
      setSentOffset(0);
    }
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          updated_at,
          exam_id,
          receiver_exam_id,
          receiver:profiles!challenges_receiver_id_fkey (id, name, username, profile_picture),
          exams!challenges_exam_id_fkey (id, examName, totalQuestions, difficulty)
        `)
        .eq('sender_id', userProfile.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + 9);

      if (error) throw error;

      const examIds = (data || []).map((row: any) => row.exam_id).filter(Boolean);
      const receiverExamIds = (data || []).map((row: any) => row.receiver_exam_id).filter(Boolean);
      const allExamIds = [...new Set([...examIds, ...receiverExamIds])];

      let resultsMap: { [key: string]: string } = {};
      if (allExamIds.length > 0) {
        const { data: resultsData } = await supabase
          .from('results')
          .select('id, examId')
          .in('examId', allExamIds);
        
        if (resultsData) {
          resultsData.forEach((r: any) => {
            resultsMap[r.examId] = r.id;
          });
        }
      }

      const list = (data || []).map((row: any) => ({
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        exam_id: row.exam_id,
        receiver_exam_id: row.receiver_exam_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        examName: row.exams?.examName || 'Deleted Exam',
        totalQuestions: row.exams?.totalQuestions || 0,
        difficulty: row.exams?.difficulty || 'medium',
        friendName: row.receiver?.name || 'Someone',
        friendUsername: row.receiver?.username || 'user',
        friendProfilePic: row.receiver?.profile_picture,
        senderResultId: resultsMap[row.exam_id] || null,
        receiverResultId: resultsMap[row.receiver_exam_id] || null,
      }));

      if (offset === 0) {
        setSentChallenges(list);
      } else {
        setSentChallenges(prev => [...prev, ...list]);
      }
      setHasMoreSent(list.length === 10);
    } catch (err) {
      console.error('Error fetching sent challenges:', err);
    } finally {
      setLoadingSent(false);
    }
  };

  const loadMoreReceived = async () => {
    if (loadingReceived || !hasMoreReceived) return;
    const newOffset = receivedOffset + 10;
    setReceivedOffset(newOffset);
    await fetchReceivedChallenges(newOffset);
  };

  const loadMoreSent = async () => {
    if (loadingSent || !hasMoreSent) return;
    const newOffset = sentOffset + 10;
    setSentOffset(newOffset);
    await fetchSentChallenges(newOffset);
  };

  const fetchDailyChallengeCount = async () => {
    if (!userProfile?.id) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('challenges')
        .select('id', { count: 'exact' })
        .eq('sender_id', userProfile.id)
        .gte('created_at', today.toISOString());

      if (error) throw error;
      setDailyChallengeCount(count || 0);
    } catch (err) {
      console.error('Error fetching daily challenge count:', err);
    }
  };

  // Helper to fetch current user's exams for the selector modal with search/pagination
  const fetchExamsForChallenge = async (offset = 0, query = '', append = false) => {
    if (!userProfile?.id) return;
    setLoadingMyExams(true);
    try {
      let req = supabase
        .from('exams')
        .select('id, examName, totalQuestions, difficulty')
        .eq('createdBy', userProfile.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + 9);

      if (query.trim() !== '') {
        req = req.ilike('examName', `%${query.trim()}%`);
      }

      const { data, error } = await req;
      if (error) throw error;

      if (append) {
        setMyExams((prev) => [...prev, ...(data || [])]);
      } else {
        setMyExams(data || []);
      }
      setExamOffset(offset);
      setHasMoreExams((data || []).length === 10);
    } catch (err) {
      console.error('Error fetching my exams:', err);
    } finally {
      setLoadingMyExams(false);
    }
  };

  const handleSearchExams = () => {
    setActiveExamSearchQuery(examSearchQuery);
    fetchExamsForChallenge(0, examSearchQuery);
  };

  const handleLoadMoreExams = () => {
    fetchExamsForChallenge(examOffset + 10, activeExamSearchQuery, true);
  };

  const handleOpenChallengeSelector = async (friend: ProfileData) => {
    setSelectedFriendForChallenge(friend);
    setShowExamSelector(true);
    setExamSearchQuery('');
    setActiveExamSearchQuery('');
    setExamOffset(0);
    setHasMoreExams(false);
    setMyExams([]);
    setChallengeError('');
    await fetchExamsForChallenge(0, '');
  };

  // Check if a pending challenge exists between sender and receiver
  const checkPendingChallenge = async (friendId: string) => {
    if (!userProfile?.id) return false;
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('id')
        .eq('sender_id', userProfile.id)
        .eq('receiver_id', friendId)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (err) {
      console.error('Error checking pending challenge:', err);
      return false;
    }
  };

  const handleSendChallenge = async (examId: string) => {
    if (!userProfile?.id || !selectedFriendForChallenge) return;
    setChallengeError('');
    setSendingChallengeLoading(true);

    try {
      // 1. Safety check: pending challenge check
      const isPending = await checkPendingChallenge(selectedFriendForChallenge.id);
      if (isPending) {
        setChallengeError('They have not responded to your last challenge yet.');
        return;
      }

      // 2. Limit check: daily send count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count, error: countError } = await supabase
        .from('challenges')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', userProfile.id)
        .gte('created_at', today.toISOString());

      if (countError) throw countError;
      const sentToday = count || 0;
      const maxAllowed = getMaxChallengesPerDay();
      if (sentToday >= maxAllowed) {
        setChallengeError(`Daily challenge limit reached. You can only send ${maxAllowed} challenges per day.`);
        return;
      }

      // 3. Insert challenge
      const { error } = await supabase
        .from('challenges')
        .insert({
          sender_id: userProfile.id,
          receiver_id: selectedFriendForChallenge.id,
          exam_id: examId,
          status: 'pending',
        });

      if (error) throw error;

      setShowExamSelector(false);
      setSelectedFriendForChallenge(null);
      setConfirmSendExamId(null);
      await fetchDailyChallengeCount();
      if (activeTab === 'challenges') {
        await fetchSentChallenges(0);
      }
    } catch (err: any) {
      console.error('Error sending challenge:', err);
      setChallengeError(err?.message || 'Failed to send challenge');
    } finally {
      setSendingChallengeLoading(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: string, examId: string) => {
    setChallengeActionLoading(challengeId);
    setChallengeError('');
    try {
      let categoryId = challengesExamTypeId;
      if (!categoryId) {
        const { data } = await supabase
          .from('examtypes')
          .select('id')
          .eq('userId', userProfile?.id!)
          .eq('name', 'challenges')
          .single();
        if (data) {
          categoryId = data.id;
          setChallengesExamTypeId(data.id);
        }
      }

      if (!categoryId) {
        throw new Error('Please create the "challenges" category first.');
      }

      // Copy the exam questions and layout to the active user as a challenge exam type
      const { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('examName, totalQuestions, difficulty, totalTime, subjects, generatedExam, correct_marks, negative_marks, ExamPlan')
        .eq('id', examId)
        .single();

      if (examErr || !examData) throw examErr || new Error('Exam details not found');

      // Insert new exam for receiver
      const { data: newExam, error: insErr } = await supabase
        .from('exams')
        .insert({
          createdBy: userProfile?.id!,
          accessIds: [userProfile?.id!],
          categoryId: categoryId,
          examName: `Challenge: ${examData.examName}`,
          totalQuestions: examData.totalQuestions,
          difficulty: examData.difficulty,
          totalTime: examData.totalTime || 60,
          subjects: examData.subjects || '[]',
          generatedExam: examData.generatedExam || '[]',
          correct_marks: examData.correct_marks ?? 4,
          negative_marks: examData.negative_marks ?? 0,
          totalMarks: examData.totalQuestions * (examData.correct_marks ?? 4),
          ExamPlan: examData.ExamPlan || '{}',
          status: 'Pending',
          examType: 'practice',
          accessType: 'anytime',
          startDateTime: null,
          endDateTime: null,
        })
        .select('id')
        .single();

      if (insErr || !newExam) throw insErr || new Error('Failed to copy exam');

      // Set challenge status to 'active' and store copied exam ID
      const { error } = await supabase
        .from('challenges')
        .update({
          status: 'active',
          receiver_exam_id: newExam.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', challengeId);
      if (error) throw error;

      setConfirmAcceptChallenge(null);
      await fetchReceivedChallenges(0);
      navigate(`/exam-details/${categoryId}`);
    } catch (err: any) {
      console.error('Error accepting challenge:', err);
      setChallengeError(err.message || 'Failed to accept challenge');
    } finally {
      setChallengeActionLoading(null);
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    setChallengeActionLoading(challengeId);
    setChallengeError('');
    try {
      const { error } = await supabase
        .from('challenges')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', challengeId);

      if (error) throw error;
      setConfirmDeclineChallengeId(null);
      await fetchReceivedChallenges(0);
    } catch (err: any) {
      console.error('Error declining challenge:', err);
      setChallengeError(err.message || 'Failed to decline challenge');
    } finally {
      setChallengeActionLoading(null);
    }
  };

  const fetchFriends = async () => {
    if (!userProfile?.id) return;
    setLoadingFriends(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          sender_id,
          receiver_id,
          status,
          sender:profiles!sender_id (id, name, username, profile_picture),
          receiver:profiles!receiver_id (id, name, username, profile_picture)
        `)
        .or(`sender_id.eq.${userProfile.id},receiver_id.eq.${userProfile.id}`)
        .eq('status', 'accepted')
        .order('updated_at', { ascending: false })
        .limit(getFriendLimit());

      if (error) throw error;

      const list = (data || []).map((row: any) => {
        if (row.sender_id === userProfile.id) {
          return row.receiver;
        } else {
          return row.sender;
        }
      });
      setFriendsList(list);
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchRequests = async () => {
    if (!userProfile?.id) return;
    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          created_at,
          sender:profiles!sender_id (id, name, username, profile_picture)
        `)
        .eq('receiver_id', userProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncomingRequests((data || []) as any[]);
    } catch (err) {
      console.error('Error fetching incoming requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
      await fetchRequests();
      await fetchFriends();
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error('Error declining request:', err);
    }
  };

  useEffect(() => {
    if (userProfile?.id) {
      fetchRequests();
      fetchFriends();
      fetchDailyChallengeCount();
      checkChallengesCategory();
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.id && activeTab === 'challenges') {
      if (challengeView === 'received') {
        fetchReceivedChallenges(0);
      } else {
        fetchSentChallenges(0);
      }
    }
  }, [userProfile?.id, activeTab, challengeView]);

  const handleSendRequest = async (targetId: string) => {
    if (!userProfile?.id) return;
    setSendingRequest(true);
    setRequestError('');

    try {
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('status')
        .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userProfile.id})`)
        .maybeSingle();

      if (existingFriend && existingFriend.status === 'accepted') {
        setRequestError('You two are already friends.');
        return;
      }

      await supabase
        .from('friends')
        .delete()
        .or(`and(sender_id.eq.${userProfile.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userProfile.id})`);

      const { error } = await supabase
        .from('friends')
        .insert({
          sender_id: userProfile.id,
          receiver_id: targetId,
          status: 'pending'
        });

      if (error) throw error;
      setSentRequests(prev => [...prev, targetId]);
    } catch (err: any) {
      console.error('Error sending request:', err);
      setRequestError(err?.message || 'Failed to send request');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResult(null);
    setHasSearched(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, username, profile_picture, is_premium, premium_type')
        .eq('username', searchQuery.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSearchResult(data as ProfileData);
      } else {
        setSearchResult(null);
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleOpenDetails = (profile: ProfileData) => {
    setSelectedProfileForDetails(profile);
    setShowPublicProfileModal(true);
  };

  const renderProfilePic = (user: ProfileData, size = 'w-12 h-12') => {
    if (user.profile_picture && user.profile_picture.trim() !== '') {
      return (
        <img
          src={user.profile_picture}
          alt={user.name}
          className={`${size} rounded-full object-cover border border-zinc-200 dark:border-zinc-800`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }

    const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';
    return (
      <div className={`${size} rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-semibold`}>
        {firstLetter}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans antialiased select-none pb-24">
      <header className="sticky top-0 z-[100] backdrop-blur-md bg-white/70 dark:bg-black/70 border-b border-zinc-150 dark:border-zinc-900/60 px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-800 dark:text-white">Friends</h2>
        <div className="w-8" />
      </header>

      <main className="flex-grow max-w-md w-full mx-auto p-4 sm:p-5 space-y-6">
        <div className="flex bg-zinc-150 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`flex-1 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer ${
              activeTab === 'challenges'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Challenges
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Search & Req
          </button>
        </div>

        {activeTab === 'friends' && (
          <FriendsTab
            loadingFriends={loadingFriends}
            friendsList={friendsList}
            onOpenChallenge={handleOpenChallengeSelector}
            onOpenDetails={handleOpenDetails}
            incomingRequests={incomingRequests}
            loadingRequests={loadingRequests}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            renderProfilePic={renderProfilePic}
          />
        )}

        {activeTab === 'challenges' && (
          <ChallengesTab
            challengeView={challengeView}
            setChallengeView={setChallengeView}
            maxChallengesPerDay={getMaxChallengesPerDay()}
            dailyChallengeCount={dailyChallengeCount}
            loadingReceived={loadingReceived}
            receivedChallenges={receivedChallenges}
            hasMoreReceived={hasMoreReceived}
            onLoadMoreReceived={loadMoreReceived}
            loadingSent={loadingSent}
            sentChallenges={sentChallenges}
            hasMoreSent={hasMoreSent}
            onLoadMoreSent={loadMoreSent}
            challengeActionLoading={challengeActionLoading}
            challengesExamTypeId={challengesExamTypeId}
            onAcceptTrigger={(challenge) => {
              setConfirmAcceptChallenge({ id: challenge.id, examId: challenge.exam_id });
            }}
            onDeclineTrigger={(challengeId) => {
              setConfirmDeclineChallengeId(challengeId);
            }}
            renderProfilePic={renderProfilePic}
          />
        )}

        {activeTab === 'search' && (
          <SearchTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
            searchLoading={searchLoading}
            hasSearched={hasSearched}
            searchResult={searchResult}
            sentRequests={sentRequests}
            sendingRequest={sendingRequest}
            onRequestFriend={handleSendRequest}
            onOpenDetails={handleOpenDetails}
            requestError={requestError}
            renderProfilePic={renderProfilePic}
          />
        )}
      </main>

      {/* Modals */}
      <MissingCategoryModal
        isOpen={showMissingCategoryModal}
        creating={creatingCategory}
        onCreate={handleCreateChallengesCategory}
      />

      <ExamSelectorModal
        isOpen={showExamSelector}
        onClose={() => {
          setShowExamSelector(false);
          setSelectedFriendForChallenge(null);
          setChallengeError('');
        }}
        friendName={selectedFriendForChallenge?.name || ''}
        examSearchQuery={examSearchQuery}
        setExamSearchQuery={setExamSearchQuery}
        onSearch={handleSearchExams}
        myExams={myExams}
        loadingMyExams={loadingMyExams}
        hasMoreExams={hasMoreExams}
        onLoadMore={handleLoadMoreExams}
        onSelectExam={(examId) => {
          setChallengeError('');
          setConfirmSendExamId(examId);
        }}
      />

      <ActionConfirmModals
        confirmSendExamId={confirmSendExamId}
        setConfirmSendExamId={setConfirmSendExamId}
        sendingChallengeLoading={sendingChallengeLoading}
        onSendChallenge={handleSendChallenge}
        friendName={selectedFriendForChallenge?.name}
        challengeError={challengeError}
        confirmAcceptChallenge={confirmAcceptChallenge}
        setConfirmAcceptChallenge={setConfirmAcceptChallenge}
        challengeActionLoading={challengeActionLoading}
        onAcceptChallenge={handleAcceptChallenge}
        confirmDeclineChallengeId={confirmDeclineChallengeId}
        setConfirmDeclineChallengeId={setConfirmDeclineChallengeId}
        onDeclineChallenge={handleDeclineChallenge}
      />

      {showPublicProfileModal && selectedProfileForDetails && (
        <ProfileCard
          onClose={() => {
            setShowPublicProfileModal(false);
            setSelectedProfileForDetails(null);
          }}
          userId={selectedProfileForDetails.id}
        />
      )}

      <Footer />
    </div>
  );
}
