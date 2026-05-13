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
  | 'jeep'
  | 'jarFill';

const SOUND_SRC: Record<SoundKey, string> = {
  click: '/sounds/click.mp3',
  car: '/sounds/speeding-swoosh.wav',
  success: '/sounds/clap.wav',
  reward: '/sounds/huge-crowd-cheering-victory.wav',
  jarOpen: '/sounds/long-pop.wav',
  jeep: '/sounds/engine-motor-hum.wav',
  jarFill: '/sounds/jar-fill.mp3',
};

const createSoundManager = () => {
  let unlocked = false;

  const audioMap: Record<SoundKey, HTMLAudioElement> = {} as any;

  Object.keys(SOUND_SRC).forEach((key) => {
    const k = key as SoundKey;
    const audio = new Audio(SOUND_SRC[k]);
    audio.preload = 'auto';
    audio.volume = 1;
    audioMap[k] = audio;
  });

  const unlock = () => {
    if (unlocked) return;

    Object.values(audioMap).forEach(a => {
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
      }).catch(() => { });
    });

    unlocked = true;
  };

  const play = (k: SoundKey) => {
    if (!unlocked) return;

    const audio = audioMap[k];
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => { });
  };

  return { play, unlock };
};

const createSoundEngine = (s: any) => ({
  click: () => s.play('click'),
  success: () => s.play('success'),
  reward: () => s.play('reward'),
  car: () => s.play('car'),
  jarFill: () => s.play('jarFill'),
  jeep: () => s.play('jeep'),
  jarOpen: () => s.play('jarOpen'),
});


/* TIME */
const timeSlots = ['morning', 'afternoon', 'evening'] as const;
type TimeSlot = typeof timeSlots[number];

const ROUTINE: Record<TimeSlot, string[]> = {
  morning: ['MORN'],
  afternoon: ['AFT'],
  evening: ['EVE'],
  //night: ['MORN', 'AFT', 'EVE'],
};

/* ICON */
const getTaskIcon = (title: string) => {
  const t = title.toLowerCase();

  // MORNING
  if (t.includes('good morning')) return '🌞';
  if (t.includes('morning hug')) return '🤗';
  if (t.includes('breakfast')) return '🍳';
  if (t.includes('school')) return '🎒';

  // FOOD
  if (t.includes('lunch')) return '🍱';
  if (t.includes('dinner')) return '🍛';
  if (t.includes('drink water')) return '💧';

  // HYGIENE
  if (t.includes('brush')) return '🪥';
  if (t.includes('face wash')) return '🫧';
  if (t.includes('bath')) return '🛁';
  if (t.includes('toilet')) return '🚽';
  if (t.includes('hand wash')) return '🧼';

  // PLAY / ACTIVITY
  if (t.includes('play')) return '⚽';
  if (t.includes('workout')) return '🏃';
  if (t.includes('thinking game')) return '🧠';
  if (t.includes('numbers')) return '🔢';
  if (t.includes('drawing')) return '🎨';

  // LEARNING
  if (t.includes('reading')) return '📖';
  if (t.includes('story')) return '📚';

  // CLEANING
  if (t.includes('clean')) return '🧹';
  if (t.includes('tidy')) return '🧺';
  if (t.includes('make bed')) return '🛏️';

  // FAMILY / KINDNESS
  if (t.includes('greeting')) return '🤗';
  if (t.includes('chatty')) return '💬';

  // NIGHT
  if (t.includes('night')) return '🌙';
  if (t.includes('sleep')) return '😴';
  
    // NIGHT
    if (t.includes('phone')) return '📱';
    if (t.includes('sleep')) return '🌞';
  // SPIRITUAL
  if (t.includes('pray')) return '🙏';

  return '🧩';
};

/* REWARDS */

const ROOM_SLOTS = 40;
const SECRET_CODE = 'superparent';

