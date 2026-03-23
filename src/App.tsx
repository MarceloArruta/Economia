import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Wallet, 
  TrendingDown, 
  ArrowUpCircle, 
  ArrowDownCircle,
  RotateCcw,
  History,
  CheckCircle2,
  X,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp, 
  setDoc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';

interface Expense {
  id: string;
  amount: number;
  date: string;
}

interface MonthlyHistory {
  id: string;
  label: string;
  income: number;
  totalSpent: number;
  balance: number;
  date: string;
}

export default function App() {
  // Room ID from URL or default
  const [roomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'default';
  });

  const [income, setIncome] = useState<number>(0);
  const [dailyLimit, setDailyLimit] = useState<number>(100);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [history, setHistory] = useState<MonthlyHistory[]>([]);
  
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [isEditingDailyLimit, setIsEditingDailyLimit] = useState(false);
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [tempIncome, setTempIncome] = useState('0');
  const [tempDailyLimit, setTempDailyLimit] = useState('100');
  const [showShareToast, setShowShareToast] = useState(false);

  // Firestore Listeners
  useEffect(() => {
    // Listen to Room Info (Income)
    const roomRef = doc(db, 'rooms', roomId);
    const unsubRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIncome(data.income || 0);
        setTempIncome((data.income || 0).toString());
        setDailyLimit(data.dailyLimit || 100);
        setTempDailyLimit((data.dailyLimit || 100).toString());
      } else {
        // Initialize room if it doesn't exist
        setDoc(roomRef, { income: 0, dailyLimit: 100, createdAt: serverTimestamp() });
      }
    });

    // Listen to Expenses
    const expensesRef = collection(db, 'rooms', roomId, 'expenses');
    const qExpenses = query(expensesRef, orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(data);
    });

    // Listen to History
    const historyRef = collection(db, 'rooms', roomId, 'history');
    const qHistory = query(historyRef, orderBy('createdAt', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MonthlyHistory[];
      setHistory(data);
    });

    return () => {
      unsubRoom();
      unsubExpenses();
      unsubHistory();
    };
  }, [roomId]);

  // Cálculos
  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const balance = income - totalSpent;

  const dailyGroups = useMemo(() => {
    const groups: { [key: string]: number } = {};
    expenses.forEach(exp => {
      groups[exp.date] = (groups[exp.date] || 0) + exp.amount;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  // Handlers
  const handleUpdateIncome = async () => {
    const val = parseFloat(tempIncome) || 0;
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, { income: val });
    setIsEditingIncome(false);
  };

  const handleUpdateDailyLimit = async () => {
    const val = parseFloat(tempDailyLimit) || 0;
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, { dailyLimit: val });
    setIsEditingDailyLimit(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmount) return;

    const expensesRef = collection(db, 'rooms', roomId, 'expenses');
    await addDoc(expensesRef, {
      amount: parseFloat(newAmount),
      date: newDate,
      createdAt: serverTimestamp(),
      author: 'Anônimo'
    });

    setNewAmount('');
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteDoc(doc(db, 'rooms', roomId, 'expenses', id));
  };

  const handleCloseMonth = async () => {
    const now = new Date();
    const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(now);
    
    const historyRef = collection(db, 'rooms', roomId, 'history');
    await addDoc(historyRef, {
      label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      income,
      totalSpent,
      balance,
      createdAt: serverTimestamp()
    });

    // Clear expenses
    for (const exp of expenses) {
      await deleteDoc(doc(db, 'rooms', roomId, 'expenses', exp.id));
    }

    setIsClosingMonth(false);
  };

  const deleteHistoryItem = async (id: string) => {
    await deleteDoc(doc(db, 'rooms', roomId, 'history', id));
  };

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 3000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans p-4 md:p-8 pb-24">
      <div className="max-w-md mx-auto">
        
        <header className="mb-8 flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Meu Financeiro</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sala: {roomId}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleShare} className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400 hover:text-blue-500 transition-all">
              <Share2 size={18} />
            </button>
          </div>
        </header>

        {/* Cards Principais */}
        <div className="space-y-4 mb-8">
          <motion.div layout className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Renda Atual</span>
              <button onClick={() => setIsEditingIncome(true)} className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-100 uppercase">Alterar</button>
            </div>
            <div className="text-3xl font-black tracking-tighter">{formatCurrency(income)}</div>
            <div className="absolute -right-4 -bottom-4 opacity-5"><ArrowUpCircle size={100} /></div>
          </motion.div>

          <motion.div layout className="bg-black text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
            <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest block mb-2">Gasto do Mês Atual</span>
            <div className="text-3xl font-black tracking-tighter">{formatCurrency(totalSpent)}</div>
            <div className="absolute -right-4 -bottom-4 opacity-10"><ArrowDownCircle size={100} /></div>
          </motion.div>

          <motion.div layout className={`p-6 rounded-[2rem] border-2 ${balance >= 0 ? 'bg-white border-emerald-500/20' : 'bg-red-50 border-red-500/20'}`}>
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Sobra Disponível</span>
            <div className={`text-3xl font-black tracking-tighter ${balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</div>
          </motion.div>

          {/* Limite Diário */}
          <motion.div layout className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Meta de Gasto Diário</span>
              <button onClick={() => setIsEditingDailyLimit(true)} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100 uppercase">Alterar</button>
            </div>
            <div className="text-2xl font-black tracking-tighter text-blue-600">
              {formatCurrency(dailyLimit)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${ (totalSpent / (new Date().getDate() * dailyLimit)) > 1 ? 'bg-red-500' : 'bg-blue-500' }`}
                  style={{ width: `${Math.min(100, (totalSpent / (new Date().getDate() * dailyLimit)) * 100)}%` }}
                />
              </div>
              <span className="text-[8px] font-bold text-gray-400 uppercase">Consumo do Mês</span>
            </div>
          </motion.div>
        </div>

        {/* Ações Rápidas */}
        <div className="flex gap-2 mb-8">
          <button 
            onClick={() => setIsClosingMonth(true)}
            className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
          >
            <CheckCircle2 size={16} /> Fechar Mês
          </button>
        </div>

        {/* Formulário de Gasto */}
        <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8">
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 ml-2">Valor Gasto</label>
                <input type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0,00" className="w-full px-4 py-3 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 ml-2">Data</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-xs font-bold" required />
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all active:scale-95">Adicionar Gasto</button>
          </form>
        </section>

        {/* Gastos Individuais */}
        <div className="mb-12">
          <h2 className="text-xs font-black uppercase tracking-widest mb-4 px-2">Gastos do Mês Atual</h2>
          <div className="space-y-2">
            {expenses.length === 0 ? (
              <p className="text-center py-8 text-gray-300 text-xs font-bold uppercase">Nenhum gasto este mês</p>
            ) : (
              expenses.map((exp) => (
                <div key={exp.id} className="bg-white px-5 py-4 rounded-2xl flex justify-between items-center border border-gray-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-gray-400">{new Date(exp.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="font-black text-sm">{formatCurrency(exp.amount)}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-gray-200 hover:text-red-500 transition-all p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Histórico de Meses Fechados */}
        <section className="pt-8 border-t-2 border-dashed border-gray-200">
          <div className="flex items-center gap-2 mb-6 px-2">
            <History size={18} className="text-gray-400" />
            <h2 className="text-xs font-black uppercase tracking-widest">Histórico Mensal</h2>
          </div>
          
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-center py-8 text-gray-300 text-xs font-bold uppercase">Nenhum mês fechado ainda</p>
            ) : (
              history.map((item) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={item.id} 
                  className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm relative group"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black uppercase italic text-emerald-600">{item.label}</h3>
                    <button 
                      onClick={() => deleteHistoryItem(item.id)}
                      className="text-gray-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-gray-50 pb-1">
                      <span className="text-[10px] font-black uppercase text-gray-400">Renda</span>
                      <span className="text-sm font-bold">{formatCurrency(item.income)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-50 pb-1">
                      <span className="text-[10px] font-black uppercase text-gray-400">Gasto</span>
                      <span className="text-sm font-bold text-orange-500">{formatCurrency(item.totalSpent)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] font-black uppercase text-gray-400">Sobra</span>
                      <span className={`text-sm font-black ${item.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>

        {/* Modais */}
        <AnimatePresence>
          {isEditingIncome && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-xs text-center">
                <h2 className="text-lg font-black uppercase mb-6 italic">Sua Renda Mensal</h2>
                <input type="number" value={tempIncome} onChange={(e) => setTempIncome(e.target.value)} className="w-full px-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 text-2xl font-black text-center mb-6" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingIncome(false)} className="flex-1 py-3 text-xs font-bold text-gray-400 uppercase">Voltar</button>
                  <button onClick={handleUpdateIncome} className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest">Salvar</button>
                </div>
              </motion.div>
            </div>
          )}

          {isEditingDailyLimit && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-xs text-center">
                <h2 className="text-lg font-black uppercase mb-6 italic">Meta Diária</h2>
                <input type="number" value={tempDailyLimit} onChange={(e) => setTempDailyLimit(e.target.value)} className="w-full px-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-2xl font-black text-center mb-6" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingDailyLimit(false)} className="flex-1 py-3 text-xs font-bold text-gray-400 uppercase">Voltar</button>
                  <button onClick={handleUpdateDailyLimit} className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest">Salvar</button>
                </div>
              </motion.div>
            </div>
          )}

          {isClosingMonth && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-xs text-center">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-lg font-black uppercase mb-2 italic">Fechar Mês?</h2>
                <p className="text-xs text-gray-400 font-bold mb-6">Isso salvará os dados atuais no histórico e limpará os gastos para o novo mês.</p>
                <div className="flex gap-2">
                  <button onClick={() => setIsClosingMonth(false)} className="flex-1 py-3 text-xs font-bold text-gray-400 uppercase">Cancelar</button>
                  <button onClick={handleCloseMonth} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest">Confirmar</button>
                </div>
              </motion.div>
            </div>
          )}

          {showShareToast && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl z-[100]">
              Link da sala copiado!
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
