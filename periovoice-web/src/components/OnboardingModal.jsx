import React, { useState } from 'react';
import { Mic, Camera, FileCheck, ArrowRight, Check, ShieldCheck, MessageSquare } from './Icons';

export default function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);

  const slides = [
    {
      icon: MessageSquare,
      iconColor: '#06b6d4',
      title: "Welcome to PerioVoice AI™",
      description: "Your intelligent dental health assistant. PerioVoice AI uses advanced clinical algorithms to assess your gum and tooth symptoms and recommend the right level of care — all from the comfort of your home."
    },
    {
      icon: Mic,
      iconColor: '#8b5cf6',
      title: "Three Ways to Describe Symptoms",
      description: "Type your symptoms in natural language, speak them using the microphone button, or upload a photo of your teeth and gums. All three methods work together to build a complete picture of your dental health."
    },
    {
      icon: FileCheck,
      iconColor: '#10b981',
      title: "Instant Assessment Reports",
      description: "After a short, friendly conversation, you'll receive a personalized risk score (1–10), urgency level, home care recommendations, and a downloadable PDF report you can share with your dentist."
    },
    {
      icon: ShieldCheck,
      iconColor: '#f59e0b',
      title: "Important Disclaimer",
      description: "PerioVoice AI is an educational tool designed to help you understand your symptoms — it is not a substitute for professional dental diagnosis or treatment. Always consult a licensed dentist for clinical evaluation and care."
    }
  ];

  const CurrentIcon = slides[step].icon;

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('periovoice_onboarded', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('periovoice_onboarded', 'true');
    onComplete();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ textAlign: 'center', padding: '36px 28px', maxWidth: '420px' }}>
        {/* Icon */}
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '22px',
          background: `linear-gradient(135deg, ${slides[step].iconColor}, ${slides[step].iconColor}88)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 22px auto',
          boxShadow: `0 10px 28px ${slides[step].iconColor}33`,
          transition: 'all 0.4s ease'
        }}>
          <CurrentIcon size={32} color="white" />
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
          {slides[step].title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          lineHeight: '1.65',
          marginBottom: '28px',
          minHeight: '80px'
        }}>
          {slides[step].description}
        </p>

        {/* Slide Indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? '28px' : '8px',
                height: '8px',
                borderRadius: '999px',
                background: i === step ? slides[step].iconColor : 'var(--border-glass)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {step < slides.length - 1 && (
            <button
              onClick={handleSkip}
              style={{
                flex: 1,
                padding: '13px',
                fontSize: '0.9rem',
                background: 'transparent',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            className="primary-btn"
            style={{
              flex: step === slides.length - 1 ? 1 : 2,
              padding: '13px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {step === slides.length - 1 ? (
              <>I Understand — Get Started <Check size={18} /></>
            ) : (
              <>Continue <ArrowRight size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
