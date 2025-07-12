import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Main App Component ---
function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('loading'); // loading, signin, signup, dashboard
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setPage('dashboard');
      } else {
        setUser(null);
        setPage('signin');
      }
      setError('');
    });
    return () => unsubscribe();
  }, []);

  const navigateTo = (pageName) => {
    setPage(pageName);
    setError('');
  };

  return (
    <div style={styles.appContainer}>
      <Header user={user} setPage={setPage} />
      <main style={styles.mainContent}>
        {page === 'loading' && <p>Loading...</p>}
        {page === 'signin' && <SignInPage setPage={navigateTo} setError={setError} />}
        {page === 'signup' && <SignUpPage setPage={navigateTo} setError={setError} />}
        {page === 'dashboard' && user && <DashboardPage user={user} />}
        {error && <p style={styles.errorText}>{error}</p>}
      </main>
      <Footer />
    </div>
  );
}

// --- Components ---

function Header({ user, setPage }) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setPage('signin');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <header style={styles.header}>
      <h1 style={styles.headerTitle}>Haysimo Chat</h1>
      {user && (
        <div style={styles.headerUser}>
          <span style={styles.userEmail}>{user.email}</span>
          <button onClick={handleSignOut} style={styles.buttonSecondary}>Sign Out</button>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <p>&copy; {new Date().getFullYear()} Haysimo App. All rights reserved.</p>
    </footer>
  );
}

function SignInPage({ setPage, setError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPage('dashboard');
    } catch (error) {
      setError(getFriendlyErrorMessage(error.code));
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setPage('dashboard');
    } catch (error) {
      setError(getFriendlyErrorMessage(error.code));
    }
  };

  return (
    <div style={styles.authContainer}>
      <form onSubmit={handleSignIn} style={styles.form}>
        <h2 style={styles.formTitle}>Sign In</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          required
          style={styles.input}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Sign In</button>
        <button type="button" onClick={handleGoogleSignIn} style={{...styles.button, ...styles.googleButton}}>
          Sign In with Google
        </button>
        <p style={styles.switchFormText}>
          Don't have an account?{' '}
          <span onClick={() => setPage('signup')} style={styles.link}>
            Sign Up
          </span>
        </p>
      </form>
    </div>
  );
}

function SignUpPage({ setPage, setError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setPage('dashboard');
    } catch (error) {
      setError(getFriendlyErrorMessage(error.code));
    }
  };

  return (
    <div style={styles.authContainer}>
      <form onSubmit={handleSignUp} style={styles.form}>
        <h2 style={styles.formTitle}>Create Account</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          required
          style={styles.input}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={styles.input}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm Password"
          required
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Sign Up</button>
        <p style={styles.switchFormText}>
          Already have an account?{' '}
          <span onClick={() => setPage('signin')} style={styles.link}>
            Sign In
          </span>
        </p>
      </form>
    </div>
  );
}

function DashboardPage({ user }) {
  return (
    <div style={styles.dashboard}>
      <h2 style={styles.dashboardTitle}>Chat Room</h2>
      <ChatRoom user={user} />
    </div>
  );
}

function ChatRoom({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = React.useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ ...doc.data(), id: doc.id });
      });
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        email: user.email,
        uid: user.uid,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message: ", error);
    }
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.messagesContainer}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} currentUser={user} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} style={styles.messageForm}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          style={styles.messageInput}
        />
        <button type="submit" style={styles.sendButton}>Send</button>
      </form>
    </div>
  );
}

function ChatMessage({ message, currentUser }) {
  const { text, uid, email } = message;
  const messageClass = uid === currentUser.uid ? 'sent' : 'received';

  const messageStyle = {
    ...styles.message,
    ...(messageClass === 'sent' ? styles.sent : styles.received),
  };

  const emailStyle = {
    ...styles.messageEmail,
    ...(messageClass === 'sent' ? { textAlign: 'right' } : { textAlign: 'left' }),
  };

  return (
    <div>
      <div style={emailStyle}>{email}</div>
      <div style={messageStyle}>
        <p style={styles.messageText}>{text}</p>
      </div>
    </div>
  );
}

// --- Helper Functions ---
function getFriendlyErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/email-already-in-use':
      return 'This email is already in use. Please sign in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    default:
      return 'An unknown error occurred. Please try again.';
  }
}


// --- Styles ---
// This is a basic styling object. For a real app, you'd use CSS files.
const styles = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f0f2f5',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: '10px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  headerTitle: {
    color: '#1877f2',
    margin: 0,
  },
  headerUser: {
    display: 'flex',
    alignItems: 'center',
  },
  userEmail: {
    marginRight: '15px',
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: '10px',
    textAlign: 'center',
    color: '#606770',
    fontSize: '12px',
    borderTop: '1px solid #dddfe2',
  },
  authContainer: {
    width: '100%',
    maxWidth: '400px',
    padding: '2rem',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formTitle: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    color: '#1c1e21',
  },
  input: {
    padding: '12px',
    marginBottom: '1rem',
    border: '1px solid #dddfe2',
    borderRadius: '6px',
    fontSize: '16px',
  },
  button: {
    padding: '12px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#1877f2',
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: '1rem',
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  buttonSecondary: {
    padding: '8px 12px',
    border: '1px solid #dddfe2',
    borderRadius: '6px',
    backgroundColor: '#f5f6f7',
    color: '#4b4f56',
    cursor: 'pointer',
  },
  switchFormText: {
    textAlign: 'center',
    fontSize: '14px',
  },
  link: {
    color: '#1877f2',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#fa383e',
    textAlign: 'center',
    marginTop: '1rem',
  },
  dashboard: {
    width: '100%',
    maxWidth: '800px',
    height: 'calc(100vh - 140px)',
    display: 'flex',
    flexDirection: 'column',
  },
  dashboardTitle: {
    textAlign: 'center',
    color: '#1c1e21',
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #dddfe2',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  messagesContainer: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
  },
  message: {
    padding: '10px 15px',
    borderRadius: '20px',
    marginBottom: '10px',
    maxWidth: '70%',
    wordWrap: 'break-word',
  },
  sent: {
    backgroundColor: '#0084ff',
    color: 'white',
    marginLeft: 'auto',
  },
  received: {
    backgroundColor: '#e4e6eb',
    color: '#050505',
    marginRight: 'auto',
  },
  messageEmail: {
    fontSize: '12px',
    color: '#606770',
    marginBottom: '4px',
    padding: '0 5px',
  },
  messageText: {
    margin: 0,
  },
  messageForm: {
    display: 'flex',
    padding: '10px',
    borderTop: '1px solid #dddfe2',
  },
  messageInput: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '20px',
    marginRight: '10px',
  },
  sendButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '20px',
    backgroundColor: '#1877f2',
    color: 'white',
    cursor: 'pointer',
  }
};

export default App;
