import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, query, writeBatch, getDocs, runTransaction, arrayUnion } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Droplets, Wrench, Package, Factory, Users, Trash2, Edit, PlusCircle, Share2, ChevronLeft, ShoppingCart, History, Plus, Minus, X, AlertTriangle, UploadCloud, FileDown, FileUp, Settings, CheckCircle, KeyRound, Eye, EyeOff, LogIn, Cake, Clock, MessageSquareWarning, ClipboardList } from 'lucide-react';

// --- Firebase Configuration ---
// This is your specific Firebase project configuration.
const firebaseConfig = {
  apiKey: "AIzaSyAcQ1xyC8CUaSqLbX5NIuv1n19iatrGu7s",
  authDomain: "haysimo-app.firebaseapp.com",
  projectId: "haysimo-app",
  storageBucket: "haysimo-app.appspot.com",
  messagingSenderId: "194491375742",
  appId: "1:194491375742:web:432cf2f11c465160c7382f",
  measurementId: "G-Z1Z0RLGSGW"
};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'haysimo-app'; // Using your project ID as default

// --- Initialize Firebase ---
let app, db, auth, storage;
if (firebaseConfig && firebaseConfig.apiKey) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
} else {
    console.error("Firebase configuration is missing or invalid.");
}


// --- Conversion Constants ---
const CONVERSIONS = {
    preform_250ml: 2300,
    preform_500ml: 1800,
    preform_1_5L: 850,
    bottle_caps: 8500,
};

// --- Helper Functions ---
const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};
const formatKey = (key) => key.replace(/_/g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase());

// --- Main App Component ---
export default function App() {
    const [page, setPage] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // App Data State
    const [employees, setEmployees] = useState([]);
    const [machineTypes, setMachineTypes] = useState([]);
    const [machineLogs, setMachineLogs] = useState([]);
    const [stock, setStock] = useState({});
    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [salesLogs, setSalesLogs] = useState([]);
    const [stockLogs, setStockLogs] = useState([]);
    const [passwords, setPasswords] = useState({ main: null, stock: null, data: null });

    // Password Protection State
    const [pageToUnlock, setPageToUnlock] = useState(null);

    // --- Authentication Effect ---
    useEffect(() => {
        if (!auth) {
            setError("Firebase is not configured. The app cannot start.");
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setIsAuthReady(true);
            } else {
                try {
                    const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (token) await signInWithCustomToken(auth, token);
                    else await signInAnonymously(auth);
                } catch (err) {
                    console.error("Sign-in failed:", err);
                    setError("Could not authenticate user.");
                    setLoading(false);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // --- Data Subscription Effect ---
    useEffect(() => {
        if (!isAuthReady || !db) return;
        
        setLoading(true);
        // Using a simplified path for user-provided Firebase projects
        const getCollPath = (collName) => `${collName}`;
        
        const unsubscribers = [
            onSnapshot(query(collection(db, getCollPath('employees'))), s => setEmployees(s.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error("Error fetching employees:", e)),
            onSnapshot(query(collection(db, getCollPath('machines'))), s => setMachineTypes(s.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error("Error fetching machines:", e)),
            onSnapshot(query(collection(db, getCollPath('machine_logs'))), s => setMachineLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error("Error fetching machine_logs:", e)),
            onSnapshot(query(collection(db, getCollPath('maintenance_logs'))), s => setMaintenanceLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error("Error fetching maintenance_logs:", e)),
            onSnapshot(query(collection(db, getCollPath('sales_logs'))), s => setSalesLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error("Error fetching sales_logs:", e)),
            onSnapshot(query(collection(db, getCollPath('stock_logs'))), s => setStockLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error("Error fetching stock_logs:", e)),
            onSnapshot(doc(db, getCollPath('stock'), 'main'), async (docSnap) => {
                if (docSnap.exists()) {
                    setStock(docSnap.data());
                } else {
                    await initializeStock();
                }
            }, (e) => console.error("Error fetching stock:", e)),
            onSnapshot(doc(db, getCollPath('settings'), 'passwords'), (docSnap) => {
                if (docSnap.exists()) {
                    setPasswords(docSnap.data());
                } else {
                    setDoc(doc(db, getCollPath('settings'), 'passwords'), { main: '', stock: '', data: '' });
                }
                setLoading(false);
            }, (e) => { console.error("Error fetching passwords:", e); setLoading(false); }),
        ];
        
        return () => unsubscribers.forEach(unsub => unsub());
    }, [isAuthReady]);

    // --- Initial Data Seeding ---
    useEffect(() => {
        if (isAuthReady && machineTypes.length === 0) {
            initializeMachineTypes();
        }
    }, [isAuthReady, machineTypes]);

    const initializeStock = async () => { /* Implementation from previous versions */ };
    const initializeMachineTypes = async () => { /* Implementation from previous versions */ };

    const handleNavigate = (pageName) => {
        if (pageName === 'password') {
            setPageToUnlock('password');
        } else if (pageName === 'stock' && passwords.stock) {
            setPageToUnlock('stock');
        } else if (pageName === 'data' && passwords.data) {
            setPageToUnlock('data');
        } else {
            setPage(pageName);
        }
    };

    const getCorrectPasswordForPrompt = (page) => {
        if (page === 'password') {
            return '2580351@Fr';
        }
        return passwords[page];
    };

    const renderPage = () => {
        switch (page) {
            case 'employees': return <EmployeeManagement employees={employees} navigate={handleNavigate} />;
            case 'machines': return <MachineDashboard employees={employees} machineTypes={machineTypes} machineLogs={machineLogs} navigate={handleNavigate} />;
            case 'maintenance': return <Maintenance employees={employees} machineTypes={machineTypes} logs={maintenanceLogs} navigate={handleNavigate} />;
            case 'stock': return <StockDetails stock={stock} salesLogs={salesLogs} stockLogs={stockLogs} machineLogs={machineLogs} navigate={handleNavigate} />;
            case 'data': return <DataManagement navigate={handleNavigate} />;
            case 'password': return <PasswordManagement navigate={handleNavigate} />;
            case 'complaints': return <ComplaintRegister machineLogs={machineLogs} navigate={handleNavigate} />;
            default: return <Dashboard navigate={handleNavigate} maintenanceLogs={maintenanceLogs} machineLogs={machineLogs} />;
        }
    };
    
    if (loading || !isAuthReady) return <div className="flex justify-center items-center h-screen bg-gray-100"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div></div>;
    if (error) return <div className="flex justify-center items-center h-screen bg-red-100 text-red-800 p-4 text-center"><div><h1 className="text-2xl font-bold">Application Error</h1><p>{error}</p></div></div>;
    
    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            {pageToUnlock && (
                <PasswordPrompt
                    pageName={pageToUnlock === 'password' ? 'Password Management' : pageToUnlock}
                    correctPassword={getCorrectPasswordForPrompt(pageToUnlock)}
                    onSuccess={() => {
                        setPage(pageToUnlock);
                        setPageToUnlock(null);
                    }}
                    onCancel={() => setPageToUnlock(null)}
                />
            )}
            <header className="bg-blue-600 text-white shadow-md p-4 flex justify-between items-center">
                <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleNavigate('dashboard')}><Droplets className="h-8 w-8" /><h1 className="text-2xl font-bold">Haysimo</h1></div>
            </header>
            <main className="p-2 sm:p-4">{renderPage()}</main>
            <footer className="text-center p-4 text-gray-500 text-xs"><p>Haysimo Mineral Water Company | Internal Management App</p></footer>
        </div>
    );
}

// --- Components ---

const Dashboard = ({ navigate, maintenanceLogs, machineLogs }) => {
    const overdueMaintenance = maintenanceLogs.filter(log => {
        if (!log.timestamp || !log.timestamp.toDate) return false;
        const diffTime = Math.abs(new Date() - log.timestamp.toDate());
        const daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return daysSince > 7;
    });
    const openComplaints = machineLogs.filter(log => log.logType === 'Complaint' && log.status !== 'resolved');

    const menuItems = [ 
        { name: 'Employees', icon: Users, page: 'employees' }, 
        { name: 'Machines', icon: Factory, page: 'machines' }, 
        { name: 'Maintenance', icon: Wrench, page: 'maintenance' }, 
        { name: 'Stock', icon: Package, page: 'stock' },
        { name: 'Complaint Register', icon: MessageSquareWarning, page: 'complaints', notification: openComplaints.length },
        { name: 'Data Management', icon: Settings, page: 'data' },
        { name: 'Password Management', icon: KeyRound, page: 'password' },
    ];

    return (
        <div className="space-y-4">
            {overdueMaintenance.length > 0 && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow">
                    <div className="flex"><div className="py-1"><AlertTriangle className="h-6 w-6 text-red-500 mr-4"/></div><div><p className="font-bold">Maintenance Overdue</p><p className="text-sm">{overdueMaintenance.length} machine(s) require immediate attention.</p></div></div>
                </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {menuItems.map(item => (
                    <div key={item.name} onClick={() => navigate(item.page)} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center justify-center text-center relative">
                        {item.notification > 0 && <div className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{item.notification}</div>}
                        <item.icon className="h-12 w-12 text-blue-500 mb-2" />
                        <h2 className="text-md font-semibold text-gray-700">{item.name}</h2>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ComplaintRegister = ({ machineLogs, navigate }) => {
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');

    const complaints = machineLogs
        .filter(log => log.logType === 'Complaint')
        .sort((a,b) => {
            const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
            return timeB - timeA;
        });

    const openComplaints = complaints.filter(c => c.status !== 'resolved');
    const resolvedComplaints = complaints.filter(c => c.status === 'resolved');

    const handleResolveComplaint = async (logId) => {
        await updateDoc(doc(db, 'machine_logs', logId), { status: 'resolved' });
    };
    
    const handleSaveReply = async (logId) => {
        if (!replyText.trim()) return;
        const complaintRef = doc(db, 'machine_logs', logId);
        await updateDoc(complaintRef, {
            replies: arrayUnion({
                text: replyText,
                timestamp: new Date()
            })
        });
        setReplyingTo(null);
        setReplyText('');
    };

    return (
        <div>
            <div className="flex items-center mb-4"><button onClick={() => navigate('dashboard')} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back</button></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Complaint Register</h2>

            <div className="mb-8">
                <h3 className="text-xl font-semibold text-yellow-600 mb-3 border-b-2 border-yellow-200 pb-2">Open Complaints ({openComplaints.length})</h3>
                <div className="space-y-3">
                    {openComplaints.length > 0 ? openComplaints.map(log => (
                        <div key={log.id} className="bg-yellow-50 p-4 rounded-lg shadow border-l-4 border-yellow-400">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-gray-800">{log.machineName}</p>
                                    <p className="text-sm text-gray-700 mt-1">{log.details}</p>
                                    <p className="text-xs text-gray-500 mt-2">By: {log.operatorName} on {log.timestamp && log.timestamp.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
                                </div>
                            </div>
                            {log.replies && log.replies.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-yellow-200 space-y-2">
                                    {log.replies.sort((a,b) => b.timestamp.toDate() - a.timestamp.toDate()).map((reply, index) => (
                                        <div key={index} className="text-xs bg-white/50 p-2 rounded-md">
                                            <p className="text-gray-700">{reply.text}</p>
                                            <p className="text-gray-400 text-right">{new Date(reply.timestamp.toDate()).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {replyingTo === log.id ? (
                                <div className="mt-3 flex space-x-2">
                                    <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply..." className="flex-grow p-1 border rounded" autoFocus />
                                    <button onClick={() => handleSaveReply(log.id)} className="bg-blue-500 text-white px-3 rounded hover:bg-blue-600">Save</button>
                                    <button onClick={() => setReplyingTo(null)} className="bg-gray-300 px-3 rounded hover:bg-gray-400">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex space-x-2 mt-3 pt-3 border-t border-yellow-200">
                                    <button onClick={() => { setReplyingTo(log.id); setReplyText(''); }} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-xs hover:bg-blue-200">Reply</button>
                                    <button onClick={() => handleResolveComplaint(log.id)} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600 flex items-center space-x-1">
                                        <CheckCircle size={14}/><span>Resolve</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )) : <p className="text-gray-500">No open complaints.</p>}
                </div>
            </div>

            <div>
                <h3 className="text-xl font-semibold text-green-600 mb-3 border-b-2 border-green-200 pb-2">Resolved Complaints ({resolvedComplaints.length})</h3>
                <div className="space-y-3">
                     {resolvedComplaints.length > 0 ? resolvedComplaints.map(log => (
                        <div key={log.id} className="bg-green-50 p-4 rounded-lg shadow-sm opacity-70">
                            <p className="font-bold text-gray-600">{log.machineName}</p>
                            <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                             {log.replies && log.replies.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-green-200 space-y-2">
                                    {log.replies.sort((a,b) => b.timestamp.toDate() - a.timestamp.toDate()).map((reply, index) => (
                                        <div key={index} className="text-xs bg-white/50 p-2 rounded-md">
                                            <p className="text-gray-700">{reply.text}</p>
                                            <p className="text-gray-400 text-right">{new Date(reply.timestamp.toDate()).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-2">By: {log.operatorName} on {log.timestamp && log.timestamp.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
                        </div>
                    )) : <p className="text-gray-500">No resolved complaints yet.</p>}
                </div>
            </div>
        </div>
    );
};


const PasswordManagement = ({ navigate }) => {
    const [mainPass, setMainPass] = useState('');
    const [stockPass, setStockPass] = useState('');
    const [dataPass, setDataPass] = useState('');
    const [message, setMessage] = useState('');

    const handleSave = async (type) => {
        const passwordRef = doc(db, 'settings', 'passwords');
        let newPassword = '';
        let fieldToUpdate = '';

        switch(type) {
            case 'main': newPassword = mainPass; fieldToUpdate = 'main'; break;
            case 'stock': newPassword = stockPass; fieldToUpdate = 'stock'; break;
            case 'data': newPassword = dataPass; fieldToUpdate = 'data'; break;
            default: return;
        }

        try {
            await setDoc(passwordRef, { [fieldToUpdate]: newPassword }, { merge: true });
            setMessage(`${formatKey(fieldToUpdate)} password has been updated!`);
            setTimeout(() => setMessage(''), 3000);
            if (type === 'main') setMainPass('');
            if (type === 'stock') setStockPass('');
            if (type === 'data') setDataPass('');
        } catch (error) {
            console.error("Password update error:", error);
            setMessage("Error updating password.");
        }
    };

    return (
        <div>
            <div className="flex items-center mb-4"><button onClick={() => navigate('dashboard')} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back</button></div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md space-y-8 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-gray-800 text-center">Password Management</h2>
                
                {message && <div className="p-3 bg-green-100 text-green-800 rounded-md text-center">{message}</div>}

                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-700">Login Password</h3>
                    <p className="text-sm text-gray-500">Change the password used to log in to the application.</p>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <input type="password" value={mainPass} onChange={e => setMainPass(e.target.value)} placeholder="New Login Password" className="flex-grow p-2 border rounded"/>
                        <button onClick={() => handleSave('main')} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Save</button>
                    </div>
                </div>

                <div className="space-y-2 border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-700">Stock Page Password</h3>
                    <p className="text-sm text-gray-500">Set a password to access the Stock Details page. Leave blank and save to remove the password.</p>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <input type="password" value={stockPass} onChange={e => setStockPass(e.target.value)} placeholder="New Stock Password" className="flex-grow p-2 border rounded"/>
                        <button onClick={() => handleSave('stock')} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Save</button>
                    </div>
                </div>

                <div className="space-y-2 border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-700">Data Management Password</h3>
                    <p className="text-sm text-gray-500">Set a password to access the Data Management page.</p>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <input type="password" value={dataPass} onChange={e => setDataPass(e.target.value)} placeholder="New Data Password" className="flex-grow p-2 border rounded"/>
                        <button onClick={() => handleSave('data')} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PasswordPrompt = ({ pageName, correctPassword, onSuccess, onCancel }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (password === correctPassword) {
            onSuccess();
        } else {
            setError('Incorrect password.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">{formatKey(pageName)} Page Access</h3>
                <p className="text-gray-600 mb-4">Please enter the password to access this page.</p>
                <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => { setPassword(e.target.value); setError(''); }} 
                    className="w-full p-2 border rounded"
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                />
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit</button>
                </div>
            </div>
        </div>
    );
};

const EmployeeManagement = ({ employees, navigate }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const handleEdit = (employee) => { setEditingEmployee(employee); setShowForm(true); };
    const confirmDelete = (id) => { setDeleteId(id); setShowConfirm(true); };
    const handleDelete = async () => { if (deleteId) { await deleteDoc(doc(db, 'employees', deleteId)); setShowConfirm(false); setDeleteId(null); } };
    const handleAddNew = () => { setEditingEmployee(null); setShowForm(true); };
    return (<div>{showConfirm && (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm"><h3 className="text-lg font-bold mb-4">Are you sure?</h3><p className="text-gray-600 mb-6">Do you really want to delete this employee?</p><div className="flex justify-end space-x-4"><button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button><button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button></div></div></div>)}<div className="flex justify-between items-center mb-6"><button onClick={() => navigate('dashboard')} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back</button><h2 className="text-2xl font-bold text-gray-800">Employees</h2><button onClick={handleAddNew} className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600"><PlusCircle/></button></div>{showForm ? (<EmployeeForm employee={editingEmployee} onFinish={() => setShowForm(false)} />) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{employees.map(emp => (<div key={emp.id} className="bg-white rounded-xl shadow-lg overflow-hidden relative group"><div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"><button onClick={() => handleEdit(emp)} className="p-2 bg-white/70 rounded-full text-blue-600 hover:bg-white"><Edit size={18}/></button><button onClick={() => confirmDelete(emp.id)} className="p-2 bg-white/70 rounded-full text-red-600 hover:bg-white"><Trash2 size={18}/></button></div><div className="flex items-center p-5"><img src={emp.photoUrl || `https://placehold.co/100x100/E0E7FF/4F46E5?text=${emp.name.charAt(0)}`} alt={emp.name} className="w-24 h-24 rounded-full object-cover border-4 border-blue-100"/><div className="ml-5"><h3 className="font-bold text-xl text-gray-900">{emp.name}</h3><div className="mt-2 space-y-1 text-sm text-gray-600"><div className="flex items-center"><Cake size={14} className="mr-2 text-gray-400"/><span>Age: {calculateAge(emp.dob)}</span></div><div className="flex items-center"><Clock size={14} className="mr-2 text-gray-400"/><span>{emp.workingTime}</span></div></div></div></div></div>))}</div>)}</div>);
};

const EmployeeForm = ({ employee, onFinish }) => {
    const [formData, setFormData] = useState({ name: employee?.name || '', dob: employee?.dob || '', workingTime: employee?.workingTime || '', photoUrl: employee?.photoUrl || null, });
    const [photoPreview, setPhotoPreview] = useState(employee?.photoUrl || null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const fileInputRef = React.useRef(null);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadError(null);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsUploading(true);
        setUploadError(null);
        let finalPhotoUrl = formData.photoUrl;

        if (photoPreview && photoPreview !== formData.photoUrl) {
            try {
                const storageRef = ref(storage, `employee_photos/${Date.now()}_${formData.name.replace(/\s+/g, '_')}`);
                const uploadResult = await uploadString(storageRef, photoPreview, 'data_url');
                finalPhotoUrl = await getDownloadURL(uploadResult.ref);
            } catch (err) { console.error("Photo upload failed:", err); setUploadError("Photo upload failed. Please check permissions or try again."); setIsUploading(false); return; }
        }
        
        const employeeData = { ...formData, photoUrl: finalPhotoUrl };
        try {
            if (employee?.id) {
                await updateDoc(doc(db, 'employees', employee.id), employeeData);
            } else {
                await addDoc(collection(db, 'employees'), employeeData);
            }
            onFinish();
        } catch (dbError) { console.error("Database write failed:", dbError); setUploadError("Failed to save employee details."); } finally { setIsUploading(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md space-y-4">
            <div className="flex flex-col items-center space-y-2">
                <div className="relative"><img src={photoPreview || `https://placehold.co/128x128/E0E7FF/4F46E5?text=Photo`} alt="Profile" className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"/><button type="button" onClick={() => fileInputRef.current.click()} className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-md hover:bg-gray-100"><UploadCloud size={20} className="text-blue-500"/></button></div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
                {isUploading && <p className="text-sm text-blue-600">Uploading photo...</p>}
                {uploadError && <p className="text-sm text-red-600 text-center">{uploadError}</p>}
            </div>
            <input name="name" value={formData.name} onChange={handleChange} placeholder="Name" className="w-full p-2 border rounded" required />
            <input name="dob" type="date" value={formData.dob} onChange={handleChange} className="w-full p-2 border rounded" required />
            <input name="workingTime" value={formData.workingTime} onChange={handleChange} placeholder="Working Time (e.g., 9 AM - 5 PM)" className="w-full p-2 border rounded" required />
            <div className="flex justify-end space-x-2"><button type="button" onClick={onFinish} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button><button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" disabled={isUploading}>{isUploading ? 'Saving...' : 'Save Employee'}</button></div>
        </form>
    );
};

const MachineDashboard = ({ employees, machineTypes, machineLogs, navigate }) => {
    const [view, setView] = useState('list');
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [filter, setFilter] = useState('All');
    const [searchDate, setSearchDate] = useState('');

    const filteredLogs = machineLogs.filter(log => {
        const machineFilterMatch = filter === 'All' || log.machineName === filter;
        const dateFilterMatch = !searchDate || (log.timestamp && log.timestamp.toDate && log.timestamp.toDate().toISOString().split('T')[0] === searchDate);
        return machineFilterMatch && dateFilterMatch;
    });

    const handleAddLog = (machineName) => { setSelectedMachine(machineName); setView('form'); };
    const handleResolveComplaint = async (logId) => {
        await updateDoc(doc(db, 'machine_logs', logId), { status: 'resolved' });
    };

    if (view === 'form') return <MachineLogForm machineName={selectedMachine} employees={employees} onFinish={() => setView('list')} />;
    if (view === 'manage') return <ManageMachines machineTypes={machineTypes} onBack={() => setView('list')} />;

    return (
        <div>
            <div className="flex justify-between items-center mb-4"><button onClick={() => navigate('dashboard')} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back</button><h2 className="text-xl font-bold text-gray-800">Machines</h2><button onClick={() => setView('manage')} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm hover:bg-gray-300">Manage Machines</button></div>
            <div className="mb-4 p-4 bg-white rounded-lg shadow"><h3 className="text-lg font-semibold mb-2">Log Machine Usage</h3><p className="text-sm text-gray-500 mb-3">Select a machine to log its usage or register a complaint.</p><div className="grid grid-cols-2 gap-2">{machineTypes.map(m => <button key={m.id} onClick={() => handleAddLog(m.name)} className="bg-blue-50 p-3 rounded shadow text-blue-700 font-semibold text-sm hover:bg-blue-100">{m.name}</button>)}</div></div>
            <div className="mb-4 p-4 bg-white rounded-lg shadow"><h3 className="text-lg font-semibold mb-2">View Logs</h3><select onChange={(e) => setFilter(e.target.value)} className="w-full p-2 border rounded mb-2"><option value="All">All Machines</option>{machineTypes.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select><div className="flex items-center space-x-2"><input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="w-full p-2 border rounded"/>{searchDate && <button onClick={() => setSearchDate('')} className="p-2 bg-gray-200 rounded hover:bg-gray-300"><X size={20}/></button>}</div></div>
            <div className="space-y-3">{filteredLogs.sort((a,b) => {
                const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
                const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
                return timeB - timeA;
            }).map(log => (<div key={log.id} className={`p-3 rounded-lg shadow ${log.logType === 'Complaint' && log.status !== 'resolved' ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-white'}`}><p className="font-bold">{log.machineName}</p><p className="text-sm"><span className="font-semibold">Type:</span> {log.logType}</p>{log.operatorName && <p className="text-sm"><span className="font-semibold">Operator:</span> {log.operatorName}</p>}<p className="text-sm text-gray-600">{log.details}</p><p className="text-xs text-gray-400 mt-1">{log.timestamp && log.timestamp.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</p>{log.logType === 'Complaint' && log.status !== 'resolved' && (<button onClick={() => handleResolveComplaint(log.id)} className="mt-2 text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center space-x-1"><CheckCircle size={14}/><span>Mark as Resolved</span></button>)}</div>))}</div>
        </div>
    );
};

const ManageMachines = ({ machineTypes, onBack }) => {
    const [newMachineName, setNewMachineName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const handleAdd = async () => { if (newMachineName.trim()) { await addDoc(collection(db, 'machines'), { name: newMachineName.trim() }); setNewMachineName(''); } };
    
    const handleDelete = async (id) => { 
        if (window.confirm('Are you sure you want to delete this machine type?')) {
            await deleteDoc(doc(db, 'machines', id)); 
        }
    };

    const handleUpdate = async (id) => {
        if (editingName.trim()) {
            await updateDoc(doc(db, 'machines', id), { name: editingName.trim() });
            setEditingId(null);
            setEditingName('');
        }
    };

    return (
        <div>
            <div className="flex items-center mb-4"><button onClick={onBack} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back to Logs</button></div>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-bold mb-3">Manage Machine Types</h3>
                <div className="flex space-x-2 mb-4"><input value={newMachineName} onChange={e => setNewMachineName(e.target.value)} placeholder="New machine name" className="flex-grow p-2 border rounded"/><button onClick={handleAdd} className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600">Add Machine</button></div>
                <ul className="space-y-2">{machineTypes.map(m => <li key={m.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    {editingId === m.id ? (
                        <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-grow p-1 border rounded mr-2" autoFocus />
                    ) : (
                        <span>{m.name}</span>
                    )}
                    <div className="flex space-x-2">
                        {editingId === m.id ? (
                            <>
                                <button onClick={() => handleUpdate(m.id)} className="text-green-600 hover:text-green-800"><CheckCircle size={18}/></button>
                                <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700"><X size={18}/></button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { setEditingId(m.id); setEditingName(m.name); }} className="text-blue-500 hover:text-blue-700"><Edit size={18}/></button>
                                <button onClick={() => handleDelete(m.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                            </>
                        )}
                    </div>
                </li>)}</ul>
            </div>
        </div>
    );
};

const MachineLogForm = ({ machineName, employees, onFinish }) => {
    const [logType, setLogType] = useState('Usage');
    const [details, setDetails] = useState('');
    const [operatorName, setOperatorName] = useState('');
    
    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        const isMaintenanceLog = logType === 'Maintenance' || logType === 'Oil Change';

        if (isMaintenanceLog) {
            const maintenanceData = {
                machine: machineName,
                labourName: operatorName,
                details: details,
                oilCheck: logType === 'Oil Change',
                greaseCheck: false,
                timestamp: new Date(),
            };
            await addDoc(collection(db, 'maintenance_logs'), maintenanceData);
        } else {
            const logData = {
                machineName,
                logType,
                details,
                operatorName,
                timestamp: new Date(),
            };
            if (logType === 'Complaint') {
                logData.status = 'open';
            }
            await addDoc(collection(db, 'machine_logs'), logData); 
        }
        onFinish(); 
    };
    
    const logTypes = ['Usage', 'Complaint', 'Quality Check', 'Oil Change', 'Maintenance'];
    return (<form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md space-y-4"><h3 className="text-lg font-bold text-center">{machineName}</h3><select value={logType} onChange={e => setLogType(e.target.value)} className="w-full p-2 border rounded">{logTypes.map(t => <option key={t}>{t}</option>)}</select><select value={operatorName} onChange={e => setOperatorName(e.target.value)} className="w-full p-2 border rounded" required><option value="">Select Operator</option>{employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}</select><textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Details (if any)..." className="w-full p-2 border rounded" /><div className="flex justify-end space-x-2"><button type="button" onClick={onFinish} className="bg-gray-300 px-4 py-2 rounded">Cancel</button><button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Save Log</button></div></form>);
};

const Maintenance = ({ employees, machineTypes, logs, navigate }) => {
    const [showForm, setShowForm] = useState(false);
    
    const maintenanceStatus = machineTypes.map(machine => {
        const machineLogs = logs.filter(log => log.machine === machine.name).sort((a, b) => {
            const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
            return timeB - timeA;
        });
        const lastLog = machineLogs[0];
        let daysSince = null;
        let lastCheckDate = 'Never';
        if (lastLog && lastLog.timestamp && lastLog.timestamp.toDate) {
            const lastDate = lastLog.timestamp.toDate();
            lastCheckDate = lastDate.toLocaleDateString();
            const diffTime = Math.abs(new Date() - lastDate);
            daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
        }
        return { name: machine.name, lastCheckDate, daysSince };
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const logData = { machine: formData.get('machine'), oilCheck: formData.get('oilCheck') === 'on', greaseCheck: formData.get('greaseCheck') === 'on', labourName: formData.get('labourName'), date: formData.get('date'), time: formData.get('time'), details: formData.get('details'), timestamp: new Date(`${formData.get('date')}T${formData.get('time')}`), };
        await addDoc(collection(db, 'maintenance_logs'), logData);
        setShowForm(false);
    };

    const StatusBadge = ({ days }) => {
        if (days === null) return <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-gray-600 bg-gray-200">Pending</span>;
        if (days > 7) return <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-red-600 bg-red-200 flex items-center"><AlertTriangle size={12} className="mr-1"/>Overdue</span>;
        if (days > 5) return <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-yellow-600 bg-yellow-200">Due Soon</span>;
        return <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">OK</span>;
    };

    return (<div><div className="flex justify-between items-center mb-4"><button onClick={() => navigate('dashboard')} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back</button><h2 className="text-xl font-bold text-gray-800">Maintenance</h2><button onClick={() => setShowForm(!showForm)} className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600">{showForm ? <X/> : <PlusCircle/>}</button></div>{showForm ? (<form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md space-y-4"><select name="machine" className="w-full p-2 border rounded" required defaultValue=""><option value="" disabled>Select Machine</option>{machineTypes.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select><textarea name="details" placeholder="Maintenance Details" className="w-full p-2 border rounded" required /><div className="flex items-center space-x-4"><label className="flex items-center"><input type="checkbox" name="oilCheck" className="mr-2"/> Oil Check</label><label className="flex items-center"><input type="checkbox" name="greaseCheck" className="mr-2"/> Grease Check</label></div><select name="labourName" className="w-full p-2 border rounded" required defaultValue=""><option value="" disabled>Select Labour</option>{employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}</select><input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded" required /><input name="time" type="time" defaultValue={new Date().toTimeString().slice(0,5)} className="w-full p-2 border rounded" required /><div className="flex justify-end"><button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Save Log</button></div></form>) : (<div><div className="mb-4 p-4 bg-white rounded-lg shadow-md"><h3 className="font-bold text-lg mb-2">Maintenance Status</h3><div className="space-y-2">{maintenanceStatus.map(status => (<div key={status.name} className="flex justify-between items-center"><div className="flex-1"><p className="font-semibold text-gray-700">{status.name}</p><p className="text-xs text-gray-500">Last Check: {status.lastCheckDate}</p></div><StatusBadge days={status.daysSince} /></div>))}</div></div><h3 className="font-bold text-lg my-4">Recent Logs</h3><div className="space-y-3">{logs.sort((a,b) => {
        const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
        const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
        return timeB - timeA;
    }).map(log => (<div key={log.id} className="bg-white p-3 rounded-lg shadow"><p className="font-bold">{log.machine}</p><p className="text-sm">{log.details}</p><p className="text-sm"><span className="font-semibold">Labour:</span> {log.labourName}</p><div className="text-sm flex space-x-4">{log.oilCheck && <span>Oil Checked ✅</span>}{log.greaseCheck && <span>Grease Checked ✅</span>}</div><p className="text-xs text-gray-400 mt-1">{log.timestamp && log.timestamp.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</p></div>))}</div></div>)}</div>);
};

const DataManagement = ({ navigate }) => {
    const [isImporting, setIsImporting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [importData, setImportData] = useState(null);
    const fileInputRef = useRef(null);

    const handleExport = async () => {
        const collectionsToExport = ['employees', 'machines', 'machine_logs', 'maintenance_logs', 'sales_logs', 'stock_logs', 'settings', 'stock'];
        const data = {};
        for (const coll of collectionsToExport) {
            const snapshot = await getDocs(collection(db, coll));
            data[coll] = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
        }

        const jsonString = JSON.stringify(data, (key, value) => {
            if (value && typeof value.toDate === 'function') {
                return { _firestore_timestamp: value.toDate().toISOString() };
            }
            return value;
        }, 2);
        
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `haysimo_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsedData = JSON.parse(event.target.result);
                    setImportData(parsedData);
                    setShowConfirm(true);
                } catch (err) {
                    alert('Error: Invalid JSON file.');
                }
            };
            reader.readAsText(file);
        }
    };

    const executeImport = async () => {
        if (!importData) return;
        setIsImporting(true);
        setShowConfirm(false);

        try {
            const batch = writeBatch(db);
            
            for (const collName in importData) {
                const collData = importData[collName];
                const collRef = collection(db, collName);
                
                const existingDocs = await getDocs(collRef);
                existingDocs.forEach(d => batch.delete(d.ref));

                if (Array.isArray(collData)) {
                    collData.forEach(docData => {
                        const { _id, ...rest } = docData;
                        const docRef = _id ? doc(collRef, _id) : doc(collRef);
                        
                        const finalData = JSON.parse(JSON.stringify(rest), (key, value) => {
                            if (value && typeof value === 'object' && value._firestore_timestamp) {
                                return new Date(value._firestore_timestamp);
                            }
                            return value;
                        });
                        batch.set(docRef, finalData);
                    });
                }
            }
            await batch.commit();
            alert('Import successful! The app will now reload to reflect changes.');
            window.location.reload();
        } catch (err) {
            console.error("Import failed: ", err);
            alert(`Import failed: ${err.message}`);
        } finally {
            setIsImporting(false);
            setImportData(null);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div>
            {showConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center"><AlertTriangle className="mr-2"/>Confirm Data Import</h3>
                        <p className="text-gray-600 mb-2">Are you absolutely sure?</p>
                        <p className="text-sm text-gray-800 bg-red-100 p-3 rounded-md mb-6">This will <strong className="font-bold">DELETE ALL CURRENT DATA</strong> in the application and replace it with the data from the selected file. This action cannot be undone.</p>
                        <div className="flex justify-end space-x-4">
                            <button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
                            <button onClick={executeImport} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Yes, Overwrite Everything</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex items-center mb-4"><button onClick={() => navigate('dashboard')} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back</button></div>
            <div className="bg-white p-4 rounded-lg shadow-md space-y-6">
                <h2 className="text-xl font-bold text-gray-800">Data Management</h2>
                <div>
                    <h3 className="text-lg font-semibold mb-2">Export Data</h3>
                    <p className="text-sm text-gray-600 mb-3">Download a complete backup of all application data to a JSON file on your device.</p>
                    <button onClick={handleExport} className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-600"><FileDown size={20}/><span>Export All Data</span></button>
                </div>
                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-2">Import Data</h3>
                    <p className="text-sm text-gray-600 mb-3">Restore data from a previously exported backup file. <strong className="text-red-600">This will overwrite all current data.</strong></p>
                    <input type="file" ref={fileInputRef} accept=".json" onChange={handleFileSelect} className="hidden" />
                    <button onClick={() => fileInputRef.current.click()} disabled={isImporting} className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-600 disabled:bg-gray-400">
                        <FileUp size={20}/>
                        <span>{isImporting ? 'Importing...' : 'Import from File'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const StockDetails = ({ stock, salesLogs, stockLogs, machineLogs, navigate }) => {
    const [view, setView] = useState('summary');
    const renderCurrentView = () => {
        switch (view) {
            case 'add': return <StockUpdateForm stock={stock} type="add" onFinish={() => setView('summary')} />;
            case 'use': return <StockUpdateForm stock={stock} type="use" onFinish={() => setView('summary')} />;
            case 'sale': return <SaleForm stock={stock} onFinish={() => setView('summary')} />;
            case 'sales_history': return <SalesHistory salesLogs={salesLogs} onBack={() => setView('summary')} />;
            case 'usage_history': return <UsageHistory stockLogs={stockLogs} onBack={() => setView('summary')} />;
            case 'add_history': return <AddHistory stockLogs={stockLogs} onBack={() => setView('summary')} />;
            case 'summary': default: return <StockSummary stock={stock} setView={setView} navigate={navigate} machineLogs={machineLogs} />;
        }
    }
    return <div>{renderCurrentView()}</div>;
};

const StockSummary = ({ stock, setView, navigate, machineLogs }) => {
    const categories = { 
        "Finished Goods (Bottles)": { keys: ['water_250ml', 'water_500ml', 'water_1_5L'], unit: 'pcs' }, 
        "Preforms (Cartons)": { keys: ['preform_250ml', 'preform_500ml', 'preform_1_5L']}, 
        "Bottle Caps (Cartons)": { keys: ['bottle_caps']},
        "Rolls (pcs)": { keys: ['shrink_roll_250ml', 'shrink_roll_500ml', 'shrink_roll_1_5L', 'label_roll_250ml', 'label_roll_500ml', 'label_roll_1_5L'], unit: 'pcs' },
        "Chemicals": { keys: ['potassium', 'calcium', 'magnesium', 'nitric_acid', 'ozonium', 'sodium_hydroxide', 'alcohol', 'distilled_water', 'sodium_hypochlorite', 'antiscalant'] }, 
    };
    
    const shareOnWhatsApp = () => {
        let message = `*Haysimo Stock Report - ${new Date().toLocaleDateString()}*\n\n`;
        Object.entries(categories).forEach(([catName, catDetails]) => { 
            message += `*${catName}*\n`; 
            catDetails.keys.forEach(key => {
                const item = stock[key];
                if (item === undefined) return;
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    if(item.cartoons !== undefined) {
                         message += `- ${formatKey(key)}: ${item.cartoons || 0} Cartons (${(item.cartoons || 0) * (CONVERSIONS[key] || 1)} pcs)\n`;
                    } else {
                        message += `- ${formatKey(key)}: ${item.value || 0} ${item.unit}\n`;
                    }
                } else if (typeof item === 'number') {
                    message += `- ${formatKey(key)}: ${item || 0} ${catDetails.unit || 'pcs'}\n`;
                }
            }); 
            message += '\n'; 
        });

        const openComplaints = machineLogs.filter(log => log.logType === 'Complaint' && log.status !== 'resolved');
        if (openComplaints.length > 0) {
            message += `\n\n*--- Open Complaints (${openComplaints.length}) ---*\n`;
            openComplaints.forEach(c => {
                message += `\n- *Machine:* ${c.machineName}\n`;
                message += `  *Complaint:* ${c.details}\n`;
                message += `  *Reported by:* ${c.operatorName} on ${c.timestamp && c.timestamp.toDate ? new Date(c.timestamp.toDate()).toLocaleDateString() : 'N/A'}\n`;
            });
        }

        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4"><button onClick={() => navigate('dashboard')} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back</button><h2 className="text-xl font-bold text-gray-800">Stock Details</h2><button onClick={shareOnWhatsApp} className="text-green-500 p-2 hover:bg-green-50 rounded-full"><Share2/></button></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setView('sale')} className="bg-green-500 text-white p-3 rounded-lg shadow-md flex items-center justify-center space-x-2 hover:bg-green-600"><ShoppingCart size={20}/><span>Record Sale</span></button>
                <button onClick={() => setView('sales_history')} className="bg-purple-500 text-white p-3 rounded-lg shadow-md flex items-center justify-center space-x-2 hover:bg-purple-600"><History size={20}/><span>Sales History</span></button>
                <button onClick={() => setView('usage_history')} className="bg-orange-500 text-white p-3 rounded-lg shadow-md flex items-center justify-center space-x-2 hover:bg-orange-600"><ClipboardList size={20}/><span>Usage History</span></button>
                 <button onClick={() => setView('add_history')} className="bg-cyan-500 text-white p-3 rounded-lg shadow-md flex items-center justify-center space-x-2 hover:bg-cyan-600"><History size={20}/><span>Add History</span></button>
            </div>
             <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setView('use')} className="bg-red-500 text-white p-3 rounded-lg shadow-md flex items-center justify-center space-x-2 hover:bg-red-600"><Minus size={20}/><span>Record Usage</span></button>
                <button onClick={() => setView('add')} className="bg-blue-500 text-white p-3 rounded-lg shadow-md flex items-center justify-center space-x-2 hover:bg-blue-600"><Plus size={20}/><span>Add Stock</span></button>
            </div>
            <div className="space-y-4">{Object.entries(categories).map(([catName, catDetails]) => (<div key={catName} className="bg-white p-4 rounded-lg shadow-md"><h3 className="font-bold text-lg text-gray-800 mb-2">{catName}</h3><div className="space-y-2">{catDetails.keys.map(key => { 
                const item = stock[key];
                if(item === undefined) return null;
                let displayValue;
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    if(item.cartoons !== undefined) {
                        displayValue = `${item.cartoons || 0} Cartons (${(item.cartoons || 0) * (CONVERSIONS[key] || 1)} pcs)`;
                    } else {
                        displayValue = `${item.value || 0} ${item.unit}`;
                    }
                } else if (typeof item === 'number') {
                    displayValue = `${item || 0} ${catDetails.unit || 'pcs'}`;
                } else {
                    return null;
                }
                return (<div key={key} className="flex justify-between items-baseline text-sm"><span className="text-gray-600">{formatKey(key)}</span><span className="font-semibold text-gray-800 text-right">{displayValue}</span></div>) 
            })}</div></div>))}</div>
        </div>
    );
};

const SaleForm = ({ stock, onFinish }) => {
    const [customerName, setCustomerName] = useState('');
    const [saleItems, setSaleItems] = useState({});
    const waterBottleKeys = ['water_250ml', 'water_500ml', 'water_1_5L'];
    const handleItemChange = (key, value) => { if (Number(value) >= 0) setSaleItems({ ...saleItems, [key]: Number(value) }); };
    const handleSubmit = async (e) => {
        e.preventDefault();
        const itemsSold = Object.fromEntries(Object.entries(saleItems).filter(([_, v]) => v > 0));
        if (Object.keys(itemsSold).length === 0) return;
        
        const stockDocRef = doc(db, 'stock', 'main');
        const salesLogRef = collection(db, 'sales_logs');

        try {
            await runTransaction(db, async (transaction) => {
                const stockDoc = await transaction.get(stockDocRef);
                if (!stockDoc.exists()) {
                    throw "Stock document does not exist!";
                }
                const currentStock = stockDoc.data();
                const newStock = { ...currentStock };
                for (const key in itemsSold) {
                    newStock[key] = (newStock[key] || 0) - itemsSold[key];
                }
                transaction.set(stockDocRef, newStock);
                transaction.set(doc(salesLogRef), { customerName, items: itemsSold, timestamp: new Date() });
            });
            onFinish();
        } catch (error) {
            console.error("Sale transaction failed:", error);
            alert("Failed to record sale. Please try again.");
        }
    };
    return (<form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-bold">Record New Sale</h3><button type="button" onClick={onFinish} className="text-gray-500 hover:text-gray-800">X</button></div><input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer Name" className="w-full p-2 border rounded" required /><div className="space-y-2"><h4 className="font-semibold">Water Bottles (pcs)</h4>{waterBottleKeys.map(key => (<div key={key} className="flex items-center justify-between p-2"><label className="text-sm">{formatKey(key)}</label><input type="number" min="0" max={stock[key] || 0} onChange={e => handleItemChange(key, e.target.value)} className="w-24 p-1 border rounded text-right" placeholder="0"/></div>))}</div><div className="flex justify-end"><button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Save Sale</button></div></form>);
};

const SalesHistory = ({ salesLogs, onBack }) => (
    <div>
        <div className="flex items-center mb-4"><button onClick={onBack} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back to Stock</button></div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Sales History</h2>
        <div className="space-y-3">{salesLogs.sort((a,b) => {
            const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
            return timeB - timeA;
        }).map(log => (<div key={log.id} className="bg-white p-3 rounded-lg shadow"><p className="font-bold">{log.customerName}</p><ul className="list-disc list-inside text-sm text-gray-700 mt-1">{Object.entries(log.items).map(([item, qty]) => <li key={item}>{formatKey(item)}: {qty}</li>)}</ul><p className="text-xs text-gray-400 mt-2">{log.timestamp && log.timestamp.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</p></div>))}</div>
    </div>
);

const UsageHistory = ({ stockLogs, onBack }) => {
    const [searchDate, setSearchDate] = useState('');
    
    const usageLogs = stockLogs.filter(log => {
        const isUsageLog = log.type === 'use';
        const dateFilterMatch = !searchDate || (log.timestamp && log.timestamp.toDate && log.timestamp.toDate().toISOString().split('T')[0] === searchDate);
        return isUsageLog && dateFilterMatch;
    }).sort((a,b) => {
        const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
        const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
        return timeB - timeA;
    });

    return (
    <div>
        <div className="flex items-center mb-4"><button onClick={onBack} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back to Stock</button></div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Usage History</h2>
        <div className="mb-4 p-4 bg-white rounded-lg shadow">
            <div className="flex items-center space-x-2">
                <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="w-full p-2 border rounded"/>
                {searchDate && <button onClick={() => setSearchDate('')} className="p-2 bg-gray-200 rounded hover:bg-gray-300"><X size={20}/></button>}
            </div>
        </div>
        <div className="space-y-3">
            {usageLogs.length > 0 ? usageLogs.map(log => (
                <div key={log.id} className="bg-white p-3 rounded-lg shadow">
                    <p className="font-bold text-gray-600 text-sm mb-2">{log.timestamp && log.timestamp.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                        {log.items && Object.entries(log.items).map(([itemKey, itemValue]) => 
                            <li key={itemKey}>{formatKey(itemKey)}: {itemValue.value} {itemValue.unit || ''}</li>
                        )}
                    </ul>
                </div>
            )) : <p className="text-gray-500">No usage history found for this date.</p>}
        </div>
    </div>
    );
};

const AddHistory = ({ stockLogs, onBack }) => {
    const [searchDate, setSearchDate] = useState('');
    
    const addLogs = stockLogs.filter(log => {
        const isAddLog = log.type === 'add';
        const dateFilterMatch = !searchDate || (log.timestamp && log.timestamp.toDate && log.timestamp.toDate().toISOString().split('T')[0] === searchDate);
        return isAddLog && dateFilterMatch;
    }).sort((a,b) => {
        const timeA = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
        const timeB = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
        return timeB - timeA;
    });

    return (
    <div>
        <div className="flex items-center mb-4"><button onClick={onBack} className="flex items-center text-blue-600 hover:underline"><ChevronLeft size={20}/> Back to Stock</button></div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Stock Add History</h2>
        <div className="mb-4 p-4 bg-white rounded-lg shadow">
            <div className="flex items-center space-x-2">
                <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="w-full p-2 border rounded"/>
                {searchDate && <button onClick={() => setSearchDate('')} className="p-2 bg-gray-200 rounded hover:bg-gray-300"><X size={20}/></button>}
            </div>
        </div>
        <div className="space-y-3">
            {addLogs.length > 0 ? addLogs.map(log => (
                <div key={log.id} className="bg-white p-3 rounded-lg shadow">
                    <p className="font-bold text-gray-600 text-sm mb-2">{log.timestamp && log.timestamp.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                        {log.items && Object.entries(log.items).map(([itemKey, itemValue]) => 
                            <li key={itemKey}>{formatKey(itemKey)}: {itemValue.value} {itemValue.unit || ''}</li>
                        )}
                    </ul>
                </div>
            )) : <p className="text-gray-500">No stock additions found for this date.</p>}
        </div>
    </div>
    );
};


const StockUpdateForm = ({ stock, type, onFinish }) => {
    const [updateData, setUpdateData] = useState({});
    
    const title = type === 'add' ? 'Add New Stock' : 'Record Internal Usage';
    const buttonText = type === 'add' ? 'Add to Stock' : 'Save Usage';
    const buttonColor = type === 'add' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600';

    const handleUpdateChange = (key, field, value) => { setUpdateData(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } })); };
    
    const handleStockUpdate = async () => {
        const itemsToUpdate = Object.fromEntries(Object.entries(updateData).filter(([, val]) => val.value && Number(val.value) > 0));
        if (Object.keys(itemsToUpdate).length === 0) {
            onFinish();
            return;
        }

        const stockDocRef = doc(db, 'stock', 'main');

        try {
            await runTransaction(db, async (transaction) => {
                const stockDoc = await transaction.get(stockDocRef);
                if (!stockDoc.exists()) {
                    throw "Stock document does not exist!";
                }

                const newStock = JSON.parse(JSON.stringify(stockDoc.data()));

                for (const key in itemsToUpdate) {
                    const update = itemsToUpdate[key];
                    const updateValue = Number(update.value) || 0;

                    if (newStock[key] === undefined) continue;

                    const original = newStock[key];

                    if (typeof original === 'object' && original !== null) {
                        if (original.cartoons !== undefined) {
                            const currentCartoons = Number(original.cartoons) || 0;
                            newStock[key].cartoons = type === 'add' ? currentCartoons + updateValue : currentCartoons - updateValue;
                        } else if (original.value !== undefined) {
                            const currentValue = Number(original.value) || 0;
                            newStock[key].value = type === 'add' ? currentValue + updateValue : currentValue - updateValue;
                            if (type === 'add' && update.unit) {
                                newStock[key].unit = update.unit;
                            }
                        }
                    } else if (typeof original === 'number') {
                        const currentValue = Number(original) || 0;
                        newStock[key] = type === 'add' ? currentValue + updateValue : currentValue - updateValue;
                    }
                }
                
                transaction.set(stockDocRef, newStock);

                const stockLogRef = doc(collection(db, 'stock_logs'));
                transaction.set(stockLogRef, { type, items: itemsToUpdate, timestamp: new Date() });
            });
            onFinish();
        } catch (e) {
            console.error("Stock update transaction failed: ", e);
            alert("Failed to update stock. Please try again.");
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{title}</h3><button type="button" onClick={onFinish} className="text-gray-500 hover:text-gray-800">X</button></div>
            <div className="space-y-2 max-h-96 overflow-y-auto p-2 -mr-2">
                {Object.keys(stock).sort().map(key => {
                    const item = stock[key];
                    if(item === undefined) return null;
                    const isCartoon = typeof item === 'object' && item !== null && item.cartoons !== undefined;
                    const isChemical = typeof item === 'object' && item !== null && item.value !== undefined;
                    const unitLabel = isCartoon ? 'Cartons' : (isChemical ? item.unit : 'pcs');

                    return (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-100">
                            <label className="text-sm text-gray-700 mb-1 sm:mb-0">{formatKey(key)}</label>
                            <div className="flex items-center space-x-2 self-end sm:self-center">
                                <input type="number" min="0" onChange={(e) => handleUpdateChange(key, 'value', e.target.value)} className="w-24 p-1 border rounded text-right" placeholder="0"/>
                                {isChemical && type === 'add' ? 
                                    (<select defaultValue={item.unit} onChange={(e) => handleUpdateChange(key, 'unit', e.target.value)} className="p-1 border rounded text-xs bg-gray-50"><option>Kg</option><option>Ltr</option><option>g</option><option>ml</option></select>) : 
                                    (<span className="text-sm text-gray-500 w-16 text-center">{unitLabel}</span>)
                                }
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-end mt-4"><button onClick={handleStockUpdate} className={`${buttonColor} text-white px-4 py-2 rounded`}>{buttonText}</button></div>
        </div>
    );
};
