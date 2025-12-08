import React, { useState, useEffect } from 'react';
import { Bot, Zap, Code, Shield, Menu, X, Rocket, Cpu, Calendar, User, CheckCircle, Clock, Lightbulb, Phone } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';

// --- Firebase Configuration & Globals ---
// Mandatory environment variables provided by the platform
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-amora-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
// Global variable for the initial custom auth token
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

// --- Gemini API Configuration ---
// NOTE: When deploying to Vercel/Netlify, you must replace the empty string with 
// process.env.REACT_APP_GEMINI_API_KEY (or similar) and configure the environment variable.
const API_KEY = ""; // Use empty string for Canvas
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
const MAX_RETRIES = 5;

// --- Chatbot Operational System Instruction (Updated for Conciseness and Sequential Questions) ---
const salesSystemInstruction = `
You are Nova, the highly specialized AI Sales Assistant for Amora. Your primary goal is to qualify leads, educate the user, recommend services, provide price ranges, and move the user toward booking a call or requesting a quote.

***OPERATIONAL GUIDELINES***

1. Business Overview:
The company provides AI automation services for businesses of any size, specialising in:
- End-to-end workflow automation
- AI chatbots (RAG, customer support, sales, internal knowledge bots)
- Document processing & classification systems
- CRM automation
- Email automation
- Process optimisation
- Custom LLM-powered business tools
- Data extraction & data cleansing
- AI integrations with tools like Xero, HubSpot, Notion, Google Workspace, Shopify, etc.
The business operates 7 days a week, with flexible communication and support options.

2. Pricing Model:
A. One-Time Build Projects (Fixed Scope)
- Small automation: $300–$800
- Medium workflow automation or chatbot: $1,000–$3,000
- Large custom systems / multi-step workflows / advanced AI agents: $3,000–$12,000+
Pricing factors: Number of workflows, integrations required, complexity, real-time data/API work.
B. Monthly Subscription Model (Ongoing Maintenance & Builds)
- Starter: $300–$500/month (Light updates, support, small monthly improvements)
- Growth: $600–$1,200/month (Ongoing builds, moderate workflow additions)
- Scale: $1,500–$3,500+/month (Continuous development, custom tooling, priority support)
Clients can switch between plans anytime.

3. Sales / Lead Follow-Up Process (MUST FOLLOW EXACTLY):
- **Step 1 — Qualification (Sequential, Ask 1-2 questions at a time):**
    - Initial Greeting: Start by asking: "What industry are you in, and what specific problem are you looking to solve with AI?"
    - After initial answers, ask: "Which tools/software do you currently use that would need integration, and do you prefer a one-time project or a monthly subscription plan?"
- Step 2 — Provide Tailored Recommendation: Summarize the exact solution and explain how similar businesses benefited (using anonymized case study summaries below).
- Step 3 — Give Pricing Range: Provide a range, not a fixed quote: “Based on what you described, solutions like this usually fall between $X–$Y.”
- Step 4 — Offer Next Step: Give a choice: Book a call, Receive a written quote, or Send more details.
- Step 5 — Collect Contact Info: Ask for: Name, Email, Business name (optional), and a short description of the workflow they want automated.

4. Case Study Summaries (Reference when recommending solutions):
- Professional Services Automation: A finance firm used an AI agent to automate 76% of admin work, reduce errors (5.5% to 0.8%), and free 350+ hours per accountant annually. Scaled client base by 20% without hiring.
- E-commerce Customer Support: An online retailer implemented a 24/7 AI chatbot with real-time inventory integration. Results: Response times instant (down from 24 hours), 85% of support tickets automated, cart abandonment fell (12.5% to 10.8%), saved $70,000+ per year in staffing costs.

5. Behaviour Rules:
- **Responses must be conversational, friendly, and concise (2-4 sentences max). Avoid large paragraphs.**
- If you lack information (e.g., real-time external data): Say: “I don’t have access to real-time data or external documents yet, but here’s what I can tell you…” (ONLY use this if a user asks for external information like stock prices or current news).
- If the user asks for something outside your capability: Say: “I can help explain, estimate, or guide you, but execution will require our team.”
- Tone: Professional but friendly, clear, concise, and solution-focused.
- Never guess pricing—always give ranges based on the models above.

6. Always Aim to Achieve: Educate the user, identify their need, recommend service, provide price ranges, and move them toward a call or quote.

7. Default Call-to-Action (If unsure what to say next):
“Would you like a personalised quote, or would you prefer to book a quick call so we can plan your automation properly?”
`;


