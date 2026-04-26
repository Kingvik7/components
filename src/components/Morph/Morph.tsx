import { useState, useCallback, useEffect, useRef } from "react";
import { useMotionValue, animate } from "motion/react";
import s from "./Morph.module.css";
import GlassButton from "./GlassButton";
import {
  VERT,
  buildFrostedGlassFrag,
  createProgram,
  setupQuad,
  loadBackgroundTexture,
} from "./frostedGlass";

const ICON1_SRC = "/scribble.svg";
const ICON2_SRC = "/eraser.svg";

const FRAG = buildFrostedGlassFrag({
  extraUniforms: `
uniform vec2  u_mouse;
uniform float u_c1x;
uniform float u_c2x;
uniform float u_iconC1x;
uniform float u_split;
uniform float u_iconFade;
uniform sampler2D u_icon1;
uniform sampler2D u_icon2;`,
  extraFunctions: `
float circleSDF(vec2 p, vec2 c, float r) { return length(p - c) - r; }

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float rawSDF(vec2 p, vec2 c1, vec2 c2, float r) {
  float d1 = circleSDF(p, c1, r);
  float d2 = circleSDF(p, c2, r);
  float gap = length(c1 - c2);
  float k = r * 2.5 * smoothstep(r * 4.0, r * 0.5, gap);
  return smin(d1, d2, k);
}

float metaballSDF(vec2 p, vec2 c1, vec2 c2, float r) {
  float dd = rawSDF(p, c1, c2, r);
  vec2 probe = c1 + vec2(0.0, -r);
  float inflation = -rawSDF(probe, c1, c2, r);
  return dd + inflation;
}`,
  sdfMain: `
    float R = 28.0 * u_dpr;
    vec2 c1 = center + vec2(u_c1x * u_dpr, 0.0);
    vec2 c2 = center + vec2(u_c2x * u_dpr, 0.0);
    d = metaballSDF(px, c1, c2, R);
    float dd1 = length(px - c1);
    float dd2 = length(px - c2);
    shapeCenter = dd1 < dd2 ? c1 : c2;`,
  iconCode: `
  // icon 1 (wave) — locked to left circle center
  {
    float R = 28.0 * u_dpr;
    vec2 c1 = center + vec2(u_c1x * u_dpr, 0.0);
    vec2 c2 = center + vec2(u_c2x * u_dpr, 0.0);
    vec2 icon1Center = center + vec2(u_iconC1x * u_dpr, 0.0);
    vec2 iconUV1 = (px - icon1Center) / (R * 0.4) * 0.5 + 0.5;
    vec4 ic1 = texture(u_icon1, iconUV1);
    if (iconUV1.x > 0.0 && iconUV1.x < 1.0 && iconUV1.y > 0.0 && iconUV1.y < 1.0) {
      base = mix(base, ic1.rgb, ic1.a);
    }

    // icon 2 (eraser)
    if (u_iconFade > 0.01) {
      vec2 icon2Center = c2;
      float iconScale = mix(0.90, 1.0, u_iconFade);
      vec2 iconUV2 = (px - icon2Center) / (R * 0.4 * iconScale) * 0.5 + 0.5;
      float blurAmt = (1.0 - u_iconFade) * 12.0 / 128.0;
      vec4 ic2 = vec4(0.0);
      ic2 += texture(u_icon2, iconUV2) * 0.25;
      ic2 += texture(u_icon2, iconUV2 + vec2(blurAmt, 0.0)) * 0.125;
      ic2 += texture(u_icon2, iconUV2 - vec2(blurAmt, 0.0)) * 0.125;
      ic2 += texture(u_icon2, iconUV2 + vec2(0.0, blurAmt)) * 0.125;
      ic2 += texture(u_icon2, iconUV2 - vec2(0.0, blurAmt)) * 0.125;
      ic2 += texture(u_icon2, iconUV2 + vec2(blurAmt, blurAmt)) * 0.0625;
      ic2 += texture(u_icon2, iconUV2 - vec2(blurAmt, blurAmt)) * 0.0625;
      ic2 += texture(u_icon2, iconUV2 + vec2(blurAmt, -blurAmt)) * 0.0625;
      ic2 += texture(u_icon2, iconUV2 - vec2(blurAmt, -blurAmt)) * 0.0625;
      if (iconUV2.x > -0.05 && iconUV2.x < 1.05 && iconUV2.y > -0.05 && iconUV2.y < 1.05) {
        base = mix(base, ic2.rgb, ic2.a * u_iconFade);
      }
    }
  }`,
  alphaMode: "opaque",
});

