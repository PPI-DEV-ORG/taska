import { describe, expect, it } from "vitest";
import {
  computeLateMinutes,
  DEFAULT_ATTENDANCE_SETTINGS,
  evaluateAttendanceLocation,
  haversineMeters,
} from "./attendance.service.js";

describe("attendance GPS & geofence helpers", () => {
  it("calculates Haversine distance accurately", () => {
    // Monas Jakarta to ~111m north (+0.001 deg lat)
    const dist = haversineMeters(-6.175392, 106.827153, -6.174392, 106.827153);
    expect(dist).toBeGreaterThan(105);
    expect(dist).toBeLessThan(118);

    expect(haversineMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  it("evaluates location status for office, field role, out of radius, and missing GPS", () => {
    const officeSettings = {
      ...DEFAULT_ATTENDANCE_SETTINGS,
      officeLatitude: -6.175392,
      officeLongitude: 106.827153,
      officeRadiusMeters: 150,
      fieldRoles: ["teknisi", "sales"],
    };

    // Within radius
    const inOffice = evaluateAttendanceLocation({
      latitude: -6.175,
      longitude: 106.827153,
      userRole: "staff",
      settings: officeSettings,
    });
    expect(inOffice.locationStatus).toBe("DI_KANTOR");
    expect(inOffice.needsVerification).toBe(false);

    // Outside radius for regular staff -> needs verification
    const outsideStaff = evaluateAttendanceLocation({
      latitude: -6.2,
      longitude: 106.827153,
      userRole: "staff",
      settings: officeSettings,
    });
    expect(outsideStaff.locationStatus).toBe("DI_LUAR_RADIUS");
    expect(outsideStaff.needsVerification).toBe(true);

    // Outside radius for field role (teknisi) -> allowed
    const outsideTech = evaluateAttendanceLocation({
      latitude: -6.2,
      longitude: 106.827153,
      userRole: "teknisi",
      settings: officeSettings,
    });
    expect(outsideTech.locationStatus).toBe("LUAR_KANTOR_DINAS");
    expect(outsideTech.needsVerification).toBe(false);

    // No GPS -> TANPA_GPS
    const noGps = evaluateAttendanceLocation({
      latitude: null,
      longitude: null,
      userRole: "staff",
      settings: officeSettings,
    });
    expect(noGps.locationStatus).toBe("TANPA_GPS");
    expect(noGps.needsVerification).toBe(true);

    // Office not configured -> TERCATAT
    const unconfigured = evaluateAttendanceLocation({
      latitude: -6.2,
      longitude: 106.8,
      userRole: "staff",
      settings: DEFAULT_ATTENDANCE_SETTINGS,
    });
    expect(unconfigured.locationStatus).toBe("TERCATAT");
    expect(unconfigured.needsVerification).toBe(false);
  });

  it("computes late minutes respecting tolerance", () => {
    const onTime = new Date(2026, 10, 24, 8, 10, 0);
    expect(computeLateMinutes(onTime, "08:00", 15)).toBe(0);

    const late = new Date(2026, 10, 24, 8, 35, 0);
    expect(computeLateMinutes(late, "08:00", 15)).toBe(20);
  });
});
