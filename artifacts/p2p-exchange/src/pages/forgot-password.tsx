import { useState } from 'react';
import { useLocation } from 'wouter';

type Step = 'identifier' | 'otp' | 'newPassword' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [, navigate] = useLocation();

  const handleSendOTP = async () => {
    if (!identifier.trim()) {
      setError('Please enter your email or phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      if (data.devOtp) setDevOtp(data.devOtp);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setStep('newPassword');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid #334455',
    borderRadius: '12px',
    padding: '14px 16px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Poppins',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    height: '50px',
    background: '#00e5ff',
    border: 'none',
    borderRadius: '25px',
    color: '#080d18',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Poppins',
  };

  return (
    <div style={{
      background: '#080d18',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Poppins',
    }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
          xen<span style={{ color: '#00e5ff' }}>drx</span>
        </div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: '#0c1420',
        borderRadius: '20px',
        padding: '28px 24px',
        border: '1px solid rgba(0,229,255,0.15)',
      }}>

        {step === 'identifier' && (
          <>
            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '6px', marginTop: 0 }}>
              Forgot Password?
            </h2>
            <p style={{ color: '#8899aa', fontSize: '13px', marginBottom: '24px' }}>
              Enter your email or phone number and we'll send you a reset code.
            </p>

            {error && (
              <div style={{
                background: 'rgba(255,68,68,0.1)',
                border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#ff4444',
                fontSize: '12px',
              }}>❌ {error}</div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#8899aa', fontSize: '11px', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                EMAIL OR PHONE
              </label>
              <input
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                placeholder="Enter email or phone number"
                style={inputStyle}
                autoFocus
              />
            </div>

            <button onClick={handleSendOTP} disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button onClick={() => navigate('/auth')} style={{ background: 'none', border: 'none', color: '#00e5ff', fontSize: '13px', cursor: 'pointer' }}>
                ← Back to Login
              </button>
            </div>
          </>
        )}

        {step === 'otp' && (
          <>
            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '6px', marginTop: 0 }}>
              Enter Reset Code
            </h2>
            <p style={{ color: '#8899aa', fontSize: '13px', marginBottom: '24px' }}>
              A 6-digit code was sent to <strong style={{ color: '#fff' }}>{identifier}</strong>
            </p>

            {devOtp && (
              <div style={{
                background: 'rgba(255,170,0,0.1)',
                border: '1px solid rgba(255,170,0,0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '12px',
                color: '#ffaa00',
                fontSize: '12px',
              }}>
                🔧 Dev mode — your OTP is: <strong>{devOtp}</strong>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(255,68,68,0.1)',
                border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#ff4444',
                fontSize: '12px',
              }}>❌ {error}</div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#8899aa', fontSize: '11px', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                6-DIGIT CODE
              </label>
              <input
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                placeholder="000000"
                maxLength={6}
                style={{ ...inputStyle, fontSize: '24px', letterSpacing: '8px', textAlign: 'center', fontWeight: 700 }}
                autoFocus
              />
            </div>

            <button onClick={handleVerifyOTP} disabled={loading || otp.length !== 6} style={{ ...btnStyle, opacity: otp.length !== 6 ? 0.5 : 1 }}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => { setStep('identifier'); setError(''); }} style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: '12px', cursor: 'pointer' }}>
                ← Change email/phone
              </button>
              <button onClick={handleSendOTP} style={{ background: 'none', border: 'none', color: '#00e5ff', fontSize: '12px', cursor: 'pointer' }}>
                Resend code
              </button>
            </div>
          </>
        )}

        {step === 'newPassword' && (
          <>
            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '6px', marginTop: 0 }}>
              Set New Password
            </h2>
            <p style={{ color: '#8899aa', fontSize: '13px', marginBottom: '24px' }}>
              Create a strong password for your account.
            </p>

            {error && (
              <div style={{
                background: 'rgba(255,68,68,0.1)',
                border: '1px solid rgba(255,68,68,0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#ff4444',
                fontSize: '12px',
              }}>❌ {error}</div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#8899aa', fontSize: '11px', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                NEW PASSWORD
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={inputStyle}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#8899aa', fontSize: '11px', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                placeholder="Repeat your password"
                style={{
                  ...inputStyle,
                  borderColor: confirmPassword && confirmPassword !== newPassword ? '#ff4444' : '#334455',
                }}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <div style={{ color: '#ff4444', fontSize: '11px', marginTop: '4px' }}>
                  Passwords do not match
                </div>
              )}
            </div>

            {newPassword && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[
                    newPassword.length >= 8,
                    /[A-Z]/.test(newPassword),
                    /[0-9]/.test(newPassword),
                    /[^A-Za-z0-9]/.test(newPassword),
                  ].map((met, i) => (
                    <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: met ? '#00e5ff' : '#334455' }} />
                  ))}
                </div>
                <div style={{ color: '#8899aa', fontSize: '10px' }}>
                  Use 8+ chars, uppercase, number, and symbol for strong password
                </div>
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              style={{ ...btnStyle, opacity: newPassword.length >= 8 && newPassword === confirmPassword ? 1 : 0.5 }}
            >
              {loading ? 'Saving...' : 'Reset Password'}
            </button>
          </>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              Password Reset!
            </h2>
            <p style={{ color: '#8899aa', fontSize: '13px', marginBottom: '24px' }}>
              Your password has been updated successfully.
            </p>
            <button onClick={() => navigate('/auth')} style={btnStyle}>
              Login Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
