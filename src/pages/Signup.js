import React, { useState } from 'react';
import { supabase } from '../config/supabase';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, Users } from 'lucide-react';
import './Signup.css';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            user_type: 'influencer',
            full_name: fullName,
            handle: handle,
            bio: bio,
          },
        },
      });

      console.log('🟡 Supabase response:', { data, error });

      if (error) {
        console.error('🔴 Signup error:', error);
        throw error;
      }

      setMessage('Signup successful! Please check your email to confirm your account.');

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (!fullName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (!handle.trim()) {
      setError('Handle is required');
      return false;
    }
    return true;
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <div className="logo">
            <Sparkles size={32} className="logo-icon" />
            <h1>Brandible</h1>
          </div>
          <p>Join as a Creator</p>
          <div className="portal-info">
            <Users size={16} />
            <span>Connect with brands and monetize your influence</span>
          </div>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          if (validateForm()) {
            await handleSignup();
          }
        }} className="signup-form">
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Your full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="handle">Handle</label>
              <input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                required
                placeholder="your_handle"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-container">
                <input
                  id="password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="password-toggle-button"
                >
                  {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-container">
                <input
                  id="confirmPassword"
                  type={isConfirmPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                  className="password-toggle-button"
                >
                  {isConfirmPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio (Optional)</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself and your content..."
              rows="3"
            />
          </div>

          <button 
            type="submit" 
            className="signup-button"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="signup-footer">
          <p>Already have an account? <Link to="/login">Sign In</Link></p>
          <div className="portal-links">
            <a href="/brand-portal" target="_blank" rel="noopener noreferrer">
              Are you a brand?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;