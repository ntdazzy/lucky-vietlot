import { BookOpen, Target, ShieldCheck, Zap, Layers, Sparkles, TrendingUp } from 'lucide-react';

export const metadata = {
  title: 'Hướng dẫn chơi Bao Vietlott',
};

export default function GuidePage() {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(56, 189, 248, 0.1)', padding: '12px 24px', borderRadius: '50px', marginBottom: '24px' }}>
          <Sparkles color="#38bdf8" size={20} style={{ marginRight: '8px' }} />
          <span style={{ color: '#38bdf8', fontWeight: 600, letterSpacing: '1px' }}>TÀI LIỆU DÀNH CHO NGƯỜI CHƠI CHUYÊN NGHIỆP</span>
        </div>
        <h1 className="title-gradient" style={{ fontSize: '4rem', marginBottom: '20px', lineHeight: 1.1 }}>Bí Quyết Chơi Bao</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.3rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          Tuyệt chiêu gia tăng cơ hội trúng giải thưởng lớn Vietlott bằng cách bọc lót tất cả các trường hợp có thể xảy ra.
        </p>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Khái niệm cơ bản */}
        <div className="glass-panel" style={{ marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.05 }}>
            <BookOpen size={200} />
          </div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '20px' }}>
            <Layers /> Khái niệm cơ bản
          </h2>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ lineHeight: 1.8, fontSize: '1.1rem', color: 'var(--text-main)' }}>
              Chơi vé thường (vé cơ bản) nghĩa là bạn chọn ra đúng <strong>6 bộ số</strong>.
            </p>
            <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
              <span className="ball" style={{width:'40px',height:'40px',fontSize:'1.1rem'}}>01</span>
              <span className="ball" style={{width:'40px',height:'40px',fontSize:'1.1rem'}}>15</span>
              <span className="ball" style={{width:'40px',height:'40px',fontSize:'1.1rem'}}>22</span>
              <span className="ball" style={{width:'40px',height:'40px',fontSize:'1.1rem'}}>34</span>
              <span className="ball" style={{width:'40px',height:'40px',fontSize:'1.1rem'}}>41</span>
              <span className="ball" style={{width:'40px',height:'40px',fontSize:'1.1rem'}}>45</span>
            </div>
            <p style={{ lineHeight: 1.8, fontSize: '1.1rem', color: 'var(--text-muted)', marginTop: '20px' }}>
              <strong>Chơi Bao</strong> là hình thức bạn chọn <strong>Nhiều hơn 6 số</strong> (chọn 7, 8, 9, 10 số) hoặc <strong>Ít hơn 6 số</strong> (Bao 5). 
              Hệ thống sẽ tự động ghép các số bạn chọn thành <strong>tất cả các tổ hợp 6 số</strong> có thể có, giúp bạn "bao trọn" các trường hợp và tăng vọt tỷ lệ trúng giải.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          {/* Bao 5 */}
          <div className="glass-panel" style={{ borderTop: '4px solid #f43f5e', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '6px 12px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem' }}>
              Bao Thiếu
            </div>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Bao 5 
            </h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.1rem' }}>
              Bạn chỉ cần chọn <strong>5 số cố định</strong>. Con số thứ 6 hệ thống sẽ tự động lấy tất cả các số còn lại (40 số còn lại với Mega, hoặc 50 số còn lại với Power) ghép vào.
            </p>
            
            <div style={{ background: 'var(--surface-strong)', padding: '24px', borderRadius: '12px', marginTop: '24px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
              <div style={{ color: 'var(--text-main)', marginBottom: '16px', fontWeight: 'bold' }}>Ví dụ trực quan: Bạn chọn 5 số</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#f43f5e', color:'white', border:'none', boxShadow:'0 0 15px rgba(244,63,94,0.4)'}}>01</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#f43f5e', color:'white', border:'none', boxShadow:'0 0 15px rgba(244,63,94,0.4)'}}>02</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#f43f5e', color:'white', border:'none', boxShadow:'0 0 15px rgba(244,63,94,0.4)'}}>03</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#f43f5e', color:'white', border:'none', boxShadow:'0 0 15px rgba(244,63,94,0.4)'}}>04</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#f43f5e', color:'white', border:'none', boxShadow:'0 0 15px rgba(244,63,94,0.4)'}}>05</span>
                <span style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'var(--text-muted)' }}>+</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'transparent', color:'white', border:'1px dashed var(--text-muted)'}}>?</span>
              </div>
              
              <div style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>Hệ thống tự động sinh ra 40 vé (tương đương 400.000đ):</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace', fontSize: '1.1rem', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px' }}>
                <div>Vé 1: 01 02 03 04 05 - <span style={{ color: '#10b981' }}>06</span></div>
                <div>Vé 2: 01 02 03 04 05 - <span style={{ color: '#10b981' }}>07</span></div>
                <div style={{ color: 'var(--text-muted)' }}>... (tự động ghép tiếp)</div>
                <div>Vé 40: 01 02 03 04 05 - <span style={{ color: '#10b981' }}>45</span></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginTop: '20px', padding: '16px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '8px' }}>
                <Zap color="#f43f5e" size={24} style={{ flexShrink: 0 }} />
                <div style={{ color: '#f43f5e', lineHeight: 1.5 }}>
                  <strong>Siêu Lợi Ích:</strong> Nếu kết quả quay thưởng có chứa 3 trong số 5 con số bạn chọn, bạn <strong>chắc chắn trúng giải</strong> và trúng RẤT NHIỀU giải cùng một lúc vì bạn đang sở hữu 40 vé!
                </div>
              </div>
            </div>
          </div>

          {/* Bao 7 */}
          <div className="glass-panel" style={{ borderTop: '4px solid #10b981', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '50px', fontWeight: 'bold', fontSize: '0.9rem' }}>
              Bao Dư
            </div>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Bao 7
            </h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.1rem' }}>
              Bạn chọn <strong>7 số</strong>. Hệ thống sẽ trộn 7 số này để tạo ra tất cả các tổ hợp 6 số có thể có (Tổng cộng 7 tổ hợp = 7 vé).
            </p>
            
            <div style={{ background: 'var(--surface-strong)', padding: '24px', borderRadius: '12px', marginTop: '24px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ color: 'var(--text-main)', marginBottom: '16px', fontWeight: 'bold' }}>Ví dụ trực quan: Bạn chọn 7 số</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#10b981', color:'white', border:'none', boxShadow:'0 0 15px rgba(16,185,129,0.4)'}}>10</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#10b981', color:'white', border:'none', boxShadow:'0 0 15px rgba(16,185,129,0.4)'}}>15</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#10b981', color:'white', border:'none', boxShadow:'0 0 15px rgba(16,185,129,0.4)'}}>20</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#10b981', color:'white', border:'none', boxShadow:'0 0 15px rgba(16,185,129,0.4)'}}>25</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#10b981', color:'white', border:'none', boxShadow:'0 0 15px rgba(16,185,129,0.4)'}}>30</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#10b981', color:'white', border:'none', boxShadow:'0 0 15px rgba(16,185,129,0.4)'}}>35</span>
                <span className="ball" style={{width:'36px',height:'36px',fontSize:'1rem', background:'#10b981', color:'white', border:'none', boxShadow:'0 0 15px rgba(16,185,129,0.4)'}}>40</span>
              </div>
              
              <div style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>Hệ thống tự động sinh ra 7 vé (tương đương 70.000đ):</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontFamily: 'monospace', fontSize: '1.1rem', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px' }}>
                <div>Vé 1: <span style={{ color: 'var(--text-muted)' }}>Bỏ số 40</span> ➔ 10 15 20 25 30 35</div>
                <div>Vé 2: <span style={{ color: 'var(--text-muted)' }}>Bỏ số 35</span> ➔ 10 15 20 25 30 40</div>
                <div>Vé 3: <span style={{ color: 'var(--text-muted)' }}>Bỏ số 30</span> ➔ 10 15 20 25 35 40</div>
                <div>Vé 4: <span style={{ color: 'var(--text-muted)' }}>Bỏ số 25</span> ➔ 10 15 20 30 35 40</div>
                <div>Vé 5: <span style={{ color: 'var(--text-muted)' }}>Bỏ số 20</span> ➔ 10 15 25 30 35 40</div>
                <div>Vé 6: <span style={{ color: 'var(--text-muted)' }}>Bỏ số 15</span> ➔ 10 20 25 30 35 40</div>
                <div>Vé 7: <span style={{ color: 'var(--text-muted)' }}>Bỏ số 10</span> ➔ 15 20 25 30 35 40</div>
              </div>
            </div>
          </div>

          {/* Bao 8, 9, 10 */}
          <div className="glass-panel" style={{ borderTop: '4px solid #eab308' }}>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Bao 8, Bao 9, Bao 10...
            </h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.1rem' }}>
              Tương tự Bao 7, bạn chọn càng nhiều số, hệ thống càng tạo ra nhiều tổ hợp để phủ kín mọi xác suất.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginTop: '24px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ color: '#eab308', fontSize: '1.3rem', marginBottom: '8px' }}>Bao 8</h4>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>28 vé</div>
                <div style={{ color: 'var(--text-muted)' }}>Chi phí: 280.000đ</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ color: '#eab308', fontSize: '1.3rem', marginBottom: '8px' }}>Bao 9</h4>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>84 vé</div>
                <div style={{ color: 'var(--text-muted)' }}>Chi phí: 840.000đ</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ color: '#eab308', fontSize: '1.3rem', marginBottom: '8px' }}>Bao 10</h4>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>210 vé</div>
                <div style={{ color: 'var(--text-muted)' }}>Chi phí: 2.100.000đ</div>
              </div>
            </div>

            <div style={{ background: 'rgba(234,179,8,0.1)', padding: '24px', borderRadius: '12px', marginTop: '24px', border: '1px solid rgba(234,179,8,0.2)' }}>
              <h4 style={{ color: '#eab308', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ShieldCheck size={24} /> Tại sao đại gia thích chơi Bao 10+?
              </h4>
              <p style={{ color: 'var(--text-main)', lineHeight: 1.6, fontSize: '1.05rem', margin: 0 }}>
                Nếu kết quả quay thưởng có 6 số nằm trọn trong 10 số bạn đã chọn, bạn không chỉ trúng <strong>1 giải Jackpot</strong>, mà còn trúng thêm <strong>HÀNG CHỤC</strong> giải Nhất, giải Nhì, giải Ba do các tổ hợp phụ tạo ra! Tổng tiền thưởng sẽ cao hơn rất nhiều so với vé thường.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
