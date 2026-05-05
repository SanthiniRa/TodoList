import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient.tsx';

/* SOUND */
type SoundKey =
  | 'click'
  | 'car'
  | 'success'
  | 'reward'
  | 'jarOpen'
  | 'jarFill';

  const SOUND_SRC = {
    click: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg',
    car: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg',
    success: 'https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg',
    reward: 'https://actions.google.com/sounds/v1/crowds/applause.ogg',
    jarOpen: 'https://actions.google.com/sounds/v1/impacts/wood_plank_flicks.ogg',
    jarFill: 'https://actions.google.com/sounds/v1/cartoon/boing.ogg',
  };

const createSoundManager = () => {
  let unlocked = false;

  const audioMap: Record<SoundKey, HTMLAudioElement> = {
    click: new Audio(SOUND_SRC.click),
    success: new Audio(SOUND_SRC.success),
    car: new Audio(SOUND_SRC.car),
    reward: new Audio(SOUND_SRC.reward),
    jarOpen: new Audio(SOUND_SRC.jarOpen),
    jarFill: new Audio(SOUND_SRC.jarFill),
  };


  const unlock = () => {
    if (unlocked) return;
  
    Object.values(audioMap).forEach(a => {
      a.volume = 0;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = 1;
        })
        .catch(() => {});
    });
  
    unlocked = true;
  };

  const play = (k: SoundKey) => {
    if (!unlocked) return;
    const a = audioMap[k];
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  return { play, unlock };
};

const createSoundEngine = (s: any) => ({
  click: () => s.play('click'),
  success: () => s.play('success'),
  reward: () => s.play('reward'),
  car: () => s.play('car'),
  jarFill: () => s.play('jarFill'),
  jarOpen: () => s.play('jarOpen'),
});

const playEngineSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContext();

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(120, ctx.currentTime);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();

  // rising “engine rev”
  oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 1.2);

  // stop
  setTimeout(() => {
    oscillator.stop();
    ctx.close();
  }, 1200);
};

/* TIME */
const timeSlots = ['morning', 'afternoon', 'evening', 'night'] as const;
type TimeSlot = typeof timeSlots[number];

const ROUTINE: Record<TimeSlot, string[]> = {
  morning: ['MORN'],
  afternoon: ['AFT'],
  evening: ['EVE'],
  night: ['MORN', 'AFT', 'EVE'],
};

/* ICON */
const getTaskIcon = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('brush')) return '🪥';
  if (t.includes('breakfast')) return '🍳';
  if (t.includes('lunch')) return '🍱';
  if (t.includes('dinner')) return '🍛';
  if (t.includes('play')) return '⚽';
  if (t.includes('bath')) return '🛁';
  if (t.includes('sleep')) return '🌙';
  if (t.includes('read')) return '📖';
  if (t.includes('clean')) return '🧹';
  if (t.includes('hug')) return '🤗';
  return '🧩';
};

/* REWARDS */
const rewards = [
  { key: 'Car', title: '🏎️ Car', cost: 10 },
  { key: 'Jeep', title: '🚙 Jeep', cost: 20 },
  { key: 'Trophy', title: '🏆 Trophy', cost: 40 },
];

const getRoomLevel = (xp: number) => {
  if (xp > 100) return 3;
  if (xp > 50) return 2;
  return 1;
};

