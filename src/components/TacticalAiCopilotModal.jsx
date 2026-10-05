import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  Waves,
  CloudRain,
  Hospital,
  AlertTriangle,
  Crosshair,
  PhoneCall,
  FileText,
  ExternalLink,
  Layers,
  Eye,
  Volume2,
  Terminal,
  Loader2
} from 'lucide-react';
import {
  queryTacticalAiCopilot,
  PRESET_TACTICAL_QUESTIONS,
  PLATFORM_IDENTITY
} from '../services/aiCopilotService';

// Icon mapper for dynamic action buttons
const ICON_MAP = {
  Waves,
  CloudRain,
  Hospital,
  AlertTriangle,
  Crosshair,
  PhoneCall,
  FileText,
  ExternalLink,
  Layers,
  Eye,
  Volume2,
  Terminal,
  Sparkles,
  Navigation: Crosshair,
  Database: Terminal,
  Download: FileText,
  Car: Crosshair,
  Shield: PhoneCall,
  MapPin: Hospital
};

/**
 * Lightweight, safe parser for formatted tactical Markdown responses
 */
function renderFormattedMarkdown(text = '') {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="copilot-h3">
          {formatInline(line.substring(4))}
        </h4>
      );
    } else if (line.startsWith('#### ')) {
      elements.push(
        <h5 key={`h4-${i}`} className="copilot-h4">
          {formatInline(line.substring(5))}
        </h5>
      );
    } else if (line.startsWith('> ')) {
      // Blockquote
      elements.push(
        <blockquote key={`quote-${i}`} className="copilot-blockquote">
          {formatInline(line.substring(2))}
        </blockquote>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Bullet list item
      elements.push(
        <div key={`li-${i}`} className="copilot-list-item">
          <span className="copilot-bullet" aria-hidden="true">•</span>
          <div className="copilot-bullet-text">{formatInline(line.substring(2))}</div>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list item
      const match = line.match(/^(\d+)\.\s(.*)$/);
      elements.push(
        <div key={`num-${i}`} className="copilot-list-item">
          <span className="copilot-num-badge">{match[1]}</span>
          <div className="copilot-bullet-text">{formatInline(match[2])}</div>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={`sp-${i}`} style={{ height: '6px' }} />);
    } else {
      elements.push(
        <p key={`p-${i}`} className="copilot-paragraph">
          {formatInline(line)}
        </p>
      );
    }
  }

  return elements;
}

/**
 * Parses bold, links, inline code
 */
function formatInline(str = '') {
  if (!str) return '';

  // Pattern matches: links [text](url), bold **text**, code `text`
  const parts = [];
  let remaining = str;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 1. Link check [label](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    // 2. Bold check **bold**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // 3. Code check `code`
    const codeMatch = remaining.match(/`([^`]+)`/);

    const matches = [
      linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index } : null,
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index } : null
    ].filter(Boolean).sort((a, b) => a.index - b.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0];
    if (first.index > 0) {
      parts.push(remaining.substring(0, first.index));
    }

    if (first.type === 'link') {
      const [, label, url] = first.match;
      parts.push(
        <a
          key={`l-${keyIdx++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="copilot-link"
        >
          {label} <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '2px' }} />
        </a>
      );
      remaining = remaining.substring(first.index + first.match[0].length);
    } else if (first.type === 'bold') {
      parts.push(<strong key={`b-${keyIdx++}`} className="copilot-strong">{first.match[1]}</strong>);
      remaining = remaining.substring(first.index + first.match[0].length);
    } else if (first.type === 'code') {
      parts.push(<code key={`c-${keyIdx++}`} className="copilot-code">{first.match[1]}</code>);
      remaining = remaining.substring(first.index + first.match[0].length);
    }
  }

  return parts;
}

