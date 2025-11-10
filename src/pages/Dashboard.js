import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { 
  DollarSign, 
  Megaphone,
  Mail,
  TrendingUp,
  Users,
  Calendar,
  Star,
  Eye,
  FileText,
  Target
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    balance: 0,
    totalEarnings: 0,
    activeCampaigns: 0,
    pendingInvitations: 0,
    totalViews: 0,
    engagement: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [publicStatuses, setPublicStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaStatus, setCurrentMediaStatus] = useState(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all dashboard data in parallel
      await Promise.all([
        fetchUserStats(),
        fetchPrivateCampaigns(),
        fetchPublicStatuses(),
        fetchRecentActivity()
      ]);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      // Fetch user balance and earnings
      const { data: profile } = await supabase
        .from('profiles')
        .select('brandible_coins')
        .eq('id', user.id)
        .single();

      // Fetch total earnings from transactions
      const { data: earnings } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'earned');

      const totalEarnings = earnings?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

      // Fetch active campaigns
      const { data: campaigns } = await supabase
        .from('challenge_submissions')
        .select(`
          *,
          challenges (
            id,
            title,
            description,
            reward_amount,
            status_posts (
              content,
              created_at
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending');

      // Fetch pending invitations
      const { data: invitations } = await supabase
        .from('private_campaign_invites')
        .select('*')
        .eq('influencer_id', user.id)
        .eq('status', 'pending');

      setStats(prevStats => ({
        ...prevStats,
        balance: profile?.brandible_coins || 0,
        totalEarnings,
        pendingInvitations: invitations?.length || 0
      }));

    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchPrivateCampaigns = async () => {
    try {
      // Fetch active private campaigns
      const { data: campaigns } = await supabase
        .from('challenge_submissions')
        .select(`
          *,
          challenges (
            id,
            title,
            description,
            reward_amount,
            status_posts (
              content,
              created_at
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending');

      setActiveCampaigns(campaigns || []);
      setStats(prevStats => ({
        ...prevStats,
        activeCampaigns: campaigns?.length || 0
      }));

    } catch (error) {
      console.error('Error fetching private campaigns:', error);
    }
  };

  const fetchPublicStatuses = async () => {
    try {
      // Fetch public status posts (same as mobile HomeScreen.js)
      const { data: statuses, error: statusError } = await supabase
        .from('status_posts')
        .select(`
          *,
          profiles:brand_id (
            full_name,
            username,
            avatar_url
          ),
          challenges (*),
          surveys (*)
        `)
        .eq('is_active', true)
        .eq('is_private', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(6);

      if (statusError) throw statusError;

      // Process statuses with media for status_view types
      const statusesWithMedia = await Promise.all(
        (statuses || []).map(async (status) => {
          if (status.type === 'status_view') {
            const { data: mediaItems } = await supabase
              .from('status_media')
              .select('*')
              .eq('status_post_id', status.id)
              .order('order_index', { ascending: true });

            return { ...status, media_items: mediaItems || [] };
          }
          return status;
        })
      );

      // Filter valid statuses
      const validStatuses = statusesWithMedia.filter(s => {
        if (s.type === 'status_view') {
          return s.media_items && s.media_items.length > 0;
        }
        if (s.type === 'survey') {
          return s.surveys && s.surveys.length > 0;
        }
        if (s.type === 'challenge') {
          return s.challenges && s.challenges.length > 0;
        }
        return true;
      });

      setPublicStatuses(validStatuses);

    } catch (error) {
      console.error('Error fetching public statuses:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      // Fetch recent activity (transactions)
      const { data: activity } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentActivity(activity || []);

    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleContentClick = async (status) => {
    try {
      if (status.type === 'status_view') {
        // Handle status view - record view and give reward
        await handleStatusView(status);
      } else if (status.type === 'survey') {
        // Navigate to survey page
        handleSurvey(status);
      } else if (status.type === 'challenge') {
        // Navigate to challenge participation
        handleChallenge(status);
      }
    } catch (error) {
      console.error('Error handling content click:', error);
      alert('Failed to open content. Please try again.');
    }
  };

  const handleStatusView = async (status) => {
    if (!status.media_items || status.media_items.length === 0) {
      alert('No media available for this status view.');
      return;
    }

    try {
      // Check if user has already viewed this status
      const { data: existingViews, error: checkError } = await supabase
        .from('status_views')
        .select('id')
        .eq('viewer_id', user.id)
        .eq('status_post_id', status.id);

      if (checkError) {
        console.error('Error checking existing views:', checkError);
        alert(`Error checking view status: ${checkError.message}`);
        return;
      }

      if (existingViews && existingViews.length > 0) {
        alert('You have already viewed this content.');
        return;
      }

      // Get current user balance first
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('brandible_coins')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        alert(`Error fetching profile: ${profileError.message}`);
        return;
      }

      const currentBalance = currentProfile?.brandible_coins || 0;

      // Record the view and give reward
      const { error: viewError } = await supabase
        .from('status_views')
        .insert({
          viewer_id: user.id,
          status_post_id: status.id,
          media_id: status.media_items[0].id,
          reward_given: true
        });

      if (viewError) {
        console.error('Error inserting view:', viewError);
        alert(`Error recording view: ${viewError.message}`);
        return;
      }

      // Add reward transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'earned',
          amount: status.reward_amount,
          description: `Viewed: ${status.title}`,
          reference_type: 'status_view',
          reference_id: status.id
        });

      if (transactionError) {
        console.error('Error inserting transaction:', transactionError);
        alert(`Error recording transaction: ${transactionError.message}`);
        return;
      }

      // Update user balance
      const newBalance = currentBalance + status.reward_amount;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ 
          brandible_coins: newBalance
        })
        .eq('id', user.id);

      if (balanceError) {
        console.error('Error updating balance:', balanceError);
        alert(`Error updating balance: ${balanceError.message}`);
        return;
      }

      // Show media content in beautiful modal
      showMediaModal(status);

      // Refresh dashboard data
      fetchDashboardData();

    } catch (error) {
      console.error('Error recording status view:', error);
      alert('Failed to record view. Please try again.');
    }
  };

  const showMediaModal = (status) => {
    setCurrentMediaStatus(status);
    setCurrentMediaIndex(0);
    setMediaModalOpen(true);
  };

  const closeMediaModal = () => {
    setMediaModalOpen(false);
    setCurrentMediaStatus(null);
    setCurrentMediaIndex(0);
  };

  const nextMedia = () => {
    if (currentMediaStatus && currentMediaIndex < currentMediaStatus.media_items.length - 1) {
      setCurrentMediaIndex(currentMediaIndex + 1);
    }
  };

  const prevMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(currentMediaIndex - 1);
    }
  };

  const goToMedia = (index) => {
    setCurrentMediaIndex(index);
  };

  const handleSurvey = (status) => {
    if (!status.surveys || status.surveys.length === 0) {
      alert('No survey available.');
      return;
    }

    // Navigate to survey
    const surveyId = status.surveys[0].id;
    window.location.href = `/survey/${surveyId}`;
  };

  const handleChallenge = (status) => {
    if (!status.challenges || status.challenges.length === 0) {
      alert('No challenge available.');
      return;
    }

    // For now, we'll show an alert. This could be enhanced with a proper challenge modal
    alert(`Challenge: ${status.title}\n\nThis would open the challenge participation interface.`);
    
    // TODO: Navigate to challenge component or show challenge modal  
    // Example: window.location.href = `/challenge/${status.challenges[0].id}`;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="welcome-content">
          <h1>Welcome back, {user?.full_name}! 👋</h1>
          <p>Here's what's happening with your creator journey</p>
        </div>
        <div className="quick-actions">
          <button className="quick-action-btn">
            <Megaphone size={20} />
            <span>Browse Campaigns</span>
          </button>
          <button className="quick-action-btn">
            <Mail size={20} />
            <span>Check Invitations</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>{formatAmount(stats.balance)}</h3>
            <p>Coin Balance</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>{formatAmount(stats.totalEarnings)}</h3>
            <p>Total Earnings</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Megaphone size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.activeCampaigns}</h3>
            <p>Active Campaigns</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Mail size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.pendingInvitations}</h3>
            <p>Pending Invitations</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="main-grid">
        {/* Available Content */}
        <div className="card">
          <div className="card-header">
            <h2>Available Content</h2>
            <a href="/browse" className="view-all-link">Browse All</a>
          </div>
          <div className="content-list">
            {publicStatuses.length > 0 ? (
              publicStatuses.slice(0, 4).map((status) => (
                <div key={status.id} className="content-item">
                  <div className="content-info">
                    <div className="content-header">
                      <h4>{status.title}</h4>
                      <span 
                        className="content-type-badge"
                        style={{
                          backgroundColor: status.type === 'challenge' ? '#FEF3C7' : 
                                         status.type === 'survey' ? '#DBEAFE' : '#F0F9FF',
                          color: status.type === 'challenge' ? '#92400E' : 
                                 status.type === 'survey' ? '#1E40AF' : '#0369A1'
                        }}
                      >
                        {status.type === 'challenge' && <Target size={14} />}
                        {status.type === 'survey' && <FileText size={14} />}
                        {status.type === 'status_view' && <Eye size={14} />}
                        {status.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p>{status.description}</p>
                    <div className="content-meta">
                      <div className="brand-info">
                        {status.profiles?.avatar_url ? (
                          <img 
                            src={status.profiles.avatar_url} 
                            alt={status.profiles.full_name}
                            className="brand-avatar-small"
                          />
                        ) : (
                          <div className="brand-avatar-placeholder-small">
                            <User size={12} />
                          </div>
                        )}
                        <span className="brand-name-small">{status.profiles?.full_name}</span>
                      </div>
                      <div className="reward-info-small">
                        <Star size={12} className="reward-icon" />
                        <span className="reward-text-small">{status.reward_amount} coins</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="participate-btn"
                    onClick={() => handleContentClick(status)}
                  >
                    {status.type === 'status_view' ? 'View' : 
                     status.type === 'survey' ? 'Take Survey' : 'Participate'}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Eye size={48} />
                <h3>No Content Available</h3>
                <p>Check back later for new status views, challenges, and surveys</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Private Campaigns */}
        <div className="card">
          <div className="card-header">
            <h2>Active Private Campaigns</h2>
            <a href="/campaigns" className="view-all-link">View All</a>
          </div>
          <div className="campaigns-list">
            {activeCampaigns.length > 0 ? (
              activeCampaigns.slice(0, 3).map((submission) => (
                <div key={submission.id} className="campaign-item">
                  <div className="campaign-info">
                    <h4>{submission.challenges?.title}</h4>
                    <p>{submission.challenges?.description}</p>
                    <div className="campaign-meta">
                      <span className="reward">
                        <Star size={16} />
                        {submission.challenges?.reward_amount} coins
                      </span>
                      <span className="status pending">Pending Review</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Megaphone size={48} />
                <h3>No Active Private Campaigns</h3>
                <p>Accepted private campaign invitations will appear here</p>
                <button className="btn btn-primary" onClick={() => window.location.href = '/invitations'}>
                  Check Invitations
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h2>Recent Activity</h2>
            <a href="/wallet" className="view-all-link">View All</a>
          </div>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((transaction) => (
                <div key={transaction.id} className="activity-item">
                  <div className="activity-icon">
                    {transaction.type === 'earned' ? (
                      <TrendingUp size={20} className="success" />
                    ) : (
                      <DollarSign size={20} className="neutral" />
                    )}
                  </div>
                  <div className="activity-content">
                    <h4>
                      {transaction.type === 'earned' ? 'Earned' : 'Spent'} {transaction.amount} coins
                    </h4>
                    <p>{transaction.description || 'Campaign participation'}</p>
                    <span className="activity-time">
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <TrendingUp size={48} />
                <h3>No Recent Activity</h3>
                <p>Your transaction history will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media Viewer Modal */}
      {mediaModalOpen && currentMediaStatus && (
        <div className="media-modal-overlay" onClick={closeMediaModal}>
          <div className="media-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="media-modal-header">
              <div className="media-modal-info">
                <h3>{currentMediaStatus.title}</h3>
                <div className="brand-info-header">
                  {currentMediaStatus.profiles?.avatar_url ? (
                    <img 
                      src={currentMediaStatus.profiles.avatar_url} 
                      alt={currentMediaStatus.profiles.full_name}
                      className="brand-avatar-header"
                    />
                  ) : (
                    <div className="brand-avatar-placeholder-header">
                      <User size={16} />
                    </div>
                  )}
                  <span className="brand-name-header">{currentMediaStatus.profiles?.full_name}</span>
                </div>
              </div>
              <button onClick={closeMediaModal} className="close-modal-btn">×</button>
            </div>

            {/* Media Display */}
            <div className="media-display-container">
              {currentMediaStatus.media_items.length > 1 && (
                <button 
                  className="nav-btn nav-btn-prev"
                  onClick={prevMedia}
                  disabled={currentMediaIndex === 0}
                >
                  ←
                </button>
              )}

              <div className="media-content">
                {currentMediaStatus.media_items[currentMediaIndex]?.media_type === 'image' ? (
                  <img 
                    src={currentMediaStatus.media_items[currentMediaIndex]?.media_url}
                    alt={`Media ${currentMediaIndex + 1}`}
                    className="media-item"
                  />
                ) : (
                  <video 
                    src={currentMediaStatus.media_items[currentMediaIndex]?.media_url}
                    className="media-item"
                    controls
                    autoPlay
                  />
                )}
              </div>

              {currentMediaStatus.media_items.length > 1 && (
                <button 
                  className="nav-btn nav-btn-next"
                  onClick={nextMedia}
                  disabled={currentMediaIndex === currentMediaStatus.media_items.length - 1}
                >
                  →
                </button>
              )}
            </div>

            {/* Media Counter & Thumbnails */}
            {currentMediaStatus.media_items.length > 1 && (
              <div className="media-navigation">
                <div className="media-counter">
                  {currentMediaIndex + 1} of {currentMediaStatus.media_items.length}
                </div>
                <div className="media-thumbnails">
                  {currentMediaStatus.media_items.map((media, index) => (
                    <div
                      key={index}
                      className={`thumbnail ${index === currentMediaIndex ? 'active' : ''}`}
                      onClick={() => goToMedia(index)}
                    >
                      {media.media_type === 'image' ? (
                        <img 
                          src={media.media_url}
                          alt={`Thumbnail ${index + 1}`}
                          className="thumbnail-image"
                        />
                      ) : (
                        <div className="thumbnail-video">
                          <video 
                            src={media.media_url}
                            className="thumbnail-image"
                          />
                          <div className="video-play-icon">▶</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="media-modal-footer">
              <p className="media-description">{currentMediaStatus.description}</p>
              <div className="success-message">
                🎉 You earned {currentMediaStatus.reward_amount} coins for viewing this content!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;