export default function App() {
  const sound = useRef(createSoundManager()).current;
  const engine = useRef(createSoundEngine(sound)).current;

  const [page, setPage] = useState<'game' | 'kindness'>('game');
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('morning');

  const [users, setUsers] = useState<any[]>([]);
  const [state, setState] = useState<Record<string, any>>({});

  /* ✅ KINDNESS (2 jars per kid) */
  const [kindnessJar, setKindnessJar] = useState<Record<string, string[]>>({});
  const [openJar, setOpenJar] = useState<string | null>(null);
  const handleJarClick = (userId: string) => {
    sound.unlock();
  
    engine.jarOpen();   // lid open sound
    setOpenJar(userId);
  
    setTimeout(() => {
      setOpenJar(null);
      engine.jarFill(); // when closing
    }, 1200);
  };
  /* ================= LOAD ================= */
  useEffect(() => {
    const load = async () => {
      const { data: usersData } = await supabase.from('users').select('*');
      const { data: tasksData } = await supabase.from('tasks').select('*');
      const today = new Date().toISOString().split('T')[0];
      const { data: completions } = await supabase.from('task_completions').select('*').eq('date', today);
      const { data: redeemed } = await supabase.from('reward_redemptions').select('*');
      const { data: rewardsData } = await supabase.from('rewards').select('*');

      setUsers(usersData || []);
      
      const newState: any = {};
      const jarInit: any = {};

      (usersData || []).forEach(user => {
        jarInit[user.id] = [];

        const userCompletions = completions?.filter(c => c.user_id === user.id) || [];
        const userRewards = redeemed?.filter(r => r.user_id === user.id) || [];

        newState[user.id] = {
          xp: userCompletions.length * 10,
          tasks: (tasksData || []).map(t => ({
            id: t.id,
            icon: getTaskIcon(t.title),
            text: t.title,
            description: t.description || 'MORN',
            done: userCompletions.some(c => c.task_id === t.id),
          })),
          dailyJar: userRewards
            .map(r => rewardsData?.find(x => x.id === r.reward_id)?.title)
            .filter(Boolean),
        };
      });

      setState(newState);
      setKindnessJar(jarInit);
    };

    load();
  }, []);

  /* ================= TASK ================= */
  const toggleTask = async (user: any, taskId: string) => {
    const task = state[user.id]?.tasks?.find((t: any) => t.id === taskId);
    if (!task) return;

    const isDone = task.done;

    setState(prev => {
      const updated = prev[user.id].tasks.map((t: any) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      );

      return {
        ...prev,
        [user.id]: {
          ...prev[user.id],
          tasks: updated,
          xp: prev[user.id].xp + (isDone ? -10 : 10),
        },
      };
    });

    if (!isDone) {
      await supabase.from('task_completions').insert({
        user_id: user.id,
        task_id: taskId,
      });
    } else {
      await supabase
        .from('task_completions')
        .delete()
        .eq('user_id', user.id)
        .eq('task_id', taskId);
    }
  };

  /* ================= REWARD ================= */
  const buyReward = async (user: any, item: any) => {
    const { data: reward } = await supabase
      .from('rewards')
      .select('*')
      .eq('title', item.key)
      .single();

    if (!reward) return;

    setState(prev => {
      const kid = prev[user.id];
      if (kid.xp < reward.points_required) return prev;

      engine.reward();
      confetti();
      if (item.title.includes('Car')) moveCar(); 
      if (item.title.includes('Jeep')) balloonEffect(); 
      if (item.title.includes('Trophy')) trophyDance();
      return {
        ...prev,
        [user.id]: {
          ...kid,
          xp: kid.xp - reward.points_required,
          dailyJar: [...kid.dailyJar, reward.title],
        },
      };
    });

    await supabase.from('reward_redemptions').insert({
      user_id: user.id,
      reward_id: reward.id,
      points_spent: reward.points_required,
    });
  };

  /* ================= KINDNESS ADD ================= */
  const addKindness = (userId: string, emoji: string) => {
    setKindnessJar(prev => ({
      ...prev,
      [userId]: [...(prev[userId] || []), emoji],
    }));

    // small animation
    confetti();
  };

  const moveCar = () => {
    sound.unlock();
    //sound.play('car');
    //playEngineSound();
    engine.car();
    const el = document.createElement('div');
    el.innerHTML = '🚗💨';
  
    el.style.position = 'fixed';
    el.style.left = '-80px';
    el.style.top = '45%';
    el.style.fontSize = '50px';
    el.style.transition = 'transform 3s cubic-bezier(.2,.8,.2,1)';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
  
    document.body.appendChild(el);
    el.getBoundingClientRect();
  
    const interval = setInterval(() => {
      const spark = document.createElement('div');
      spark.innerHTML = '✨';
  
      spark.style.position = 'fixed';
      spark.style.left = `${Math.random() * 20}px`;
      spark.style.top = '45%';
      spark.style.fontSize = '18px';
      spark.style.zIndex = '9998';
      spark.style.pointerEvents = 'none';
  
      document.body.appendChild(spark);
  
      setTimeout(() => {
        spark.remove();
      }, 400);
    }, 100);
  
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(120vw) rotate(5deg)';
    });
  
    setTimeout(() => {
      clearInterval(interval);
  
      //sound.play('success');
  
      el.remove();
    }, 3000);
  };
  
const balloonEffect = () => {
  const emojis = ['🎈', '🎉', '✨', '💖', '🌟'];

  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');

    el.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.position = 'fixed';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.bottom = '-50px';
    el.style.fontSize = `${20 + Math.random() * 20}px`;
    el.style.zIndex = '9999';
    el.style.transition = `transform ${2 + Math.random() * 2}s ease-out, opacity 2s`;

    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `
        translateY(-120vh)
        rotate(${Math.random() * 720}deg)
      `;
      el.style.opacity = '0';
    });

    setTimeout(() => {
      document.body.removeChild(el);
    }, 3000);
  }
};

