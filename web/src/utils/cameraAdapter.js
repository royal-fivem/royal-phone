import {
    CfxTexture,
    LinearFilter,
    Mesh,
    NearestFilter,
    OrthographicCamera,
    PlaneBufferGeometry,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    UnsignedByteType,
    WebGLRenderTarget,
    WebGLRenderer,
  } from "@citizenfx/three";
  
  export function Delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }
  
  const VERTEX_SHADER = `
    varying vec2 vUv;
    void main() {
      vUv = vec2(uv.x, 1.0 - uv.y);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const FRAGMENT_SHADER = `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    void main() {
      gl_FragColor = texture2D(tDiffuse, vUv);
    }
  `;
  
  class GameRender {
    constructor() {
      this.material = null;
      this.renderer = null;
      this.rtTexture = null;
      this.sceneRTT = null;
      this.cameraRTT = null;
      this.gameTexture = null;
      this.canvas = null;
      this.isAnimated = false;
      this.scId = 0;
      this.width = 344;
      this.height = 570;
      this.animFrameId = null;
  
      this.animate = this.animate.bind(this);
    }
  
    _buildScene(material, width, height) {
      const scene = new Scene();
      const plane = new PlaneBufferGeometry(width, height);
      const quad = new Mesh(plane, material);
      quad.position.z = -100;
      scene.add(quad);
      return scene;
    }
  
    _buildRenderTarget(width, height) {
      return new WebGLRenderTarget(width, height, {
        minFilter: LinearFilter,
        magFilter: NearestFilter,
        format: RGBAFormat,
        type: UnsignedByteType,
      });
    }
  
    animate() {
      this.animFrameId = requestAnimationFrame(this.animate);
  
      if (!this.isAnimated) return;
  
      const { renderer, sceneRTT, cameraRTT, rtTexture, canvas, width, height } = this;
  
      renderer.clear();
      renderer.render(sceneRTT, cameraRTT, rtTexture, true);
  
      const read = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(rtTexture, 0, 0, width, height, read);
  
      canvas.width = width;
      canvas.height = height;
  
      const imageData = new ImageData(new Uint8ClampedArray(read.buffer), width, height);
      canvas.getContext("2d").putImageData(imageData, 0, 0);
    }
  
    initializeAgain() {
      const { width, height } = this;
  
      const cameraRTT = new OrthographicCamera(
        width / -2, width / 2,
        height / 2, height / -2,
        -10000, 10000
      );
      cameraRTT.position.z = 0;
      cameraRTT.setViewOffset(width, height, 0, 0, width, height);
  
      const gameTexture = new CfxTexture();
      gameTexture.needsUpdate = true;
  
      const material = new ShaderMaterial({
        uniforms: { tDiffuse: { value: gameTexture } },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      });
  
      const renderer = new WebGLRenderer();
      renderer.setSize(width, height);
      renderer.autoClear = false;
  
      let appendArea = document.getElementById("three-game-render");
      if (!appendArea) {
        appendArea = document.createElement("div");
        appendArea.id = "three-game-render";
        appendArea.style.display = "none";
        document.body.append(appendArea);
      }
      appendArea.appendChild(renderer.domElement);
  
      this.material = material;
      this.renderer = renderer;
      this.rtTexture = this._buildRenderTarget(width, height);
      this.sceneRTT = this._buildScene(material, width, height);
      this.cameraRTT = cameraRTT;
      this.gameTexture = gameTexture;
  
      this.animFrameId = requestAnimationFrame(this.animate);
    }
  
    renderToTarget() {
      this.canvas = document.createElement("canvas");
      this.isAnimated = true;
    }
  
    resize(isScreenshot = false) {
      let width, height, cameraRTT;
  
      if (isScreenshot) {
        width = window.innerWidth;
        height = window.innerHeight;
        const viewWidth = Math.floor(height * 17 / 10);
        cameraRTT = new OrthographicCamera(
          width / -2, width / 2,
          height / 2, height / -2,
          -10000, 10000
        );
        cameraRTT.setViewOffset(width, height, 0, 0, viewWidth, height);
      } else {
        width = Math.floor(window.innerWidth / 5.58);
        height = Math.floor(window.innerHeight / 1.894);
        const viewWidth = Math.floor(height * 4 / 19);
        cameraRTT = new OrthographicCamera(
          width / -2, width / 2,
          height / 2, height / -2,
          -10000, 10000
        );
        cameraRTT.setViewOffset(width, height, width / 3.8, 0, viewWidth, height);
      }
  
      this.width = width;
      this.height = height;
      this.cameraRTT = cameraRTT;
      this.sceneRTT = this._buildScene(this.material, width, height);
      this.rtTexture = this._buildRenderTarget(width, height);
      this.renderer.setSize(width, height);
    }
  
    async getStream() {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
  
      const context = this.canvas.getContext("2d");
      if (!context) throw new Error("Failed to get 2D context");
  
      return this.canvas.captureStream(55);
    }
  
    async captureImage() {
      return this.canvas.toDataURL("image/webp", 0.5);
    }
  
    stop() {
      this.isAnimated = false;
  
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      if (this.canvas) {
        this.canvas.remove();
        this.canvas = null;
      }
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
        this.renderer = null;
      }
      if (this.material) {
        this.material.dispose();
        this.material = null;
      }
      if (this.rtTexture) {
        this.rtTexture.dispose();
        this.rtTexture = null;
      }
      if (this.gameTexture) {
        this.gameTexture.dispose();
        this.gameTexture = null;
      }
  
      this.sceneRTT = null;
      this.cameraRTT = null;
    }
  }
  
  export const MainRender = new GameRender();