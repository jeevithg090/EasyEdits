import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

export interface TimelineItem {
  id: string;
  filterKey: string;
  start: number; // in seconds
  end: number; // in seconds
}

export interface TimelinePreset {
  key: string;
  name: string;
  previewGradient?: string;
}

interface TimelineEditorProps {
  duration: number; // in seconds
  currentTime: number;
  items: TimelineItem[];
  presets: TimelinePreset[];
  onUpdateItems: (items: TimelineItem[]) => void;
  onSeek: (time: number) => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  duration,
  currentTime,
  items,
  presets,
  onUpdateItems,
  onSeek,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeEdge, setResizeEdge] = useState<'start' | 'end' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialItemState, setInitialItemState] = useState<{ start: number; end: number } | null>(
    null,
  );

  // Helpers
  const getPercentage = (time: number) => Math.min(100, Math.max(0, (time / duration) * 100));
  const getTimeFromX = (x: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    return percent * duration;
  };

  // Handlers
  const handleMouseDown = (e: React.MouseEvent, item: TimelineItem) => {
    e.stopPropagation();
    setDraggingId(item.id);
    setDragStartX(e.clientX);
    setInitialItemState({ start: item.start, end: item.end });
  };

  const handleResizeStart = (e: React.MouseEvent, item: TimelineItem, edge: 'start' | 'end') => {
    e.stopPropagation();
    setResizingId(item.id);
    setResizeEdge(edge);
    setDragStartX(e.clientX);
    setInitialItemState({ start: item.start, end: item.end });
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    const time = getTimeFromX(e.clientX);
    onSeek(time);
  };

  // Global mouse move/up for drag/resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pixelToSeconds = duration / rect.width;

      if (draggingId && initialItemState) {
        const deltaX = e.clientX - dragStartX;
        const deltaSeconds = deltaX * pixelToSeconds;

        let newStart = initialItemState.start + deltaSeconds;
        let newEnd = initialItemState.end + deltaSeconds;
        const itemDuration = initialItemState.end - initialItemState.start;

        // Bounds checking
        if (newStart < 0) {
          newStart = 0;
          newEnd = itemDuration;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - itemDuration;
        }

        // Update items
        onUpdateItems(
          items.map((it) => (it.id === draggingId ? { ...it, start: newStart, end: newEnd } : it)),
        );
      }

      if (resizingId && initialItemState && resizeEdge) {
        const deltaX = e.clientX - dragStartX;
        const deltaSeconds = deltaX * pixelToSeconds;

        let newStart = initialItemState.start;
        let newEnd = initialItemState.end;

        if (resizeEdge === 'start') {
          newStart += deltaSeconds;
          // Limit min duration 0.5s & bounds
          if (newStart < 0) newStart = 0;
          if (newStart > newEnd - 0.5) newStart = newEnd - 0.5;
        } else {
          newEnd += deltaSeconds;
          // Limit min duration & bounds
          if (newEnd > duration) newEnd = duration;
          if (newEnd < newStart + 0.5) newEnd = newStart + 0.5;
        }

        onUpdateItems(
          items.map((it) => (it.id === resizingId ? { ...it, start: newStart, end: newEnd } : it)),
        );
      }
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setResizingId(null);
      setResizeEdge(null);
      setInitialItemState(null);
    };

    if (draggingId || resizingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingId,
    resizingId,
    resizeEdge,
    dragStartX,
    initialItemState,
    duration,
    items,
    onUpdateItems,
  ]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onUpdateItems(items.filter((it) => it.id !== id));
  };

  return (
    <div className="w-full bg-black/40 rounded-xl p-4 border border-white/10 select-none">
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>00:00</span>
        <span>Timeline Editor</span>
        <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
      </div>

      {/* Track Container */}
      <div
        ref={trackRef}
        className="relative h-16 bg-gray-800/50 rounded-lg overflow-hidden cursor-crosshair border border-white/5"
        onClick={handleTrackClick}
      >
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none transition-all duration-75"
          style={{ left: `${getPercentage(currentTime)}%` }}
        />

        {/* Clips */}
        {items.map((item) => {
          const preset = presets.find((p) => p.key === item.filterKey);
          const isDragging = draggingId === item.id;
          const isResizing = resizingId === item.id;

          return (
            <div
              key={item.id}
              className={`absolute top-1 bottom-1 rounded-md text-xs flex items-center justify-center overflow-hidden border group
                                ${isDragging || isResizing ? 'z-10' : 'z-0'}
                                transition-colors
                            `}
              style={{
                left: `${getPercentage(item.start)}%`,
                width: `${getPercentage(item.end) - getPercentage(item.start)}%`,
                backgroundColor: isDragging ? '#4ade80' : '#3b82f6', // Green dragging, Blue normal
                borderColor: isDragging ? '#22c55e' : '#60a5fa',
                opacity: 0.9,
              }}
              onMouseDown={(e) => handleMouseDown(e, item)}
            >
              {/* Background Gradient from preset */}
              <div
                className={`absolute inset-0 opacity-50 bg-gradient-to-r ${preset?.previewGradient || 'from-gray-500 to-gray-600'}`}
              />

              {/* Label */}
              <span className="relative z-10 font-medium text-white shadow-sm truncate px-2">
                {preset?.name || item.filterKey}
              </span>

              {/* Resize Handles */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-20"
                onMouseDown={(e) => handleResizeStart(e, item, 'start')}
              />
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-20"
                onMouseDown={(e) => handleResizeStart(e, item, 'end')}
              />

              {/* Delete Button (visible on hover) */}
              <button
                className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 rounded transition-opacity z-20"
                onClick={(e) => handleDelete(e, item.id)}
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-2 text-center">
        Drag center to move • Drag edges to resize • Click track to seek
      </p>
    </div>
  );
};
