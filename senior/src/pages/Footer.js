import React from 'react';
import '../style/Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="social-links">
          <a
            href="https://www.instagram.com/kindredpcs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
          </a>
          <a
            href="https://x.com/kindredpcs"
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
          <a
            href="https://www.linkedin.com/company/kindredpcs"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
          <a
            href="https://www.tiktok.com/@kindredpcs"
            target="_blank"
            rel="noopener noreferrer"
          >
            TikTok
          </a>
        </div>

        <p>&copy; {new Date().getFullYear()} Kindred PCs. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
