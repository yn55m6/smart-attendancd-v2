import React, { useState, useEffect, useMemo } from 'react';
import { 
  Camera, FileText, CheckCircle, XCircle, Users, FileBarChart, 
  Trash2, QrCode, Smartphone, LogIn, LogOut, ChevronRight, 
  ClipboardList, UserPlus, CalendarDays, BarChart3
} from 'lucide-react';

const TIME_SLOTS = ['오전', '오후', '저녁'];
const DAYS_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const EXCLUDED_WORDS = ['출석', '결석', '지각', '오전', '오후', '저녁', '요일', '명단'];

// 요일별 운영 차수 설정 (일요일 휴무, 토요일 오후반만)
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
  
  // 통계용 상태
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [reportType, setReportType] = useState('summary'); 

  // QR 배포 URL 상태
  const [customBaseUrl, setCustomBaseUrl] = useState(() => localStorage.getItem('attendance_base_url') || "");

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', text: '', action: null });
  const [promptVal, setPromptVal] = useState("");

  const showStatus = (text, type = "info") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: "", type: "" }), 3000);
  };

  // URL 파라미터 체크 (QR 코드로 접속 시 자동 회원 화면 이동)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'member') {
      const day = params.get('day');
      const slot = params.get('slot');
      const targetClass = params.get('classId');
      if (day && slot && targetClass) {
        setViewMode('member');
        setClassId(targetClass);
        setQrSession({ day, slot });
        setIsLoggedIn(true);
        
        // 로컬 스토리지에서 데이터 불러오기
        const savedMembers = localStorage.getItem(`members_${targetClass}`);
        const savedSessions = localStorage.getItem(`sessions_${targetClass}`);
        if (savedMembers) setMembers(JSON.parse(savedMembers));
        if (savedSessions) setSessions(JSON.parse(savedSessions));
      }
    }
  }, []); 

  useEffect(() => {
    localStorage.setItem('attendance_base_url', customBaseUrl);
  }, [customBaseUrl]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!inputClassId.trim()) return;
    const cid = inputClassId.trim();
    setClassId(cid);
    setIsLoggedIn(true);
    
    const savedMembers = localStorage.getItem(`members_${cid}`);
    const savedSessions = localStorage.getItem(`sessions_${cid}`);
    if (savedMembers) setMembers(JSON.parse(savedMembers));
    if (savedSessions) setSessions(JSON.parse(savedSessions));
  };

  useEffect(() => {
    if (!isLoggedIn || !classId) return;
    localStorage.setItem(`members_${classId}`, JSON.stringify(members));
    localStorage.setItem(`sessions_${classId}`, JSON.stringify(sessions));
  }, [members, sessions, isLoggedIn, classId]);

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

  const updateAttendance = (date, slot, presentIds) => {
    const sessionId = `${date}_${slot}`;
    setSessions(prev => ({
      ...prev,
      [sessionId]: { id: sessionId, date, slot, presentIds }
    }));
  };

  const resetCurrentSession = () => {
    const sessionId = `${currentDate}_${currentSlot}`;
    if (!sessions[sessionId]?.presentIds?.length) return showStatus("지울 데이터가 없습니다.", "info");
    
    setModal({ 
      isOpen: true, type: 'confirm', title: '출석 초기화', text: '현재 반의 출석을 모두 초기화합니다.', 
      action: () => { updateAttendance(currentDate, currentSlot, []); showStatus("초기화 됨", "success"); }
    });
  };

  const analyzeAndIngest = () => {
    if (!inputText.trim()) return;
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
    showStatus(`${matchedIds.length}명 일괄 출석 완료!`, "success");
  };

  const handleSelfCheckIn = (mId, mName) => {
    const today = new Date().toISOString().split('T')[0];
    const sessionId = `${today}_${qrSession.slot}`;
    const currentP = sessions[sessionId]?.presentIds || [];
    
    if (currentP.includes(mId)) {
        setModal({ 
          isOpen: true, type: 'confirm', title: '출석 취소', text: '이미 출석하셨습니다. 취소할까요?', 
          action: () => { updateAttendance(today, qrSession.slot, currentP.filter(id => id !== mId)); showStatus("출석 취소됨", "info"); }
        }); 
        return;
    }
    updateAttendance(today, qrSession.slot, [...currentP, mId]);
    showStatus(`${mName}님 출석 확인!`, "success");
  };

  const openSelfRegistrationModal = () => {
    setModal({ 
      isOpen: true, type: 'prompt', title: '신규 회원 등록', text: '명단에 없습니다.\n성함을 입력해 주세요.', 
      action: (name) => {
        const newMem = addMember(name);
        if (newMem) {
          const today = new Date().toISOString().split('T')[0];
          const curP = sessions[`${today}_${qrSession.slot}`]?.presentIds || [];
          updateAttendance(today, qrSession.slot, [...curP, newMem.id]);
          showStatus(`${name}님 환영합니다!`, "success");
        }
      }
    });
  };

  // QR 코드 URL 생성 함수
  const getQRUrl = (day, slot) => {
    let base = customBaseUrl.trim() || (window.location.origin + window.location.pathname);
    if (base.endsWith('/')) base = base.slice(0, -1);
    const url = `${base}?mode=member&classId=${encodeURIComponent(classId)}&day=${encodeURIComponent(day)}&slot=${encodeURIComponent(slot)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
  };

  // 선택된 날짜의 요일에 따른 사용 가능한 차수 계산
  const currentDayName = DAYS_KR[new Date(currentDate).getDay()];
  const availableSlots = SCHEDULE_CONFIG[currentDayName];

  // 날짜 변경 시, 해당 요일에 없는 차수면 자동으로 변경
  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(currentSlot)) {
      setCurrentSlot(availableSlots[0]);
    }
  }, [currentDate, currentSlot, availableSlots]);

  // --- 통계 데이터 계산 ---
  const statsData = useMemo(() => {
    const monthlySessions = Object.values(sessions).filter(s => s.date.startsWith(selectedMonth));
    
    // 1. 개인별 통계
    const individual = members.map(m => {
      const attended = monthlySessions.filter(s => (s.presentIds || []).includes(m.id));
      return { 
        ...m, 
        total: attended.length,
        오전: attended.filter(s => s.slot === '오전').length,
        오후: attended.filter(s => s.slot === '오후').length,
        저녁: attended.filter(s => s.slot === '저녁').length,
      };
    }).sort((a, b) => b.total - a.total);

    // 2. 월별 차수별 요약 (총 출석 연인원)
    const summary = { 오전: 0, 오후: 0, 저녁: 0, 총합: 0 };
    
    // 3. 일자별/차수별 상세 명단
    const daily = {};

    monthlySessions.forEach(s => {
      const count = (s.presentIds || []).length;
      if(count > 0) {
        summary[s.slot] += count;
        summary.총합 += count;
        
        if (!daily[s.date]) daily[s.date] = { 오전: [], 오후: [], 저녁: [] };
        const presentNames = (s.presentIds || []).map(id => members.find(m => m.id === id)?.name).filter(Boolean);
        daily[s.date][s.slot] = presentNames;
      }
    });

    const dailyArray = Object.entries(daily)
      .map(([date, slots]) => ({ date, slots }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return { individual, summary, daily: dailyArray };
  }, [sessions, members, selectedMonth]);


  // ---- 로그인 전 화면 ----
  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-slate-200 flex justify-center items-center sm:p-4">
        {/* 모바일 화면을 PC에서도 고정시키는 가상의 스마트폰 프레임 */}
        <div className="w-full h-full sm:w-[390px] sm:h-[844px] sm:max-h-[90vh] bg-slate-900 relative sm:rounded-[40px] sm:shadow-2xl overflow-hidden sm:border-[8px] border-slate-800 flex flex-col justify-center px-6">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl w-full">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-1 text-center tracking-tight">출석 관리 시스템</h1>
            <p className="text-slate-500 text-sm mb-8 text-center font-medium">관리자 전용 로그인</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="text" value={inputClassId} onChange={(e) => setInputClassId(e.target.value)} 
                placeholder="명부 이름 입력 (예: class-1)" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:bg-white font-bold text-center transition-all" autoFocus 
              />
              <button type="submit" className="w-full bg-blue-600 active:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2">
                <LogIn className="w-5 h-5" /> 접속하기
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---- 메인 화면 (모바일 프레임 레이아웃) ----
  return (
    <div className="fixed inset-0 bg-slate-200 flex justify-center items-center sm:p-4">
      {/* 모바일 화면을 PC에서도 고정시키는 가상의 스마트폰 프레임 */}
      <div className="w-full h-full sm:w-[390px] sm:h-[844px] sm:max-h-[90vh] bg-slate-50 text-slate-900 relative sm:rounded-[40px] sm:shadow-2xl overflow-hidden sm:border-[8px] border-slate-800 flex flex-col font-sans">
        
        {/* 모달 (전체화면 고정이 아닌 스마트폰 프레임 내부에 고정) */}
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

        {/* 토스트 (스마트폰 프레임 상단에 고정) */}
        {statusMsg.text && (
          <div className="absolute top-6 left-0 right-0 z-[100] flex justify-center px-4 animate-in fade-in slide-in-from-top-4">
            <div className={`px-5 py-3.5 rounded-full shadow-lg flex items-center justify-center gap-2 text-sm font-black border ${statusMsg.type === 'error' ? 'bg-white border-red-200 text-red-600' : 'bg-slate-800 text-white border-slate-700'}`}>
              <span>{statusMsg.text}</span>
            </div>
          </div>
        )}

        {/* 회원 전용 스마트폰 뷰 (QR로 접속 시 보이는 화면) */}
        {viewMode === 'member' ? (
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
            <header className="bg-blue-600 text-white pt-12 pb-6 px-6 rounded-b-[32px] shadow-md relative shrink-0">
              <button onClick={() => setViewMode('admin')} className="absolute top-6 right-6 p-2 bg-white/20 rounded-full">
                <LogOut className="w-5 h-5" />
              </button>
              <Smartphone className="w-10 h-10 mb-3 opacity-90" />
              <h1 className="text-2xl font-black">{qrSession.day} {qrSession.slot}반</h1>
              <p className="text-blue-200 text-sm mt-1 font-medium">본인 이름을 터치하여 출석하세요</p>
            </header>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3 pb-safe">
              {members.length === 0 ? (
                <p className="text-center text-slate-400 py-10 font-bold">명단이 없습니다.</p>
              ) : (
                members.map(m => {
                  const isDone = (sessions[`${new Date().toISOString().split('T')[0]}_${qrSession.slot}`]?.presentIds || []).includes(m.id);
                  return (
                    <button key={m.id} onClick={() => handleSelfCheckIn(m.id, m.name)} className={`w-full p-4.5 rounded-[20px] font-black flex justify-between items-center transition-all border-2 active:scale-[0.98] ${isDone ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-white border-slate-200 text-slate-700'}`}>
                      <span className="text-lg">{m.name}</span>
                      {isDone ? <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-sm">출석완료</span> : <ChevronRight className="w-5 h-5 text-slate-300" />}
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
          /* 관리자 앱 뷰 */
          <>
            {/* 상단 앱 헤더 */}
            <header className="bg-white pt-6 pb-3 px-5 flex justify-between items-center shrink-0 shadow-sm z-10 relative">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">출석 관리자</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <p className="text-[11px] font-black text-slate-400 uppercase">{classId}</p>
                </div>
              </div>
              <button onClick={() => { setClassId(""); setIsLoggedIn(false); }} className="p-2.5 bg-slate-100 text-slate-500 rounded-full active:bg-slate-200">
                <LogOut className="w-5 h-5" />
              </button>
            </header>

            {/* 메인 스크롤 영역 (하단 탭 공간 확보를 위해 pb-24 적용) */}
            <main className="flex-1 overflow-y-auto bg-slate-50 p-5 pb-24 relative">
              
              {/* 1. 출석 탭 */}
              {activeTab === 'attendance' && (
                <div className="space-y-5 animate-in fade-in">
                  {/* 날짜/시간 선택 */}
                  <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-2">
                    <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="w-1/2 bg-slate-50 border-none p-3 rounded-xl font-black text-sm text-center outline-none" />
                    <div className="w-1/2 flex bg-slate-50 p-1 rounded-xl">
                      {availableSlots.length > 0 ? (
                        availableSlots.map(slot => (
                          <button key={slot} onClick={() => setCurrentSlot(slot)} className={`flex-1 rounded-lg text-xs font-black transition-all ${currentSlot === slot ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-400'}`}>
                            {slot}
                          </button>
                        ))
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-xs font-black text-red-400 bg-red-50 rounded-lg">휴일</div>
                      )}
                    </div>
                  </div>

                  {availableSlots.length === 0 ? (
                    <div className="bg-white p-10 rounded-[24px] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                      <CalendarDays className="w-12 h-12 text-slate-300 mb-3" />
                      <h3 className="font-black text-slate-500">일요일은 휴무입니다</h3>
                      <p className="text-sm text-slate-400 mt-1">출석을 관리하지 않는 요일입니다.</p>
                    </div>
                  ) : (
                    <>
                      {/* 출석 현황 */}
                      <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-5">
                          <h3 className="font-black text-base flex items-center gap-2"><CheckCircle className="w-5 h-5 text-blue-500"/> 출석 명단</h3>
                          <button onClick={resetCurrentSession} className="text-[11px] text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-bold">초기화</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          {members.map(m => {
                            const isP = (sessions[`${currentDate}_${currentSlot}`]?.presentIds || []).includes(m.id);
                            return (
                              <button key={m.id} onClick={() => {
                                const curP = sessions[`${currentDate}_${currentSlot}`]?.presentIds || [];
                                updateAttendance(currentDate, currentSlot, isP ? curP.filter(id => id !== m.id) : [...curP, m.id]);
                              }} className={`p-3.5 rounded-[16px] border-2 flex items-center gap-2.5 active:scale-95 transition-all text-left ${isP ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-100 bg-white text-slate-400'}`}>
                                {isP ? <CheckCircle className="w-5 h-5 text-blue-600 shrink-0"/> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0"/>} 
                                <span className="font-black text-sm truncate">{m.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 텍스트 스캔 */}
                      <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                        <h3 className="font-black mb-3 flex items-center gap-2 text-sm"><Camera className="w-4 h-4 text-blue-500"/> 카톡 스캔</h3>
                        <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="명단 복사/붙여넣기" className="w-full h-24 bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium outline-none mb-3 resize-none focus:border-blue-300" />
                        <button onClick={analyzeAndIngest} className="w-full py-3.5 bg-slate-900 text-white font-black rounded-xl active:bg-black">스캔 적용하기</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 2. 명단 관리 탭 */}
              {activeTab === 'management' && (
                <div className="animate-in fade-in space-y-4">
                  <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                    <h3 className="font-black text-base mb-4">회원 추가</h3>
                    <div className="flex gap-2">
                      <input id="newMemInput" type="text" placeholder="이름 입력" className="flex-1 bg-slate-50 border border-slate-100 py-3.5 px-4 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
                      <button onClick={() => { const el = document.getElementById('newMemInput'); if(addMember(el.value)){ showStatus("추가됨", "success"); el.value="";} }} className="bg-blue-600 text-white px-5 rounded-xl font-black text-sm shrink-0"><UserPlus className="w-5 h-5"/></button>
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-[24px] shadow-sm border border-slate-100">
                    {members.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-4 border-b border-slate-50 last:border-0">
                        <span className="font-black text-slate-800">{m.name}</span>
                        <button onClick={() => confirmDeleteMember(m.id, m.name)} className="p-2 text-slate-300 active:text-red-500"><Trash2 className="w-5 h-5"/></button>
                      </div>
                    ))}
                    {members.length === 0 && <p className="text-center py-8 text-slate-400 font-bold text-sm">명단이 비어있습니다.</p>}
                  </div>
                </div>
              )}

              {/* 3. 통계 탭 */}
              {activeTab === 'report' && (
                <div className="animate-in fade-in space-y-4 h-full flex flex-col">
                  {/* 월 선택 및 리포트 타입 탭 */}
                  <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 space-y-4 shrink-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-black flex items-center gap-2"><CalendarDays className="w-5 h-5 text-blue-600"/> 기간 선택</h3>
                      <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-50 border-none p-2 rounded-lg text-sm font-black outline-none" />
                    </div>
                    
                    {/* 세부 탭 */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setReportType('summary')} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${reportType === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>요약</button>
                      <button onClick={() => setReportType('individual')} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${reportType === 'individual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>개인별</button>
                      <button onClick={() => setReportType('daily')} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${reportType === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>일자별</button>
                    </div>
                  </div>

                  {/* 리포트 내용 영역 */}
                  <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 flex-1 p-4">
                    {/* A. 월별 차수 요약 */}
                    {reportType === 'summary' && (
                      <div className="space-y-4 animate-in fade-in">
                        <h4 className="font-black text-slate-800 border-b pb-2 mb-4 text-sm"><BarChart3 className="inline w-4 h-4 mr-1 text-blue-500"/> 월간 차수별 총 출석 인원</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {['오전', '오후', '저녁'].map(slot => (
                            <div key={slot} className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
                              <p className="text-xs font-black text-slate-500 mb-1">{slot}</p>
                              <p className="text-xl font-black text-blue-600">{statsData.summary[slot]}<span className="text-xs text-slate-400 ml-0.5">명</span></p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-blue-600 text-white p-4 rounded-2xl flex justify-between items-center mt-2 shadow-md">
                          <span className="font-black text-sm">월간 누적 총합</span>
                          <span className="text-2xl font-black">{statsData.summary.총합}명</span>
                        </div>
                      </div>
                    )}

                    {/* B. 개인별 통계 */}
                    {reportType === 'individual' && (
                      <div className="animate-in fade-in">
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="w-full text-left text-xs whitespace-nowrap min-w-max">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="py-3 px-3 font-black text-slate-600">이름</th>
                                <th className="py-3 text-center text-slate-400">오전</th>
                                <th className="py-3 text-center text-slate-400">오후</th>
                                <th className="py-3 text-center text-slate-400">저녁</th>
                                <th className="py-3 px-3 text-right text-blue-600 font-black">총합</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {statsData.individual.map(i => (
                                <tr key={i.id}>
                                  <td className="py-3 px-3 font-black text-slate-800">{i.name}</td>
                                  <td className="py-3 text-center font-medium text-slate-400">{i.오전}</td>
                                  <td className="py-3 text-center font-medium text-slate-400">{i.오후}</td>
                                  <td className="py-3 text-center font-medium text-slate-400">{i.저녁}</td>
                                  <td className="py-3 px-3 text-right text-blue-600 font-black">{i.total}</td>
                                </tr>
                              ))}
                              {statsData.individual.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-slate-400">데이터 없음</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* C. 일자별 상세 명단 */}
                    {reportType === 'daily' && (
                      <div className="space-y-4 animate-in fade-in">
                        {statsData.daily.length === 0 ? (
                          <p className="text-center py-6 text-slate-400 font-bold text-sm">출석 기록이 없습니다.</p>
                        ) : (
                          statsData.daily.map((dayData, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                              <h5 className="font-black text-slate-800 mb-3 text-sm">{dayData.date}</h5>
                              <div className="space-y-3">
                                {['오전', '오후', '저녁'].map(slot => {
                                  const names = dayData.slots[slot];
                                  if (!names || names.length === 0) return null;
                                  return (
                                    <div key={slot} className="flex gap-3 text-sm">
                                      <span className="font-black text-blue-600 shrink-0 w-8">{slot}</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {names.map((n, i) => (
                                          <span key={i} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-600 text-xs">{n}</span>
                                        ))}
                                        <span className="text-xs text-slate-400 self-center ml-1">({names.length}명)</span>
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

              {/* 4. 회원/QR 탭 (QR코드 발행 기능) */}
              {activeTab === 'templates' && (
                <div className="animate-in fade-in space-y-4">
                  {/* 배포 URL 설정 영역 */}
                  <div className="bg-blue-50 p-5 rounded-[24px] border border-blue-100 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-600 p-2.5 rounded-full text-white shrink-0"><QrCode className="w-5 h-5"/></div>
                      <div>
                        <h3 className="font-black text-blue-900 text-base mb-0.5">배포 URL 설정</h3>
                        <p className="text-blue-700 text-xs font-medium">현재 사용 중인 배포 주소를 입력해야 스캔 시 스마트폰으로 정상 연결됩니다.</p>
                      </div>
                    </div>
                    <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} placeholder="https://...vercel.app" className="w-full bg-white border border-blue-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-colors" />
                  </div>

                  {/* 요일별 차수별 QR코드 생성 격자 (토요일 오후만, 일요일 제외) */}
                  <div className="grid grid-cols-1 gap-4">
                    {['월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map(day => (
                      <div key={day} className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm">
                        <h4 className="font-black text-base mb-4 border-l-4 border-blue-600 pl-3 text-slate-800">{day} 수업</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {SCHEDULE_CONFIG[day].map(slot => (
                            <div key={slot} className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 p-4 rounded-[20px] transition-all hover:bg-slate-100">
                              <span className="font-black text-sm text-slate-600 mb-3 bg-white px-3 py-1 rounded-full shadow-sm">{slot}반</span>
                              
                              {/* QR 코드 이미지 (URL 자동 파싱) */}
                              <img src={getQRUrl(day, slot)} alt={`${day} ${slot} QR`} className="w-24 h-24 mb-3 rounded-xl bg-white p-2 shadow-sm" />
                              
                              <button onClick={() => { setQrSession({ day, slot }); setViewMode('member'); window.scrollTo(0,0); }} className="w-full text-xs bg-slate-900 hover:bg-black text-white px-3 py-2.5 rounded-xl font-black transition-colors flex items-center justify-center gap-1.5">
                                <Smartphone className="w-4 h-4"/> 미리보기
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </main>

            {/* 하단 네비게이션 바 (모바일 프레임 하단에 고정) */}
            <nav className="absolute bottom-0 w-full bg-white border-t border-slate-100 flex justify-around items-center px-2 pb-6 pt-3 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50">
              {[
                { id: 'attendance', icon: CheckCircle, label: '출석' },
                { id: 'management', icon: Users, label: '명단' },
                { id: 'report', icon: BarChart3, label: '통계' },
                { id: 'templates', icon: QrCode, label: 'QR발행' }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-16 gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                      <tab.icon className={`w-6 h-6 ${isActive ? 'fill-blue-100' : ''}`} />
                    </div>
                    <span className={`text-[10px] font-black ${isActive ? 'text-blue-700' : ''}`}>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
