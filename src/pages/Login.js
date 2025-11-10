import React, { useState } from 'react';
import { supabase } from '../config/supabase';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Users, Sparkles } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user is a creator/influencer
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', data.user.id)
        .single();

      if (profile?.user_type !== 'influencer') {
        setError('This portal is only for creator accounts. Brands should use the brand portal.');
        await supabase.auth.signOut();
        return;
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <Sparkles size={32} className="logo-icon" />
            <h1>Brandible</h1>
          </div>
          <p>Creator Portal</p>
          <div className="portal-info">
            <Users size={16} />
            <span>Connect with brands, earn rewards</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
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

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                id="password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
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

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Don't have an account? <Link to="/signup">Join as Creator</Link></p>
          <div className="portal-links">
            <a href="/brand-portal" target="_blank" rel="noopener noreferrer">
              Brand Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;