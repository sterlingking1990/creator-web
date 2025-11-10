import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './config/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Invitations from './pages/Invitations';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Check if user is a creator/influencer
      if (data?.user_type !== 'influencer') {
        console.error('Access denied: This portal is for creators only');
        await supabase.auth.signOut();
        return;
      }

      setUser(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/campaigns" element={<Campaigns user={user} />} />
          <Route path="/invitations" element={<Invitations user={user} />} />
          <Route path="/wallet" element={<Wallet user={user} />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;