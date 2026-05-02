import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient.tsx';

/* 🎧 SOUND SYSTEM */
type SoundKey = 'click' | 'success' | 'reward';

const SOUND_SRC: Record<SoundKey, string> = {
  click: 'https://actions.google.com/sounds/v1/ui/click.ogg',
  success: 'https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg',
  reward: 'https://actions.google.com/sounds/v1/crowds/applause.ogg',
};

const createSoundManager = () => {
  let unlocked = false;

  const audioMap: Record<SoundKey, HTMLAudioElement> = {
    click: new Audio(SOUND_SRC.click),
    success: new Audio(SOUND_SRC.success),
    reward: new Audio(SOUND_SRC.reward),
  };

  Object.values(audioMap).forEach((a) => {
    a.preload = 'auto';
    a.volume = 0.6;
  });

  const unlock = () => {
    if (unlocked) return;
    Object.values(audioMap).forEach((a) => {
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => {});
    });
    unlocked = true;
  };

  const play = (key: SoundKey) => {
    if (!unlocked) return;
    const a = audioMap[key];
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  return { play, unlock };
};

const createSoundEngine = (sound: any) => ({
  click: () => sound.play('click'),
  success: () => sound.play('success'),
  reward: () => sound.play('reward'),
});

/* 🎆 REWARD EFFECTS (NEW) */
const launchBalloonEffect = () => {
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      confetti({
        particleCount: 35,
        spread: 60,
        startVelocity: 20,
        gravity: 0.7,
        scalar: 1.1,
        shapes: ['circle'],
      });
    }, i * 120);
  }
};

const launchFireworksEffect = () => {
  const end = Date.now() + 1200;

  const frame = () => {
    confetti({
      particleCount: 6,
      spread: 90,
      startVelocity: 45,
      origin: {
        x: Math.random(),
        y: Math.random() * 0.6,
      },
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};

/* ⏰ TIME */
const timeSlots = ['morning', 'afternoon', 'evening', 'night'] as const;
type TimeSlot = (typeof timeSlots)[number];

const ROUTINE: Record<TimeSlot, number[]> = {
  morning: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11],
  afternoon: [12, 13],
  evening: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  night: [27, 28, 29],
};

/* 📋 TASKS */
const tasksData = [
  { id: 1, icon: '🤗', text: 'Morning Hug' },
  { id: 2, icon: '🪥', text: 'Brush Teeth' },
  { id: 3, icon: '🚿', text: 'Wash Face' },
  { id: 4, icon: '🚽', text: 'Toilet' },
  { id: 5, icon: '⚽', text: 'Play Time' },
  { id: 6, icon: '🍳', text: 'Prepare Breakfast' },
  { id: 7, icon: '🥣', text: 'Breakfast' },
  { id: 8, icon: '🧽', text: 'Clean Up After Eating' },
  { id: 9, icon: '🎒', text: 'Get Ready for School' },
  { id: 10, icon: '💇', text: 'Hair / Cream' },
  { id: 11, icon: '🙏', text: 'Pray' },
  { id: 12, icon: '🍱', text: 'Lunch' },
  { id: 13, icon: '⚽', text: 'Play Time' },
  { id: 14, icon: '🤗', text: 'Evening Hug' },
  { id: 15, icon: '🧼', text: 'Wash Hands' },
  { id: 16, icon: '👕', text: 'Change Clothes' },
  { id: 17, icon: '🛁', text: 'Bath' },
  { id: 18, icon: '🏃', text: 'Workout' },
  { id: 19, icon: '🎲', text: 'Play Time' },
  { id: 20, icon: '🍛', text: 'Dinner' },
  { id: 21, icon: '🧹', text: 'Clean Up After Eating' },
  { id: 22, icon: '📖', text: 'Reading' },
  { id: 23, icon: '🔢', text: 'Numbers' },
  { id: 24, icon: '🎨', text: 'Drawing' },
  { id: 25, icon: '🧠', text: 'Thinking Game' },
  { id: 26, icon: '🧺', text: 'Tidy Up' },
  { id: 27, icon: '🪥', text: 'Night Brush' },
  { id: 28, icon: '🤗', text: 'Night Hug' },
  { id: 29, icon: '🌙', text: 'Sleep' },
];

/* 🎁 REWARDS */
const rewards = [
  { name: '🏎️ Car', cost: 10 },
  { name: '🚙 Jeep', cost: 20 },
  { name: '🏆 Trophy', cost: 40 },
];

const JAR_COLS = 4;
const CELL = 38;
const applause = new Audio(
  'https://actions.google.com/sounds/v1/crowds/applause.ogg'
);
applause.volume = 0.8;
/* 🧒 KID */
const createKid = () => ({
  xp: 0,
  tasks: tasksData.map((t) => ({ ...t, done: false })),
  dailyJar: [] as string[],
  kindnessJar: [] as string[],
  kindnessError: null as string | null,
});

const speak = (text: string) => {
  const msg = new SpeechSynthesisUtterance(text);
  msg.rate = 1;
  msg.pitch = 1.6;
  msg.volume = 1;
  speechSynthesis.speak(msg);
};

/* 🚗 CAR */
const carDrive = () => {
  const el = document.createElement('div');
  el.innerHTML = '🚗';
  el.style.position = 'fixed';
  el.style.left = '-50px';
  el.style.top = '40%';
  el.style.fontSize = '40px';
  el.style.zIndex = '9999';

  // ⬇️ slower animation (was 2s → now 4s)
  el.style.transition = 'transform 4s linear';

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = 'translateX(120vw)';
  });

  setTimeout(() => document.body.removeChild(el), 4200);
};

