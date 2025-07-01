'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Loader, X, Trash2 } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const LOCAL_CHAT_KEY = 'quicksites::chat-history';

export default function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_CHAT_KEY);
      if (stored) setMessages(JSON.parse(stored));
    }
  }, []);

  // Save chat history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages as Message[]);
    setInput('');
    setTyping(true);
    setLoading(true);

    const res = await fetch('/api/ask-assistant', {
      method: 'POST',
      body: JSON.stringify({ messages: newMessages }),
    });

    const data = await res.json();

    setTyping(false);
    setMessages([
      ...(newMessages as Message[]),
      {
        role: 'assistant',
        content: data.reply || 'Sorry, something went wrong.',
      } as Message,
    ]);
    setLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(LOCAL_CHAT_KEY);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 hidden md:block">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white shadow-lg"
        title="Ask QuickSites Assistant"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Bot className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[320px] bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl flex flex-col text-white text-sm">
          <div className="flex items-center justify-between p-4 border-b border-zinc-700">
            <h3 className="font-semibold text-lg text-indigo-400">QuickSites Assistant</h3>
            <button
              onClick={clearChat}
              className="text-zinc-400 hover:text-red-400"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex flex-col gap-2 px-4 py-3 overflow-y-auto max-h-[300px] text-zinc-300"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-lg max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-zinc-800 self-end text-right'
                    : 'bg-zinc-900 self-start text-left'
                }`}
              >
                {m.content}
              </div>
            ))}

            {typing && (
              <div className="self-start px-3 py-2 rounded-lg bg-zinc-900 text-xs animate-pulse text-zinc-400">
                Assistant is typing...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2 p-4 border-t border-zinc-700"
          >
            <input
              className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me something..."
              disabled={loading}
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded text-white text-xs font-medium"
              disabled={loading}
            >
              {loading ? '...' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
