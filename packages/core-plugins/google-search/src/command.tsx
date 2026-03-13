import React, { JSX } from "react";
import { PanelContainer, PanelHeading, PanelParagraph } from "@searchie/sdk";

export default function GoogleSearchPanel(): JSX.Element {
  return (
    <PanelContainer>
      <PanelHeading>Google Search</PanelHeading>
      <PanelParagraph>Edit src/command.tsx to build your panel.</PanelParagraph>
    </PanelContainer>
  );
}
