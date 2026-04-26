import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import s from "./DynamicIsland.module.css";

const ART = `${import.meta.env.BASE_URL}artwork.jpg`;

const SONG = {
  title: "Life is a Highway",
  artist: "Rascal Flatts",
  duration: 272,
};

/**
 * Animated waveform with 6 independent bars.
 * Each bar oscillates at a different speed/phase for organic motion.
 * Color matches the iOS pink-purple gradient from the reference.
 */
function Waveform({
  className,
  animating,
}: {
  className: string;
  animating: boolean;
}) {
  const bars = [
    { x: 0, h: 0.47 },
    { x: 4.5, h: 0.71 },
    { x: 9, h: 1 },
    { x: 13.5, h: 0.61 },
    { x: 18, h: 0.83 },
    { x: 22.5, h: 0.33 },
  ];

  const viewH = 30;
  const barW = 2.4;
  const barR = 1.2;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 27 ${viewH}`}
        fill="none"
        className={animating ? s.waveAnimating : s.wavePaused}
      >
        <defs>
          <linearGradient
            id="waveGrad"
            x1="13.5"
            y1="-2"
            x2="13.5"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#D4786A" />
            <stop offset="0.5" stopColor="#B85A4E" />
            <stop offset="1" stopColor="#8B3D35" />
          </linearGradient>
        </defs>
        {bars.map((bar, i) => {
          const h = bar.h * viewH;
          const y = (viewH - h) / 2;
          return (
            <rect
              key={i}
              x={bar.x}
              y={y}
              width={barW}
              height={h}
              rx={barR}
              fill="url(#waveGrad)"
              style={{
                transformOrigin: `${bar.x + barW / 2}px ${viewH / 2}px`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function DynamicIsland() {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(110);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(
        () => setProgress((p) => (p >= SONG.duration ? 0 : p + 1)),
        1000,
      );
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const dismiss = useCallback(() => setExpanded(false), []);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const onPlay = (e: React.MouseEvent) => {
    stop(e);
    setPlaying((v) => !v);
  };
  const onBack = (e: React.MouseEvent) => {
    stop(e);
    setProgress((p) => Math.max(0, p - 15));
  };
  const onFwd = (e: React.MouseEvent) => {
    stop(e);
    setProgress((p) => Math.min(SONG.duration, p + 15));
  };

  const pct = (progress / SONG.duration) * 100;
  const fmt = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(Math.floor(sec) % 60).padStart(2, "0")}`;

  // Expand: fluid with gentle bounce. Collapse: smooth, nearly no bounce.
  const springExpand = { stiffness: 130, damping: 16, mass: 1 };
  const springCollapse = { stiffness: 260, damping: 35, mass: 1 };
  const springConfig = expanded ? springExpand : springCollapse;

  // Compute target dimensions — values match the CSS exactly
  const width = expanded ? 380 : 210;
  const height = expanded ? 200 : 37.33;
  // Fixed radius — never animates, just like the real Dynamic Island

  // Motion blur: peaks mid-animation, settles to 0
  const blurProgress = useMotionValue(0);
  const blurFilter = useTransform(
    blurProgress,
    [0, 0.5, 1],
    ["blur(0px)", "blur(3px)", "blur(0px)"],
  );

  const prevExpanded = useRef(expanded);
  useEffect(() => {
    if (prevExpanded.current !== expanded) {
      prevExpanded.current = expanded;
      // Animate blur: 0 → 1 over the duration of the spring
      blurProgress.set(0);
      animate(blurProgress, 1, { duration: 0.45, ease: "easeInOut" });
    }
  }, [expanded, blurProgress]);

  const cls = [s.island, expanded ? s.expanded : ""].filter(Boolean).join(" ");

  return (
    <div className={s.wrapper}>
      {expanded && <div className={s.overlay} onClick={dismiss} />}
      <div className={s.deviceContainer}>
        <div className={s.infoRow}>
          <div className={s.infoText}>
            <h1 className={s.heading}>Dynamic Island</h1>
            <p className={s.description}>
              Web animations can get close to the feel of Dynamic Island, but
              they don't fully match the cohesion of native implementations. In
              SwiftUI, backed by Core Animation, properties like size, corner
              radius, and opacity can animate on independently tuned springs that
              start and settle at slightly different times, producing that
              organic, "alive" motion. On the web, libraries like Framer Motion
              offer similar spring physics, but achieving the same nuance usually
              requires more manual coordination. Shared element transitions are
              another gap: SwiftUI's matchedGeometryEffect handles morphing
              without extra layout work, while web approaches rely on
              FLIP techniques or absolute positioning.
            </p>
          </div>
        <div className={s.phoneCrop}>
          <div className={s.phone}>
            <img src={`${import.meta.env.BASE_URL}iPhone.png`} alt="" className={s.phoneFrame} />

            <div className={s.islandPosition}>
              <motion.div
                className={cls}
                onClick={toggle}
                initial={false}
                animate={{ width, height }}
                style={{ borderRadius: 50 }}
                transition={
                  expanded
                    ? { type: "spring", ...springExpand }
                    : {
                        width: { type: "spring", stiffness: 260, damping: 18, mass: 1 },
                        height: {
                          type: "spring",
                          stiffness: 300,
                          damping: 35,
                          mass: 1,
                        },
                      }
                }
              >
                {/* Inner blur wrapper — keeps blur contained inside overflow:hidden */}
                <motion.div
                  className={s.blurWrap}
                  style={{ filter: blurFilter }}
                >
                  {/* Camera — lives at island level so it stays put in both states */}
                  <div className={s.camera} />

                  {/* Album art — morphs between collapsed thumb and expanded art */}
                  <motion.div
                    className={s.artMorph}
                    initial={false}
                    animate={{
                      left: expanded ? 25 : 10,
                      top: expanded ? 25 : 6.66,
                      width: expanded ? 64 : 24,
                      height: expanded ? 64 : 24,
                      borderRadius: expanded ? 14 : 4,
                    }}
                    transition={{ type: "spring", ...springConfig }}
                  >
                    <img src={ART} alt="" />
                  </motion.div>

                  {/* Waveform — morphs between collapsed (right edge) and expanded (top right) */}
                  <motion.div
                    className={s.waveMorph}
                    initial={false}
                    animate={{
                      right: expanded ? 30 : 6,
                      top: expanded ? 28 : (37.33 - 27) / 2,
                      width: expanded ? 28 : 24,
                      height: expanded ? 32 : 27,
                    }}
                    transition={{ type: "spring", ...springConfig }}
                  >
                    <Waveform
                      className={s.waveformMorph}
                      animating={playing}
                    />
                  </motion.div>

                  {/* ---- EXPANDED ---- */}
                  <div className={s.expandedContent}>
                    <motion.div
                      className={s.songTitle}
                      initial={{ opacity: 0, filter: "blur(10px)", y: -20 }}
                      animate={
                        expanded
                          ? { opacity: 1, filter: "blur(0px)", y: 0 }
                          : { opacity: 0, filter: "blur(10px)", y: -20 }
                      }
                      transition={
                        expanded
                          ? {
                              y: {
                                type: "spring",
                                stiffness: 160,
                                damping: 15,
                                mass: 1,
                                delay: 0.1,
                              },
                              opacity: { duration: 0.25, delay: 0.1 },
                              filter: { duration: 0.3, delay: 0.1 },
                            }
                          : {
                              y: { duration: 0.2, ease: "easeIn" },
                              opacity: { duration: 0.15 },
                              filter: { duration: 0.15 },
                            }
                      }
                    >
                      {SONG.title}
                    </motion.div>
                    <motion.div
                      className={s.songArtist}
                      initial={{ opacity: 0, filter: "blur(10px)", y: -20 }}
                      animate={
                        expanded
                          ? { opacity: 1, filter: "blur(0px)", y: 0 }
                          : { opacity: 0, filter: "blur(10px)", y: -20 }
                      }
                      transition={
                        expanded
                          ? {
                              y: {
                                type: "spring",
                                stiffness: 160,
                                damping: 15,
                                mass: 1,
                                delay: 0.1,
                              },
                              opacity: { duration: 0.25, delay: 0.1 },
                              filter: { duration: 0.3, delay: 0.1 },
                            }
                          : {
                              y: { duration: 0.2, ease: "easeIn" },
                              opacity: { duration: 0.15 },
                              filter: { duration: 0.15 },
                            }
                      }
                    >
                      {SONG.artist}
                    </motion.div>

                    {/* Progress + controls — grouped and animate in together */}
                    <motion.div
                      className={s.lowerGroup}
                      initial={{ opacity: 0, filter: "blur(10px)", y: -20 }}
                      animate={
                        expanded
                          ? { opacity: 1, filter: "blur(0px)", y: 0 }
                          : { opacity: 0, filter: "blur(10px)", y: -20 }
                      }
                      transition={
                        expanded
                          ? {
                              y: {
                                type: "spring",
                                stiffness: 160,
                                damping: 15,
                                mass: 1,
                                delay: 0.1,
                              },
                              opacity: { duration: 0.25, delay: 0.1 },
                              filter: { duration: 0.3, delay: 0.1 },
                            }
                          : {
                              y: { duration: 0.2, ease: "easeIn" },
                              opacity: { duration: 0.15 },
                              filter: { duration: 0.15 },
                            }
                      }
                    >
                      <div className={s.progressRow}>
                        <span className={s.timeLabel}>{fmt(progress)}</span>
                        <div className={s.progressTrack}>
                          <div
                            className={s.progressFill}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={s.timeLabel}>
                          -{fmt(SONG.duration - progress)}
                        </span>
                      </div>

                      {/* Transport controls + AirPlay in one row */}
                      <div className={s.controlsRow} onClick={stop}>
                        <div className={s.controls}>
                          <button
                            className={`${s.controlBtn} ${s.btnSkipBack}`}
                            onClick={onBack}
                          >
                            <svg viewBox="0 0 39 40" fill="none">
                              <path
                                d="M16.0088 29.8252C16.999 29.8252 17.8369 29.0635 17.8369 27.6543V20.3418C17.9766 20.875 18.3701 21.332 19.0557 21.7383L31.9922 29.3555C32.5 29.6602 32.9316 29.8252 33.4521 29.8252C34.4424 29.8252 35.2803 29.0635 35.2803 27.6543V12.0518C35.2803 10.6426 34.4424 9.88086 33.4521 9.88086C32.9316 9.88086 32.5127 10.0459 31.9922 10.3506L19.0557 17.9678C18.3574 18.374 17.9766 18.8311 17.8369 19.3643V12.0518C17.8369 10.6426 16.999 9.88086 16.0088 9.88086C15.4883 9.88086 15.0693 10.0459 14.5488 10.3506L1.6123 17.9678C0.710938 18.501 0.330078 19.123 0.330078 19.8467C0.330078 20.583 0.710938 21.2051 1.6123 21.7383L14.5488 29.3555C15.0566 29.6602 15.4883 29.8252 16.0088 29.8252Z"
                                fill="white"
                              />
                            </svg>
                          </button>

                          <button
                            className={`${s.controlBtn} ${s.btnPause}`}
                            onClick={onPlay}
                          >
                            {playing ? (
                              <svg viewBox="0 0 33 40" fill="none">
                                <path
                                  d="M7.19922 35.7256H11.4297C13.0439 35.7256 13.8975 34.8721 13.8975 33.2393V7.96777C13.8975 6.2793 13.0439 5.5 11.4297 5.5H7.19922C5.58496 5.5 4.73145 6.35352 4.73145 7.96777V33.2393C4.73145 34.8721 5.58496 35.7256 7.19922 35.7256ZM20.6885 35.7256H24.9004C26.5332 35.7256 27.3682 34.8721 27.3682 33.2393V7.96777C27.3682 6.2793 26.5332 5.5 24.9004 5.5H20.6885C19.0557 5.5 18.2021 6.35352 18.2021 7.96777V33.2393C18.2021 34.8721 19.0557 35.7256 20.6885 35.7256Z"
                                  fill="white"
                                />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 33 40" fill="none">
                                <path
                                  d="M7.5 35C9.5 35 10.5 34.3 12 33.2L29 21.5C30.5 20.5 31.5 19.8 31.5 18.5C31.5 17.2 30.5 16.5 29 15.5L12 3.8C10.5 2.7 9.5 2 7.5 2C5.5 2 4 3.5 4 6V31C4 33.5 5.5 35 7.5 35Z"
                                  fill="white"
                                />
                              </svg>
                            )}
                          </button>

                          <button
                            className={`${s.controlBtn} ${s.btnSkipFwd}`}
                            onClick={onFwd}
                          >
                            <svg viewBox="0 0 39 40" fill="none">
                              <path
                                d="M5.06543 29.8252C5.58594 29.8252 6.01758 29.6602 6.52539 29.3555L19.4619 21.7383C20.1602 21.332 20.541 20.875 20.6807 20.3418V27.6543C20.6807 29.0635 21.5186 29.8252 22.5088 29.8252C23.0293 29.8252 23.4609 29.6602 23.9688 29.3555L36.918 21.7383C37.8066 21.2051 38.2002 20.583 38.2002 19.8467C38.2002 19.123 37.8066 18.501 36.918 17.9678L23.9688 10.3506C23.4609 10.0459 23.0293 9.88086 22.5088 9.88086C21.5186 9.88086 20.6807 10.6426 20.6807 12.0518V19.3643C20.541 18.8311 20.1602 18.374 19.4619 17.9678L6.52539 10.3506C6.00488 10.0459 5.58594 9.88086 5.06543 9.88086C4.0752 9.88086 3.2373 10.6426 3.2373 12.0518V27.6543C3.2373 29.0635 4.0752 29.8252 5.06543 29.8252Z"
                                fill="white"
                              />
                            </svg>
                          </button>
                        </div>

                        <button
                          className={`${s.controlBtn} ${s.btnAirplay}`}
                          onClick={stop}
                        >
                          <svg viewBox="0 0 28 40" fill="none">
                            <path
                              d="M2.01025 19.8916C2.01025 23.0474 3.29053 25.8999 5.3457 27.9775C5.4917 28.1235 5.64893 28.1235 5.77246 27.9663L6.27783 27.3936C6.4126 27.2476 6.40137 27.1128 6.2666 26.9668C4.49219 25.1362 3.38037 22.6318 3.38037 19.8916C3.38037 14.3662 7.9624 9.77295 13.5103 9.77295C19.0581 9.77295 23.6401 14.3662 23.6401 19.8916C23.6401 22.6318 22.5283 25.1362 20.7539 26.9668C20.6191 27.1128 20.6079 27.2476 20.7427 27.3936L21.248 27.9663C21.3716 28.1235 21.5288 28.1235 21.6748 27.9775C23.73 25.9111 25.0103 23.0474 25.0103 19.8916C25.0103 13.5913 19.8555 8.3916 13.5103 8.3916C7.16504 8.3916 2.01025 13.5913 2.01025 19.8916ZM5.27832 19.8916C5.27832 22.0703 6.12061 24.0356 7.51318 25.5181C7.65918 25.6753 7.81641 25.6641 7.95117 25.5181L8.45654 24.9565C8.60254 24.8105 8.58008 24.6758 8.44531 24.5186C7.3335 23.2832 6.65967 21.666 6.65967 19.8916C6.65967 16.1406 9.74805 13.041 13.5103 13.041C17.2725 13.041 20.3608 16.1406 20.3608 19.8916C20.3608 21.666 19.687 23.2832 18.5752 24.5073C18.4404 24.6646 18.418 24.7993 18.564 24.9453L19.0806 25.5181C19.2041 25.6641 19.3726 25.6753 19.5073 25.5181C20.8887 24.0356 21.7422 22.0703 21.7422 19.8916C21.7422 15.377 18.0474 11.6597 13.5103 11.6597C8.97314 11.6597 5.27832 15.377 5.27832 19.8916ZM8.54639 19.8916C8.54639 21.082 8.96191 22.1714 9.68066 23.0361C9.8042 23.1934 9.96143 23.1934 10.1074 23.0361L10.6353 22.4858C10.77 22.3511 10.7588 22.2051 10.6577 22.0479C10.1973 21.4526 9.92773 20.689 9.92773 19.8916C9.92773 17.9375 11.5562 16.3091 13.5103 16.3091C15.4644 16.3091 17.0928 17.9375 17.0928 19.8916C17.0928 20.689 16.8232 21.4526 16.3628 22.0479C16.2505 22.2051 16.2393 22.3511 16.3853 22.4971L16.9131 23.0361C17.0479 23.1934 17.2163 23.1934 17.3398 23.0361C18.0586 22.1714 18.4741 21.082 18.4741 19.8916C18.4741 17.1738 16.2393 14.9277 13.5103 14.9277C10.7812 14.9277 8.54639 17.1738 8.54639 19.8916ZM6.24414 30.0889C5.90723 30.4707 6.10938 31.0098 6.63721 31.0098H20.3608C20.8887 31.0098 21.0908 30.4595 20.7651 30.0889L13.9819 22.4185C13.7236 22.1265 13.2744 22.1265 13.0161 22.4185L6.24414 30.0889Z"
                              fill="white"
                            />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