/* ─── WebGL init ─── */
function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false })!;
  if (!gl) throw new Error("WebGL2 not supported");

  const prog = createProgram(gl, VERT, FRAG);
  gl.useProgram(prog);
  setupQuad(gl, prog);
  loadBackgroundTexture(gl, prog, "/glass-bg.jpg", 0);

  // icon textures (units 1 & 2) — rasterized from SVG at high res
  function loadIconTexture(src: string, unit: number, uniformName: string) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(prog, uniformName), unit);

    const iconImg = new Image();
    iconImg.crossOrigin = "anonymous";
    iconImg.onload = () => {
      // Rasterize SVG at high res with padding to avoid CLAMP_TO_EDGE smearing
      const inner = 1024;
      const pad = 16;
      const aspect = iconImg.naturalWidth / iconImg.naturalHeight;
      const iw = aspect >= 1 ? inner : Math.round(inner * aspect);
      const ih = aspect >= 1 ? Math.round(inner / aspect) : inner;
      const offscreen = document.createElement("canvas");
      offscreen.width = iw + pad * 2;
      offscreen.height = ih + pad * 2;
      const ctx = offscreen.getContext("2d")!;
      ctx.clearRect(0, 0, offscreen.width, offscreen.height);
      ctx.drawImage(iconImg, pad, pad, iw, ih);

      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
      gl.generateMipmap(gl.TEXTURE_2D);
    };
    iconImg.src = src;
  }

  loadIconTexture(ICON1_SRC, 1, "u_icon1");
  loadIconTexture(ICON2_SRC, 2, "u_icon2");

  return {
    gl,
    u: {
      dpr: gl.getUniformLocation(prog, "u_dpr"),
      resolution: gl.getUniformLocation(prog, "u_resolution"),
      mouse: gl.getUniformLocation(prog, "u_mouse"),
      c1x: gl.getUniformLocation(prog, "u_c1x"),
      c2x: gl.getUniformLocation(prog, "u_c2x"),
      iconC1x: gl.getUniformLocation(prog, "u_iconC1x"),
      split: gl.getUniformLocation(prog, "u_split"),
      iconFade: gl.getUniformLocation(prog, "u_iconFade"),
      bgSize: gl.getUniformLocation(prog, "u_bgSize"),
    },
  };
}

/* ─── animation configs ─── */
const DURATION = 0.75;
const EASE = [0.22, 0.1, 0.25, 1] as const; // smooth gentle ease

export default function Morph() {
  const [split, setSplit] = useState(false);
  const toggle = useCallback(() => setSplit((v) => !v), []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouse = useRef({ x: 0, y: 0 });

  const leftX = useMotionValue(0);
  const rightX = useMotionValue(0);
  const iconLeftX = useMotionValue(0);
  const splitAnim = useMotionValue(0);
  const iconFade = useMotionValue(0);

  useEffect(() => {
    const opts = { duration: DURATION, ease: EASE as any };
    animate(leftX, split ? -38 : 0, opts);
    animate(rightX, split ? 38 : 0, opts);
    animate(iconLeftX, split ? -38 : 0, opts);
    animate(splitAnim, split ? 1 : 0, opts);
    animate(iconFade, split ? 1 : 0, split
      ? opts
      : { duration: 0.3, ease: [0.42, 0, 1, 1] as any }
    );
  }, [split, leftX, rightX, iconLeftX, splitAnim, iconFade]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { gl, u } = initGL(canvas);
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio, 2);

    canvas.width = 655 * dpr;
    canvas.height = 400 * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform1f(u.dpr, dpr);

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      targetMouse.current.x = (e.clientX - rect.left) * dpr;
      targetMouse.current.y = (e.clientY - rect.top) * dpr;
    }

    window.addEventListener("mousemove", onMove);

    function loop() {
      const speed = 5.0;
      const dt = 1.0 / 60.0;
      const factor = 1.0 - Math.exp(-speed * dt);
      mouseRef.current.x += (targetMouse.current.x - mouseRef.current.x) * factor;
      mouseRef.current.y += (targetMouse.current.y - mouseRef.current.y) * factor;

      gl.uniform2f(u.mouse, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(u.c1x, leftX.get());
      gl.uniform1f(u.c2x, rightX.get());
      gl.uniform1f(u.iconC1x, iconLeftX.get());
      gl.uniform1f(u.split, splitAnim.get());
      gl.uniform1f(u.iconFade, iconFade.get());

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, [leftX, rightX, iconLeftX, splitAnim, iconFade]);

  return (
    <div className={s.wrapper}>
      <div className={s.infoRow}>
        <div className={s.infoText}>
          <h1 className={s.heading}>Liquid Glass Morph</h1>
          <p className={s.description}>
            A recreation of SwiftUI's Liquid Glass morph effect for the web,
            built with WebGL SDFs and smooth minimum blending. The two glass
            circles split and merge with fluid, organic motion while maintaining
            consistent visual size through probe-based inflation compensation.
          </p>
        </div>
        <div className={s.canvasContainer}>
          <canvas ref={canvasRef} className={s.canvas} />
          <GlassButton onClick={toggle}>Toggle</GlassButton>
        </div>
      </div>
    </div>
  );
}
