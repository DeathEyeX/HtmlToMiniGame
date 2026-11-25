import * as THREE from 'three-platformize';
import type { Position } from './meshKit';

export function createLeg(parent: THREE.Group, hip: Position, knee: Position, ankle: Position) {
  const hipRest = new THREE.Vector3(...hip);
  const kneeRest = new THREE.Vector3(...knee);
  const ankleRest = new THREE.Vector3(...ankle);
  const thighRest = kneeRest.clone().sub(hipRest);
  const shinRest = ankleRest.clone().sub(kneeRest);
  const thighLength = thighRest.length();
  const shinLength = shinRest.length();
  thighRest.normalize();
  shinRest.normalize();

  const restAxis = ankleRest.clone().sub(hipRest).normalize();
  const bendRest = thighRest.clone().addScaledVector(restAxis, -thighRest.dot(restAxis)).normalize();
  const axis = new THREE.Vector3();
  const bend = new THREE.Vector3();
  const direction = new THREE.Vector3();

  function segment(rest: THREE.Vector3) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Group();
    mesh.position.copy(rest).negate();
    pivot.position.copy(rest);
    pivot.add(mesh);
    parent.add(pivot);
    return { pivot, mesh };
  }

  const upper = segment(hipRest);
  const lower = segment(kneeRest);
  const foot = segment(ankleRest);
  const contact = new THREE.Vector3(ankleRest.x, 0, ankleRest.z);

  function pose(bodyLift: number, lift: number, reach: number) {
    const hipPosition = upper.pivot.position.copy(hipRest);
    hipPosition.y += bodyLift;
    const anklePosition = foot.pivot.position.copy(ankleRest);
    anklePosition.y += lift;
    anklePosition.z += reach;
    // Shorten an overextended stride along the deck so the support foot keeps its height.
    const maxLength = thighLength + shinLength - .001;
    const lateral = anklePosition.x - hipPosition.x;
    const vertical = anklePosition.y - hipPosition.y;
    const maxStride = Math.sqrt(Math.max(0, maxLength ** 2 - lateral ** 2 - vertical ** 2));
    anklePosition.z = THREE.MathUtils.clamp(anklePosition.z, hipPosition.z - maxStride, hipPosition.z + maxStride);
    axis.subVectors(anklePosition, hipPosition);
    const distance = THREE.MathUtils.clamp(axis.length(), Math.abs(thighLength - shinLength) + .001, maxLength);
    axis.normalize();
    bend.copy(bendRest).addScaledVector(axis, -bendRest.dot(axis)).normalize();
    const along = (thighLength ** 2 - shinLength ** 2 + distance ** 2) / (2 * distance);
    const out = Math.sqrt(Math.max(0, thighLength ** 2 - along ** 2));
    const kneePosition = lower.pivot.position.copy(hipPosition).addScaledVector(axis, along).addScaledVector(bend, out);
    anklePosition.copy(hipPosition).addScaledVector(axis, distance);
    upper.pivot.quaternion.setFromUnitVectors(thighRest, direction.subVectors(kneePosition, hipPosition).normalize());
    lower.pivot.quaternion.setFromUnitVectors(shinRest, direction.subVectors(anklePosition, kneePosition).normalize());
    contact.set(anklePosition.x, Math.max(0, anklePosition.y - ankleRest.y), anklePosition.z);
  }

  return { upper: upper.mesh, lower: lower.mesh, foot: foot.mesh, contact, pose };
}

export function stepLeg(leg: ReturnType<typeof createLeg>, cycle: number, activity: number, bodyLift: number,
  stride: number, stepHeight: number) {
  // The support foot stays at deck height. Only the returning foot follows the swing arc.
  const phase = cycle - Math.floor(cycle);
  const swing = THREE.MathUtils.clamp((phase - .54) / .46, 0, 1);
  const travel = phase < .54 ? .5 - phase / .54 : swing * swing * (3 - 2 * swing) - .5;
  leg.pose(bodyLift, Math.sin(swing * Math.PI) * stepHeight * activity, travel * stride * activity);
}
