import { describe, expect, it } from "vitest";
import { compositionSize } from "./beforeAfterComposition";

describe("layout do estático fiel de antes e depois", () => {
  it("usa telas verticais adequadas para feed e story", () => {
    expect(compositionSize("4:5")).toEqual({ width: 1080, height: 1350 });
    expect(compositionSize("9:16")).toEqual({ width: 1080, height: 1920 });
  });
});

