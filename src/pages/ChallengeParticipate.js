import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import './ChallengeParticipate.css';

const ChallengeParticipate = ({ user }) => {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  
  const [challenge, setChallenge] = useState(null);
  const [statusPost, setStatusPost] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    if (user && challengeId) {
      fetchChallengeData();
    }
  }, [user, challengeId]);

  const fetchChallengeData = async () => {
    try {
      setLoading(true);
      
      // Fetch challenge with status post and brand info
      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
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
        .eq('id', challengeId)
        .single();

      if (challengeError) throw challengeError;

      setChallenge(challengeData);
      setStatusPost(challengeData.status_posts);
      
      // Pre-fill hashtags if provided
      if (challengeData.hashtags && Array.isArray(challengeData.hashtags)) {
        setHashtags(challengeData.hashtags.join(' '));
      }

      // Check if user already submitted
      const { data: existingSubmission } = await supabase
        .from('challenge_submissions')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('participant_id', user.id)
        .single();

      if (existingSubmission) {
        setError('You have already submitted to this challenge. You can only submit once per challenge.');
      }

    } catch (error) {
      console.error('Error fetching challenge data:', error);
      setError('Failed to load challenge details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
      alert('Please select a video or image file');
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('File size must be less than 50MB');
      return;
    }

    setSelectedMedia(file);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setMediaPreview(previewUrl);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const uploadMediaToStorage = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `challenge_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('challenge-submissions')
        .upload(fileName, file, {
          upsert: false,
          contentType: file.type
        });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from('challenge-submissions')
        .getPublicUrl(data.path);

      return publicData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const submitChallenge = async () => {
    if (!selectedMedia) {
      alert('Please select a video or image file');
      return;
    }

    if (!caption.trim()) {
      alert('Please add a caption');
      return;
    }

    setUploading(true);
    try {
      // Upload media to storage
      const mediaUrl = await uploadMediaToStorage(selectedMedia);

      // Determine submission type
      const submissionType = selectedMedia.type.startsWith('video/') ? 'video' : 'image';

      // Process hashtags
      const hashtagArray = hashtags
        .split(' ')
        .filter(tag => tag.trim() !== '')
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`);

      // Insert challenge submission
      const { error: insertError } = await supabase
        .from('challenge_submissions')
        .insert({
          challenge_id: challenge.id,
          participant_id: user.id,
          submission_url: mediaUrl,
          submission_type: submissionType,
          caption: caption.trim(),
          hashtags: hashtagArray,
          group_id: challenge.group_id || null,
          part_number: challenge.part_number || 1,
        });

      if (insertError) throw insertError;

      // Increment participation count
      const { error: participationError } = await supabase.rpc('increment_participation_count', {
        p_status_id: statusPost.id,
        p_participant_id: user.id,
      });

      if (participationError) {
        console.error('Error incrementing participation count:', participationError);
      }

      alert('Submission successful! Your challenge submission has been sent for review. You will be notified once it\'s approved.');
      navigate('/');

    } catch (error) {
      console.error('Submission error:', error);
      alert(`Failed to submit challenge: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setSelectedMedia(null);
    setMediaPreview(null);
    setRecordedBlob(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user' // Front camera by default
        }, 
        audio: true 
      });
      
      setCameraStream(stream);
      setCameraMode(true);
      
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions and try again.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraMode(false);
  };

  const switchCamera = async () => {
    if (cameraStream) {
      // Stop current stream
      cameraStream.getTracks().forEach(track => track.stop());
      
      // Get current facing mode and switch it
      const videoTrack = cameraStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const newFacingMode = settings.facingMode === 'user' ? 'environment' : 'user';
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: newFacingMode
          },
          audio: true
        });
        
        setCameraStream(newStream);
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = newStream;
        }
      } catch (error) {
        console.error('Error switching camera:', error);
        // Fallback to original stream
        startCamera();
      }
    }
  };

  const startRecording = () => {
    if (!cameraStream) return;

    const mediaRecorder = new MediaRecorder(cameraStream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    const chunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const recordedBlob = new Blob(chunks, { type: 'video/webm' });
      setRecordedBlob(recordedBlob);
      
      // Create a File object from the blob
      const recordedFile = new File([recordedBlob], `recorded_video_${Date.now()}.webm`, {
        type: 'video/webm'
      });
      
      setSelectedMedia(recordedFile);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(recordedBlob);
      setMediaPreview(previewUrl);
      
      // Stop camera and exit camera mode
      stopCamera();
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    
    // Auto-stop recording after max duration
    const maxDuration = (challenge?.max_duration || 30) * 1000;
    setTimeout(() => {
      if (mediaRecorderRef.current && isRecording) {
        stopRecording();
      }
    }, maxDuration);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  if (loading) {
    return (
      <div className="challenge-participate-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="challenge-participate-page">
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

  if (!challenge || !statusPost) {
    return (
      <div className="challenge-participate-page">
        <div className="error-container">
          <h2>Challenge Not Found</h2>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="challenge-participate-page">
      <div className="challenge-header">
        <button 
          onClick={() => navigate('/')} 
          className="back-button"
        >
          ← Back to Dashboard
        </button>
        <div className="challenge-info">
          <h1>{challenge.challenge_prompt}</h1>
          <div className="brand-info">
            <img 
              src={statusPost.profiles?.avatar_url || '/placeholder-avatar.png'} 
              alt={statusPost.profiles?.full_name}
              className="brand-avatar"
            />
            <span>by {statusPost.profiles?.full_name}</span>
          </div>
          <div className="challenge-meta">
            <div className="reward-info">
              <span className="reward-amount">
                🪙 Earn {statusPost.reward_amount} coins when approved!
              </span>
            </div>
            <div className="duration-info">
              Max duration: {challenge.max_duration || 30} seconds
            </div>
          </div>
        </div>
      </div>

      <div className="challenge-content">
        <div className="challenge-description">
          <h3>Challenge Details</h3>
          <p>{challenge.description}</p>
          {challenge.submission_guidelines && (
            <div className="guidelines">
              <h4>Submission Guidelines</h4>
              <p>{challenge.submission_guidelines}</p>
            </div>
          )}
        </div>

        <div className="submission-form">
          <div className="media-upload-section">
            <h3>Record or Upload Your Submission</h3>
            
            {!selectedMedia && !cameraMode ? (
              <div className="upload-options">
                <button 
                  className="camera-btn"
                  onClick={startCamera}
                  type="button"
                >
                  <div className="camera-icon">📹</div>
                  <span>Record Video</span>
                </button>
                
                <div className="upload-divider">or</div>
                
                <div 
                  className={`upload-area ${dragActive ? 'drag-active' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-content">
                    <div className="upload-icon">📁</div>
                    <h4>Drop your video or image here</h4>
                    <p>or click to browse files</p>
                    <div className="file-types">
                      Supports: MP4, MOV, AVI, JPG, PNG (max 50MB)
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,image/*"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            ) : cameraMode ? (
              <div className="camera-container">
                <div className="camera-view">
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    muted
                    className="camera-video"
                  />
                  
                  <div className="camera-overlay">
                    <div className="camera-header">
                      <button 
                        className="camera-close-btn"
                        onClick={stopCamera}
                        type="button"
                      >
                        ✕
                      </button>
                      <div className="challenge-title-overlay">
                        {challenge.challenge_prompt}
                      </div>
                      <button 
                        className="camera-switch-btn"
                        onClick={switchCamera}
                        type="button"
                      >
                        🔄
                      </button>
                    </div>
                    
                    <div className="camera-controls">
                      <div className="recording-timer">
                        {isRecording ? `Recording... (${challenge?.max_duration || 30}s max)` : 'Ready to record'}
                      </div>
                      
                      <button
                        className={`record-btn ${isRecording ? 'recording' : ''}`}
                        onClick={isRecording ? stopRecording : startRecording}
                        type="button"
                      >
                        <div className={`record-indicator ${isRecording ? 'recording' : ''}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="media-preview">
                <div className="preview-container">
                  {selectedMedia.type.startsWith('video/') ? (
                    <video
                      ref={videoRef}
                      src={mediaPreview}
                      controls
                      className="preview-media"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="preview-media"
                    />
                  )}
                  <button 
                    className="remove-media-btn"
                    onClick={removeMedia}
                  >
                    ✕
                  </button>
                </div>
                <div className="media-info">
                  <p><strong>File:</strong> {selectedMedia.name}</p>
                  <p><strong>Size:</strong> {(selectedMedia.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p><strong>Type:</strong> {selectedMedia.type}</p>
                </div>
              </div>
            )}
          </div>

          <div className="form-fields">
            <div className="form-group">
              <label htmlFor="caption">Caption *</label>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your submission..."
                rows={4}
                maxLength={500}
                required
              />
              <div className="char-count">{caption.length}/500</div>
            </div>

            <div className="form-group">
              <label htmlFor="hashtags">Hashtags</label>
              <input
                id="hashtags"
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#brandible #challenge"
              />
              <p className="field-help">
                Add relevant hashtags separated by spaces (# will be added automatically)
              </p>
            </div>

            <button
              onClick={submitChallenge}
              disabled={uploading || !selectedMedia || !caption.trim()}
              className={`submit-btn ${uploading ? 'submitting' : ''}`}
            >
              {uploading ? (
                <>
                  <div className="submit-spinner"></div>
                  Submitting...
                </>
              ) : (
                'Submit Challenge'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeParticipate;