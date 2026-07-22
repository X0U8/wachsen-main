import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

function isValidUuid(val) {
  if (!val) return false;
  const str = String(val).trim();
  if (str === 'null' || str === 'undefined' || str === 'all' || str === '') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default async function handler(req, res) {
  const method = req.method;
  const params = method === 'POST' ? req.body : req.query;

  const { 
    userId, 
    authToken, 
    type, 
    query: searchQuery, 
    categoryId, 
    statusFilter, 
    selectedExamTypeId, 
    sortOrder = 'desc', 
    limit = 10, 
    offset = 0 
  } = params;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }
  if (!type) {
    return res.status(400).json({ error: 'Missing search type parameter' });
  }

  try {
    const options = {};
    if (authToken) {
      options.global = {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      };
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, options);

    if (type === 'exams') {
      let query = supabase
        .from('exams')
        .select('id, examName, startDateTime, endDateTime, status, difficulty, examType, totalQuestions, totalMarks, subjects, created_at')
        .contains('accessIds', [userId]);

      if (isValidUuid(categoryId)) {
        query = query.eq('categoryId', categoryId);
      }
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (searchQuery && searchQuery.trim() !== '') {
        query = query.ilike('examName', `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: sortOrder === 'asc' })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw error;
      return res.status(200).json({ success: true, exams: data || [] });

    } else if (type === 'results') {
      let query = supabase
        .from('results')
        .select('id, created_at, startTime, endTime, marksObtained, totalMarks, examName, examId, userId')
        .eq('userId', userId);

      if (isValidUuid(selectedExamTypeId)) {
        const { data: exams, error: examsError } = await supabase
          .from('exams')
          .select('id')
          .eq('categoryId', selectedExamTypeId);

        if (examsError) throw examsError;
        const examIds = exams?.map(e => e.id) || [];
        if (examIds.length === 0) {
          return res.status(200).json({ success: true, results: [] });
        }
        query = query.in('examId', examIds);
      }

      if (searchQuery && searchQuery.trim() !== '') {
        query = query.ilike('examName', `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw error;
      return res.status(200).json({ success: true, results: data || [] });

    } else if (type === 'revision') {
      let examIdsFilter = null;

      if (isValidUuid(selectedExamTypeId)) {
        const { data: catExams, error: catError } = await supabase
          .from('exams')
          .select('id')
          .eq('categoryId', selectedExamTypeId);
        if (catError) throw catError;
        examIdsFilter = catExams?.map(e => e.id) || [];
      }

      if (searchQuery && searchQuery.trim() !== '') {
        const { data: searchExams, error: searchError } = await supabase
          .from('exams')
          .select('id')
          .ilike('examName', `%${searchQuery.trim()}%`);
        if (searchError) throw searchError;
        const searchExamIds = searchExams?.map(e => e.id) || [];

        if (examIdsFilter) {
          examIdsFilter = examIdsFilter.filter(id => searchExamIds.includes(id));
        } else {
          examIdsFilter = searchExamIds;
        }

        if (examIdsFilter.length === 0) {
          return res.status(200).json({ success: true, revisionList: [] });
        }
      }

      let query = supabase
        .from('revision')
        .select('id, examID, created_at, question_count')
        .eq('userID', userId);

      if (examIdsFilter) {
        query = query.in('examID', examIdsFilter);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        const examIds = data.map(r => r.examID).filter(id => !!id);
        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select('id, examName, categoryId')
          .in('id', examIds);

        if (examsError) throw examsError;

        const examMap = new Map(examsData?.map(e => [e.id, { examName: e.examName, categoryId: e.categoryId }]) || []);
        const mapped = data.map(r => {
          const eInfo = r.examID ? examMap.get(r.examID) : null;
          return {
            ...r,
            exams: eInfo ? { examName: eInfo.examName, categoryId: eInfo.categoryId } : null
          };
        });
        return res.status(200).json({ success: true, revisionList: mapped });
      } else {
        return res.status(200).json({ success: true, revisionList: [] });
      }
    } else if (type === 'laq') {
      let query = supabase
        .from('laq_exam')
        .select('id, name, subject_name, topics, difficulty, question_count, status, created_at, is_viva')
        .eq('user_id', userId);

      if (isValidUuid(categoryId)) {
        query = query.eq('category_id', categoryId);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (searchQuery && searchQuery.trim() !== '') {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,topics.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: sortOrder === 'asc' })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw error;
      return res.status(200).json({ success: true, laqExams: data || [] });

    } else if (type === 'conceptCards') {
      let query = supabase
        .from('saved_concept_cards')
        .select('id, name, subject_name, topics, difficulty, created_at')
        .eq('user_id', userId);

      if (isValidUuid(categoryId)) {
        query = query.eq('category_id', categoryId);
      }

      if (searchQuery && searchQuery.trim() !== '') {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,topics.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: sortOrder === 'asc' })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw error;
      return res.status(200).json({ success: true, conceptCards: data || [] });

    } else if (type === 'cheatCards') {
      let query = supabase
        .from('saved_cheat_cards')
        .select('id, name, subject_name, topics, difficulty, created_at')
        .eq('user_id', userId);

      if (isValidUuid(categoryId)) {
        query = query.eq('category_id', categoryId);
      }

      if (searchQuery && searchQuery.trim() !== '') {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,topics.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: sortOrder === 'asc' })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw error;
      return res.status(200).json({ success: true, cheatCards: data || [] });
    }

    return res.status(400).json({ error: 'Unsupported search type' });

  } catch (error) {
    console.error('Search API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
