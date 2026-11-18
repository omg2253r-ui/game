import React from "react";
import { Composition } from "remotion";
import { NayaiamShort, NAYAIAM_FRAMES } from "./videos/nayaiam/Short";
export const Root: React.FC = () => (
  <>
    <Composition id="NayaiamShort" component={NayaiamShort} durationInFrames={NAYAIAM_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
