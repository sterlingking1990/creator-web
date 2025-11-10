import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { 
  Mail, 
  Star, 
  User,
  CheckCircle,
  XCircle,
  RefreshCw,
  Target,
  FileText,
  DollarSign
} from 'lucide-react';
import './Invitations.css';

const Invitations = ({ user }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingInvite, setProcessingInvite] = useState(null);

  useEffect(() => {
    if (user) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    setLoading(true);
    try {
      if (!user) throw new Error('User not found');

      // Ported from mobile: fetch pending invitations
      const { data, error } = await supabase
        .from('private_campaign_invites')
        .select(`
          id,
          status,
          status_post:status_post_id (*, brand:brand_id (company_name, avatar_url))
        `)
        .eq('influencer_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);

    } catch (error) {
      console.error('Fetch invites error:', error);
      // Could add toast notification here
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (inviteId, newStatus) => {
    setProcessingInvite(inviteId);
    try {
      const invite = invites.find(inv => inv.id === inviteId);
      
      if (newStatus === 'declined') {
        // Call RPC to reject invite and release escrow (same as mobile)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('reject_private_invite_release_escrow', {
          p_invite_id: inviteId
        });

        if (rpcError) throw rpcError;
        if (!rpcResult.success) throw new Error(rpcResult.message || 'Failed to reject invite and release funds.');

        alert(`Invitation ${newStatus} and funds released.`);
      } else { // newStatus === 'accepted'
        const { error } = await supabase
          .from('private_campaign_invites')
          .update({ status: newStatus })
          .eq('id', inviteId);

        if (error) throw error;
        alert(`Invitation ${newStatus}.`);
      }

      // Remove the handled invite from the list
      setInvites(currentInvites => currentInvites.filter(inv => inv.id !== inviteId));

    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred.';
      alert(`Failed to ${newStatus} invitation: ${errorMessage}`);
      console.error('Handle response error:', error);
    } finally {
      setProcessingInvite(null);
    }
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

  return (
    <div className="invitations-page">
      <div className="invitations-header">
        <div className="header-content">
          <h1>Campaign Invitations</h1>
          <p>Review and respond to brand collaboration requests</p>
        </div>
        <button 
          onClick={fetchInvites} 
          className="refresh-btn"
          disabled={loading}
        >
          <RefreshCw size={20} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      <div className="invitations-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your invitations...</p>
          </div>
        ) : invites.length > 0 ? (
          <div className="invitations-list">
            {invites.map((invite) => (
              <div key={invite.id} className="invitation-card">
                <div className="invitation-header">
                  <div className="invitation-title-section">
                    <h3 className="invitation-title">{invite.status_post.title}</h3>
                    <span 
                      className="type-badge"
                      style={getCampaignTypeBadge(invite.status_post.type)}
                    >
                      {getCampaignTypeIcon(invite.status_post.type)}
                      {invite.status_post.type}
                    </span>
                  </div>
                </div>

                <div className="invitation-brand">
                  <div className="brand-info">
                    {invite.status_post.brand?.avatar_url ? (
                      <img 
                        src={invite.status_post.brand.avatar_url} 
                        alt={invite.status_post.brand.company_name}
                        className="brand-avatar"
                      />
                    ) : (
                      <div className="brand-avatar-placeholder">
                        <User size={20} />
                      </div>
                    )}
                    <span className="brand-name">From: {invite.status_post.brand?.company_name}</span>
                  </div>
                </div>

                <div className="rate-info">
                  <Star size={16} className="rate-icon" />
                  <span className="rate-text">Your Rate: {user?.private_campaign_rate || 'N/A'} Coins</span>
                </div>

                <p className="invitation-description">{invite.status_post.description}</p>

                <div className="invitation-actions">
                  <button 
                    className="action-btn decline-btn"
                    onClick={() => handleResponse(invite.id, 'declined')}
                    disabled={processingInvite === invite.id}
                  >
                    <XCircle size={18} />
                    {processingInvite === invite.id ? 'Processing...' : 'Decline'}
                  </button>
                  <button 
                    className="action-btn accept-btn"
                    onClick={() => handleResponse(invite.id, 'accepted')}
                    disabled={processingInvite === invite.id}
                  >
                    <CheckCircle size={18} />
                    {processingInvite === invite.id ? 'Processing...' : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Mail size={64} className="empty-icon" />
            <h2>No Pending Invitations</h2>
            <p>When brands invite you to private campaigns, they will appear here.</p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={() => window.location.href = '/campaigns'}>
                View My Campaigns
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Invitations;