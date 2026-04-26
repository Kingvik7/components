/**
 * Frosted Glass — reusable WebGL shader effect
 *
 * Renders a frosted glass shape over a background texture.
 * Provide an SDF function via the `sdfMain` string that sets `float d`
 * (the signed distance in pixels) and `vec2 shapeCenter` (for the top gradient).
 */

export const VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x, -a_position.y) * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const VERT_STANDARD = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/**
 * Builds a frosted glass fragment shader.
 *
 * @param extraUniforms - additional uniform declarations (e.g. for SDF params)
 * @param extraFunctions - additional GLSL functions (e.g. SDF helpers)
 * @param sdfMain - GLSL code that computes `float d` (signed distance in device pixels)
 *                  and `vec2 shapeCenter` (center for the top gradient).
 *                  Has access to: px, center, u_dpr, u_resolution, and any extraUniforms.
 * @param iconCode - optional GLSL code for rendering icons inside the shape.
 *                   Has access to `base` (vec3) to mix into.
 * @param alphaMode - "opaque" writes bg outside shape, "transparent" writes alpha 0.
 */
export function buildFrostedGlassFrag({
  extraUniforms = "",
  extraFunctions = "",
  sdfMain,
  iconCode = "",
  alphaMode = "opaque" as "opaque" | "transparent",
}: {
  extraUniforms?: string;
  extraFunctions?: string;
  sdfMain: string;
  iconCode?: string;
  alphaMode?: "opaque" | "transparent";
}) {
  return `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_dpr;
uniform vec2  u_resolution;
uniform sampler2D u_background;
uniform vec2 u_bgSize;
${extraUniforms}

vec2 coverUV(vec2 uv) {
  float canvasAspect = u_resolution.x / u_resolution.y;
  float imgAspect = u_bgSize.x / u_bgSize.y;
  vec2 scale = canvasAspect > imgAspect
    ? vec2(1.0, imgAspect / canvasAspect)
    : vec2(canvasAspect / imgAspect, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

${extraFunctions}

void main() {
  vec2 px = v_uv * u_resolution;
  vec2 center = u_resolution * 0.5;

  // --- SDF (provided by caller) ---
  float d;
  vec2 shapeCenter;
  {
    ${sdfMain}
  }

  vec2 bgUV = coverUV(v_uv);
  vec3 bg = texture(u_background, bgUV).rgb;

  // outside shape
  if (d > 0.5 * u_dpr) {
    ${alphaMode === "transparent" ? "fragColor = vec4(0.0); return;" : "fragColor = vec4(bg, 1.0); return;"}
  }

  // ---- frosted glass blur ----
  vec3 blurred = vec3(0.0);
  float tw = 0.0;
  float bSz = 4.0 / u_resolution.y;
  for (int x = -4; x <= 4; x++) {
    for (int y = -4; y <= 4; y++) {
      float w = exp(-0.5 * float(x*x + y*y) / 6.0);
      blurred += texture(u_background, bgUV + vec2(float(x), float(y)) * bSz).rgb * w;
      tw += w;
    }
  }
  blurred /= tw;

  // ---- tinted glass ----
  vec3 darkTint = vec3(0.10, 0.12, 0.18);
  vec3 base = mix(darkTint, blurred, 0.40);
  base *= 0.75;

  // ---- top gradient ----
  vec2 local = (px - shapeCenter) / (u_resolution.y * 0.1);
  float topGrad = smoothstep(0.2, -0.9, local.y);
  base += topGrad * 0.04;

  // ---- luminous edge ring ----
  float distPx = d / u_dpr;
  float ring = smoothstep(1.5, 0.0, abs(distPx)) * 0.35;
  float bloom = smoothstep(8.0, 0.0, distPx) * smoothstep(-3.0, 0.0, distPx) * 0.12;
  vec3 ringCol = vec3(0.45, 0.50, 0.65);
  base += (ring + bloom) * ringCol;

  // ---- icons (optional) ----
  ${iconCode}

  // ---- composite ----
  float aa = smoothstep(0.5 * u_dpr, -1.0 * u_dpr, d);
  ${alphaMode === "transparent"
    ? "fragColor = vec4(base * aa, aa);"
    : "vec3 col = mix(bg, base, aa); fragColor = vec4(col, 1.0);"}
}`;
}

/**
 * Helper to compile & link a WebGL2 program.
 */
export function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
  function compile(type: number, src: string) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
    return sh;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
  return prog;
}

/**
 * Sets up a fullscreen quad for rendering.
 */
export function setupQuad(gl: WebGL2RenderingContext, prog: WebGLProgram) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
}

/**
 * Loads a background image texture into the given unit.
 * Returns a callback to set bgSize uniform once loaded.
 */
export function loadBackgroundTexture(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  src: string,
  unit = 0,
) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([80, 60, 120, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(prog, "u_background"), unit);
  gl.uniform2f(gl.getUniformLocation(prog, "u_bgSize"), 1.0, 1.0);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.uniform2f(gl.getUniformLocation(prog, "u_bgSize"), img.naturalWidth, img.naturalHeight);
  };
  img.src = src;
}