export default function TacticalAiCopilotModal({
  isOpen,
  onClose,
  onExecuteAction,
  onOpenDamMonitor,
  onOpenWeatherModal,
  onOpenHazardModal,
  onTriggerProximityScan,
  onExportManifest,
  currentCoords
}) {
  const [messages, setMessages] = useState([
    {
      id: 'msg-init-1',
      sender: 'bot',
      text: `### 🛡️ Resylix Tactical AI Copilot Ready

I am grounded on 100% of the **Resylix Kerala Disaster Management Platform**.

You can ask me anything about:
- **Platform Architecture & Creator Attribution** (conceived & built by Joyal Thomas Francis)
- **Offline Dijkstra Graph Routing** & dynamic hazard avoidance
- **KSDMA 24 Reservoirs** & Central Water Commission Rule Curves
- **14-District Weather Warning Matrix** (Red, Orange, Yellow alerts)
- **210 Verified Kerala Facilities** (Hospitals, fuel, shelters, pharmacies)
- **Official Emergency Helplines** (SEOC 1070, DEOC 1077 for all 14 districts)
- **Field Hazard Reporting & 5km Proximity Scans**

*Type your question below or tap any suggested operational query.*`,
      actions: [
        { label: 'Check Dams', actionId: 'ksdma_dams', icon: 'Waves' },
        { label: 'Weather Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
        { label: '5km Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
        { label: 'Who Created Resylix?', actionId: 'ask_creator', icon: 'Sparkles' }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (textToSend) => {
    const q = (textToSend || inputQuery).trim();
    if (!q || isTyping) return;

    const userMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputQuery('');
    setIsTyping(true);

    try {
      const response = await queryTacticalAiCopilot(q, {
        currentCoords
      });

      const botMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: response.answer,
        actions: response.actions || [],
        source: response.source,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('[AI COPILOT] Response error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `### ⚠️ Tactical Query Offline Mode\n\nResylix is operating in zero-connectivity standby. Error processing query: ${err.message || 'Unknown issue'}. You can still access all offline tools using the buttons below.`,
          actions: [
            { label: 'Open Dam Monitor', actionId: 'ksdma_dams', icon: 'Waves' },
            { label: '5km Proximity Scan', actionId: 'proximity_scan', icon: 'Crosshair' }
          ],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionClick = (action) => {
    if (!action) return;

    // Handle special URL link
    if (action.url) {
      window.open(action.url, '_blank');
      return;
    }

    // Handle phone call
    if (action.actionId === 'call_phone') {
      window.location.href = `tel:${action.payload || '1070'}`;
      return;
    }

    // Special preset query triggers
    if (action.actionId === 'ask_creator') {
      handleSendMessage('Who created Resylix?');
      return;
    }
    if (action.actionId === 'ask_offline_tech') {
      handleSendMessage('How does offline navigation work without internet?');
      return;
    }

    // Direct platform actions
    switch (action.actionId) {
      case 'ksdma_dams':
        if (onOpenDamMonitor) onOpenDamMonitor();
        else if (onExecuteAction) onExecuteAction('ksdma_dams');
        break;
      case 'ksdma_weather':
        if (onOpenWeatherModal) onOpenWeatherModal();
        else if (onExecuteAction) onExecuteAction('ksdma_weather');
        break;
      case 'report_hazard':
        if (onOpenHazardModal) onOpenHazardModal();
        else if (onExecuteAction) onExecuteAction('report_hazard');
        break;
      case 'proximity_scan':
        if (onTriggerProximityScan) onTriggerProximityScan();
        else if (onExecuteAction) onExecuteAction('proximity_scan');
        break;
      case 'evacuation_manifest':
        if (onExportManifest) onExportManifest();
        else if (onExecuteAction) onExecuteAction('evacuation_manifest');
        break;
      default:
        if (onExecuteAction) onExecuteAction(action.actionId);
        break;
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: 'bot',
        text: `### 🔄 Session Cleared\n\nResylix Tactical AI Copilot initialized and ready. What tactical intelligence or operational guidance do you need?`,
        actions: [
          { label: 'Check Dams', actionId: 'ksdma_dams', icon: 'Waves' },
          { label: 'Weather Matrix', actionId: 'ksdma_weather', icon: 'CloudRain' },
          { label: '5km Scan', actionId: 'proximity_scan', icon: 'Crosshair' },
          { label: 'Who Created Resylix?', actionId: 'ask_creator', icon: 'Sparkles' }
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tactical-ai-copilot-title"
      className="copilot-modal-container"
      style={{
        position: 'fixed',
        bottom: isMinimized ? '16px' : '24px',
        right: '20px',
        zIndex: 9999,
        width: isMinimized ? '320px' : 'min(520px, calc(100vw - 32px))',
        maxHeight: isMinimized ? '56px' : 'min(720px, calc(100vh - 48px))',
        height: isMinimized ? '56px' : 'min(660px, calc(100vh - 60px))',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(11, 19, 41, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '16px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(14, 165, 233, 0.25)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden'
      }}
    >
      {/* 1. Tactical Glassmorphic Header */}
      <div
        className="copilot-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.8rem 1.1rem',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(11, 19, 41, 0.95) 100%)',
          borderBottom: isMinimized ? 'none' : '1px solid rgba(56, 189, 248, 0.2)',
          userSelect: 'none',
          cursor: isMinimized ? 'pointer' : 'default'
        }}
        onClick={() => {
          if (isMinimized) setIsMinimized(false);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.3) 0%, rgba(59, 130, 246, 0.15) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)'
            }}
          >
            <Bot size={19} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3
                id="tactical-ai-copilot-title"
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Resylix Tactical AI
              </h3>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.18)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  letterSpacing: '0.05em'
                }}
              >
                100% Grounded
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
              Offline Disaster Navigation & Knowledge Engine
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!isMinimized && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearChat();
              }}
              title="Clear conversation"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCcw size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(prev => !prev);
            }}
            title={isMinimized ? 'Expand copilot window' : 'Minimize copilot window'}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close copilot"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '6px',
              color: '#f87171',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Body (Hidden when Minimized) */}
      {!isMinimized && (
        <>
          {/* 2. Tactical Quick Suggestion Carousel */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: 'rgba(15, 23, 42, 0.5)',
              borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', flexShrink: 0 }}>
              Topics:
            </span>
            {PRESET_TACTICAL_QUESTIONS.map(q => (
              <button
                key={q.id}
                type="button"
                onClick={() => handleSendMessage(q.query)}
                style={{
                  flexShrink: 0,
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  background: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  borderRadius: '999px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(14, 165, 233, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(14, 165, 233, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)';
                }}
              >
                <Sparkles size={11} />
                <span>{q.badge}</span>
              </button>
            ))}
          </div>

          {/* 3. Messages Scroll View */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(56, 189, 248, 0.3) transparent'
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                {/* Sender badge & timestamp */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.68rem',
                    color: '#64748b',
                    marginBottom: '4px',
                    padding: '0 4px'
                  }}
                >
                  <span style={{ fontWeight: 600, color: msg.sender === 'user' ? '#38bdf8' : '#34d399' }}>
                    {msg.sender === 'user' ? 'TACTICAL OPERATOR' : 'RESYLIX COPILOT'}
                  </span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: msg.sender === 'user' ? '85%' : '100%',
                    padding: '0.85rem 1.05rem',
                    borderRadius: msg.sender === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background:
                      msg.sender === 'user'
                        ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(2, 132, 199, 0.35) 100%)'
                        : 'rgba(15, 23, 42, 0.75)',
                    border:
                      msg.sender === 'user'
                        ? '1px solid rgba(56, 189, 248, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f1f5f9',
                    fontSize: '0.86rem',
                    lineHeight: '1.55',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
                  }}
                >
                  {msg.sender === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  ) : (
                    <div>{renderFormattedMarkdown(msg.text)}</div>
                  )}

                  {/* Action Buttons if provided by AI */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px'
                      }}
                    >
                      {msg.actions.map((act, aIdx) => {
                        const IconComponent = ICON_MAP[act.icon] || Sparkles;
                        return (
                          <button
                            key={`act-${aIdx}`}
                            type="button"
                            onClick={() => handleActionClick(act)}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(14, 165, 233, 0.16)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              color: '#38bdf8',
                              borderRadius: '8px',
                              padding: '5px 11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(14, 165, 233, 0.3)';
                              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(14, 165, 233, 0.16)';
                              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                            }}
                          >
                            <IconComponent size={13} />
                            <span>{act.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing status indicator */}
            {isTyping && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.8rem',
                  alignSelf: 'flex-start'
                }}
              >
                <Loader2 size={15} className="copilot-spin" />
                <span>Processing tactical telemetry & grounding knowledge...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 4. Input Bar */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.95)',
              borderTop: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask anything (e.g. who made this?, dam status, weather)..."
              disabled={isTyping}
              style={{
                flex: 1,
                padding: '9px 13px',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '10px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                outline: 'none',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.3)'
              }}
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isTyping}
              title="Send question"
              style={{
                padding: '9px 14px',
                background: inputQuery.trim() && !isTyping
                  ? 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
                  : 'rgba(30, 41, 59, 0.5)',
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                cursor: inputQuery.trim() && !isTyping ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: inputQuery.trim() && !isTyping ? '0 0 14px rgba(14, 165, 233, 0.4)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