export default function App() {
  const sound = useRef(createSoundManager()).current;
  const engine = useRef(createSoundEngine(sound)).current;
  const [parentCode, setParentCode] = useState('');
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [wellBehavedUsed, setWellBehavedUsed] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState<'game' | 'kindness'>('game');
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('morning');
  const [stickers, setStickers] = useState<Record<string, boolean>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [state, setState] = useState<Record<string, any>>({});
  const [rewards, setRewards] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  /* ✅ KINDNESS (2 jars per kid) */
  const [kindnessJar, setKindnessJar] = useState<Record<string, string[]>>({});
  const [openJar, setOpenJar] = useState<string | null>(null);
  const signInWithGitHub = async () => {
    console.log("LOGIN CLICKED");
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setLoading(false);
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  /* ================= LOAD ================= */
  const loadData = async () => {
    const { data: usersData } = await supabase.from('users').select('*');
    const { data: tasksData } = await supabase.from('tasks').select('*');

    const today = new Date().toISOString().split('T')[0];

    const { data: allCompletions } = await supabase
      .from('task_completions')
      .select('*');

    const { data: todayCompletions } = await supabase
      .from('task_completions')
      .select('*')
      .eq('date', today);

    const { data: redeemed } = await supabase.from('reward_redemptions').select('*');
    const { data: rewardsData } = await supabase.from('rewards').select('*');

    setRewards(rewardsData || []);
    setUsers(usersData || []);

    const stickerState: any = {};

    (usersData || []).forEach(user => {
      const completed = hasCompletedAllTasksThisWeek(
        user.id,
        tasksData || [],
        allCompletions || []
      );

      stickerState[user.id] = completed;
    });

    setStickers(stickerState);

    const newState: any = {};
    const jarInit: any = {};

    (usersData || []).forEach(user => {
      jarInit[user.id] = user.emoji || [];

      const userRewards = redeemed?.filter(r => r.user_id === user.id) || [];
      const userCompletions = allCompletions?.filter(c => c.user_id === user.id) || [];
      const userTodayCompletions = todayCompletions?.filter(c => c.user_id === user.id) || [];

      const todayXP = userTodayCompletions.reduce(
        (sum, c) => sum + (c.points_earned || 0),
        0
      );

      const earnedPoints = userCompletions.reduce(
        (sum, c) => sum + (c.points_earned || 0),
        0
      );

      const spentPoints = userRewards.reduce(
        (sum, r) => sum + (r.points_spent || 0),
        0
      );

      newState[user.id] = {
        xp: user.totalpoints || 0,
        todayXP,
        tasks: (tasksData || []).map(t => ({
          id: t.id,
          icon: getTaskIcon(t.title),
          text: t.title,
          description: t.description || 'MORN',
          reward_point: t.reward_point || 10,
          done: userTodayCompletions.some(c => c.task_id === t.id),
        })),
        dailyJar: userRewards
          .map(r => rewardsData?.find(x => x.id === r.reward_id)?.title)
          .filter(Boolean),
      };
    });

    setState(newState);
    setKindnessJar(jarInit);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const preloadVideo = document.createElement('video');
  
    preloadVideo.src = '/videos/boy_dancing.mp4';
    preloadVideo.preload = 'auto';
    preloadVideo.muted = true;
  
    preloadVideo.load();
  }, []);

  useEffect(() => {
    const style = document.createElement('style');

    style.innerHTML = `
      @keyframes lidOpen {
        0% {
          transform: translateX(-50%) rotate(0deg) translateY(0px);
        }
        40% {
          transform: translateX(-50%) rotate(-18deg) translateY(-12px);
        }
        100% {
          transform: translateX(-50%) rotate(0deg) translateY(0px);
        }
      }
  
      @keyframes pop {
        0% {
          transform: scale(0.2);
          opacity: 0;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
      @keyframes fullDance {

        0% {
          transform:
            translateY(0px)
            rotate(-6deg)
            scale(1);
        }
      
        25% {
          transform:
            translateY(-20px)
            rotate(6deg)
            scale(1.05);
        }
      
        50% {
          transform:
            translateY(0px)
            rotate(-6deg)
            scale(1);
        }
      
        75% {
          transform:
            translateY(-15px)
            rotate(6deg)
            scale(1.05);
        }
      
        100% {
          transform:
            translateY(0px)
            rotate(-6deg)
            scale(1);
        }
      }
      
      @keyframes headMove {
      
        0% {
          transform: rotate(-8deg);
        }
      
        50% {
          transform: rotate(8deg);
        }
      
        100% {
          transform: rotate(-8deg);
        }
      }
      
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  /* ================= TASK ================= */
  const toggleTask = async (user: any, taskId: string) => {
    const task = state[user.id]?.tasks?.find((t: any) => t.id === taskId);
    if (!task) return;

    const isDone = task.done;
    const delta = isDone ? -task.reward_point : task.reward_point;

    // 1. update completion table first
    if (!isDone) {
      await supabase.from('task_completions').insert({
        user_id: user.id,
        task_id: taskId,
        points_earned: task.reward_point || 10,
        completed: true,
        date: new Date().toISOString().split('T')[0],
      });
    } else {
      await supabase
        .from('task_completions')
        .delete()
        .eq('user_id', user.id)
        .eq('task_id', taskId);
    }

    // 2. get fresh XP from DB FIRST (important fix)
    const { data: currentUser } = await supabase
      .from('users')
      .select('totalpoints')
      .eq('id', user.id)
      .single();

    const newXP = (currentUser?.totalpoints || 0) + delta;

    // 3. update DB
    await supabase
      .from('users')
      .update({ totalpoints: newXP })
      .eq('id', user.id);

    // 4. update UI safely
    setState(prev => {
      const updated = prev[user.id].tasks.map((t: any) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      );

      const todayXP = updated
        .filter((t: any) => t.done)
        .reduce((sum: number, t: any) => sum + (t.reward_point || 0), 0);

      return {
        ...prev,
        [user.id]: {
          ...prev[user.id],
          tasks: updated,
          todayXP,
        },
      };
    });
  };

  /* ================= REWARD ================= */
  const buyReward = async (user: any, item: any) => {
    sound.unlock();
    if (!item) return;

    if (item.title.toLowerCase().includes('car')) moveCar();
    if (item.title.toLowerCase().includes('jeep')) jeepRideEffect();
    if (item.title.toLowerCase().includes('trophy')) trophyDance();

    // 1. GET FRESH XP FROM DB (authoritative check)
    const { data: userData } = await supabase
      .from('users')
      .select('totalpoints')
      .eq('id', user.id)
      .single();

    const currentXP = userData?.totalpoints || 0;

    if (currentXP < item.points_required) return;

    confetti();

    // 2. optimistic UI update (NO XP HERE)
    setState(prev => ({
      ...prev,
      [user.id]: {
        ...prev[user.id],
        dailyJar: [...prev[user.id].dailyJar, item.title],
      },
    }));

    // 3. insert redemption
    await supabase.from('reward_redemptions').insert({
      user_id: user.id,
      reward_id: item.id,
      points_spent: item.points_required,
    });

    // 4. update DB (source of truth)
    await supabase
      .from('users')
      .update({
        totalpoints: currentXP - item.points_required,
      })
      .eq('id', user.id);

    // OPTIONAL: refresh state if you want perfect sync
    // update users (this fixes XP display)
    setUsers(prev =>
      prev.map(u =>
        u.id === user.id
          ? {
              ...u,
              totalpoints: u.totalpoints - item.points_required,
            }
          : u
      )
    );
  };
  /*-----------Reward <room----></room----*/
  const getRoomColor = (gender: string) => {
    if (gender === 'girl') {
      return {
        background: 'linear-gradient(180deg, #ffe0f0, #ffd6ec)',
        border: '2px solid #ff6bcb',
      };
    }

    return {
      background: 'linear-gradient(180deg, #d6ecff, #b3d9ff)',
      border: '2px solid #4dabf7',
    };
  };
  const getRewardIcon = (title: string) => {
    const t = title.toLowerCase();

    if (t.includes('car')) return '🚗';
    if (t.includes('jeep')) return '🚙';
    if (t.includes('trophy')) return '🏆';

    return '🎁'; // default
  };
  const roomStyle = (gender: string): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 10,

    width: '100%',
    maxWidth: 360,
    margin: '0 auto',

    padding: 12,
    borderRadius: 16,

    alignContent: 'start',   // 👈 IMPORTANT (keeps items at top)
    justifyItems: 'center',

    minHeight: 220,
    boxSizing: 'border-box',
  });

  /* ================= KINDNESS ADD ================= */
  const addKindness = async (userId: string, emoji: string) => {
    sound.unlock();

    // OPEN JAR
    setOpenJar(userId);

    // SOUND
    engine.jarOpen();

    // CURRENT VALUES
    const currentJar = kindnessJar[userId] || [];

    // NEW VALUES
    const updatedJar = [...currentJar, emoji];

    setTimeout(async () => {

      // UI UPDATE
      setKindnessJar(prev => ({
        ...prev,
        [userId]: updatedJar,
      }));

      // SAVE TO DB
      await supabase
        .from('users')
        .update({
          emoji: updatedJar,
        })
        .eq('id', userId);

      // SOUND
      engine.reward();

      // CONFETTI
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
      });

      // BALLOONS
      balloonEffect();

    }, 350);

    // CLOSE JAR
    setTimeout(() => {
      //engine.reward();
      setOpenJar(null);
      balloonEffect();
    }, 1400);
  };

  /*Sticker Helper*/
  const hasCompletedAllTasksThisWeek = (userId: string, tasks: any[], completions: any[]) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6);

    const weekCompletions = completions.filter(c => {
      const date = new Date(c.created_at || c.date);
      return c.user_id === userId && date >= startOfWeek;
    });

    const taskIds = tasks.map(t => t.id);

    // check if every task was completed at least once this week
    return taskIds.every(taskId =>
      weekCompletions.some(c => c.task_id === taskId)
    );
  };

  const unlockParentMode = () => {
    if (parentCode.toLowerCase() === SECRET_CODE) {
      setParentUnlocked(true);
    } else {
      alert('Wrong secret code');
    }
  };

  //Dancing avatar
  const playDanceVideo = async (gender: string = 'boy') => {
    // REMOVE OLD OVERLAY IF EXISTS
    const existing = document.getElementById('dance-overlay');
    if (existing) existing.remove();
  
    // OVERLAY
    const overlay = document.createElement('div');
    overlay.id = 'dance-overlay';
  
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.75)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';
  
    // VIDEO
    const video = document.createElement('video');
  
    video.src =
      gender === 'girl'
        ? '/videos/girl_dancing.mp4'
        : '/videos/boy_dancing.mp4';
  
    // IMPORTANT FIXES
    video.preload = 'auto';
    video.muted = true;
    video.autoplay = false;
    video.playsInline = true;
    video.controls = false;
  
    // FORCE iOS SAFARI
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
  
    video.style.width = '420px';
    video.style.maxWidth = '90vw';
    video.style.borderRadius = '24px';
    video.style.boxShadow = '0 0 40px rgba(255,255,255,0.5)';
  
    overlay.appendChild(video);
    document.body.appendChild(overlay);
  
    // FORCE LOAD
    video.load();
  
    // PLAY IMMEDIATELY
    try {
      await video.play();
  
      // OPTIONAL SOUND AFTER PLAY STARTS
      video.muted = false;
    } catch (err) {
      console.error('PLAY FAILED', err);
    }
  
    // EFFECTS
    confetti({
      particleCount: 250,
      spread: 120,
    });
  
    sound.play('reward');
  
    // REMOVE WHEN DONE
    video.onended = () => {
      overlay.remove();
    };
  
    // SAFETY REMOVE
    setTimeout(() => {
      overlay.remove();
    }, 8000);
  };

  const moveCar = () => {
    sound.unlock();
    sound.play('car');
    //playEngineSound();
    //engine.car();
    const el = document.createElement('div');
    el.innerHTML = '🚗💨';

    el.style.position = 'fixed';
    el.style.left = '-80px';
    el.style.top = '45%';
    el.style.fontSize = '50px';
    el.style.animation = 'kidDance 0.5s infinite';
    el.style.zIndex = '9999';
    el.style.transition = 'transform 3s linear';
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

  const jeepRideEffect = () => {
    const el = document.createElement('div');
    el.innerHTML = '🚙💨';

    el.style.position = 'fixed';
    el.style.left = '0px';
    el.style.top = '60%';
    el.style.fontSize = '60px';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
    el.style.transform = 'scaleX(-1)';

    document.body.appendChild(el);

    const duration = 9000;
    const start = performance.now();
    const screenWidth = window.innerWidth;

    // ✅ proper scoped audio
    const jeepAudio = new Audio('/sounds/engine-motor-hum.wav');
    jeepAudio.loop = true;
    jeepAudio.volume = 0.4;

    jeepAudio.play().catch(() => { });

    let stopped = false;

    const stopAll = () => {
      if (stopped) return;
      stopped = true;

      // stop sound
      jeepAudio.pause();
      jeepAudio.currentTime = 0;

      // remove element
      el.remove();
    };

    const animate = (time: number) => {
      if (stopped) return;

      const t = time - start;
      const progress = t / duration;

      // ✅ stop condition
      if (progress >= 1) {
        stopAll();
        return;
      }

      const x = progress * (screenWidth + 200);
      const bounce = Math.sin(t / 90) * 22;
      const tilt = Math.sin(t / 140) * 3;

      el.style.transform = `
        translateX(${x}px)
        translateY(${bounce}px)
        rotate(${tilt}deg)
        scaleX(-1)
      `;

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    // safety fallback
    setTimeout(stopAll, duration + 200);
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
    //sound.unlock();

    let played = false;

    const playSound = () => {
      if (played) return;
      played = true;
      sound.play('reward');
    };

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
      setTimeout(playSound, 120);
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

  if (loading) {
    return (
      <div style={container}>
        <h1>Loading...</h1>
      </div>
    );
  }
  if (!session) {
    return (
      <div style={container}>
        <div style={{ textAlign: 'center', marginTop: 100 }}>
          <h1>Kids Todo Game</h1>

          <button style={btn} onClick={signInWithGitHub}>
            Login with GitHub
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={container}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              placeholder="Parent Secret"
              value={parentCode}
              onChange={(e) => setParentCode(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: '1px solid #ccc',
                marginRight: 10,
              }}
            />

            <button style={btn} onClick={unlockParentMode}>
              Unlock Parent Mode
            </button>
          </div>
          <span>{session.user?.email}</span>

          <button style={btn} onClick={signOut}>
            Logout
          </button>
        </div>
      </div>
      {/* ================= GAME ================= */}
      {page === 'game' && (<>
        <h3>ToDo Game</h3>

        <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}>
          {timeSlots.map(t => <option key={t}>{t}</option>)}
        </select>
        <button style={btn} onClick={() =>
          setPage(prev => (prev === 'game' ? 'kindness' : 'game'))
        }>
          ❤️ Kindness Page
        </button>
        <div style={{ display: 'flex', gap: 20 }}>
          {users.map(u => (
            <div key={u.id} style={card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                {/* LEFT (empty spacer for balance) */}
                <div style={{ width: 80 }} />

                {/* CENTER NAME */}
                <h2
                  style={{
                    background: u.gender === 'girl' ? '#ff6bcb' : '#4dabf7',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    margin: 0,
                    textAlign: 'center',
                  }}
                >
                  {u.name}
                </h2>

                {/* RIGHT STATS */}
                <div
                  style={{
                    fontSize: 12,
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.85)',
                    border: '1px solid #444',
                    textAlign: 'left',
                    minWidth: 80,
                  }}
                >
                  <div>⭐ Total: {u.totalpoints || 0}</div>
                  <div>🔥 Today: {state[u.id]?.todayXP || 0}</div>
                  <div> <button
                    disabled={!parentUnlocked || wellBehavedUsed[u.id]}
                    onClick={() => {
                      playDanceVideo(u.gender);

                      setWellBehavedUsed(prev => ({
                        ...prev,
                        [u.id]: true,
                      }));
                    }}
                    style={{
                      ...btn,
                      background:
                        !parentUnlocked || wellBehavedUsed[u.id]
                          ? '#ccc'
                          : '#51cf66',

                      color: 'white',
                      fontWeight: 'bold',

                      cursor:
                        !parentUnlocked || wellBehavedUsed[u.id]
                          ? 'not-allowed'
                          : 'pointer',

                      opacity:
                        !parentUnlocked || wellBehavedUsed[u.id]
                          ? 0.6
                          : 1,
                    }}
                  >
                    {wellBehavedUsed[u.id]
                      ? '✅ Reward Given'
                      : '⭐ Well Behaved'}
                  </button></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(state[u.id]?.tasks || [])
                  .filter((t: any) => visibleCategories.includes(t.description))
                  .map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (!t.done) {
                          confetti();
                          sound.unlock();
                          engine.click();
                        }

                        toggleTask(u, t.id)
                      }}
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

              <h3 style={{ textAlign: 'center' }}>🎁 Rewards</h3>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'nowrap',
                }}
              >
                {rewards.map((r: any, i: number) => (
                  <button
                    key={r.id}
                    disabled={(u.totalpoints || 0) < r.points_required}
                    onClick={() => buyReward(u, r)}
                    style={{
                      ...btn,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{getRewardIcon(r.title)}</span>
                    <span>{r.title.toUpperCase()}</span>
                    <span>({r.points_required})</span>

                    {i < rewards.length - 1 && (
                      <span style={{ marginLeft: 6, opacity: 0.6 }}>.</span>
                    )}
                  </button>
                ))}
              </div>
              <h4>🏡 My Room</h4>

              <div style={houseRoof} />

              <div
                style={{
                  ...roomStyle(u.gender),
                  ...getRoomColor(u.gender),
                }}
              >
                {(state[u.id]?.dailyJar || [])
                  .slice(0, ROOM_SLOTS)
                  .map((r: any, i: number) => (
                    <span key={i} style={{ fontSize: 28 }}>
                      {r.toLowerCase().includes('car') ? '🚗' :
                        r.toLowerCase().includes('jeep') ? '🚙' :
                          r.toLowerCase().includes('trophy') ? '🏆' : '🎁'}
                    </span>
                  ))}
              </div>

            </div>
          ))}
        </div>
      </>
      )}

      {/* ================= KINDNESS PAGE (2 JARS) ================= */}
      {page === 'kindness' &&
        (<>
          <button style={btn} onClick={() =>
            setPage(prev => (prev === 'game' ? 'kindness' : 'game'))
          }>
            ❤️ Kindness Jar
          </button>
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>

              {users.map(u => (
                <div key={u.id} style={{ textAlign: 'center' }}>

                  <h3>{u.name}</h3>

                  {/* ❤️ HEART JAR */}

                  <div style={jarStyle}>

                    {/* LID */}
                    <div
                      style={{
                        ...jarLid,
                        animation: openJar === u.id
                          ? 'lidOpen 1.1s ease'
                          : undefined,
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
                    <button disabled={!parentUnlocked} style={btn} onClick={() => addKindness(u.id, '💖')}>💖</button>
                    <button disabled={!parentUnlocked} style={btn} onClick={() => addKindness(u.id, '🤗')}>🤗</button>
                    <button disabled={!parentUnlocked} style={btn} onClick={() => addKindness(u.id, '🌟')}>🌟</button>
                    <button disabled={!parentUnlocked} style={btn} onClick={() => addKindness(u.id, '😊')}>😊</button>
                  </div>
                  <div style={{ marginTop: 20, textAlign: 'center' }}>

                    <h4>📘 Sticker Book</h4>

                    <div style={{
                      width: 120,
                      height: 80,
                      margin: '0 auto',
                      borderRadius: 10,
                      background: '#fff3cd',
                      border: '2px solid #f7c948',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 30
                    }}>
                      {stickers[u.id] ? '🎖️' : '🔒'}
                    </div>

                    <div style={{ fontSize: 12, marginTop: 5 }}>
                      {stickers[u.id] ? 'Weekly Reward Unlocked' : 'Complete all tasks this week'}
                    </div>

                  </div>


                </div>

              ))}

            </div>
          </div>
        </>


        )}
    </div>
  );
}

/* STYLES (UNCHANGED) */
const container: React.CSSProperties = {
  minHeight: '100%',
  width: '100%',
  padding: 15,
  //boxSizing: 'border-box', // 👈 VERY IMPORTANT

  overflowX: 'hidden',
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

const houseRoof: React.CSSProperties = {
  width: 0,
  height: 0,
  margin: '0 auto',

  // 👇 correct responsive trick
  borderLeft: '170px solid transparent',
  borderRight: '170px solid transparent',
  borderBottom: '90px solid #a0522d',

  position: 'relative',
  top: 0,
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

