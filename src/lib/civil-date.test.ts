import { formatCivilDateBR, todayLocalCivilDate } from "@/lib/civil-date";

describe("civil dates", () => {
  it("uses the local calendar day on both sides of a UTC date boundary", () => {
    const originalTimeZone = process.env.TZ;

    try {
      const instant = new Date("2026-03-01T02:30:00Z");

      process.env.TZ = "America/Sao_Paulo";
      expect(todayLocalCivilDate(instant)).toBe("2026-02-28");

      process.env.TZ = "Pacific/Kiritimati";
      expect(todayLocalCivilDate(instant)).toBe("2026-03-01");
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });

  it("displays the supplied calendar date without timezone conversion", () => {
    const originalTimeZone = process.env.TZ;

    try {
      for (const timeZone of ["America/Sao_Paulo", "Pacific/Kiritimati"]) {
        process.env.TZ = timeZone;
        expect(formatCivilDateBR("2026-03-01")).toBe("01/03/2026");
      }
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });
});
