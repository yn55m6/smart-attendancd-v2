import React, { useState, useEffect, useMemo } from 'react';
import { 
  Camera, FileText, CheckCircle, XCircle, Users, FileBarChart, 
  Trash2, QrCode, Smartphone, LogIn, LogOut, ChevronLeft, 
  ClipboardList, UserPlus, CalendarDays, BarChart3, ChevronRight
} from 'lucide-react';

const TIME_SLOTS = ['오전', '오후', '저녁'];
const DAYS_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const EXCLUDED_WORDS = ['출석', '결석', '지각', '오전', '오후', '저녁', '요일', '명단'];

// 한국 시간(브라우저 로컬 시간) 기준 YYYY-MM-DD 반환 함수
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  const [currentDate, setCurrentDate] = useState(getLocalDateString());
  const [currentSlot, setCurrentSlot] = useState('오전');
  const [inputText, setInputText] = useState("");
  const [viewMode, setViewMode] = useState('admin'); 
  const [qrSession, setQrSession] = useState(null); 
  const [selectedMonth, setSelectedMonth] = useState(getLocalDateString().substring(0, 7));
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

  const addMember = (name) => {
    if (!name.trim()) return null;
    if (members.some(m => m.name === name.trim())) {
      showStatus("이미 등록된 이름입니다.", "error");
      return null;
    }
    const newMember = { id: `m_${Date.now()}`, name: name.trim() };
    setMembers(prev => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name)));
    return newMember;
  };

  const confirmDeleteMember = (memberId, memberName) => {
    const hasRecord = Object.values(sessions).some(session => session.presentIds?.includes(memberId));
    if (hasRecord) { 
      showStatus(`'${memberName}' 회원은 출석 기록이 존재하여 삭제할 수 없습니다.`, "error"); 
      return; 
    }
    setModal({ 
      isOpen: true, type: 'confirm', title: '회원 삭제', text: `'${memberName}'님을 삭제하시겠습니까?`, 
      action: () => {
        setMembers(prev => prev.filter(m => m.id !== memberId));
        showStatus("삭제되었습니다.", "success");
      }
    });
  };

  const resetCurrentSession = () => {
    const sessionId = `${currentDate}_${currentSlot}`;
    if (!sessions[sessionId]?.presentIds?.length) return showStatus("지울 데이터가 없습니다.", "info");
    
    setModal({ 
      isOpen: true, type: 'confirm', title: '출석 초기화', text: '현재 반의 출석을 모두 초기화합니다.', 
      action: () => { updateAttendance(currentDate, currentSlot, []); showStatus("초기화 됨", "success"); }
    });
  };

  const openSelfRegistrationModal = () => {
    setModal({ 
      isOpen: true, type: 'prompt', title: '신규 회원 등록', text: '명단에 없습니다.\n성함을 입력해 주세요.', 
      action: (name) => {
        const newMem = addMember(name);
        if (newMem) {
          const today = getLocalDateString();
          const curP = sessions[`${today}_${qrSession.slot}`]?.presentIds || [];
          updateAttendance(today, qrSession.slot, [...curP, newMem.id]);
          showStatus(`${name}님 환영합니다!`, "success");
        }
      }
    });
  };

  const currentDayName = DAYS_KR[new Date(currentDate).getDay()];
  const availableSlots = SCHEDULE_CONFIG[currentDayName];

  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(currentSlot)) setCurrentSlot(availableSlots[0]);
  }, [currentDate, currentSlot, availableSlots]);

  // 스캔 처리 기능
  const analyzeAndIngest = () => {
    if (!inputText.trim()) {
      showStatus("텍스트를 먼저 입력해주세요.", "error");
      return;
    }
    const found = inputText.match(/[가-힣]{2,4}/g) || [];
    const uniqueFound = Array.from(new Set(found)).filter(n => !EXCLUDED_WORDS.includes(n));
    
    let currentMembers = [...members];
    let matchedIds = [];

    uniqueFound.forEach(name => {
      let member = currentMembers.find(m => m.name === name);
      if (!member) {
        member = { id: `m_${Date.now()}_${Math.random()}`, name };
        currentMembers.push(member);
      }
    });

    setMembers(currentMembers.sort((a, b) => a.name.localeCompare(b.name)));

    const normalizedText = inputText.replace(/\s+/g, '');
    currentMembers.forEach(m => {
      if (normalizedText.includes(m.name)) matchedIds.push(m.id);
    });

    const sessionId = `${currentDate}_${currentSlot}`;
    const existingIds = sessions[sessionId]?.presentIds || [];
    updateAttendance(currentDate, currentSlot, Array.from(new Set([...existingIds, ...matchedIds])));
    
    setInputText(""); 
    showStatus(`${matchedIds.length}명 일괄 스캔 출석 완료!`, "success");
  };

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

  // ==========================================
  // 1. 로그인 전 화면 (모바일 100% 최적화)
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="bg-slate-900 min-h-screen flex justify-center items-center">
        {/* 모바일 100dvh, PC에서는 max-w-md로 제한 */}
        <div className="h-[100dvh] w-full max-w-md mx-auto bg-slate-900 flex flex-col justify-center px-8 relative shadow-2xl sm:border-x border-slate-800">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-1 text-center tracking-tighter">회원 출석 시스템</h1>
            <p className="text-slate-400 text-sm mb-10 text-center font-bold uppercase tracking-widest">Admin Login</p>
            <form onSubmit={handleLogin} className="space-y-5">
              <input 
                type="text" 
                value={inputClassId} 
                onChange={(e) => setInputClassId(e.target.value)} 
                placeholder="명부 이름 (예: class-1)" 
                className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:border-blue-500 focus:bg-white font-black text-center text-lg transition-all" 
                autoFocus 
              />
              <button 
                type="submit" 
                className="w-full bg-blue-600 active:scale-95 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-600/20 transition-transform flex items-center justify-center gap-3 text-lg"
              >
                <LogIn className="w-6 h-6" /> 접속하기
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. 메인 앱 화면 (모바일 100% 최적화)
  // ==========================================
  return (
    <div className="bg-slate-200 min-h-screen flex justify-center items-center font-sans">
      {/* h-[100dvh]: 모바일 브라우저 주소창 이슈를 해결하는 동적 뷰포트 높이
        w-full max-w-md mx-auto: 모바일에서는 꽉 차게, PC에서는 폰 사이즈로 가운데 정렬
      */}
      <div className="h-[100dvh] w-full max-w-md mx-auto bg-slate-50 flex flex-col relative sm:shadow-2xl overflow-hidden sm:border-x border-slate-200">
        
        {/* 모달 */}
        {modal.isOpen && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
            <div className="bg-white rounded-[28px] p-6 w-full shadow-2xl transform transition-all">
              <h3 className="text-lg font-black mb-2 text-slate-800">{modal.title}</h3>
              <p className="text-slate-500 mb-6 font-medium text-sm whitespace-pre-wrap">{modal.text}</p>
              {modal.type === 'prompt' && (
                <input type="text" value={promptVal} onChange={e => setPromptVal(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-6 outline-none font-bold focus:border-blue-500" placeholder="이름 입력" autoFocus />
              )}
              <div className="flex gap-3">
                <button onClick={() => { setModal({ isOpen: false }); setPromptVal(""); }} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-black rounded-xl active:bg-slate-200">취소</button>
                <button onClick={() => { modal.action(promptVal); setModal({ isOpen: false }); setPromptVal(""); }} className={`flex-1 py-3.5 text-white font-black rounded-xl shadow-md ${modal.type === 'confirm' ? 'bg-red-600 active:bg-red-700' : 'bg-blue-600 active:bg-blue-700'}`}>확인</button>
              </div>
            </div>
          </div>
        )}

        {/* 토스트 메시지 */}
        {statusMsg.text && (
          <div className="absolute top-20 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none">
            <div className={`px-6 py-3.5 rounded-full shadow-2xl flex items-center justify-center gap-3 text-sm font-black border animate-in slide-in-from-top-2 duration-300 ${statusMsg.type === 'error' ? 'bg-white border-red-200 text-red-600' : 'bg-slate-900 text-white border-slate-800'}`}>
              <span>{statusMsg.text}</span>
            </div>
          </div>
        )}

        {/* 상단 헤더 (고정) */}
        <header className="bg-white pt-6 pb-4 px-6 flex justify-between items-center border-b border-slate-100 shrink-0 z-10 shadow-sm">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">{viewMode === 'member' ? '회원 출석' : '관리자'}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{classId}</p>
            </div>
          </div>
          {viewMode === 'member' ? (
            <button onClick={() => setViewMode('admin')} className="p-3 bg-slate-100 text-slate-600 rounded-2xl active:scale-90 transition-transform"><ChevronLeft className="w-5 h-5" /></button>
          ) : (
            <button onClick={() => { setClassId(""); setIsLoggedIn(false); }} className="p-3 bg-slate-100 text-slate-400 rounded-2xl active:scale-90 transition-transform"><LogOut className="w-5 h-5" /></button>
          )}
        </header>

        {/* 메인 스크롤 콘텐츠 영역 (flex-1로 남은 공간 모두 차지, 하단 탭 여백만큼 pb-24 부여) */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 pb-28 relative">
          {viewMode === 'member' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl shadow-blue-600/20 mb-8">
                <Smartphone className="w-10 h-10 mb-4 opacity-80" />
                <h3 className="text-2xl font-black mb-1">{qrSession.day} {qrSession.slot}반</h3>
                <p className="text-blue-100 font-bold opacity-80">성함을 터치하여 출석을 완료하세요.</p>
              </div>
              <div className="space-y-3">
                {members.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 font-bold">명단이 없습니다.</p>
                ) : (
                  members.map(m => {
                    const isDone = (sessions[`${getLocalDateString()}_${qrSession.slot}`]?.presentIds || []).includes(m.id);
                    return (
                      <button key={m.id} onClick={() => {
                        const today = getLocalDateString(), sId = `${today}_${qrSession.slot}`, curP = sessions[sId]?.presentIds || [];
                        if (curP.includes(m.id)) { showStatus("이미 출석되었습니다.", "success"); return; }
                        updateAttendance(today, qrSession.slot, [...curP, m.id]); showStatus(`${m.name}님 출석 확인!`, "success");
                      }} className={`w-full p-4.5 rounded-[20px] font-black flex justify-between items-center transition-all border-2 active:scale-[0.98] ${isDone ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="text-lg">{m.name}</span>{isDone ? <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-sm">출석완료</span> : <ChevronRight className="w-5 h-5 text-slate-300" />}
                      </button>
                    );
                  })
                )}
                <button onClick={openSelfRegistrationModal} className="w-full mt-4 py-4.5 bg-slate-200 text-slate-700 rounded-[20px] font-black flex items-center justify-center gap-2 active:bg-slate-300">
                  <UserPlus className="w-5 h-5" /> 명단에 없으신가요?
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300 space-y-6">
              {activeTab === 'attendance' && (
                <div className="space-y-6">
                  {/* 날짜 선택 */}
                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-3xl">
                    <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="flex-1 bg-white border-none p-4 rounded-2xl font-black text-sm text-center outline-none shadow-sm" />
                    <div className="flex-1 flex gap-1 p-1 bg-white/50 rounded-2xl">
                      {availableSlots.length > 0 ? availableSlots.map(s => (
                        <button key={s} onClick={() => setCurrentSlot(s)} className={`flex-1 rounded-xl text-xs font-black transition-all ${currentSlot === s ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>{s}</button>
                      )) : <div className="flex-1 flex items-center justify-center text-[10px] font-black text-red-400">일요일 휴무</div>}
                    </div>
                  </div>
                  
                  {availableSlots.length > 0 && (
                    <>
                      {/* 수동 출석 영역 */}
                      <div className="grid grid-cols-2 gap-3">
                        {members.map(m => {
                          const isP = (sessions[`${currentDate}_${currentSlot}`]?.presentIds || []).includes(m.id);
                          return (
                            <button key={m.id} onClick={() => {
                              const curP = sessions[`${currentDate}_${currentSlot}`]?.presentIds || [];
                              updateAttendance(currentDate, currentSlot, isP ? curP.filter(id => id !== m.id) : [...curP, m.id]);
                            }} className={`p-5 rounded-[28px] border-2 flex flex-col items-center gap-3 transition-all active:scale-95 ${isP ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : 'border-slate-100 bg-white text-slate-400 shadow-sm'}`}>
                              {isP ? <CheckCircle className="w-8 h-8 text-blue-600" /> : <div className="w-8 h-8 rounded-full border-4 border-slate-100" />}
                              <span className="font-black text-sm">{m.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* 텍스트/카톡 스캔 영역 */}
                      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mt-6">
                        <h3 className="font-black mb-4 flex items-center gap-2 text-sm text-slate-800">
                          <Camera className="w-5 h-5 text-blue-500"/> 카톡/텍스트 일괄 스캔
                        </h3>
                        <textarea 
                          value={inputText} 
                          onChange={(e) => setInputText(e.target.value)} 
                          placeholder="명단을 복사해서 여기에 붙여넣으세요. 이름만 쏙 뽑아서 일괄 출석 처리됩니다." 
                          className="w-full h-28 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none mb-4 resize-none focus:border-blue-300 transition-colors shadow-inner" 
                        />
                        <button 
                          onClick={analyzeAndIngest} 
                          className="w-full py-4 bg-slate-900 active:bg-black text-white font-black rounded-2xl active:scale-95 transition-transform shadow-md flex items-center justify-center gap-2"
                        >
                          <Camera className="w-4 h-4"/> 텍스트 스캔 및 일괄 적용
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'report' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-900">출석 통계</h3>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-50 border-none p-2 rounded-xl text-xs font-black outline-none shadow-inner" />
                  </div>
                  <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
                    {['summary', 'individual', 'daily'].map(t => (
                      <button key={t} onClick={() => setReportType(t)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${reportType === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t === 'summary' ? '요약' : t === 'individual' ? '개인' : '일자'}</button>
                    ))}
                  </div>
                  <div className="min-h-[300px]">
                    {reportType === 'summary' ? (
                      <div className="space-y-4">
                        {['오전', '오후', '저녁'].map(s => (
                          <div key={s} className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-slate-50">
                            <span className="font-black text-slate-500">{s}반</span>
                            <span className="text-2xl font-black text-blue-600">{statsData.summary[s]}명</span>
                          </div>
                        ))}
                      </div>
                    ) : reportType === 'individual' ? (
                      <div className="overflow-x-auto rounded-[24px] shadow-sm bg-white border border-slate-50">
                        <table className="w-full text-left text-xs whitespace-nowrap min-w-max bg-white overflow-hidden">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="py-4 px-5 font-black text-slate-600">이름</th>
                              <th className="py-4 text-center text-slate-400 font-bold">오전</th>
                              <th className="py-4 text-center text-slate-400 font-bold">오후</th>
                              <th className="py-4 text-center text-slate-400 font-bold">저녁</th>
                              <th className="py-4 px-5 text-right text-blue-600 font-black">총합</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {statsData.individual.map(i => (
                              <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-4 px-5 font-black text-slate-800">{i.name}</td>
                                <td className="py-4 text-center font-medium text-slate-500">{i.오전}</td>
                                <td className="py-4 text-center font-medium text-slate-500">{i.오후}</td>
                                <td className="py-4 text-center font-medium text-slate-500">{i.저녁}</td>
                                <td className="py-4 px-5 text-right text-blue-600 font-black text-sm">{i.total}</td>
                              </tr>
                            ))}
                            {statsData.individual.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-slate-400 font-bold">데이터 없음</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {statsData.daily.length === 0 ? (
                          <p className="text-center py-10 text-slate-400 font-bold">출석 기록이 없습니다.</p>
                        ) : (
                          statsData.daily.map((dayData, idx) => (
                            <div key={idx} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-50">
                              <h5 className="font-black text-slate-800 mb-4 text-sm border-b border-slate-100 pb-3">{dayData.date}</h5>
                              <div className="space-y-3">
                                {['오전', '오후', '저녁'].map(slot => {
                                  const names = dayData.slots[slot];
                                  if (!names || names.length === 0) return null;
                                  return (
                                    <div key={slot} className="flex gap-4 text-sm items-start">
                                      <span className="font-black text-blue-500 shrink-0 w-8 pt-1">{slot}</span>
                                      <div className="flex flex-wrap gap-2">
                                        {names.map((n, i) => (
                                          <span key={i} className="bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg font-bold text-slate-600 text-[11px]">{n}</span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'templates' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                    <h4 className="font-black text-blue-900 text-sm mb-4 flex items-center gap-2"><QrCode className="w-4 h-4" /> 배포 주소 등록</h4>
                    <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} placeholder="https://~.vercel.app" className="w-full bg-white border-none p-4 rounded-2xl text-xs font-bold outline-none shadow-inner text-blue-800" />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {DAYS_KR.map(d => SCHEDULE_CONFIG[d].length > 0 && (
                      <div key={d} className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm">
                        <h4 className="font-black text-slate-800 mb-5 pl-3 border-l-4 border-blue-600">{d} 수업</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {SCHEDULE_CONFIG[d].map(s => (
                            <button key={s} onClick={() => { setQrSession({ day: d, slot: s }); setViewMode('member'); }} className="bg-slate-50 p-5 rounded-[28px] border border-slate-100 flex flex-col items-center gap-3 shadow-sm active:scale-95 transition-transform hover:bg-slate-100">
                              <span className="font-black text-[10px] text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm">{s}반</span>
                              <QrCode className="w-10 h-10 text-blue-600 my-1" />
                              <span className="font-black text-[10px] text-blue-600 uppercase bg-blue-50 px-3 py-1.5 rounded-xl">미리보기</span>
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
                    <input id="newMem" type="text" placeholder="회원 이름" className="flex-1 bg-white p-5 rounded-3xl border border-slate-100 font-black text-sm outline-none shadow-sm focus:border-blue-400 transition-colors" onKeyDown={e => { if(e.key==='Enter'){ const n = e.currentTarget.value; if(n){ setMembers(p => [...p, {id:`m${Date.now()}`, name:n}].sort((a,b)=>a.name.localeCompare(b.name))); e.currentTarget.value=""; showStatus("등록됨", "success"); } } }} />
                    <button onClick={() => { const el = document.getElementById('newMem'); if(el.value){ setMembers(p => [...p, {id:`m${Date.now()}`, name:el.value}].sort((a,b)=>a.name.localeCompare(b.name))); el.value=""; showStatus("등록됨", "success"); } }} className="bg-slate-900 text-white px-8 rounded-3xl font-black active:scale-90 transition-transform shadow-md"><UserPlus className="w-6 h-6"/></button>
                  </div>
                  <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm">
                    {members.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl mb-2 last:mb-0">
                        <span className="font-black text-slate-700 pl-2">{m.name}</span>
                        <button onClick={() => setMembers(p => p.filter(i => i.id!==m.id))} className="p-2 bg-white text-slate-300 hover:text-red-500 rounded-xl transition-colors shadow-sm"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    {members.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">회원이 없습니다.</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* 하단 탭 내비게이션 (절대 위치, 폰 영역 하단에 고정) */}
        {viewMode === 'admin' && (
          <nav className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center px-4 pb-8 sm:pb-6 pt-3 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            {[
              { id: 'attendance', icon: CheckCircle, label: '출석' },
              { id: 'management', icon: Users, label: '회원' },
              { id: 'report', icon: BarChart3, label: '통계' },
              { id: 'templates', icon: QrCode, label: 'QR발행' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-16 gap-1.5 transition-all ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
                  <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : ''}`}><tab.icon className="w-5 h-5" /></div>
                  <span className={`text-[9px] font-black tracking-tighter ${isActive ? 'text-blue-600 opacity-100' : 'opacity-0'}`}>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
