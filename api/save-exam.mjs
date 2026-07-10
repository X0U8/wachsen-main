import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const examData = req.body;
    if (!examData.examName || !examData.createdBy) {
      return res.status(400).json({ error: 'examName and createdBy are required' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.from('exams').insert({
      examName: examData.examName,
      examType: examData.examType || 'practice',
      language: examData.language || 'English',
      isPublic: examData.isPublic !== undefined ? examData.isPublic : true,
      createdBy: examData.createdBy,
      accessIds: examData.accessIds?.length > 0 ? examData.accessIds : [examData.createdBy],
      accessType: examData.accessType || 'anytime',
      startDateTime: examData.startDateTime || null,
      endDateTime: examData.endDateTime || null,
      difficulty: examData.difficulty || 'medium',
      totalTime: examData.totalTime || 60,
      totalQuestions: examData.totalQuestions || 0,
      totalMarks: examData.totalMarks || 0,
      subjects: examData.subjects || '[]',
      categoryId: examData.categoryId || null,
      status: examData.status || 'Pending',
      generatedExam: examData.generatedExam || '[]',
      correct_marks: examData.correct_marks ?? examData.defaultCorrectMarks ?? 4,
      negative_marks: examData.negative_marks ?? examData.defaultNegativeMarks ?? 0,
      ExamPlan: examData.ExamPlan || '{}'
    }).select().single();

    if (error) throw error;

    return res.status(200).json({ success: true, examId: data.id, document: data });
  } catch (error) {
    console.error('Error saving exam:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
