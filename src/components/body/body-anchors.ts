/**
 * Marker positions after normalising the model: origin between the feet, Y up,
 * +Z in front, body 1.75 units tall. They sit about 1.5 cm outside the surface
 * of both shipped models.
 */
export interface BodyAnchor {
  x: number;
  y: number;
  z: number;
}

export const BODY_ANCHORS: Record<string, BodyAnchor> = {
  mind: { x: 0.0, y: 1.67, z: 0.14 },
  cardio: { x: 0.045, y: 1.33, z: 0.13 },
  lungs: { x: -0.1, y: 1.39, z: 0.07 },
  fuel: { x: 0.0, y: 1.1, z: 0.14 },
  whole: { x: 0.0, y: 0.05, z: 0.22 },
};
