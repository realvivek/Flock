import "@babylonjs/loaders/glTF/2.0";
import "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { components, install } from "../content";
import { degToRad, feetToM, inchesToM, clamp01, smooth } from "../lib/math";
import { state, type Tier } from "../store";
import anim from "../content/animation.json";

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");
export const ROAD_NEAR = 3.0;
export const LANE = 3.6;

export interface World {
  scene: Scene;
  camera: UniversalCamera;
  mount: TransformNode;      // at the pole axis, yaw
  tilt: TransformNode;       // pitch
  falcon: TransformNode | null;
  parts: Map<string, { node: TransformNode; rest: Vector3; explode: Vector3; order: number }>;
  sedan: TransformNode | null;
  poleGroups: { solar: TransformNode | null; battery: TransformNode | null; ac: TransformNode | null; flag: TransformNode | null; utility: TransformNode | null; utilitySolar: TransformNode | null; pole: AbstractMesh[] };
  wing: TransformNode | null;
  footprint: Mesh;
  cone: Mesh;
  irLight: PointLight;
  fill: PointLight;
  hemi: HemisphericLight;
  setContextAlpha(a: number): void;
  setFalconAlpha(a: number): void;
  isolate(id: string | null): void;
  loadAct(name: "wing"): Promise<void>;
}

function ghostMaterial(m: Mesh, a: number): void {
  const mat = m.material;
  if (!(mat instanceof PBRMaterial)) return;
  const blend = a < 0.999;
  const mode = blend ? PBRMaterial.PBRMATERIAL_ALPHABLEND : PBRMaterial.PBRMATERIAL_OPAQUE;
  if (mat.transparencyMode !== mode) { mat.transparencyMode = mode; mat.needDepthPrePass = blend; }
}

function findNode(root: TransformNode, name: string): TransformNode | null {
  if (root.name === name) return root;
  for (const c of root.getChildTransformNodes(false)) if (c.name === name) return c;
  return null;
}

