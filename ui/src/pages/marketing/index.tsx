import React from "react";
import { Landing } from "./Landing";
import { BuyerPage } from "./BuyerPage";

export { Landing } from "./Landing";
export { BuyerPage, BUYERS } from "./BuyerPage";

/** Renders the marketing site for a given pathname (server SPA-fallback serves
 * index.html for /marketing/*, so we route by window.location.pathname). */
export function MarketingSite({ pathname }: { pathname: string }) {
  const rest = pathname.replace(/^\/marketing\/?/, "").replace(/\/$/, "");
  if (rest === "" ) return <Landing />;
  return <BuyerPage slug={rest} />;
}
