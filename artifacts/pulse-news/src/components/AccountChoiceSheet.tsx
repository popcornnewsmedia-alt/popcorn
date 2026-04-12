import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GrainBackground } from "@/components/GrainBackground";

interface AccountChoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateManually: () => void;
}

export function AccountChoiceSheet({ isOpen, onClose, onCreateManually }: AccountChoiceSheetProps) {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    onClose();
  };

  const handleManual = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    onClose();
    onCreateManually();
  };

  const handleGoogle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message ?? "Google sign in failed.");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[220] transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.65)', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[220] flex flex-col overflow-hidden mx-auto"
        style={{
          maxWidth: '480px',
          background: '#053980',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={stopProp}
      >
        <GrainBackground />

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,241,205,0.30)' }} />
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 z-20 p-2 rounded-full transition-opacity hover:opacity-60 active:opacity-50"
          style={{ background: 'rgba(255,241,205,0.10)' }}
        >
          <X className="w-4 h-4" style={{ color: 'rgba(255,241,205,0.65)' }} />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col px-6 pt-7 pb-10 gap-4">
          <h2 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '15px', color: '#fff1cd', lineHeight: 1, letterSpacing: '0.02em', marginBottom: '4px' }}>
            CREATE YOUR ACCOUNT.
          </h2>

          {/* Create account manually */}
          <button
            onClick={handleManual}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: '14px',
              letterSpacing: '0.08em',
              background: '#fff1cd',
              color: '#053980',
            }}
          >
            Create Account
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,241,205,0.12)' }} />
            <span className="font-['Inter']" style={{ fontSize: '11px', color: 'rgba(255,241,205,0.25)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,241,205,0.12)' }} />
          </div>

          {/* Continue with Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-['Inter'] font-semibold transition-opacity hover:opacity-80 active:opacity-60"
            style={{ background: 'rgba(255,241,205,0.07)', fontSize: '14px', color: '#fff1cd', border: '1px solid rgba(255,241,205,0.13)' }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {error && (
            <p className="font-['Inter'] text-center" style={{ fontSize: '13px', color: '#ff8a80' }}>{error}</p>
          )}
        </div>
      </div>
    </>
  );
}