export async function createWorld(engine: AbstractEngine, tier: Tier): Promise<World> {
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0.969, 0.973, 0.965, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0055;
  scene.fogColor = new Color3(0.969, 0.973, 0.965);

  const camera = new UniversalCamera("cam", new Vector3(-9, 1.6, -7), scene);
  camera.minZ = 0.03;
  camera.maxZ = 300;
  camera.fov = 0.7;

  // Image-based lighting from a small procedural dusk sky.
  const env = new HDRCubeTexture(`${BASE}env/studio.hdr`, scene, 128, false, true, false, true);
  scene.environmentTexture = env;
  scene.environmentIntensity = 0.55;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.35;
  hemi.groundColor = new Color3(0.55, 0.56, 0.56);
  const key = new DirectionalLight("key", new Vector3(-0.55, -0.8, 0.35), scene);
  key.intensity = 1.5;
  key.diffuse = new Color3(1.0, 0.97, 0.92);
  key.position = new Vector3(8, 12, -6);
  const rim = new DirectionalLight("rim", new Vector3(0.5, -0.4, -0.75), scene);
  rim.intensity = 0.35;
  rim.diffuse = new Color3(0.85, 0.9, 1.0);
  const irLight = new PointLight("ir", new Vector3(0, 3.05, 0.3), scene);
  irLight.diffuse = new Color3(1.0, 0.12, 0.08);
  irLight.intensity = 0;
  irLight.range = 0.9;
  // Camera-attached fill so thin boards read during the exploded view.
  const fill = new PointLight("fill", new Vector3(0, 0, 0), scene);
  fill.diffuse = new Color3(0.9, 0.93, 1.0);
  fill.intensity = 0;
  fill.range = 8;
  fill.parent = camera;

  let shadows: ShadowGenerator | null = null;
  if (tier !== "low") {
    shadows = new ShadowGenerator(tier === "high" ? 2048 : 1024, key);
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadows.bias = 0.0008;
    shadows.normalBias = 0.02;
    key.shadowMinZ = 1;
    key.shadowMaxZ = 60;
  }

  // Post-processing
  if (tier !== "low") {
    const pipe = new DefaultRenderingPipeline("pipe", true, scene, [camera]);
    pipe.fxaaEnabled = true;
    pipe.bloomEnabled = false;
    pipe.imageProcessing.toneMappingEnabled = true;
    pipe.imageProcessing.toneMappingType = 1; // ACES
    pipe.imageProcessing.exposure = 1.0;
    pipe.imageProcessing.contrast = 1.05;
    pipe.imageProcessing.vignetteEnabled = false;
    if (tier === "high") { pipe.samples = 4; }
  }

  const load = (file: string): Promise<AssetContainer> => LoadAssetContainerAsync(`${BASE}models/${file}`, scene);
  const [falconC, poleC, streetC] = await Promise.all([load("falcon.glb"), load("pole.glb"), load("street.glb")]);
  for (const c of [falconC, poleC, streetC]) c.addAllToScene();

  const allMeshes = (c: AssetContainer) => c.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
  for (const c of [poleC, streetC]) for (const m of allMeshes(c)) { m.receiveShadows = true; shadows?.addShadowCaster(m, false); m.isPickable = false; }
  for (const m of allMeshes(falconC)) { m.receiveShadows = true; shadows?.addShadowCaster(m, false); m.isPickable = true; }
  // The floor carries the page's grid so page and scene read as one sheet: 0.5 m hairlines, 2 m dots.
  const ground = scene.getMeshByName("ground");
  if (ground) {
    ground.receiveShadows = true;
    shadows?.removeShadowCaster(ground as Mesh);
    // A shader grid on a plane just above the ground: 0.5 m hairlines, a stronger line every 2 m,
    // matching the page's blueprint sheet. Shadows still land on the PBR ground beneath.
    // Two strips, leaving the road band (runtime z 3.0 to 10.2, plus the curbs) ungridded so asphalt stays asphalt.
    const near = MeshBuilder.CreateGround("gridPlaneNear", { width: 400, height: 400 }, scene);
    near.position.set(0, 0.006, 2.75 - 200);
    const far = MeshBuilder.CreateGround("gridPlaneFar", { width: 400, height: 400 }, scene);
    far.position.set(0, 0.006, 10.5 + 200);
    const grid = new GridMaterial("grid", scene);
    grid.mainColor = new Color3(0.969, 0.973, 0.965);
    grid.lineColor = new Color3(0.106, 0.31, 0.847);
    grid.gridRatio = 0.5;
    grid.majorUnitFrequency = 4;
    grid.minorUnitVisibility = 0.6;
    grid.opacity = 0.3;
    grid.backFaceCulling = false;
    for (const gp of [near, far]) { gp.isPickable = false; gp.material = grid; }
    const gpbr = new PBRMaterial("groundPaper", scene);
    gpbr.albedoColor = new Color3(0.93, 0.935, 0.925);
    gpbr.metallic = 0; gpbr.roughness = 0.95;
    ground.material = gpbr;
  }
  const road = scene.getMeshByName("road");
  if (road) { road.receiveShadows = true; shadows?.removeShadowCaster(road as Mesh); }

  // Falcon mount: yaw node at the pole axis, pitch node, then the model whose origin is 0.10 m in front of the axis.
  const mount = new TransformNode("mount", scene);
  mount.position = new Vector3(0, feetToM(install.pole.cameraHeightFt), 0);
  const tilt = new TransformNode("tilt", scene);
  tilt.parent = mount;
  const falconRoot = falconC.rootNodes[0] as TransformNode | undefined;
  const falcon = falconRoot ? findNode(falconRoot, "falcon") ?? falconRoot : null;
  if (falcon) {
    falcon.parent = tilt;
    falcon.position = new Vector3(0, 0, 0.10);
    falcon.rotationQuaternion = null;
    falcon.rotation = Vector3.Zero();
  }
  const parts = new Map<string, { node: TransformNode; rest: Vector3; explode: Vector3; order: number }>();
  if (falcon) {
    for (const p of components.parts) {
      const node = findNode(falcon, p.node);
      if (!node) { console.warn("missing part node", p.node); continue; }
      parts.set(p.id, { node, rest: node.position.clone(), explode: new Vector3(p.explode[0], p.explode[1], p.explode[2]).scale(anim.explode.scale), order: p.order });
      for (const m of node.getChildMeshes()) m.metadata = { partId: p.id };
    }
  }

  const poleRoot = poleC.rootNodes[0] as TransformNode;
  const poleGroups = {
    solar: findNode(poleRoot, "solar_array"),
    battery: findNode(poleRoot, "battery_box"),
    ac: findNode(poleRoot, "ac_kit"),
    flag: findNode(poleRoot, "locate_flag"),
    utility: findNode(poleRoot, "utility_pole"),
    utilitySolar: findNode(poleRoot, "utility_solar"),
    pole: poleC.meshes.filter((m) => /^pole_/.test(m.name)),
  };
  if (poleGroups.ac) poleGroups.ac.setEnabled(false);
  if (poleGroups.utility) poleGroups.utility.setEnabled(false);

  const streetRoot = streetC.rootNodes[0] as TransformNode;
  const sedan = findNode(streetRoot, "sedan");

  // Detection footprint on the road (updated by the aim controller) and a faint view cone.
  const fpMat = new StandardMaterial("fp", scene);
  fpMat.emissiveColor = new Color3(0.85, 0.57, 0.12);
  fpMat.diffuseColor = Color3.Black();
  fpMat.alpha = 0.35;
  fpMat.disableLighting = true;
  fpMat.backFaceCulling = false;
  const footprint = MeshBuilder.CreateGround("footprint", { width: 1, height: 1, updatable: true }, scene);
  footprint.material = fpMat;
  footprint.isPickable = false;
  footprint.visibility = 0;
  const coneMat = new StandardMaterial("cone", scene);
  coneMat.emissiveColor = new Color3(0.85, 0.57, 0.12);
  coneMat.diffuseColor = Color3.Black();
  coneMat.alpha = 0.08;
  coneMat.disableLighting = true;
  coneMat.backFaceCulling = false;
  const cone = new Mesh("cone", scene);
  cone.material = coneMat;
  cone.isPickable = false;
  cone.visibility = 0;

  const falconMaterials = new Set<PBRMaterial>();
  for (const m of allMeshes(falconC)) if (m.material instanceof PBRMaterial) falconMaterials.add(m.material);

  const world: World = {
    scene, camera, mount, tilt, falcon, parts, sedan, poleGroups, wing: null, footprint, cone, irLight, fill, hemi,
    // The glTF loader marks every material opaque, so visibility alone writes alpha without blending;
    // switch the materials to alpha blend while ghosted and back to opaque at full visibility.
    setContextAlpha(a: number) {
      for (const m of allMeshes(poleC)) { m.visibility = a; ghostMaterial(m, a); }
    },
    setFalconAlpha(a: number) {
      for (const m of allMeshes(falconC)) { m.visibility = a; ghostMaterial(m, a); }
    },
    isolate(id: string | null) {
      for (const [pid, p] of parts) {
        const on = id === null || pid === id;
        for (const m of p.node.getChildMeshes()) { m.visibility = on ? 1 : 0.08; if (m instanceof Mesh) ghostMaterial(m, on ? 1 : 0.08); }
      }
    },
    async loadAct(name) {
      if (name === "wing" && !world.wing) {
        const c = await load("wing.glb");
        c.addAllToScene();
        const root = c.rootNodes[0] as TransformNode;
        world.wing = findNode(root, "wing_closet") ?? root;
        world.wing.position = new Vector3(-3.2, 0.9, -2.6);
        world.wing.rotation = new Vector3(0, degToRad(35), 0);
        for (const m of allMeshes(c)) { m.receiveShadows = true; m.isPickable = false; }
        world.wing.setEnabled(false);
      }
    },
  };
  void falconMaterials;
  return world;
}

