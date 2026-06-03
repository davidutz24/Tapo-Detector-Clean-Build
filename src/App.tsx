/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Info, X, Camera, Activity, Telescope, ShieldAlert, Save, Trash2, Settings, Plus, Brush, Eraser } from 'lucide-react';

interface DetectionEvent {
  id: string;
  time: string;
  type: 'meteor' | 'fireball';
  brightness?: number;
  length?: number;
  image: string;
}

type CameraStatus = 'running' | 'connecting' | 'stopped' | 'error';

interface CameraSummary {
  id: string;
  name?: string;
  status?: CameraStatus;
  fps?: number;
}

interface Stats {
  total: number;
  meteors: number;
  fireballs: number;
  fps: number;
  status: CameraStatus;
  cameras?: CameraSummary[];
}

export default function App() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    meteors: 0,
    fireballs: 0,
    fps: 24.5,
    status: 'connecting',
  });
  
  const [detections, setDetections] = useState<DetectionEvent[]>([]);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string>('1');
  const [cameraTabs, setCameraTabs] = useState<CameraSummary[]>([
    { id: '1', name: 'CAM 1', status: 'connecting' },
    { id: '2', name: 'CAM 2', status: 'connecting' },
  ]);
  const [isMockMode, setIsMockMode] = useState<boolean>(true);
  const [isContributorsOpen, setIsContributorsOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);

  // Masking state
  const [isEditMaskMode, setIsEditMaskMode] = useState(false);
  const [masks, setMasks] = useState<number[][]>([]);
  const [currentMask, setCurrentMask] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({x: 0, y: 0});
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const brushMaskCanvasRef = useRef<HTMLCanvasElement>(null);
  const brushLastPointRef = useRef<{x: number, y: number} | null>(null);
  const brushActionRef = useRef<'paint' | 'erase'>('paint');
  const [isBrushMaskMode, setIsBrushMaskMode] = useState(false);
  const [isBrushDrawing, setIsBrushDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [brushTool, setBrushTool] = useState<'paint' | 'erase'>('paint');

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editableConfig, setEditableConfig] = useState<{
    cameras: any[],
    max_overall_brightness?: number,
    bg_history?: number,
    bg_threshold?: number,
    hough_threshold?: number,
    min_streak_length?: number,
    max_line_gap?: number,
    min_angle?: number,
    max_angle?: number,
    min_streak_brightness?: number,
    fireball_threshold?: number,
    fireball_min_area?: number
  }>({cameras: []});
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    let mockInterval: any;
    let connectTimer: any;
    let localMockMode = false;

    // Simulation logic
    const setupMock = () => {
      if (localMockMode) return;
      localMockMode = true;
      setIsMockMode(true);
      setCameraTabs([
        { id: '1', name: 'CAM 1', status: 'running' },
        { id: '2', name: 'CAM 2', status: 'running' },
      ]);
      connectTimer = setTimeout(() => {
        setStats(s => ({ ...s, status: 'running' }));
      }, 2000);

      mockInterval = setInterval(() => {
        const isFireball = Math.random() > 0.8;
        const newEvent: DetectionEvent = {
          id: Math.random().toString(36).substring(7),
          time: new Date().toISOString(),
          type: isFireball ? 'fireball' : 'meteor',
          brightness: Math.floor(Math.random() * 200) + 50,
          length: Math.floor(Math.random() * 100) + 20,
          image: `https://images.unsplash.com/photo-1543722530-d2c3201371e7?auto=format&fit=crop&q=80&w=800&h=450`
        };

        setDetections(prev => [newEvent, ...prev].slice(0, 50));
        setStats(s => ({
          ...s,
          total: s.total + 1,
          meteors: s.meteors + (isFireball ? 0 : 1),
          fireballs: s.fireballs + (isFireball ? 1 : 0),
          fps: 24 + Math.random() * 2 // slight fps fluctuation
        }));
      }, 8000);
    };

    const exitMockMode = () => {
      if (localMockMode) {
        clearInterval(mockInterval);
        clearTimeout(connectTimer);
      }
      localMockMode = false;
      setIsMockMode(false);
    };

    // Real API fetching logic
    const fetchRealData = async () => {
      try {
        const statsRes = await fetch('/api/stats');
        if (!statsRes.ok) {
          throw new Error('Stats endpoint unavailable');
        }
        const s = await statsRes.json();
        setStats(s);
        if (Array.isArray(s.cameras) && s.cameras.length > 0) {
          setCameraTabs(s.cameras.map((cam: any) => ({
            id: String(cam.id),
            name: cam.name || `CAM ${cam.id}`,
            status: cam.status,
            fps: cam.fps,
          })));
        }
        
        const detRes = await fetch('/api/detections');
        if (!detRes.ok) {
          throw new Error('Detections endpoint unavailable');
        }
        const d = await detRes.json();
        // Transform image path for real backend
        const transformedDetections = d.map((item: any) => ({
          ...item,
          image: `/static/detections/${item.image}`
        }));
        // Only update if there are new items
        setDetections(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(transformedDetections)) {
             return transformedDetections;
          }
          return prev;
        });

        exitMockMode();
      } catch (err) {
        // Backend not reachable. If mock isn't running yet, start it.
        setupMock();
      }
    };

    // Check API every 2 seconds
    const interval = setInterval(fetchRealData, 2000);
    // Do an immediate initial check
    fetchRealData();

    return () => {
      clearInterval(interval);
      if (mockInterval) clearInterval(mockInterval);
      if (connectTimer) clearTimeout(connectTimer);
    };
  }, []);

  // Rectangle masks are retired; brush masks are loaded onto the canvas below.
  useEffect(() => {
    setMasks([]);
  }, [selectedCamera]);

  useEffect(() => {
    if (cameraTabs.length > 0 && !cameraTabs.some(cam => String(cam.id) === String(selectedCamera))) {
      setSelectedCamera(String(cameraTabs[0].id));
    }
  }, [cameraTabs, selectedCamera]);

  const ensureBrushCanvas = (clear = false) => {
    const canvas = brushMaskCanvasRef.current;
    const container = videoContainerRef.current;
    if (!canvas || !container) return null;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const current = canvas.getContext('2d');
    if (!current) return null;

    if (canvas.width !== width || canvas.height !== height) {
      const previous = document.createElement('canvas');
      previous.width = Math.max(1, canvas.width);
      previous.height = Math.max(1, canvas.height);
      const previousCtx = previous.getContext('2d');
      if (previousCtx && canvas.width > 0 && canvas.height > 0) {
        previousCtx.drawImage(canvas, 0, 0);
      }
      canvas.width = width;
      canvas.height = height;
      current.clearRect(0, 0, width, height);
      if (!clear && previousCtx) {
        current.drawImage(previous, 0, 0, width, height);
      }
    } else if (clear) {
      current.clearRect(0, 0, width, height);
    }

    return { canvas, ctx: current, width, height };
  };

  const clearBrushMask = () => {
    const target = ensureBrushCanvas(true);
    if (target) {
      target.ctx.clearRect(0, 0, target.width, target.height);
    }
  };

  const updateBrushSize = (value: number) => {
    const next = Number.isFinite(value) ? value : 24;
    setBrushSize(Math.max(4, Math.min(180, Math.round(next))));
  };

  const deleteBrushMask = async () => {
    clearBrushMask();
    if (isMockMode) return;
    try {
      const res = await fetch(`/api/brush-mask/${selectedCamera}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Brush mask delete failed with status ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to delete brush mask", err);
    }
  };

  const loadBrushMask = async () => {
    const target = ensureBrushCanvas(true);
    if (!target) return;
    if (isMockMode) return;

    try {
      const res = await fetch(`/api/brush-mask/${selectedCamera}?t=${Date.now()}`);
      if (res.status === 404) return;
      if (!res.ok) throw new Error(`Mask load failed with status ${res.status}`);
      const blob = await res.blob();
      const imageUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const latest = ensureBrushCanvas(true);
        if (!latest) {
          URL.revokeObjectURL(imageUrl);
          return;
        }
        const temp = document.createElement('canvas');
        temp.width = latest.width;
        temp.height = latest.height;
        const tempCtx = temp.getContext('2d');
        if (!tempCtx) {
          URL.revokeObjectURL(imageUrl);
          return;
        }
        tempCtx.drawImage(image, 0, 0, temp.width, temp.height);
        const src = tempCtx.getImageData(0, 0, temp.width, temp.height);
        const overlay = latest.ctx.createImageData(temp.width, temp.height);
        for (let i = 0; i < src.data.length; i += 4) {
          const masked = src.data[i] < 128;
          overlay.data[i] = 255;
          overlay.data[i + 1] = 0;
          overlay.data[i + 2] = 0;
          overlay.data[i + 3] = masked ? 115 : 0;
        }
        latest.ctx.putImageData(overlay, 0, 0);
        URL.revokeObjectURL(imageUrl);
      };
      image.src = imageUrl;
    } catch (err) {
      console.error("Could not load brush mask:", err);
    }
  };

  useEffect(() => {
    loadBrushMask();
    const onResize = () => ensureBrushCanvas(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [selectedCamera, isMockMode]);

  const drawBrushDot = (x: number, y: number, erase: boolean) => {
    const target = ensureBrushCanvas(false);
    if (!target) return;
    const { ctx } = target;
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawBrushLine = (x: number, y: number, erase: boolean) => {
    const target = ensureBrushCanvas(false);
    if (!target) return;
    const last = brushLastPointRef.current;
    if (!last) {
      drawBrushDot(x, y, erase);
      brushLastPointRef.current = { x, y };
      return;
    }
    const { ctx } = target;
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.45)';
    ctx.lineWidth = brushSize * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    brushLastPointRef.current = { x, y };
  };

  const getBrushPoint = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = videoContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    };
  };

  const handleBrushMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isBrushMaskMode) return false;
    e.preventDefault();
    const point = getBrushPoint(e);
    if (!point) return true;
    const erase = brushTool === 'erase' || e.button === 2;
    brushActionRef.current = erase ? 'erase' : 'paint';
    brushLastPointRef.current = point;
    setIsBrushDrawing(true);
    drawBrushDot(point.x, point.y, erase);
    return true;
  };

  const handleBrushMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isBrushMaskMode || !isBrushDrawing) return false;
    e.preventDefault();
    const point = getBrushPoint(e);
    if (!point) return true;
    drawBrushLine(point.x, point.y, brushActionRef.current === 'erase');
    return true;
  };

  const stopBrushDrawing = () => {
    if (!isBrushDrawing) return false;
    setIsBrushDrawing(false);
    brushLastPointRef.current = null;
    return true;
  };

  const triggerSaveBrushMask = async () => {
    const target = ensureBrushCanvas(false);
    if (!target) {
      setIsBrushMaskMode(false);
      return;
    }
    if (isMockMode) {
      setIsBrushMaskMode(false);
      return;
    }

    const overlay = target.ctx.getImageData(0, 0, target.width, target.height);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = target.width;
    exportCanvas.height = target.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;
    const binary = exportCtx.createImageData(target.width, target.height);
    for (let i = 0; i < overlay.data.length; i += 4) {
      const masked = overlay.data[i + 3] > 8;
      const value = masked ? 0 : 255;
      binary.data[i] = value;
      binary.data[i + 1] = value;
      binary.data[i + 2] = value;
      binary.data[i + 3] = 255;
    }
    exportCtx.putImageData(binary, 0, 0);

    try {
      const res = await fetch(`/api/brush-mask/${selectedCamera}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width: target.width,
          height: target.height,
          mask: exportCanvas.toDataURL('image/png'),
        }),
      });
      if (!res.ok) throw new Error(`Brush mask save failed with status ${res.status}`);
      setIsBrushMaskMode(false);
    } catch (err) {
      console.error("Failed to save brush mask", err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (handleBrushMouseDown(e)) return;
    if (!isEditMaskMode || !videoContainerRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentMask({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (handleBrushMouseMove(e)) return;
    if (!isDrawing || !isEditMaskMode || !videoContainerRef.current) return;
    const rect = videoContainerRef.current.getBoundingClientRect();
    let cx = (e.clientX - rect.left) / rect.width;
    let cy = (e.clientY - rect.top) / rect.height;
    cx = Math.max(0, Math.min(1, cx));
    cy = Math.max(0, Math.min(1, cy));

    setCurrentMask({
      x: Math.min(startPos.x, cx),
      y: Math.min(startPos.y, cy),
      w: Math.abs(cx - startPos.x),
      h: Math.abs(cy - startPos.y)
    });
  };

  const handleMouseUp = () => {
    if (stopBrushDrawing()) return;
    if (!isDrawing || !isEditMaskMode) return;
    if (currentMask && currentMask.w > 0.01 && currentMask.h > 0.01) {
      setMasks([...masks, [currentMask.x, currentMask.y, currentMask.w, currentMask.h]]);
    }
    setIsDrawing(false);
    setCurrentMask(null);
  };

  const triggerSaveMasks = async () => {
    if (isMockMode) {
      setIsEditMaskMode(false);
      return;
    }
    try {
      await fetch(`/api/config/masks/${selectedCamera}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masks })
      });
      setIsEditMaskMode(false);
    } catch (err) {
      console.error("Failed to save masks", err);
    }
  };

  const deleteDetection = async (id: string) => {
    if (isMockMode) {
      setDetections(prev => prev.filter(d => d.id !== id));
      return;
    }
    try {
      const res = await fetch(`/api/detections/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Delete failed with status ${res.status}`);
      }
      setDetections(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error("Failed to delete detection", err);
    }
  };

  const openSettings = async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) {
        throw new Error('Config endpoint unavailable');
      }
      const data = await res.json();
      setIsMockMode(false);
      setEditableConfig(data);
      setIsSettingsOpen(true);
      setSaveMessage('');
    } catch (err) {
      console.error("Failed to load config", err);
      alert("Cannot edit real config because the backend is not reachable.");
    }
  };

  const saveSettings = async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editableConfig)
      });
      setSaveMessage('Saved! Please restart the application to apply RTSP URL changes.');
    } catch (err) {
      setSaveMessage('Error saving configuration.');
    }
  };

  const handleCameraChange = (index: number, field: string, value: string) => {
    const newCameras = [...(editableConfig.cameras || [])];
    newCameras[index] = { ...newCameras[index], [field]: value };
    setEditableConfig({ ...editableConfig, cameras: newCameras });
  };

  const addCamera = () => {
    const newCameras = [...(editableConfig.cameras || [])];
    const newId = newCameras.length > 0 ? Math.max(...newCameras.map(c => parseInt(c.id) || 0)) + 1 : 1;
    newCameras.push({ id: String(newId), name: "New Camera", url: "rtsp://username:password@ip:554/stream1", ignore_regions: [] });
    setEditableConfig({ ...editableConfig, cameras: newCameras });
  };

  const removeCamera = (index: number) => {
    const newCameras = [...(editableConfig.cameras || [])];
    newCameras.splice(index, 1);
    setEditableConfig({ ...editableConfig, cameras: newCameras });
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const selectedCameraInfo = cameraTabs.find(cam => String(cam.id) === String(selectedCamera));
  const selectedCameraStatus = selectedCameraInfo?.status || stats.status;

  return (
    <div className="relative z-10 max-w-[1480px] mx-auto px-6 pb-20 pt-6">
      
      {/* HEADER */}
      <header className="flex items-center justify-between pb-5 border-b border-tapo-border mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight flex items-center gap-4">
              <span><span className="text-[#00c8f0]">TAPO</span> Meteor Network</span>
              <div className="flex items-center gap-3">
                <img src="/logo-transparent.png" alt="Astromania" className="h-12 w-12 object-contain" />
              </div>
            </h1>
            <small className="text-tapo-dim text-[10px] font-mono tracking-widest uppercase block mt-1">
              C325WB • Auto-Detection • Romania
            </small>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={openSettings}
            className="flex items-center gap-1.5 font-mono text-[11px] font-bold px-3 py-1.5 rounded-full tracking-widest uppercase bg-white/5 text-tapo-dim2 border border-tapo-border2 hover:bg-white/10 hover:text-white hover:border-tapo-muted transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button 
            onClick={() => setIsAboutOpen(true)}
            className="flex items-center gap-1.5 font-mono text-[11px] font-bold px-3 py-1.5 rounded-full tracking-widest uppercase bg-white/5 text-tapo-dim2 border border-tapo-border2 hover:bg-white/10 hover:text-white hover:border-tapo-muted transition-all"
          >
            <Info className="w-3.5 h-3.5" />
            About
          </button>
          
          <div className={`font-mono text-[11px] font-bold px-3 py-1.5 rounded-full tracking-widest uppercase flex items-center gap-2 transition-all ${
            stats.status === 'running' ? 'bg-tapo-accent-m/10 text-tapo-accent-m border-tapo-accent-m/20 border' :
            stats.status === 'stopped' ? 'bg-indigo-900/10 text-tapo-dim border-tapo-border border' :
            stats.status === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20 border' :
            'bg-tapo-accent-b/10 text-tapo-accent-b border-tapo-accent-b/20 border'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full bg-current ${stats.status === 'running' ? 'animate-pulse-ring' : ''}`} />
            {stats.status.toUpperCase()}
          </div>
        </div>
      </header>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-tapo-accent-b" />
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">Total Detections</div>
          <div className="text-4xl font-extrabold tracking-tight tabular-nums text-tapo-accent-b leading-none">{stats.total}</div>
        </div>
        <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-tapo-accent-m" />
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">Meteors</div>
          <div className="text-4xl font-extrabold tracking-tight tabular-nums text-tapo-accent-m leading-none">{stats.meteors}</div>
        </div>
        <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-tapo-accent-f" />
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">Fireballs</div>
          <div className="text-4xl font-extrabold tracking-tight tabular-nums text-tapo-accent-f leading-none">{stats.fireballs}</div>
        </div>
        <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-tapo-dim" />
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">Stream FPS</div>
          <div className="text-3xl font-extrabold tracking-tight tabular-nums text-tapo-dim2 leading-none">{stats.fps > 0 ? stats.fps.toFixed(1) : '—'}</div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start mb-8">
        
        {/* CAMERA FEED */}
        <div className="bg-tapo-deep border border-tapo-border rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-5 py-3 border-b border-tapo-border bg-tapo-panel/50">
            <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-tapo-dim flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" /> Live Camera Feed
            </span>
            <div className="flex items-center gap-2">
              {cameraTabs.map((cam, index) => (
                <button 
                  key={cam.id}
                  onClick={() => setSelectedCamera(String(cam.id))}
                  className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${String(selectedCamera) === String(cam.id) ? 'bg-tapo-accent-b/20 text-tapo-accent-b' : 'bg-tapo-panel text-tapo-dim hover:text-white'}`}
                >
                  {(cam.name || `CAM ${index + 1}`).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div 
            ref={videoContainerRef}
            className={`relative bg-black aspect-video flex items-center justify-center select-none ${isEditMaskMode || isBrushMaskMode ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={(e) => isBrushMaskMode && e.preventDefault()}
          >
            {selectedCameraStatus !== 'running' ? (
              <span className="font-mono text-[11px] tracking-[0.1em] text-white/20 select-none">NO SIGNAL</span>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-t from-tapo-void/40 to-transparent z-0">
                 {isMockMode ? ( 
                   <>
                     <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1543722530-d2c3201371e7?auto=format&fit=crop&q=80&w=1600')] bg-cover bg-center opacity-40 mix-blend-screen" />
                   </>
                 ) : (
                   <img key={selectedCamera} src={`/video_feed/${selectedCamera}`} className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-90" alt={`Camera ${selectedCamera} Feed`} />
                 )}
                 <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-tapo-void to-transparent" />
              </div>
            )}
            
            <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-3 pointer-events-none z-[60]">
              <div className="flex flex-col gap-2 pointer-events-auto">
                <span className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-white/10 uppercase tracking-[0.08em] text-red-500 flex items-center gap-1.5 w-max">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-ring" /> REC {selectedCamera}
                </span>
                
                {selectedCameraStatus === 'running' && (
                  isBrushMaskMode ? (
                    <div
                      className="flex flex-wrap items-center gap-1.5 mt-1 animate-in fade-in zoom-in-95"
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseMove={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={triggerSaveBrushMask}
                        className="bg-tapo-accent-m text-black font-bold font-mono text-[10px] px-3 py-1.5 rounded hover:bg-tapo-accent-m/90 flex items-center gap-1.5"
                      >
                        <Save className="w-3 h-3" /> SAVE
                      </button>
                      <button
                        onClick={deleteBrushMask}
                        className="bg-red-500/20 text-red-500 border border-red-500/30 font-bold font-mono text-[10px] px-3 py-1.5 rounded hover:bg-red-500/30 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> DELETE
                      </button>
                      <button
                        onClick={() => setBrushTool('paint')}
                        className={`border font-bold font-mono text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1.5 ${brushTool === 'paint' ? 'bg-tapo-accent-m text-black border-tapo-accent-m' : 'bg-black/70 text-white/70 border-white/10 hover:text-white'}`}
                      >
                        <Brush className="w-3 h-3" /> PAINT
                      </button>
                      <button
                        onClick={() => setBrushTool('erase')}
                        className={`border font-bold font-mono text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1.5 ${brushTool === 'erase' ? 'bg-tapo-accent-b text-black border-tapo-accent-b' : 'bg-black/70 text-white/70 border-white/10 hover:text-white'}`}
                      >
                        <Eraser className="w-3 h-3" /> ERASE
                      </button>
                      <label className="bg-black/70 backdrop-blur border border-white/10 rounded px-2 py-1 flex items-center gap-2 text-white/70">
                        <Brush className="w-3 h-3" />
                        <input
                          type="range"
                          min="4"
                          max="180"
                          value={brushSize}
                          onChange={(e) => updateBrushSize(parseInt(e.target.value, 10))}
                          className="w-20 accent-tapo-accent-m"
                        />
                        <input
                          type="number"
                          min="4"
                          max="180"
                          value={brushSize}
                          onChange={(e) => updateBrushSize(parseInt(e.target.value, 10))}
                          className="w-12 bg-black/50 border border-white/10 rounded px-1 py-0.5 font-mono text-[10px] text-white outline-none focus:border-tapo-accent-m"
                        />
                        <span className="font-mono text-[10px] tabular-nums">px</span>
                      </label>
                      <button
                        onClick={() => {
                          setIsBrushMaskMode(false);
                          loadBrushMask();
                        }}
                        className="bg-black/70 backdrop-blur text-white font-bold font-mono text-[10px] px-3 py-1.5 rounded hover:bg-white/20 ml-1 border border-white/10"
                      >
                        CANCEL
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        onClick={() => {
                          setIsEditMaskMode(false);
                          setIsBrushMaskMode(true);
                          loadBrushMask();
                        }}
                        className="bg-black/70 backdrop-blur text-white/70 hover:text-white border border-white/10 font-bold font-mono text-[10px] px-3 py-1.5 rounded transition-colors w-max flex items-center gap-1.5"
                      >
                        <Brush className="w-3 h-3" /> BRUSH MASK
                      </button>
                    </div>
                  )
                )}
              </div>
            <span className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-black/70 backdrop-blur-sm border border-white/10 uppercase tracking-[0.08em] text-tapo-dim2">
                TAPO C325WB
              </span>
            </div>
            
            <canvas
              ref={brushMaskCanvasRef}
              className="absolute inset-0 w-full h-full z-[45] pointer-events-none"
            />

            {/* Timestamp overlay */}
            <div className="absolute bottom-3 left-4 font-mono text-xs text-white/60 tracking-wider shadow-black drop-shadow-md z-[60]">
              {new Date().toISOString().replace('T', ' ').substring(0, 19)}
            </div>
          </div>
        </div>

        {/* DETECTION LOG */}
        <div className="bg-tapo-panel border border-tapo-border rounded-2xl overflow-hidden flex flex-col h-[600px] shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-tapo-border shrink-0 bg-tapo-panel2/50">
            <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-tapo-dim flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Detection Log
            </span>
            <span className="text-[10px] font-mono text-tapo-dim bg-tapo-muted px-2.5 py-0.5 rounded-full">
              {detections.length} events
            </span>
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {detections.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-tapo-dim gap-3 h-full mix-blend-plus-lighter">
                <Telescope className="w-10 h-10 opacity-30" />
                <div className="text-xs text-center leading-relaxed opacity-60 font-mono">No detections yet.<br/>Watching the sky…</div>
              </div>
            ) : (
              detections.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setLightboxImg(item.image)}
                  className="flex items-start gap-3 p-3.5 border-b border-tapo-border cursor-pointer hover:bg-white/[0.025] transition-colors animate-in fade-in slide-in-from-top-2"
                >
                  <img src={item.image} alt="Event" className="w-[68px] h-[40px] object-cover rounded shrink-0 border border-tapo-border2 bg-tapo-deep" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-bold font-mono uppercase tracking-[0.06em] flex items-center gap-1.5 mb-1 ${item.type === 'fireball' ? 'text-tapo-accent-f' : 'text-tapo-accent-m'}`}>
                      {item.type === 'fireball' ? <ShieldAlert className="w-3 h-3" /> : '✦'} {item.type}
                    </div>
                    <div className="text-[10px] font-mono text-tapo-dim">
                      {formatDate(item.time)} • {formatTime(item.time)}
                    </div>
                    <div className="text-[10px] text-tapo-dim mt-0.5 font-mono">
                      {item.type === 'meteor' && item.length && `streak ${item.length}px`}
                      {item.brightness && ` • b=${item.brightness}`}
                      {item.camera && ` • Cam ${item.camera}`}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDetection(item.id);
                    }}
                    className="p-1.5 text-tapo-dim hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* GALLERY */}
      {detections.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-4 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-tapo-border">
            Captured Events
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {detections.slice(0, 12).map((item) => (
              <div 
                key={item.id}
                onClick={() => setLightboxImg(item.image)}
                className="bg-tapo-panel border border-tapo-border rounded-xl overflow-hidden cursor-pointer hover:border-tapo-border2 hover:-translate-y-0.5 transition-all shadow-md hover:shadow-xl group"
              >
                <div className="aspect-video overflow-hidden relative bg-tapo-deep">
                  <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                </div>
                <div className="p-2.5">
                  <div className={`text-[10px] font-mono font-bold uppercase tracking-[0.08em] ${item.type === 'fireball' ? 'text-tapo-accent-f' : 'text-tapo-accent-m'}`}>
                    {item.type === 'fireball' ? '🔥 Fireball' : '✦ Meteor'}
                  </div>
                  <div className="text-[9px] text-tapo-dim font-mono mt-1 line-clamp-1">
                    {formatDate(item.time)} • {formatTime(item.time)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 px-7 py-3 flex items-center justify-end bg-gradient-to-t from-[#04050e] via-[#04050e]/95 to-transparent z-[100] pointer-events-none">
        <div className="text-[10px] font-mono text-tapo-dim tracking-wide pointer-events-auto">
          © 2026 <button onClick={() => setIsAboutOpen(true)} className="text-tapo-dim2 hover:text-tapo-text transition-colors cursor-pointer">David Marica</button> &nbsp;|&nbsp;
          <abbr title="TAPO Meteor Network" className="no-underline cursor-pointer hover:text-tapo-text transition-colors" onClick={() => setIsAboutOpen(true)}>TPN</abbr>
          &nbsp;— TAPO Meteor Network
        </div>
      </footer>

      {/* ABOUT MODAL */}
      {isAboutOpen && (
        <div 
          className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setIsAboutOpen(false)}
        >
          <div 
            className="bg-tapo-panel2 border border-tapo-border2 rounded-2xl w-full max-w-[700px] max-h-[85vh] overflow-y-auto p-8 relative shadow-[0_32px_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200 custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsAboutOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full text-tapo-dim hover:text-white hover:bg-white/5 border border-transparent hover:border-tapo-border2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-extrabold mb-1 text-white">About TPN</h2>
            <div className="text-xs font-mono text-tapo-dim uppercase tracking-[0.1em] mb-7">TAPO Meteor Network • v1.0.0 (React Web)</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-6">
              <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">App Version</div>
                <div className="text-sm font-semibold text-tapo-text leading-tight">
                  v1.0.0
                  <span className="block font-normal text-xs text-tapo-dim2 mt-0.5">TAPO Meteor Network — TPN</span>
                </div>
              </div>
              <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">Creator &amp; Collaborator</div>
                <div className="text-sm font-semibold text-tapo-text leading-tight">
                  <div className="mb-2">David Marica <span className="font-normal text-xs text-tapo-dim2 ml-1">Creator</span></div>
                  <div className="flex flex-wrap gap-x-3 gap-y-2 mt-1 mb-3">
                    <a href="https://www.youtube.com/@davidmarica" target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-tapo-accent-b hover:underline flex items-center gap-1">YouTube</a>
                    <a href="https://davidmarica.blogspot.com/" target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-tapo-accent-b hover:underline flex items-center gap-1">Blog</a>
                    <a href="https://www.facebook.com/david.marica.5" target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-tapo-accent-b hover:underline flex items-center gap-1">Facebook</a>
                    <a href="https://www.instagram.com/david.marica/" target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-tapo-accent-b hover:underline flex items-center gap-1">Instagram</a>
                  </div>
                  <div className="border-t border-tapo-border/50 pt-2 mt-2">
                    <div className="mb-2">Emanuelo Andrei <span className="font-normal text-xs text-tapo-dim2 ml-1">Collaborator</span></div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2 mt-1">
                      <a href="https://www.youtube.com/@emanuelo256" target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-tapo-accent-b hover:underline flex items-center gap-1">YouTube</a>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">Detection Engine</div>
                <div className="text-sm font-semibold text-tapo-text leading-tight">
                  Python OpenCV 4.x (Local)
                  <span className="block font-normal text-xs text-tapo-dim2 mt-0.5">Hough Lines • MOG2 Subtractor</span>
                </div>
              </div>
              <div className="bg-tapo-panel border border-tapo-border rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-2">Cloud Frontend</div>
                <div className="text-sm font-semibold text-tapo-text leading-tight">
                  React 19 • Tailwind CSS v4
                  <span className="block font-normal text-xs text-tapo-dim2 mt-0.5">Single Page App Dashboard</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mt-6 mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-tapo-border">
              Supported Camera Models
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 bg-tapo-panel border border-tapo-border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-tapo-accent-m shrink-0 shadow-[0_0_8px_rgba(0,232,122,0.6)]" />
                  <div className="text-[13px] font-semibold text-white">Tapo C325WB v1</div>
                  <div className="text-[11px] text-tapo-dim font-mono ml-auto">4MP • Color Night Vision</div>
                </div>
                <div className="pl-5 flex flex-col gap-1.5 border-t border-tapo-border/50 pt-2.5 mt-1">
                  <a href="https://www.tp-link.com/ro/home-networking/cloud-camera/tapo-c325wb/" target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-tapo-accent-b hover:underline flex items-center gap-1.5">
                    Product Page <span className="opacity-70 text-[9px]">↗</span>
                  </a>
                  <a href="https://www.tp-link.com/ro/home-networking/cloud-camera/tapo-c325wb/#specifications" target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-tapo-accent-b hover:underline flex items-center gap-1.5">
                    Specifications <span className="opacity-70 text-[9px]">↗</span>
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-tapo-panel border border-tapo-border/50 rounded-lg p-3 opacity-60">
                <div className="w-2 h-2 rounded-full bg-tapo-dim shrink-0" />
                <div className="text-[13px] font-semibold text-tapo-dim2">Tapo C320WS / C420</div>
                <div className="text-[11px] text-tapo-dim font-mono ml-auto">Planned support</div>
              </div>
            </div>

            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-3 mt-6 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-tapo-border">
              Community &amp; Links
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button 
                onClick={() => setIsContributorsOpen(true)}
                className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-4 flex flex-col items-start gap-1 transition-all text-left"
              >
                <div className="text-white font-bold text-sm tracking-wide">Tapo Camera Members</div>
                <div className="text-[11px] text-tapo-dim font-mono">View the network contributors</div>
              </button>
              
              <button 
                onClick={() => setIsLinksOpen(true)}
                className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-4 flex flex-col items-start gap-1 transition-all text-left"
              >
                <div className="text-white font-bold text-sm tracking-wide">Links &amp; Partners</div>
                <div className="text-[11px] text-tapo-dim font-mono">Websites and YouTube channels</div>
              </button>
            </div>

            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-tapo-dim mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-tapo-border">
              Partners &amp; Technologies
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <a href="https://www.tapo.com" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                <img src="/tapo-218239.png" alt="Tapo" className="h-6 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] font-mono text-tapo-dim group-hover:text-tapo-text transition-colors">tapo.com</span>
              </a>
              <a href="https://astromania.org/" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                <img src="/logo-transparent.png" alt="AstROmania" className="h-7 w-7 object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] font-mono text-tapo-dim group-hover:text-tapo-text transition-colors">astromania.org</span>
              </a>
              <a href="https://globalmeteornetwork.org/" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                <div className="font-bold text-sm text-tapo-text opacity-70 group-hover:opacity-100 transition-opacity mb-1">GMN</div>
                <span className="text-[10px] font-mono text-tapo-dim group-hover:text-tapo-text transition-colors text-center leading-tight">globalmeteor<br/>network.org</span>
              </a>
              <a href="https://www.sarm.ro/newsite/index.php" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                <div className="font-bold text-sm text-tapo-text opacity-70 group-hover:opacity-100 transition-opacity mb-1 text-red-500">SARM</div>
                <span className="text-[10px] font-mono text-tapo-dim group-hover:text-tapo-text transition-colors">sarm.ro</span>
              </a>
              <a href="https://www.imo.net/" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                <div className="font-bold text-lg text-tapo-text opacity-70 group-hover:opacity-100 transition-opacity mb-1">IMO</div>
                <span className="text-[10px] font-mono text-tapo-dim group-hover:text-tapo-text transition-colors">imo.net</span>
              </a>
              <a href="https://opencv.org" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/50 border border-tapo-border hover:border-tapo-border2 rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all group">
                <div className="text-xl opacity-70 group-hover:opacity-100 transition-opacity mb-1">👁</div>
                <span className="text-[10px] font-mono text-tapo-dim group-hover:text-tapo-text transition-colors">opencv.org</span>
              </a>
            </div>
            
            <div className="mt-8 pt-5 border-t border-tapo-border text-center">
              <div className="text-[11px] font-mono text-tapo-dim">
                © 2026 David Marica • TAPO Meteor Network (TPN)<br/>
                <span className="text-[10px] opacity-70">RTSP Video Processing must be run on your local network.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div 
            className="bg-tapo-panel2 border border-tapo-border2 rounded-2xl w-full max-w-[700px] max-h-[90vh] overflow-y-auto p-8 relative shadow-[0_32px_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200 custom-scrollbar flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full text-tapo-dim hover:text-white hover:bg-white/5 border border-transparent hover:border-tapo-border2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-extrabold mb-1 text-white">App Settings</h2>
            <div className="text-[10px] font-mono text-tapo-dim tracking-[0.1em] uppercase mb-6 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-tapo-border">
              Configure Cameras &amp; General Rules
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <h3 className="text-xs font-bold text-tapo-accent-b mb-3 font-mono uppercase tracking-wider">Cameras Configuration</h3>
              <div className="space-y-4 mb-4">
                {editableConfig.cameras?.map((cam, i) => (
                  <div key={i} className="bg-tapo-panel/40 border border-tapo-border hover:border-tapo-border2 p-4 rounded-lg flex flex-col gap-3 relative transition-colors group">
                    <button 
                      onClick={() => removeCamera(i)} 
                      className="absolute top-3 right-3 text-tapo-dim hover:text-red-500 bg-black/50 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                      title="Remove Camera"
                    >
                      <Trash2 className="w-4 h-4"/>
                    </button>
                    <div className="pr-10 space-y-3">
                      <div>
                        <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1">Camera Name (ID: {cam.id})</label>
                        <input 
                          type="text" 
                          value={cam.name || ''} 
                          onChange={(e) => handleCameraChange(i, 'name', e.target.value)} 
                          className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono transition-colors" 
                          placeholder="e.g. Front Yard C325WB" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1">RTSP Stream URL</label>
                        <input 
                          type="url" 
                          value={cam.url || ''} 
                          onChange={(e) => handleCameraChange(i, 'url', e.target.value)} 
                          className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono transition-colors" 
                          placeholder="rtsp://username:password@IP:PORT/stream1" 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={addCamera} 
                className="bg-tapo-panel/80 border border-tapo-border border-dashed hover:border-tapo-accent-m text-tapo-dim hover:text-white px-4 py-3 rounded-lg text-xs font-mono flex items-center justify-center gap-2 w-full transition-colors"
              >
                <Plus className="w-4 h-4" /> ADD NEW CAMERA
              </button>

              <h3 className="text-xs font-bold text-tapo-accent-b mb-3 font-mono uppercase tracking-wider mt-6">Detection Settings</h3>
              <div className="bg-tapo-panel/40 border border-tapo-border p-4 rounded-lg flex flex-col gap-4">
                 <div>
                   <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1">Max Overall Brightness (default 80)</label>
                   <p className="text-[10px] font-mono text-tapo-dim2 mb-2 leading-tight">If camera average brightness is above this, detection goes to STANDBY (1 - 255). 255 = never standby.</p>
                   <input 
                     type="number" min="1" max="255"
                     value={editableConfig.max_overall_brightness || 80}
                     onChange={(e) => setEditableConfig({...editableConfig, max_overall_brightness: parseInt(e.target.value) || 80})}
                     className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" 
                   />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="Minimum streak length (pixels)">Min Streak Length (40)</label>
                     <input type="number" value={editableConfig.min_streak_length || 40} onChange={(e) => setEditableConfig({...editableConfig, min_streak_length: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="Hough transform threshold">Hough Threshold (25)</label>
                     <input type="number" value={editableConfig.hough_threshold || 25} onChange={(e) => setEditableConfig({...editableConfig, hough_threshold: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="Minimum streak brightness [0-255]">Min Streak Brightness (60)</label>
                     <input type="number" value={editableConfig.min_streak_brightness || 60} onChange={(e) => setEditableConfig({...editableConfig, min_streak_brightness: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="MOG2 Background History">Background History (200)</label>
                     <input type="number" value={editableConfig.bg_history || 200} onChange={(e) => setEditableConfig({...editableConfig, bg_history: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="Threshold for background differences">Background Threshold (50)</label>
                     <input type="number" value={editableConfig.bg_threshold || 50} onChange={(e) => setEditableConfig({...editableConfig, bg_threshold: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="Min angle of meteor streak">Min Angle (10)</label>
                     <input type="number" value={editableConfig.min_angle || 10} onChange={(e) => setEditableConfig({...editableConfig, min_angle: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="Max angle of meteor streak">Max Angle (170)</label>
                     <input type="number" value={editableConfig.max_angle || 170} onChange={(e) => setEditableConfig({...editableConfig, max_angle: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-mono text-tapo-dim uppercase tracking-wider mb-1" title="Minimum area for a fireball">Fireball Min Area (80)</label>
                     <input type="number" value={editableConfig.fireball_min_area || 80} onChange={(e) => setEditableConfig({...editableConfig, fireball_min_area: parseInt(e.target.value)})} className="w-full bg-black/50 border border-tapo-border rounded px-3 py-2 text-sm text-white focus:border-tapo-accent-m outline-none font-mono" />
                   </div>
                 </div>
              </div>
            </div>

            {saveMessage && (
              <div className={`mt-6 p-3 rounded text-sm font-mono text-center ${saveMessage.includes('Error') ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                {saveMessage}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-tapo-border flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded text-xs font-mono text-tapo-dim hover:text-white hover:bg-tapo-panel transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={saveSettings}
                className="bg-tapo-accent-b hover:bg-tapo-accent-m text-white font-bold px-6 py-2 rounded text-xs font-mono tracking-wider transition-colors shadow-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTRIBUTORS MODAL */}
      {isContributorsOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setIsContributorsOpen(false)}
        >
          <div 
            className="bg-tapo-panel2 border border-tapo-border2 rounded-2xl w-full max-w-[500px] max-h-[85vh] overflow-y-auto p-8 relative shadow-[0_32px_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200 custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsContributorsOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full text-tapo-dim hover:text-white hover:bg-white/5 border border-transparent hover:border-tapo-border2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-extrabold mb-1 text-white">Tapo Camera Members</h2>
            <div className="text-[10px] font-mono text-tapo-dim tracking-[0.1em] uppercase mb-6 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-tapo-border">
              Network Contributors
            </div>

            <div className="flex flex-col gap-3">
              {[
                { name: 'David Marica', location: 'Cluj', cameras: 2 },
                { name: 'Emanuelo Andrei', location: 'Arges', cameras: 1 },
                { name: 'Gino Robert', location: 'Alba', cameras: 4 },
                { name: 'Nonibucu', location: 'Bihor', cameras: 1 },
                { name: 'Radu', location: 'Braila', cameras: 2 },
                { name: 'Cristian Suciu', location: 'Ialomita', cameras: 4 },
                { name: 'Ionel Curcan', location: 'Suceava', cameras: 5 },
                { name: 'Iosif Bodnariu', location: 'Timis', cameras: 1 },
                { name: 'Razvan Orbu', location: 'Bucuresti', cameras: 3 },
              ].map((member, i) => (
                <div key={i} className="flex items-center justify-between bg-tapo-panel/40 border border-tapo-border p-3 rounded-lg">
                  <div>
                    <div className="text-white text-sm font-semibold">{member.name}</div>
                    <div className="text-[10px] text-tapo-dim font-mono">{member.location}</div>
                  </div>
                  <div className="text-xs font-mono bg-tapo-accent-b/10 text-tapo-accent-b px-2 py-1 rounded">
                    {member.cameras} {member.cameras === 1 ? 'cam' : 'cams'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LINKS MODAL */}
      {isLinksOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setIsLinksOpen(false)}
        >
          <div 
            className="bg-tapo-panel2 border border-tapo-border2 rounded-2xl w-full max-w-[600px] max-h-[85vh] overflow-y-auto p-8 relative shadow-[0_32px_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200 custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsLinksOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full text-tapo-dim hover:text-white hover:bg-white/5 border border-transparent hover:border-tapo-border2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-extrabold mb-1 text-white">Special Sites &amp; Social</h2>
            <div className="text-[10px] font-mono text-tapo-dim tracking-[0.1em] uppercase mb-6 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-tapo-border">
              Useful Links &amp; Profiles
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-tapo-accent-b mb-3 font-mono uppercase tracking-wider">Creator Social Media</h3>
                <div className="flex flex-wrap gap-2">
                  <a href="https://www.youtube.com/@davidmarica" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:border-tapo-border2 px-3 py-1.5 flex items-center gap-1.5 transition-colors rounded text-[11px] font-mono text-white">YouTube</a>
                  <a href="https://davidmarica.blogspot.com/" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:border-tapo-border2 px-3 py-1.5 flex items-center gap-1.5 transition-colors rounded text-[11px] font-mono text-white">Blog</a>
                  <a href="https://www.facebook.com/david.marica.5" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:border-tapo-border2 px-3 py-1.5 flex items-center gap-1.5 transition-colors rounded text-[11px] font-mono text-white">Facebook</a>
                  <a href="https://www.instagram.com/david.marica/" target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:border-tapo-border2 px-3 py-1.5 flex items-center gap-1.5 transition-colors rounded text-[11px] font-mono text-white">Instagram</a>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-tapo-accent-m mb-3 font-mono uppercase tracking-wider">Members &amp; Organizations on YouTube</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'Emanuelo Andrei', url: 'https://www.youtube.com/@emanuelo256' },
                    { label: 'AstROmania', url: 'https://www.youtube.com/@astROmania-org' },
                    { label: 'GMN Romania', url: 'https://www.youtube.com/@GMNRomania' },
                    { label: 'Global Meteor Network', url: 'https://www.youtube.com/@globalmeteornetwork8382' },
                    { label: 'Ichi Tanaka', url: 'https://www.youtube.com/@ichitanaka' },
                    { label: 'Astro Fireball', url: 'https://www.youtube.com/@astrofireball' },
                    { label: 'Ingo Gallacher', url: 'https://www.youtube.com/@IngoGallacher' },
                    { label: 'Iosif Bodnariu', url: 'https://www.youtube.com/@iosifbodnariu' },
                    { label: 'American Meteor Society', url: 'https://www.youtube.com/@americanmeteorsociety4298' },
                    { label: 'Intl. Meteor Organization', url: 'https://www.youtube.com/@internationalmeteororganiz2662' },
                    { label: 'Astro Asahi', url: 'https://www.youtube.com/@astroasahi' },
                    { label: 'Ionel Curcan', url: 'https://www.youtube.com/@curcanionel' },
                    { label: 'Razvan Orbu', url: 'https://www.youtube.com/@razvanorbu4862' },
                  ].map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:text-white px-3 py-2 flex items-center justify-between transition-colors rounded text-[11px] font-mono text-tapo-dim">
                      <span className="truncate mr-2">{link.label}</span>
                      <span className="opacity-50">↗</span>
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-tapo-accent-f mb-3 font-mono uppercase tracking-wider">Meteor Networks &amp; Databases</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'AstROmania', url: 'https://astromania.org/' },
                    { label: 'Global Meteor Network', url: 'https://globalmeteornetwork.org/' },
                    { label: 'IMO', url: 'https://www.imo.net/' },
                    { label: 'SETI Meteor Showers', url: 'https://meteorshowers.seti.org/' },
                    { label: 'GMN Status', url: 'https://globalmeteornetwork.org/status/' },
                    { label: 'GMN Romania Weblog', url: 'https://globalmeteornetwork.org/weblog/RO/index.html' },
                    { label: 'GMN General Weblog', url: 'https://globalmeteornetwork.org/weblog/' },
                    { label: 'Meteor Map (Tammo Jan)', url: 'https://tammojan.github.io/meteormap/' },
                    { label: 'Acoperire RO', url: 'https://sites.google.com/view/acoperire-ro/lista?authuser=0' },
                    { label: 'Fripon Single Events', url: 'https://fireball.fripon.org/list_single.php' },
                    { label: 'Fripon Multiple Events', url: 'https://fireball.fripon.org/list_multiple.php' },
                    { label: 'SARM Romania', url: 'https://www.sarm.ro/newsite/index.php' },
                    { label: 'AMS Reports (RO)', url: 'https://fireball.amsmeteors.org/members/imo_view/browse_reports?search_by_month=1&month=3&year=2025&country=RO' },
                    { label: 'Időkép Fifth Element', url: 'https://www.idokep.hu/webkamera/fifth_element' },
                    { label: 'Időkép Fifth Element 2', url: 'https://www.idokep.hu/webkamera/fifth_element2' },
                    { label: 'Időkép Füzér', url: 'https://www.idokep.hu/webkamera/vargondnoksag_fuzer2' },
                  ].map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" title={link.label} className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:text-white px-3 py-2 flex items-center justify-between transition-colors rounded text-[11px] font-mono text-tapo-dim">
                      <span className="truncate mr-2">{link.label}</span>
                      <span className="opacity-50">↗</span>
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-blue-400 mb-3 font-mono uppercase tracking-wider">Facebook Groups &amp; Forums</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'Meteor Romania FB', url: 'https://www.facebook.com/groups/meteor.romania' },
                    { label: '223916024428255 FB group', url: 'https://www.facebook.com/groups/223916024428255' },
                    { label: 'Astronomie de Amatori FB', url: 'https://www.facebook.com/groups/astronomiedeamatori' },
                    { label: 'Astronomy.ro Forum', url: 'https://www.astronomy.ro/forum/Comete-Asteroizi-Meteoriti-si-Meteori-f50.html?sid=19a8bb65a71d6dd69f96c27bf626cf43' },
                    { label: 'AstROmania Forum', url: 'https://astromania.org/forum/comete-meteori/' },
                  ].map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" title={link.label} className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:text-white px-3 py-2 flex items-center justify-between transition-colors rounded text-[11px] font-mono text-tapo-dim">
                      <span className="truncate mr-2">{link.label}</span>
                      <span className="opacity-50">↗</span>
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-teal-400 mb-3 font-mono uppercase tracking-wider">Forecast &amp; Weather</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'Meteologix Radar RO', url: 'https://meteologix.com/ro/radar-hd/romania' },
                    { label: 'MTTech Radar', url: 'https://radar.mttech.io/' },
                    { label: 'Sat24 HD RO', url: 'https://www.sat24.com/en-gb/country/ro/hd' },
                    { label: 'Meteologix Satellite', url: 'https://meteologix.com/ro/satellite/satellite-hd' },
                    { label: 'Meteo.pl', url: 'https://maps.meteo.pl/' },
                    { label: 'Significant Weather', url: 'https://meteologix.com/ro/model-charts/deu-hd/romania/significant-weather-extended.html' },
                    { label: 'WXCharts', url: 'https://www.wxcharts.com/' },
                    { label: 'StormForecast EU', url: 'https://www.stormforecast.eu/' },
                    { label: 'Estofex', url: 'https://www.estofex.org/' },
                    { label: 'Lightning Maps', url: 'https://www.lightningmaps.org/' },
                    { label: 'Dustload EU', url: 'https://portale.geosphere.at/hpEUgw/index.php?p=HP_DUSTLOAD_EU&gl=EN' },
                    { label: 'UOA Dust Forecast', url: 'https://forecast.uoa.gr/en/forecast-maps/dust/north-atlantic' },
                  ].map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" title={link.label} className="bg-tapo-panel/40 border border-tapo-border hover:bg-tapo-panel hover:text-white px-3 py-2 flex items-center justify-between transition-colors rounded text-[11px] font-mono text-tapo-dim">
                      <span className="truncate mr-2">{link.label}</span>
                      <span className="opacity-50">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxImg && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setLightboxImg(null)}
        >
          <X className="absolute top-6 right-6 w-8 h-8 text-white/50 hover:text-white cursor-pointer transition-colors" />
          <img 
            src={lightboxImg} 
            alt="Event Capture" 
            className="max-w-full max-h-[90vh] rounded-lg border border-tapo-border2 object-contain shadow-2xl"
            onClick={e => e.stopPropagation()} 
          />
        </div>
      )}

    </div>
  );
}
