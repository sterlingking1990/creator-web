import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { 
  Lock, 
  Star, 
  DollarSign, 
  Calendar, 
  User,
  FileText,
  Target,
  RefreshCw
} from 'lucide-react';
import './Campaigns.css';

const Campaigns = ({ user }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'challenge', 'survey'

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      if (!user) throw new Error('User not found');

      // Ported from mobile: fetch private campaign invites
      const { data, error } = await supabase
        .from('private_campaign_invites')
        .select(`
          status_post:status_posts!inner(
            *,
            brand:brand_id (full_name, avatar_url),
            challenges(*),
            surveys(*)
          )
        `)
        .eq('influencer_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;
      
      // Extract status_post from each invite (same as mobile logic)
      const acceptedCampaigns = data.map(invite => invite.status_post);
      setCampaigns(acceptedCampaigns || []);

    } catch (error) {
      console.error('Fetch campaigns error:', error);
      // Could add toast notification here
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignClick = (campaign) => {
    if (campaign.type === 'challenge' && campaign.challenges.length > 0) {
      // TODO: Navigate to challenge participation
      console.log('Navigate to challenge:', campaign.challenges[0]);
    } else if (campaign.type === 'survey' && campaign.surveys.length > 0) {
      // TODO: Navigate to survey
      console.log('Navigate to survey:', campaign.surveys[0]);
    } else {
      alert('Cannot open this campaign.');
    }
  };

  const getFilteredCampaigns = () => {
    if (filter === 'all') return campaigns;
    return campaigns.filter(campaign => campaign.type === filter);
  };

  const getCampaignTypeIcon = (type) => {
    return type === 'challenge' ? <Target size={20} /> : <FileText size={20} />;
  };

  const getCampaignTypeBadge = (type) => {
    return {
      backgroundColor: type === 'challenge' ? '#FEF3C7' : '#DBEAFE',
      color: type === 'challenge' ? '#92400E' : '#1E40AF'
    };
  };

  const filteredCampaigns = getFilteredCampaigns();

  return (
    <div className="campaigns-page">
      <div className="campaigns-header">
        <div className="header-content">
          <h1>My Private Campaigns</h1>
          <p>Manage your accepted brand collaborations</p>
        </div>
        <button 
          onClick={fetchCampaigns} 
          className="refresh-btn"
          disabled={loading}
        >
          <RefreshCw size={20} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Campaigns ({campaigns.length})
        </button>
        <button 
          className={`filter-tab ${filter === 'challenge' ? 'active' : ''}`}
          onClick={() => setFilter('challenge')}
        >
          <Target size={16} />
          Challenges ({campaigns.filter(c => c.type === 'challenge').length})
        </button>
        <button 
          className={`filter-tab ${filter === 'survey' ? 'active' : ''}`}
          onClick={() => setFilter('survey')}
        >
          <FileText size={16} />
          Surveys ({campaigns.filter(c => c.type === 'survey').length})
        </button>
      </div>

      {/* Campaigns List */}
      <div className="campaigns-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your campaigns...</p>
          </div>
        ) : filteredCampaigns.length > 0 ? (
          <div className="campaigns-grid">
            {filteredCampaigns.map((campaign) => (
              <div 
                key={campaign.id} 
                className="campaign-card"
                onClick={() => handleCampaignClick(campaign)}
              >
                <div className="campaign-header">
                  <div className="campaign-title-section">
                    <h3 className="campaign-title">{campaign.title}</h3>
                    <span 
                      className="type-badge"
                      style={getCampaignTypeBadge(campaign.type)}
                    >
                      {getCampaignTypeIcon(campaign.type)}
                      {campaign.type}
                    </span>
                  </div>
                </div>

                <div className="campaign-brand">
                  <div className="brand-info">
                    {campaign.brand?.avatar_url ? (
                      <img 
                        src={campaign.brand.avatar_url} 
                        alt={campaign.brand.full_name}
                        className="brand-avatar"
                      />
                    ) : (
                      <div className="brand-avatar-placeholder">
                        <User size={20} />
                      </div>
                    )}
                    <span className="brand-name">From: {campaign.brand?.full_name}</span>
                  </div>
                </div>

                <p className="campaign-description">{campaign.description}</p>

                <div className="campaign-footer">
                  <div className="reward-info">
                    <Star size={16} className="reward-icon" />
                    <span className="reward-text">Your Rate: {campaign.reward_amount} Coins</span>
                  </div>
                  <div className="campaign-meta">
                    <span className="created-date">
                      <Calendar size={14} />
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Lock size={64} className="empty-icon" />
            <h2>No Private Campaigns</h2>
            <p>Accepted private campaign invitations will appear here.</p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={() => window.location.href = '/invitations'}>
                Check Invitations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaigns;