import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy, 
  setDoc,
  where
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth, db } from './firebase';
import { Trip, Expense, Settlement, Task, Contribution, GearItem, ItineraryEvent } from './types';
import { calculateSettlements } from './utils/calculations';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Plus, 
  Users, 
  Wallet, 
  Calculator, 
  ArrowRight, 
  LogOut, 
  Share2, 
  TrendingUp, 
  History,
  Trash2,
  ChevronLeft,
  MessageCircle,
  FileText,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  X,
  Utensils,
  Fuel,
  Package,
  ShoppingBag,
  Download,
  Calendar,
  Pencil,
  Image as ImageIcon,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_TRIP_IMAGES = [
  "https://images.unsplash.com/photo-1542144611-13e9049448aa?auto=format&fit=crop&q=80&w=800", // Desert
  "https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=800", // Mountains
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=800", // Camping
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800", // Beach
  "https://images.unsplash.com/photo-1464851707681-f9d5fdaccea8?auto=format&fit=crop&q=80&w=800", // Road Trip
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=800"  // Lake
];

// Error handling helper as required
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryEvent[]>([]);
  const [view, setView] = useState<'home' | 'trip'>('home');
  const [activeTab, setActiveTab] = useState<'summary' | 'expenses' | 'gear' | 'itinerary'>('summary');
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showAddContributionModal, setShowAddContributionModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingGearId, setEditingGearId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [userTrips, setUserTrips] = useState<Trip[]>([]);

  // Form states
  const [newTripName, setNewTripName] = useState('');
  const [newTripImage, setNewTripImage] = useState(DEFAULT_TRIP_IMAGES[0]);
  const [newTripMembers, setNewTripMembers] = useState<string[]>(['']);
  const [newTripCommitments, setNewTripCommitments] = useState<Record<string, string>>({});
  const [newTripPhones, setNewTripPhones] = useState<Record<string, string>>({});
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<Expense['category']>('other');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newContributionMember, setNewContributionMember] = useState('');
  const [newContributionAmount, setNewContributionAmount] = useState('');
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberCommitment, setAddMemberCommitment] = useState('');
  const [addMemberPhone, setAddMemberPhone] = useState('');
  const [editingMemberOriginalName, setEditingMemberOriginalName] = useState<string | null>(null);
  const [newGearName, setNewGearName] = useState('');
  const [newGearProvider, setNewGearProvider] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [depTime, setDepTime] = useState('');
  const [depLoc, setDepLoc] = useState('');
  const [depUrl, setDepUrl] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'trips'),
        where('ownerId', '==', user.uid)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const trips = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
        trips.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setUserTrips(trips);
      }, (err) => handleFirestoreError(err, OperationType.LIST, `trips`));
      return unsub;
    }
  }, [user]);

  useEffect(() => {
    if (activeTrip && activeTrip.id) {
      // 1. Specific listener for the active trip itself to catch updates (like departure time)
      const unsubTrip = onSnapshot(doc(db, 'trips', activeTrip.id), (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Trip;
          
          // Use functional update to avoid unnecessary re-runs if data is identical
          setActiveTrip(prev => {
            if (!prev) return data;
            
            // Check if any visible field changed (simplified comparison)
            const changed = 
              prev.name !== data.name ||
              prev.budget !== data.budget ||
              prev.departureTime !== data.departureTime ||
              prev.departureLocation !== data.departureLocation ||
              prev.locationUrl !== data.locationUrl ||
              prev.imageUrl !== data.imageUrl ||
              JSON.stringify(prev.members) !== JSON.stringify(data.members);
            
            return changed ? data : prev;
          });
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `trips/${activeTrip.id}`));

      const qExp = query(
        collection(db, 'trips', activeTrip.id, 'expenses'),
        orderBy('createdAt', 'desc')
      );
      const unsubExp = onSnapshot(qExp, (snapshot) => {
        const ext = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
        setExpenses(ext);
      }, (err) => handleFirestoreError(err, OperationType.GET, `trips/${activeTrip.id}/expenses`));

      const qTask = query(collection(db, 'trips', activeTrip.id, 'tasks'));
      const unsubTask = onSnapshot(qTask, (snapshot) => {
        const tsk = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        setTasks(tsk);
      }, (err) => handleFirestoreError(err, OperationType.GET, `trips/${activeTrip.id}/tasks`));

      const qCont = query(collection(db, 'trips', activeTrip.id, 'contributions'), orderBy('createdAt', 'desc'));
      const unsubCont = onSnapshot(qCont, (snapshot) => {
        const cts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contribution));
        setContributions(cts);
      }, (err) => handleFirestoreError(err, OperationType.GET, `trips/${activeTrip.id}/contributions`));

      const qGear = query(collection(db, 'trips', activeTrip.id, 'gear'), orderBy('name', 'asc'));
      const unsubGear = onSnapshot(qGear, (snapshot) => {
        setGear(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)));
      }, (err) => handleFirestoreError(err, OperationType.GET, `trips/${activeTrip.id}/gear`));

      const qItin = query(collection(db, 'trips', activeTrip.id, 'itinerary'), orderBy('time', 'asc'));
      const unsubItin = onSnapshot(qItin, (snapshot) => {
        setItinerary(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ItineraryEvent)));
      }, (err) => handleFirestoreError(err, OperationType.GET, `trips/${activeTrip.id}/itinerary`));

      return () => {
        unsubTrip();
        unsubExp();
        unsubTask();
        unsubCont();
        unsubGear();
        unsubItin();
      };
    }
  }, [activeTrip?.id]); // Only re-run if the trip ID changes

  const updateTripImage = async () => {
    if (!activeTrip) return;
    try {
      await setDoc(doc(db, 'trips', activeTrip.id), {
        imageUrl: newTripImage,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowImageModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trips/${activeTrip.id}`);
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const createTrip = async () => {
    if (!user || !newTripName || newTripMembers.filter(m => m.trim()).length === 0) return;
    
    const tripId = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const commitments: Record<string, number> = {};
    const phones: Record<string, string> = {};
    newTripMembers.forEach(m => {
      if (m.trim()) {
        commitments[m.trim()] = parseFloat(newTripCommitments[m.trim()] || '0');
        phones[m.trim()] = newTripPhones[m.trim()] || '';
      }
    });

    const tripData = {
      name: newTripName,
      imageUrl: newTripImage,
      members: newTripMembers.filter(m => m.trim()),
      memberCommitments: commitments,
      memberPhones: phones,
      ownerId: user.uid,
      budget: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'trips', tripId), tripData);
      setActiveTrip({ id: tripId, ...tripData } as Trip);
      setView('trip');
      setShowNewTripModal(false);
      setNewTripName('');
      setNewTripImage(DEFAULT_TRIP_IMAGES[0]);
      setNewTripMembers(['']);
      setNewTripCommitments({});
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `trips/${tripId}`);
    }
  };

  const addExpense = async () => {
    if (!activeTrip || !newExpenseDesc || !newExpenseAmount || !newExpensePayer) return;

    try {
      const expenseData = {
        description: newExpenseDesc,
        amount: parseFloat(newExpenseAmount),
        paidBy: newExpensePayer,
        category: newExpenseCategory,
        updatedAt: serverTimestamp()
      };

      if (editingExpenseId) {
        await setDoc(doc(db, 'trips', activeTrip.id, 'expenses', editingExpenseId), expenseData, { merge: true });
      } else {
        await addDoc(collection(db, 'trips', activeTrip.id, 'expenses'), {
          ...expenseData,
          createdAt: serverTimestamp()
        });
      }
      
      setShowAddExpenseModal(false);
      setEditingExpenseId(null);
      setNewExpenseDesc('');
      setNewExpenseAmount('');
      setNewExpenseCategory('other');
      setNewExpensePayer('');
    } catch (err) {
      handleFirestoreError(err, editingExpenseId ? OperationType.UPDATE : OperationType.WRITE, `trips/${activeTrip.id}/expenses`);
    }
  };

  const startEditExpense = (e: Expense) => {
    setEditingExpenseId(e.id);
    setNewExpenseDesc(e.description);
    setNewExpenseAmount(e.amount.toString());
    setNewExpensePayer(e.paidBy);
    setNewExpenseCategory(e.category || 'other');
    setShowAddExpenseModal(true);
  };

  const sendWhatsApp = (message: string, phone?: string) => {
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}/?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shareSettlement = (s: Settlement) => {
    const phone = activeTrip?.memberPhones?.[s.from];
    const msg = `يا ${s.from}، عليك سداد قطية لـ ${s.to} بمبلغ ${s.amount} ريال. شكراً!`;
    sendWhatsApp(msg, phone);
  };

  const sendAllTasksReminder = () => {
    if (!activeTrip || pendingTasks.length === 0) return;
    const msg = `⚠️ *تذكير بالمهام المعلقة - رحلة ${activeTrip.name}*
${pendingTasks.map(t => `• ${t.title} (@${t.assignedTo})`).join('\n')}

نرجو من الجميع التأكد من جاهزية المهام!
_تم الإرسال عبر تطبيق رحلة أبو عقيل_`;
    sendWhatsApp(msg);
  };

  const shareTask = (t: Task) => {
    const phone = activeTrip?.memberPhones?.[t.assignedTo];
    const msg = `يا ${t.assignedTo}، تذكير بخصوص رحلة ${activeTrip?.name}: ياليت تجيب معاك (${t.title}).`;
    sendWhatsApp(msg, phone);
  };

  const shareDeparture = () => {
    const msg = `تذكير بموعد انطلاق رحلة ${activeTrip?.name}:
⏰ الساعة: ${activeTrip?.departureTime || 'لم يحدد'}
📍 الموقع: ${activeTrip?.departureLocation || 'لم يحدد'}
🔗 الرابط: ${activeTrip?.locationUrl || 'لم يحدد'}
نرجو الالتزام بالوقت!`;
    sendWhatsApp(msg);
  };

  const reportRef = useRef<HTMLDivElement>(null);
  const gearPrintRef = useRef<HTMLDivElement>(null);
  const expensesPrintRef = useRef<HTMLDivElement>(null);
  const tasksPrintRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const generateGenericPDF = async (element: HTMLElement, filename: string, whatsappMsg: string) => {
    if (!activeTrip || isGeneratingPDF) return;
    
    setIsGeneratingPDF(true);
    try {
      // Ensure element is ready and scrolled to top
      window.scrollTo(0, 0);
      
      // Make the element visible but off-screen and relative to body to avoid clipping issues
      const originalStyle = element.style.cssText;
      element.style.position = 'absolute';
      element.style.left = '0';
      element.style.top = '0';
      element.style.zIndex = '-9999';
      element.style.opacity = '1';
      element.style.visibility = 'visible';

      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const canvas = await html2canvas(element, {
        scale: window.innerWidth < 768 ? 1 : 2, // Scale 1 for mobile to avoid memory crashes
        useCORS: true,
        logging: true, 
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: 800,
      });
      
      // Restore original style
      element.style.cssText = originalStyle;
      
      const imgData = canvas.toDataURL('image/jpeg', 0.82); 
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfHeight, 297), undefined, 'FAST');
      
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

      let shared = false;
      
      // Try to use Web Share API first
      if (navigator.share) {
        try {
          const shareData: any = {
            title: filename.replace('.pdf', ''),
            text: whatsappMsg,
          };
          
          // Check if file sharing is supported
          if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            shareData.files = [pdfFile];
          }
          
          await navigator.share(shareData);
          shared = true;
        } catch (shareErr: any) {
          console.warn('Sharing failed:', shareErr);
          if (shareErr.name === 'AbortError') shared = true;
        }
      }

      // If sharing failed or not available, download and WhatsApp
      if (!shared) {
        pdf.save(filename);
        sendWhatsApp(whatsappMsg);
      }
      
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      alert('حدث خطأ أثناء إنشاء الملف. يرجى المحاولة مرة أخرى أو استخدام متصفح مغاير.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generatePDF = async () => {
    if (!activeTrip || !reportRef.current) return;
    const filename = `تقرير_رحلة_${activeTrip.name.replace(/\s+/g, '_')}.pdf`;
    const budgetStatus = activeTrip.budget ? `\n📈 الميزانية: ${activeTrip.budget} ريال (${((totalSpent / activeTrip.budget) * 100).toFixed(0)}%)` : '';
    const summary = `📊 *تقرير رحلة ${activeTrip.name}*
💰 إجمالي المصروفات: ${totalSpent} ريال${budgetStatus}
👥 عدد الأعضاء: ${activeTrip.members.length}
👤 نصيب الشخص: ${share.toFixed(2)} ريال

📢 *تفاصيل القَطية:*
${settlements.map(s => `• ${s.from} ⬅️ ${s.to}: ${s.amount} ريال`).join('\n')}

_تم الإنشاء عبر تطبيق رحلة أبو عقيل_`;
    
    await generateGenericPDF(reportRef.current, filename, summary);
  };

  const exportGearPDF = async () => {
    if (!activeTrip || gear.length === 0 || !gearPrintRef.current) return;
    
    const filename = `مهام_اعضاء_رحلة_${activeTrip.name}.pdf`;
    const summary = `📦 *قائمة مهام اعضاء الرحلة - ${activeTrip.name}*
${gear.map(item => `${item.status === 'available' ? '✅' : '⏳'} ${item.name} (${item.provider || 'الجميع'})`).join('\n')}

_تم الإنشاء عبر تطبيق رحلة أبو عقيل_`;

    await generateGenericPDF(gearPrintRef.current, filename, summary);
  };

  const exportExpensesPDF = async () => {
    if (!activeTrip || expenses.length === 0 || !expensesPrintRef.current) return;
    
    const filename = `مصروفات_رحلة_${activeTrip.name}.pdf`;
    const summary = `💰 *سجل مصروفات رحلة ${activeTrip.name}*
إجمالي المصروفات: ${totalSpent} ريال

_تم الإنشاء عبر تطبيق رحلة أبو عقيل_`;

    await generateGenericPDF(expensesPrintRef.current, filename, summary);
  };

  const exportTasksPDF = async () => {
    if (!activeTrip || tasks.length === 0 || !tasksPrintRef.current) return;
    
    const filename = `مهام_تحضير_رحلة_${activeTrip.name}.pdf`;
    const summary = `📋 *مهام تحضير رحلة ${activeTrip.name}*
${tasks.map(t => `${t.status === 'completed' ? '✅' : '⏳'} ${t.title} (@${t.assignedTo})`).join('\n')}

_تم الإنشاء عبر تطبيق رحلة أبو عقيل_`;

    await generateGenericPDF(tasksPrintRef.current, filename, summary);
  };

  const updateDeparture = async () => {
    if (!activeTrip) return;
    try {
      await setDoc(doc(db, 'trips', activeTrip.id), {
        departureTime: depTime,
        departureLocation: depLoc,
        locationUrl: depUrl || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowDepartureModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trips/${activeTrip.id}`);
    }
  };

  const updateBudget = async () => {
    if (!activeTrip) return;
    try {
      await setDoc(doc(db, 'trips', activeTrip.id), {
        budget: parseFloat(newBudget || '0'),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowBudgetModal(false);
      setNewBudget('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trips/${activeTrip.id}`);
    }
  };

  const addMemberToTrip = async () => {
    if (!activeTrip || !addMemberName.trim()) return;
    
    let newMembers = [...activeTrip.members];
    let newCommitments = { ...(activeTrip.memberCommitments || {}) };
    let newPhones = { ...(activeTrip.memberPhones || {}) };

    if (editingMemberOriginalName) {
      // Logic for editing existing member
      const index = newMembers.indexOf(editingMemberOriginalName);
      if (index !== -1) {
        newMembers[index] = addMemberName.trim();
        delete newCommitments[editingMemberOriginalName];
        delete newPhones[editingMemberOriginalName];
        newCommitments[addMemberName.trim()] = parseFloat(addMemberCommitment || '0');
        newPhones[addMemberName.trim()] = addMemberPhone.trim();
      }
    } else {
      // Logic for adding new member
      if (newMembers.includes(addMemberName.trim())) {
        alert('هذا العضو موجود بالفعل!');
        return;
      }
      newMembers.push(addMemberName.trim());
      newCommitments[addMemberName.trim()] = parseFloat(addMemberCommitment || '0');
      newPhones[addMemberName.trim()] = addMemberPhone.trim();
    }
    
    try {
      await setDoc(doc(db, 'trips', activeTrip.id), {
        members: newMembers,
        memberCommitments: newCommitments,
        memberPhones: newPhones,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setShowAddMemberModal(false);
      setAddMemberName('');
      setAddMemberCommitment('');
      setAddMemberPhone('');
      setEditingMemberOriginalName(null);

      // Note: We're not updating references in other collections here for simplicity, 
      // but in a production app, you'd want a batch write or cloud function to update
      // expense.paidBy, task.assignedTo, etc.
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trips/${activeTrip.id}`);
    }
  };

  const removeMemberFromTrip = async (memberToRemove: string) => {
    if (!activeTrip) return;
    if (!window.confirm(`هل أنت متأكد من حذف العضو (${memberToRemove})؟ سيتم حذف بيانات التزامه المالي أيضاً.`)) return;

    const newMembers = activeTrip.members.filter(m => m !== memberToRemove);
    const newCommitments = { ...(activeTrip.memberCommitments || {}) };
    const newPhones = { ...(activeTrip.memberPhones || {}) };
    delete newCommitments[memberToRemove];
    delete newPhones[memberToRemove];

    try {
      await setDoc(doc(db, 'trips', activeTrip.id), {
        members: newMembers,
        memberCommitments: newCommitments,
        memberPhones: newPhones,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trips/${activeTrip.id}`);
    }
  };

  const addTask = async () => {
    if (!activeTrip || !newTaskTitle || !newTaskAssignee) return;
    try {
      const taskData = {
        title: newTaskTitle,
        assignedTo: newTaskAssignee,
      };

      if (editingTaskId) {
        await setDoc(doc(db, 'trips', activeTrip.id, 'tasks', editingTaskId), taskData, { merge: true });
      } else {
        await addDoc(collection(db, 'trips', activeTrip.id, 'tasks'), {
          ...taskData,
          completed: false,
          createdAt: serverTimestamp()
        });
      }
      
      setShowAddTaskModal(false);
      setEditingTaskId(null);
      setNewTaskTitle('');
      setNewTaskAssignee('');
    } catch (err) {
      handleFirestoreError(err, editingTaskId ? OperationType.UPDATE : OperationType.WRITE, `trips/${activeTrip.id}/tasks`);
    }
  };

  const startEditTask = (t: Task) => {
    setEditingTaskId(t.id);
    setNewTaskTitle(t.title);
    setNewTaskAssignee(t.assignedTo);
    setShowAddTaskModal(true);
  };

  const toggleTask = async (task: Task) => {
    if (!activeTrip) return;
    try {
      await setDoc(doc(db, 'trips', activeTrip.id, 'tasks', task.id), {
        completed: !task.completed
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trips/${activeTrip.id}/tasks/${task.id}`);
    }
  };

  const addContribution = async () => {
    if (!activeTrip || !newContributionMember || !newContributionAmount) return;
    try {
      await addDoc(collection(db, 'trips', activeTrip.id, 'contributions'), {
        memberName: newContributionMember,
        amount: parseFloat(newContributionAmount),
        createdAt: serverTimestamp()
      });
      setShowAddContributionModal(false);
      setNewContributionMember('');
      setNewContributionAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `trips/${activeTrip.id}/contributions`);
    }
  };

  const addGearItem = async () => {
    if (!activeTrip || !newGearName) return;
    try {
      const gearData = {
        name: newGearName,
        provider: newGearProvider,
      };

      if (editingGearId) {
        await setDoc(doc(db, 'trips', activeTrip.id, 'gear', editingGearId), gearData, { merge: true });
      } else {
        await addDoc(collection(db, 'trips', activeTrip.id, 'gear'), {
          ...gearData,
          status: 'needed',
          createdAt: serverTimestamp()
        });
      }
      
      setEditingGearId(null);
      setNewGearName('');
      setNewGearProvider('');
    } catch (err) {
      handleFirestoreError(err, editingGearId ? OperationType.UPDATE : OperationType.WRITE, `trips/${activeTrip.id}/gear`);
    }
  };

  const startEditGear = (item: GearItem) => {
    setEditingGearId(item.id);
    setNewGearName(item.name);
    setNewGearProvider(item.provider || '');
  };

  const toggleGear = async (item: GearItem) => {
    if (!activeTrip) return;
    try {
      await setDoc(doc(db, 'trips', activeTrip.id, 'gear', item.id), {
        status: item.status === 'available' ? 'needed' : 'available'
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `trips/${activeTrip.id}/gear/${item.id}`);
    }
  };

  const addItineraryEvent = async () => {
    if (!activeTrip || !newEventDesc || !newEventTime) return;
    try {
      const eventData = {
        time: newEventTime,
        description: newEventDesc
      };

      if (editingEventId) {
        await setDoc(doc(db, 'trips', activeTrip.id, 'itinerary', editingEventId), eventData, { merge: true });
      } else {
        await addDoc(collection(db, 'trips', activeTrip.id, 'itinerary'), {
          ...eventData,
          createdAt: serverTimestamp()
        });
      }
      
      setEditingEventId(null);
      setNewEventTime('');
      setNewEventDesc('');
    } catch (err) {
      handleFirestoreError(err, editingEventId ? OperationType.UPDATE : OperationType.WRITE, `trips/${activeTrip.id}/itinerary`);
    }
  };

  const startEditEvent = (e: ItineraryEvent) => {
    setEditingEventId(e.id);
    setNewEventTime(e.time);
    setNewEventDesc(e.description);
  };

  const deleteTrip = async (tripId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (!window.confirm('هل أنت متأكد من حذف هذه الرحلة؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    try {
      if (activeTrip?.id === tripId) {
        setView('home');
        setActiveTrip(null);
      }
      await deleteDoc(doc(db, 'trips', tripId));
    } catch (err) {
      console.error('Delete error:', err);
      alert('حدث خطأ أثناء حذف الرحلة. تأكد من أنك صاحب الرحلة.');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!activeTrip || !window.confirm('حذف هذا المصروف؟')) return;
    try {
      await deleteDoc(doc(db, 'trips', activeTrip.id, 'expenses', expenseId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trips/${activeTrip.id}/expenses/${expenseId}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!activeTrip || !window.confirm('حذف هذه المهمة؟')) return;
    try {
      await deleteDoc(doc(db, 'trips', activeTrip.id, 'tasks', taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trips/${activeTrip.id}/tasks/${taskId}`);
    }
  };

  const deleteGearItem = async (itemId: string) => {
    if (!activeTrip || !window.confirm('حذف هذا الغرض؟')) return;
    try {
      await deleteDoc(doc(db, 'trips', activeTrip.id, 'gear', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trips/${activeTrip.id}/gear/${itemId}`);
    }
  };

  const deleteItineraryEvent = async (eventId: string) => {
    if (!activeTrip || !window.confirm('حذف هذه الفعالية؟')) return;
    try {
      await deleteDoc(doc(db, 'trips', activeTrip.id, 'itinerary', eventId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trips/${activeTrip.id}/itinerary/${eventId}`);
    }
  };

  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // ... (existing helper functions)

  const settlements = calculateSettlements(activeTrip?.members || [], expenses, contributions);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const share = activeTrip?.members.length ? (totalSpent / activeTrip.members.length) : 0;

  const getMemberBalance = (member: string) => {
    const paid = expenses.filter(e => e.paidBy === member).reduce((sum, e) => sum + e.amount, 0);
    return paid - share;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900 font-sans">
      {/* Background Hero Image */}
      <div className="absolute inset-0 z-0 scale-110 animate-pulse-slow">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-emerald-950 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?auto=format&fit=crop&q=80&w=2070" 
          className="w-full h-full object-cover" 
          alt="Desert trip adventure"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-3xl w-full space-y-12"
        >
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-block px-5 py-2 bg-amber-400 text-amber-950 text-xs font-black uppercase tracking-[0.25em] rounded-full shadow-[0_0_40px_rgba(251,191,36,0.3)] mb-4"
            >
              رفيقك الذكي في كل كشتة
            </motion.div>
            
            <h1 className="text-6xl md:text-9xl font-display font-black text-white tracking-tighter leading-[0.9] drop-shadow-2xl">
              رحلة <span className="text-emerald-400 block md:inline underline decoration-amber-400/30 underline-offset-[20px]">أبو عقيل</span>
            </h1>
            
            <p className="text-lg md:text-2xl text-emerald-50/70 font-medium max-w-xl mx-auto leading-relaxed">
              حوّل فوضى المصاريف إلى متعة. نظّم، وزّع، وتواصل مع أصحابك في مكان واحد وبمنتهى الشفافية والسهولة.
            </p>
          </div>

          <div className="pt-8 space-y-10">
            <button 
              onClick={login} 
              className="w-full max-w-md mx-auto py-6 bg-white text-slate-900 rounded-[2.5rem] font-black flex items-center justify-center gap-4 text-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:bg-emerald-50 transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <img src="https://www.google.com/favicon.ico" className="w-8 h-8" alt="Google" />
              <span>البدء عبر جوجل</span>
            </button>
            
            <div className="flex items-center justify-center gap-4 md:gap-12 pt-8">
              {[
                { icon: <Calculator />, label: "حساب دقيق" },
                { icon: <Users />, label: "تنسيق جماعي" },
                { icon: <Calendar />, label: "موعد الرحلة" },
                { icon: <ArrowRight />, label: "تصفية سهلة" }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + (i * 0.1) }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-md shadow-inner">
                    {React.cloneElement(item.icon as React.ReactElement, { className: "w-6 h-6 md:w-8 md:h-8 text-emerald-400" })}
                  </div>
                  <span className="text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-4">
           <div className="w-px h-12 bg-gradient-to-b from-white/0 to-white/20" />
           <p className="text-white/20 text-[10px] font-black tracking-[0.3em] uppercase">
              استكشف آفاقاً جديدة مع أصحابك
           </p>
        </div>
      </div>
    </div>
  );

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-emerald-50 shadow-sm shadow-emerald-100/20">
        <div className="max-w-4xl mx-auto px-4 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view === 'trip' && <button onClick={() => setView('home')} className="p-3 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-100 transition-all"><ChevronLeft className="w-5 h-5" /></button>}
            <h1 className="text-2xl font-display font-black text-emerald-600 tracking-tight">رحلة <span className="text-slate-800">أبو عقيل</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end text-[10px] uppercase font-bold text-slate-400">
              <span>مسجل كـ</span>
              <span className="text-slate-700">{user.displayName}</span>
            </div>
            <button onClick={() => auth.signOut()} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-24 text-right">
        {view === 'home' ? (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">مرحباً {user.displayName}</h2>
              <p className="text-slate-500">اختر رحلتك أو انضم لصديق</p>
            </div>
            <div className="flex justify-center">
              <button onClick={() => setShowNewTripModal(true)} className="glass-card p-12 text-center space-y-4 border-2 border-dashed border-amber-200 hover:border-emerald-500 hover:bg-emerald-50/50 group transition-all relative overflow-hidden max-w-md w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto group-hover:bg-emerald-600 transition-all transform group-hover:scale-110 group-hover:rotate-12">
                  <Plus className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">إنشاء رحلة جديدة</h3>
                  <p className="text-slate-500 text-sm mt-1">ابدأ مغامرتك القادمة الآن</p>
                </div>
              </button>
            </div>

            {/* Archive Section */}
            {userTrips.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-2xl font-bold text-slate-800">أرشيف رحلاتي</h3>
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">{userTrips.length} رحلات</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {userTrips.map((trip) => (
                    <div
                      key={trip.id}
                      onClick={() => {
                        setActiveTrip(trip);
                        setView('trip');
                      }}
                      className="glass-card overflow-hidden text-right hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer border-t-4 border-emerald-500 relative"
                    >
                      <div className="h-32 w-full relative overflow-hidden">
                        <img 
                          src={trip.imageUrl || DEFAULT_TRIP_IMAGES[0]} 
                          alt={trip.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <span className="absolute bottom-3 right-4 text-white font-bold text-lg">{trip.name}</span>
                        <span className="absolute top-3 left-3 text-[10px] font-mono font-bold text-white bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20">#{trip.id}</span>
                      </div>
                      
                      <div className="p-5 space-y-4">
                        <div className="flex justify-between items-center">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTrip(trip.id, e);
                            }} 
                            className="p-2 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg transition-all cursor-pointer bg-white border border-rose-100 shadow-sm"
                            title="حذف الرحلة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="flex items-center gap-3 text-slate-500 text-xs">
                            <span className="flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                              <Users className="w-3.5 h-3.5" /> {trip.members.length}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {trip.createdAt?.toDate ? new Date(trip.createdAt.toDate()).toLocaleDateString('ar-EG') : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTrip && (
          <div className="space-y-8 pb-20">
            {/* Trip Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sticky top-18 bg-slate-50/90 backdrop-blur z-20">
              <button 
                onClick={() => setActiveTab('summary')} 
                className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${activeTab === 'summary' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
              >
                الخلاصة
              </button>
              <button 
                onClick={() => setActiveTab('expenses')} 
                className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${activeTab === 'expenses' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
              >
                المصاريف
              </button>
              <button 
                onClick={() => setActiveTab('gear')} 
                className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${activeTab === 'gear' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
              >
                مهام اعضاء الرحلة
              </button>
              <button 
                onClick={() => setActiveTab('itinerary')} 
                className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${activeTab === 'itinerary' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
              >
                الجدول
              </button>
            </div>

            {activeTab === 'summary' && (
              <>
                {/* Trip Banner */}
                <div className="relative h-48 md:h-64 w-full rounded-3xl overflow-hidden shadow-xl mb-8 group">
                  <img 
                    src={activeTrip.imageUrl || DEFAULT_TRIP_IMAGES[0]} 
                    alt={activeTrip.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-8">
                    <div className="flex justify-between items-end">
                      <div className="text-right">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-2">{activeTrip.name}</h2>
                        <div className="flex items-center gap-4 text-white/80 text-sm md:text-base">
                          <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {activeTrip.members.length} أعضاء</span>
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {activeTrip.createdAt?.toDate ? new Date(activeTrip.createdAt.toDate()).toLocaleDateString('ar-EG') : '-'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setNewTripImage(activeTrip.imageUrl || DEFAULT_TRIP_IMAGES[0]);
                            setShowImageModal(true);
                          }} 
                          className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-3 rounded-2xl transition-all border border-white/20"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button onClick={generatePDF} disabled={isGeneratingPDF} className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-3 rounded-2xl transition-all border border-white/20">
                          {isGeneratingPDF ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="glass-card p-5 border-r-8 border-emerald-600 bg-gradient-to-r from-emerald-50/50 to-white">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">إجمالي الصرف</span>
                    <span className="text-2xl font-black text-slate-800">{totalSpent} <small className="text-xs font-normal text-slate-400">ريال</small></span>
                  </div>
                  <div className="glass-card p-5 border-r-8 border-emerald-500 bg-gradient-to-r from-emerald-50/50 to-white cursor-pointer hover:shadow-lg transition-all" onClick={() => setShowBreakdownModal(true)}>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">نصيب الفرد</span>
                    <span className="text-2xl font-black text-slate-800">{share.toFixed(1)} <small className="text-xs font-normal text-slate-400">ريال</small></span>
                  </div>
                  <div className="glass-card p-5 border-r-8 border-amber-500 bg-gradient-to-r from-amber-50/50 to-white cursor-pointer hover:shadow-lg transition-all" onClick={() => {
                    setDepTime(activeTrip.departureTime || '');
                    setDepLoc(activeTrip.departureLocation || '');
                    setDepUrl(activeTrip.locationUrl || '');
                    setShowDepartureModal(true);
                  }}>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">موعد الانطلاق</span>
                    <span className="text-lg font-bold truncate block text-slate-800">{activeTrip.departureTime || 'لم يحدد'}</span>
                  </div>
                  <div className="glass-card p-5 border-r-8 border-rose-500 bg-gradient-to-r from-rose-50/50 to-white relative">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">كود الرحلة</span>
                    <span className="text-xl font-mono font-bold text-emerald-600 block">{activeTrip.id}</span>
                  </div>
                </section>
                
                {/* Budget Section */}
                <div 
                  className="glass-card p-6 border-r-8 border-indigo-500 bg-gradient-to-r from-indigo-50/30 to-white cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => {
                    setNewBudget(activeTrip.budget?.toString() || '');
                    setShowBudgetModal(true);
                  }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="text-indigo-500 w-5 h-5" />
                        ميزانية الرحلة
                      </h3>
                      <p className="text-slate-500 text-sm">تتبع المصاريف مقابل الميزانية المحددة</p>
                    </div>
                    <div className="text-left">
                      <span className="text-2xl font-black text-indigo-600">{activeTrip.budget || 0}</span>
                      <span className="text-xs text-slate-400 mr-1">ريال</span>
                    </div>
                  </div>
                  
                  {activeTrip.budget && activeTrip.budget > 0 ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                        <span className="text-slate-400">النسبة المستهلكة</span>
                        <span className={totalSpent > activeTrip.budget ? 'text-rose-500' : 'text-emerald-500'}>
                          {((totalSpent / activeTrip.budget) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${totalSpent > activeTrip.budget ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((totalSpent / activeTrip.budget) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className={`w-3 h-3 rounded-full ${totalSpent > activeTrip.budget ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                          <span className="text-slate-600">
                            {totalSpent > activeTrip.budget 
                              ? `تجاوزت الميزانية بـ ${totalSpent - activeTrip.budget} ريال` 
                              : `متبقي ${activeTrip.budget - totalSpent} ريال من الميزانية`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center border-2 border-dashed border-indigo-100 rounded-2xl text-indigo-400 font-bold hover:bg-indigo-50/50 transition-colors">
                      + اضغط لتحديد ميزانية للرحلة
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <div className="flex items-center justify-between border-r-4 border-emerald-500 pr-3">
                        <h3 className="text-xl font-black text-slate-800">تصفية القَطية</h3>
                        <TrendingUp className="text-emerald-500 w-5 h-5" />
                      </div>
                      <div className="glass-card divide-y divide-slate-50 border-t-4 border-emerald-500">
                        {settlements.length === 0 ? (
                          <div className="p-10 text-center text-slate-400">لا توجد مبالغ مستحقة حالياً</div>
                        ) : (
                          settlements.map((s, idx) => (
                            <div key={idx} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-700">{s.from}</span>
                                <ArrowRight className="w-4 h-4 text-emerald-300" />
                                <span className="font-bold text-emerald-600">{s.to}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-black text-lg text-emerald-600">{s.amount} <small className="text-[10px] font-normal uppercase">ريال</small></span>
                                <button onClick={() => shareSettlement(s)} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all">
                                  <MessageCircle className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold">صندوق الرحلة (الدفوعات)</h3>
                        <button onClick={() => setShowAddContributionModal(true)} className="text-emerald-600 font-bold px-4 py-2 bg-emerald-50 rounded-xl">+ تسجيل دفع</button>
                      </div>
                      <div className="glass-card divide-y">
                        {activeTrip.members.map(member => {
                          const committed = activeTrip.memberCommitments?.[member] || 0;
                          const paid = contributions.filter(c => c.memberName === member).reduce((sum, c) => sum + c.amount, 0);
                          const remaining = committed - paid;
                          return (
                            <div key={member} className="p-4 flex items-center justify-between">
                              <div>
                                <p className="font-bold">{member}</p>
                                <p className="text-xs text-slate-500">الالتزام: {committed} ريال</p>
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-lg">{paid} ريال</p>
                                <p className={`text-[10px] ${remaining <= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500'}`}>
                                  {remaining <= 0 ? 'تم السداد' : `متبقي: ${remaining} ريال`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-card p-6 space-y-6 bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <h4 className="font-bold text-lg">بيانات الرحلة</h4>
                        <span className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-white" /></span>
                      </div>
                      <div className="space-y-4 text-sm">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-emerald-400" />
                          <div className="flex-1">
                            <p className="text-slate-400 text-[10px] uppercase font-bold">موعد الانطلاق</p>
                            <p className="font-bold">{activeTrip.departureTime || 'غير محدد'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-emerald-400" />
                          <div className="flex-1">
                            <p className="text-slate-400 text-[10px] uppercase font-bold">نقطة التجمع</p>
                            <p className="font-bold">{activeTrip.departureLocation || 'غير محدد'}</p>
                          </div>
                        </div>
                        {activeTrip.locationUrl && (
                          <a 
                            href={activeTrip.locationUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors group"
                          >
                            <Share2 className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-emerald-300">فتح في جوجل ماب</span>
                          </a>
                        )}
                      </div>
                      <div className="pt-6 border-t border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest">أعضاء الرحلة</h4>
                          <button onClick={() => setShowAddMemberModal(true)} className="text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors">
                            + إضافة عضو
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeTrip.members.map(m => (
                            <span key={m} className="bg-slate-800 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-700 text-amber-200">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={generatePDF} 
                      disabled={isGeneratingPDF}
                      className={`w-full py-4 flex items-center justify-center gap-2 rounded-2xl font-bold transition-all ${isGeneratingPDF ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-lg active:scale-95 hover:bg-emerald-700'}`}
                    >
                      {isGeneratingPDF ? (
                        <>
                          <div className="w-5 h-5 border-2 border-slate-400 border-t-emerald-600 rounded-full animate-spin" />
                          جاري تجهيز PDF...
                        </>
                      ) : (
                        <>
                          <FileText className="w-5 h-5" /> تصدير التقرير النهائي (PDF)
                        </>
                      )}
                    </button>
                    <button onClick={shareDeparture} className="w-full btn-secondary py-4 flex items-center justify-center gap-2">
                      <MessageCircle className="w-5 h-5 text-emerald-500" /> إرسال تذكير بالموعد
                    </button>
                    <button onClick={() => deleteTrip(activeTrip.id)} className="w-full flex items-center justify-center gap-2 py-4 text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all font-bold text-sm rounded-2xl">
                      <Trash2 className="w-5 h-5" /> حذف هذه الرحلة نهائياً
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <button onClick={() => setShowAddExpenseModal(true)} className="w-full p-5 btn-primary text-xl flex items-center justify-center gap-3">
                  <Plus className="w-6 h-6 bg-white/20 rounded-lg p-1" /> إضافة مصروف جديد
                </button>
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">سجل المصروفات</h3>
                  {expenses.length > 0 && (
                    <button 
                      onClick={exportExpensesPDF} 
                      className="text-emerald-600 font-bold px-4 py-2 bg-emerald-50 rounded-xl flex items-center gap-2 hover:bg-emerald-100 transition-all text-sm"
                    >
                      <Download className="w-4 h-4" /> تصدير PDF
                    </button>
                  )}
                </div>
                  <div className="space-y-3">
                    {expenses.map(e => (
                      <div key={e.id} className="glass-card p-5 flex items-center justify-between border-r-4 border-emerald-600">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            {e.category === 'food' && <Utensils className="w-5 h-5" />}
                            {e.category === 'fuel' && <Fuel className="w-5 h-5" />}
                            {e.category === 'supplies' && <Package className="w-5 h-5" />}
                            {e.category === 'other' || !e.category ? <ShoppingBag className="w-5 h-5" /> : null}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{e.description}</p>
                            <p className="text-xs text-slate-400 font-bold">بواسطة {e.paidBy}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-left">
                            <span className="text-lg font-black text-slate-800">{e.amount}</span>
                            <span className="text-[10px] text-slate-400 block uppercase">ريال</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={() => startEditExpense(e)} 
                              className="p-2 text-slate-200 hover:text-emerald-500 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteExpense(e.id)} 
                              className="p-2 text-slate-200 hover:text-rose-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {expenses.length === 0 && <div className="p-10 text-center text-slate-400 italic">لا توجد مصروفات مسجلة حالياً</div>}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'gear' && (
              <div className="space-y-6">
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">تجهيز مهام اعضاء الرحلة (الأدوات)</h3>
                    {gear.length > 0 && (
                      <button 
                        onClick={exportGearPDF} 
                        className="text-emerald-600 font-bold px-4 py-2 bg-emerald-50 rounded-xl flex items-center gap-2 hover:bg-emerald-100 transition-all text-sm"
                      >
                        <Download className="w-4 h-4" /> تصدير PDF
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="مثلاً: خيمة، موقد.." className="flex-1 border p-3 rounded-xl" value={newGearName} onChange={e => setNewGearName(e.target.value)} />
                    <select className="border p-3 rounded-xl" value={newGearProvider} onChange={e => setNewGearProvider(e.target.value)}>
                      <option value="">من الموفر؟</option>
                      {activeTrip.members.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={addGearItem} className={`${editingGearId ? 'bg-amber-600' : 'bg-emerald-600'} text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 flex-1`}>
                        {editingGearId ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {editingGearId ? 'تعديل المهمة' : 'إضافة للمهمة'}
                      </button>
                      {editingGearId && (
                        <button 
                          onClick={() => {
                            setEditingGearId(null);
                            setNewGearName('');
                            setNewGearProvider('');
                          }} 
                          className="bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {gear.map(item => (
                    <div key={item.id} className={`glass-card p-5 flex items-center justify-between border-r-4 ${item.status === 'available' ? 'border-emerald-500 bg-emerald-50/30' : 'border-amber-500'}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleGear(item)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${item.status === 'available' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <Package className="w-5 h-5" />
                        </button>
                        <div>
                          <p className={`font-bold ${item.status === 'available' ? 'text-emerald-900' : 'text-slate-800'}`}>{item.name}</p>
                          <p className="text-xs text-slate-500">من طرف: {item.provider || 'الجميع'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${item.status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.status === 'available' ? 'جاهز' : 'نحتاجه'}
                        </span>
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => startEditGear(item)} 
                            className="p-2 text-slate-200 hover:text-emerald-500 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteGearItem(item.id)} 
                            className="p-2 text-slate-200 hover:text-rose-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {gear.length === 0 && <div className="sm:col-span-2 p-10 text-center text-slate-400 italic">لم يتم إضافة أدوات بعد</div>}
                </div>

                <section className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-r-4 border-emerald-600 pr-3 gap-3">
                    <h3 className="text-xl font-bold italic">مهام التحضير</h3>
                    <div className="flex gap-2">
                      {pendingTasks.length > 0 && (
                        <button 
                          onClick={exportTasksPDF} 
                          className="text-emerald-600 font-bold px-4 py-2 bg-emerald-50 rounded-xl flex items-center gap-2 hover:bg-emerald-100 transition-all text-sm"
                        >
                          <Download className="w-4 h-4" /> تصدير PDF
                        </button>
                      )}
                      {pendingTasks.length > 0 && (
                        <button 
                          onClick={sendAllTasksReminder} 
                          className="text-amber-600 font-bold px-4 py-2 bg-amber-50 rounded-xl transition-all hover:bg-amber-100 flex items-center gap-2 text-sm"
                          title="إرسال تذكير بالمهام المعلقة للجميع"
                        >
                          <MessageCircle className="w-4 h-4" /> تذكير الجميع
                        </button>
                      )}
                      <button onClick={() => setShowAddTaskModal(true)} className="text-emerald-600 font-bold px-4 py-2 bg-emerald-50 rounded-xl transition-all hover:bg-emerald-100 text-sm">
                        + مهمة جديدة
                      </button>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="glass-card divide-y overflow-hidden">
                      <AnimatePresence initial={false}>
                        {pendingTasks.map(t => (
                          <motion.div 
                            key={t.id} 
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => toggleTask(t)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-slate-100 text-slate-300 border-2 border-dashed border-slate-200"
                              >
                                <div className="w-2 h-2 bg-slate-300 rounded-full" />
                              </button>
                              <div>
                                <p className="font-bold text-slate-700">{t.title}</p>
                                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{t.assignedTo}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => shareTask(t)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all">
                                <MessageCircle className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => startEditTask(t)} 
                                className="p-2 text-slate-200 hover:text-emerald-500 transition-all"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteTask(t.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {pendingTasks.length === 0 && <div className="p-10 text-center text-slate-400 italic">لا توجد مهام معلقة</div>}
                    </div>

                    {completedTasks.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-r-4 border-slate-300 pr-3 opacity-60">
                          <CheckCircle2 className="w-5 h-5 text-slate-400" />
                          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">مهام مكتملة</h4>
                        </div>
                        <div className="glass-card divide-y opacity-70 bg-slate-50/50 overflow-hidden">
                          <AnimatePresence initial={false}>
                            {completedTasks.map(t => (
                              <motion.div 
                                key={t.id} 
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="p-4 flex items-center justify-between hover:bg-white/50 transition-colors"
                              >
                                <div className="flex items-center gap-4">
                                  <button 
                                    onClick={() => toggleTask(t)}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-emerald-100 text-emerald-600"
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                  <div>
                                    <p className="font-bold line-through text-slate-400">{t.title}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.assignedTo}</p>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'itinerary' && (
              <div className="space-y-6">
                <div className="glass-card p-6 space-y-4 border-t-8 border-emerald-600">
                  <h3 className="text-xl font-bold">جدول فعاليات الرحلة</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="الوقت (مثلاً: 2م)" className="sm:w-32 border p-3 rounded-xl text-center font-bold" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} />
                    <input type="text" placeholder="وصف الفعالية.." className="flex-1 border p-3 rounded-xl" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={addItineraryEvent} className={`${editingEventId ? 'bg-amber-600' : 'bg-emerald-600'} text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 flex-1`}>
                        {editingEventId ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {editingEventId ? 'تعديل' : 'إضافة'}
                      </button>
                      {editingEventId && (
                        <button 
                          onClick={() => {
                            setEditingEventId(null);
                            setNewEventTime('');
                            setNewEventDesc('');
                          }} 
                          className="bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 relative before:absolute before:right-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-emerald-100">
                  {itinerary.map(event => (
                    <div key={event.id} className="relative pr-14 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-600 rounded-full ring-4 ring-white" />
                      <div className="glass-card p-4 flex justify-between items-center bg-white/50 hover:bg-white transition-colors">
                        <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg text-sm border border-emerald-100">{event.time}</span>
                        <p className="font-bold text-slate-800 text-right flex-1 px-4">{event.description}</p>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => startEditEvent(event)} 
                            className="p-2 text-slate-200 hover:text-emerald-500 transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteItineraryEvent(event.id)} 
                            className="p-2 text-slate-200 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {itinerary.length === 0 && (
                    <div className="text-center p-12 text-slate-400 italic bg-white/30 rounded-3xl border-2 border-dashed border-slate-200">سجل فعاليات الرحلة ليعرف الجميع الخطة</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {showImageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowImageModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-6 text-right">
              <div className="flex justify-between items-center border-b pb-4">
                <button onClick={() => setShowImageModal(false)} className="text-slate-400 p-1"><X className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold">تغيير صورة الرحلة</h2>
              </div>
              
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-500">اختر صورة جديدة</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEFAULT_TRIP_IMAGES.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setNewTripImage(img)}
                      className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${newTripImage === img ? 'border-emerald-500 scale-105 shadow-md' : 'border-transparent'}`}
                    >
                      <img src={img} alt="Trip cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {newTripImage === img && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="text-white w-6 h-6" />
                        </div>
                      )}
                    </button>
                  ))}
                  <label className={`relative aspect-video rounded-xl overflow-hidden border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${!DEFAULT_TRIP_IMAGES.includes(newTripImage) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                    <Camera className={`w-6 h-6 ${!DEFAULT_TRIP_IMAGES.includes(newTripImage) ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span className="text-[10px] mt-1 text-slate-500 text-center">رفع صورة</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewTripImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                    {!DEFAULT_TRIP_IMAGES.includes(newTripImage) && newTripImage && (
                      <img src={newTripImage} alt="Uploaded" className="absolute inset-0 w-full h-full object-cover opacity-30" referrerPolicy="no-referrer" />
                    )}
                  </label>
                </div>
              </div>

              <button 
                onClick={updateTripImage} 
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all"
              >
                حفظ التغييرات
              </button>
            </motion.div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showNewTripModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNewTripModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-4 text-right max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold">رحلة جديدة</h2>
              
              <div className="space-y-2 text-right">
                <label className="text-sm font-bold text-slate-500">صورة الرحلة</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEFAULT_TRIP_IMAGES.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setNewTripImage(img)}
                      className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${newTripImage === img ? 'border-emerald-500 scale-105 shadow-md' : 'border-transparent'}`}
                    >
                      <img src={img} alt="Trip cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {newTripImage === img && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="text-white w-6 h-6" />
                        </div>
                      )}
                    </button>
                  ))}
                  <label className={`relative aspect-video rounded-xl overflow-hidden border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${!DEFAULT_TRIP_IMAGES.includes(newTripImage) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                    <Camera className={`w-6 h-6 ${!DEFAULT_TRIP_IMAGES.includes(newTripImage) ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span className="text-[10px] mt-1 text-slate-500">رفع صورة</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewTripImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                    {!DEFAULT_TRIP_IMAGES.includes(newTripImage) && newTripImage && (
                      <img src={newTripImage} alt="Uploaded" className="absolute inset-0 w-full h-full object-cover opacity-30" referrerPolicy="no-referrer" />
                    )}
                  </label>
                </div>
              </div>

              <input type="text" placeholder="اسم الرحلة" className="w-full border p-3 rounded-xl" value={newTripName} onChange={e => setNewTripName(e.target.value)} />
              <div className="space-y-2">
                {newTripMembers.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <input type="text" placeholder={`اسم العضو ${i+1}`} className="w-full border p-3 rounded-xl" value={m} onChange={e => { const nm = [...newTripMembers]; nm[i] = e.target.value; setNewTripMembers(nm); }} />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" placeholder="المبلغ الملتزم به" className="w-full border p-2 rounded-xl text-xs" value={newTripCommitments[m] || ''} onChange={e => setNewTripCommitments({...newTripCommitments, [m]: e.target.value})} />
                        <input type="text" placeholder="رقم الواتساب (مثال: 966...)" className="w-full border p-2 rounded-xl text-xs" value={newTripPhones[m] || ''} onChange={e => setNewTripPhones({...newTripPhones, [m]: e.target.value})} />
                      </div>
                    </div>
                    {newTripMembers.length > 1 && <button onClick={() => setNewTripMembers(newTripMembers.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 /></button>}
                  </div>
                ))}
                <button onClick={() => setNewTripMembers([...newTripMembers, ''])} className="text-emerald-600 font-bold block">+ إضافة عضو</button>
              </div>
              <button 
                onClick={createTrip} 
                disabled={!newTripName || newTripMembers.filter(m => m.trim()).length === 0}
                className={`w-full py-4 rounded-xl font-bold transition-all ${(!newTripName || newTripMembers.filter(m => m.trim()).length === 0) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-lg active:scale-95'}`}
              >
                بدء الرحلة
              </button>
            </motion.div>
          </div>
        )}

        {showAddExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => {
              setShowAddExpenseModal(false);
              setEditingExpenseId(null);
              setNewExpenseDesc('');
              setNewExpenseAmount('');
              setNewExpensePayer('');
            }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-4 text-right">
              <div className="flex justify-between items-center border-b pb-4">
                <button onClick={() => {
                  setShowAddExpenseModal(false);
                  setEditingExpenseId(null);
                  setNewExpenseDesc('');
                  setNewExpenseAmount('');
                  setNewExpensePayer('');
                }} className="text-slate-400 p-1"><X className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold">{editingExpenseId ? 'تعديل المصروف' : 'إضافة مصروف'}</h2>
              </div>
              <input type="text" placeholder="الوصف" className="w-full border p-3 rounded-xl" value={newExpenseDesc} onChange={e => setNewExpenseDesc(e.target.value)} />
              <input type="number" placeholder="المبلغ" className="w-full border p-3 rounded-xl" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} />
              <select className="w-full border p-3 rounded-xl" value={newExpensePayer} onChange={e => setNewExpensePayer(e.target.value)}>
                <option value="">من دفع؟</option>
                <option value="الصندوق">💰 الصندوق (من القَطية)</option>
                {activeTrip?.members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-500">التصنيف</label>
                <select 
                  className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700" 
                  value={newExpenseCategory} 
                  onChange={e => setNewExpenseCategory(e.target.value as any)}
                >
                  <option value="food">🍱 أكل ومواد غذائية</option>
                  <option value="fuel">⛽ بنزين ومحروقات</option>
                  <option value="supplies">📦 تجهيزات وأدوات</option>
                  <option value="other">🛍️ أخرى</option>
                </select>
              </div>
              <button onClick={addExpense} className={`w-full ${editingExpenseId ? 'bg-amber-600' : 'bg-emerald-600'} text-white py-4 rounded-xl font-bold`}>
                {editingExpenseId ? 'تعديل المصروف' : 'حفظ المصروف'}
              </button>
            </motion.div>
          </div>
        )}

        {showAddTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => {
              setShowAddTaskModal(false);
              setEditingTaskId(null);
              setNewTaskTitle('');
              setNewTaskAssignee('');
            }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-4 text-right">
              <div className="flex justify-between items-center border-b pb-4">
                <button onClick={() => {
                  setShowAddTaskModal(false);
                  setEditingTaskId(null);
                  setNewTaskTitle('');
                  setNewTaskAssignee('');
                }} className="text-slate-400 p-1"><X className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold">{editingTaskId ? 'تعديل المهمة' : 'إضافة مهمة'}</h2>
              </div>
              <input type="text" placeholder="الغرض / المهمة" className="w-full border p-3 rounded-xl" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
              <select className="w-full border p-3 rounded-xl" value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)}>
                <option value="">المسؤول؟</option>
                {activeTrip?.members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={addTask} className={`w-full ${editingTaskId ? 'bg-amber-600' : 'bg-emerald-600'} text-white py-4 rounded-xl font-bold`}>
                {editingTaskId ? 'تعديل' : 'حفظ'}
              </button>
            </motion.div>
          </div>
        )}

        {showAddContributionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddContributionModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-4 text-right">
              <h2 className="text-2xl font-bold">تسجيل دفع (للصندوق)</h2>
              <select className="w-full border p-3 rounded-xl" value={newContributionMember} onChange={e => setNewContributionMember(e.target.value)}>
                <option value="">من دفع؟</option>
                {activeTrip?.members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="number" placeholder="المبلغ المدفوع" className="w-full border p-3 rounded-xl" value={newContributionAmount} onChange={e => setNewContributionAmount(e.target.value)} />
              <button onClick={addContribution} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold">حفظ الدفعة</button>
            </motion.div>
          </div>
        )}

        {showBreakdownModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowBreakdownModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-6 text-right">
              <div className="flex justify-between items-center border-b pb-4">
                <button onClick={() => setShowBreakdownModal(false)} className="text-slate-400 p-1"><X className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold">تفاصيل مساهمة الأعضاء</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-emerald-50 p-4 rounded-2xl flex justify-between items-center text-emerald-900">
                  <span className="font-bold">المعدل المطلوب (للفرد)</span>
                  <span className="text-xl font-bold">{share.toFixed(2)} ريال</span>
                </div>

                <div className="divide-y max-h-[60vh] overflow-y-auto">
                  {activeTrip?.members.map(member => {
                    const balance = getMemberBalance(member);
                    const paid = expenses.filter(e => e.paidBy === member).reduce((sum, e) => sum + e.amount, 0);
                    return (
                      <div key={member} className="py-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-lg">{member}</p>
                          <p className="text-xs text-slate-500">دفع: {paid} ريال</p>
                        </div>
                        <div className={`text-right ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          <p className="font-bold">{balance > 0 ? `له ${balance.toFixed(2)}` : balance < 0 ? `عليه ${Math.abs(balance).toFixed(2)}` : 'خالص'}</p>
                          <p className="text-[10px] uppercase">ريال</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <button onClick={() => setShowBreakdownModal(false)} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold">إغلاق</button>
            </motion.div>
          </div>
        )}
        {showDepartureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDepartureModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-4 text-right">
              <h2 className="text-2xl font-bold">تحديد موعد الانطلاق</h2>
              <input type="text" placeholder="الوقت (مثلاً: 4 عصراً)" className="w-full border p-3 rounded-xl" value={depTime} onChange={e => setDepTime(e.target.value)} />
              <input type="text" placeholder="الموقع" className="w-full border p-3 rounded-xl" value={depLoc} onChange={e => setDepLoc(e.target.value)} />
              <input type="text" placeholder="رابط الموقع (Google Maps)" className="w-full border p-3 rounded-xl" value={depUrl} onChange={e => setDepUrl(e.target.value)} />
              <button onClick={updateDeparture} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold">حفظ</button>
            </motion.div>
          </div>
        )}

        {showAddMemberModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => {
              setShowAddMemberModal(false);
              setEditingMemberOriginalName(null);
              setAddMemberName('');
              setAddMemberCommitment('');
            }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-4 text-right">
              <div className="flex justify-between items-center border-b pb-4">
                <button onClick={() => {
                  setShowAddMemberModal(false);
                  setEditingMemberOriginalName(null);
                  setAddMemberName('');
                  setAddMemberCommitment('');
                }} className="text-slate-400 p-1"><X className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold">{editingMemberOriginalName ? 'تعديل بيانات العضو' : 'إضافة عضو للرحلة'}</h2>
              </div>
              
              <div className="space-y-4 pt-4">
                {/* List of current members */}
                {!editingMemberOriginalName && activeTrip && activeTrip.members.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">الأعضاء الحاليون (اضغط للتعديل)</p>
                    <div className="flex flex-wrap gap-2">
                      {activeTrip.members.map(m => (
                        <div key={m} className="flex items-center gap-1 bg-slate-100 pl-1 pr-3 py-1 rounded-full border border-slate-200">
                          <button 
                            onClick={() => {
                              setEditingMemberOriginalName(m);
                              setAddMemberName(m);
                              setAddMemberCommitment(activeTrip.memberCommitments?.[m]?.toString() || '0');
                              setAddMemberPhone(activeTrip.memberPhones?.[m] || '');
                            }}
                            className="text-sm font-bold text-slate-700 hover:text-emerald-600 transition-colors"
                          >
                            {m}
                          </button>
                          <button 
                            onClick={() => removeMemberFromTrip(m)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-500">{editingMemberOriginalName ? 'الاسم الجديد' : 'اسم العضو'}</label>
                  <input 
                    type="text" 
                    placeholder="اسم العضو" 
                    className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    value={addMemberName} 
                    onChange={e => setAddMemberName(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-500">قيمة الالتزام (القَطية)</label>
                  <input 
                    type="number" 
                    placeholder="المبلغ" 
                    className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    value={addMemberCommitment} 
                    onChange={e => setAddMemberCommitment(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-500">رقم الواتساب</label>
                  <input 
                    type="text" 
                    placeholder="رقم الواتساب (مثال: 9665xxxxxxxx)" 
                    className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    value={addMemberPhone} 
                    onChange={e => setAddMemberPhone(e.target.value)} 
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  {editingMemberOriginalName && (
                    <button 
                      onClick={() => {
                        setEditingMemberOriginalName(null);
                        setAddMemberName('');
                        setAddMemberCommitment('');
                      }} 
                      className="flex-1 py-4 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                    >
                      إلغاء
                    </button>
                  )}
                  <button 
                    onClick={addMemberToTrip} 
                    disabled={!addMemberName.trim()}
                    className={`flex-[2] py-4 rounded-xl font-bold shadow-lg transition-all ${!addMemberName.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}
                  >
                    {editingMemberOriginalName ? 'حفظ التعديلات' : 'تأكيد الإضافة'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showBudgetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowBudgetModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md relative z-10 space-y-4 text-right border-t-8 border-indigo-500">
              <div className="flex justify-between items-center border-b pb-4">
                <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-full transition-all"><X className="w-6 h-6" /></button>
                <h2 className="text-2xl font-bold text-slate-800">تحديد ميزانية الرحلة</h2>
              </div>
              <div className="space-y-6 pt-4 text-right">
                <p className="text-slate-500 text-sm leading-relaxed">حدد ميزانية تقديرية للرحلة لمساعدتك في تتبع المصاريف ومنع تجاوز السقف المالي.</p>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-500">الميزانية الإجمالية (ريال)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="أدخل ميزانية الرحلة.." 
                      className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-lg font-bold" 
                      value={newBudget} 
                      onChange={e => setNewBudget(e.target.value)} 
                    />
                    <ArrowRight className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowBudgetModal(false)} className="flex-1 py-4 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">إلغاء</button>
                  <button onClick={updateBudget} className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">حفظ الميزانية</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden pb-6 pt-2 px-4 pointer-events-none">
        <div className="max-w-md mx-auto bg-white/90 backdrop-blur-2xl border border-slate-100 shadow-[0_-8px_30px_rgb(0,0,0,0.1)] rounded-[2.5rem] p-2 flex justify-around items-center pointer-events-auto">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'summary' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <History className={`w-6 h-6 ${activeTab === 'summary' ? 'fill-emerald-100' : ''}`} />
            <span className="text-[10px] font-bold">ملخص</span>
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'expenses' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Wallet className={`w-6 h-6 ${activeTab === 'expenses' ? 'fill-emerald-100' : ''}`} />
            <span className="text-[10px] font-bold">مصاريف</span>
          </button>
          <div className="relative -mt-10">
            <button 
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${isGeneratingPDF ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white shadow-emerald-200 active:scale-95'}`}
            >
              {isGeneratingPDF ? (
                <div className="w-6 h-6 border-2 border-slate-400 border-t-emerald-600 rounded-full animate-spin" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
            </button>
          </div>
          <button 
            onClick={() => setActiveTab('gear')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'gear' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Package className={`w-6 h-6 ${activeTab === 'gear' ? 'fill-emerald-100' : ''}`} />
            <span className="text-[10px] font-bold">مهام اعضاء الرحلة</span>
          </button>
          <button 
            onClick={() => setActiveTab('itinerary')}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'itinerary' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Clock className={`w-6 h-6 ${activeTab === 'itinerary' ? 'fill-emerald-100' : ''}`} />
            <span className="text-[10px] font-bold">الجدول</span>
          </button>
        </div>
      </div>

      {/* Hidden Report Template for PDF Export */}
      <div 
        ref={reportRef} 
        style={{ 
          position: 'fixed',
          left: '-5000px',
          top: 0,
          width: '800px', 
          backgroundColor: 'white', 
          color: '#1e293b',
          zIndex: -1000,
        }}
        className="rtl p-10"
        dir="rtl"
      >
        <div className="border-b-8 border-emerald-600 pb-10 mb-10 flex justify-between items-center">
          <div className="space-y-4">
            <h1 className="text-5xl font-black text-emerald-900 mb-2">تقرير الرحلة النهائي</h1>
            <div className="bg-emerald-100 text-emerald-800 px-6 py-2 rounded-full text-2xl font-bold inline-block">
              {activeTrip?.name}
            </div>
            {activeTrip?.imageUrl && (
              <div className="w-full h-40 rounded-3xl overflow-hidden mt-4 border-2 border-emerald-100">
                <img src={activeTrip.imageUrl} alt="Trip cover" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
          <div className="text-left font-mono">
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-widest">TRIP ID</p>
            <p className="font-bold text-2xl text-emerald-800 mb-4">#{activeTrip?.id}</p>
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-widest">DATE</p>
            <p className="font-bold text-slate-800 italic">{new Date().toLocaleDateString('ar-SA')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-8">
          <div className="bg-emerald-50/50 p-8 rounded-[2.5rem] border-2 border-emerald-100 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-200/50 rounded-full -mr-6 -mt-6" />
            <p className="text-sm font-bold text-emerald-600 uppercase mb-2">إجمالي المصروفات</p>
            <p className="text-4xl font-black text-emerald-900">{totalSpent} <span className="text-base font-bold">ريال</span></p>
          </div>
          <div className="bg-amber-50/50 p-8 rounded-[2.5rem] border-2 border-amber-100 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-12 h-12 bg-amber-200/50 rounded-full -mr-6 -mt-6" />
            <p className="text-sm font-bold text-amber-600 uppercase mb-2">عدد الأعضاء</p>
            <p className="text-4xl font-black text-amber-900">{activeTrip?.members.length} <span className="text-base font-bold">أشخاص</span></p>
          </div>
          <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border-2 border-indigo-100 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-200/50 rounded-full -mr-6 -mt-6" />
            <p className="text-sm font-bold text-indigo-600 uppercase mb-2">نصيب الشخص</p>
            <p className="text-4xl font-black text-indigo-900">{share.toFixed(2)} <span className="text-base font-bold">ريال</span></p>
          </div>
        </div>

        {activeTrip?.budget && activeTrip.budget > 0 && (
          <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-200 mb-12 flex justify-between items-center">
            <div className="flex-1">
              <div className="flex justify-between items-end mb-3">
                <p className="text-sm font-bold text-slate-500 uppercase">مؤشر استهلاك الميزانية ({activeTrip.budget} ريال)</p>
                <p className={`text-lg font-black ${totalSpent > activeTrip.budget ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {((totalSpent / activeTrip.budget) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">
                <div 
                   className={`h-full ${totalSpent > activeTrip.budget ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min((totalSpent / activeTrip.budget) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="mr-8 text-left">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">الحالة المالية</p>
              <p className={`text-xl font-black ${totalSpent > activeTrip.budget ? 'text-rose-600' : 'text-emerald-600'}`}>
                {totalSpent > activeTrip.budget ? 'تعدى الميزانية' : 'تحت الميزانية'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-10 mb-12">
          <div>
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <span className="w-2 h-8 bg-emerald-500 rounded-full" />
              سجل المصروفات
            </h2>
            <div className="rounded-3xl border-2 border-slate-100 overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm">
                    <th className="p-4 border-b">الوصف</th>
                    <th className="p-4 border-b">المبلغ</th>
                    <th className="p-4 border-b text-left">الدافع</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                      <td className="p-4 border-b font-bold text-slate-700">{e.description}</td>
                      <td className="p-4 border-b text-emerald-600 font-bold">{e.amount} ريال</td>
                      <td className="p-4 border-b text-left text-slate-500 font-medium">{e.paidBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <span className="w-2 h-8 bg-amber-500 rounded-full" />
              صافي المستحقات (التصفيات)
            </h2>
            <div className="space-y-4">
              {settlements.map((s, i) => (
                <div key={i} className="flex justify-between items-center p-5 bg-white rounded-3xl border-2 border-slate-100 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-600">{s.from[0]}</div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center font-bold text-emerald-600">{s.to[0]}</div>
                    <div className="mr-2">
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">تحويل من {s.from}</p>
                       <p className="font-bold text-slate-800">إلى {s.to}</p>
                    </div>
                  </div>
                  <div className="text-xl font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                    {s.amount} <small className="text-xs">ريال</small>
                  </div>
                </div>
              ))}
              {settlements.length === 0 && (
                <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  لا توجد تصفيات مالية معلقة
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-10 border-t-2 border-slate-100 flex justify-between items-center opacity-60">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <Calculator className="text-white w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-emerald-900">نظام رحلة أبو عقيل</p>
                <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Trip Manager Pro</p>
              </div>
           </div>
           <div className="text-left font-bold text-slate-400 italic text-sm">
              صدر عبر التطبيق الذكي لإدارة الرحلات والمصاريف
           </div>
        </div>
      </div>

      {/* Hidden Gear Report */}
      <div 
        ref={gearPrintRef} 
        style={{ position: 'fixed', left: '-5000px', top: 0, width: '800px', padding: '15mm', backgroundColor: 'white', color: '#1e293b', zIndex: -1000 }}
        className="rtl"
        dir="rtl"
      >
        <div className="border-b-4 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
          <h2 className="text-3xl font-black text-emerald-900">قائمة مهام أعضاء الرحلة</h2>
          <p className="bg-emerald-50 text-emerald-700 px-4 py-1 rounded-xl text-sm font-bold">{activeTrip?.name}</p>
        </div>
        <div className="rounded-3xl border-2 border-slate-100 overflow-hidden">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm">
                <th className="p-4 border-b">الحالة</th>
                <th className="p-4 border-b">المهمة/الأداة</th>
                <th className="p-4 border-b">الموفر/المسؤول</th>
              </tr>
            </thead>
            <tbody>
              {gear.map((item, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-4 text-sm font-bold">
                    <span className={item.status === 'available' ? 'text-emerald-600' : 'text-amber-600'}>
                      {item.status === 'available' ? '✅ جاهز' : '⏳ نحتاجه'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-800">{item.name}</td>
                  <td className="p-4 text-slate-500">{item.provider || 'الجميع'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Expenses Report */}
      <div 
        ref={expensesPrintRef} 
        style={{ position: 'fixed', left: '-5000px', top: 0, width: '800px', padding: '15mm', backgroundColor: 'white', color: '#1e293b', zIndex: -1000 }}
        className="rtl"
        dir="rtl"
      >
        <div className="border-b-4 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
          <h2 className="text-3xl font-black text-emerald-900">سجل مصروفات الرحلة</h2>
          <p className="bg-emerald-50 text-emerald-700 px-4 py-1 rounded-xl text-sm font-bold">{activeTrip?.name}</p>
        </div>
        <div className="mb-6 bg-emerald-50 p-6 rounded-3xl border border-emerald-100 text-center">
          <p className="text-emerald-700 font-bold mb-1">إجمالي المصروفات</p>
          <p className="text-4xl font-black text-emerald-900">{totalSpent} ريال</p>
        </div>
        <div className="rounded-3xl border-2 border-slate-100 overflow-hidden">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm">
                <th className="p-4 border-b">الوصف</th>
                <th className="p-4 border-b">المبلغ</th>
                <th className="p-4 border-b">الدافع</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-4 font-bold text-slate-800">{e.description}</td>
                  <td className="p-4 font-bold text-emerald-600">{e.amount} ريال</td>
                  <td className="p-4 text-slate-500">{e.paidBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Prep Tasks Report */}
      <div 
        ref={tasksPrintRef} 
        style={{ position: 'fixed', left: '-5000px', top: 0, width: '800px', padding: '15mm', backgroundColor: 'white', color: '#1e293b', zIndex: -1000 }}
        className="rtl"
        dir="rtl"
      >
        <div className="border-b-4 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
          <h2 className="text-3xl font-black text-emerald-900">مهام تحضير الرحلة</h2>
          <p className="bg-emerald-50 text-emerald-700 px-4 py-1 rounded-xl text-sm font-bold">{activeTrip?.name}</p>
        </div>
        <div className="rounded-3xl border-2 border-slate-100 overflow-hidden">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm">
                <th className="p-4 border-b">الحالة</th>
                <th className="p-4 border-b">المهمة</th>
                <th className="p-4 border-b">المسؤول</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-4 text-sm font-bold">
                    <span className={t.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}>
                      {t.status === 'completed' ? '✅ مكتملة' : '⏳ جارية'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-800">{t.title}</td>
                  <td className="p-4 text-slate-500">{t.assignedTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
