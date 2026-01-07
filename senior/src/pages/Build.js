import React from 'react';
import AiAssistant from '../components/AiAssistant';
import '../style/Build.css';

const Build = () => {
  return (
    <div className="build-section">
      <div className="container">
        <h2>Build Your Custom PC</h2>
        <p>Chat with our AI assistant to get personalized PC recommendations based on your needs, budget, and preferences.</p>
        <AiAssistant />
      </div>
    </div>
  );
};

export default Build;