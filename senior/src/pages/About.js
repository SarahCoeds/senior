import React from "react";
import "../style/About.css";

const About = () => {
  return (
    <section className="about-section">
      {/* Ambient background */}
      <div className="about-bg" aria-hidden="true">
        <div className="about-glow about-glow-1" />
        <div className="about-glow about-glow-2" />
        <div className="about-grid" />
      </div>

      <div className="about-container">
        <header className="about-hero">
          <div className="about-badge">About</div>
          <h1 className="about-title">Kindred PCs</h1>
          <p className="about-subtitle">
            We make PC building feel less like guesswork and more like a guided experience fast,
            confident, and tailored to your needs.
          </p>

          <div className="about-hero-cards">
            <div className="about-mini-card">
              <div className="about-mini-label">Focus</div>
              <div className="about-mini-value">Compatibility & Clarity</div>
            </div>
            <div className="about-mini-card">
              <div className="about-mini-label">Built for</div>
              <div className="about-mini-value">Gamers, creators, students</div>
            </div>
            <div className="about-mini-card">
              <div className="about-mini-label">Experience</div>
              <div className="about-mini-value">AI + Human-friendly UX</div>
            </div>
          </div>
        </header>

        <div className="about-content">
          <div className="about-card about-card-accent-1">
            <h2 className="about-card-title">Our Mission</h2>
            <p className="about-card-text">
              To make custom PC building accessible to everyone by removing compatibility anxiety,
              simplifying decisions, and helping users build the right machine for their goals and budget.
            </p>
            <div className="about-divider" />
            <ul className="about-list">
              <li>Reduce complexity with smart guidance</li>
              <li>Prevent incompatible parts before checkout</li>
              <li>Keep the experience fast, clear, and beginner friendly</li>
            </ul>
          </div>

          <div className="about-card about-card-accent-2">
            <h2 className="about-card-title">Our Vision</h2>
            <p className="about-card-text">
              To become the most trusted platform for building PCs where anyone can confidently create,
              customize, and order a system that fits their workload, style, and future upgrades.
            </p>
            <div className="about-divider" />
            <ul className="about-list">
              <li>A build flow that feels guided, not overwhelming</li>
              <li>Transparent choices with clear trade-offs</li>
              <li>A path from “I’m not sure” to “I’ve got this”</li>
            </ul>
          </div>

          <div className="about-card about-card-wide about-card-accent-3">
            <h2 className="about-card-title">Our Values</h2>
            <p className="about-card-text">
              Everything we build is driven by trust, quality, and a clean experience because buying a PC
              should feel exciting, not stressful.
            </p>

            <div className="about-values-grid">
              <div className="about-value">
                <div className="about-value-title">Quality First</div>
                <div className="about-value-text">
                  Components sourced from trusted brands and evaluated for reliability.
                </div>
              </div>

              <div className="about-value">
                <div className="about-value-title">Compatibility by Design</div>
                <div className="about-value-text">
                  We prioritize builds that work together, upgrade cleanly, and avoid surprises.
                </div>
              </div>

              <div className="about-value">
                <div className="about-value-title">Guidance that Helps</div>
                <div className="about-value-text">
                  AI assistance that explains options clearly and keeps you on track.
                </div>
              </div>

              <div className="about-value">
                <div className="about-value-title">Customer Respect</div>
                <div className="about-value-text">
                  Transparent pricing, clear details, and support that actually solves problems.
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="about-footer">
          <div className="about-footer-card">
            <div className="about-footer-title">Why Kindred?</div>
            <div className="about-footer-text">
              Because your PC should match your purpose gaming, study, design, or development and the
              journey to get there should be smooth.
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
};

export default About;
