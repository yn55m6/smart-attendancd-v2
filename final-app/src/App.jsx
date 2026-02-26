import React, { useState, useEffect, useMemo } from 'react';
import { 
  Camera, FileText, CheckCircle, XCircle, Users, FileBarChart, 
  Trash2, QrCode, Smartphone, LogIn, LogOut, ChevronLeft, 
  ClipboardList, UserPlus, CalendarDays, BarChart3, ChevronRight
} from 'lucide-react';

const TIME_SLOTS = ['오전', '오후', '저녁'];
const DAYS_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const EXCLUDED_WORDS = ['출석', '결석', '지각', '오전', '오후', '저녁', '요일', '명단'];

const SCHEDULE_CONFIG = {
  '일요일': [],
  '월요일': ['오전', '오후', '저녁'],
  '화요일': ['오전', '오후', '저녁'],
  '수요일': ['오전', '오후', '저녁'],
  '목요일': ['오전', '오후', '저녁'],
  '금요일': ['오전', '오후', '저녁'],
  '토요일': ['오후']
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [classId, setClassId] = useState("");
  const [inputClassId, setInputClassId] = useState("");
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState({});
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });
  const [activeTab, setActiveTab] = useState('attendance');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentSlot, setCurrentSlot] = useState('오전');
  const [inputText, setInputText] = useState("");
  const [viewMode, setViewMode] = useState('admin'); 
  const [qrSession, setQrSession] = useState(null); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [reportType, setReportType] = useState('summary'); 
  const [customBaseUrl, setCustomBaseUrl] = useState(() => localStorage.getItem('attendance_base_url') || "");
  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', text: '', action: null });
  const [promptVal, setPromptVal] = useState("");

  const showStatus = (text, type = "info") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: "", type: "" }), 3000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'member') {
      const day = params.get('day'), slot = params.get('slot'), targetClass = params.get('classId');
      if (day && slot && targetClass) {
        setViewMode('member'); setClassId(targetClass); setQrSession({ day, slot }); setIsLoggedIn(true);
        const savedMembers = localStorage.getItem(`members_${targetClass}`), savedSessions = localStorage.getItem(`sessions_${targetClass}`);
        if (savedMembers) setMembers(JSON.parse(savedMembers));
        if (savedSessions) setSessions(JSON.parse(savedSessions));
      }
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!inputClassId.trim()) return;
    const cid = inputClassId.trim(); setClassId(cid); setIsLoggedIn(true);
    const savedMembers = localStorage.getItem(`members_${cid}`), savedSessions = localStorage.getItem(`sessions_${cid}`);
    if (savedMembers) setMembers(JSON.parse(savedMembers));
    if (savedSessions) setSessions(JSON.parse(savedSessions));
  };

  useEffect(() => {
    if (!isLoggedIn || !classId) return;
    localStorage.setItem(`members_${classId}`, JSON.stringify(members));
    localStorage.setItem(`sessions_${classId}`, JSON.stringify(sessions));
    localStorage.setItem('attendance_base_url', customBaseUrl);
  }, [members, sessions, isLoggedIn, classId, customBaseUrl]);

  const updateAttendance = (date, slot, presentIds) => {
    const sessionId = `${date}_${slot}`;
    setSessions(prev => ({ ...prev, [sessionId]: { id: sessionId, date, slot, presentIds } }));
  };

  const currentDayName = DAYS_KR[new Date(currentDate).getDay()];
  const availableSlots = SCHEDULE_CONFIG[currentDayName];

  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(currentSlot)) setCurrentSlot(availableSlots[0]);
  }, [currentDate, currentSlot, availableSlots]);

  const statsData = useMemo(() => {
    const monthlySessions = Object.values(sessions).filter(s => s.date.startsWith(selectedMonth));
    const individual = members.map(m => {
      const attended = monthlySessions.filter(s => (s.presentIds || []).includes(m.id));
      return { ...m, total: attended.length, 오전: attended.filter(s => s.slot === '오전').length, 오후: attended.filter(s => s.slot === '오후').length, 저녁: attended.filter(s => s.slot === '저녁').length };
    }).sort((a, b) => b.total - a.total);
    const summary = { 오전: 0, 오후: 0, 저녁: 0, 총합: 0 };
    const daily = {};
    monthlySessions.forEach(s => {
      const count = (s.presentIds || []).length;
      if(count > 0) {
        summary[s.slot] += count; summary.총합 += count;
        if (!daily[s.date]) daily[s.date] = { 오전: [], 오후: [], 저녁: [] };
        daily[s.date][s.slot] = (s.presentIds || []).map(id => members.find(m => m.id === id)?.name).filter(Boolean);
      }
    });
    return { individual, summary, daily: Object.entries(daily).map(([date, slots]) => ({ date, slots })).sort((a, b) => b.date.localeCompare(a.date)) };
  }, [sessions, members, selectedMonth]);

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-slate-100 flex justify-center items-center font-sans">
        <div className="w-full h-full max-w-[430px] bg-slate-900 flex flex-col justify-center px-8 shadow-2xl relative sm:rounded-[40px] sm:max-h-[90vh] overflow-hidden border-[8px] border-slate-800">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30"><ClipboardList className="w-8 h-8" /></div>
            <h1 className="text-2xl font-black text-slate-900 mb-1 text-center tracking-tighter">회원 출석 시스템</h1>
            <p className="text-slate-400 text-sm mb-10 text-center font-bold uppercase tracking-widest">Admin Login</p>
            <form onSubmit={handleLogin} className="space-y-5">
              <input type="text" value={inputClassId} onChange={(e) => setInputClassId(e.target.value)} placeholder="명부 이름 (예: class-1)" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:border-blue-500 focus:bg-white font-black text-center text-lg transition-all" autoFocus />
              <button type="submit" className="w-full bg-blue-600 active:scale-95 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-600/20 transition-transform flex items-center justify-center gap-3 text-lg"><LogIn className="w-6 h-6" /> 접속하기</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-100 flex justify-center items-center font-sans overflow-hidden">
      <div className="w-full h-full max-w-[430px] bg-white flex flex-col relative shadow-2xl sm:rounded-[40px] sm:max-h-[90vh] overflow-hidden border-x-[8px] border-t-[8px] border-slate-800">
        
        {/* 상단 헤더 */}
        <header className="bg-white pt-10 pb-4 px-6 flex justify-between items-center border-b border-slate-100 shrink-0 z-10 shadow-sm">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">{viewMode === 'member' ? '회원 출석' : '관리자'}</h2>
            <div className="flex items-center gap-1.5 mt-0.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{classId}</p></div>
          </div>
          {viewMode === 'member' ? (
            <button onClick={() => setViewMode('admin')} className="p-3 bg-slate-100 text-slate-600 rounded-2xl active:scale-90 transition-transform"><ChevronLeft className="w-5 h-5" /></button>
          ) : (
            <button onClick={() => { setClassId(""); setIsLoggedIn(false); }} className="p-3 bg-slate-100 text-slate-400 rounded-2xl active:scale-90 transition-transform"><LogOut className="w-5 h-5" /></button>
          )}
        </header>

        {/* 메인 콘텐츠 영역 */}
        <main className="flex-1 overflow-y-auto bg-white p-6 pb-32">
          {viewMode === 'member' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl shadow-blue-600/20 mb-8">
                <Smartphone className="w-10 h-10 mb-4 opacity-80" />
                <h3 className="text-2xl font-black mb-1">{qrSession.day} {qrSession.slot}반</h3>
                <p className="text-blue-100 font-bold opacity-80">성함을 터치하여 출석을 완료하세요.</p>
              </div>
              <div className="space-y-3">
                {members.map(m => {
                  const isDone = (sessions[`${new Date().toISOString().split('T')[0]}_${qrSession.slot}`]?.presentIds || []).includes(m.id);
                  return (
                    <button key={m.id} onClick={() => {
                      const today = new Date().toISOString().split('T')[0], sId = `${today}_${qrSession.slot}`, curP = sessions[sId]?.presentIds || [];
                      if (curP.includes(m.id)) { showStatus("이미 출석되었습니다.", "success"); return; }
                      updateAttendance(today, qrSession.slot, [...curP, m.id]); showStatus(`${m.name}님 출석 확인!`, "success");
                    }} className={`w-full p-5 rounded-3xl font-black flex justify-between items-center transition-all border-2 active:scale-95 ${isDone ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-inner' : 'bg-slate-50 border-transparent text-slate-700'}`}>
                      <span className="text-lg">{m.name}</span>{isDone ? <CheckCircle className="w-6 h-6 text-blue-600" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300 space-y-6">
              {activeTab === 'attendance' && (
                <div className="space-y-6">
                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-3xl">
                    <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="flex-1 bg-white border-none p-4 rounded-2xl font-black text-sm text-center outline-none shadow-sm" />
                    <div className="flex-1 flex gap-1 p-1 bg-white/50 rounded-2xl">
                      {availableSlots.length > 0 ? availableSlots.map(s => (
                        <button key={s} onClick={() => setCurrentSlot(s)} className={`flex-1 rounded-xl text-xs font-black transition-all ${currentSlot === s ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>{s}</button>
                      )) : <div className="flex-1 flex items-center justify-center text-[10px] font-black text-red-400">일요일 휴무</div>}
                    </div>
                  </div>
                  {availableSlots.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {members.map(m => {
                        const isP = (sessions[`${currentDate}_${currentSlot}`]?.presentIds || []).includes(m.id);
                        return (
                          <button key={m.id} onClick={() => {
                            const curP = sessions[`${currentDate}_${currentSlot}`]?.presentIds || [];
                            updateAttendance(currentDate, currentSlot, isP ? curP.filter(id => id !== m.id) : [...curP, m.id]);
                          }} className={`p-5 rounded-[28px] border-2 flex flex-col items-center gap-3 transition-all active:scale-95 ${isP ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-300'}`}>
                            {isP ? <CheckCircle className="w-8 h-8 text-blue-600" /> : <div className="w-8 h-8 rounded-full border-4 border-slate-200" />}
                            <span className="font-black text-sm">{m.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'report' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-5 rounded-[32px] border border-slate-100">
                    <h3 className="font-black text-slate-900">출석 통계</h3>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white border-none p-2 rounded-xl text-xs font-black outline-none shadow-sm" />
                  </div>
                  <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
                    {['summary', 'individual', 'daily'].map(t => (
                      <button key={t} onClick={() => setReportType(t)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${reportType === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t === 'summary' ? '요약' : t === 'individual' ? '개인' : '일자'}</button>
                    ))}
                  </div>
                  <div className="bg-slate-50 p-6 rounded-[32px] min-h-[300px]">
                    {reportType === 'summary' ? (
                      <div className="space-y-4">
                        {['오전', '오후', '저녁'].map(s => (
                          <div key={s} className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm">
                            <span className="font-black text-slate-500">{s}반</span>
                            <span className="text-xl font-black text-blue-600">{statsData.summary[s]}명</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-300 py-20 font-black">데이터 로드 중...</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'templates' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                    <h4 className="font-black text-blue-900 text-sm mb-4 flex items-center gap-2"><QrCode className="w-4 h-4" /> 배포 주소 등록</h4>
                    <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} placeholder="https://~.vercel.app" className="w-full bg-white border-none p-4 rounded-2xl text-xs font-bold outline-none shadow-inner" />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {DAYS_KR.map(d => SCHEDULE_CONFIG[d].length > 0 && (
                      <div key={d} className="bg-slate-50 p-6 rounded-[40px] border border-slate-100">
                        <h4 className="font-black text-slate-800 mb-5 pl-2 border-l-4 border-blue-600">{d} 수업</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {SCHEDULE_CONFIG[d].map(s => (
                            <button key={s} onClick={() => { setQrSession({ day: d, slot: s }); setViewMode('member'); }} className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-col items-center gap-3 shadow-sm active:scale-95 transition-transform">
                              <span className="font-black text-[10px] text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{s}반</span>
                              <QrCode className="w-10 h-10 text-blue-600" />
                              <span className="font-black text-[10px] text-blue-600 uppercase">Open View</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'management' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input id="newMem" type="text" placeholder="회원 이름" className="flex-1 bg-slate-50 p-5 rounded-3xl border-none font-black text-sm outline-none shadow-inner" onKeyDown={e => { if(e.key==='Enter'){ const n = e.currentTarget.value; if(n){ setMembers(p => [...p, {id:`m${Date.now()}`, name:n}].sort((a,b)=>a.name.localeCompare(b.name))); e.currentTarget.value=""; showStatus("등록됨", "success"); } } }} />
                    <button onClick={() => { const el = document.getElementById('newMem'); if(el.value){ setMembers(p => [...p, {id:`m${Date.now()}`, name:el.value}].sort((a,b)=>a.name.localeCompare(b.name))); el.value=""; showStatus("등록됨", "success"); } }} className="bg-slate-900 text-white px-8 rounded-3xl font-black active:scale-90 transition-transform"><UserPlus className="w-6 h-6"/></button>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-[32px]">
                    {members.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-4 bg-white rounded-2xl mb-2 shadow-sm">
                        <span className="font-black text-slate-700">{m.name}</span>
                        <button onClick={() => setMembers(p => p.filter(i => i.id!==m.id))} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* 하단 탭 내비게이션 (관리자 모드일 때만 표시) */}
        {viewMode === 'admin' && (
          <nav className="absolute bottom-0 w-full bg-white/80 backdrop-blur-lg border-t border-slate-100 flex justify-around items-center px-4 pb-10 pt-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            {[
              { id: 'attendance', icon: CheckCircle, label: '출석' },
              { id: 'management', icon: Users, label: '회원' },
              { id: 'report', icon: BarChart3, label: '통계' },
              { id: 'templates', icon: QrCode, label: 'QR발행' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-16 gap-1.5 transition-all ${isActive ? 'text-blue-600 scale-110' : 'text-slate-300 hover:text-slate-500'}`}>
                  <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : ''}`}><tab.icon className="w-5 h-5" /></div>
                  <span className={`text-[9px] font-black tracking-tighter ${isActive ? 'text-blue-600 opacity-100' : 'opacity-0'}`}>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* 토스트 메시지 */}
        {statusMsg.text && (
          <div className="absolute bottom-28 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none">
            <div className={`px-6 py-4 rounded-3xl shadow-2xl flex items-center justify-center gap-3 text-sm font-black border animate-in slide-in-from-bottom-2 duration-300 ${statusMsg.type === 'error' ? 'bg-white border-red-200 text-red-600' : 'bg-slate-900 text-white border-slate-800'}`}>
              <span>{statusMsg.text}</span>
            </div>
          </div>
        )}

        {/* 가상의 홈 버튼 (데코레이션) */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-800 rounded-full z-[60] opacity-20"></div>
      </div>
    </div>
  );
}
