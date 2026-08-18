import React from 'react';
import { Shield, Info, Smartphone, QrCode, Database, CheckCircle2, Award, Cpu, Zap, Users } from 'lucide-react';

export default function AboutUs() {
  return (
    <div className="about-page-layout">
      {/* Top Banner & Seal */}
      <div className="about-hero-card">
        <div className="about-seal-wrapper">
          <img
            src="./rotc-seal-transparent.png"
            alt="CSU ROTC Official Seal"
            className="about-seal-img"
          />
        </div>
        <div className="about-hero-titles">
          <span className="about-echelon-tag">ARESCOM • 15th RCDG • 1501st CDC</span>
          <h1 className="about-unit-title">Caraga State University</h1>
          <h2 className="about-unit-subtitle">ROTC Unit Attendance System</h2>
          <div className="about-version-badge">
            <span className="version-dot"></span>
            <span>Field Scanner Edition • v2.4.0 (Offline)</span>
          </div>
        </div>
      </div>

      {/* Purpose & Mission Card */}
      <div className="about-card">
        <div className="about-card-header">
          <Shield size={18} className="text-gold" />
          <h3>System Overview & Purpose</h3>
        </div>
        <p className="about-card-text">
          The <strong>CSU ROTC Unit Scanner</strong> is a specialized offline mobile attendance application engineered for Duty Officers, Battalions, and Company Commanders. It enables rapid in-the-field cadet check-ins without requiring internet, cellular data, or local area network connections during drill formations.
        </p>
      </div>

      {/* Quick Field Operations Guide */}
      <div className="about-card">
        <div className="about-card-header">
          <Zap size={18} className="text-gold" />
          <h3>Quick Field Usage Guide</h3>
        </div>
        <div className="about-guide-list">
          <div className="guide-item">
            <div className="guide-num">1</div>
            <div className="guide-content">
              <strong>Configure Session Echelon</strong>
              <p>Navigate to Settings to select Battalion, Company, and Platoon, and choose <em>Time-In</em> or <em>Time-Out</em>.</p>
            </div>
          </div>

          <div className="guide-item">
            <div className="guide-num">2</div>
            <div className="guide-content">
              <strong>Scan Cadet QR Cards</strong>
              <p>Aim camera at cadet QR codes. Real-time duplicate protection prevents multiple check-ins in the same session.</p>
            </div>
          </div>

          <div className="guide-item">
            <div className="guide-num">3</div>
            <div className="guide-content">
              <strong>Batch Sync to Admin Dashboard</strong>
              <p>Tap <strong>Batch Sync</strong> to display animated sync QR codes. Scan them with the Laptop Admin webcam to instantly import all logs.</p>
            </div>
          </div>

          <div className="guide-item">
            <div className="guide-num">4</div>
            <div className="guide-content">
              <strong>100% Offline Autonomy</strong>
              <p>All scans are safely stored in device IndexedDB storage and survive browser restarts or battery reboots.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specifications */}
      <div className="about-card">
        <div className="about-card-header">
          <Cpu size={18} className="text-gold" />
          <h3>Technical Architecture</h3>
        </div>
        <div className="tech-specs-grid">
          <div className="spec-box">
            <Database size={16} className="spec-icon" />
            <div className="spec-label">Storage Engine</div>
            <div className="spec-value">IndexedDB + LocalStorage</div>
          </div>
          <div className="spec-box">
            <QrCode size={16} className="spec-icon" />
            <div className="spec-label">Sync Protocol</div>
            <div className="spec-value">Optical QR Burst Matrix</div>
          </div>
          <div className="spec-box">
            <Smartphone size={16} className="spec-icon" />
            <div className="spec-label">Platform</div>
            <div className="spec-value">PWA Offline WebApp</div>
          </div>
          <div className="spec-box">
            <Award size={16} className="spec-icon" />
            <div className="spec-label">Target Unit</div>
            <div className="spec-value">1501st CDC CSU ROTC</div>
          </div>
        </div>
      </div>

      {/* Command & Developer Credits */}
      <div className="about-card">
        <div className="about-card-header">
          <Users size={18} className="text-gold" />
          <h3>Command & Development Credits</h3>
        </div>
        <div className="credits-body">
          <div className="credit-row">
            <span className="credit-role">Commanding Unit:</span>
            <span className="credit-name">Caraga State University ROTC Unit • 1501st Community Defense Center (CDC) • 15th RCDG • ARESCOM</span>
          </div>
          <div className="credit-row">
            <span className="credit-role">Host Institution:</span>
            <span className="credit-name">Caraga State University Main Campus • Ampayon, Butuan City</span>
          </div>
          <div className="credit-row">
            <span className="credit-role">Developer:</span>
            <span className="credit-name">CPL Christian B Abamo PA (RES) • Graduate Military Assistant</span>
          </div>
        </div>

        {/* Motto Footer */}
        <div className="about-motto-banner">
          <span>HONOR</span>
          <span className="motto-separator">•</span>
          <span>PATRIOTISM</span>
          <span className="motto-separator">•</span>
          <span>DUTY</span>
        </div>
      </div>
    </div>
  );
}
