/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Droplets, 
  Leaf, 
  Bug, 
  Timer as TimerIcon, 
  Trophy,
  Plus,
  X,
  Play,
  Square,
  ChevronRight,
  Flower2,
  Sprout,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { GrowthStage, type Plant, type UserStats } from './types.ts';
import { PLANT_TYPES, GROWTH_THRESHOLDS, STAGE_NAMES } from './constants.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
    <motion.div 
      className="h-full"
      style={{ backgroundColor: color }}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
    />
  </div>
);

export default function App() {
  // Persistence
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('zengarden_stats_v2'); // New key for reset
    return saved ? JSON.parse(saved) : {
      waterDrops: 10, // Starting amount for onboarding
      totalFocusMinutes: 0
    };
  });

  const [plants, setPlants] = useState<Plant[]>(() => {
    const saved = localStorage.getItem('zengarden_plants_v2'); // New key for reset
    if (saved) return JSON.parse(saved);
    const type = PLANT_TYPES.find(t => t.id === 'succulent');
    return [{
      id: 'initial-succulent',
      type: 'succulent',
      name: '小多肉',
      stage: GrowthStage.SEED,
      sunlightNeeded: type?.baseSunlight || 50,
      sunlightCollected: 0,
      waterLevel: 100,
      plantedAt: Date.now()
    }];
  });

  const [activePlantId, setActivePlantId] = useState<string | null>(() => {
    const saved = localStorage.getItem('zengarden_active_id_v2'); // New key for reset
    return saved || 'initial-succulent';
  });

  const [isFocusing, setIsFocusing] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');

  // Focus Timer Logic
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showFailureModal, setShowFailureModal] = useState(false);

  // Update timeLeft when selectedMinutes changes (if not focusing)
  useEffect(() => {
    if (!isFocusing) {
      setTimeLeft(selectedMinutes * 60);
    }
  }, [selectedMinutes, isFocusing]);

  // Handle page visibility change (leaving the app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isFocusing) {
        // User left the app during focus!
        setIsFocusing(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(25 * 60);
        setShowFailureModal(true);
        
        // Small penalty: reduce plant health/water if active
        if (activePlantId) {
          setPlants(prev => prev.map(p => {
            if (p.id === activePlantId) {
              return { ...p, waterLevel: Math.max(0, p.waterLevel - 20) };
            }
            return p;
          }));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isFocusing, activePlantId]);

  useEffect(() => {
    if (isFocusing && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      handleFocusComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isFocusing, timeLeft, plants]);

  useEffect(() => {
    localStorage.setItem('zengarden_stats_v2', JSON.stringify(stats));
    localStorage.setItem('zengarden_plants_v2', JSON.stringify(plants));
    if (activePlantId) localStorage.setItem('zengarden_active_id_v2', activePlantId);
  }, [stats, plants, activePlantId]);

  const handleFocusComplete = () => {
    setIsFocusing(false);
    const minutesFocused = selectedMinutes; 
    const earnedDrops = Math.ceil(minutesFocused / 2);
    
    setStats(prev => ({
      ...prev,
      waterDrops: prev.waterDrops + earnedDrops,
      totalFocusMinutes: prev.totalFocusMinutes + minutesFocused
    }));

    setTimeLeft(selectedMinutes * 60);
  };

  const addPlant = (typeId: string, cost: number) => {
    const type = PLANT_TYPES.find(t => t.id === typeId);
    if (!type || stats.waterDrops < cost) return;

    const newPlant: Plant = {
      id: Math.random().toString(36).substr(2, 9),
      type: typeId,
      name: newPlantName.trim() || `${type.name}#${plants.length + 1}`,
      stage: GrowthStage.SEED,
      sunlightNeeded: type.baseSunlight,
      sunlightCollected: 0,
      waterLevel: 100,
      plantedAt: Date.now()
    };

    setPlants(prev => [...prev, newPlant]);
    setActivePlantId(newPlant.id);
    setStats(prev => ({ ...prev, waterDrops: prev.waterDrops - cost }));
    setShowSeedPicker(false);
    setNewPlantName('');
  };

  const careForPlant = (id: string, action: 'water') => {
    if (action === 'water' && stats.waterDrops <= 0) return;

    setPlants(prev => prev.map(p => {
      if (p.id === id) {
        let newSunlight = p.sunlightCollected;
        
        if (action === 'water') {
          newSunlight += 10;
        }

        let newStage = p.stage;
        if (newSunlight >= p.sunlightNeeded * GROWTH_THRESHOLDS[GrowthStage.BLOOM]) newStage = GrowthStage.BLOOM;
        else if (newSunlight >= p.sunlightNeeded * GROWTH_THRESHOLDS[GrowthStage.GROWING]) newStage = GrowthStage.GROWING;
        else if (newSunlight >= p.sunlightNeeded * GROWTH_THRESHOLDS[GrowthStage.SPROUT]) newStage = GrowthStage.SPROUT;

        return { ...p, sunlightCollected: newSunlight, stage: newStage };
      }
      return p;
    }));

    if (action === 'water') {
      setStats(prev => ({
        ...prev,
        waterDrops: prev.waterDrops - 1
      }));
    }
  };

  const startFocus = () => {
    setIsFocusing(true);
  };

  const handleGiveUp = () => {
    setIsFocusing(false);
    setTimeLeft(selectedMinutes * 60);
  };

  const activePlant = useMemo(() => plants.find(p => p.id === activePlantId) || plants[0], [plants, activePlantId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#F9FBF9] text-green-900 font-sans selection:bg-green-100 selection:text-green-900 overflow-hidden relative">
      {/* 沉浸式自然背景层 / Layered Nature Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Rich Layered Greenery */}
        <div className="absolute top-[-5%] left-[-5%] w-[80%] h-[70%] bg-emerald-50/40 blur-[130px] rounded-full" />
        <div className="absolute bottom-[0%] right-[-10%] w-[60%] h-[60%] bg-green-100/30 blur-[150px] rounded-full" />
        <div className="absolute top-[20%] right-[-5%] w-[40%] h-[40%] bg-teal-50/40 blur-[100px] rounded-full" />
        
        {/* Subtle Depth Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-green-50/20" />
        
        {/* Floating Spores/Dust */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -120, 0],
              x: [0, Math.sin(i) * 30, 0],
              opacity: [0, 0.3, 0],
              scale: [0.8, 1, 0.8]
            }}
            transition={{
              duration: 12 + i * 1.5,
              repeat: Infinity,
              delay: i * 1.2,
              ease: "easeInOut"
            }}
            className="absolute w-1 h-1 bg-green-200/40 rounded-full blur-[0.5px]"
            style={{
              left: `${10 + i * 8}%`,
              top: `${15 + i * 7}%`,
            }}
          />
        ))}

        {/* Natural Fiber Texture */}
        <div className="absolute inset-0 opacity-[0.04]" 
             style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/natural-paper.png")` }} />

        {/* Shadow Leaves for Depth */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            animate={{ rotate: [2, 6, 2], y: [0, 10, 0], x: [0, 5, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 -right-20 opacity-[0.06] drop-shadow-2xl"
          >
            <Leaf className="w-[450px] h-[450px] text-emerald-900 fill-current" />
          </motion.div>
          <motion.div 
            animate={{ rotate: [-1, -4, -1], y: [0, -15, 0], x: [0, -8, 0] }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            className="absolute -bottom-24 -left-24 opacity-[0.05] drop-shadow-2xl"
          >
            <Leaf className="w-[550px] h-[550px] text-green-950 fill-current" />
          </motion.div>
        </div>
      </div>

      <main className="max-w-md mx-auto flex flex-col p-6 relative z-10 min-h-screen">
        {/* Compact Stats Info */}
        {!isFocusing && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-center mb-6"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-sm shadow-green-200">
                <Sprout className="w-5 h-5" />
              </div>
              <span className="font-display font-black text-green-900 tracking-tight">萌芽森林</span>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/60 backdrop-blur-md rounded-full text-[10px] font-black border border-blue-100 shadow-sm text-blue-600">
                <Droplets className="w-3.5 h-3.5 fill-current" />
                {stats.waterDrops}
              </div>
              <button 
                onClick={() => setShowInventory(true)}
                className="w-8 h-8 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center border border-stone-100 shadow-sm active:scale-90"
              >
                <Trophy className="w-4 h-4 text-amber-500" />
              </button>
            </div>
          </motion.div>
        )}
        {/* Timer Section - THE CORE HERO */}
        <section className="flex flex-col items-center justify-center pt-12 pb-8 z-20">
          {!isFocusing && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 mb-6"
            >
              <div className="flex gap-2 p-1 bg-green-50/50 rounded-2xl border border-green-100 shadow-sm">
                {[10, 25, 45, 60].map(m => (
                  <button 
                    key={m}
                    onClick={() => setSelectedMinutes(m)}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-black transition-all",
                      selectedMinutes === m ? "bg-green-600 text-white shadow-md scale-105" : "text-green-800/40 hover:bg-white/60"
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest flex items-center gap-1.5">
                <Droplets className="w-3 h-3" />
                专注可得 {Math.ceil(selectedMinutes / 2)} 滴成长水滴
              </p>
            </motion.div>
          )}
          
          <div className="relative text-center">
            <motion.div 
              layout
              className={cn(
                "font-display text-[100px] font-black tracking-tighter leading-none transition-colors duration-500",
                isFocusing ? "text-green-600" : "text-green-900/80"
              )}
            >
              {formatTime(timeLeft)}
            </motion.div>

            <AnimatePresence>
              {!isFocusing ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex justify-center mt-2"
                >
                  <button
                    onClick={startFocus}
                    className="group relative flex items-center gap-3 px-8 py-3 bg-green-600 text-white rounded-2xl font-black text-sm tracking-[0.2em] shadow-lg shadow-green-200/50 hover:bg-green-700 transition-all active:scale-95"
                  >
                    <span>开启专注</span>
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center mt-2"
                >
                  <p className="text-[10px] font-black tracking-[0.5em] uppercase text-green-600/60 transition-all mb-4">
                    专注于此 · 静候成长
                  </p>
                  <div className="flex gap-4 mt-2">
                    <button
                      onClick={handleGiveUp}
                      className="px-8 py-3 bg-stone-100/50 border border-stone-200 text-stone-400 hover:text-green-600 hover:bg-green-50 hover:border-green-100 transition-all active:scale-95 font-black text-xs tracking-widest uppercase opacity-40 hover:opacity-100 rounded-2xl"
                    >
                      停止专注
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Garden Section - Now acting as a soft container for the plant below the timer */}
        <section className="relative flex-1 flex flex-col items-center justify-center overflow-visible">
          <AnimatePresence mode="wait">
            {activePlant ? (
              <motion.div 
                key={activePlant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center w-full relative"
              >
                {/* Navigation Arrows for switching plants */}
                {plants.length > 1 && !isFocusing && (
                  <div className="absolute inset-x-[-10px] top-1/2 -translate-y-1/2 flex justify-between z-30">
                    <button 
                      onClick={(e) => { e.stopPropagation(); const idx = plants.findIndex(p => p.id === activePlant.id); const nextIdx = (idx - 1 + plants.length) % plants.length; setActivePlantId(plants[nextIdx].id); }}
                      className="w-12 h-12 bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-sm border border-white text-green-800/40 hover:text-green-800 transition-all active:scale-75"
                    >
                      <ChevronRight className="w-8 h-8 rotate-180" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); const idx = plants.findIndex(p => p.id === activePlant.id); const nextIdx = (idx + 1) % plants.length; setActivePlantId(plants[nextIdx].id); }}
                      className="w-12 h-12 bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-sm border border-white text-green-800/40 hover:text-green-800 transition-all active:scale-75"
                    >
                      <ChevronRight className="w-8 h-8" />
                    </button>
                  </div>
                )}

                <PlantVisual stage={activePlant.stage} type={activePlant.type} isFocusing={isFocusing} />
                
                <div className="mt-8 text-center bg-white/40 backdrop-blur-sm px-6 py-3 rounded-3xl border border-white shadow-sm">
                  <h2 className="font-display text-2xl font-black text-green-900/80 mb-1 leading-tight">
                    {activePlant.name}
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">{STAGE_NAMES[activePlant.stage]}</span>
                    <div className="w-1 h-1 bg-stone-300 rounded-full" />
                    <span className="text-[10px] font-black text-stone-400 font-mono tracking-tighter">成长值 {Math.min(100, Math.floor(activePlant.sunlightCollected / activePlant.sunlightNeeded * 100))}%</span>
                  </div>
                </div>

                {/* Watering Controls */}
                {!isFocusing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex flex-col items-center gap-4"
                  >
                    <div className="flex gap-4">
                      <button 
                        onClick={() => careForPlant(activePlant.id, 'water')}
                        disabled={stats.waterDrops <= 0}
                        className={cn(
                          "group flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-md active:scale-95",
                          stats.waterDrops > 0 
                            ? "bg-blue-500 text-white shadow-blue-200" 
                            : "bg-stone-100 text-stone-300 grayscale"
                        )}
                      >
                        <Droplets className={cn("w-5 h-5", stats.waterDrops > 0 && "animate-bounce")} />
                        <span>浇水成长 ({stats.waterDrops})</span>
                      </button>
                    </div>
                    
                    <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">
                      消耗水滴可加速成长
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.button 
                onClick={() => { setSelectedTypeId(null); setShowSeedPicker(true); }}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="w-24 h-24 bg-white shadow-xl rounded-[40px] flex items-center justify-center border-4 border-stone-50">
                  <Plus className="w-10 h-10 text-stone-200" />
                </div>
                <span className="font-display text-xl font-bold text-stone-300">播种新芽</span>
              </motion.button>
            )}
          </AnimatePresence>
        </section>

        <footer className="z-30 pb-10 flex flex-col gap-6">
          {!isFocusing && (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setShowInventory(true)}
                className="py-4 bg-white/60 backdrop-blur-md rounded-3xl text-[10px] font-black tracking-widest text-green-900/60 uppercase border border-white shadow-sm flex items-center justify-center gap-2 active:scale-95"
              >
                <Leaf className="w-4 h-4 opacity-40" /> 森林仓库
              </button>
              <button 
                onClick={() => { setSelectedTypeId(null); setShowSeedPicker(true); }}
                className="py-4 bg-white/60 backdrop-blur-md rounded-3xl text-[10px] font-black tracking-widest text-green-900/60 uppercase border border-white shadow-sm flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus className="w-4 h-4 opacity-40" /> 领养伙伴
              </button>
            </div>
          )}
        </footer>

        {/* Ambient Glow */}
        <div className="fixed inset-0 pointer-events-none z-[5]">
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-green-100/30 blur-[120px] rounded-full" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-100/20 blur-[120px] rounded-full" />
        </div>
      </main>


      {/* Failure Notification */}
      <AnimatePresence>
        {showFailureModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-rose-900/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative bg-white rounded-[40px] p-8 text-center shadow-2xl border-4 border-rose-100"
            >
              <div className="text-5xl mb-4">💨</div>
              <h3 className="font-display text-2xl font-black text-rose-600 mb-2">专注被中断了</h3>
              <p className="text-sm text-stone-500 mb-6 leading-relaxed">
                刚才你离开了小花园...<br/>植物因为缺少主人的陪伴感到有些委靡。
              </p>
              <button 
                onClick={() => setShowFailureModal(false)}
                className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-colors"
              >
                我知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seed Picker Modal */}
      <AnimatePresence>
        {showSeedPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSeedPicker(false)}
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[60px] p-10 shadow-2xl overflow-hidden border-8 border-[#FFF9F6]"
            >
              <div className="text-center mb-6">
                 <div className="w-20 h-20 bg-[#FFF5EE] rounded-[40px] flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner">🧸</div>
                 <h3 className="font-display text-3xl font-black text-[#5D4037]">领养新伙伴</h3>
                 <p className="text-sm text-[#A08470] mt-2 font-medium">使用水滴领养你喜欢的种子吧</p>
              </div>

              <div className="mb-6 px-2">
                <label className="block text-[10px] font-black text-[#5D4037]/40 uppercase tracking-widest mb-2 ml-1">
                  赋予它一个名字 (限5字)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newPlantName}
                    onChange={(e) => setNewPlantName(e.target.value.slice(0, 5))}
                    placeholder="不输入则使用默认名称"
                    className="w-full px-5 py-4 bg-[#FFF9F6] border-2 border-transparent focus:border-[#FFCCDC] focus:bg-white rounded-2xl outline-none transition-all text-[#5D4037] font-bold placeholder:text-[#A08470]/30 shadow-inner"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#5D4037]/20">
                    {newPlantName.length}/5
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar mb-6">
                {PLANT_TYPES.map(type => {
                  const cost = type.baseSunlight;
                  const canAfford = stats.waterDrops >= cost;
                  const isSelected = selectedTypeId === type.id;
                  
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedTypeId(type.id)}
                      disabled={!canAfford}
                      className={cn(
                        "w-full p-5 bg-[#FFF9F6] rounded-3xl flex items-center gap-4 transition-all group active:scale-[0.98] border-2",
                        isSelected ? "border-[#FFCCDC] bg-white shadow-md scale-[1.02]" : "border-transparent",
                        !canAfford && "opacity-50 grayscale cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm border transition-transform group-hover:scale-110",
                        isSelected ? "border-[#FFCCDC]" : "border-pink-50"
                      )}>
                        {type.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="block font-bold text-lg text-[#5D4037]">{type.name}</span>
                        <div className="flex items-center gap-1 opacity-60">
                           <Droplets className="w-3 h-3 text-blue-400 fill-current" />
                           <span className="text-[10px] font-black">{cost} 水滴</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => selectedTypeId && addPlant(selectedTypeId, PLANT_TYPES.find(t => t.id === selectedTypeId)?.baseSunlight || 0)}
                disabled={!selectedTypeId}
                className={cn(
                  "w-full py-5 rounded-[30px] font-black text-lg transition-all shadow-lg active:scale-95",
                  selectedTypeId 
                    ? "bg-[#FFCCDC] text-[#5D4037] hover:bg-[#ffb6cc] shadow-[#FFCCDC]/20" 
                    : "bg-stone-100 text-stone-300 cursor-not-allowed"
                )}
              >
                {selectedTypeId ? '确认领养' : '请先选择一个种子'}
              </button>
            </motion.div>
          </div>
        )}

        {showInventory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInventory(false)}
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[60px] p-10 shadow-2xl overflow-hidden border-8 border-[#F5FBF0]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-display text-3xl font-black text-[#5D4037]">我的小花园</h3>
                <button 
                  onClick={() => setShowInventory(false)}
                  className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {plants.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setActivePlantId(p.id); setShowInventory(false); }}
                    className={cn(
                      "w-full p-5 rounded-[36px] flex items-center gap-5 transition-all active:scale-[0.98] relative overflow-hidden group",
                      activePlantId === p.id 
                        ? "bg-green-500/10 border-2 border-green-500/30" 
                        : "bg-white border border-stone-100 hover:border-green-200"
                    )}
                  >
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-stone-50">
                       <PlantVisual stage={p.stage} type={p.type} mini />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-lg text-green-900">{p.name}</p>
                      <p className="text-[10px] font-black text-green-700 tracking-widest uppercase">
                        {STAGE_NAMES[p.stage]} · {Math.floor(p.sunlightCollected / p.sunlightNeeded * 100)}% 茁壮
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-green-200 group-hover:text-green-500 transition-colors" />
                  </button>
                ))}

                <button 
                  onClick={() => { setShowInventory(false); setSelectedTypeId(null); setShowSeedPicker(true); }}
                  className="w-full p-6 border-2 border-dashed border-green-500/20 rounded-[36px] flex flex-col items-center justify-center gap-2 text-green-800/40 hover:bg-green-500/5 transition-colors active:scale-95"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-[10px] font-black uppercase tracking-widest">领养新伙伴</span>
                </button>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                 <div className="p-5 bg-[#F5FBF0] rounded-[30px] border-2 border-[#E7F3DE]">
                    <span className="text-[10px] font-black text-green-700/40 uppercase tracking-widest block mb-2">专注总时</span>
                    <p className="font-display text-2xl font-black text-green-700">{stats.totalFocusMinutes} <span className="text-xs">min</span></p>
                 </div>
                 <div className="p-5 bg-[#FFF9F6] rounded-[30px] border-2 border-[#FFEFE2]">
                    <span className="text-[10px] font-black text-orange-700/40 uppercase tracking-widest block mb-2">拥有的水滴</span>
                    <p className="font-display text-2xl font-black text-orange-700">{stats.waterDrops} <span className="text-xs">滴</span></p>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #FFEFE2; border-radius: 20px; border: 2px solid white; }
      `}</style>
    </div>
  );
}

function ShortCare({ icon, amount, onClick, isDisabled, color }: { 
  icon: string; 
  amount: number; 
  onClick: () => void;
  isDisabled?: boolean;
  color: string;
}) {
  return (
    <button 
      onClick={onClick}
      disabled={isDisabled || amount <= 0}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-2xl transition-all active:scale-90",
        amount > 0 && !isDisabled 
          ? `${color} shadow-sm border border-black/5` 
          : "opacity-20 bg-stone-100"
      )}
    >
      <span className="text-xl mb-1">{icon}</span>
      <span className="text-[10px] font-black text-[#5D4037]">{amount}</span>
    </button>
  );
}

function PlantVisual({ stage, type, mini = false, isFocusing = false }: { 
  stage: GrowthStage; 
  type: string; 
  mini?: boolean; 
  isFocusing?: boolean;
}) {
  const currentType = PLANT_TYPES.find(t => t.id === type);
  const baseColor = currentType?.color || '#A5D6A7';
  const displayColor = isFocusing ? baseColor : mini ? baseColor : '#A8B391';

  // Helper for consistent cute faces
  const CuteFace = ({ scale = 0.8, mood = 'normal' }: { scale?: number, mood?: 'normal' | 'happy' }) => {
    if (mini) return null;
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30" style={{ transform: `scale(${scale}) translateY(10px)` }}>
        <div className="flex gap-4">
          <motion.div 
            animate={isFocusing ? { scaleY: [1, 0.1, 1] } : {}} 
            transition={{ repeat: Infinity, duration: 3, times: [0, 0.1, 0.2] }}
            className="w-1.5 h-1.5 bg-green-900/40 rounded-full" 
          />
          <motion.div 
            animate={isFocusing ? { scaleY: [1, 0.1, 1] } : {}} 
            transition={{ repeat: Infinity, duration: 3, times: [0, 0.1, 0.2], delay: 0.1 }}
            className="w-1.5 h-1.5 bg-green-900/40 rounded-full" 
          />
        </div>
        {mood === 'happy' || isFocusing ? (
          <div className="absolute top-[65%] w-3 h-1 border-b-2 border-green-900/40 rounded-full" />
        ) : (
          <div className="absolute top-[68%] w-1.5 h-0.5 bg-green-900/20 rounded-full" />
        )}
        <div className="absolute top-[60%] left-[-20%] w-3 h-2 bg-rose-400/20 rounded-full blur-[1px]" />
        <div className="absolute top-[60%] right-[-20%] w-3 h-2 bg-rose-400/20 rounded-full blur-[1px]" />
      </div>
    );
  };

  const renderPlant = () => {
    const commonProps = {
      animate: { 
        y: isFocusing ? [0, -4, 0] : 0,
        rotate: isFocusing ? [-1, 1, -1] : 0
      },
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    };

    // Stage 1: SEED
    if (stage === GrowthStage.SEED) {
      return (
        <motion.div {...commonProps} className={cn("bg-[#FFF9F5] rounded-[45%] shadow-inner flex items-center justify-center border-2 border-stone-200", mini ? "w-6 h-8" : "w-16 h-20")}>
          <div className="w-1/2 h-1/2 rounded-full blur-md opacity-20" style={{ backgroundColor: displayColor }} />
        </motion.div>
      );
    }

    // Stage 2: SPROUT (Universal for now, but can expand)
    if (stage === GrowthStage.SPROUT) {
      return (
        <motion.div {...commonProps} className="relative flex flex-col items-center">
          <div className="w-3 h-14 bg-emerald-600/20 rounded-full" />
          <div className="flex -mt-10">
            <motion.div 
              animate={{ rotate: [-25, -15, -25], scale: [1, 1.05, 1] }} 
              transition={{ duration: 3, repeat: Infinity }}
              className="w-12 h-12 bg-current rounded-full" 
              style={{ borderRadius: '100% 10% 100% 10%' }} 
            />
            <motion.div 
              animate={{ rotate: [25, 15, 25], scale: [1, 1.05, 1] }} 
              transition={{ duration: 3, repeat: Infinity, delay: 0.2 }}
              className="w-12 h-12 bg-current rounded-full -ml-4" 
              style={{ borderRadius: '10% 100% 10% 100%' }} 
            />
          </div>
          <CuteFace scale={0.7} />
        </motion.div>
      );
    }

    // Stage 3 & 4: Specialized Design
    switch (type) {
      case 'succulent':
        return stage === GrowthStage.GROWING ? (
          <motion.div {...commonProps} className="relative flex items-center justify-center">
            <div className="relative">
              {[0, 120, 240].map((deg) => (
                <div 
                  key={deg} 
                  className="w-14 h-14 absolute bg-current opacity-60 rounded-full" 
                  style={{ transform: `rotate(${deg}deg) translateY(-10px)`, borderRadius: '60% 60% 40% 40%' }} 
                />
              ))}
              <div className="w-12 h-12 bg-current rounded-full relative z-10 border-2 border-white/20" />
            </div>
            <CuteFace scale={0.7} />
          </motion.div>
        ) : (
          <motion.div {...commonProps} className="relative flex items-center justify-center">
            <div className="relative">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <div 
                  key={deg} 
                  className="absolute w-12 h-18 bg-current opacity-40 rounded-full border border-white/40 blur-[1px]" 
                  style={{ transform: `rotate(${deg}deg) translateY(-30px)`, borderRadius: '50% 50% 30% 30%' }} 
                />
              ))}
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <div 
                  key={deg + '-inner'} 
                  className="absolute w-10 h-14 bg-current opacity-80 rounded-full border border-white/20" 
                  style={{ transform: `rotate(${deg}deg) translateY(-15px)`, borderRadius: '50% 50% 40% 40%' }} 
                />
              ))}
              <div className="w-16 h-16 bg-current rounded-full shadow-lg relative z-10 border-2 border-white/60 flex items-center justify-center">
                 <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-full" />
                 <CuteFace scale={0.9} mood="happy" />
              </div>
            </div>
          </motion.div>
        );

      case 'bamboo':
        return (
          <motion.div {...commonProps} className="relative flex flex-col items-center">
            <div className="flex flex-col gap-1 items-center">
              {[...Array(stage === GrowthStage.BLOOM ? 4 : stage === GrowthStage.GROWING ? 3 : 2)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-6 h-12 bg-current rounded-lg border-b-2 border-black/5 relative"
                  style={{ opacity: 1 - (i * 0.15) }}
                >
                  {i === 0 && (
                    <motion.div 
                      animate={{ rotate: [-20, -15] }}
                      className="absolute -left-6 top-2 w-8 h-4 bg-current rounded-full" 
                      style={{ borderRadius: '100% 0 100% 0' }}
                    />
                  )}
                  {i === 1 && (
                    <motion.div 
                      animate={{ rotate: [20, 15] }}
                      className="absolute -right-6 top-4 w-10 h-3 bg-current rounded-full opacity-80" 
                      style={{ borderRadius: '0 100% 0 100%' }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="absolute top-[40%]"><CuteFace scale={0.8} /></div>
          </motion.div>
        );

      case 'lotus':
        return (
          <motion.div {...commonProps} className="relative flex flex-col items-center">
            <div className="relative">
              <div className="w-40 h-8 bg-emerald-900/5 rounded-[100%] mb-[-2px] blur-[1px]" />
              {stage === GrowthStage.BLOOM ? (
                <div className="relative flex items-center justify-center">
                  {/* Layered Minimalist Petals */}
                  {[0, 60, 120, 180, 240, 300].map(deg => (
                    <div 
                      key={deg} 
                      className="absolute w-14 h-24 bg-rose-300/40 rounded-full border border-white/40" 
                      style={{ 
                        transform: `rotate(${deg}deg) translateY(-20px)`, 
                        borderRadius: '60% 60% 30% 30%',
                        boxShadow: 'inset 0 0 10px rgba(255,255,255,0.5)'
                      }} 
                    />
                  ))}
                  {[30, 90, 150, 210, 270, 330].map(deg => (
                    <div 
                      key={deg + 'inner'} 
                      className="absolute w-10 h-18 bg-rose-200/60 rounded-full border border-white/60" 
                      style={{ 
                        transform: `rotate(${deg}deg) translateY(-10px)`, 
                        borderRadius: '50% 50% 40% 40%' 
                      }} 
                    />
                  ))}
                  <div className="w-14 h-14 bg-white/40 backdrop-blur-sm rounded-full z-10 relative flex items-center justify-center border-2 border-white/80">
                    <CuteFace mood="happy" scale={0.7} />
                  </div>
                </div>
              ) : (
                <div className="w-20 h-14 bg-current/80 rounded-[100%_100%_40%_40%] shadow-sm border-b-2 border-black/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
                  <CuteFace scale={0.7} />
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'sunflower':
        return (
          <motion.div {...commonProps} className="relative flex flex-col items-center scale-90">
            <div className="w-1.5 h-24 bg-emerald-500/10 rounded-full absolute top-12" />
            <div className="relative">
              {/* Petals - Reduced count and size */}
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-10 h-18 bg-yellow-400/20 rounded-full border border-yellow-200/40" 
                  style={{ transform: `rotate(${i * 45}deg) translateY(-25px)`, borderRadius: '50% 50% 15% 15%' }} 
                />
              ))}
              <div className="w-22 h-22 bg-gradient-to-tr from-yellow-400/90 to-amber-300 rounded-full shadow-lg relative z-10 flex items-center justify-center border-4 border-white/60">
                 <div className="w-16 h-16 bg-amber-500/10 rounded-full border border-white/10 flex items-center justify-center">
                    <CuteFace mood={stage === GrowthStage.BLOOM ? 'happy' : 'normal'} scale={0.6} />
                 </div>
              </div>
            </div>
          </motion.div>
        );

      case 'cactus':
        return (
          <motion.div {...commonProps} className="relative flex items-center justify-center">
            <div className="relative">
              {/* Main Body - Thinner and more elegant */}
              <div className={cn(
                "bg-emerald-500/60 rounded-full border-[3px] border-white/30 shadow-lg relative flex items-center justify-center overflow-hidden",
                stage === GrowthStage.BLOOM ? "w-16 h-36" : "w-14 h-28"
              )} style={{ borderRadius: '40% 40% 45% 45%' }}>
                <div className="absolute inset-0 flex justify-between px-2 opacity-10">
                   <div className="w-0.5 h-full bg-white rounded-full" />
                   <div className="w-0.5 h-full bg-white rounded-full" />
                </div>
                <CuteFace mood={stage === GrowthStage.BLOOM ? 'happy' : 'normal'} scale={0.5} />
              </div>

              {/* Branched Arms - Dispersed for lightness */}
              <motion.div 
                animate={{ rotate: [-2, 2, -2] }}
                className="absolute -left-6 top-8 w-10 h-16 bg-emerald-500/50 rounded-full border-[2.5px] border-white/20 origin-bottom-right"
                style={{ borderRadius: '50% 50% 20% 80%', transform: 'rotate(-20deg)' }}
              />
              <motion.div 
                animate={{ rotate: [2, -2, 2] }}
                className="absolute -right-7 top-4 w-12 h-18 bg-emerald-500/40 rounded-full border-[2.5px] border-white/20 origin-bottom-left"
                style={{ borderRadius: '50% 50% 80% 20%', transform: 'rotate(15deg)' }}
              />

              {/* Systematic Spines - Very sparse and light */}
              <div className="absolute inset-0 pointer-events-none opacity-40">
                 {[...Array(10)].map((_, i) => (
                   <div key={i} className="absolute w-0.5 h-0.5 bg-white rounded-full" style={{ left: `${20 + Math.random() * 60}%`, top: `${15 + Math.random() * 70}%` }} />
                 ))}
              </div>

              {/* Bloom Flower */}
              {stage === GrowthStage.BLOOM && (
                <motion.div 
                  animate={{ scale: [1, 1.1, 1], y: [0, -2, 0] }}
                  className="absolute -top-5 left-1/2 -ml-5 w-10 h-10 flex items-center justify-center z-20"
                >
                  <div className="absolute w-full h-full bg-rose-400/30 rounded-full blur-[2px]" />
                  {[0, 60, 120, 180, 240, 300].map(deg => (
                    <div key={deg} className="absolute w-8 h-8 bg-rose-300/80 rounded-full border border-white/40" style={{ transform: `rotate(${deg}deg) scaleX(0.4)` }} />
                  ))}
                  <div className="w-4 h-4 bg-yellow-100 rounded-full z-10 border border-white/20" />
                </motion.div>
              )}
            </div>
          </motion.div>
        );

      case 'lavender':
        return (
          <motion.div {...commonProps} className="relative flex flex-col items-center">
             <div className="w-1.5 h-32 bg-emerald-700/20 rounded-full" />
             <div className="flex flex-col gap-1 -mt-40">
                {[...Array(stage === GrowthStage.BLOOM ? 5 : 3)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ delay: i * 0.2, repeat: Infinity }}
                    className="w-10 h-6 bg-current rounded-full border border-white/20" 
                    style={{ opacity: 1 - (i * 0.1) }}
                  />
                ))}
             </div>
             <div className="absolute top-1/2"><CuteFace scale={0.8} /></div>
          </motion.div>
        );

      case 'ginkgo':
        return (
          <motion.div {...commonProps} className="relative flex flex-col items-center">
            {/* Trunk */}
            <div className="w-2.5 h-32 bg-stone-300 rounded-full" />
            
            <div className="relative -mt-36">
              {/* Fan-shaped ginkgo leaves - dispersed for lightweight feel */}
              {[...Array(stage === GrowthStage.BLOOM ? 8 : 4)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ 
                    rotate: [i * 45 - 5, i * 45 + 5, i * 45 - 5],
                    y: [0, -2, 0]
                  }}
                  transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, delay: i * 0.2 }}
                  className="absolute bg-current opacity-80 shadow-sm" 
                  style={{ 
                    width: '32px', 
                    height: '32px',
                    borderRadius: '100% 0 0 0', // Fan-like quarters
                    transform: `rotate(${i * 45}deg) translateY(-35px) scale(${0.8 + Math.random() * 0.4})`,
                    left: '50%',
                    marginLeft: '-16px',
                    top: `${-i * 4}px`
                  }} 
                />
              ))}
              
              <div className="w-16 h-16 bg-white/20 backdrop-blur-[2px] rounded-full absolute -top-8 -left-8 flex items-center justify-center z-10 border border-white/30">
                <CuteFace scale={0.8} />
              </div>
            </div>
          </motion.div>
        );

      case 'cherry':
        return (
          <motion.div {...commonProps} className="relative flex flex-col items-center">
             {/* Shared Stems */}
             <div className="relative -mt-20 flex justify-center">
                <div className="absolute top-[-40px] w-1 h-16 bg-emerald-600/40 rounded-full origin-bottom rotate-[-25deg]" />
                <div className="absolute top-[-40px] w-1 h-16 bg-emerald-600/40 rounded-full origin-bottom rotate-[25deg]" />
                <div className="absolute top-[-45px] w-4 h-2 bg-emerald-700/50 rounded-full blur-[1px]" />

                <div className="flex gap-2 items-end pt-10">
                   {/* Main Cherry */}
                   <motion.div 
                      animate={{ 
                        rotate: [-2, 2, -2],
                        y: [0, 2, 0]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="w-18 h-18 bg-current rounded-full shadow-lg border-4 border-white/30 flex items-center justify-center relative overflow-hidden"
                   >
                      <div className="absolute top-2 right-4 w-4 h-2 bg-white/40 rounded-full blur-[1px] rotate-45" />
                      <CuteFace scale={0.7} mood={stage === GrowthStage.BLOOM ? 'happy' : 'normal'} />
                   </motion.div>

                   {/* Second Cherry (appears as it grows) */}
                   <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ 
                        scale: stage === GrowthStage.BLOOM ? 1 : 0.8,
                        rotate: [2, -2, 2],
                        y: [0, -2, 0]
                      }}
                      transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                      className="w-14 h-14 bg-current/90 rounded-full shadow-md border-[3px] border-white/30 flex items-center justify-center relative"
                   >
                      <div className="absolute top-2 right-3 w-3 h-1.5 bg-white/20 rounded-full blur-[1px] rotate-45" />
                      <CuteFace scale={0.5} mood="happy" />
                   </motion.div>
                </div>
             </div>
          </motion.div>
        );

      default:
    }
  };

  return (
    <div className={cn("relative flex items-center justify-center", mini ? "w-10 h-10" : "w-64 h-64")}>
      {!mini && (
        <div className="absolute bottom-4 w-40 h-10 bg-green-900/5 blur-2xl rounded-full translate-y-4" />
      )}
      
      {/* Grassy Mound at the base */}
      {!mini && (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute bottom-4 w-48 h-12 bg-gradient-to-b from-green-100 to-green-200/40 rounded-[100%] border-t border-green-50 z-0 flex items-center justify-around px-10"
        >
          <div className="w-2 h-2 bg-pink-300 rounded-full blur-[1px] opacity-40 translate-y-[-2px]" />
          <div className="w-1.5 h-1.5 bg-yellow-300 rounded-full blur-[1px] opacity-30 translate-y-[-4px]" />
          <div className="w-2 h-2 bg-blue-300 rounded-full blur-[1px] opacity-20 translate-y-[-3px]" />
        </motion.div>
      )}

      <motion.div 
        animate={{ 
          filter: isFocusing ? 'saturate(1.3) brightness(1.05)' : 'saturate(0.5) brightness(1.15)'
        }}
        style={{ color: displayColor }}
        className="flex items-center justify-center relative transition-all duration-[2000ms] z-10"
      >
        {renderPlant()}
      </motion.div>

      {/* Sparkles during focus */}
      {isFocusing && !mini && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 0.8, 0], 
                scale: [0.5, 1, 0.5],
                y: [0, -30 - Math.random() * 50, 0],
                x: [0, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 20]
              }}
              transition={{ 
                duration: 2 + Math.random() * 2, 
                repeat: Infinity, 
                delay: i * 0.5 
              }}
              className="absolute left-1/2 top-1/2 w-1.5 h-1.5 bg-yellow-200 rounded-full blur-[1px] shadow-[0_0_8px_white]"
            />
          ))}
        </div>
      )}
      
      {isFocusing && !mini && (
        <motion.div 
          animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 blur-3xl rounded-full"
          style={{ backgroundColor: displayColor }}
        />
      )}

      {!mini && (
        <div className={cn(
          "absolute -bottom-8 w-32 h-4 rounded-full blur-xl transition-all duration-[2000ms]",
          isFocusing ? "bg-green-500/20 scale-125" : "bg-stone-900/5 scale-90"
        )} />
      )}
    </div>
  );
}
