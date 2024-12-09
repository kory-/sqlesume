export const LoadingTerminal = () => {
  return (
    <div className="terminal-container">
      <div className="terminal-wrapper">
        <div className="terminal-output">
          <div>Loading database...</div>
          <div className="loading-indicator">
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 