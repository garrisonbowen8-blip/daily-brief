"use client";

/**
 * TileBoard — single DndContext spanning all zones.
 * Drag any tile to any column or row; it fills the destination's width.
 * Layout persists to localStorage.
 */

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { ReactNode, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Zone = "left" | "center" | "right" | "secondary" | "extended";

export type TileLayout = Record<Zone, string[]>;

// ── Persistence ───────────────────────────────────────────────────────────────

// v3: orb-centerpiece layout — bumping the key adopts the new default once,
// discarding v2 arrangements (edit layout still customizes from there).
const LS_KEY = "atlas-tile-layout-v3";

export function loadLayout(defaults: TileLayout): TileLayout {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaults;
    const saved: TileLayout = JSON.parse(raw);
    // Merge saved with defaults: keep saved order, append unknown tiles
    const result = {} as TileLayout;
    const allKnown = Object.values(defaults).flat();
    const placed = new Set<string>();
    (Object.keys(defaults) as Zone[]).forEach(z => {
      const savedZone = (saved[z] ?? []).filter(id => allKnown.includes(id));
      savedZone.forEach(id => placed.add(id));
      result[z] = savedZone;
    });
    // Append any tiles that weren't in the saved layout to their default zone
    (Object.keys(defaults) as Zone[]).forEach(z => {
      defaults[z].forEach(id => {
        if (!placed.has(id)) { result[z].push(id); placed.add(id); }
      });
    });
    return result;
  } catch { return defaults; }
}

export function saveLayout(layout: TileLayout) {
  localStorage.setItem(LS_KEY, JSON.stringify(layout));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findZone(id: string, layout: TileLayout): Zone | null {
  for (const zone of Object.keys(layout) as Zone[]) {
    if (layout[zone].includes(id)) return zone;
  }
  return null;
}

// ── Sortable tile wrapper ─────────────────────────────────────────────────────

function SortableTile({
  id, editMode, children,
}: { id: string; editMode: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 180ms ease",
        opacity: isDragging ? 0.25 : 1,
        position: "relative",
      }}
    >
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          title="Drag to move"
          style={{
            position: "absolute", top: 6, right: 6, zIndex: 50,
            cursor: "grab", color: "#ffffff66", fontSize: 16,
            padding: "2px 5px", borderRadius: 4,
            background: "#ffffff0c",
            backdropFilter: "blur(4px)",
            lineHeight: 1,
            userSelect: "none",
            touchAction: "none",
          }}
        >
          ⠿
        </div>
      )}
      {children}
    </div>
  );
}

// ── Droppable zone wrapper ────────────────────────────────────────────────────
// Needed so dragging over an EMPTY zone still registers a valid drop target.

function DroppableZone({
  id, children, className,
}: { id: string; children: ReactNode; className?: string }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className ?? "flex flex-col gap-3 min-h-[40px]"}>
      {children}
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────

export default function TileBoard({
  defaults,
  editMode,
  tileMap,
  fixedCenter,   // rendered above the sortable center tiles (clock + orb)
  className,
}: {
  defaults: TileLayout;
  editMode: boolean;
  tileMap: Record<string, ReactNode>;
  fixedCenter?: ReactNode;
  className?: string;
}) {
  const [layout, setLayout] = useState<TileLayout>(defaults);
  const [activeId, setActiveId] = useState<string | null>(null);
  const layoutRef = useRef(layout);

  useEffect(() => { setLayout(loadLayout(defaults)); }, []);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Reset exposed via window so the page can call it
  useEffect(() => {
    (window as unknown as Record<string, () => void>).__atlasResetLayout = () => {
      localStorage.removeItem(LS_KEY);
      setLayout(defaults);
    };
  }, [defaults]);

  // ── DnD handlers ────────────────────────────────────────────────────────────

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = active.id as string;
    const overId   = over.id as string;

    const activeZone = findZone(activeId, layoutRef.current);
    // overId is either a tile id or a zone droppable id
    const overZone = findZone(overId, layoutRef.current)
                  ?? (overId in defaults ? overId as Zone : null);

    if (!activeZone || !overZone || activeZone === overZone) return;

    setLayout(prev => {
      const srcList  = prev[activeZone].filter(id => id !== activeId);
      const dstList  = [...prev[overZone]];
      const overIdx  = dstList.indexOf(overId);
      const insertAt = overIdx >= 0 ? overIdx : dstList.length;
      dstList.splice(insertAt, 0, activeId);
      const next = { ...prev, [activeZone]: srcList, [overZone]: dstList };
      layoutRef.current = next;
      return next;
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId   = over.id as string;
    const zone     = findZone(activeId, layoutRef.current);
    if (!zone) return;

    setLayout(prev => {
      const ids  = prev[zone];
      const from = ids.indexOf(activeId);
      const to   = ids.indexOf(overId);
      const next = from !== to && to !== -1
        ? { ...prev, [zone]: arrayMove(ids, from, to) }
        : prev;
      saveLayout(next);
      return next;
    });
  };

  // ── Column renderer ──────────────────────────────────────────────────────────

  const Column = ({ zone, className: cls }: { zone: Zone; className?: string }) => (
    <SortableContext items={layout[zone]} strategy={verticalListSortingStrategy}>
      <DroppableZone id={zone} className={cls ?? "flex flex-col gap-3 min-h-[40px]"}>
        {layout[zone].map(id => (
          <SortableTile key={id} id={id} editMode={editMode}>
            {tileMap[id] ?? null}
          </SortableTile>
        ))}
      </DroppableZone>
    </SortableContext>
  );

  const Grid = ({ zone, className: cls }: { zone: Zone; className?: string }) => (
    <SortableContext items={layout[zone]} strategy={rectSortingStrategy}>
      <DroppableZone
        id={zone}
        className={cls ?? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 min-h-[40px]"}
      >
        {layout[zone].map(id => (
          <SortableTile key={id} id={id} editMode={editMode}>
            {tileMap[id] ?? null}
          </SortableTile>
        ))}
      </DroppableZone>
    </SortableContext>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className={className}>
        {/* ── Hero row — the orb owns the center stage ───────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,1fr)_620px_minmax(300px,1fr)] gap-6 items-center mb-4 min-h-[82vh]">

          {/* Left */}
          <Column zone="left" className="hidden xl:flex flex-col gap-4 min-h-[40px] self-start pt-8" />

          {/* Center: fixed top (clock + orb) then sortable extras */}
          <div className="flex flex-col gap-3">
            {fixedCenter}
            <Column zone="center" />
          </div>

          {/* Right */}
          <Column zone="right" className="hidden xl:flex flex-col gap-4 min-h-[40px] self-start pt-8" />
        </div>

        {/* ── Secondary row ─────────────────────────────────────────── */}
        <Grid zone="secondary" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 mb-3" />

        {/* ── Extended row ──────────────────────────────────────────── */}
        <Grid zone="extended" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" />
      </div>

      {/* Drag overlay — shows the tile ghost while dragging */}
      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeId ? (
          <div style={{ opacity: 0.85, transform: "scale(1.02)", cursor: "grabbing" }}>
            {tileMap[activeId] ?? null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
