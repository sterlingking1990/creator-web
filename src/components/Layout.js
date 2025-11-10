import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { 
  Home, 
  Megaphone, 
  Mail, 
  Wallet, 
  User, 
  LogOut, 
  Menu,
  X,
  Sparkles,
  Bell
} from 'lucide-react';
import './Layout.css';

const Layout = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/campaigns', icon: Megaphone, label: 'Campaigns' },
    { path: '/invitations', icon: Mail, label: 'Invitations' },
    { path: '/wallet', icon: Wallet, label: 'Wallet' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="layout">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="logo">
              <Sparkles size={24} />
              <span>Brandible</span>
              <span className="portal-badge">Creator</span>
            </Link>
          </div>

          <div className="header-center">
            <nav className="desktop-nav">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="header-right">
            <button className="notification-btn">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>
            
            <div className="user-menu">
              <img 
                src={user?.avatar_url || '/placeholder-avatar.png'} 
                alt="Profile"
                className="user-avatar"
              />
              <div className="user-info">
                <span className="user-name">{user?.full_name}</span>
                <span className="user-handle">@{user?.handle}</span>
              </div>
              <button onClick={handleLogout} className="logout-btn">
                <LogOut size={18} />
              </button>
            </div>

            <button 
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="mobile-menu">
            <nav className="mobile-nav">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              ))}
              <button onClick={handleLogout} className="mobile-logout-btn">
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;