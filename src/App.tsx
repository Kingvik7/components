import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import Morph from "./components/Morph/Morph";
import DynamicIsland from "./components/DynamicIsland/DynamicIsland";
import s from "./App.module.css";

const tabs = ["Dynamic Island", "Liquid Glass Morph"] as const;

function App() {
  const [active, setActive] = useState<(typeof tabs)[number]>(tabs[0]);
  const navRef = useRef<HTMLDivElement>(null);
  const pillX = useMotionValue(0);
  const pillW = useMotionValue(0);
  const springX = useSpring(pillX, { stiffness: 400, damping: 30 });
  const springW = useSpring(pillW, { stiffness: 400, damping: 30 });

  const updatePill = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeEl = nav.querySelector(`.${s.active}`) as HTMLElement | null;
    if (!activeEl) return;
    pillX.set(activeEl.offsetLeft);
    pillW.set(activeEl.offsetWidth);
  }, [pillX, pillW]);

  useEffect(() => {
    updatePill();
  }, [active, updatePill]);

  return (
    <div className={s.layout}>
      <div className={s.nav} ref={navRef}>
        <motion.div
          className={s.pill}
          style={{ left: springX, width: springW }}
        />
        {tabs.map((tab) => (
          <div
            key={tab}
            className={`${s.tab} ${active === tab ? s.active : ""}`}
            onClick={() => setActive(tab)}
          >
            <span className={s.label}>{tab}</span>
          </div>
        ))}
      </div>
      {active === "Liquid Glass Morph" ? <Morph /> : <DynamicIsland />}
    </div>
  );
}

export default App;