/* 🎈 BALLOONS */
const balloonEffect = () => {
  for (let i = 0; i < 10; i++) {
    const el = document.createElement('div');
    el.innerHTML = '🎈';
    el.style.position = 'fixed';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.bottom = '-50px';
    el.style.fontSize = '30px';
    el.style.zIndex = '9999';
    el.style.transition = 'transform 3s ease-out, opacity 3s';

    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translateY(-120vh)';
      el.style.opacity = '0';
    });

    setTimeout(() => document.body.removeChild(el), 3000);
  }
};

/* 🏆 TROPHY OVERLAY */
const showTrophy = () => {
  // 🔊 applause sound
  applause.currentTime = 0;
  applause.play().catch(() => {});

  const el = document.createElement('div');
  el.innerHTML = `
    <div style="
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:120px;
      background:rgba(0,0,0,0.4);
      z-index:9999;
    ">🏆</div>
  `;

  document.body.appendChild(el);
  setTimeout(() => document.body.removeChild(el), 1200);
};

/* 🚀 APP */

export default function App() {
  const sound = useRef(createSoundManager()).current;
  const engine = useRef(createSoundEngine(sound)).current;

  const [page, setPage] = useState<'game' | 'kindness'>('game');
  const [timeSlot, setTimeSlot] = useState('morning');

  const [state, setState] = useState({
    1: createKid(),
    2: createKid(),
  });

  /* ================= 🆕 LOAD FROM DB ================= */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_state')
        .select('*')
        .eq('id', 1)
        .single();

      if (data?.data) {
        setState(data.data);
      }
    };

    load();
  }, []);

  /* ================= 🆕 SAVE TO DB ================= */
  useEffect(() => {
    console.log('🔥 STATE CHANGED - attempting save');

    const save = async () => {
      const { res } = await supabase
        .from('users')
        .insert([{ name: 'Kid 1' }])
        .select()
        .single();

      console.log('📦 SUPABASE RESPONSE:', res);
    };

    save();
  }, [state]);

  const visibleIds = ROUTINE[timeSlot];

  /* 🧩 TASKS */
  const toggleTask = (kidId: number, taskId: number) => {
    setState((prev) => {
      const kid = prev[kidId];
      let xpChange = 0;

      const updated = kid.tasks.map((t) => {
        if (t.id === taskId) {
          const newDone = !t.done;
          xpChange = newDone ? 10 : -10;

          if (newDone) {
            engine.click();
            setTimeout(() => engine.success(), 120);
            confetti();
          }

          return { ...t, done: newDone };
        }
        return t;
      });

      return {
        ...prev,
        [kidId]: {
          ...kid,
          xp: Math.max(0, kid.xp + xpChange),
          tasks: updated,
        },
      };
    });
  };

  /* 🎁 REWARD (UPDATED EFFECTS) */
  const buyReward = (kidId: number, item: any) => {
    setState((prev) => {
      const kid = prev[kidId];

      if (kid.xp < item.cost) return prev;

      engine.reward();
      confetti();

      // 🔊 FUNNY VOICE (no UI change)
      speak(`Wow! You earned Great job!`);

      // 🚗 Car effect
      if (item.name.includes('Car')) {
        carDrive();
      }

      // 🎈 Jeep effect
      if (item.name.includes('Jeep')) {
        balloonEffect();
      }

      // 🏆 Trophy effect
      if (item.name.includes('Trophy')) {
        showTrophy();
      }

      return {
        ...prev,
        [kidId]: {
          ...kid,
          xp: kid.xp - item.cost,
          dailyJar: [...kid.dailyJar, item.name],
        },
      };
    });
  };

  /* ❤️ KINDNESS */
  const addKindness = (kidId: number, icon: string) => {
    setState((prev) => {
      const kid = prev[kidId];

      if (kid.kindnessJar.length >= 20) {
        return {
          ...prev,
          [kidId]: {
            ...kid,
            kindnessError: '🫙 Jar is full!',
          },
        };
      }

      engine.success();
      setTimeout(() => confetti(), 80);

      return {
        ...prev,
        [kidId]: {
          ...kid,
          kindnessJar: [...kid.kindnessJar, icon],
          kindnessError: null,
        },
      };
    });
  };

  /* ================= UI ================= */
  if (page === 'game') {
    return (
      <div style={container} onClick={() => sound.unlock()}>
        <h1>ToDo Game</h1>

        <select
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}
        >
          {timeSlots.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <button style={btn} onClick={() => setPage('kindness')}>
          ❤️ Kindness Page
        </button>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {[1, 2].map((kidId) => (
            <div key={kidId} style={card}>
              <h2 style={{ color: kidId === 1 ? '#ff4d6d' : '#3a86ff' }}>
                {kidId === 1 ? '👧 Lilibet' : '👦 Dhruv'}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {state[kidId].tasks
                  .filter((t) => visibleIds.includes(t.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => toggleTask(kidId, t.id)}
                      style={{
                        ...btn,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 12,
                        background: t.done ? '#b2f7ef' : '#ffe5ec',
                        fontSize: 16,
                        color: 'black',
                      }}
                    >
                      <span style={{ fontSize: 26, minWidth: 32 }}>
                        {t.icon}
                      </span>
                      <span style={{ flex: 1 }}>{t.text}</span>
                    </button>
                  ))}
              </div>

              <h3>🎁 Rewards</h3>
              {rewards.map((r) => (
                <button
                  key={r.name}
                  onClick={() => buyReward(kidId, r)}
                  style={{ ...btn, background: '#ff6ec7', color: 'white' }}
                >
                  {r.name} ({r.cost})
                </button>
              ))}

              <h4>🧺 Reward Basket</h4>
              {state[kidId].dailyJar.map((item, idx) => (
                <div
                  key={idx}
                  style={{ padding: 6, margin: 4, background: '#fff0f6' }}
                >
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={container} onClick={() => sound.unlock()}>
      <h1>Kindness Page</h1>
      <button style={btn} onClick={() => setPage('game')}>
        Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
        {[1, 2].map((kidId) => (
          <div key={kidId} style={card}>
            <h2>{kidId === 1 ? '👧' : '👦'}</h2>

            <button style={btn} onClick={() => addKindness(kidId, '❤️')}>
              ❤️ Add
            </button>

            <div style={jar}>
              {state[kidId].kindnessJar.map((i, idx) => {
                const col = idx % JAR_COLS;
                const row = Math.floor(idx / JAR_COLS);

                return (
                  <span
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: 20 + col * CELL,
                      bottom: 20 + row * CELL,
                      fontSize: 22,
                    }}
                  >
                    {i}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 🎨 STYLES */
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

const jar: React.CSSProperties = {
  height: 280,
  width: 180,
  border: '3px solid #555',
  borderRadius: 50,
  position: 'relative',
  overflow: 'hidden',
  background: '#fff',
  marginTop: 10,
};
