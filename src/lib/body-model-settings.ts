const STORAGE_KEY = "starplus-body-model";

export type BodyModel = "female" | "male";

export function bodyModel(): BodyModel {
  try {
    return localStorage.getItem(STORAGE_KEY) === "male" ? "male" : "female";
  } catch {
    return "female";
  }
}

export function setBodyModel(model: BodyModel): void {
  try {
    localStorage.setItem(STORAGE_KEY, model);
  } catch {
    /* storage unavailable */
  }
}
