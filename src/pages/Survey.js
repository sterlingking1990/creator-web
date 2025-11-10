import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import './Survey.css';

const Survey = ({ user }) => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  
  const [survey, setSurvey] = useState(null);
  const [statusPost, setStatusPost] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState(null);
  const [skippedQuestions, setSkippedQuestions] = useState(new Set());
  const [questionFlow, setQuestionFlow] = useState([0]); // Track the actual flow path

  useEffect(() => {
    if (user && surveyId) {
      initializeSurvey();
    }
  }, [user, surveyId]);

  const initializeSurvey = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSurveyData(),
        checkIfAlreadyCompleted(),
      ]);
    } catch (error) {
      console.error('Error initializing survey:', error);
      setError('Failed to load survey');
    } finally {
      setLoading(false);
    }
  };

  const fetchSurveyData = async () => {
    try {
      // Fetch survey with related status post
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select(`
          *,
          status_posts!inner (
            *,
            profiles!brand_id (
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      setSurvey(surveyData);
      setStatusPost(surveyData.status_posts);

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

    } catch (error) {
      console.error('Error fetching survey data:', error);
      throw error;
    }
  };

  const checkIfAlreadyCompleted = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('respondent_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking survey completion:', error);
        return;
      }

      if (data) {
        setAlreadyCompleted(true);
      }
    } catch (error) {
      console.error('Error checking survey completion:', error);
    }
  };

  const updateAnswer = (questionId, answer, option = null) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));

    // Handle skip logic for multiple choice questions
    if (option && option.next_question_id) {
      const currentQuestion = questions[currentQuestionIndex];
      const nextQuestionIndex = questions.findIndex(q => q.id === option.next_question_id);
      if (nextQuestionIndex !== -1) {
        // Mark questions between current and next as skipped
        const questionsToSkip = new Set();
        for (let i = currentQuestionIndex + 1; i < nextQuestionIndex; i++) {
          questionsToSkip.add(i);
        }
        
        // Update skipped questions
        setSkippedQuestions(prev => {
          const newSkipped = new Set(prev);
          questionsToSkip.forEach(idx => newSkipped.add(idx));
          return newSkipped;
        });

        // Update question flow to track the path
        setQuestionFlow(prev => [...prev, nextQuestionIndex]);
        
        // Jump to the target question
        setCurrentQuestionIndex(nextQuestionIndex);
      }
    }
  };

  const validateAnswers = () => {
    const requiredQuestions = questions.filter(q => q.is_required);
    const missingAnswers = requiredQuestions.filter(q => !answers[q.id]);

    if (missingAnswers.length > 0) {
      alert(`Please answer all required questions. Missing: ${missingAnswers.length} questions`);
      return false;
    }

    return true;
  };

  const submitSurvey = async () => {
    if (alreadyCompleted) return;

    if (!validateAnswers()) return;

    setSubmitting(true);
    try {
      // Check for existing response (double-check)
      const { data: existingResponse } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('respondent_id', user.id)
        .maybeSingle();

      if (existingResponse) {
        alert('You have already completed this survey.');
        navigate('/');
        return;
      }

      // Insert survey response
      const { data: responseData, error: responseError } = await supabase
        .from('survey_responses')
        .insert({
          survey_id: surveyId,
          respondent_id: user.id,
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // Insert answers
      const answerInserts = Object.entries(answers).map(([questionId, answer]) => ({
        survey_response_id: responseData.id,
        question_id: questionId,
        answer_text: typeof answer === 'string' ? answer : null,
        answer_option: typeof answer === 'string' && answer.length < 100 ? answer : null,
        answer_rating: typeof answer === 'number' ? answer : null,
      }));

      const { error: answersError } = await supabase
        .from('survey_answers')
        .insert(answerInserts);

      if (answersError) throw answersError;

      // Call reward function
      const { data: rewardData, error: rewardError } = await supabase.rpc('give_survey_reward', {
        p_survey_id: surveyId,
        p_respondent_id: user.id,
        p_reward_amount: statusPost.reward_amount
      });

      if (rewardError) {
        console.error('Reward error:', rewardError);
        // Don't throw here - survey was still submitted successfully
      }

      setAlreadyCompleted(true);
      
      const rewardMessage = rewardData?.reward_given 
        ? `Thank you for your response! You earned ${statusPost.reward_amount} Brandible coins.`
        : 'Thank you for your response! This survey has reached its reward limit, but your feedback is valuable.';
      
      alert(rewardMessage);
      navigate('/');

    } catch (error) {
      console.error('Submission error:', error);
      alert(`Failed to submit survey: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      let nextIndex = currentQuestionIndex + 1;
      // Skip over any skipped questions when using next button
      while (nextIndex < questions.length && skippedQuestions.has(nextIndex)) {
        nextIndex++;
      }
      if (nextIndex < questions.length) {
        setQuestionFlow(prev => [...prev, nextIndex]);
        setCurrentQuestionIndex(nextIndex);
      }
    }
  };

  const prevQuestion = () => {
    if (questionFlow.length > 1) {
      // Go back to the previous question in the actual flow path
      const newFlow = [...questionFlow];
      newFlow.pop(); // Remove current question
      const prevIndex = newFlow[newFlow.length - 1];
      setQuestionFlow(newFlow);
      setCurrentQuestionIndex(prevIndex);
    }
  };

  const goToQuestion = (index) => {
    // Only allow navigation to non-skipped questions or questions already answered
    if (!skippedQuestions.has(index) || answers[questions[index]?.id]) {
      setCurrentQuestionIndex(index);
      // Update flow path to include this question if not already there
      if (!questionFlow.includes(index)) {
        setQuestionFlow(prev => [...prev, index]);
      }
    }
  };

  const renderQuestion = (question) => {
    const answer = answers[question.id] || '';

    switch (question.question_type) {
      case 'multiple_choice':
        const options = question.options || [];
        return (
          <div className="question-container">
            <h3 className="question-text">
              {question.question_text}
              {question.is_required && <span className="required"> *</span>}
            </h3>
            <div className="options-container">
              {options.map((option, index) => (
                <label
                  key={index}
                  className={`option-label ${answer === option.option_text ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`question_${question.id}`}
                    value={option.option_text}
                    checked={answer === option.option_text}
                    onChange={() => updateAnswer(question.id, option.option_text, option)}
                    disabled={alreadyCompleted}
                  />
                  <span className="option-text">{option.option_text}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'rating':
        return (
          <div className="question-container">
            <h3 className="question-text">
              {question.question_text}
              {question.is_required && <span className="required"> *</span>}
            </h3>
            <div className="rating-container">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className={`rating-button ${answer === rating ? 'selected' : ''}`}
                  onClick={() => updateAnswer(question.id, rating)}
                  disabled={alreadyCompleted}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="rating-labels">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </div>
        );

      case 'text':
      default:
        return (
          <div className="question-container">
            <label className="question-text">
              {question.question_text}
              {question.is_required && <span className="required"> *</span>}
            </label>
            <textarea
              className="text-input"
              value={answer}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              placeholder="Type your answer here..."
              disabled={alreadyCompleted}
              rows={4}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="survey-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="survey-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!survey || !statusPost) {
    return (
      <div className="survey-page">
        <div className="error-container">
          <h2>Survey Not Found</h2>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="survey-page">
      <div className="survey-header">
        <button 
          onClick={() => navigate('/')} 
          className="back-button"
        >
          ← Back to Dashboard
        </button>
        <div className="survey-info">
          <h1>{survey.title}</h1>
          <div className="brand-info">
            <img 
              src={statusPost.profiles?.avatar_url || '/placeholder-avatar.png'} 
              alt={statusPost.profiles?.full_name}
              className="brand-avatar"
            />
            <span>by {statusPost.profiles?.full_name}</span>
          </div>
          <div className="reward-info">
            <span className="reward-amount">
              Reward: {statusPost.reward_amount} coins
            </span>
          </div>
        </div>
      </div>

      {alreadyCompleted ? (
        <div className="completed-message">
          <h2>Survey Already Completed</h2>
          <p>Thank you for your participation!</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      ) : (
        <div className="survey-content">
          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-text">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
          </div>

          {/* Question Navigation */}
          <div className="question-nav">
            {questions.map((_, index) => {
              const isSkipped = skippedQuestions.has(index);
              const isAnswered = answers[questions[index]?.id];
              const isActive = index === currentQuestionIndex;
              const isAccessible = !isSkipped || isAnswered;
              
              return (
                <button
                  key={index}
                  className={`question-nav-btn ${isActive ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isSkipped && !isAnswered ? 'skipped' : ''}`}
                  onClick={() => goToQuestion(index)}
                  disabled={!isAccessible}
                  title={isSkipped && !isAnswered ? 'Question skipped based on previous answer' : ''}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* Current Question */}
          {currentQuestion && (
            <div className="question-area">
              {renderQuestion(currentQuestion)}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="survey-navigation">
            <button 
              onClick={prevQuestion}
              disabled={questionFlow.length <= 1}
              className="btn btn-secondary"
            >
              Previous
            </button>

            {currentQuestionIndex < questions.length - 1 ? (
              <button 
                onClick={nextQuestion}
                className="btn btn-primary"
              >
                Next
              </button>
            ) : (
              <button 
                onClick={submitSurvey}
                disabled={submitting}
                className="btn btn-success"
              >
                {submitting ? 'Submitting...' : 'Submit Survey'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Survey;