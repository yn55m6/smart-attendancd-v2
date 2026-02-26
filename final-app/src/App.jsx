import React, { useState, useEffect, useMemo } from 'react';
import { 
  Camera, FileText, CheckCircle, XCircle, Users, BarChart2, Calendar, 
  Plus, Trash2, Save, RefreshCw, TrendingUp, UserCheck, ClipboardList, 
  Clock, QrCode, Smartphone, LogIn, LogOut, ChevronRight, Loader, Cloud, WifiOff, AlertCircle, UserPlus, FileBarChart, Filter, Download, Award, Printer, RotateCcw, X, Link as LinkIcon, Copy, PlayCircle, ShieldAlert
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : "{}";
const firebaseConfig = JSON.parse(firebaseConfigStr);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'excel-spec-attendance-v1';

const TIME_SLOTS = ['오전', '오후', '저녁'];
const DAYS_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const EXCLUDED_WORDS = ['출석', '결석', '지각', '오전', '오후', '저녁', '요일', '명단', '확인', '선생님', '수업', '체크', '이름', '번호'];

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [classId, setClassId] = useState("");
  const [inputClassId, setInputClassId] = useState("");
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });
  const [activeTab, setActiveTab] = useState('attendance');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentSlot, setCurrentSlot] = useState('오전');
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState('admin'); 
  const [qrSession, setQrSession] = useState(null); 
  const [reportView, setReportView] = useState('individual');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [customBaseUrl, setCustomBaseUrl] = useState(() => localStorage.getItem('attendance_base_url') || "");
  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', text: '', action: null });
  const [promptVal, setPromptVal] = useState("");

  const showStatus = (text, type = "info") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: "", type: "" }), 4000);
  };

  useEffect(() => { localStorage.setItem('attendance_base_url', customBaseUrl); }, [customBaseUrl]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { showStatus("인증 서버 연결 실패", "error"); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      setUser(currUser); setIsLoading(false);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'member') {
      const day = params.get('day'), slot = params.get('slot'), target = params.get('classId');
      if (day && slot && target) {
        setViewMode('student'); setClassId(target); setQrSession({ day, slot }); setIsLoggedIn(true);
      }
    }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !classId || !isLoggedIn) return;
    const safeId = classId.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    setIsLoading(true);
    const membersRef = collection(db, 'artifacts', appId, 'public', 'data', `members_${safeId}`);
    const unsubMembers = onSnapshot(membersRef, (snap) => {
      const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setMembers(list.sort((a, b) => a.name.localeCompare(b.name)));
      setIsLoading(false);
    });
    const sessionsRef = collection(db, 'artifacts', appId, 'public', 'data', `sessions_${safeId}`);
    const unsubSessions = onSnapshot(sessionsRef, (snap) => {
      const data = {};
      snap.docs.forEach(doc => { data[doc.id] = doc.data(); });
      setSessions(data);
    });
    return () => { unsubMembers(); unsubSessions(); };
  }, [user, classId, isLoggedIn]);

  const handleLogin = (e) => { e.preventDefault(); if (!inputClassId.trim()) return; setClassId(inputClassId.trim()); setIsLoggedIn(true); };

  const addMemberToDB = async (name) => {
    if (!name.trim() || !user) return null;
    const safeId = classId.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const docId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMember = { name: name.trim(), group: '정회원', createdAt: new Date().toISOString() };
    try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `members_${safeId}`, docId), newMember); return { ...newMember, id: docId }; } catch (err) { return null; }
  };

  const confirmDeleteMember = (memberId, memberName) => {
    const hasRecord = Object.values(sessions).some(session => session.presentIds?.includes(memberId));
    if (hasRecord) { showStatus(`'${memberName}' 회원은 출석 기록이 존재하여 삭제할 수 없습니다.`, "error"); return; }
    setModal({ isOpen: true, type: 'confirm', title: '회원 삭제', text: `'${memberName}'님을 명부에서 완전히 삭제하시겠습니까?`, action: async () => {
        try { const safeId = classId.replace(/[^a-zA-Z0-9가-힣]/g, '_'); await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `members_${safeId}`, memberId)); showStatus(`${memberName} 회원이 삭제되었습니다.`, "success"); } catch (err) {}
    }});
  };

  const updateAttendance = async (date, slot, presentIds) => {
    if (!user) return;
    const safeId = classId.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const sessionId = `${date}_${slot}`;
    try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `sessions_${safeId}`, sessionId), { id: sessionId, date, slot, presentIds, updatedAt: new Date().toISOString() }); } catch (err) { }
  };

  const resetCurrentSession = () => {
    const currentPresentCount = (sessions[`${currentDate}_${currentSlot}`]?.presentIds || []).length;
    if (currentPresentCount === 0) return showStatus("지울 데이터가 없습니다.", "info");
    setModal({ isOpen: true, type: 'confirm', title: '세션 초기화', text: `${currentDate} ${currentSlot} 출석 기록을 모두 삭제하시겠습니까?`, action: async () => {
        await updateAttendance(currentDate, currentSlot, []); showStatus("기록이 초기화되었습니다.", "success");
    }});
  };

  const openSelfRegistrationModal = () => {
    setModal({ isOpen: true, type: 'prompt', title: '신규 회원 출석', text: '명단에 이름이 없습니다.\n등록하실 성함을 입력해주세요.', action: async (name) => {
        if (!name || name.trim().length < 2) return showStatus("정확한 성함을 입력해주세요.", "error");
        const result = await addMemberToDB(name);
        if (result) {
          const today = new Date().toISOString().split('T')[0];
          const todayKey = `${today}_${qrSession.slot}`;
          const curP = sessions[todayKey]?.presentIds || [];
          await updateAttendance(today, qrSession.slot, [...curP, result.id]);
          showStatus(`${name}님 출석 확인되었습니다.`, "success");
        }
    }});
  };

  const analyzeAndIngest = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    const found = inputText.match(/[가-힣]{2,4}/g) || [];
    const uniqueFound = Array.from(new Set(found)).filter(n => !EXCLUDED_WORDS.includes(n));
    let currentMembers = [...members];
    for (const name of uniqueFound) {
      if (!currentMembers.some(m => m.name === name)) {
        const res = await addMemberToDB(name); if (res) currentMembers.push(res);
      }
    }
    const normalizedText = inputText.replace(/\s+/g, '');
    const matchedIds = currentMembers.filter(m => normalizedText.includes(m.name)).map(m => m.id);
    const todayKey = `${currentDate}_${currentSlot}`;
    const existingIds = sessions[todayKey]?.presentIds || [];
    await updateAttendance(currentDate, currentSlot, Array.from(new Set([...existingIds, ...matchedIds])));
    setIsAnalyzing(false); setInputText(""); showStatus("종이 명단 스캔 데이터 적재 완료", "success");
  };

  const handleSelfCheckIn = async (mId, mName) => {
    const today = new Date().toISOString().split('T')[0];
    const todayKey = `${today}_${qrSession.slot}`;
    const currentP = sessions[todayKey]?.presentIds || [];
    if (currentP.includes(mId)) {
        setModal({ isOpen: true, type: 'confirm', title: '출석 취소', text: '이미 출석되었습니다. 취소하시겠습니까?', action: async () => {
            await updateAttendance(today, qrSession.slot, currentP.filter(id => id !== mId)); showStatus("출석이 취소되었습니다.", "info");
        }}); return;
    }
    await updateAttendance(today, qrSession.slot, [...currentP, mId]);
    showStatus(`${mName}님 출석 확인 완료!`, "success");
  };

  const getQRUrl = (day, slot) => {
    let base = customBaseUrl.trim() || (window.location.origin + window.location.pathname);
    if (base.endsWith('/')) base = base.slice(0, -1);
    const url = `${base}?mode=member&classId=${encodeURIComponent(classId)}&day=${encodeURIComponent(day)}&slot=${encodeURIComponent(slot)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
  };

  const individualStats = useMemo(() => {
    const month = selectedMonth;
    const monthlySessions = Object.values(sessions).filter(s => s.date.startsWith(month));
    if (members.length === 0) return [];
    return members.map(m => {
      const attended = monthlySessions.filter(s => (s.presentIds || []).includes(m.id));
      const slotCounts = { 오전: attended.filter(s => s.slot === '오전').length, 오후: attended.filter(s => s.slot === '오후').length, 저녁: attended.filter(s => s.slot === '저녁').length };
      return { ...m, slotCounts, total: attended.length, rate: monthlySessions.length > 0 ? Math.round((attended.length / monthlySessions.length) * 100) : 0 };
    }).sort((a, b) => b.total - a.total);
  }, [sessions, members, selectedMonth]);

  const dailyStats = useMemo(() => {
    const table = {};
    Object.values(sessions).forEach(s => {
      if (s.date.startsWith(selectedMonth)) {
        if (!table[s.date]) table[s.date] = { 오전: 0, 오후: 0, 저녁: 0, 합계: 0 };
        const c = s.presentIds?.length || 0; table[s.date][s.slot] = c; table[s.date].합계 += c;
      }
    });
    return Object.entries(table).map(([date, c]) => ({ date, ...c })).sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, selectedMonth]);

  if (isLoading && !isLoggedIn) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader className="w-10 h-10 animate-spin text-blue-600 mb-2" /></div>;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-md">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl"><ClipboardList className="w-8 h-8" /></div>
          <h1 className="text-2xl font-black text-slate-900 mb-2 text-center">회원 출석 체크 프로그램</h1>
          <p className="text-slate-400 text-sm mb-8 text-center font-medium">관리자 전용 대시보드 로그인</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" value={inputClassId} onChange={(e) => setInputClassId(e.target.value)} placeholder="명부 이름 입력" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-center" autoFocus />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"><LogIn className="w-5 h-5" /> 접속하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 relative">
      {modal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-lg font-black mb-2">{modal.title}</h3>
            <p className="text-slate-500 mb-6 font-medium text-sm whitespace-pre-wrap">{modal.text}</p>
            {modal.type === 'prompt' && <input type="text" value={promptVal} onChange={e => setPromptVal(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl mb-5 outline-none font-bold" autoFocus />}
            <div className="flex gap-2">
              <button onClick={() => { setModal({ isOpen: false }); setPromptVal(""); }} className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-xl">취소</button>
              <button onClick={() => { modal.action(promptVal); setModal({ isOpen: false }); setPromptVal(""); }} className={`flex-1 py-3 text-white font-black rounded-xl ${modal.type === 'confirm' ? 'bg-red-600' : 'bg-blue-600'}`}>확인</button>
            </div>
          </div>
        </div>
      )}
      {statusMsg.text && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-sm">
          <div className={`px-5 py-3 rounded-2xl shadow-2xl flex items-center justify-center gap-2 text-sm font-black border ${statusMsg.type === 'error' ? 'bg-white border-red-200 text-red-600' : 'bg-slate-900 text-white'}`}>
            <span>{statusMsg.text}</span>
          </div>
        </div>
      )}

      {viewMode === 'student' ? (
        <div className="flex flex-col items-center mt-4 px-4">
          <header className="w-full max-w-md bg-blue-600 text-white p-6 rounded-[32px] mb-6 text-center relative">
            <button onClick={() => setViewMode('admin')} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full"><LogOut className="w-4 h-4" /></button>
            <Smartphone className="w-8 h-8 mx-auto mb-3 opacity-90" />
            <h1 className="text-xl font-black">{qrSession.day} {qrSession.slot}반 출석</h1>
          </header>
          <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-sm border border-blue-100">
            <h2 className="font-black mb-6 flex items-center gap-2 text-base border-b pb-3"><Users className="w-5 h-5 text-blue-500" /> 본인 성함을 터치하세요</h2>
            <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto pr-2">
              {members.map(m => {
                const isDone = (sessions[`${new Date().toISOString().split('T')[0]}_${qrSession.slot}`]?.presentIds || []).includes(m.id);
                return (
                  <button key={m.id} onClick={() => handleSelfCheckIn(m.id, m.name)} className={`w-full p-4 rounded-2xl font-bold flex justify-between items-center transition-all border-2 ${isDone ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                    <span>{m.name}</span>{isDone ? <span className="text-[10px] bg-blue-100 px-2 py-1 rounded-md">출석완료</span> : <ChevronRight className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
            <button onClick={openSelfRegistrationModal} className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-black text-sm flex items-center justify-center gap-2"><UserPlus className="w-4 h-4" /> 명단에 없으신가요?</button>
          </div>
        </div>
      ) : (
        <>
          <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-50 flex justify-between items-center">
            <div className="max-w-7xl mx-auto w-full flex justify-between items-center px-2">
              <div className="flex items-center gap-3"><div className="bg-blue-600 text-white p-2 rounded-xl"><ClipboardList className="w-4 h-4"/></div><div><h2 className="text-base font-black">출석 관리자</h2><p className="text-[9px] font-black text-slate-400 uppercase">{classId}</p></div></div>
              <button onClick={() => { setClassId(""); setIsLoggedIn(false); }} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><LogOut className="w-4 h-4" /></button>
            </div>
          </header>
          <main className="max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex bg-white rounded-2xl p-1.5 mb-6 gap-1 overflow-x-auto no-scrollbar shadow-sm">
              {[{ id: 'attendance', label: '종이 스캔', icon: Camera }, { id: 'templates', label: 'QR 생성', icon: QrCode }, { id: 'report', label: '통계', icon: FileBarChart }, { id: 'management', label: '명부', icon: Users }].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 min-w-[80px] py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><tab.icon className="w-3.5 h-3.5" /> {tab.label}</button>
              ))}
            </div>

            {activeTab === 'attendance' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                  <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="bg-slate-50 p-3 rounded-xl font-black text-sm outline-none" />
                  <div className="flex bg-slate-100 p-1 rounded-xl w-full">{TIME_SLOTS.map(slot => (<button key={slot} onClick={() => setCurrentSlot(slot)} className={`flex-1 py-2 rounded-lg text-xs font-black ${currentSlot === slot ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>{slot}</button>))}</div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="font-black mb-4 flex items-center gap-2"><FileText className="w-4 h-4"/> 종이명단 스캔</h3>
                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="스캔 텍스트 붙여넣기" className="w-full h-40 bg-slate-50 rounded-xl p-4 text-sm outline-none mb-4" />
                    <button onClick={analyzeAndIngest} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl"><Camera className="w-4 h-4 inline mr-2"/> 일괄 출석</button>
                  </div>
                  <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-black flex items-center gap-2"><Users className="w-5 h-5"/> {currentSlot}반 출석</h3><button onClick={resetCurrentSession} className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg font-bold">초기화</button></div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {members.map(m => {
                        const isP = (sessions[`${currentDate}_${currentSlot}`]?.presentIds || []).includes(m.id);
                        return (
                          <div key={m.id} onClick={() => {
                            const curP = sessions[`${currentDate}_${currentSlot}`]?.presentIds || [];
                            updateAttendance(currentDate, currentSlot, isP ? curP.filter(id => id !== m.id) : [...curP, m.id]);
                          }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 cursor-pointer ${isP ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                            {isP ? <CheckCircle className="w-5 h-5"/> : <XCircle className="w-5 h-5 opacity-20"/>} <span className="font-black text-sm">{m.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="space-y-6">
                <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-200">
                  <h4 className="font-black text-yellow-800 text-sm mb-2">Vercel 배포 URL 입력</h4>
                  <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} placeholder="https://..." className="w-full bg-white border border-yellow-200 p-3 rounded-xl text-sm outline-none"/>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {DAYS_KR.slice(1, 7).concat(DAYS_KR[0]).map(day => (
                    <div key={day} className="bg-white p-6 rounded-3xl border border-slate-100"><h4 className="font-black mb-4 border-l-4 border-blue-600 pl-3">{day}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {TIME_SLOTS.map(slot => (
                          <div key={slot} className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl"><span className="font-black text-xs text-slate-500 mb-2">{slot}반</span><img src={getQRUrl(day, slot)} alt="QR" className="w-24 h-24 mb-3 rounded-xl bg-white p-2" /><button onClick={() => {setQrSession({ day, slot }); setViewMode('student'); window.scrollTo(0,0);}} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-black">시뮬레이션</button></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'report' && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                 <div className="flex gap-2 mb-6"><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-50 p-2 rounded-xl text-sm font-black outline-none" /></div>
                 <div className="overflow-x-auto"><table className="w-full text-left text-sm whitespace-nowrap"><thead><tr className="border-b"><th className="pb-3 px-2">이름</th><th className="pb-3 text-center">오전</th><th className="pb-3 text-center">오후</th><th className="pb-3 text-center">저녁</th><th className="pb-3 text-blue-600 font-black">총합</th></tr></thead><tbody className="divide-y">{individualStats.map(i => (<tr key={i.id}><td className="py-3 px-2 font-black">{i.name}</td><td className="py-3 text-center text-slate-500">{i.slotCounts.오전}</td><td className="py-3 text-center text-slate-500">{i.slotCounts.오후}</td><td className="py-3 text-center text-slate-500">{i.slotCounts.저녁}</td><td className="py-3 text-blue-600 font-black">{i.total}</td></tr>))}</tbody></table></div>
              </div>
            )}

            {activeTab === 'management' && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex gap-2 mb-6"><input id="newMemInput" type="text" placeholder="새 회원 이름" className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" onKeyDown={(e) => { if (e.key === 'Enter') { addMemberToDB(e.currentTarget.value); e.currentTarget.value = ""; } }} /><button onClick={() => { const el = document.getElementById('newMemInput'); addMemberToDB(el.value); el.value = ""; }} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-sm">등록</button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map(m => (<div key={m.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50"><span className="font-black text-sm">{m.name}</span><button onClick={() => confirmDeleteMember(m.id, m.name)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div>))}
                </div>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}

