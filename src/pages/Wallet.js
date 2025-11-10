import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { 
  Wallet as WalletIcon, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  CreditCard,
  Send,
  ShoppingCart,
  Plus,
  Minus,
  Calendar,
  User
} from 'lucide-react';
import './Wallet.css';

const Wallet = ({ user }) => {
  const [walletUser, setWalletUser] = useState(user);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [selectedCashoutMethod, setSelectedCashoutMethod] = useState(null);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [coinBaseValue, setCoinBaseValue] = useState(0.01);
  const [platformCommission, setPlatformCommission] = useState(0.20);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [estimatedPayout, setEstimatedPayout] = useState(0);

  const cashoutMethods = [
    { 
      id: 'cash', 
      name: 'Bank Transfer', 
      icon: <CreditCard size={24} />, 
      description: 'Transfer to your bank account' 
    },
    { 
      id: 'transfer', 
      name: 'Transfer to Friend', 
      icon: <Send size={24} />, 
      description: 'Send coins to another creator' 
    },
  ];

  useEffect(() => {
    if (user) {
      loadWalletData();
    }
  }, [user]);

  useEffect(() => {
    if (cashoutAmount && exchangeRate) {
      const amount = parseFloat(cashoutAmount);
      if (!isNaN(amount) && amount > 0) {
        const payoutUsd = amount * coinBaseValue * (1 - platformCommission);
        const payoutNgn = payoutUsd * (exchangeRate || 1600); // Default fallback
        setEstimatedPayout(payoutNgn);
      } else {
        setEstimatedPayout(0);
      }
    }
  }, [cashoutAmount, exchangeRate, coinBaseValue, platformCommission]);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUserData(),
        fetchTransactions(),
        fetchFinancialSettings()
      ]);
    } catch (error) {
      console.error('Error loading wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        setWalletUser(profile);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data, error } = await supabase.rpc('get_detailed_transactions', {
          p_user_id: authUser.id
        });

        if (error) throw error;
        setTransactions(data || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchFinancialSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;

      const settings = data.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {});

      setCoinBaseValue(settings.coin_base_value_usd?.value || 0.01);
      setPlatformCommission(settings.platform_commission_percentage?.value || 0.20);
    } catch (error) {
      console.error('Error fetching financial settings:', error);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-exchange-rate');
      if (error) throw error;
      setExchangeRate(data.rate);
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      setExchangeRate(1600); // Fallback rate
    }
  };

  const handleCashout = async () => {
    if (!selectedCashoutMethod || !cashoutAmount) {
      alert('Please fill in all fields');
      return;
    }

    const amount = parseFloat(cashoutAmount);
    if (amount <= 0 || amount > walletUser.coin_balance) {
      alert('Invalid amount');
      return;
    }

    // Bank transfer validation
    if (selectedCashoutMethod.id === 'cash' && (!bankName || !accountName || !accountNumber)) {
      alert('Please fill in all bank details');
      return;
    }

    try {
      let description = '';
      if (selectedCashoutMethod.id === 'cash') {
        description = `Cashout via Bank Transfer: ${bankName}, ${accountName}, ${accountNumber}`;
      } else {
        description = `Cashout via ${selectedCashoutMethod.name}`;
      }

      // Create cashout transaction
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: walletUser.id,
          type: 'spent',
          amount: -amount,
          description: description,
          reference_type: 'cashout',
          status: 'pending'
        });

      if (error) throw error;

      // Update user coin balance
      await supabase
        .from('profiles')
        .update({ coin_balance: walletUser.coin_balance - amount })
        .eq('id', walletUser.id);

      alert('Cashout request submitted! It will be processed within 24-48 hours.');
      setShowCashoutModal(false);
      loadWalletData();
      
      // Reset form
      setCashoutAmount('');
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setSelectedCashoutMethod(null);

    } catch (error) {
      alert('Failed to process cashout request');
      console.error('Cashout error:', error);
    }
  };

  const usdBalance = useMemo(() => {
    if (!walletUser || !coinBaseValue) return 0;
    return (walletUser.coin_balance || 0) * coinBaseValue;
  }, [walletUser, coinBaseValue]);

  const getTransactionIcon = (type) => {
    const earnedTypes = ['earned', 'reward', 'challenge_reward', 'achievement_reward', 'referral_reward'];
    return earnedTypes.includes(type) ? <Plus size={16} /> : <Minus size={16} />;
  };

  const getTransactionColor = (type) => {
    const earnedTypes = ['earned', 'reward', 'challenge_reward', 'achievement_reward', 'referral_reward'];
    return earnedTypes.includes(type) ? '#10b981' : '#ef4444';
  };

  if (loading) {
    return (
      <div className="wallet-loading">
        <div className="loading-spinner"></div>
        <p>Loading your wallet...</p>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      {/* Wallet Header */}
      <div className="wallet-header">
        <div className="wallet-header-content">
          <h1>My Wallet</h1>
          <button 
            onClick={loadWalletData} 
            className="refresh-btn"
            disabled={loading}
          >
            <RefreshCw size={20} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
        </div>

        <div className="balance-card">
          <div className="balance-icon">
            <WalletIcon size={32} />
          </div>
          <div className="balance-info">
            <div className="balance-amount">{walletUser?.coin_balance || 0}</div>
            <div className="balance-label">Brandible Coins</div>
            <div className="usd-balance">≈ ${usdBalance.toFixed(2)} USD</div>
          </div>
        </div>

        <div className="total-earned">
          Total Earned: {walletUser?.total_earned || 0} coins
        </div>
      </div>

      {/* Action Buttons */}
      <div className="wallet-actions">
        <button 
          className="action-btn cashout-btn"
          onClick={() => {
            fetchExchangeRate();
            setShowCashoutModal(true);
          }}
        >
          <DollarSign size={20} />
          Cash Out
        </button>
        <button 
          className="action-btn shop-btn"
          onClick={() => window.location.href = '/shop'}
        >
          <ShoppingCart size={20} />
          Shop
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="transactions-section">
        <div className="section-header">
          <h2>Recent Transactions</h2>
        </div>
        
        {transactions.length === 0 ? (
          <div className="empty-state">
            <TrendingUp size={48} />
            <h3>No transactions yet</h3>
            <p>Your transaction history will appear here as you earn and spend coins</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div 
                  className="transaction-icon"
                  style={{ color: getTransactionColor(transaction.type) }}
                >
                  {getTransactionIcon(transaction.type)}
                </div>
                <div className="transaction-details">
                  <div className="transaction-description">
                    {transaction.brand_name 
                      ? `${transaction.description} from ${transaction.brand_name}`
                      : transaction.description
                    }
                  </div>
                  <div className="transaction-meta">
                    {transaction.campaign_title && (
                      <span className="campaign-title">Campaign: "{transaction.campaign_title}"</span>
                    )}
                    <span className="transaction-date">
                      <Calendar size={12} />
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div 
                  className="transaction-amount"
                  style={{ color: getTransactionColor(transaction.type) }}
                >
                  {getTransactionColor(transaction.type) === '#10b981' ? '+' : ''}{transaction.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cashout Modal */}
      {showCashoutModal && (
        <div className="modal-overlay" onClick={() => setShowCashoutModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cash Out</h3>
              <button onClick={() => setShowCashoutModal(false)} className="close-btn">×</button>
            </div>
            
            <div className="modal-body">
              <div className="cashout-methods">
                <h4>Choose cashout method:</h4>
                {cashoutMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`cashout-method ${selectedCashoutMethod?.id === method.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCashoutMethod(method)}
                  >
                    <div className="method-icon">{method.icon}</div>
                    <div className="method-info">
                      <div className="method-name">{method.name}</div>
                      <div className="method-description">{method.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedCashoutMethod?.id === 'cash' && (
                <div className="cashout-form">
                  <div className="form-group">
                    <label>Amount to Cash Out (coins)</label>
                    <input
                      type="number"
                      value={cashoutAmount}
                      onChange={(e) => setCashoutAmount(e.target.value)}
                      placeholder="e.g., 1000"
                      max={walletUser?.coin_balance || 0}
                    />
                  </div>

                  {estimatedPayout > 0 && (
                    <div className="payout-estimate">
                      You will receive approximately: <strong>₦{estimatedPayout.toFixed(2)}</strong>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Enter bank name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Account Holder Name</label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Enter account holder name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Enter account number"
                    />
                  </div>

                  <button onClick={handleCashout} className="submit-btn">
                    Submit Cashout Request
                  </button>
                </div>
              )}

              {selectedCashoutMethod?.id === 'transfer' && (
                <div className="coming-soon">
                  <p>Transfer to friend feature coming soon!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;