import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { 
  User, 
  Edit3, 
  Save, 
  X, 
  Camera, 
  MapPin, 
  Phone, 
  Mail,
  Star,
  DollarSign,
  Share2,
  LogOut,
  RefreshCw,
  Award
} from 'lucide-react';
import './Profile.css';

const Profile = ({ user, setUser }) => {
  const [profileUser, setProfileUser] = useState(user);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    location: '',
    phone: '',
  });
  const [privateRate, setPrivateRate] = useState('');
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user?.id]); // Only re-run when user ID changes, not the entire user object

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;

        if (profile) {
          setProfileUser(profile);
          // Don't update the parent user object to avoid infinite loop
          setFormData({
            full_name: profile.full_name || '',
            username: profile.username || '',
            bio: profile.bio || '',
            location: profile.location || '',
            phone: profile.phone || '',
          });
          setPrivateRate(profile.private_campaign_rate?.toString() || '');

          // Check for pro status (featured submissions)
          const { count: featuredCount, error: countError } = await supabase
            .from('challenge_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('participant_id', authUser.id)
            .eq('is_featured', true);

          if (countError) throw countError;
          setIsPro(featuredCount > 0);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setUpdating(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('User not found');

      // Prepare update data
      const updateData = {
        ...formData,
        private_campaign_rate: privateRate ? parseInt(privateRate) : null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', authUser.id);

      if (error) throw error;

      // Fetch updated profile
      await fetchUserProfile();
      setEditing(false);
      alert('Profile updated successfully!');

    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: profileUser?.full_name || '',
      username: profileUser?.username || '',
      bio: profileUser?.bio || '',
      location: profileUser?.location || '',
      phone: profileUser?.phone || '',
    });
    setPrivateRate(profileUser?.private_campaign_rate?.toString() || '');
    setEditing(false);
  };

  const handleShare = async () => {
    const shareText = `Check out my creator profile on Brandible! @${profileUser?.username || 'creator'}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Brandible Profile',
          text: shareText,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(shareText + ' - ' + window.location.href);
      alert('Profile link copied to clipboard!');
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await supabase.auth.signOut();
      // Navigation will be handled by App.js auth state change
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-header-content">
          <h1>My Profile</h1>
          <div className="profile-actions">
            <button 
              onClick={fetchUserProfile} 
              className="refresh-btn"
              disabled={loading}
            >
              <RefreshCw size={20} className={loading ? 'spinning' : ''} />
            </button>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="edit-btn">
                <Edit3 size={20} />
                Edit Profile
              </button>
            ) : (
              <div className="edit-actions">
                <button onClick={handleCancel} className="cancel-btn">
                  <X size={20} />
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  className="save-btn"
                  disabled={updating}
                >
                  <Save size={20} />
                  {updating ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="profile-content">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="avatar-section">
            <div className="avatar-container">
              {profileUser?.avatar_url ? (
                <img 
                  src={profileUser.avatar_url} 
                  alt="Profile"
                  className="avatar"
                />
              ) : (
                <div className="avatar-placeholder">
                  <User size={40} />
                </div>
              )}
              {editing && (
                <button className="change-avatar-btn" title="Change avatar">
                  <Camera size={16} />
                </button>
              )}
            </div>
            
            <div className="profile-status">
              {isPro ? (
                <div className="pro-badge">
                  <Award size={16} />
                  Pro Creator
                </div>
              ) : (
                <div className="regular-badge">
                  <Star size={16} />
                  Creator
                </div>
              )}
            </div>
          </div>

          <div className="profile-info">
            {editing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>

                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows="4"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="Your location"
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Your phone number"
                    />
                  </div>
                </div>

                {isPro && (
                  <div className="form-group">
                    <label>
                      Private Campaign Rate (coins)
                      <span className="pro-feature">Pro Feature</span>
                    </label>
                    <input
                      type="number"
                      value={privateRate}
                      onChange={(e) => setPrivateRate(e.target.value)}
                      placeholder="Enter your rate"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="profile-display">
                <div className="name-section">
                  <h2>{profileUser?.full_name || 'Unknown User'}</h2>
                  <p className="username">@{profileUser?.username || 'username'}</p>
                </div>

                {profileUser?.bio && (
                  <div className="bio-section">
                    <p>{profileUser.bio}</p>
                  </div>
                )}

                <div className="info-grid">
                  {profileUser?.location && (
                    <div className="info-item">
                      <MapPin size={16} />
                      <span>{profileUser.location}</span>
                    </div>
                  )}
                  
                  {profileUser?.phone && (
                    <div className="info-item">
                      <Phone size={16} />
                      <span>{profileUser.phone}</span>
                    </div>
                  )}

                  <div className="info-item">
                    <Mail size={16} />
                    <span>{profileUser?.email || 'Email not provided'}</span>
                  </div>

                  {isPro && profileUser?.private_campaign_rate && (
                    <div className="info-item rate-info">
                      <DollarSign size={16} />
                      <span>{profileUser.private_campaign_rate} coins/campaign</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Card */}
        <div className="stats-card">
          <h3>Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{profileUser?.coin_balance || 0}</div>
              <div className="stat-label">Coins Balance</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{profileUser?.total_earned || 0}</div>
              <div className="stat-label">Total Earned</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">0</div>
              <div className="stat-label">Campaigns</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{isPro ? 'Pro' : 'Regular'}</div>
              <div className="stat-label">Status</div>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="actions-card">
          <h3>Account Actions</h3>
          <div className="action-buttons">
            <button onClick={handleShare} className="action-button share-btn">
              <Share2 size={20} />
              Share Profile
            </button>
            <button onClick={handleLogout} className="action-button logout-btn">
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;