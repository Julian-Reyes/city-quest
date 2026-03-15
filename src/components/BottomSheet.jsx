/**
 * BottomSheet.jsx — Draggable bottom sheet (mobile only)
 *
 * Three states: "peek" (shows drag handle + top of list), "expanded" (full screen),
 * and "collapsed" (nearly hidden, used when a venue card is shown on the map).
 *
 * Drag behavior: touch-drag on the handle area translates the sheet vertically.
 * On release, it snaps to the nearest state based on position thresholds.
 *
 * peekPercent prop controls the peek position (default 80% = shows ~20% of content).
 * The achievements panel uses 63% to show more content since the list is shorter.
 *
 * Children are rendered in a scrollable container with overscroll-behavior: contain
 * to prevent the page from scrolling when the sheet content reaches its bounds.
 */

import { useRef, useCallback } from "react";

export function BottomSheet({
  sheetState,
  onStateChange,
  children,
  dragLabel,
  peekPercent = 80,
}) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, startTranslate: 0, isDragging: false });

  const getTranslateY = (state) => {
    switch (state) {
      case "expanded":
        return 15;
      case "peek":
        return peekPercent;
      case "collapsed":
        return 92;
      default:
        return 70;
    }
  };

  const handleTouchStart = useCallback(
    (e) => {
      dragRef.current = {
        startY: e.touches[0].clientY,
        startTranslate: getTranslateY(sheetState),
        isDragging: true,
      };
      if (sheetRef.current) sheetRef.current.style.transition = "none";
    },
    [sheetState],
  );

  const handleTouchMove = useCallback((e) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - dragRef.current.startY;
    const containerHeight = sheetRef.current.parentElement.offsetHeight;
    const deltaPercent = (deltaY / containerHeight) * 100;
    const newTranslate = Math.max(
      15,
      Math.min(92, dragRef.current.startTranslate + deltaPercent),
    );
    sheetRef.current.style.transform = `translateY(${newTranslate}%)`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    dragRef.current.isDragging = false;
    sheetRef.current.style.transition = "transform 0.3s ease";
    const match = sheetRef.current.style.transform.match(
      /translateY\(([\d.]+)%\)/,
    );
    const currentY = match ? parseFloat(match[1]) : getTranslateY(sheetState);
    let target;
    const peekY = getTranslateY("peek");
    if (currentY < (15 + peekY) / 2) target = "expanded";
    else if (currentY < (peekY + 92) / 2) target = "peek";
    else target = "collapsed";
    onStateChange(target);
    sheetRef.current.style.transform = `translateY(${getTranslateY(target)}%)`;
  }, [sheetState, onStateChange]);

  return (
    <div
      ref={sheetRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "100%",
        transform: `translateY(${getTranslateY(sheetState)}%)`,
        transition: "transform 0.3s ease",
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
        background: "#0f0f1a",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
      }}
    >
      {/* Drag handle zone (includes pill + label row) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          padding: "10px 12px 8px",
          cursor: "grab",
          touchAction: "none",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 2,
            margin: "0 auto 10px",
          }}
        />
        {dragLabel && (
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {dragLabel}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {children}
      </div>
    </div>
  );
}
