import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function useBoardSensors() {
  return useSensors(
    // 8px of movement before a drag starts, so clicking a card still opens
    // the detail modal rather than picking the card up.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),

    // 250ms hold before dragging on touch. Without this, scrolling the board
    // on a phone is impossible -- every swipe is read as a drag.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),

    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}
