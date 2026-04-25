import { useState, useRef } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';

const retellWebClient = new RetellWebClient();

const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  ACTIVE: 'active',
  ENDED: 'ended',
  ERROR: 'error',
};

export default function App() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const listenersAttached = useRef(false);
  const pollRef = useRef(null);

  const startCall = async () => {
    if (!name.trim() || !phone.trim()) return;
    setStatus(STATUS.CONNECTING);
    setErrorMsg('');

    try {
      const res = await fetch('/api/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.');
        setStatus(STATUS.ERROR);
        return;
      }

      if (!listenersAttached.current) {
        retellWebClient.on('call_started', () => setStatus(STATUS.ACTIVE));
        retellWebClient.on('call_ended', () => {
          clearInterval(pollRef.current);
          setStatus(STATUS.ENDED);
        });
        retellWebClient.on('error', (err) => {
          console.error('Retell error:', err);
          clearInterval(pollRef.current);
          setErrorMsg('Call error. Please try again.');
          setStatus(STATUS.ERROR);
        });
        listenersAttached.current = true;
      }

      await retellWebClient.startCall({ accessToken: data.accessToken });

      // Poll as fallback in case call_ended doesn't fire when Retell ends the call
      pollRef.current = setInterval(() => {
        if (!retellWebClient.connected) {
          clearInterval(pollRef.current);
          setStatus((prev) =>
            prev === STATUS.ACTIVE || prev === STATUS.CONNECTING ? STATUS.ENDED : prev
          );
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Please try again.');
      setStatus(STATUS.ERROR);
    }
  };

  const endCall = () => {
    clearInterval(pollRef.current);
    retellWebClient.stopCall();
  };

  const reset = () => {
    setStatus(STATUS.IDLE);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
              <PhoneIcon className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Try Your AI Assistant</h1>
            <p className="text-sm text-white/40 mt-1.5 leading-relaxed">
              Enter your name and number, then call as if you were one of your customers.
            </p>
          </div>

          {/* IDLE: form */}
          {status === STATUS.IDLE && (
            <form onSubmit={(e) => { e.preventDefault(); startCall(); }} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-white/40 mb-1.5 uppercase tracking-widest">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cam"
                  autoComplete="name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all text-sm"
                  required
                />
                <p className="text-[11px] text-white/25 mt-1.5">The AI will answer as your assistant</p>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-white/40 mb-1.5 uppercase tracking-widest">
                  Your Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  autoComplete="tel"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all text-sm"
                  required
                />
                <p className="text-[11px] text-white/25 mt-1.5">We'll send you a follow-up SMS after the call</p>
              </div>
              <button
                type="submit"
                disabled={!name.trim() || !phone.trim()}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all duration-150 flex items-center justify-center gap-2 text-sm"
              >
                <PhoneCallIcon className="w-4 h-4" />
                Test Your AI Assistant
              </button>
            </form>
          )}

          {/* CONNECTING */}
          {status === STATUS.CONNECTING && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-blue-500/20 mb-5">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-white/60 text-sm">Connecting your call…</p>
            </div>
          )}

          {/* ACTIVE */}
          {status === STATUS.ACTIVE && (
            <div className="text-center py-10">
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/25 mb-5">
                <span className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
                <PhoneIcon className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-white font-medium mb-1">Call in Progress</p>
              <p className="text-white/35 text-sm mb-7">Speak now — the AI is listening</p>
              <button
                onClick={endCall}
                className="bg-red-600/80 hover:bg-red-500 active:scale-[0.98] text-white font-medium py-3 px-8 rounded-lg transition-all duration-150 inline-flex items-center gap-2 text-sm"
              >
                <PhoneEndIcon className="w-4 h-4" />
                End Call
              </button>
            </div>
          )}

          {/* ENDED */}
          {status === STATUS.ENDED && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/10 mb-5">
                <CheckIcon className="w-6 h-6 text-white/40" />
              </div>
              <p className="text-white font-medium mb-1">Call Ended</p>
              <p className="text-white/35 text-sm mb-7">Thanks for trying our AI assistant!</p>
              <button onClick={reset} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                Start another call →
              </button>
            </div>
          )}

          {/* ERROR */}
          {status === STATUS.ERROR && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mb-5">
                <ErrorIcon className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-white font-medium mb-1">Something went wrong</p>
              <p className="text-white/35 text-sm mb-7">{errorMsg}</p>
              <button onClick={reset} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                Try again →
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-white/15 text-xs mt-5">
          Powered by AI · Demo purposes only
        </p>
      </div>
    </div>
  );
}

function PhoneIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function PhoneCallIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function PhoneEndIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.055.902-.417 1.173l-1.293.97c-.376.282-.542.769-.38 1.21a12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293c.271-.363.734-.527 1.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ErrorIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}