const trophyDance = () => {
  const el = document.createElement('div');
  el.innerHTML = '🏆 WOW';

  el.style.position = 'fixed';
  el.style.top = '50%';
  el.style.left = '50%';
  el.style.transform = 'translate(-50%, -50%) scale(0.3)';
  el.style.fontSize = '70px';
  el.style.fontWeight = 'bold';
  el.style.color = '#ffd700';
  el.style.textShadow = '0 0 25px #ffd700, 0 0 50px #ffea00';
  el.style.zIndex = '9999';
  el.style.transition = 'all 0.6s cubic-bezier(.2,1.5,.3,1)';
  el.style.pointerEvents = 'none';

  document.body.appendChild(el);

  // 🌟 GOLD FLASH BACKGROUND
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.inset = '0';
  flash.style.background = 'radial-gradient(circle, rgba(255,215,0,0.6), rgba(0,0,0,0.3))';
  flash.style.opacity = '0';
  flash.style.zIndex = '9998';
  flash.style.transition = 'opacity 0.3s ease';
  document.body.appendChild(flash);

  // 🎆 CONFETTI BURST
  import('canvas-confetti').then(({ default: confetti }) => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
  });

  // ⚡ SCREEN SHAKE (light)
  document.body.style.transform = 'translateX(2px)';
  setTimeout(() => {
    document.body.style.transform = 'translateX(-2px)';
  }, 50);
  setTimeout(() => {
    document.body.style.transform = 'translateX(0px)';
  }, 120);

  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%, -50%) scale(1.4)';
    flash.style.opacity = '1';
  });

  setTimeout(() => {
    el.style.transform = 'translate(-50%, -50%) scale(1)';
    flash.style.opacity = '0';
  }, 400);

  setTimeout(() => {
    el.style.transform = 'translate(-50%, -50%) scale(0.8)';
    flash.style.opacity = '0';
  }, 900);

  setTimeout(() => {
    document.body.removeChild(el);
    document.body.removeChild(flash);
  }, 1300);
};
  const visibleCategories = ROUTINE[timeSlot];
  const getItemStyle = (i: number): React.CSSProperties => ({
    position: 'absolute',
    left: `${(i * 20) % 80 + 10}%`,
    top: `${Math.floor(i / 4) * 60 + 20}px`,
    fontSize: 30,
    transition: 'transform 0.3s ease',
  });

  return (
    <div style={container} onClick={() => sound.unlock()}>
      <h1>ToDo Game</h1>

      <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}>
        {timeSlots.map(t => <option key={t}>{t}</option>)}
      </select>

      <button style={btn} onClick={() => setPage(page === 'game' ? 'kindness' : 'game')}>
        ❤️ Kindness Page
      </button>

      {/* ================= GAME ================= */}
      {page === 'game' && (
        <div style={{ display: 'flex', gap: 20 }}>
          {users.map(u => (
            <div key={u.id} style={card}>
              <h2 style={{
                background: u.gender === 'girl' ? '#ff6bcb' : '#4dabf7',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '12px',
                display: 'inline-block',
              }}>
                {u.name}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(state[u.id]?.tasks || [])
                  .filter((t: any) => visibleCategories.includes(t.description))
                  .map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() =>   {sound.unlock();
                        engine.click();   
                        confetti();toggleTask(u, t.id)}}
                      style={{
                        ...btn,
                        background: t.done ? '#b2f7ef' : '#ffe5ec',
                        color: 'black',
                      }}
                    >
                      {t.icon} {t.text}
                    </button>
                  ))}
              </div>

              <h3>🎁 Rewards</h3>
              {rewards.map(r => (
                <button key={r.key} onClick={() => buyReward(u, r)}>
                  {r.title} ({r.cost})
                </button>
              ))}

<h4>🏡 My Room</h4>

<div style={houseContainer}>
  <div style={houseRoof} />

  <div style={houseRoom}>
    {/* TOP AREA */}
    <div style={row}>
      {(state[u.id]?.dailyJar || [])
        .filter(r => r.includes('Trophy'))
        .map((r, i) => (
          <span key={i} style={item}>
            🏆
          </span>
        ))}
    </div>

    {/* MIDDLE AREA */}
    <div style={row}>
      {(state[u.id]?.dailyJar || [])
        .filter(r => r.includes('Car'))
        .map((r, i) => (
          <span key={i} style={item}>
            🚗
          </span>
        ))}
    </div>

    {/* BOTTOM AREA */}
    <div style={row}>
      {(state[u.id]?.dailyJar || [])
        .filter(r => !r.includes('Car') && !r.includes('Trophy'))
        .map((r, i) => (
          <span key={i} style={item}>
            🎁
          </span>
        ))}
    </div>
  </div>
</div>
            </div>
          ))}
        </div>
      )}

      {/* ================= KINDNESS PAGE (2 JARS) ================= */}
      {page === 'kindness' && (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <h2>💖 Kindness Hearts</h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
            
            {users.map(u => (
              <div key={u.id} style={{ textAlign: 'center' }}>
                
                <h3>{u.name}</h3>

                {/* ❤️ HEART JAR */}
                
                <div style={jarStyle} onClick={() => handleJarClick(u.id)}>
  
                  {/* LID */}
                  <div
                      key={openJar === u.id ? 'open' : 'closed'}  // 👈 IMPORTANT
                      style={{
                        ...jarLid,
                        animation: openJar === u.id ? 'lidOpen 1s forwards' : undefined,
                      }}
                    />
                  <div style={glassShine}></div>
                  {(kindnessJar[u.id] || []).map((e, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 26,
                        animation: 'pop 0.3s ease',
                      }}
                    >
                      {e}
                    </span>
                  ))}
                </div>

                {/* BUTTONS */}
                <div style={{ marginTop: 10 }}>
                  <button style={btn} onClick={() => addKindness(u.id, '💖')}>💖</button>
                  <button style={btn} onClick={() => addKindness(u.id, '🤗')}>🤗</button>
                  <button style={btn} onClick={() => addKindness(u.id, '🌟')}>🌟</button>
                  <button style={btn} onClick={() => addKindness(u.id, '😊')}>😊</button>
                </div>

              </div>
            ))}

          </div>
        </div>
      )}
    </div>
  );
}

