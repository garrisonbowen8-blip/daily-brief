"use client";

// Drag-to-sort column or row of tiles.
// Pass `editMode` to show handles; otherwise renders transparently.

import {
  DndContext,
  DragEndEvent,
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
import { ReactNode } from "react";

// ── Single sortable wrapper ───────────────────────────────────────────────────
export function SortableTile({
  id,
  editMode,
  children,
}: {
  id: string;
  editMode: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    opacity: isDragging ? 0.45 : 1,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            zIndex: 20,
            cursor: "grab",
            color: "#ffffff55",
            fontSize: 14,
            lineHeight: 1,
            padding: "2px 4px",
            borderRadius: 4,
            background: "#ffffff08",
            userSelect: "none",
          }}
        >
          ⠿
        </div>
      )}
      {children}
    </div>
  );
}

// ── Sortable section (vertical column) ───────────────────────────────────────
export function SortableColumn({
  ids,
  setIds,
  editMode,
  children,
  className = "flex flex-col gap-3",
}: {
  ids: string[];
  setIds: (ids: string[]) => void;
  editMode: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const from = ids.indexOf(active.id as string);
      const to   = ids.indexOf(over.id as string);
      setIds(arrayMove(ids, from, to));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {ids.map(id => (
            <SortableTile key={id} id={id} editMode={editMode}>
              {children(id)}
            </SortableTile>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Sortable grid (rows of equal tiles) ──────────────────────────────────────
export function SortableGrid({
  ids,
  setIds,
  editMode,
  children,
  className = "grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
}: {
  ids: string[];
  setIds: (ids: string[]) => void;
  editMode: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const from = ids.indexOf(active.id as string);
      const to   = ids.indexOf(over.id as string);
      setIds(arrayMove(ids, from, to));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>
          {ids.map(id => (
            <SortableTile key={id} id={id} editMode={editMode}>
              {children(id)}
            </SortableTile>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
