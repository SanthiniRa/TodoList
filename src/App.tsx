import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient.tsx';

/* SOUND */
type SoundKey = 'click' | 'success' | 'reward';

const SOUND_SRC = {
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

  const unlock = () => {
    if (unlocked) return;
    Object.values(audioMap).forEach(a => {
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
      }).catch(() => {});
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
});

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

/* KID */
const createKid = () => ({
  xp: 0,
  tasks: [] as any[],
  dailyJar: [] as string[],
});

/* REWARDS UI */
const rewards = [
  { key: 'Car', title: '🏎️ Car', cost: 10 },
  { key: 'Jeep', title: '🚙 Jeep', cost: 20 },
  { key: 'Trophy', title: '🏆 Trophy', cost: 40 },
];

export default function App() {
  const sound = useRef(createSoundManager()).current;
  const engine = useRef(createSoundEngine(sound)).current;

  const [page, setPage] = useState<'game' | 'kindness'>('game');
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('morning');

  const [users, setUsers] = useState<any[]>([]);
  const [state, setState] = useState<Record<string, any>>({});

  /* ================= LOAD ================= */
  useEffect(() => {
    const load = async () => {
      const { data: usersData } = await supabase.from('users').select('*');
      const { data: tasksData } = await supabase.from('tasks').select('*');
      const { data: completions } = await supabase.from('task_completions').select('*');
      const { data: redeemed } = await supabase.from('reward_redemptions').select('*');
      const { data: rewardsData } = await supabase.from('rewards').select('*');

      setUsers(usersData || []);

      const newState: any = {};

      (usersData || []).forEach(user => {
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
    });
  };

  /* EFFECTS */
  const moveCar = () => {
    const el = document.createElement('div');
    el.innerHTML = '🚗';
    el.style.position = 'fixed';
    el.style.left = '-50px';
    el.style.top = '40%';
    el.style.fontSize = '40px';
    el.style.transition = 'transform 4s linear';
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translateX(120vw)';
    });

    setTimeout(() => document.body.removeChild(el), 4000);
  };

  const balloonEffect = () => {
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div');
      el.innerHTML = '🎈';
      el.style.position = 'fixed';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.bottom = '-50px';
      document.body.appendChild(el);

      requestAnimationFrame(() => {
        el.style.transform = 'translateY(-120vh)';
      });

      setTimeout(() => document.body.removeChild(el), 3000);
    }
  };

  const trophyDance = () => {
    const el = document.createElement('div');
    el.innerHTML = '🏆';
    el.style.position = 'fixed';
    el.style.top = '40%';
    el.style.left = '50%';
    el.style.fontSize = '120px';
    document.body.appendChild(el);

    setTimeout(() => document.body.removeChild(el), 1200);
  };

  const visibleCategories = ROUTINE[timeSlot];

  return (
    <div style={container} onClick={() => sound.unlock()}>
      <h1>ToDo Game</h1>

      <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}>
        {timeSlots.map(t => <option key={t}>{t}</option>)}
      </select>

      <button style={btn} onClick={() => setPage(page === 'game' ? 'kindness' : 'game')}>
        ❤️ Kindness Page
      </button>

      {page === 'game' && (
        <div style={{ display: 'flex', gap: 20 }}>
          {users.map(u => (
            <div key={u.id} style={card}>
              <h2>{u.name}</h2>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(state[u.id]?.tasks || [])
                  .filter((t: any) => visibleCategories.includes(t.description))
                  .map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => toggleTask(u, t.id)}
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

              <h4>🧺 Reward Basket</h4>
              {(state[u.id]?.dailyJar || []).map((r: string, i: number) => (
                <div key={i}>{r}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {page === 'kindness' && (
        <div style={{ padding: 20 }}>
          <h2>Kindness Page</h2>
        </div>
      )}
    </div>
  );
}

/* STYLES */
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