'use client';
import { useState, useEffect } from 'react';
import { checkWinningTickets } from './actions';
import { Wallet, Plus, Trash2, CheckCircle2, BellRing } from 'lucide-react';

export default function WalletPage() {
  const [tickets, setTickets] = useState([]);
  const [newTicket, setNewTicket] = useState('');
  const [game, setGame] = useState('645');
  const [latestDraws, setLatestDraws] = useState(null);
  const [notificationSent, setNotificationSent] = useState(false);

  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem('vietlott_wallet');
    if (saved) {
      setTickets(JSON.parse(saved));
    }

    // Fetch latest draws for auto-checking
    checkWinningTickets().then(data => {
      setLatestDraws(data);
    });
    
    // Request Notification permission
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // Save to local storage whenever tickets change
  useEffect(() => {
    if (tickets.length > 0) {
      localStorage.setItem('vietlott_wallet', JSON.stringify(tickets));
    } else {
      localStorage.removeItem('vietlott_wallet');
    }
  }, [tickets]);

  const addTicket = () => {
    const nums = newTicket.match(/\d{1,2}/g);
    if (!nums || nums.length < 5) {
      alert("Vui lòng nhập ít nhất 5 số!");
      return;
    }
    const cleanNums = Array.from(new Set(nums.map(n => n.padStart(2, '0')))).sort();
    
    const newEntry = {
      id: Date.now(),
      game,
      numbers: cleanNums.join(', '),
      dateAdded: new Date().toLocaleDateString('vi-VN')
    };
    
    setTickets([...tickets, newEntry]);
    setNewTicket('');
  };

  const removeTicket = (id) => {
    setTickets(tickets.filter(t => t.id !== id));
  };

  // Logic to calculate match
  const checkWin = (ticket) => {
    if (!latestDraws || !latestDraws[ticket.game]) return null;
    
    const draw = latestDraws[ticket.game];
    const drawBalls = draw.balls.split(',').map(b => b.trim());
    const ticketBalls = ticket.numbers.split(',').map(b => b.trim());
    
    let matchCount = 0;
    ticketBalls.forEach(b => {
      if (drawBalls.includes(b)) matchCount++;
    });

    const isSpecialMatch = ticket.game === '655' && draw.special_ball && ticketBalls.includes(draw.special_ball.trim());
    
    let prize = null;
    if (matchCount === 6) prize = "Jackpot";
    else if (matchCount === 5 && isSpecialMatch) prize = "Jackpot 2";
    else if (matchCount === 5) prize = "Giải Nhất (40 Triệu/40 Tỷ)";
    else if (matchCount === 4) prize = "Giải Nhì (500k)";
    else if (matchCount === 3) prize = "Giải Ba (50k)";

    // Bắn thông báo nếu trúng giải
    if (prize && !notificationSent) {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🎉 CHÚC MỪNG BẠN!", {
          body: `Vé ${ticket.game} của bạn (${ticket.numbers}) đã trúng ${prize} ở kỳ mới nhất (#${draw.draw_id})!`,
          icon: '/icon-192x192.png'
        });
        setNotificationSent(true);
      }
    }

    return { matchCount, isSpecialMatch, prize, drawId: draw.draw_id, drawDate: draw.date };
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="title-gradient" style={{ fontSize: '3.5rem', marginBottom: '16px' }}>Ví Vé Của Tôi</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
          Nhập vé bạn đã mua vào đây. Hệ thống sẽ tự động dò số mỗi khi có kết quả mới và thông báo ngay nếu bạn trúng giải!
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* Form Nhập Vé */}
        <div className="glass-panel" style={{ flex: '1 1 300px', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus color="var(--primary)" /> Thêm Vé Mới
          </h2>
          
          <select 
            value={game} 
            onChange={(e) => setGame(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px' }}
          >
            <option value="645">Mega 6/45</option>
            <option value="655">Power 6/55</option>
          </select>

          <input 
            type="text" 
            placeholder="Nhập dãy số (VD: 04 12 25 33 41 45)" 
            value={newTicket}
            onChange={(e) => setNewTicket(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px' }}
          />

          <button className="btn-primary" onClick={addTicket} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <Wallet size={18} /> Lưu Vào Ví
          </button>
        </div>

        {/* Danh Sách Vé */}
        <div className="glass-panel" style={{ flex: '2 1 500px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 color="#eab308" /> Vé Của Tôi & Kết Quả Mới Nhất
          </h2>
          
          {tickets.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chưa có vé nào trong ví. Hãy thêm vé để tự động dò!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {tickets.map(ticket => {
                const check = checkWin(ticket);
                return (
                  <div key={ticket.id} style={{ background: 'var(--surface-strong)', padding: '16px', borderRadius: '12px', position: 'relative', borderLeft: check?.prize ? '4px solid #10b981' : '4px solid rgba(255,255,255,0.1)' }}>
                    
                    <button 
                      onClick={() => removeTicket(ticket.id)}
                      style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={20} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ padding: '4px 8px', background: ticket.game === '645' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: ticket.game === '645' ? '#ef4444' : '#10b981', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {ticket.game === '645' ? 'Mega 6/45' : 'Power 6/55'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Thêm lúc: {ticket.dateAdded}</span>
                    </div>
                    
                    <div style={{ fontSize: '1.4rem', letterSpacing: '2px', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '12px' }}>
                      {ticket.numbers}
                    </div>

                    {check ? (
                      <div style={{ background: check.prize ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                          Kỳ mới nhất: #{check.drawId} ({check.drawDate})
                        </div>
                        {check.prize ? (
                          <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BellRing size={16} /> TRÚNG GIẢI: {check.prize}
                          </div>
                        ) : (
                          <div style={{ color: '#94a3b8' }}>
                            Trùng {check.matchCount} số. Chúc bạn may mắn lần sau!
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang đối chiếu...</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
