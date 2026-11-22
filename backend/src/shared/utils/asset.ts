// What to call the rented thing on invoices, receipts, SMS and reports: a unit ("1-A") or a vehicle ("Dhaka Metro-Tha 11-2345 (CNG)").
// Vehicle invoices have no flat, so every reader that used invoice.flat.name goes through here.

/** Add next to a `flat` select: `asset: assetVehicle`. */
export const assetVehicle = { select: { vehicle: { select: { regNo: true, type: true } } } } as const;

type Labelled = {
  flat?: { name: string; floor?: { building: { name: string } } } | null;
  asset?: { vehicle: { regNo: string; type: string } | null } | null;
};

export const vehicleLabel = (v: { regNo: string; type: string }) => `${v.regNo} (${v.type})`;

/** "1-A" or the vehicle label. */
export const unitName = (x: Labelled) => x.flat?.name ?? (x.asset?.vehicle ? vehicleLabel(x.asset.vehicle) : "");

/** "1-A, Sabuj Villa" or the vehicle label. */
export const unitPlace = (x: Labelled) =>
  x.flat ? (x.flat.floor ? `${x.flat.name}, ${x.flat.floor.building.name}` : x.flat.name) : unitName(x);
