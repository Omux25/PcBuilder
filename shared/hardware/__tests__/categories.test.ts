import { expect, describe, test } from "bun:test";
import { inferCategoryFromUrl } from "../categories";

describe("inferCategoryFromUrl", () => {
  test("handles null, undefined, or empty inputs gracefully", () => {
    // @ts-ignore - testing invalid input
    expect(inferCategoryFromUrl(null)).toBeNull();
    // @ts-ignore - testing invalid input
    expect(inferCategoryFromUrl(undefined)).toBeNull();
    expect(inferCategoryFromUrl("")).toBeNull();
  });

  describe("1. Explicit Category Paths", () => {
    const testCases = [
      { url: "https://example.com/ventirads-processeur/item", expected: "cooling" },
      { url: "https://example.com/kits-watercooling/item", expected: "cooling" },
      { url: "https://example.com/watercooling-aio/item", expected: "cooling" },
      { url: "https://example.com/cpu-cooler/item", expected: "cooling" },
      { url: "https://example.com/refroidissement/item", expected: "cooling" },
      { url: "https://example.com/cooling/item", expected: "cooling" },

      { url: "https://example.com/alimentations/item", expected: "psu" },
      { url: "https://example.com/alimentations-pc/item", expected: "psu" },
      { url: "https://example.com/psu-corsair/item", expected: "psu" },
      { url: "https://example.com/entre-500-w-et-700-w/item", expected: "psu" },

      { url: "https://example.com/carte-mere/item", expected: "motherboard" },
      { url: "https://example.com/cartes-meres/item", expected: "motherboard" },

      { url: "https://example.com/processeur/item", expected: "cpu" },
      { url: "https://example.com/processeurs/item", expected: "cpu" },

      { url: "https://example.com/carte-graphique/item", expected: "gpu" },
      { url: "https://example.com/cartes-graphiques-nvidia/item", expected: "gpu" },
      { url: "https://example.com/amd-radeon-rx/item", expected: "gpu" },

      { url: "https://example.com/dimm/item", expected: "ram" },
      { url: "https://example.com/memoire-vive-ddr5/item", expected: "ram" },
      { url: "https://example.com/memoire-ram/item", expected: "ram" },
      { url: "https://example.com/ram/item", expected: "ram" },

      { url: "https://example.com/disque-ssd/item", expected: "storage" },
      { url: "https://example.com/disques-durs-et-ssd/item", expected: "storage" },
      { url: "https://example.com/stockage-hdd-et-ssd/item", expected: "storage" },
      { url: "https://example.com/ssd/item", expected: "storage" },

      { url: "https://example.com/boitiers-pc/item", expected: "case" },
      { url: "https://example.com/boitier-gamer/item", expected: "case" },
      { url: "https://example.com/les-moyennes-tours/item", expected: "case" },
      { url: "https://example.com/les-grandes-tours/item", expected: "case" },
      { url: "https://example.com/les-mini-tours/item", expected: "case" },

      { url: "https://example.com/ventilateur-boitier/item", expected: "fan" },
      { url: "https://example.com/ventilateurs/item", expected: "fan" },

      { url: "https://example.com/pate-thermique-pc/item", expected: "thermal_paste" },
      { url: "https://example.com/pate-thermique/item", expected: "thermal_paste" },
    ];

    testCases.forEach(({ url, expected }) => {
      test(`correctly infers category '${expected}' from explicit path in '${url}'`, () => {
        expect(inferCategoryFromUrl(url)).toBe(expected);
      });
    });
  });

  describe("2. Product Slug Signals", () => {
    const testCases = [
      { url: "https://example.com/produit/corsair-watercooler-h100i", expected: "cooling" },
      { url: "https://example.com/produit/noctua-aircooler-nhd15", expected: "cooling" },
      { url: "https://example.com/produit/deepcool-ventirad-ak400", expected: "cooling" },
      { url: "https://example.com/produit/refroidisseur-cpu", expected: "cooling" },

      { url: "https://example.com/produit/corsair-alimentation-rm750x", expected: "psu" },
      { url: "https://example.com/produit/msi-psu-a850g", expected: "psu" },

      { url: "https://example.com/produit/asus-carte-mere-b550", expected: "motherboard" },
      { url: "https://example.com/produit/msi-motherboard-z790", expected: "motherboard" },

      { url: "https://example.com/produit/amd-processeur-ryzen-5", expected: "cpu" },
      { url: "https://example.com/produit/intel-cpu-i7", expected: "cpu" },

      { url: "https://example.com/produit/asus-carte-graphique-rtx-4090", expected: "gpu" },
      { url: "https://example.com/produit/msi-gpu-rx-7900", expected: "gpu" },

      { url: "https://example.com/produit/corsair-ram-32gb", expected: "ram" },
      { url: "https://example.com/produit/gskill-memoire-ddr5", expected: "ram" },

      { url: "https://example.com/produit/samsung-ssd-980", expected: "storage" },
      { url: "https://example.com/produit/seagate-hdd-2tb", expected: "storage" },

      { url: "https://example.com/produit/nzxt-boitier-h510", expected: "case" },
      { url: "https://example.com/produit/lian-li-case-o11", expected: "case" },

      { url: "https://example.com/produit/corsair-fan-af120", expected: "fan" },

      { url: "https://example.com/produit/noctua-pate-thermique-nt-h1", expected: "thermal_paste" },
    ];

    testCases.forEach(({ url, expected }) => {
      test(`correctly infers category '${expected}' from product slug signal in '${url}'`, () => {
        expect(inferCategoryFromUrl(url)).toBe(expected);
      });
    });
  });

  describe("Fallback Behavior for non-URL strings", () => {
    test("works when path is just a string without protocol or domain", () => {
      // It falls back to string and matches product slugs
      expect(inferCategoryFromUrl("/produit/asus-carte-mere-b550")).toBe("motherboard");
      expect(inferCategoryFromUrl("corsair-alimentation-750w")).toBe("psu");
    });

    test("works for explicit category paths passed as strings", () => {
      expect(inferCategoryFromUrl("/ventirads-processeur/")).toBe("cooling");
      expect(inferCategoryFromUrl("/boitiers-pc/")).toBe("case");
    });
  });

  describe("Unrecognized URLs", () => {
    test("returns null for unrecognized paths or domains", () => {
      expect(inferCategoryFromUrl("https://example.com/chaise-gaming/item")).toBeNull();
      expect(inferCategoryFromUrl("https://example.com/produit/tapis-de-souris")).toBeNull();
      expect(inferCategoryFromUrl("https://example.com/random/path")).toBeNull();
    });
  });
});