/** Explode amount for part index i (0..n-1) at act progress p, staggered so parts leave one after another. */
export function explodeAmount(p: number, i: number, n: number): number {
  const e = anim.explode;
  const local = clamp01((p - e.start) / (e.end - e.start));
  const s = e.stagger;
  const start = (i / Math.max(1, n - 1)) * s;
  const out = smooth(clamp01((local - start) / (1 - s)));
  // Re-assemble in the last stretch of the act so the next act sees an intact camera.
  const back = 1 - smooth(clamp01((p - e.implodeStart) / (1 - e.implodeStart)));
  return out * back;
}

/** Update the footprint quad from the camera's pose and the published field of view. */
export function updateFootprint(world: World): void {
  const { footprint, cone, mount, tilt } = world;
  const cov = install.coverage;
  const camPos = mount.getAbsolutePosition().add(new Vector3(0, 0, 0));
  // forward vector in world space from the tilt node
  const fwd = new Vector3(0, 0, 1);
  const rotQ = tilt.absoluteRotationQuaternion ?? Quaternion.Identity();
  const dir = fwd.applyRotationQuaternion(rotQ).normalize();
  const halfW = Math.atan((feetToM(cov.widthFt) / 2) / feetToM(cov.distFt)); // half horizontal fov
  const aspect = 3 / 4; // vertical/horizontal for a portrait-ish 4:3 sensor turned; keep modest
  const halfH = Math.atan(Math.tan(halfW) * aspect);
  const right = Vector3.Cross(dir, Vector3.Up()).normalize().scale(-1);
  const up = Vector3.Cross(right, dir).normalize();
  const origin = camPos.add(new Vector3(0, 0, 0));
  const hit = (d: Vector3): Vector3 | null => {
    if (d.y >= -1e-4) return null;
    const t = -origin.y / d.y;
    if (t > feetToM(cov.maxFt) * 1.15) return null;
    return origin.add(d.scale(t));
  };
  const corners: Vector3[] = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const d = dir.add(right.scale(Math.tan(halfW) * sx)).add(up.scale(Math.tan(halfH) * sy)).normalize();
    const h = hit(d);
    if (!h) { const far = origin.add(d.scale(feetToM(cov.maxFt) * 1.15)); far.y = 0.02; corners.push(far); } else { h.y = 0.02; corners.push(h); }
  }
  const pos: number[] = [];
  for (const c of corners) pos.push(c.x, c.y, c.z);
  footprint.setVerticesData("position", pos, true);
  footprint.setIndices([0, 1, 2, 0, 2, 3]);
  footprint.refreshBoundingInfo();
  // cone: apex to the four corners
  const cpos = [origin.x, origin.y, origin.z, ...pos];
  const cidx = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1];
  cone.setVerticesData("position", cpos, true);
  cone.setIndices(cidx);
  cone.refreshBoundingInfo();
}

export const FALCON_LOCAL_CENTER = new Vector3(0, 0, 0.10);
export const AIM_DEFAULT_YAW = 62;
export { inchesToM };
