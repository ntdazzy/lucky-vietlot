import { getDb, findDuplicateSets, searchExactSet } from '@/lib/db';
import { getGameNames } from '@/lib/games';
import { Search, Copy, Filter, Hash, ArrowRight } from 'lucide-react';
import GameChip from '@/components/GameChip';

export const dynamic = 'force-dynamic';

const VALID_TABLES = { '645': 'draws_645', '655': 'draws_655', '535': 'draws_535', 'max3dpro': 'draws_max3dpro' };

export default async function SearchPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';
  const game = resolvedParams.game || '645';
  const mode = resolvedParams.mode || 'search';
  const minOcc = parseInt(resolvedParams.min || '2', 10);
  let results = [];
  let duplicates = [];
  let exactMatches = [];

  const table = VALID_TABLES[game];
  if (!table) return <div>Game không hợp lệ</div>;

  if (mode === 'duplicates' && game !== 'max3dpro') {
    duplicates = findDuplicateSets(game, minOcc);
  }

  if (query && mode === 'search') {
    try {
      const db = getDb();
      if (game === 'max3dpro') {
        const stmt = db.prepare(`SELECT * FROM draws_max3dpro WHERE draw_id = ? OR date = ? OR dac_biet LIKE ? ORDER BY CAST(draw_id AS INTEGER) DESC LIMIT 50`);
        results = stmt.all(query, query, `%${query}%`);
      } else {
        const numbers = query.match(/\d{1,2}/g);
        if (numbers && numbers.length >= 5 && numbers.length <= 18 && !query.includes('-')) {
          const searchSet = new Set(numbers.map(n => n.padStart(2, '0')));
          const stmt = db.prepare(`SELECT * FROM ${table} ORDER BY CAST(draw_id AS INTEGER) DESC`);
          const allDraws = stmt.all();
          for (const draw of allDraws) {
            if (!draw.balls) continue;
            const drawBalls = draw.balls.split(',').map(b => b.trim());
            let matchCount = 0;
            for (const b of drawBalls) { if (searchSet.has(b)) matchCount++; }
            if (matchCount >= 3) { draw.matchCount = matchCount; results.push(draw); }
          }
          results.sort((a, b) => b.matchCount - a.matchCount);
          results = results.slice(0, 100);
        } else {
          const stmt = db.prepare(`SELECT * FROM ${table} WHERE draw_id = ? OR date = ? OR balls LIKE ? ORDER BY CAST(draw_id AS INTEGER) DESC LIMIT 50`);
          results = stmt.all(query, query, `%${query}%`);
        }
      }
    } catch (e) { console.error(e); }
  }

  if (query && mode === 'exact' && game !== 'max3dpro') {
    const nums = query.match(/\d{1,2}/g);
    if (nums && nums.length >= 3) {
      exactMatches = searchExactSet(game, nums.map(Number));
    }
  }

  const gameNames = getGameNames();
  const db = getDb();
  const counts = {};
  for (const [code, tbl] of Object.entries(VALID_TABLES)) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as n FROM ${tbl}`).get();
      counts[code] = row.n;
    } catch (e) { counts[code] = 0; }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title title-gradient">Dò Số & Xem Kết Quả</h1>
        <p className="page-subtitle">
          Tìm kiếm kết quả các kỳ quay trước hoặc kiểm tra xem bộ số của bạn đã từng trúng chưa nhé!
        </p>

        <div className="game-picker">
          {['645', '655', '535', 'max3dpro'].map(g => (
            <a
              key={g}
              href={`/tra-cuu?game=${g}&mode=${mode}&q=${query}`}
              className={`game-pick-link${game === g ? ' is-active' : ''}`}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
            >
              <GameChip game={g} size="md" variant={game === g ? 'solid' : 'soft'} />
              <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>{counts[g]} kỳ</span>
            </a>
          ))}
        </div>
      </div>

      {/* MODE TABS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {[
          { key: 'search', icon: '🔍', label: 'Tìm Kết Quả' },
          { key: 'exact', icon: '🎯', label: 'Dò Số Lịch Sử' },
          { key: 'duplicates', icon: '♻️', label: 'Xem Số Trùng' }
        ].map(tab => (
          <a key={tab.key} href={`/tra-cuu?game=${game}&mode=${tab.key}&q=${query}&min=${minOcc}`}
            style={{
              padding: '10px 20px', borderRadius: '10px', textDecoration: 'none',
              background: mode === tab.key ? 'var(--surface-hover)' : 'var(--surface)',
              border: mode === tab.key ? '2px solid var(--primary)' : '1px solid var(--surface-border)',
              color: mode === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: mode === tab.key ? 700 : 500, fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
            }}>
            {tab.icon} {tab.label}
          </a>
        ))}
      </div>

      {/* SEARCH MODE */}
      {mode === 'search' && (
        <>
          <div className="glass-panel" style={{ maxWidth: '650px', margin: '0 auto 32px auto' }}>
            <form method="GET" style={{ display: 'flex', gap: '10px' }}>
              <input type="hidden" name="game" value={game} />
              <input type="hidden" name="mode" value="search" />
              <input type="text" name="q" defaultValue={query}
                placeholder="Kỳ quay, ngày, hoặc 5+ số để kiểm tra Bao..."
                style={{ flex: 1, fontSize: '1rem' }} />
              <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Search size={18} /> Tìm
              </button>
            </form>
          </div>

          {query && (
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px' }}>
                Kết quả cho: <span style={{ color: 'var(--primary)' }}>{query}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 400, marginLeft: '8px' }}>({results.length} kết quả)</span>
              </h3>
              {results.length > 0 ? (
                <div className="table-responsive"><table>
                  <thead><tr>
                    <th>Ngày</th><th>Kỳ</th>
                    {game !== 'max3dpro' ? <th>Bộ Số</th> : <th>Đặc Biệt</th>}
                    {game === '655' && <th>ĐB</th>}
                    <th>Trúng</th>
                  </tr></thead>
                  <tbody>
                    {results.map(draw => {
                      const balls = game !== 'max3dpro' && draw.balls ? draw.balls.split(',').map(b => b.trim()) : [];
                      const searchSet = new Set((query.match(/\d{1,2}/g) || []).map(n => n.padStart(2, '0')));
                      const isBao = searchSet.size >= 5;
                      return (
                        <tr key={draw.id}>
                          <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{draw.date}</td>
                          <td style={{ color: 'var(--text-muted)' }}>#{draw.draw_id}</td>
                          {game !== 'max3dpro' ? (
                            <td>{balls.map((b, i) => (
                              <span key={i} className="ball" style={{
                                width: '34px', height: '34px', fontSize: '0.85rem',
                                background: isBao && searchSet.has(b) ? 'linear-gradient(135deg, var(--primary), #ff7b9c)' : '',
                                color: isBao && searchSet.has(b) ? 'white' : '', border: isBao && searchSet.has(b) ? 'none' : ''
                              }}>{b}</span>
                            ))}</td>
                          ) : (<td style={{ fontWeight: 600, color: 'var(--primary)' }}>{draw.dac_biet}</td>)}
                          {game === '655' && (<td><span className="ball special" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>{draw.special_ball}</span></td>)}
                          <td>{draw.matchCount ? (
                            <span style={{ color: draw.matchCount >= 5 ? 'var(--primary)' : draw.matchCount === 4 ? '#eab308' : '#10b981', fontWeight: 700 }}>
                              {draw.matchCount}/{balls.length}
                            </span>
                          ) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Không tìm thấy kết quả.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* EXACT SET CHECK MODE */}
      {mode === 'exact' && (
        <>
          <div className="glass-panel" style={{ maxWidth: '650px', margin: '0 auto 32px auto' }}>
            <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Hash size={18} color="var(--primary)" /> Kiểm tra bộ số trong lịch sử
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Nhập 3-6 số để xem bộ số đó đã từng xuất hiện chưa. Hiển thị tất cả kỳ quay khớp ≥3 số.
            </p>
            <form method="GET" style={{ display: 'flex', gap: '10px' }}>
              <input type="hidden" name="game" value={game} />
              <input type="hidden" name="mode" value="exact" />
              <input type="text" name="q" defaultValue={query}
                placeholder="VD: 03 12 25 33 41 45"
                style={{ flex: 1, fontSize: '1rem', letterSpacing: '1px' }} />
              <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Search size={18} /> Kiểm tra
              </button>
            </form>
          </div>

          {query && exactMatches.length > 0 && (
            <div className="glass-panel">
              <h3 style={{ marginBottom: '16px' }}>
                Tìm thấy <span style={{ color: 'var(--primary)' }}>{exactMatches.length}</span> kỳ khớp với bộ số của bạn
              </h3>
              <div className="table-responsive"><table>
                <thead><tr><th>Ngày</th><th>Kỳ</th><th>Bộ Số</th><th>Khớp</th></tr></thead>
                <tbody>
                  {exactMatches.slice(0, 50).map(draw => {
                    const balls = draw.balls ? draw.balls.split(',').map(b => b.trim()) : [];
                    const inputSet = new Set((query.match(/\d{1,2}/g) || []).map(n => n.padStart(2, '0')));
                    return (
                      <tr key={draw.id}>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{draw.date}</td>
                        <td style={{ color: 'var(--text-muted)' }}>#{draw.draw_id}</td>
                        <td>{balls.map((b, i) => (
                          <span key={i} className="ball" style={{
                            width: '34px', height: '34px', fontSize: '0.85rem',
                            background: inputSet.has(b) ? 'linear-gradient(135deg, #10b981, #06d6a0)' : '',
                            color: inputSet.has(b) ? 'white' : '', border: inputSet.has(b) ? 'none' : ''
                          }}>{b}</span>
                        ))}</td>
                        <td>
                          <span style={{
                            fontWeight: 700, fontSize: '1.1rem',
                            color: draw.matchCount >= 6 ? 'var(--primary)' : draw.matchCount >= 5 ? '#eab308' : draw.matchCount >= 4 ? '#f59e0b' : '#10b981'
                          }}>
                            {draw.matchCount}/{draw.totalInput}
                          </span>
                          {draw.matchCount >= 6 && <span style={{ marginLeft: '8px', color: 'var(--primary)', fontWeight: 700 }}>JACKPOT!</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          )}

          {query && exactMatches.length === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✨</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                Không tìm thấy kỳ nào khớp ≥3 số với bộ số bạn nhập.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
                Bộ số này chưa từng xuất hiện gần giống trong lịch sử — có thể là bộ số "mới" hoàn toàn!
              </p>
            </div>
          )}
        </>
      )}

      {/* DUPLICATES MODE */}
      {mode === 'duplicates' && (
        <>
          {game === 'max3dpro' ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>Tính năng này chỉ hỗ trợ Mega 6/45, Power 6/55 và Lotto 5/35.</p>
            </div>
          ) : (
            <>
              <div className="glass-panel" style={{ maxWidth: '650px', margin: '0 auto 32px auto' }}>
                <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Copy size={18} color="#a855f7" /> Các Bộ Số Từng Trúng Nhiều Lần
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Xem những bộ số may mắn đã từng "nổ" từ 2 lần trở lên trong lịch sử.
                </p>
                <form method="GET" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input type="hidden" name="game" value={game} />
                  <input type="hidden" name="mode" value="duplicates" />
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    <Filter size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Xuất hiện tối thiểu:
                  </label>
                  <select name="min" defaultValue={minOcc} style={{ padding: '10px 16px', minWidth: '80px' }}>
                    <option value="2">≥ 2 lần</option>
                    <option value="3">≥ 3 lần</option>
                  </select>
                  <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Search size={16} /> Lọc
                  </button>
                </form>
              </div>

              <div className="glass-panel">
                {duplicates.length > 0 ? (
                  <>
                    <h3 style={{ marginBottom: '20px' }}>
                      Tìm thấy <span style={{ color: '#a855f7' }}>{duplicates.length}</span> bộ số trùng lặp
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {duplicates.map((dup, idx) => (
                        <div key={idx} style={{ background: 'var(--surface-strong)', padding: '16px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {dup.balls.map((b, i) => (
                                <span key={i} className="ball" style={{ width: '38px', height: '38px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white', border: 'none' }}>{b}</span>
                              ))}
                            </div>
                            <span style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '6px 14px', borderRadius: '20px', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                              {dup.count} lần xuất hiện
                            </span>
                          </div>
                          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {dup.draws.map((d, di) => (
                              <span key={di} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: '4px 10px', borderRadius: '6px' }}>
                                #{d.draw_id} — {d.date}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎲</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                      Không tìm thấy bộ số nào xuất hiện ≥ {minOcc} lần.
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                      {minOcc >= 3 ? 'Thử giảm bộ lọc xuống ≥ 2 lần.' : 'Mỗi kỳ quay gần như là duy nhất — xổ số thực sự ngẫu nhiên!'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