// --- Reusable Button Component ---
const PrimaryButton = ({ children, onClick, disabled = false }) => (
  <button
    className={`px-6 py-3 font-semibold rounded-xl transition duration-300 shadow-lg transform active:scale-[0.98] focus:outline-none focus:ring-4 
      ${disabled 
        ? 'bg-gray-400 text-gray-700 cursor-not-allowed shadow-none' 
        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/50 hover:scale-[1.02] focus:ring-blue-500/50'
      }`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

// --- Secondary Button Component (New for PDFs) ---
const SecondaryButton = ({ children, onClick, disabled = false }) => (
  <button
    className={`px-6 py-3 font-semibold rounded-xl transition duration-300 shadow-md transform active:scale-[0.98] focus:outline-none focus:ring-4 
      ${disabled 
        ? 'bg-gray-200 text-gray-700 cursor-not-allowed shadow-none' 
        : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50 shadow-blue-200/50 hover:scale-[1.02] focus:ring-blue-500/50'
      }`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

// --- Footer Component ---
const Footer = ({ openModal }) => (
    <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-b border-gray-700 pb-8 mb-8">
                <div>
                    <h3 className="text-lg font-bold mb-4 flex items-center">
                        <Cpu className="w-5 h-5 mr-2 text-blue-400" /> Amora
                    </h3>
                    <p className="text-gray-400 text-sm">
                        Engineering Intelligence for the Future of Business.
                    </p>
                </div>
                <div>
                    <h4 className="text-md font-semibold mb-4 text-blue-300">Quick Links</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a href="#services" className="text-gray-400 hover:text-blue-200 transition">Services</a></li>
                        <li><a href="#casestudies" className="text-gray-400 hover:text-blue-200 transition">Case Studies</a></li>
                        <li><a href="#contact" className="text-gray-400 hover:text-blue-200 transition">Contact</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-md font-semibold mb-4 text-blue-300">Support</h4>
                    <ul className="space-y-2 text-sm">
                        <li><a href="#" className="text-gray-400 hover:text-blue-200 transition">Pricing</a></li>
                        <li><a href="#" className="text-gray-400 hover:text-blue-200 transition">FAQ</a></li>
                        <li><a href="#" className="text-gray-400 hover:text-blue-200 transition">Terms of Service</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-md font-semibold mb-4 text-blue-300">Get Started</h4>
                    <div className="space-y-3">
                        <PrimaryButton onClick={() => openModal('Demo Request')}>
                            <Phone className="w-4 h-4 mr-2 inline-block" /> Book a Consultation
                        </PrimaryButton>
                    </div>
                </div>
            </div>
            
            <div className="text-center text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} Amora AI Solutions. All rights reserved.
            </div>
        </div>
    </footer>
);

// --- Scheduling Modal Component ---
const SchedulingModal = ({ isOpen, onClose, db, userId, modalType }) => {
  const [step, setStep] = useState(1); // 1: Availability Form, 2: Confirmation
  const [preferredDates, setPreferredDates] = useState(['', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1); // Reset step when modal opens
      setError('');
      setPreferredDates(['', '', '']);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDateChange = (index, value) => {
    const newDates = [...preferredDates];
    newDates[index] = value;
    setPreferredDates(newDates);
  };

  const handleSubmit = async () => {
    if (!db || !userId) {
      setError("System not ready. Please wait a moment and try again.");
      return;
    }
    const validDates = preferredDates.filter(d => d.trim() !== '');
    if (validDates.length === 0) {
      setError("Please suggest at least one preferred date and time.");
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Data is saved in the public collection path so that the Amora sales team can retrieve it.
      const requestData = {
        userId: userId,
        requestType: modalType,
        status: 'Pending Review',
        preferredSlots: validDates,
        timestamp: new Date().toISOString(),
      };

      // Firestore path for public data: /artifacts/{appId}/public/data/{your_collection_name}
      const collectionPath = `/artifacts/${appId}/public/data/demoRequests`;
      await addDoc(collection(db, collectionPath), requestData);
      
      setStep(2); // Move to confirmation
    } catch (e) {
      console.error("Error submitting request:", e);
      setError("Failed to submit request. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Modal Content Rendering ---
  const renderContent = () => {
    if (step === 1) {
      return (
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Step 1: Suggest Availability</h3>
          <p className="text-gray-600 mb-4">Please provide three dates/times (including time zone, e.g., "Monday 10 AM AEST") that work best for your consultation.</p>
          
          <div className="space-y-4">
            {preferredDates.map((date, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <input
                  type="text"
                  value={date}
                  onChange={(e) => handleDateChange(index, e.target.value)}
                  placeholder={`Option ${index + 1} (e.g., Tues 2pm EST)`}
                  className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}

          <div className="mt-8 flex justify-end">
            <PrimaryButton onClick={handleSubmit} disabled={isSubmitting || preferredDates.filter(d => d.trim() !== '').length === 0}>
              {isSubmitting ? 'Submitting...' : 'Confirm Availability'}
            </PrimaryButton>
          </div>
        </div>
      );
    } 
    
    if (step === 2) {
      return (
        <div className="p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Request Confirmed!</h3>
          <p className="text-lg text-gray-600 mb-6">
            Thank you for your submission. The Amora team will review your preferred slots and contact you shortly to finalize the date and time.
          </p>
          <div className="mt-8">
            <PrimaryButton onClick={onClose}>
              Close
            </PrimaryButton>
          </div>
        </div>
      );
    }
  };

  // --- Modal Structure ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-blue-600 flex items-center">
            <Calendar className="w-6 h-6 mr-2" />
            Schedule a Meeting
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};


// --- Solution Idea Generator Modal (Uses Gemini for creative brainstorming) ---
const SolutionGeneratorModal = ({ isOpen, onClose }) => {
  const [industry, setIndustry] = useState('');
  const [challenge, setChallenge] = useState('');
  const [solution, setSolution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
        setSolution(null);
        setError('');
        setIndustry('');
        setChallenge('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const generateSolution = async () => {
    if (!industry || !challenge) {
      setError("Please fill in both the industry and the challenge.");
      return;
    }
    
    setLoading(true);
    setSolution(null);
    setError('');

    // Construct a specific prompt for the AI to act as a strategist
    const userQuery = `Industry: ${industry}. Challenge: ${challenge}. Generate a concise, high-level AI solution proposal for Amora to address this. The response must be a single paragraph focusing on the solution, its core benefit, and which of Amora's core services (Conversational AI, Autonomous Workflow, or Predictive Analytics) is the primary focus.`;
    
    try {
      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: "You are a senior AI strategist for Amora. Generate a concise, single paragraph response that provides a high-level, credible AI solution idea." }]
        },
      };

      let response;
      for (let i = 0; i < MAX_RETRIES; i++) {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) break; 
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        setSolution(text);
      } else {
        throw new Error(result.error?.message || "AI failed to generate a solution.");
      }
    } catch (e) {
      console.error("Solution Generator Error:", e);
      setError("Failed to generate solution. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-green-600 flex items-center">
            <Lightbulb className="w-6 h-6 mr-2" />
            AI Solution Idea Generator
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="space-y-4 mb-6">
            <input
              type="text"
              placeholder="Your Industry (e.g., Logistics, Fintech)"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loading}
            />
            <textarea
              placeholder="Your Core Business Challenge (e.g., High rate of customer churn due to long wait times)"
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              rows="3"
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              disabled={loading}
            />
          </div>

          <div className="flex justify-end mb-6">
            <PrimaryButton 
              onClick={generateSolution} 
              disabled={loading || !industry.trim() || !challenge.trim()}
            >
              {loading ? 'Generating...' : '✨ Generate Solution Idea'}
            </PrimaryButton>
          </div>

          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          {solution && (
            <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg shadow-md">
              <h4 className="font-bold text-green-800 mb-2">Amora's Suggested Solution:</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{solution}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Navigation and Layout ---
const Header = ({ openModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navItems = ['Case Studies', 'Services', 'Resources', 'Contact'];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo/Brand - Amora */}
          <a href="#" className="flex items-center text-2xl font-bold text-gray-900">
            <Cpu className="w-8 h-8 mr-2 text-blue-600" />
            Amora
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(' ', '')}`}
                className="text-gray-600 hover:text-blue-600 font-medium transition duration-150"
              >
                {item}
              </a>
            ))}
          </nav>
          
          {/* Action Button - Triggers Scheduling Modal */}
          <div className="hidden md:block">
            <PrimaryButton onClick={() => openModal('Demo Request')}>Book a Call</PrimaryButton>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-gray-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute w-full bg-white shadow-xl">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(' ', '')}`}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition duration-150"
              >
                {item}
              </a>
            ))}
            <div className="pt-2 px-3">
              <PrimaryButton onClick={() => openModal('Demo Request')}>Book a Call</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};


// --- Intelligent Chatbot Component ---
const ChatbotWidget = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am Nova, the Amora AI Assistant. I can help you qualify your automation needs and provide an instant price estimate. What industry are you in, and what specific problem are you looking to solve with AI?' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to format the current chat history for the Gemini API payload
  const formatHistory = (history) => history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model', 
    parts: [{ text: msg.text }]
  }));
  
  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage = { role: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      // 1. Prepare history for API (includes the new user message)
      const chatHistory = formatHistory(newMessages);
      
      const payload = {
        contents: chatHistory,
        systemInstruction: {
            parts: [{ text: salesSystemInstruction }]
        },
      };

      // 2. API Call with exponential backoff for reliability
      let response;
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) break; 
        } catch (error) {
          if (i === MAX_RETRIES - 1) throw error; 
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const result = await response.json();
      const candidate = result.candidates?.[0];

      if (candidate && candidate.content?.parts?.[0]?.text) {
        const text = candidate.content.parts[0].text;
        
        const aiResponse = { role: 'ai', text };
        setMessages(prev => [...prev, aiResponse]);

      } else {
        throw new Error(result.error?.message || "Failed to get a valid response from AI.");
      }
    } catch (e) {
      console.error("Gemini API Error:", e);
      setError('I apologize, but I encountered an error while processing your request. Please try again.');
      const errorResponse = { role: 'ai', text: 'I apologize, but I am currently unable to connect to our AI services.' };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setLoading(false);
      // Ensure scroll to bottom happens after state update
      setTimeout(() => {
        const chatWindow = document.getElementById('chat-messages');
        if (chatWindow) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
      }, 0);
    }
  };

  const renderMessage = (msg, index) => (
    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] p-3 rounded-xl shadow-md ${
        msg.role === 'user' 
          ? 'bg-blue-100 text-gray-800 rounded-br-none' 
          : 'bg-gray-100 text-gray-700 rounded-tl-none'
      }`}>
        {msg.text}
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 bg-blue-600 p-4 rounded-full text-white shadow-2xl hover:bg-blue-700 transition duration-300 z-50 transform hover:scale-105"
        aria-label="Open Chatbot"
      >
        {chatOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {chatOpen && (
        <div className="fixed bottom-20 right-6 w-80 h-96 bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header - Amora */}
          <div className="p-4 bg-blue-600 text-white font-semibold flex justify-between items-center">
            Amora Assistant (Sales & Estimates)
            <Cpu className="w-5 h-5"/>
          </div>

          {/* Messages */}
          <div id="chat-messages" className="flex-grow p-4 space-y-3 overflow-y-auto text-sm">
            {messages.map(renderMessage)}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-xl bg-gray-100 text-gray-500 rounded-tl-none animate-pulse">
                  ...typing
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Start your qualification here..."
                className="flex-grow border border-gray-300 p-2 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                className="bg-blue-600 text-white p-2 rounded-r-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400"
                disabled={loading || input.trim() === ''}
              >
                <Rocket className="w-5 h-5 transform rotate-45" />
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-1">Chat Error: {error}</p>}
          </div>
        </div>
      )}
    </>
  );
};


// --- Feature Section Component ---
const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl hover:shadow-2xl transition duration-300 border border-gray-100 transform hover:-translate-y-1">
    <Icon className="w-10 h-10 text-blue-600 mb-4 bg-blue-50 p-2 rounded-xl" />
    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

// --- Main App Component ---
const App = () => {
  // State for Firebase and Auth
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // State for Modals
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [schedulingModalType, setSchedulingModalType] = useState('Demo Request');
  const [isGeneratorModalOpen, setIsGeneratorModal] = useState(false);

  // --- Firebase Initialization and Authentication ---
  useEffect(() => {
    if (!firebaseConfig) {
      console.error("Firebase config is missing.");
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      
      setDb(firestore);
      setAuth(firebaseAuth);

      // Listener for Auth state changes
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          setUserId(null); 
        }
        setIsAuthReady(true);
      });

      // Handle initial sign-in using custom token or anonymously
      const signInUser = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken); 
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (e) {
          console.error("Error signing in to Firebase:", e);
        }
      };

      signInUser();

      return () => unsubscribe(); // Cleanup auth listener
    } catch (e) {
      console.error("Firebase initialization failed:", e);
    }
  }, []);

  const openSchedulingModal = (type) => {
    setSchedulingModalType(type);
    setIsSchedulingModalOpen(true);
  };
  
  const closeSchedulingModal = () => {
    setIsSchedulingModalOpen(false);
  };
  
  const openGeneratorModal = () => {
    setIsGeneratorModal(true);
  };
  
  const closeGeneratorModal = () => {
    setIsGeneratorModal(false);
  };
  
  // Function to simulate opening a PDF link in a new tab
  const handleViewPdf = (pdfName) => {
    // Replaced alert() with console log to follow best practice
    console.log(`Simulating opening the PDF for "${pdfName}". In a live environment, this button would link to your hosted file.`);
  };


  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased">
      <script src="https://cdn.tailwindcss.com"></script>
      <Header openModal={openSchedulingModal} />

      <main>
        {/* 1. Hero Section */}
        <section className="py-20 md:py-32 bg-white" id="home">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-4">
              The Intelligence Layer for Every Business
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              We engineer bespoke AI solutions, from conversational agents to autonomous data analysis, driving true operational transformation.
            </p>
            {/* Book a Call button triggers the updated scheduling modal */}
            <PrimaryButton onClick={() => openSchedulingModal('Demo Request')}>Book a Call</PrimaryButton>
            <p className="mt-4 text-sm text-gray-500">Schedule a 30-minute consultation. Let's discuss your automation goals.</p>

            {/* Placeholder Illustration */}
            <div className="mt-16">
              <img
                src="https://placehold.co/800x400/1D4ED8/FFFFFF/png?text=AI+Dashboard+Interface"
                alt="AI Dashboard Illustration"
                className="mx-auto rounded-xl shadow-2xl border-4 border-gray-100"
                onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/800x400?text=AI+System+Visualization"; }}
              />
            </div>
          </div>
        </section>

        {/* 2. Services Section - Added Generator Button */}
        <section className="py-20 md:py-28" id="services">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">Our Core AI Services</h2>
            
            {/* New Gemini-powered Feature Button */}
            <div className='text-center mb-12'>
                <PrimaryButton onClick={openGeneratorModal}>
                    ✨ Instantly Generate a Custom Solution Idea
                </PrimaryButton>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard
                icon={Bot}
                title="Conversational AI"
                description="Custom-built large language models that understand context, intent, and deliver human-like, accurate support 24/7."
              />
              <FeatureCard
                icon={Code}
                title="Autonomous Workflow"
                description="Automate complex business processes end-to-end, freeing up your team to focus on strategic, high-value tasks."
              />
              <FeatureCard
                icon={Zap}
                title="Predictive Analytics"
                description="Leverage deep learning to forecast market trends, inventory needs, and customer churn with 99% accuracy."
              />
            </div>
          </div>
        </section>

        {/* 3. Case Studies Section */}
        <section className="py-20 md:py-28 bg-white" id="casestudies">
            <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Real Results. Real Transformation.</h2>
                <p className="text-lg text-gray-600 mb-10">
                    Download our detailed case studies to see the verifiable impact Amora has had on operations, efficiency, and ROI.
                </p>
                
                <div className="flex flex-col md:flex-row justify-center gap-6">
                    {/* Financial Firm Case Study PDF Link */}
                    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col items-center w-full md:w-1/2">
                        <Shield className="w-10 h-10 text-green-600 mb-3" />
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Professional Services Automation</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            How we automated 76% of admin tasks for a finance firm, saving 350+ hours/accountant annually.
                        </p>
                        <SecondaryButton onClick={() => handleViewPdf('Financial Firm Automation')}>
                            View Full PDF Report
                        </SecondaryButton>
                    </div>

                    {/* E-commerce Case Study PDF Link */}
                    <div className="bg-gray-50 p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col items-center w-full md:w-1/2">
                        <Bot className="w-10 h-10 text-purple-600 mb-3" />
                        <h3 className="text-xl font-xl font-bold text-gray-800 mb-2">24/7 E-commerce Chatbot</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Detailed results on reducing cart abandonment and automating 85% of support tickets for an online retailer.
                        </p>
                        <SecondaryButton onClick={() => handleViewPdf('E-commerce Chatbot Results')}>
                            View Full PDF Report
                        </SecondaryButton>
                    </div>
                </div>
            </div>
        </section>
        
        {/* 4. Contact Section */}
        <section className="py-20 md:py-28" id="contact">
            <div className="max-w-xl mx-auto text-center px-4 sm:px-6 lg:px-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Ready to Automate?</h2>
                <p className="text-lg text-gray-600 mb-8">
                    Start a conversation with Nova (our AI assistant) or book a personalized 
                    consultation directly with our strategy team.
                </p>
                <PrimaryButton onClick={() => openSchedulingModal('Inquiry & Quote')}>
                    Get a Custom Quote
                </PrimaryButton>
                {/* Displaying User ID for debugging/identification purposes (as required) */}
                {userId && (
                    <p className="mt-6 text-xs text-gray-500">
                        <User className="w-3 h-3 inline mr-1" />
                        Session ID: {userId}
                    </p>
                )}
                {!isAuthReady && (
                     <p className="mt-6 text-xs text-red-500">
                        Initializing authentication...
                    </p>
                )}
            </div>
        </section>
        
      </main>

      <Footer openModal={openSchedulingModal} />
      
      {/* The Chatbot Widget is positioned fixed/floating over the entire page */}
      <ChatbotWidget />

      {/* Scheduling Modal - Only renders if auth is ready and we have DB access */}
      {isAuthReady && db && userId && (
        <SchedulingModal 
          isOpen={isSchedulingModalOpen} 
          onClose={closeSchedulingModal} 
          db={db} 
          userId={userId}
          modalType={schedulingModalType}
        />
      )}
      
      {/* Solution Generator Modal */}
      <SolutionGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={closeGeneratorModal}
      />
    </div>
  );
};

export default App;
