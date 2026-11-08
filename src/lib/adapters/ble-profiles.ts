export interface BleProfile {
  id: string;
  name: string;
  serviceUuid: string;
  measurementUuid: string;
  metrics: string[];
}

export const BLE_PROFILES: BleProfile[] = [
  {
    id: "heart-rate",
    name: "Heart Rate",
    serviceUuid: "heart_rate",
    measurementUuid: "heart_rate_measurement",
    metrics: ["heart_rate"],
  },
  {
    id: "blood-pressure",
    name: "Blood Pressure",
    serviceUuid: "blood_pressure",
    measurementUuid: "blood_pressure_measurement",
    metrics: ["blood_pressure_systolic", "blood_pressure_diastolic"],
  },
  {
    id: "thermometer",
    name: "Health Thermometer",
    serviceUuid: "health_thermometer",
    measurementUuid: "temperature_measurement",
    metrics: ["temperature_c"],
  },
  {
    id: "glucose",
    name: "Glucose",
    serviceUuid: "glucose",
    measurementUuid: "glucose_measurement",
    metrics: ["blood_glucose"],
  },
  {
    id: "pulse-oximeter",
    name: "Pulse Oximeter",
    serviceUuid: "pulse_oximeter",
    measurementUuid: "plx_spot_check_measurement",
    metrics: ["oxygen_saturation", "heart_rate"],
  },
  {
    id: "weight-scale",
    name: "Weight Scale",
    serviceUuid: "weight_scale",
    measurementUuid: "weight_measurement",
    metrics: ["body_mass"],
  },
];

export function bleProfile(id: string): BleProfile | null {
  return BLE_PROFILES.find((profile) => profile.id === id) ?? null;
}

export async function requestBleMeasurement(profileId: string): Promise<BluetoothRemoteGATTCharacteristic> {
  const profile = bleProfile(profileId);
  if (!profile) throw new Error(`unknown BLE profile: ${profileId}`);
  if (!("bluetooth" in navigator)) throw new Error("Web Bluetooth is not available on this device");
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [profile.serviceUuid] }],
    optionalServices: [profile.serviceUuid],
  });
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(profile.serviceUuid);
  return service.getCharacteristic(profile.measurementUuid);
}