/* STYLES (UNCHANGED) */
const container: React.CSSProperties = {
  minHeight: '100vh',
  padding: 10,
  background: 'linear-gradient(135deg,#ff9a9e,#a1c4fd,#84fab0)',
};

const card: React.CSSProperties = {
  flex: 1,
  background: 'white',
  padding: 15,
  borderRadius: 20,
};

const btn: React.CSSProperties = {
  padding: 10,
  margin: 5,
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
};

const roomStyle: React.CSSProperties = {
  width: '100%',
  height: 240,
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 20,
};

const jarStyle: React.CSSProperties = {
  width: '25vw',
  height: '40vh',
  margin: '0 auto',
  position: 'relative',

  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'flex-end',
  gap: 10,
  padding: '40px 20px 20px',

  overflow: 'hidden',

  background: 'linear-gradient(180deg, #e3f2fd, #ffffff)',
  border: '3px solid #90caf9',

  /* 👇 THIS MAKES IT JAR SHAPED */
  borderBottomLeftRadius: '80px',
  borderBottomRightRadius: '80px',
  borderTopLeftRadius: '30px',
  borderTopRightRadius: '30px',

  boxShadow: `
    inset 0 10px 20px rgba(255,255,255,0.6),
    inset 0 -10px 20px rgba(0,0,0,0.05),
    0 20px 40px rgba(0,0,0,0.2)
  `,
};

const jarLid: React.CSSProperties = {
  position: 'absolute',
  top: -15,
  left: '50%',
  transform: 'translateX(-50%)',

  width: '55%',
  height: 35,

  background: '#74c0fc',
  borderRadius: 12,
  boxShadow: '0 5px 10px rgba(0,0,0,0.3)',
  zIndex: 5,
};

const glassShine: React.CSSProperties = {
  position: 'absolute',
  top: 20,
  left: 20,
  width: '30%',
  height: '60%',
  background: 'rgba(255,255,255,0.3)',
  borderRadius: '50%',
  filter: 'blur(10px)',
};
const houseContainer: React.CSSProperties = {
  width: '100%',
  maxWidth: 340,
  margin: '0 auto',
  position: 'relative',
};

const houseRoof: React.CSSProperties = {
  width: 0,
  height: 0,
  margin: '0 auto',

  // 👇 correct responsive trick
  borderLeft: '170px solid transparent',
  borderRight: '170px solid transparent',
  borderBottom: '90px solid #ffb3c6',

  position: 'relative',
  top: 0,
};

const houseRoom: React.CSSProperties = {
  width: '100%',
  height: 260,

  background: 'linear-gradient(to bottom, #ffffff, #e6f2ff)',
  border: '3px solid #74c0fc',
  borderTop: 'none',

  borderRadius: '0 0 16px 16px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',

  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-around',
  padding: 10,

  boxSizing: 'border-box',
};

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

const item: React.CSSProperties = {
  fontSize: 32,
  animation: 'popIn 0.3s ease',
};